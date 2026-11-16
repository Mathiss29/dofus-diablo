// Écran du bas (« Écran du bas : » 2A+2B) : les fenêtres du jeu s'ouvrent en bas, sans couvrir la partie en haut.
// Le jeu garde sa fenêtre (cachée) et en envoie une copie à chaque changement ; un toucher en bas est rejoué en haut
// sur le même élément (repéré par son chemin depuis la fenêtre). Une seule fenêtre à la fois, comme en haut.

export interface FenetreBas { html: string; tip: string; w: number; h: number; mode: string }
export interface EvtBas { chemin: number[]; type: 'click' | 'contextmenu' | 'dblclick' | 'survol' | 'valeur'; valeur?: string; tip?: boolean }

// ---------- Côté jeu ----------
export class MiroirJeu {
  private obs: MutationObserver | null = null;
  private el: HTMLElement | null = null;
  private tip: HTMLElement | null = null;
  private mode = '';
  private minuterie = 0;
  constructor(private envoyer: (f: FenetreBas | null) => void) {}

  get suivie() { return this.el; }

  /** Fenêtre à copier en bas (null : plus rien). */
  suivre(el: HTMLElement | null, mode = '') {
    if (el === this.el) return;
    this.obs?.disconnect(); this.obs = null; clearTimeout(this.minuterie); this.minuterie = 0;
    this.el?.parentElement?.classList.remove('dw-bas');
    this.el = el; this.mode = mode;
    if (!el) { this.envoyer(null); return; }
    const racine = el.parentElement ?? el;
    racine.classList.add('dw-bas');
    this.tip = racine.querySelector<HTMLElement>(':scope > .tip');
    this.obs = new MutationObserver(() => this.planifier());
    this.obs.observe(racine, { subtree: true, childList: true, attributes: true, characterData: true });
    this.planifier();
  }
  /** Plus de copie : la fenêtre redevient visible en haut. */
  lacher() { this.suivre(null); }

  private planifier() { if (!this.minuterie) this.minuterie = window.setTimeout(() => { this.minuterie = 0; this.copier(); }, 100); }

  private copier() {
    const el = this.el;
    if (!el || !el.isConnected) { this.suivre(null); return; }
    const c = el.cloneNode(true) as HTMLElement;
    // canevas (portrait du perso…) : remplacés par leur image ; champs : leur valeur du moment
    const src = el.querySelectorAll('canvas'), dst = c.querySelectorAll('canvas');
    src.forEach((cv, i) => {
      const im = document.createElement('img');
      try { if (cv.width * cv.height <= 1_000_000) im.src = cv.toDataURL(); } catch { /* canevas d'une autre origine */ }
      im.className = cv.className; im.style.cssText = cv.style.cssText;
      im.style.width ||= `${cv.clientWidth || cv.width}px`; im.style.height ||= `${cv.clientHeight || cv.height}px`;
      dst[i]?.replaceWith(im);
    });
    const ch = el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'), cc = c.querySelectorAll('input,select,textarea');
    ch.forEach((f, i) => {
      const d = cc[i]; if (!d) return;
      if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')) { if (f.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); }
      else if (f instanceof HTMLSelectElement) d.querySelectorAll('option').forEach((o, j) => { if (j === f.selectedIndex) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
      else if (f instanceof HTMLTextAreaElement) d.textContent = f.value;
      else d.setAttribute('value', f.value);
    });
    const tip = this.tip && this.tip.style.display !== 'none' ? this.tip.outerHTML : '';
    this.envoyer({ html: c.outerHTML, tip, w: el.offsetWidth, h: el.offsetHeight, mode: this.mode });
  }

  /** Rejoue en haut un toucher fait en bas. */
  rejouer(e: EvtBas) {
    let cible: Element | null = this.el;
    for (const i of e.chemin) { cible = cible?.children[i] ?? null; if (!cible) return; }
    if (!(cible instanceof HTMLElement)) return;
    const souris = (type: string, bulle = true) => cible!.dispatchEvent(new MouseEvent(type, { bubbles: bulle, cancelable: true, view: window, clientX: 40, clientY: 40 }));
    if (e.type === 'survol') { souris('mouseover'); souris('mouseenter', false); return; }
    if (e.type === 'valeur') {
      const f = cible as HTMLInputElement;
      if (f.type === 'checkbox' || f.type === 'radio') f.checked = e.valeur === '1'; else f.value = e.valeur ?? '';
      f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (e.type === 'click') { souris('pointerdown'); souris('mousedown'); souris('pointerup'); souris('mouseup'); }
    souris(e.type);
    // le toucher en bas ne laisse pas d'infobulle ouverte en haut
    if (e.type !== 'click' || !e.tip) cible.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  }
}

/** CSS de la page du jeu (fenêtres, icônes…) pour que la copie s'affiche pareil en bas. */
export function stylesDuJeu(): string {
  return Array.from(document.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
}

/** Cache la fenêtre copiée en haut (elle reste là pour recevoir les touchers). */
export const CSS_JEU = '.dw.dw-bas>.win,.dw.dw-bas>.tip{opacity:0!important;pointer-events:none!important}';

// ---------- Côté écran du bas ----------
const chemin = (de: Element, racine: Element): number[] | null => {
  const l: number[] = [];
  for (let e: Element | null = de; e && e !== racine; e = e.parentElement) {
    const p: Element | null = e.parentElement;
    if (!p) return null;
    l.unshift(Array.prototype.indexOf.call(p.children, e));
  }
  return l;
};

export class MiroirBas {
  private hote: HTMLDivElement;
  private dernier: FenetreBas | null = null;
  private appui = 0;
  private long = false;
  constructor(private conteneur: HTMLElement, private envoyer: (e: EvtBas) => void) {
    this.hote = document.createElement('div'); this.hote.className = 'dw cmp-dw'; conteneur.appendChild(this.hote);
    const win = () => this.hote.querySelector<HTMLElement>(':scope > .win');
    const viser = (ev: Event) => { const w = win(), t = ev.target as Element; return w && t && w.contains(t) ? chemin(t, w) : null; };
    // appui long = survol (infobulle d'un objet, d'un sort) ; appui court = clic
    this.hote.addEventListener('pointerdown', ev => {
      this.long = false; clearTimeout(this.appui);
      const c = viser(ev); if (!c) return;
      this.appui = window.setTimeout(() => { this.long = true; this.envoyer({ chemin: c, type: 'survol' }); }, 450);
    });
    const fin = () => clearTimeout(this.appui);
    this.hote.addEventListener('pointerup', fin); this.hote.addEventListener('pointercancel', fin); this.hote.addEventListener('pointermove', ev => { if (ev.pressure === 0) fin(); });
    this.hote.addEventListener('click', ev => {
      const c = viser(ev); if (!c) return;
      const champ = (ev.target as Element).closest('input,select,textarea,label');
      if (!champ) ev.preventDefault();
      if (this.long) { this.long = false; return; }
      if (!champ) this.envoyer({ chemin: c, type: 'click' });
    }, true);
    this.hote.addEventListener('contextmenu', ev => { ev.preventDefault(); const c = viser(ev); if (c) this.envoyer({ chemin: c, type: 'contextmenu' }); }, true);
    this.hote.addEventListener('dblclick', ev => { ev.preventDefault(); const c = viser(ev); if (c) this.envoyer({ chemin: c, type: 'dblclick' }); }, true);
    this.hote.addEventListener('change', ev => {
      const f = ev.target as HTMLInputElement, c = viser(ev); if (!c) return;
      this.envoyer({ chemin: c, type: 'valeur', valeur: f.type === 'checkbox' || f.type === 'radio' ? (f.checked ? '1' : '0') : f.value });
    }, true);
    new ResizeObserver(() => this.ajuster()).observe(conteneur);
  }
  get ouverte() { return !!this.dernier; }
  get mode() { return this.dernier?.mode ?? ''; }

  montrer(f: FenetreBas | null) {
    this.dernier = f;
    if (!f) { this.hote.innerHTML = ''; return; }
    // garder le défilement des listes d'une copie à l'autre
    const avant = new Map<string, number>();
    const w0 = this.hote.querySelector(':scope > .win');
    if (w0) w0.querySelectorAll('*').forEach(e => { if (e.scrollTop) { const c = chemin(e, w0); if (c) avant.set(c.join('.'), e.scrollTop); } });
    this.hote.innerHTML = f.html + f.tip;
    const w1 = this.hote.querySelector(':scope > .win');
    if (w1) for (const [k, top] of avant) { let e: Element | null = w1; for (const i of k.split('.')) e = e?.children[+i] ?? null; if (e) e.scrollTop = top; }
    this.ajuster();
  }
  private ajuster() {
    const f = this.dernier, w = this.hote.querySelector<HTMLElement>(':scope > .win');
    const L = this.conteneur.clientWidth;
    if (!f || !w || L < 20) return;
    // la fenêtre garde sa taille du haut (ses largeurs en --vw/--vh n'ont pas de sens ici), puis rétrécit à la largeur du bas
    w.style.setProperty('width', `${f.w}px`, 'important'); w.style.setProperty('height', `${f.h}px`, 'important');
    const k = Math.min(1, (L - 4) / Math.max(1, f.w));
    this.hote.style.setProperty('--k', k.toFixed(3));
    this.hote.style.width = `${Math.ceil(f.w * k)}px`; this.hote.style.height = `${Math.ceil(f.h * k)}px`;
  }
}

/** CSS de la copie en bas : la fenêtre posée en haut à gauche, à l'échelle de l'écran du bas. */
export const CSS_BAS = `
.cmp-dw{position:relative!important;inset:auto!important;pointer-events:auto!important;z-index:auto!important;margin:0 auto}
.cmp-dw>.win{position:absolute!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;margin:0!important;transform:scale(var(--k,1))!important;transform-origin:0 0!important;max-height:none!important}
.cmp-dw>.tip{position:fixed!important;left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;max-width:none!important;z-index:5;pointer-events:none}
.cmp-dw [data-close]{display:none!important}`;
