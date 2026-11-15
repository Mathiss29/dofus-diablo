// Manette (maquette « Console : », AYN Thor et toute manette Xbox / PlayStation, 2026-11-15) : Gamepad API, disposition standard.
// Une seule boucle lit la manette à chaque image. Quand une fenêtre, un menu ou l'accueil est ouvert, la manette pilote l'interface
// (croix ou stick gauche = d'un bouton à l'autre, stick droit = curseur, A = cliquer, B = retour) ; sinon elle va au jeu (zoneScene).

/** Boutons de la disposition standard, nommés par leur place (Xbox : A en bas, B à droite, X à gauche, Y en haut). */
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15 } as const;
const NB = 17, MORT = 0.25;

export interface Vec2 { x: number; y: number }
/** Ce que le jeu reçoit à chaque image (boutons appuyés ou relâchés depuis l'image d'avant, sticks). */
export interface ImageManette { appuyes: number[]; relaches: number[]; tenu: (b: number) => boolean; gauche: Vec2; droite: Vec2 }
/** Ce que le jeu fournit : la zone d'interface ouverte (null = la manette joue), le retour (B), et les boutons qu'il garde en interface. */
export interface BrancheJeu {
  interface(): HTMLElement | null;
  image(m: ImageManette): void;
  /** En interface : vrai si le jeu a pris ce bouton (LB / RB / Start du menu Start…). */
  boutonUi?(b: number): boolean;
  retour?(): void;
}

let jeu: BrancheJeu | null = null;
let avant: boolean[] = new Array(NB).fill(false);
let dernierUsage = 0, derniereSouris = 0;
let lancee = false, enJeu = false;
let controles: 'auto' | 'clavier' | 'manette' = 'auto';
/** Réglage Options › Contrôles : 'clavier' coupe la manette, 'manette' la garde même quand la souris bouge. */
export function reglerControles(c: 'auto' | 'clavier' | 'manette' | undefined) { controles = c ?? 'auto'; if (controles === 'clavier') { cacherCurseur(); cacherFocus(); } }

/** Vrai si la manette a servi après la souris (le jeu vise alors avec la manette, pas avec le curseur de la souris). */
export function manetteActive(): boolean {
  if (controles !== 'auto') return controles === 'manette';
  return dernierUsage > 0 && dernierUsage >= derniereSouris;
}
export function brancherJeu(b: BrancheJeu | null) { jeu = b; }
export function brancheActuelle() { return jeu; }

/** Démarre la boucle (une fois). */
export function demarrerManette() {
  if (lancee || typeof window === 'undefined' || !navigator.getGamepads) return;
  lancee = true;
  addEventListener('mousemove', e => { if (controles !== 'manette' && e.isTrusted && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) { derniereSouris = performance.now(); cacherCurseur(); } }, { passive: true });
  addEventListener('gamepadconnected', e => console.info('[manette]', (e as GamepadEvent).gamepad.id, (e as GamepadEvent).gamepad.mapping || 'disposition inconnue'));
  const boucle = () => { try { lire(); } catch (e) { console.error('[manette]', e); } requestAnimationFrame(boucle); };
  requestAnimationFrame(boucle);
}

function pad(): Gamepad | null {
  let meilleur: Gamepad | null = null;
  for (const g of navigator.getGamepads()) if (g?.connected && (!meilleur || g.timestamp > meilleur.timestamp)) meilleur = g;
  return meilleur;
}
function stick(x: number, y: number): Vec2 {
  const n = Math.hypot(x, y);
  if (n < MORT) return { x: 0, y: 0 };
  const k = Math.min(1, (n - MORT) / (1 - MORT)) / n;
  return { x: x * k, y: y * k };
}

function lire() {
  const g = controles === 'clavier' ? null : pad();
  if (!g) { if (avant.some(Boolean)) avant = new Array(NB).fill(false); return; }
  const tenu = new Array(NB).fill(false);
  g.buttons.forEach((b, i) => { if (i < NB) tenu[i] = b.pressed || b.value > 0.5; });
  const gauche = stick(g.axes[0] ?? 0, g.axes[1] ?? 0), droite = stick(g.axes[2] ?? 0, g.axes[3] ?? 0);
  const appuyes: number[] = [], relaches: number[] = [];
  for (let i = 0; i < NB; i++) { if (tenu[i] && !avant[i]) appuyes.push(i); else if (!tenu[i] && avant[i]) relaches.push(i); }
  avant = tenu;
  if (appuyes.length || gauche.x || gauche.y || droite.x || droite.y) dernierUsage = performance.now();
  const img: ImageManette = { appuyes, relaches, tenu: b => tenu[b], gauche, droite };
  const zone = zoneUi();
  if (zone) {
    // on quitte le jeu pour l'interface : le jeu relâche tout ce qui était tenu (attaque, sort en visée)
    if (enJeu) { enJeu = false; jeu?.image({ appuyes: [], relaches: tenu.flatMap((x, i) => x ? [i] : []), tenu: () => false, gauche: { x: 0, y: 0 }, droite: { x: 0, y: 0 } }); }
    ui(zone, img);
  } else {
    if (!enJeu) { enJeu = true; img.appuyes = []; }   // un bouton appuyé dans un menu (B pour fermer…) ne part pas en jeu
    cacherCurseur(); cacherFocus(); jeu?.image(img);
  }
}

/** Zone d'interface pilotée : l'accueil, l'écran « se joue sur PC », sinon ce que le jeu dit (fenêtre, menu, carte, dialogue). */
function zoneUi(): HTMLElement | null {
  for (const id of ['tel', 'acc']) { const e = document.getElementById(id); if (e && !e.hidden && e.offsetParent !== null) return e; }
  return jeu ? jeu.interface() : document.body;
}

// ---------- Interface : focus d'un bouton à l'autre, et curseur au stick droit ----------
let focus: HTMLElement | null = null, focusZone: HTMLElement | null = null;
let modeCurseur = false, cx = innerWidth / 2, cy = innerHeight / 2;
let repDir = '', repT = 0;
let survol: HTMLElement | null = null;
let cadre: HTMLDivElement | null = null, curseur: HTMLDivElement | null = null;
let tPrec = 0;

function ui(zone: HTMLElement, m: ImageManette) {
  const t = performance.now(), dt = Math.min(0.05, tPrec ? (t - tPrec) / 1000 : 0.016); tPrec = t;
  if (zone !== focusZone) { focusZone = zone; focus = null; }
  const duJeu = zone.id !== 'tel' && zone.id !== 'acc', branche = duJeu ? jeu : null;
  if (focus && (!focus.isConnected || !zone.contains(focus))) focus = null;
  for (const b of m.appuyes) {
    if (branche?.boutonUi?.(b)) continue;
    if (b === BTN.A) activer('click');
    else if (b === BTN.X) activer('contextmenu');
    else if (b === BTN.Y) activer('dblclick');
    else if (b === BTN.B) retour(branche);
  }
  // croix, ou stick gauche poussé franchement : d'un bouton à l'autre (avec répétition quand on maintient)
  let dir = m.tenu(BTN.HAUT) ? 'h' : m.tenu(BTN.BAS) ? 'b' : m.tenu(BTN.GAUCHE) ? 'g' : m.tenu(BTN.DROITE) ? 'd' : '';
  if (!dir && Math.hypot(m.gauche.x, m.gauche.y) > 0.6) dir = Math.abs(m.gauche.x) > Math.abs(m.gauche.y) ? (m.gauche.x > 0 ? 'd' : 'g') : (m.gauche.y > 0 ? 'b' : 'h');
  if (!dir) repDir = '';
  else if (dir !== repDir) { repDir = dir; repT = t + 380; deplacerFocus(zone, dir); }
  else if (t >= repT) { repT = t + 110; deplacerFocus(zone, dir); }
  // gâchettes : faire défiler la partie qui défile sous le focus ou le curseur
  const defil = (m.tenu(BTN.RT) ? 1 : 0) - (m.tenu(BTN.LT) ? 1 : 0);
  if (defil) defiler(zone, defil * 900 * dt);
  // stick droit : curseur
  const r = m.droite;
  if (r.x || r.y) {
    if (!modeCurseur) { modeCurseur = true; if (focus) { const q = focus.getBoundingClientRect(); cx = q.left + q.width / 2; cy = q.top + q.height / 2; } }
    const v = 1100 * Math.hypot(r.x, r.y);
    cx = Math.max(0, Math.min(innerWidth - 1, cx + r.x * v * dt)); cy = Math.max(0, Math.min(innerHeight - 1, cy + r.y * v * dt));
    survoler(document.elementFromPoint(cx, cy) as HTMLElement | null);
  }
  dessiner();
}

/** Éléments qu'on peut viser dans la zone : boutons, liens, cases à cocher, et tout ce qui a le curseur « main ». */
function cibles(zone: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const W = innerWidth, H = innerHeight;
  for (const e of Array.from(zone.querySelectorAll<HTMLElement>('*'))) {
    const natif = e.matches('button:not([disabled]),a[href],input:not([type=hidden]):not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
    if (!natif) {
      const c = getComputedStyle(e).cursor;
      if (c !== 'pointer' && c !== 'grab') continue;
      const p = e.parentElement; if (p && zone.contains(p) && getComputedStyle(p).cursor === c) continue;   // on garde le plus grand élément « main »
    }
    const q = e.getBoundingClientRect();
    if (q.width < 4 || q.height < 4 || q.right < 0 || q.bottom < 0 || q.left > W || q.top > H) continue;
    if (getComputedStyle(e).visibility === 'hidden') continue;
    out.push(e);
  }
  return out;
}
function deplacerFocus(zone: HTMLElement, dir: string) {
  modeCurseur = false; cacherCurseur();
  const l = cibles(zone); if (!l.length) return;
  if (!focus || !l.includes(focus)) {
    // premier focus : l'élément le plus en haut à gauche de la zone
    focus = l.reduce((a, b) => { const qa = a.getBoundingClientRect(), qb = b.getBoundingClientRect(); return qb.top + qb.left * 0.5 < qa.top + qa.left * 0.5 ? b : a; });
  } else {
    const q = focus.getBoundingClientRect(), x0 = q.left + q.width / 2, y0 = q.top + q.height / 2;
    let best: HTMLElement | null = null, bs = Infinity;
    for (const e of l) {
      if (e === focus || focus.contains(e) || e.contains(focus)) continue;
      const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - x0, dy = r.top + r.height / 2 - y0;
      const av = dir === 'd' ? dx : dir === 'g' ? -dx : dir === 'b' ? dy : -dy, cote = dir === 'd' || dir === 'g' ? Math.abs(dy) : Math.abs(dx);
      if (av <= 2) continue;
      const s = av + cote * 2.2;
      if (s < bs) { bs = s; best = e; }
    }
    if (best) focus = best;
  }
  focus.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  survoler(focus);
}
/** Survol : les infobulles des objets et des sorts s'ouvrent comme à la souris. */
function survoler(e: HTMLElement | null) {
  if (e === survol) { if (e) envoyer(e, 'mousemove'); return; }
  const anc = (x: HTMLElement | null) => { const a: HTMLElement[] = []; for (let n = x; n; n = n.parentElement) a.push(n); return a; };
  const vieux = anc(survol), neuf = anc(e);
  for (const n of vieux) if (!neuf.includes(n)) n.dispatchEvent(new MouseEvent('mouseleave', point()));
  if (survol) survol.dispatchEvent(new MouseEvent('mouseout', { ...point(), bubbles: true }));
  survol = e;
  if (e) {
    e.dispatchEvent(new MouseEvent('mouseover', { ...point(), bubbles: true }));
    for (const n of neuf.reverse()) if (!vieux.includes(n)) n.dispatchEvent(new MouseEvent('mouseenter', point()));
    envoyer(e, 'mousemove');
  }
}
function point(): MouseEventInit {
  if (!modeCurseur && focus) { const q = focus.getBoundingClientRect(); return { clientX: q.left + q.width / 2, clientY: q.top + q.height / 2, view: window }; }
  return { clientX: cx, clientY: cy, view: window };
}
function envoyer(e: HTMLElement, type: string, extra: MouseEventInit = {}) {
  const init = { ...point(), bubbles: true, cancelable: true, ...extra };
  if (type.startsWith('pointer')) e.dispatchEvent(new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  else e.dispatchEvent(new MouseEvent(type, init));
}
function activer(type: 'click' | 'contextmenu' | 'dblclick') {
  const e = modeCurseur ? document.elementFromPoint(cx, cy) as HTMLElement | null : focus;
  if (!e) return;
  if (type === 'contextmenu') { envoyer(e, 'pointerdown', { button: 2, buttons: 2 }); envoyer(e, 'mousedown', { button: 2, buttons: 2 }); envoyer(e, 'pointerup', { button: 2 }); envoyer(e, 'mouseup', { button: 2 }); envoyer(e, 'contextmenu', { button: 2 }); return; }
  envoyer(e, 'pointerdown', { button: 0, buttons: 1 }); envoyer(e, 'mousedown', { button: 0, buttons: 1 });
  envoyer(e, 'pointerup', { button: 0 }); envoyer(e, 'mouseup', { button: 0 });
  if (e instanceof HTMLInputElement || e instanceof HTMLSelectElement || e instanceof HTMLTextAreaElement) e.focus();
  if (type === 'dblclick') { envoyer(e, 'click', { detail: 1 }); envoyer(e, 'click', { detail: 2 }); envoyer(e, 'dblclick', { detail: 2 }); }
  else if (e instanceof HTMLElement && typeof e.click === 'function' && !(e instanceof HTMLSelectElement)) e.click();
  else envoyer(e, 'click');
}
function retour(branche: BrancheJeu | null) {
  if (branche?.retour) { branche.retour(); return; }
  // accueil : Échap, comme au clavier
  const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'keyCode', { get: () => 27 });
  (document.activeElement ?? document.body).dispatchEvent(ev);
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
}
function defiler(zone: HTMLElement, dy: number) {
  let e: HTMLElement | null = modeCurseur ? document.elementFromPoint(cx, cy) as HTMLElement | null : focus ?? zone;
  for (; e && e !== document.body; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) { e.scrollTop += dy; return; }
  }
  zone.scrollTop += dy;
}

function dessiner() {
  if (!cadre) {
    const st = document.createElement('style');
    st.textContent = `#manette-focus{position:fixed;z-index:99998;pointer-events:none;border:2px solid #b9e54b;border-radius:6px;box-shadow:0 0 0 2px #0009,0 0 14px #b9e54baa;transition:all .08s}
#manette-curseur{position:fixed;z-index:99999;pointer-events:none;width:22px;height:22px;margin:-3px 0 0 -3px;
background:no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M3 2l15 9-7 1.5L8 20z' fill='%23fff' stroke='%23000' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E")}`;
    document.head.appendChild(st);
    cadre = document.createElement('div'); cadre.id = 'manette-focus'; cadre.hidden = true; document.body.appendChild(cadre);
    curseur = document.createElement('div'); curseur.id = 'manette-curseur'; curseur.hidden = true; document.body.appendChild(curseur);
  }
  if (modeCurseur) { cadre.hidden = true; curseur!.hidden = false; curseur!.style.left = `${cx}px`; curseur!.style.top = `${cy}px`; return; }
  curseur!.hidden = true;
  if (!focus) { cadre.hidden = true; return; }
  const q = focus.getBoundingClientRect();
  cadre.hidden = false;
  Object.assign(cadre.style, { left: `${q.left - 3}px`, top: `${q.top - 3}px`, width: `${q.width + 6}px`, height: `${q.height + 6}px` });
}
function cacherCurseur() { modeCurseur = false; if (curseur) curseur.hidden = true; }
function cacherFocus() { if (cadre) cadre.hidden = true; if (survol) survoler(null); focus = null; focusZone = null; }
