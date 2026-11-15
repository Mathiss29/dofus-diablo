// Manette en jeu (maquette « Console : » 1A+1B, 3A+3B, 4A) : auto-visée, interaction avec A, menu Start à onglets.
// Lit la partie, ne la modifie pas : zoneScene transforme le résultat en entrées (PlayerInput), comme pour la souris.
import type { World } from '../sim/world';
import type { Player } from '../sim/player';
import type { Vec } from '../sim/iso';
import { BTN } from './manette';

const CASE = 48;

/** Direction du stick (à l'écran : x vers la droite, y vers le bas) dans le monde isométrique, normalisée. */
export function dirMonde(v: { x: number; y: number }): Vec {
  const x = v.y + v.x / 2, y = v.y - v.x / 2, n = Math.hypot(x, y);
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
}

/** Auto-visée : le monstre vivant le plus proche, en préférant celui qui est devant le perso (cible gardée d'abord). */
export function cibleAuto(w: World, p: Player, gardee: number | null, devant: Vec | null) {
  const vivants = w.monsters.filter(m => !m.dead);
  const g = gardee != null ? vivants.find(m => m.id === gardee) : undefined;
  if (g && Math.hypot(g.x - p.x, g.y - p.y) < CASE * 16) return g;
  const fx = devant?.x ?? Math.cos(p.facing), fy = devant?.y ?? Math.sin(p.facing);
  let best: (typeof vivants)[number] | null = null, bs = Infinity;
  for (const m of vivants) {
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
    if (d > CASE * 10) continue;
    const cos = d ? (dx * fx + dy * fy) / d : 1;
    const s = d * (1.6 - cos * 0.6);   // devant : compte jusqu'à 1,6 fois plus près qu'un monstre derrière
    if (s < bs) { bs = s; best = m; }
  }
  return best;
}

export type Interaction =
  | { k: 'pnj'; id: string } | { k: 'drop'; id: number } | { k: 'zaap'; id: string } | { k: 'portail'; id: string }
  | { k: 'poste'; id: number } | { k: 'recolte'; id: number };

/** Ce que le bouton A ferait tout près du perso (sinon : attaquer). Un monstre au contact passe avant le reste. */
export function interactionProche(w: World, p: Player): Interaction | null {
  if (w.monsters.some(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < CASE * 2.5)) return null;
  const d = (x: number, y: number) => Math.hypot(x - p.x, y - p.y);
  let best: Interaction | null = null, bd = Infinity;
  const essai = (i: Interaction, dist: number, max: number) => { if (dist <= max && dist < bd) { bd = dist; best = i; } };
  for (const n of w.quetes?.pnjs ?? []) essai({ k: 'pnj', id: n.id }, d(n.x, n.y), CASE * 2.6);
  for (const o of w.drops) if (o.t >= 0 && o.item) essai({ k: 'drop', id: o.uid }, d(o.x, o.y), CASE * 2.2);
  if (w.zone.open) {
    const r = w.zaapRefuge();
    for (const z of r ? [...w.zaapsIci(), r] : w.zaapsIci()) essai({ k: 'zaap', id: z.name }, d(z.x, z.y), CASE * 3);
    for (const po of w.portes) if (po.dessin) essai({ k: 'portail', id: po.nom }, d(po.dessin.x, po.dessin.y), CASE * 3);
  }
  for (const s of w.postes) essai({ k: 'poste', id: s.id }, d(s.x, s.y), CASE * 2.2);
  for (const r of w.recoltes) if (r.repousse <= 0) essai({ k: 'recolte', id: r.id }, d(r.x, r.y), CASE * 2);
  return best;
}

/** Boutons du jeu (schéma 3A), vers les actions de render/touches.ts. A, Start et R3 sont traités à part. */
export const BOUTONS_JEU: Record<number, string> = {
  [BTN.X]: 'sort1', [BTN.Y]: 'sort2', [BTN.B]: 'sort3', [BTN.RB]: 'sort4', [BTN.RT]: 'sort5', [BTN.LT]: 'sort6',
  [BTN.LB]: 'deplacement', [BTN.BAS]: 'potion', [BTN.HAUT]: 'boisson', [BTN.GAUCHE]: 'coffre', [BTN.DROITE]: 'carteTab',
  [BTN.SELECT]: 'carte', [BTN.L3]: 'havresac',
};
/** Couche LT (3B) : LT maintenue, les boutons de face appellent les 4 invocations de l'Osamodas. */
export const COUCHE_LT: Record<number, string> = { [BTN.X]: 'invoc1', [BTN.Y]: 'invoc2', [BTN.B]: 'invoc3', [BTN.A]: 'invoc4' };

// ---------- Menu Start (4A) : 6 onglets, LB / RB pour passer de l'un à l'autre ----------
export type OngletStart = 'inv' | 'sorts' | 'car' | 'carte' | 'quetes' | 'opt';
const ONGLETS: { id: OngletStart; nom: string }[] = [
  { id: 'inv', nom: 'Inventaire' }, { id: 'sorts', nom: 'Sorts' }, { id: 'car', nom: 'Caractéristiques' },
  { id: 'carte', nom: 'Carte' }, { id: 'quetes', nom: 'Quêtes' }, { id: 'opt', nom: 'Options' },
];
const CSS = `#menu-start{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:6px;
  background:#0d0f14f0;border:1px solid #4d5a2c;border-radius:12px;padding:6px 8px;font:600 14px Lexend,system-ui,sans-serif;color:#cfc8b0;box-shadow:0 6px 20px #000a;pointer-events:none}
#menu-start span{padding:5px 12px;border-radius:8px;white-space:nowrap}
@media (max-width:1100px){#menu-start{font-size:13px;gap:2px;padding:5px 6px}#menu-start span{padding:4px 8px}#menu-start .aide{display:none}}
#menu-start span.on{background:#2b3a14;color:#d3f46f}
#menu-start em{font:700 12px ui-monospace,Menlo,monospace;font-style:normal;color:#ffc14d;border:1px solid #5a5236;border-radius:6px;padding:2px 6px}
#menu-start .aide{font:400 12px Lexend,system-ui,sans-serif;color:#8e8a78;margin-left:6px}`;

export class MenuStart {
  ouvert = false;
  private i = 0;
  private el: HTMLDivElement | null = null;
  constructor(private ouvrir: (o: OngletStart) => void, private fermerTout: () => void) {}
  get onglet(): OngletStart { return ONGLETS[this.i].id; }
  montrer() { this.ouvert = true; this.ouvrir(this.onglet); this.dessiner(); }
  fermer(toutFermer = true) {
    if (!this.ouvert) return;
    this.ouvert = false; this.el?.remove(); this.el = null;
    if (toutFermer) this.fermerTout();
  }
  tourner(d: number) { this.i = (this.i + d + ONGLETS.length) % ONGLETS.length; this.ouvrir(this.onglet); this.dessiner(); }
  private dessiner() {
    if (!document.getElementById('menu-start-css')) { const s = document.createElement('style'); s.id = 'menu-start-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!this.el) { this.el = document.createElement('div'); this.el.id = 'menu-start'; document.body.appendChild(this.el); }
    this.el.innerHTML = `<em>LB</em>${ONGLETS.map((o, j) => `<span class="${j === this.i ? 'on' : ''}">${o.nom}</span>`).join('')}<em>RB</em>`
      + `<span class="aide">A choisir · B fermer · stick droit : curseur</span>`;
  }
}
