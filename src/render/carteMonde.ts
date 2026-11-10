import type { World } from '../sim/world';
import { v } from './assetUrl';
import { ISO } from '../sim/iso';
import { ITEMS } from '../sim/data';
import { ICON_CSS, iconHtml } from './icons';
import { QUEST_ICON } from './questView';

/** Carte du monde (touche M, maquette 0.2 choix 18A) : l'image réduite du monde (tools/extraction/carte_monde.py),
 *  le joueur, les Zaaps, les portails et le nom des sous-zones. Glisser pour se déplacer, molette pour zoomer.
 *  Le jeu continue derrière (comme les autres fenêtres). Lecture seule : ne modifie pas la partie. */
const CSS = `
.dw.cm{pointer-events:auto;z-index:11;background:#0008}
.dw .win.carte{width:min(1100px,94vw);height:min(760px,90vh)}
.cm .vue{position:relative;overflow:hidden;cursor:grab;background:radial-gradient(ellipse at center,#22303a,#0c0f14);border-radius:0 0 3px 3px}
.cm .vue.drag{cursor:grabbing}
.cm .plan{position:absolute;left:0;top:0;transform-origin:0 0}
.cm .plan img{display:block;user-select:none;-webkit-user-drag:none}
.cm .mk{position:absolute;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap}
.cm .mk.qt img{width:30px;height:30px;filter:drop-shadow(0 0 6px #ffd76a)}
.cm .mk.tr{width:6px;height:6px;border-radius:50%;background:#ffd76a;box-shadow:0 0 0 1.5px #3a2208,0 0 6px #ffd76a}
.cm .sz{font:bold 12px Lexend,sans-serif;color:#f4efe0;text-shadow:0 0 3px #000,0 1px 2px #000;opacity:.92}
.cm .zp{width:14px;height:14px;background:#6fd3ff;border:2px solid #fff;transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 8px #6fd3ff}
.cm .pt{width:14px;height:14px;border-radius:50%;background:#c58cff;border:2px solid #fff;box-shadow:0 0 8px #c58cff}
.cm .moi{width:16px;height:16px;border-radius:50%;background:#ff5a4a;border:2px solid #fff;box-shadow:0 0 0 3px #ff5a4a66,0 0 12px #ff5a4a}
.cm .leg{position:absolute;left:12px;bottom:10px;background:#000b;padding:4px 10px;border-radius:3px;display:flex;gap:14px;font:12px Lexend,sans-serif;color:#cfc8b6;text-shadow:0 1px 2px #000;pointer-events:none}
.cm .leg i{display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:-1px;border:1px solid #fff}
.cm .rp{width:26px;height:26px;pointer-events:auto;cursor:help;filter:drop-shadow(0 1px 2px #000)}
.cm .rp.eteint{filter:grayscale(1) brightness(.6) drop-shadow(0 1px 2px #000);opacity:.6}
.cm .rp:hover{filter:drop-shadow(0 0 4px #ffe9a8) brightness(1.15)}
.cm .gd{width:26px;height:26px;pointer-events:auto;cursor:help;filter:drop-shadow(0 1px 2px #000) drop-shadow(0 0 4px #f2d36b)}
.cm .gd .ic{width:26px;height:26px}
.cm .vd{pointer-events:auto;cursor:help;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:2px solid #f2d36b;background:#000a;box-shadow:0 0 0 4px #f2d36b55,0 0 14px #f2d36b;animation:cmvd 1.2s ease-in-out infinite alternate}
.cm .vd .ic{width:22px;height:22px}
.cm .ou{width:22px;height:22px;pointer-events:none;border-radius:50%;border:2px solid #b9e54b;background:#000a;display:grid;place-items:center;box-shadow:0 0 0 3px #b9e54b44,0 0 12px #b9e54b;animation:cmvd 1.1s ease-in-out infinite alternate}
.cm .ou .ic{width:16px;height:16px}
.cm .ttlou{position:absolute;left:12px;top:10px;background:#000c;padding:6px 12px;border-radius:3px;border:1px solid #b9e54b88;font:bold 13px Lexend,sans-serif;color:#d6f57a;display:flex;gap:8px;align-items:center;pointer-events:none}
.cm .ttlou .ic{width:24px;height:24px}
@keyframes cmvd{to{box-shadow:0 0 0 9px #f2d36b22,0 0 20px #f2d36b}}
.cm .aide{position:absolute;right:12px;bottom:10px;background:#000b;padding:4px 10px;border-radius:3px;font:12px Lexend,sans-serif;color:#a8a290;pointer-events:none}
`;

/** « Montrer sur la carte » (Métiers UI 8B, 11B) : où trouver une ressource (cartes entières et points précis). */
export interface MarqueCarte { titre: string; icone: number; tags: string[]; points: { x: number; y: number }[]; /** Image à la place de l'icône d'objet (succès). */ img?: string }

export class CarteMonde {
  private root: HTMLDivElement | null = null;
  private plan!: HTMLDivElement;
  private moi!: HTMLDivElement;
  private zoom = 1;
  private pos = { x: 0, y: 0 };

  constructor(private world: World, private image: string, private icones: string) {
    const st = document.createElement('style'); st.textContent = CSS + ICON_CSS; document.head.appendChild(st);
  }
  get ouverte() { return !!this.root; }
  get dispo() { return !!this.world.worldGrid?.world.carte; }
  basculer() { if (this.root) this.fermer(); else this.ouvrir(); }
  /** Ouvre la carte avec les endroits où trouver une ressource (Métiers UI). */
  montrer(m: MarqueCarte) { this.fermer(); this.ouvrir(m); }
  /** Idée 3 (2026-11-08) : clic sur l'objectif du suivi, la carte s'ouvre centrée sur le but de la quête. */
  montrerQuete() { this.fermer(); this.ouvrir(undefined, true); }
  fermer() { this.root?.remove(); this.root = null; }
  destroy() { this.fermer(); }

  /** Coordonnées « carte » (repère des sols du monde) d'un point du jeu, en pixels de l'image. */
  private px(mx: number, my: number) {
    const c = this.world.worldGrid!.world.carte!;
    return { x: (mx - c.x) * c.k, y: (my - c.y) * c.k };
  }
  private duJeu(wx: number, wy: number) {
    const wg = this.world.worldGrid!, s = ISO.toScreen(wx, wy), m = wg.fromScreen(s.x, s.y);
    return this.px(m.x, m.y);
  }
  private milieuCarte(tag: string) {
    const wg = this.world.worldGrid!, m = wg.cellCenter(wg.cellOf(tag, 280));   // case du milieu d'une carte (14 x 40)
    return this.px(m.x, m.y);
  }

  ouvrir(ou?: MarqueCarte, surQuete = false) {
    const wg = this.world.worldGrid, open = this.world.zone.open;
    if (!wg || !open || !this.dispo) return;
    const root = document.createElement('div'); root.className = 'dw cm'; this.root = root;
    root.innerHTML = `<div class="win carte"><div class="ttl"><b>Carte du monde · ${this.world.zone.name}</b><span class="x" title="Fermer (Échap)"></span></div>
      <div class="vue"><div class="plan"><img src="${this.image}" alt=""></div>
      <div class="leg"><span><i style="background:#ff5a4a;border-radius:50%"></i>Toi</span><span><i style="background:#c58cff;border-radius:50%"></i>Portail</span></div>
      <div class="aide">Glisser pour se déplacer · molette pour zoomer · M ou Échap pour fermer</div></div></div>`;
    root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === root) this.fermer(); });
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.querySelector('.x')!.addEventListener('click', () => this.fermer());
    document.body.appendChild(root);
    const vue = root.querySelector('.vue') as HTMLDivElement;
    this.plan = root.querySelector('.plan') as HTMLDivElement;

    // noms des sous-zones : au milieu de leurs cartes
    const parSz = new Map<number, { x: number; y: number; n: number }>();
    for (const m of wg.world.maps) {
      if (m.inside || !/^-?\d+_-?\d+$/.test(m.tag)) continue;
      const c = this.milieuCarte(m.tag), a = parSz.get(m.sub) ?? { x: 0, y: 0, n: 0 };
      a.x += c.x; a.y += c.y; a.n++; parSz.set(m.sub, a);
    }
    for (const [sub, a] of parSz) {
      const nom = open.subareas[String(sub)]?.name; if (!nom) continue;
      this.marque('mk sz', a.x / a.n, a.y / a.n, nom);
    }
    // points d'intérêt officiels (table hints : ateliers, banque, Zaaps, donjons…), côte à côte au milieu de leur carte
    const parCarte = new Map<string, NonNullable<typeof wg.world.reperes>>();
    for (const r of wg.world.reperes ?? []) { const m = wg.mapByTag(r.t); if (!m || (m.essai && !this.world.test)) continue;   /* 0.4 cachée */ const l = parCarte.get(r.t) ?? []; l.push(r); parCarte.set(r.t, l); }
    for (const [tag, l] of parCarte) {
      const c = this.milieuCarte(tag);
      l.forEach((r, i) => {
        // maquette « Zaap : » 3A : un Zaap pas encore découvert reste éteint sur la carte
        const cp = r.n === 'Zaap' ? open.checkpoints.find(k => `${k.map[0]}_${k.map[1]}` === tag) : null;
        const eteint = !!cp && !this.world.player.zaaps.some(z => z.zone === this.world.opts.zone && z.name === cp.name);
        const im = document.createElement('img'); im.className = `mk rp${eteint ? ' eteint' : ''}`; im.src = v(`${this.icones}/${r.g}.webp`);
        im.title = eteint ? 'Zaap à découvrir' : cp ? `Zaap · ${open.subareas[String(cp.sub)]?.name ?? cp.name}` : r.n; im.alt = r.n;
        im.style.left = `${c.x + (i - (l.length - 1) / 2) * 24}px`; im.style.top = `${c.y}px`; this.plan.appendChild(im);
      });
    }
    for (const cp of open.checkpoints) {
      if (wg.world.reperes?.length) break;   // les Zaaps sont déjà dans les repères officiels
      const tag = `${cp.map[0]}_${cp.map[1]}`; if (!wg.mapByTag(tag)) continue;
      const c = this.milieuCarte(tag); this.marque('mk zp', c.x, c.y).title = cp.name;
    }
    for (const po of this.world.portes) if (po.vers) { const c = this.duJeu(po.ends[0].x, po.ends[0].y); this.marque('mk pt', c.x, c.y); }
    // gardiens des donjons (maquette Gardiens 9A) : la clé du donjon ; le vendeur de clés montré par un gardien (6A) brille
    const Q = this.world.quetes;
    for (const n of Q?.pnjs ?? []) {
      const g = n.def.gardien; if (!g) continue;
      const cle = this.world.entreeDonjon(g.donjon)?.cle ?? '8545', c = this.duJeu(n.x, n.y);
      const d = this.marque('mk gd', c.x, c.y + 20); d.innerHTML = iconHtml(ITEMS.resources[cle]?.icon ?? 0); d.title = `${n.def.nom} · ${g.donjon}`;
    }
    // quête suivie (Tour 8A) : là où aller (prochain donjon du tour du monde, PNJ à qui rendre…)
    // + trajet en pointillés (maquette Flèche 5A) : jusqu'au but, ou jusqu'à la porte, au portail ou au Zaap qui y mène
    const it = Q?.itineraire(), qs = Q?.suivie && Q.def(Q.suivie);
    let surBut: { x: number; y: number } | null = null;
    if (it && qs && it.pts.length) {
      const der = it.pts[it.pts.length - 1];
      let prev = this.duJeu(this.world.player.x, this.world.player.y);
      for (const o of it.pts) {
        const c = this.duJeu(o.x, o.y), L = Math.hypot(c.x - prev.x, c.y - prev.y), n = Math.floor(L / 14);
        for (let i = 1; i < n; i++) this.marque('mk tr', prev.x + (c.x - prev.x) * i / n, prev.y + (c.y - prev.y) * i / n);
        prev = c;
      }
      const c = this.duJeu(der.x, der.y), d = this.marque('mk qt', c.x, c.y); surBut = c;
      d.innerHTML = `<img src="${v(`assets/ui/quetes/${QUEST_ICON[qs.type][1]}.png`)}" alt="">`;
      d.title = `${qs.nom} · ${it.nom}${der.genre === 'porte' ? ` (${it.cartes} cartes, par cette porte)` : der.genre === 'portail' ? ' (par le portail)' : der.genre === 'zaap' ? ` (par le Zaap ${it.zaap ?? ''})` : ''}`;
    }
    const ve = Q?.marqueVendeur && Q.pnj(Q.marqueVendeur);
    if (ve) { const c = this.duJeu(ve.x, ve.y), d = this.marque('mk vd', c.x, c.y); d.innerHTML = iconHtml(ITEMS.resources['8143']?.icon ?? 0); d.title = `${ve.def.nom} · clés de donjon`; }
    // Métiers UI : où trouver la ressource demandée (cartes de récolte ou des monstres qui la lâchent, entrées des donjons)
    let centre: { x: number; y: number } | null = surQuete ? surBut : null;
    if (ou) {
      const pts = [...new Set(ou.tags)].filter(t => wg.mapByTag(t)).map(t => this.milieuCarte(t)).concat(ou.points.map(q => this.duJeu(q.x, q.y)));
      const ic = ou.img ? `<img class="ic" src="${ou.img}" alt="">` : iconHtml(ou.icone);
      for (const q of pts) { const d = this.marque('mk ou', q.x, q.y); d.innerHTML = ic; d.title = ou.titre; }
      if (pts.length) centre = { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, y: pts.reduce((s, q) => s + q.y, 0) / pts.length };
      const t = document.createElement('div'); t.className = 'ttlou'; t.innerHTML = `${ic}Où trouver : ${ou.titre} (${pts.length} endroit${pts.length > 1 ? 's' : ''})`;
      vue.appendChild(t);
    }
    this.moi = this.marque('mk moi', 0, 0);

    // centré sur le joueur, à l'échelle 1 (l'image est déjà réduite)
    const r = vue.getBoundingClientRect(), p = centre ?? this.duJeu(this.world.player.x, this.world.player.y);
    this.zoom = 1; this.pos = { x: r.width / 2 - p.x, y: r.height / 2 - p.y };
    this.appliquer(); this.update();

    let drag: { x: number; y: number } | null = null;
    vue.addEventListener('pointerdown', e => { drag = { x: e.clientX - this.pos.x, y: e.clientY - this.pos.y }; vue.classList.add('drag'); vue.setPointerCapture(e.pointerId); });
    vue.addEventListener('pointermove', e => { if (drag) { this.pos = { x: e.clientX - drag.x, y: e.clientY - drag.y }; this.appliquer(); } });
    vue.addEventListener('pointerup', () => { drag = null; vue.classList.remove('drag'); });
    vue.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const rr = vue.getBoundingClientRect(), mx = e.clientX - rr.left, my = e.clientY - rr.top;
      const z = Math.min(3, Math.max(0.35, this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      this.pos = { x: mx - (mx - this.pos.x) * z / this.zoom, y: my - (my - this.pos.y) * z / this.zoom }; this.zoom = z;
      this.appliquer();
    }, { passive: false });
  }
  private marque(cls: string, x: number, y: number, texte = '') {
    const d = document.createElement('div'); d.className = cls; d.textContent = texte;
    d.style.left = `${x}px`; d.style.top = `${y}px`; this.plan.appendChild(d);
    return d;
  }
  private appliquer() {
    this.plan.style.transform = `translate(${this.pos.x}px,${this.pos.y}px) scale(${this.zoom})`;
    // les marques gardent leur taille quel que soit le zoom
    this.plan.querySelectorAll<HTMLElement>('.mk').forEach(m => { m.style.scale = String(1 / this.zoom); });
  }
  /** Position du joueur (appelé à chaque image tant que la carte est ouverte). */
  update() {
    if (!this.root) return;
    const p = this.duJeu(this.world.player.x, this.world.player.y);
    this.moi.style.left = `${p.x}px`; this.moi.style.top = `${p.y}px`;
  }
}
