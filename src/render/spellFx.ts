import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { CASE } from '../sim/monster';
import type { Projectile } from '../sim/world';
import SPELL_FX from '../data/spellfx.json';
import { v } from './assetUrl';

const ASSETS = 'assets';

/** Effets visuels OFFICIELS des sorts (choix 8A) : planches rendues depuis les squelettes Dofus 3 par
 *  tools/extraction/spell_fx.py. Pour chaque sort : projectile, effets sur la cible, effets sur le lanceur.
 *  Purement cosmétique. */
interface GfxDef { anims: Record<string, number>; fps: number; origin: [number, number] }
/** zone : rejoué sur chaque case de la zone du sort (traînée du Couperet) ; scale : échelle officielle de l'effet. */
interface FxRef { gfx: number; bg?: boolean; zone?: boolean; scale?: number }
export interface SpellFxDef { target?: FxRef[]; caster?: FxRef[]; projectile?: { gfx: number; curvature: number; offsetY: number } }
const DATA = SPELL_FX as unknown as { spells: Record<string, SpellFxDef>; gfx: Record<string, GfxDef> };

/** Même échelle d'affichage que les personnages (rendus eux aussi à 0,7). */
const SCALE = 0.82;
const key = (g: number) => `fx_${g}`;

interface Live { s: Phaser.GameObjects.Sprite; frames: string[]; t: number; fps: number }

export class SpellFx {
  private live: Live[] = [];
  private shots = new Map<number, Phaser.GameObjects.Sprite>();

  constructor(private scene: Phaser.Scene) {}

  static def(id: string): SpellFxDef | undefined { return DATA.spells[id]; }

  /** Tous les gfx d'une liste de sorts (pour les charger d'avance). */
  static gfxOf(ids: string[]): number[] {
    const out = new Set<number>();
    for (const id of ids) {
      const d = DATA.spells[id]; if (!d) continue;
      for (const r of [...(d.target ?? []), ...(d.caster ?? [])]) out.add(r.gfx);
      if (d.projectile) out.add(d.projectile.gfx);
    }
    return [...out].filter(g => DATA.gfx[g]);
  }
  static preload(scene: Phaser.Scene, ids: string[]) {
    for (const g of SpellFx.gfxOf(ids)) if (!scene.textures.exists(key(g))) scene.load.atlas(key(g), v(`${ASSETS}/fx/fx_${g}.webp`), v(`${ASSETS}/fx/fx_${g}.json`));
  }
  /** Charge en cours de partie ce qui manque (sorts des monstres d'une autre zone…). */
  private ensure(g: number): boolean {
    if (this.scene.textures.exists(key(g))) return true;
    if (!DATA.gfx[g]) return false;
    this.scene.load.atlas(key(g), v(`${ASSETS}/fx/fx_${g}.webp`), v(`${ASSETS}/fx/fx_${g}.json`));
    if (!this.scene.load.isLoading()) this.scene.load.start();
    return false;
  }

  /** Animation selon l'orientation : FX_0 si l'effet n'est pas orienté, sinon la diagonale (1, 3, 5, 7) ou son miroir. */
  private pick(g: number, facing: number): { anim: string; flip: boolean } {
    const A = DATA.gfx[g].anims;
    if (A.FX_0 && !A.FX_1) return { anim: 'FX_0', flip: false };
    const fd = ISO.toScreen(Math.cos(facing), Math.sin(facing));
    const o = fd.y >= 0 ? (fd.x >= 0 ? 1 : 3) : (fd.x >= 0 ? 7 : 5);
    if (A[`FX_${o}`]) return { anim: `FX_${o}`, flip: false };
    const m = ({ 1: 3, 3: 1, 5: 7, 7: 5 } as Record<number, number>)[o];
    if (A[`FX_${m}`]) return { anim: `FX_${m}`, flip: true };
    return { anim: Object.keys(A)[0], flip: false };
  }

  play(g: number, x: number, y: number, facing: number, bg = false, z = 0, k = 1) {
    if (!this.ensure(g)) return;
    const G = DATA.gfx[g], { anim, flip } = this.pick(g, facing), n = G.anims[anim];
    const frames = Array.from({ length: n }, (_, i) => `${anim}_${i}`);
    const p = ISO.toScreen(x, y, z);
    const s = this.scene.add.sprite(p.x, p.y, key(g), frames[0]).setOrigin(G.origin[0], G.origin[1])
      .setScale((flip ? -SCALE : SCALE) * k, SCALE * k).setDepth(bg ? -4000 : p.y + 30);
    this.live.push({ s, frames, t: 0, fps: G.fps });
  }

  /** Effets d'un sort : sur la cible (x, y) et sur le lanceur (cx, cy). true si le sort a des effets officiels. */
  cast(id: string, x: number, y: number, facing: number, cx = x, cy = y, len = 0): boolean {
    const d = DATA.spells[id];
    if (!d || (!d.target?.length && !d.caster?.length)) return false;
    for (const r of d.target ?? []) {
      if (r.zone && len > 0) {   // une fois par case de la zone, depuis le lanceur
        for (let t = CASE; t <= len + 1; t += CASE) this.play(r.gfx, cx + Math.cos(facing) * t, cy + Math.sin(facing) * t, facing, r.bg, 0, r.scale ?? 1);
      } else this.play(r.gfx, x, y, facing, r.bg, 0, r.scale ?? 1);
    }
    for (const r of d.caster ?? []) this.play(r.gfx, cx, cy, facing, r.bg);
    return true;
  }

  /** Projectiles officiels en vol. Renvoie les projectiles dessinés ici (les autres gardent le trait lumineux). */
  projectiles(list: readonly Projectile[]): Set<number> {
    const drawn = new Set<number>();
    for (const a of list) {
      const g = DATA.spells[a.spell]?.projectile?.gfx;
      if (!g || !this.ensure(g)) continue;
      drawn.add(a.id);
      let s = this.shots.get(a.id);
      if (!s) { const G = DATA.gfx[g]; s = this.scene.add.sprite(0, 0, key(g), 'FX_0_0').setOrigin(G.origin[0], G.origin[1]).setScale(SCALE); this.shots.set(a.id, s); }
      const h = ISO.toScreen(a.x, a.y, 34), d = ISO.toScreen(a.dx, a.dy);
      s.setPosition(h.x, h.y).setRotation(Math.atan2(d.y, d.x)).setDepth(h.y + 30);
    }
    for (const [id, s] of this.shots) if (!drawn.has(id)) { s.destroy(); this.shots.delete(id); }
    return drawn;
  }

  update(dt: number) {
    for (const l of this.live) {
      l.t += dt;
      const i = Math.floor(l.t * l.fps);
      if (i >= l.frames.length) { l.s.destroy(); continue; }
      l.s.setFrame(l.frames[i]);
    }
    this.live = this.live.filter(l => l.s.active);
  }
}
