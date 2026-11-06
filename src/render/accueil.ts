import { v } from './assetUrl';
import { GAME_DATA } from '../sim/data';
import { SORTS, niveauRequis, type SortOfficiel } from '../sim/sorts';
import CLASSES_DOFUS from '../data/classes_dofus.json';
import { EMPLACEMENTS, dernier, dureeTexte, lirePersos, nomValide, sauverPerso, supprimerPerso, type Perso } from './persos';

/** Écrans hors du jeu (maquette unique, choix 17A à 23A, 19B, 22D, 30E) : accueil avec Incarnam en direct derrière,
 *  création du perso devant le dieu de sa classe, et « Mes personnages ». Du HTML posé sur le jeu : la partie (ZoneScene)
 *  tourne derrière en mode vitrine. Les textes des classes sont ceux de Dofus 3 (src/data/classes_dofus.json). */

interface ClasseDofus { id: number; cle: string; nom: string; titre: string; desc: string; complexite: number; roles: Record<string, number> }
const CLASSES = CLASSES_DOFUS as ClasseDofus[];
/** Classes jouables (planches en jeu) et date prévue des suivantes. */
const JOUABLES = new Set(Object.keys(GAME_DATA.classes));
const PLUS_TARD: Record<string, string> = { osamodas: 'Après la 0.1b' };
/** Illustration du dieu de la classe (class_/LevelUp{N} de Dofus 3) ; les autres classes ont le décor du titre. */
const DIEUX = new Set(['iop', 'cra', 'osamodas']);
/** Animations du perso sur le socle : nombre d'images de chaque bande (rendues comme le jeu, voir LISEZMOI ;
 *  l'attaque est plus large : le perso s'élance vers la droite). */
const POSES: [string, string, number][] = [['repos', 'Repos', 24], ['garde', 'Garde', 24], ['attaque', 'Attaque', 23]];
const FILTRES = ['Toutes', 'Dégâts', 'Tank', 'Soins', 'Invocation'];

const A = 'assets/accueil';
const img = (f: string) => v(`${A}/${f}`);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Planche d'un gros perso : une bande (anciennes planches) ou une grille (planches fines, voir tools/extraction/accueil_grille.py).
 *  Le nombre de colonnes se déduit de la taille de l'image et du format de la case (celui de l'élément). */
const grilles = new Map<string, { cols: number; rows: number; fh: number } | null>();
function grille(h: HTMLElement, n: number) {
  const src = h.dataset.src!, k = `${src}|${n}`;
  if (grilles.has(k)) return grilles.get(k)!;
  grilles.set(k, null);
  const im = new Image();
  im.onload = () => {
    if (!h.offsetWidth || !h.offsetHeight) { grilles.delete(k); return; }   // pas encore affiché : on réessaiera
    const ratio = h.offsetWidth / h.offsetHeight;
    let best = { cols: n, rows: 1, fh: im.naturalHeight }, err = Infinity;
    for (let rows = 1; rows <= n; rows++) {
      // colonnes prédites par la taille de l'image ; la dernière ligne peut être incomplète
      const p = im.naturalWidth * rows / (im.naturalHeight * ratio), cols = Math.max(1, Math.round(p));
      if (cols * rows < n || cols * (rows - 1) >= n) continue;
      const e = Math.abs(p - cols) / cols;
      if (e < err) { err = e; best = { cols, rows, fh: im.naturalHeight / rows }; }
    }
    grilles.set(k, best);
  };
  im.src = src;
  return null;
}
const tete = (c: ClasseDofus, sexe: 'm' | 'f') => img(`h_${c.id}${sexe === 'm' ? 0 : 1}.png`);
const classe = (cle: string) => CLASSES.find(c => c.cle === cle) ?? CLASSES[0];

// 1 unité = 1 % de la largeur d'un écran 16:9 qui tient dans la fenêtre (les maquettes étaient en cqw)
const CSS = `
#acc{position:fixed;inset:0;z-index:20;container-type:size;font-family:Nunito,system-ui,sans-serif;color:#f6f1dc;user-select:none;
  --u:min(1cqw,1.7778cqh);--lime:#b9e54b;--ink:#1d2a06;--disp:"Lilita One","Arial Rounded MT Bold",system-ui,sans-serif}
#acc *{box-sizing:border-box}
#acc[hidden]{display:none}
#acc .page{position:absolute;inset:0;overflow:hidden}
#acc .cover{position:absolute;inset:0;background-size:cover;background-position:center}
#acc .abs{position:absolute}
#acc .side{position:absolute;left:0;top:0;bottom:0;width:calc(6.6*var(--u));background:#17180f;border-right:1px solid #2c2f1f;display:flex;flex-direction:column;align-items:center;padding:calc(1.2*var(--u)) 0 calc(1*var(--u));gap:calc(.35*var(--u));z-index:5}
#acc .side .logo{width:calc(4.4*var(--u));height:auto;margin-bottom:calc(1*var(--u));filter:drop-shadow(0 calc(.3*var(--u)) calc(.6*var(--u)) #000a)}
#acc .nav{all:unset;cursor:pointer;width:100%;display:grid;justify-items:center;gap:calc(.2*var(--u));padding:calc(.55*var(--u)) 0;font-size:calc(.72*var(--u));font-weight:800;color:#d9d4bd;border-left:calc(.2*var(--u)) solid transparent;box-sizing:border-box}
#acc .nav img{height:calc(2.3*var(--u));width:calc(2.7*var(--u));object-fit:contain;filter:drop-shadow(0 1px 1px #000);transition:transform .15s,filter .15s}
#acc .nav.on img{transform:scale(1.15);filter:drop-shadow(0 0 calc(.4*var(--u)) #b9e54b88) drop-shadow(0 1px 1px #000)}
#acc .nav:hover{background:#1f2116}
#acc .nav.on{background:#23261a;border-left-color:var(--lime);color:#fff}
#acc .side .play{all:unset;cursor:pointer;margin-top:auto;font-family:var(--disp);font-size:calc(1.25*var(--u));color:var(--ink);background:linear-gradient(#cff26a,#9ccd2c);padding:calc(.5*var(--u)) calc(1.1*var(--u));clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);box-shadow:0 calc(.2*var(--u)) 0 #5d7d14}
#acc .side .ver{font-size:calc(.6*var(--u));color:#7d7a66;letter-spacing:.1em;margin-top:calc(.6*var(--u))}
#acc .lbtn{all:unset;cursor:pointer;font-family:var(--disp);font-size:calc(1.25*var(--u));color:var(--ink);background:linear-gradient(#d3f46f,#a2d332);border-radius:calc(.5*var(--u));padding:calc(.85*var(--u)) calc(1.8*var(--u));box-shadow:0 calc(.25*var(--u)) 0 #5d7d14,0 calc(.5*var(--u)) calc(1.2*var(--u)) #0007;white-space:nowrap;text-align:center}
#acc .lbtn:hover{filter:brightness(1.08)}
#acc .lbtn[aria-disabled=true]{filter:grayscale(1) brightness(.7);cursor:default}
#acc .dbtn{all:unset;cursor:pointer;font-weight:800;font-size:calc(1.05*var(--u));color:#f1ecd8;background:#2a2a20e6;border:1px solid #4c4b3a;border-radius:calc(.5*var(--u));padding:calc(.8*var(--u)) calc(1.5*var(--u));box-shadow:0 calc(.25*var(--u)) 0 #0a0a07;white-space:nowrap;text-align:center}
#acc .dbtn:hover{border-color:#8a8a66}
#acc .dbtn.rouge{color:#ffb39a;border-color:#7a3a2a}
#acc .tiny{font-size:calc(.75*var(--u));color:#c9c4ab}
#acc .ttl{font-family:var(--disp);color:var(--lime);-webkit-text-stroke:calc(.12*var(--u)) #1f2a08;paint-order:stroke fill;text-shadow:0 calc(.3*var(--u)) 0 #1f2a08,0 calc(.6*var(--u)) calc(1.4*var(--u)) #0009;line-height:.95}
#acc .logoI{width:calc(25*var(--u));height:auto;filter:drop-shadow(0 calc(.5*var(--u)) calc(1.2*var(--u)) #000b)}
#acc .ribbon{font-family:var(--disp);font-size:calc(4.4*var(--u));color:#e6fa9c;-webkit-text-stroke:calc(.18*var(--u)) #1f2a08;paint-order:stroke fill;text-shadow:0 calc(.3*var(--u)) 0 #1f2a08;padding:calc(.6*var(--u)) calc(3*var(--u)) calc(.9*var(--u)) calc(2.2*var(--u));background:linear-gradient(90deg,#3c5a12,#56801a 70%,#3c5a1200);clip-path:polygon(0 15%,100% 0,96% 100%,3% 88%);white-space:nowrap}
#acc .card{background:#1d1e15ee;border:1px solid #45452f;border-radius:calc(.6*var(--u));box-shadow:0 calc(.3*var(--u)) calc(1*var(--u)) #0008}
#acc .chip{all:unset;cursor:pointer;font-weight:800;font-size:calc(.8*var(--u));border:1px solid #f1ecd8aa;border-radius:calc(2*var(--u));padding:calc(.4*var(--u)) calc(1.1*var(--u));background:#1b1c13cc;white-space:nowrap}
#acc .chip.on{background:linear-gradient(#cff26a,#9ccd2c);color:var(--ink);border-color:#e9ffb0}
#acc .chip.off{opacity:.6;cursor:default}
#acc .panelT{font-family:var(--disp);font-size:calc(1.25*var(--u));text-align:center;padding:calc(.6*var(--u));border-bottom:1px solid #45452f;color:#fbf3d4}
#acc .tab{all:unset;cursor:pointer;flex:1;display:flex;align-items:center;gap:calc(.5*var(--u));justify-content:center;font-weight:800;font-size:calc(.9*var(--u));padding:calc(.45*var(--u));border-radius:calc(.4*var(--u));background:#2a2b1f;border:1px solid #45452f}
#acc .tab img{height:calc(1.8*var(--u))}
#acc .tab.on{background:linear-gradient(#cff26a,#9ccd2c);color:var(--ink);border-color:#e9ffb0}
#acc input.field{all:unset;display:block;width:100%;box-sizing:border-box;background:#0f100b;border:1px solid #45452f;border-radius:calc(.4*var(--u));padding:calc(.55*var(--u)) calc(.7*var(--u));font-size:calc(.95*var(--u));color:#f6f1dc;user-select:text}
#acc input.field:focus{border-color:var(--lime)}
#acc .lab{font-size:calc(.75*var(--u));font-weight:800;color:#c9c4ab;margin:calc(.7*var(--u)) 0 calc(.3*var(--u))}
#acc .strip{position:absolute;left:calc(7.6*var(--u));right:calc(1*var(--u));bottom:calc(.7*var(--u));display:flex;gap:calc(.25*var(--u));justify-content:space-between;z-index:4}
#acc .cls{all:unset;cursor:pointer;display:grid;justify-items:center;gap:calc(.1*var(--u));font-size:calc(.6*var(--u));font-weight:800;color:#d9d4bd;width:calc(4.3*var(--u));padding:calc(.2*var(--u)) 0 calc(.3*var(--u));border-radius:calc(.4*var(--u));position:relative}
#acc .cls img{height:calc(3.2*var(--u));filter:grayscale(.85) brightness(.75)}
#acc .cls.play img{filter:none}
#acc .cls.on{background:#2a2c1f;box-shadow:inset 0 calc(-.25*var(--u)) 0 var(--lime)}
#acc .cls.on img{filter:none}
#acc .cls.dim{opacity:.3}
#acc .cls .soon{position:absolute;top:0;right:calc(.1*var(--u));font-size:calc(.5*var(--u));background:#0f100bdd;padding:0 calc(.25*var(--u));border-radius:calc(.3*var(--u));color:#e0925a}
#acc .bar{height:calc(.55*var(--u));border-radius:9px;background:#33342a;overflow:hidden}
#acc .bar i{display:block;height:100%;background:linear-gradient(90deg,#9ccd2c,#d3f46f)}
#acc .dots{letter-spacing:calc(.15*var(--u));color:var(--lime)}
#acc .dots i{font-style:normal;color:#55553f}
#acc .sp{display:flex;align-items:center;gap:calc(.5*var(--u));font-size:calc(.8*var(--u));font-weight:700;line-height:1.1}
#acc .sp img{width:calc(1.9*var(--u));height:calc(1.9*var(--u));border-radius:calc(.3*var(--u));border:1px solid #5d5c45}
#acc .sp small{display:block;color:#a8a58e;font-size:calc(.62*var(--u))}
#acc .hero{background-repeat:no-repeat}
#acc .slot{all:unset;cursor:pointer;display:grid;grid-template-columns:calc(4.6*var(--u)) 1fr;align-items:center;gap:calc(.8*var(--u));width:100%;box-sizing:border-box;padding:calc(.7*var(--u)) calc(.9*var(--u));border-radius:calc(.6*var(--u));background:#1b1c13e6;border:1px solid #45452f}
#acc .slot img{width:100%}
#acc .slot b{font-family:var(--disp);font-weight:400;font-size:calc(1.5*var(--u));color:#fbf3d4;display:block;line-height:1.05}
#acc .slot.on{border-color:var(--lime);box-shadow:0 0 0 calc(.12*var(--u)) var(--lime),0 calc(.4*var(--u)) calc(1.4*var(--u)) #b9e54b33}
#acc .slot.vide{border-style:dashed;color:#a8a58e}
#acc .hc{color:#e0925a;font-weight:800}
#acc .toast{position:absolute;left:50%;bottom:calc(6*var(--u));transform:translateX(-50%);background:#14130fee;border:1px solid #5d5c45;padding:calc(.6*var(--u)) calc(1.4*var(--u));border-radius:calc(.5*var(--u));font-weight:800;font-size:calc(.95*var(--u));z-index:9;pointer-events:none;transition:opacity .3s}
#acc .err{color:#ff9a7a;font-size:calc(.7*var(--u));margin-top:calc(.3*var(--u));min-height:1em}
#acc .check{display:flex;align-items:center;gap:calc(.5*var(--u));margin-top:calc(.8*var(--u));font-weight:800;font-size:calc(.8*var(--u));cursor:pointer}
#acc .check input{accent-color:#e0925a;width:calc(1.1*var(--u));height:calc(1.1*var(--u));margin:0}
`;

type Page = 'accueil' | 'creation' | 'persos';

export class Accueil {
  private root: HTMLDivElement;
  private page: Page = 'accueil';
  /** Création : classe, sexe, pose, nom, Hardcore, filtre de la barre des classes. */
  private crea = { cle: 'iop', sexe: 'm' as 'm' | 'f', pose: 'repos', nom: '', hardcore: false, filtre: 'Toutes', err: '' };
  /** « Mes personnages » : emplacement choisi, et suppression en attente de confirmation. */
  private choix = 0;
  private confirmer = -1;
  private anim = 0;
  private toastT = 0;

  /** onJouer : lance la partie de cet emplacement (déjà sauvegardé). */
  constructor(private onJouer: (slot: number) => void) {
    if (!document.getElementById('acc-css')) {
      const st = document.createElement('style'); st.id = 'acc-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = document.createElement('div'); this.root.id = 'acc'; this.root.hidden = true;
    // les clics sur ces écrans ne vont pas au jeu derrière
    for (const ev of ['pointerdown', 'wheel', 'contextmenu'] as const) this.root.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'contextmenu') e.preventDefault(); });
    document.body.appendChild(this.root);
    let last = 0, f = 0;
    const tick = (t: number) => {
      this.anim = requestAnimationFrame(tick);
      if (t - last < 40) return;   // 25 images par seconde, comme les animations de Dofus
      last = t; f++;
      this.root.querySelectorAll<HTMLElement>('.hero').forEach(h => {
        const n = +h.dataset.n!, g = grille(h, n);
        if (!g) return;
        const i = f % n, c = i % g.cols, l = Math.floor(i / g.cols);
        h.style.backgroundSize = `${g.cols * 100}% ${g.rows * 100}%`;
        // jamais agrandi au-delà de la taille de l'image (sinon flou) : le perso rapetisse, les pieds restent sur le socle
        h.style.transformOrigin = '50% 100%'; h.style.transform = `scale(${Math.min(1, g.fh / (Math.max(1, h.offsetHeight) * (devicePixelRatio || 1)))})`;   // en pixels de l'écran (Windows à 125 %, 150 %…)
        h.style.backgroundPosition = `${g.cols > 1 ? (c / (g.cols - 1)) * 100 : 0}% ${g.rows > 1 ? (l / (g.rows - 1)) * 100 : 0}%`;
      });
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.anim = requestAnimationFrame(tick);
  }

  get visible() { return !this.root.hidden; }
  show(page: Page = 'accueil') { this.root.hidden = false; this.go(page); }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; }
  destroy() { cancelAnimationFrame(this.anim); this.root.remove(); }

  private go(page: Page) {
    this.page = page; this.confirmer = -1; this.crea.err = '';
    if (page === 'persos') { const d = dernier(); this.choix = d ?? Math.max(0, lirePersos().findIndex(p => p)); }
    this.render();
  }

  private render() {
    const html = this.page === 'accueil' ? this.pageAccueil() : this.page === 'creation' ? this.pageCreation() : this.pagePersos();
    this.root.innerHTML = `<div class="page">${html}${this.side()}<div class="toast" style="opacity:0"></div></div>`;
    this.bind();
  }

  private toast(msg: string) {
    const t = this.root.querySelector<HTMLElement>('.toast'); if (!t) return;
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(this.toastT); this.toastT = window.setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  /** Colonne fine (30E) : icônes en couleur du menu principal de Dofus 3 (uiassets_2x) + texte. Bestiaire, Succès et Journal arrivent plus tard. */
  private side(): string {
    const NAV: [string, string, string][] = [['accueil', 'assets/ui/menu/home.png', 'Accueil'], ['persos', 'assets/ui/menu/character.png', 'Personnages'],
      ['creation', img('h_80.png'), 'Classes'], ['bestiaire', 'assets/ui/menu/bestiary.png', 'Bestiaire'], ['succes', 'assets/ui/menu/success.png', 'Succès'], ['journal', 'assets/ui/menu/calendar.png', 'Journal']];
    return `<nav class="side"><img class="logo" src="${v('assets/logo/embleme.webp')}" alt="" aria-hidden="true">${NAV.map(([k, ic, l]) =>
      `<button type="button" class="nav${k === this.page ? ' on' : ''}" data-nav="${k}"><img src="${ic}" alt="">${l}</button>`).join('')}
      <button type="button" class="play" data-jouer>Jouer</button><div class="ver">VERSION 0.1</div></nav>`;
  }

  // --- Accueil (17A) : Incarnam en direct derrière, titre, Continuer / Nouvelle partie --------------------------
  private pageAccueil(): string {
    const l = lirePersos(), d = dernier(), p = d != null ? l[d] : null, n = l.filter(Boolean).length;
    const c = p && classe(p.classe);
    return `<div class="cover" style="background:linear-gradient(90deg,#0d0e09f0 6%,#0d0e09b0 30%,#0d0e0918 55%,transparent 70%)"></div>
    <div class="abs tiny" style="left:calc(11*var(--u));top:calc(2.2*var(--u));letter-spacing:.15em;font-weight:800">INCARNAM, EN TEMPS RÉEL</div>
    <img class="abs logoI" style="left:calc(10.4*var(--u));top:calc(3.6*var(--u))" src="${v('assets/logo/logo.webp')}" alt="Diablofus : Les Douze Enfers">
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(15.2*var(--u));font-weight:800;font-size:calc(1.7*var(--u))">Le monde des Douze, en action.</div>
    <div class="abs ribbon" style="left:calc(9.8*var(--u));top:calc(18.2*var(--u))">En chasse !</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(26.8*var(--u));font-weight:700;font-size:calc(1.05*var(--u));line-height:1.75;max-width:calc(34*var(--u))">
      Traverse Incarnam sans temps de chargement.<br>Enchaîne les groupes de monstres avec les sorts officiels de ta classe.<br>Ramasse des objets que tu connais, avec des jets au hasard.</div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(34.5*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      ${p ? `<button type="button" class="lbtn" data-continuer>Continuer · ${esc(p.nom)}, ${c!.nom} niv. ${p.etat?.level ?? 1}</button>
        <button type="button" class="dbtn" data-go="creation">Nouvelle partie</button>`
        : `<button type="button" class="lbtn" data-go="creation">Nouvelle partie</button>`}
    </div>
    <div class="abs" style="left:calc(11.5*var(--u));top:calc(39.6*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
      <button type="button" class="dbtn" style="font-size:calc(.85*var(--u));padding:calc(.5*var(--u)) calc(1*var(--u))" data-go="persos">Mes personnages${n ? ` (${n})` : ''}</button>
      <span class="tiny">${EMPLACEMENTS} emplacements · sauvegarde automatique</span></div>
    ${p ? `<div class="abs card" style="right:calc(2*var(--u));bottom:calc(5.4*var(--u));padding:calc(.8*var(--u)) calc(1.1*var(--u));font-weight:700;font-size:calc(.9*var(--u));transform:rotate(-1deg);background:#f4ecd0;color:#2a2615;border-color:#c9b98a">
      Dernière sortie : ${esc(p.lieu)} · ${dureeTexte(p.temps)} de jeu</div>` : ''}
    <div class="abs" style="right:calc(2*var(--u));bottom:calc(1.6*var(--u));display:flex;gap:calc(.6*var(--u))">
      <span class="chip on">Incarnam</span><span class="chip off">Crypte de Kardorim</span><span class="chip off">Astrub · bientôt</span></div>`;
  }

  // --- Création (18A-21A, 19B en partie, Hardcore 10D) ----------------------------------------------------------
  private pageCreation(): string {
    const s = this.crea, c = classe(s.cle), jouable = JOUABLES.has(c.cle);
    const pose = POSES.find(p => p[0] === s.pose)!;
    const roles = Object.entries(c.roles).slice(0, 3);
    const libre = lirePersos().findIndex(p => !p);
    const bouton = !jouable ? (PLUS_TARD[c.cle] ?? 'Pas encore jouable') : libre < 0 ? 'Emplacements pleins' : 'Créer et jouer';
    return `<div class="cover" style="background-image:url(${img(DIEUX.has(c.cle) ? `dieu_${c.cle}.jpg` : 'login.jpg')})"></div>
    <div class="cover" style="background:radial-gradient(ellipse 60% 70% at 52% 55%,transparent 30%,#0d0e09d0 80%),linear-gradient(90deg,#0d0e09f0 8%,#0d0e0980 32%,transparent 50%,#0d0e0980 72%,#0d0e09f0 92%)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Créer un personnage</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(4.2*var(--u));width:calc(23*var(--u))">
      <div style="display:flex;align-items:center;gap:calc(.6*var(--u));font-weight:800;font-size:calc(1.15*var(--u))"><img src="${img(`c_${c.cle}.png`)}" alt="" style="height:calc(1.9*var(--u))">${esc(c.titre)}</div>
      <div class="ttl" style="font-size:calc(5.2*var(--u));margin:calc(.3*var(--u)) 0 calc(.7*var(--u))">${esc(c.nom)}</div>
      <div class="card" style="padding:0 0 calc(.9*var(--u))">
        <div class="panelT">${roles.map(r => r[0]).join(' · ')}</div>
        <div style="padding:calc(.8*var(--u)) calc(1.1*var(--u)) 0;display:grid;gap:calc(.45*var(--u));font-size:calc(.85*var(--u));font-weight:700">
          <div style="font-weight:600;font-size:calc(.75*var(--u));color:#d9d4bd;line-height:1.4">${esc(c.desc)}</div>
          ${roles.map(([n, val]) => `<div style="display:grid;grid-template-columns:calc(6*var(--u)) 1fr;align-items:center;gap:calc(.6*var(--u))"><span>${n}</span><div class="bar"><i style="width:${Math.min(100, val / 12 * 100)}%"></i></div></div>`).join('')}
          <div style="display:flex;justify-content:space-between"><span>Difficulté</span><span class="dots">${'●'.repeat(c.complexite)}<i>${'●'.repeat(5 - c.complexite)}</i></span></div>
          ${jouable ? `<div class="lab" style="margin-bottom:0">Premiers sorts</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:calc(.5*var(--u))">${this.premiersSorts(c.cle).map(([sp, n]) =>
            `<div class="sp"><img src="assets/ui/sorts/sort_${sp.icon}.png" alt=""><span>${esc(sp.name)}<small>niveau ${n}</small></span></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>
    <img src="${img('lumiere.png')}" alt="" class="abs" style="left:calc(50% - 7.5*var(--u));top:calc(6*var(--u));width:calc(15*var(--u));opacity:.7;mix-blend-mode:screen">
    <img src="assets/ui/socle.png" alt="" class="abs" style="left:calc(50% - 10.5*var(--u));top:calc(29.5*var(--u));width:calc(21*var(--u));filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 calc(1.2*var(--u)) #8fe8ff99)">
    ${jouable ? `<div class="abs hero" data-n="${pose[2]}" role="img" aria-label="${esc(c.nom)}" style="left:calc(50% - 8.85*var(--u));top:calc(13.4*var(--u));width:calc(${s.pose === 'attaque' ? 28.1 : 17.7}*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)});background-size:${pose[2] * 100}% 100%" data-src="${img(`${c.cle}_${s.sexe}_${s.pose}.webp`)}"></div>`
      : `<img src="${tete(c, s.sexe)}" alt="" class="abs" style="left:calc(50% - 6*var(--u));top:calc(15*var(--u));width:calc(12*var(--u));filter:drop-shadow(0 calc(.5*var(--u)) calc(1*var(--u)) #000)">
      <div class="abs" style="left:50%;top:calc(27*var(--u));transform:translateX(-50%);font-family:var(--disp);font-size:calc(1.5*var(--u));color:#e0925a;-webkit-text-stroke:calc(.1*var(--u)) #2a1407;paint-order:stroke fill;white-space:nowrap">${PLUS_TARD[c.cle] ?? 'Jouable plus tard'}</div>`}
    <div class="abs card" style="right:calc(2*var(--u));top:calc(4.2*var(--u));width:calc(17.5*var(--u));padding:0 0 calc(1*var(--u));${jouable ? '' : 'opacity:.55'}">
      <div class="panelT">Ton personnage</div>
      <div style="padding:calc(.8*var(--u)) calc(1*var(--u)) 0">
        <div style="display:flex;gap:calc(.5*var(--u))">
          <button class="tab${s.sexe === 'm' ? ' on' : ''}" type="button" data-sexe="m"><img src="${tete(c, 'm')}" alt="">Homme</button>
          <button class="tab${s.sexe === 'f' ? ' on' : ''}" type="button" data-sexe="f"><img src="${tete(c, 'f')}" alt="">Femme</button>
        </div>
        <div class="lab">Pose</div>
        <div style="display:grid;gap:calc(.4*var(--u))">${POSES.map(([k, n]) =>
          `<button class="tab${s.pose === k ? ' on' : ''}" type="button" data-pose="${k}" style="justify-content:flex-start;padding-left:calc(1*var(--u))">${n}</button>`).join('')}</div>
        <div class="lab">Nom du personnage</div>
        <input class="field" data-nom maxlength="16" spellcheck="false" autocomplete="off" value="${esc(s.nom)}" placeholder="3 à 16 lettres" ${jouable ? '' : 'disabled'}>
        <div class="err">${esc(s.err)}</div>
        <label class="check"><input type="checkbox" data-hc ${s.hardcore ? 'checked' : ''} ${jouable ? '' : 'disabled'}><span>Mode Hardcore <span class="hc">(mort définitive)</span></span></label>
        <button type="button" class="lbtn" data-creer style="display:block;width:100%;box-sizing:border-box;margin-top:calc(1*var(--u));font-size:calc(1.15*var(--u));padding:calc(.7*var(--u))" ${jouable && libre >= 0 ? '' : 'aria-disabled="true"'}>${bouton}</button>
        ${jouable && libre < 0 ? `<div class="tiny" style="margin-top:calc(.4*var(--u))">Supprime un personnage dans « Mes personnages ».</div>` : ''}
      </div>
    </div>
    <div class="abs" style="left:calc(8.4*var(--u));bottom:calc(6.4*var(--u));display:flex;gap:calc(.5*var(--u))">${FILTRES.map(f =>
      `<button type="button" class="chip${s.filtre === f ? ' on' : ''}" data-filtre="${f}" style="font-size:calc(.7*var(--u));padding:calc(.3*var(--u)) calc(.9*var(--u))">${f}</button>`).join('')}</div>
    <div class="strip">${CLASSES.map(k => {
      const dim = s.filtre !== 'Toutes' && (k.roles[s.filtre] ?? 0) < 7;
      return `<button type="button" class="cls${k.cle === s.cle ? ' on' : ''}${JOUABLES.has(k.cle) ? ' play' : ''}${dim ? ' dim' : ''}" data-cls="${k.cle}"><img src="${tete(k, s.sexe)}" alt="">${esc(k.nom)}${JOUABLES.has(k.cle) ? '' : '<span class="soon">bientôt</span>'}</button>`;
    }).join('')}</div>`;
  }
  /** Les 4 premiers sorts officiels de la classe (Dofus 3), avec le niveau où on les obtient. */
  private premiersSorts(cle: string): [SortOfficiel, number][] {
    const cls = GAME_DATA.classes[cle], mob = cls.spells[cls.mobility]?.dofusId;
    return (SORTS[cls.sorts] ?? []).map(p => [p[0], niveauRequis(p[0], mob)] as [SortOfficiel, number]).sort((a, b) => a[1] - b[1]).slice(0, 4);
  }

  // --- Mes personnages (22D) : la liste à gauche, le perso choisi sur le socle devant son dieu -------------------
  private pagePersos(): string {
    const l = lirePersos(), p = l[this.choix], c = p && classe(p.classe);
    const fond = c && DIEUX.has(c.cle) ? `dieu_${c.cle}.jpg` : 'login.jpg';
    return `<div class="cover" style="background-image:url(${img(fond)});filter:saturate(.9) brightness(.8)"></div>
    <div class="cover" style="background:radial-gradient(ellipse 50% 65% at 55% 55%,transparent 30%,#0d0e09d8 80%),linear-gradient(90deg,#0d0e09f5 8%,#0d0e09a0 30%,transparent 50%)"></div>
    <div class="abs tiny" style="left:calc(8.4*var(--u));top:calc(1.4*var(--u));font-weight:800">Mes personnages</div>
    <button type="button" class="abs dbtn" style="right:calc(2*var(--u));top:calc(1*var(--u));font-size:calc(.8*var(--u));padding:calc(.35*var(--u)) calc(.9*var(--u))" data-go="accueil">Retour</button>
    <div class="abs" style="left:calc(8.4*var(--u));top:calc(4.5*var(--u));width:calc(19*var(--u));display:grid;gap:calc(.7*var(--u))">
      ${l.map((q, i) => {
        if (!q) return `<button type="button" class="slot vide" data-slot="${i}"><span style="width:calc(4.6*var(--u));height:calc(4.6*var(--u));border-radius:50%;border:2px dashed #6d6c54;display:grid;place-items:center;font-family:var(--disp);font-size:calc(2.4*var(--u))">+</span>
          <span><b style="color:#c9c4ab">Nouveau personnage</b><span class="tiny">Emplacement libre</span></span></button>`;
        const k = classe(q.classe);
        return `<button type="button" class="slot${i === this.choix ? ' on' : ''}" data-slot="${i}"><img src="${tete(k, q.sexe)}" alt="">
          <span><b>${esc(q.nom)}</b><span style="font-weight:800;font-size:calc(.85*var(--u))">${k.nom} · niveau ${q.etat?.level ?? 1}${q.hardcore ? ' · <span class="hc">Hardcore</span>' : ''}</span>
          <span class="tiny" style="display:block">${esc(q.lieu)} · ${dureeTexte(q.temps)} de jeu</span></span></button>`;
      }).join('')}
      <div class="tiny" style="text-align:center">Sauvegarde automatique dans ton navigateur · aucun compte</div>
    </div>
    ${p && c ? `<div class="abs ttl" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(2.6*var(--u));font-size:calc(4.2*var(--u));white-space:nowrap">${esc(p.nom)}</div>
      <div class="abs" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(7.6*var(--u));font-weight:800;font-size:calc(1.15*var(--u));white-space:nowrap">${c.nom} · niveau ${p.etat?.level ?? 1}${p.hardcore ? ' · <span class="hc">Hardcore</span>' : ''}</div>
      <img src="${img('lumiere.png')}" alt="" class="abs" style="left:calc(50% - 3.5*var(--u));top:calc(8*var(--u));width:calc(15*var(--u));opacity:.7;mix-blend-mode:screen">
      <img src="assets/ui/socle.png" alt="" class="abs" style="left:calc(50% - 6.5*var(--u));top:calc(31.5*var(--u));width:calc(21*var(--u));filter:sepia(.55) saturate(1.3) brightness(.95) drop-shadow(0 0 calc(1.2*var(--u)) #8fe8ff99)">
      <div class="abs hero" data-n="24" role="img" aria-label="${esc(p.nom)}" style="left:calc(50% - 4.85*var(--u));top:calc(15.4*var(--u));width:calc(17.7*var(--u));height:calc(24*var(--u));background-image:url(${img(`${c.cle}_${p.sexe}_repos.webp`)});background-size:2400% 100%" data-src="${img(`${c.cle}_${p.sexe}_repos.webp`)}"></div>
      <div class="abs" style="left:calc(50% + 4*var(--u));transform:translateX(-50%);top:calc(47*var(--u));display:flex;gap:calc(1*var(--u));align-items:center">
        <button type="button" class="dbtn rouge" data-suppr="${this.choix}" style="font-size:calc(.9*var(--u))">${this.confirmer === this.choix ? 'Vraiment supprimer ?' : 'Supprimer'}</button>
        <button type="button" class="lbtn" data-jouer-slot="${this.choix}" style="font-size:calc(1.5*var(--u));padding:calc(.8*var(--u)) calc(3*var(--u))">Jouer</button>
      </div>`
      : `<div class="abs" style="left:calc(50% + 4*var(--u));top:50%;transform:translate(-50%,-50%);text-align:center;display:grid;gap:calc(1*var(--u));justify-items:center">
        <div class="ttl" style="font-size:calc(3*var(--u))">Aucun personnage</div>
        <button type="button" class="lbtn" data-go="creation">Créer un personnage</button></div>`}`;
  }

  private bind() {
    const r = this.root, on = (sel: string, f: (e: HTMLElement) => void) => r.querySelectorAll<HTMLElement>(sel).forEach(e => e.addEventListener('click', () => f(e)));
    on('[data-nav]', e => {
      const k = e.dataset.nav!;
      if (k === 'accueil' || k === 'persos' || k === 'creation') this.go(k);
      else this.toast(`${e.textContent!.trim()} : arrive dans une prochaine version`);
    });
    on('[data-go]', e => this.go(e.dataset.go as Page));
    on('[data-jouer]', () => { const d = dernier(); if (d != null) this.onJouer(d); else this.go('creation'); });
    on('[data-continuer]', () => { const d = dernier(); if (d != null) this.onJouer(d); });
    // création
    on('[data-cls]', e => { this.crea.cle = e.dataset.cls!; this.crea.err = ''; this.render(); });
    on('[data-sexe]', e => { this.crea.sexe = e.dataset.sexe as 'm' | 'f'; this.render(); });
    on('[data-pose]', e => { this.crea.pose = e.dataset.pose!; this.render(); });
    on('[data-filtre]', e => { this.crea.filtre = e.dataset.filtre!; this.render(); });
    const nom = r.querySelector<HTMLInputElement>('[data-nom]');
    nom?.addEventListener('input', () => { this.crea.nom = nom.value; });
    nom?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.creer(); });
    nom?.addEventListener('keyup', e => e.stopPropagation());
    r.querySelector<HTMLInputElement>('[data-hc]')?.addEventListener('change', e => { this.crea.hardcore = (e.target as HTMLInputElement).checked; });
    on('[data-creer]', () => this.creer());
    // mes personnages
    on('[data-slot]', e => { const i = +e.dataset.slot!; if (lirePersos()[i]) { this.choix = i; this.confirmer = -1; this.render(); } else this.go('creation'); });
    on('[data-suppr]', e => {
      const i = +e.dataset.suppr!;
      if (this.confirmer !== i) { this.confirmer = i; this.render(); return; }
      supprimerPerso(i); this.confirmer = -1; this.choix = Math.max(0, lirePersos().findIndex(p => p)); this.render();
    });
    on('[data-jouer-slot]', e => this.onJouer(+e.dataset.jouerSlot!));
  }

  private creer() {
    const s = this.crea, c = classe(s.cle);
    if (!JOUABLES.has(c.cle)) return;
    const libre = lirePersos().findIndex(p => !p);
    if (libre < 0) { this.toast('Tes 3 emplacements sont pris'); return; }
    const nom = s.nom.trim().replace(/\s+/g, ' ');
    if (!nomValide(nom)) { s.err = '3 à 16 lettres (accents, tiret et espace permis).'; this.render(); return; }
    if (lirePersos().some(p => p?.nom.toLowerCase() === nom.toLowerCase())) { s.err = 'Tu as déjà un personnage de ce nom.'; this.render(); return; }
    const now = Date.now();
    const p: Perso = { nom, classe: c.cle, sexe: s.sexe, hardcore: s.hardcore, cree: now, maj: now, temps: 0, lieu: 'Incarnam', zones: [] };
    sauverPerso(libre, p);
    s.nom = ''; s.hardcore = false;
    this.onJouer(libre);
  }
}
