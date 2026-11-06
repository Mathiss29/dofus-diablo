import Phaser from 'phaser';
import { GridMap, type WorldGrid } from '../sim/gridmap';

/** Particules officielles des cartes (maquette « Vivant », 2A) : spores, poussière, braises, brume, étoiles…
 *  Données simplifiées des systèmes Unity de Dofus 3 (tools/extraction/particules.py). Affichage seulement, le hasard
 *  vient de Math.random (rien à voir avec la partie). Toujours là, et celles qui brillent ressortent la nuit. */

/** Valeur Unity : constante, [min, max] au hasard, ou courbe sur la vie de la particule (c), au hasard entre deux (c, d). */
type V = number | [number, number] | { c: number[]; d?: number[] };
type Col = { k?: [number, number]; l?: [number, number]; g?: [number, number][]; h?: [number, number][] };
export interface SysData {
  x: number; y: number; l: 'f' | 'g' | 's'; c: number; o: number; n: string; tx: number; b: 'a' | 's' | 'n';
  dur: number; pw?: number; life: V; spd?: V; size: V; rot?: V; col: Col; grav?: number; sim?: number;
  rate?: V; burst?: [number, V, number, number, number][];
  sh: [number, number, number, number, number]; sc: [number, number, number]; ax: [number, number][];
  vx?: V; vy?: V; rad?: V; cl?: Col; sl?: V; av?: V; nz?: [number, number, number, number];
  ss?: [number, number, V, V, number]; str?: [number, number];
}
interface P {
  im: Phaser.GameObjects.Image; age: number; life: number; x: number; y: number; vx: number; vy: number;
  s0: number; r0: number; av: number; c0: number; a0: number; r: number; ph: number; f0: number;
}
interface Sys { d: SysData; ox: number; oy: number; t: number; acc: number; bursts: number[]; ps: P[]; frames: string[] }

/** Au plus tant de particules par système (les plus denses en demandent des centaines). */
const MAX_PAR_SYSTEME = 40;

function samp(c: number[], t: number) {
  const f = Math.min(1, Math.max(0, t)) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(f));
  return c[i] + (c[i + 1] - c[i]) * (f - i);
}
function ev(v: V | undefined, t: number, r: number, def = 0): number {
  if (v === undefined) return def;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v[0] + (v[1] - v[0]) * r;
  const a = samp(v.c, t);
  return v.d ? a + (samp(v.d, t) - a) * r : a;
}
function lerpRgb(a: number, b: number, f: number) {
  const c = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * f)) << s;
  return c(16) | c(8) | c(0);
}
function mulRgb(a: number, b: number) {
  const c = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s;
  return c(16) | c(8) | c(0);
}
/** Couleur [rgb, alpha] d'un dégradé ou d'une paire de couleurs Unity ; t = moment de la vie, r = tirage de la particule. */
function col(c: Col, t: number, r: number): [number, number] {
  if (c.k) {
    if (!c.l) return c.k;
    return [lerpRgb(c.k[0], c.l[0], r), c.k[1] + (c.l[1] - c.k[1]) * r];
  }
  if (c.g) {
    const at = (g: [number, number][], u: number) => {
      const f = Math.min(1, Math.max(0, u)) * (g.length - 1), i = Math.min(g.length - 2, Math.floor(f)), k = f - i;
      return [lerpRgb(g[i][0], g[i + 1][0], k), g[i][1] + (g[i + 1][1] - g[i][1]) * k] as [number, number];
    };
    const a = at(c.g, t);
    if (!c.h) return a;
    const b = at(c.h, t);
    return [lerpRgb(a[0], b[0], r), a[1] + (b[1] - a[1]) * r];
  }
  return [0xffffff, 1];
}

export class Particules {
  private readonly maps = new Map<string, Sys[]>();
  /** Coupables dans les Réglages. */
  actif = true;
  private tint = 0xffffff;
  private nuit = 1;

  constructor(private readonly scene: Phaser.Scene, private readonly wg: WorldGrid,
    private readonly data: Record<string, SysData[]>, private readonly tex: string) {}

  static preload(scene: Phaser.Scene, dir: string, key: string, url: (p: string) => string) {
    scene.load.json(`${key}_particules`, url(`${dir}/particules.json`));
    scene.load.atlas(`${key}_particules_img`, url(`${dir}/particules.webp`), url(`${dir}/particules_atlas.json`));
  }

  /** La carte vient d'être posée : on lance ses systèmes, déjà remplis (prewarm), pour ne pas les voir naître. */
  add(tag: string) {
    const lst = this.data[tag];
    if (!lst || this.maps.has(tag) || !this.scene.textures.exists(this.tex)) return;
    const tx = this.scene.textures.get(this.tex), out: Sys[] = [];
    for (const d of lst) {
      const n = d.ss ? d.ss[0] * d.ss[1] : 1;
      const frames = n > 1 ? Array.from({ length: n }, (_, i) => `${d.tx}_${i}`) : [`${d.tx}`];
      if (!frames.every(f => tx.has(f))) continue;
      const o = this.wg.toScreen(d.x, d.y);
      const s: Sys = { d, ox: o.x, oy: o.y, t: 0, acc: 0, bursts: (d.burst ?? []).map(() => 0), ps: [], frames };
      out.push(s);
      // remplissage : on fait tourner le système quelques secondes sans l'afficher
      const pre = Math.min(6, Math.max(d.dur, ev(d.life, 0, 1)));
      for (let k = 0; k < pre / 0.2; k++) this.step(s, 0.2, false);
    }
    this.maps.set(tag, out);
  }
  remove(tag: string) {
    for (const s of this.maps.get(tag) ?? []) for (const p of s.ps) p.im.destroy();
    this.maps.delete(tag);
  }

  /** tint : teinte de l'ambiance (pour les particules normales) ; lum : force des lueurs (1 le jour, plus la nuit). */
  setAmbiance(tint: number, lum: number) { this.tint = tint; this.nuit = Math.min(1, 0.4 + 0.25 * lum); }   // lueurs douces le jour (0,65), pleines la nuit

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    for (const lst of this.maps.values()) for (const s of lst) {
      if (!this.actif) { for (const p of s.ps) p.im.setVisible(false); continue; }
      this.step(s, dt, true);
    }
  }

  private step(s: Sys, dt: number, show: boolean) {
    const d = s.d, sdt = dt * (d.sim ?? 1), dur = Math.max(0.05, d.dur), S = GridMap.S;
    // émission : débit par seconde + salves (bursts) à leurs moments dans chaque boucle du système
    const t0 = s.t, t1 = s.t + sdt, u = (t0 % dur) / dur;
    s.acc += ev(d.rate, u, Math.random()) * sdt;
    let n = Math.floor(s.acc); s.acc -= n;
    (d.burst ?? []).forEach((b, i) => {
      const [bt, cnt, cycles, every, prob] = b, step = Math.max(0.01, every);
      // instants de salve dans la boucle en cours : bt, bt + every… (cycles = 0 : sans fin)
      const loop = Math.floor(t1 / dur), local = t1 - loop * dur;
      if (Math.floor(t0 / dur) !== loop) s.bursts[i] = 0;
      while ((cycles === 0 || s.bursts[i] < cycles) && bt + s.bursts[i] * step <= local) {
        s.bursts[i]++;
        if (Math.random() <= prob) n += Math.round(ev(cnt, u, Math.random()));
      }
    });
    s.t = t1;
    for (let k = 0; k < n; k++) this.spawn(s, u);
    for (const p of s.ps) {
      if (p.life <= 0) continue;
      p.age += sdt;
      if (p.age >= p.life) { p.life = 0; p.im.setVisible(false); continue; }
      const t = p.age / p.life;
      // vitesse : départ + vitesse sur la vie (Unity, y retourné à l'export) + gravité + bruit (dérive douce)
      p.vy += (d.grav ?? 0) * sdt;
      let vx = p.vx + ev(d.vx, t, p.r), vy = p.vy + ev(d.vy, t, p.r);
      const rad = ev(d.rad, t, p.r);
      if (rad) { const l = Math.hypot(p.x, p.y) || 1; vx += (p.x / l) * rad; vy += (p.y / l) * rad; }
      if (d.nz) {
        const [str, fr, amt] = d.nz, a = str * amt * 0.5, w = 0.6 + fr * 8;
        vx += a * Math.sin(p.age * w + p.ph); vy += a * Math.cos(p.age * w * 1.3 + p.ph * 2);
      }
      p.x += vx * sdt; p.y += vy * sdt;
      if (!show) continue;
      this.draw(s, p, t, vx, vy, S);
    }
  }

  private spawn(s: Sys, u: number) {
    const d = s.d;
    let p = s.ps.find(q => q.life <= 0);
    if (!p) {
      if (s.ps.length >= MAX_PAR_SYSTEME) return;
      const im = this.scene.add.image(0, 0, this.tex, s.frames[0]).setVisible(false);
      if (d.b === 'a') im.setBlendMode(Phaser.BlendModes.ADD);
      else if (d.b === 's') im.setBlendMode(Phaser.BlendModes.SCREEN);
      im.setDepth(this.depth(d));
      p = { im, age: 0, life: 0, x: 0, y: 0, vx: 0, vy: 0, s0: 0, r0: 0, av: 0, c0: 0xffffff, a0: 1, r: 0, ph: 0, f0: 0 };
      s.ps.push(p);
    }
    const r = () => Math.random();
    p.r = r(); p.ph = r() * Math.PI * 2; p.age = 0;
    p.life = Math.max(0.05, ev(d.life, u, r()));
    p.s0 = ev(d.size, u, r(), 1); p.r0 = ev(d.rot, u, r()); p.av = ev(d.av, u, r());
    [p.c0, p.a0] = col(d.col, r(), r());
    p.f0 = d.ss ? ev(d.ss[3], u, r()) : 0;
    // position et direction dans le repère de la forme (Unity), puis projetées à l'écran (ax = axes locaux X, Y, Z)
    const [st, rad0, thick, angle, arc] = d.sh, [sx, sy, sz] = d.sc, R = rad0 * sx;
    let lx = 0, ly = 0, lz = 0, dx = 0, dy = 0, dz = 1;
    const disc = () => {
      const a = r() * (arc || 360) * Math.PI / 180, rr = R * (1 - thick * (1 - Math.sqrt(r())));
      return [Math.cos(a) * rr, Math.sin(a) * rr, a] as const;
    };
    if (st === 0 || st === 1 || st === 2 || st === 3) {
      const z = st >= 2 ? r() : r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - z * z);
      dx = q * Math.cos(a); dy = q * Math.sin(a); dz = z;
      const rr = R * (1 - thick * (1 - Math.cbrt(r())));
      lx = dx * rr; ly = dy * rr; lz = dz * rr;
    } else if (st === 4 || st === 7 || st === 8 || st === 9) {
      const [x, y, a] = disc(), sp = (R ? Math.hypot(x, y) / R : 0) * Math.sin(angle * Math.PI / 180);
      lx = x; ly = y; dx = Math.cos(a) * sp; dy = Math.sin(a) * sp; dz = Math.cos(angle * Math.PI / 180);
    } else if (st === 5 || st === 15 || st === 16) {
      lx = (r() - 0.5) * sx; ly = (r() - 0.5) * sy; lz = (r() - 0.5) * sz;
    } else if (st === 10 || st === 11) {
      if (st === 11) { const a = r() * Math.PI * 2; lx = Math.cos(a) * R; ly = Math.sin(a) * R; } else [lx, ly] = disc();
      const l = Math.hypot(lx, ly) || 1; dx = lx / l; dy = ly / l; dz = 0;
    } else if (st === 12) {
      lx = (r() * 2 - 1) * R; dx = 0; dy = 1; dz = 0;
    } else if (st === 18) {
      lx = (r() - 0.5) * sx; ly = (r() - 0.5) * sy;
    }
    const A = d.ax, proj = (x: number, y: number, z: number) => [A[0][0] * x + A[1][0] * y + A[2][0] * z, A[0][1] * x + A[1][1] * y + A[2][1] * z];
    [p.x, p.y] = proj(lx, ly, lz);
    const [ex, ey] = proj(dx, dy, dz), spd = ev(d.spd, u, r());
    p.vx = ex * spd; p.vy = ey * spd;
  }

  private draw(s: Sys, p: P, t: number, vx: number, vy: number, S: number) {
    const d = s.d, im = p.im;
    let rgb = p.c0, a = p.a0;
    if (d.cl) { const [c, al] = col(d.cl, t, p.r); rgb = mulRgb(rgb, c); a *= al; }
    if (d.b === 'n') rgb = mulRgb(rgb, this.tint); else a *= this.nuit;
    if (a <= 0.01) { im.setVisible(false); return; }
    const size = p.s0 * ev(d.sl, t, p.r, 1);
    if (s.frames.length > 1 && d.ss) {
      const n = s.frames.length, f = (p.f0 + ev(d.ss[2], t, p.r)) * Math.max(1, d.ss[4]);
      const i = f > 1.0001 ? Math.floor(f) % n : Math.floor((f % 1) * n);
      im.setFrame(s.frames[Math.max(0, Math.min(n - 1, i))]);
    }
    const k = (size * S) / Math.max(im.frame.width, im.frame.height);
    im.setPosition(s.ox + p.x * S, s.oy + p.y * S).setTint(rgb).setAlpha(Math.min(1, a)).setVisible(true);
    if (d.str && (vx || vy)) im.setRotation(Math.atan2(vy, vx)).setScale(k * Math.max(1, d.str[0]), k);
    else im.setScale(k).setAngle(p.r0 + p.av * p.age);
  }

  /** Profondeur : au sol (sous le décor), avec le décor de sa case, ou au premier plan. */
  private depth(d: SysData) {
    if (d.l === 'f') return 100000 + d.o * 0.01;
    if (d.l === 'g' || d.c < 0) return -9989 + d.o * 0.001;
    const cc = this.wg.cellCenter(d.c), cs = this.wg.toScreen(cc.x, cc.y + this.wg.data.grid.h / 2);
    return cs.y + d.o * 0.01 + 0.005;
  }
}
