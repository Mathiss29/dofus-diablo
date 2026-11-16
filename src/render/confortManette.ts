// Confort sur la Thor (« Confort Thor : 1B+1D+1E 2A 3A+3B 4A 5A+5B 6A 7A », 2026-11-16) : ce que le bouton A va prendre
// (bulle, bouton de l'écran du bas), la pichenette du stick droit qui change de cible, et la roue des consommables.
// Lit la partie, ne la modifie pas : zoneScene en fait des entrées (comme pour la souris).
import type { World } from '../sim/world';
import type { Player } from '../sim/player';
import type { Interaction } from './manetteJeu';
import { ITEMS } from '../sim/data';
import { sorteConso } from '../sim/consommables';
import { iconHtml } from './icons';

const CASE = 48;
/** Appui sur A à partir duquel il interagit au lieu de frapper (1D). */
export const A_LONG = 0.4;

/** Ce que A ferait, en mots (« Parler à Ganymède », « Zaap d'Astrub »…), et le point où poser la bulle. */
export function decrireInteraction(w: World, i: Interaction): { texte: string; x: number; y: number } | null {
  switch (i.k) {
    case 'pnj': { const n = w.quetes?.pnjs.find(x => x.id === i.id); return n ? { texte: `Parler à ${n.def.nom}`, x: n.x, y: n.y } : null; }
    case 'drop': { const d = w.drops.find(x => x.uid === i.id); const nom = d?.item ? ITEMS.equipment[d.item.id]?.name ?? ITEMS.resources[d.item.id]?.name ?? 'l\'objet' : 'l\'objet';
      return d ? { texte: `Ramasser ${nom}`, x: d.x, y: d.y } : null; }
    case 'zaap': { const r = w.zaapRefuge(), z = [...w.zaapsIci(), ...(r ? [r] : [])].find(x => x.name === i.id); return z ? { texte: `Zaap · ${z.name}`, x: z.x, y: z.y } : null; }
    case 'portail': { const po = w.portes.find(x => x.nom === i.id); return po?.dessin ? { texte: `Entrer · ${po.nom}`, x: po.dessin.x, y: po.dessin.y } : null; }
    case 'poste': { const s = w.postes.find(x => x.id === i.id); return s ? { texte: s.coffre ? 'Ouvrir le coffre' : s.forge ? 'Forgemagie' : 'Utiliser l\'atelier', x: s.x, y: s.y } : null; }
    case 'recolte': { const r = w.recoltes.find(x => x.id === i.id); return r ? { texte: `Récolter ${ITEMS.resources[r.item]?.name ?? ''}`.trim(), x: r.x, y: r.y } : null; }
  }
}

/** 3B : pichenette du stick droit = le monstre suivant dans cette direction (le plus proche dans un cône de 60°), autre que l'actuel. */
export function cibleDansDirection(w: World, p: Player, dir: { x: number; y: number }, actuelle: number | null) {
  let best: (typeof w.monsters)[number] | null = null, bs = Infinity;
  for (const m of w.monsters) {
    if (m.dead || m.id === actuelle) continue;
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
    if (d > CASE * 14 || !d) continue;
    const cos = (dx * dir.x + dy * dir.y) / d;
    if (cos < 0.5) continue;
    const s = d * (2 - cos);
    if (s < bs) { bs = s; best = m; }
  }
  return best;
}

/** Pichenette du stick droit : poussé à fond puis relâché en moins de 0,3 s. */
export class Pichenette {
  private debut = 0; private dir: { x: number; y: number } | null = null;
  /** Renvoie la direction (écran) d'une pichenette qui vient de finir, sinon null. */
  lire(s: { x: number; y: number }, t: number): { x: number; y: number } | null {
    const n = Math.hypot(s.x, s.y);
    if (n > 0.85) { if (!this.dir) this.debut = t; this.dir = { x: s.x / n, y: s.y / n }; return null; }
    if (n < 0.25 && this.dir) { const d = this.dir; this.dir = null; return t - this.debut < 0.3 ? d : null; }
    return null;
  }
  /** Le stick est tenu poussé (visée libre) depuis plus longtemps qu'une pichenette. */
  tenu(t: number) { return !!this.dir && t - this.debut >= 0.3; }
}

// ---------- 7A : roue des consommables (croix ↓ maintenue) ----------
export interface Conso { id: string; nom: string; icone: number; n: number; potion?: boolean }
/** Potions de soin, boissons, Rappel, parchemins, repas… que le perso a sur lui. */
export function consommables(p: Player): Conso[] {
  const l: Conso[] = [];
  for (const [id, n] of Object.entries(p.resources)) {
    const r = ITEMS.resources[id];
    if (!r || !n || !(r.soin || r.rappel || sorteConso(id))) continue;
    l.push({ id, nom: r.name, icone: r.icon, n });
  }
  return l.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).slice(0, 7);
}

const CSS = `#roue-conso{position:fixed;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;z-index:9000;pointer-events:none;font:600 12px Lexend,system-ui,sans-serif;color:#e8e2d4}
#roue-conso .fond{position:absolute;inset:0;border-radius:50%;background:radial-gradient(#0d0f14f4 34%,#0d0f14cc 35%,#0d0f14cc 70%,transparent 71%)}
#roue-conso .c{position:absolute;width:74px;margin-left:-37px;text-align:center;transition:transform .08s}
#roue-conso .c .ic{width:40px;height:40px;margin:0 auto 2px;border-radius:10px;background-color:#1d222b;border:2px solid #333}
#roue-conso .c.on{transform:scale(1.18)}#roue-conso .c.on .ic{border-color:#d3f46f;box-shadow:0 0 12px #d3f46f}
#roue-conso .c small{display:block;color:#a9a48b;font-size:10.5px}
#roue-conso .mil{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;width:120px;font-size:13px}
#roue-conso .mil small{display:block;color:#8e8a78;font-size:11px;margin-top:3px}`;

export class RoueConso {
  private el: HTMLDivElement | null = null;
  private l: Conso[] = [];
  choix = -1;
  get ouverte() { return !!this.el; }
  ouvrir(p: Player) {
    this.fermer();
    if (!document.getElementById('roue-conso-css')) { const s = document.createElement('style'); s.id = 'roue-conso-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.l = [{ id: 'potion', nom: 'Potion de soin', icone: 0, n: p.potions, potion: true }, ...consommables(p)];
    const el = this.el = document.createElement('div'); el.id = 'roue-conso';
    const R = 108, n = this.l.length;
    el.innerHTML = `<div class="fond"></div>${this.l.map((c, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2, x = 150 + Math.cos(a) * R, y = 150 + Math.sin(a) * R - 30;
      return `<div class="c" style="left:${x}px;top:${y}px">${c.potion ? '<i class="ic" style="background-image:url(assets/ui/icon_pv.png)"></i>' : iconHtml(c.icone)}${c.nom.length > 16 ? `${c.nom.slice(0, 15)}…` : c.nom}<small>×${c.n}</small></div>`;
    }).join('')}<div class="mil">Stick gauche : choisir<small>Lâche la croix pour utiliser</small></div>`;
    document.body.appendChild(el);
    this.choix = -1;
  }
  /** Le stick (écran) désigne une part de la roue. */
  viser(s: { x: number; y: number }) {
    if (!this.el || Math.hypot(s.x, s.y) < 0.5) return;
    const n = this.l.length, a = Math.atan2(s.y, s.x) + Math.PI / 2;
    const i = ((Math.round(a / (Math.PI * 2) * n) % n) + n) % n;
    if (i === this.choix) return;
    this.choix = i;
    this.el.querySelectorAll('.c').forEach((c, j) => c.classList.toggle('on', j === i));
  }
  /** Ferme la roue ; renvoie ce qui était choisi. */
  fermer(): Conso | null {
    const c = this.choix >= 0 ? this.l[this.choix] ?? null : null;
    this.el?.remove(); this.el = null; this.choix = -1;
    return c;
  }
}
