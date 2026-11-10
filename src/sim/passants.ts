import DATA from '../data/passants.json';
import { Rng } from './math';
import type { Vec } from './iso';
import type { WorldGrid } from './gridmap';

/** Habitants du Bastion des Douze (maquette Ville 5F : « des habitants qui marchent, des gardes, un crieur : la ville vit même
 *  en solo »). Ils flânent d'un bout à l'autre de l'île centrale, s'arrêtent un moment, repartent. Purement décoratifs : ils ne
 *  bloquent personne et n'entrent pas en combat. Leur hasard a sa propre graine (la partie tire toujours la même suite). */
export interface HabitantDef { id: string; nom: string; dofusId: number }
export const HABITANTS = DATA.habitants as HabitantDef[];
/** Autres lieux qui vivent (0.4 suite 6C : le Château d'Amakna) : leurs habitants flânent sur plusieurs cartes d'une zone. */
export interface LieuPassants { zone: string; v04?: boolean; cartes: string[]; habitants: HabitantDef[] }
export const LIEUX_PASSANTS = (DATA as unknown as { lieux: Record<string, LieuPassants> }).lieux;
/** Les lieux de cette zone (la 0.4 seulement si elle est visible). */
export const lieuxDeZone = (zone: string, v04: boolean) => Object.values(LIEUX_PASSANTS).filter(l => l.zone === zone && (v04 || !l.v04));

export class Passant {
  /** Champs lus par l'affichage (comme une entité) : position, orientation, animation. */
  z = 0; facing = Math.PI / 4; anim: 'idle' | 'walk' = 'idle'; animT = 0; age = 0; flash = 0;
  readonly radius = 14; readonly dead = false; readonly faction = 'pnj'; readonly hp = 1; readonly maxHp = 1;
  chemin: Vec[] = [];
  /** Secondes d'arrêt avant de repartir. */
  attente: number;
  constructor(readonly id: number, readonly def: HabitantDef, public x: number, public y: number, attente: number) { this.attente = attente; }
}

export class Passants {
  /** Vitesse de marche (unités du monde par seconde) : une promenade, bien plus lente que le perso. */
  static readonly VITESSE = 70;
  readonly liste: Passant[] = [];
  private rng: Rng;
  private libres: number[];

  /** `tags` : les cartes où ils flânent (cases marchables de ces cartes) ; `defs` : qui (par défaut, les habitants du Bastion). */
  constructor(private wg: WorldGrid, tags: string[], seed: number, premierId: number, defs: HabitantDef[] = HABITANTS) {
    this.rng = new Rng(seed ^ 0x5a55a5);
    this.libres = tags.flatMap(t => wg.freeByMap.get(t) ?? []);
    if (!this.libres.length) return;
    defs.forEach((def, i) => {
      const q = wg.cellToWorld(this.rng.pick(this.libres));
      this.liste.push(new Passant(premierId + i, def, q.x, q.y, this.rng.range(0, 6)));
    });
  }

  update(dt: number) {
    for (const p of this.liste) {
      p.age += dt;
      if (p.attente > 0) {
        p.attente -= dt; p.anim = 'idle';
        if (p.attente <= 0) this.repartir(p);
        continue;
      }
      const t = p.chemin[0];
      if (!t) { this.arreter(p); continue; }
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), pas = Passants.VITESSE * dt;
      p.anim = 'walk'; p.facing = Math.atan2(dy, dx);
      if (d <= pas) { p.x = t.x; p.y = t.y; p.chemin.shift(); if (!p.chemin.length) this.arreter(p); }
      else { p.x += dx / d * pas; p.y += dy / d * pas; }
    }
  }
  /** Arrivé : il reste là de 4 à 12 secondes (il regarde une vitrine, il discute). */
  private arreter(p: Passant) { p.anim = 'idle'; p.chemin = []; p.attente = this.rng.range(4, 12); }
  /** Un nouveau but à quelques dizaines de pas, sur l'île ou dans le lieu (case marchable atteignable). */
  private repartir(p: Passant) {
    for (let essai = 0; essai < 6; essai++) {
      const q = this.wg.cellToWorld(this.rng.pick(this.libres)), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 250 || d > 1400) continue;
      const ch = this.wg.findPath({ x: p.x, y: p.y }, q, 3000, 10);
      if (ch.length) { p.chemin = ch; return; }
    }
    p.attente = this.rng.range(2, 5);
  }
}
