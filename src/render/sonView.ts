import { GAME_DATA } from '../sim/data';
import { ISO } from '../sim/iso';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/world';
import type { Monster } from '../sim/monster';
import type { WorldGrid } from '../sim/gridmap';
import type { Look } from './looks';
import type { SysData } from './particles';
import spellfx from '../data/spellfx.json';
import { MANIFESTE, Son, regrouper, sonDuDecor } from './son';

const FX = (spellfx as unknown as { spells: Record<string, Record<string, { gfx: number }[] | unknown>> }).spells;
/** Monstres qui nous attaquent : à cette distance (unités du monde) ils comptent pour la musique (3A). */
const PORTEE_COMBAT = 700;
/** Une seconde d'animation officielle ≈ 32 images à 30 images par seconde : sert à caler le son d'un sort qu'on joue à partir du milieu. */
const DUREE_ANIM = 32 / 30;

/** Sons d'une partie : lit l'état de la simulation et ses événements (comme FX), et commande le son (render/son.ts). */
export class SonView {
  private classe: string;
  private prevAnim = '';
  private prevT = 0;
  private coupRecolte = 0;
  private etats = new Map<number, string>();
  /** Élite ou boss contre qui la musique de combat joue (3B). */
  private adversaire: Monster | null = null;
  private emetteurs: { k: string; x: number; y: number }[] = [];
  private fondT = 0;
  private horloge = 0;

  constructor(private world: World, private look: Look, classId: string, private vitrine: boolean, parts?: Record<string, SysData[]>, wg?: WorldGrid) {
    this.classe = classId;
    Son.demarrer();
    if (vitrine) Son.menu();
    else Son.zone(!world.zone.open ? [] : world.opts.zone === 'astrub' ? ['astrub'] : ['incarnam1', 'incarnam2', 'incarnam_explo01']);
    // 7B : sources de sons du décor, d'après les particules officielles (feux, eau, Zaap), regroupées
    if (parts && wg) {
      const pts = new Map<string, { x: number; y: number }[]>();
      for (const lst of Object.values(parts)) for (const d of lst) {
        const k = sonDuDecor(d.n); if (!k) continue;
        const s = wg.toScreen(d.x, d.y);
        (pts.get(k) ?? pts.set(k, []).get(k)!).push(s);
      }
      for (const [k, l] of pts) for (const g of regrouper(l, 350)) this.emetteurs.push({ k, x: g.x, y: g.y });
    }
    if (!vitrine) this.precharger();
  }

  /** Sons de la classe, des effets et des monstres de la zone : chargés en fond dès l'arrivée. */
  private precharger() {
    const M = MANIFESTE, f: string[] = [...Object.values(M.ui), ...M.impacts, ...(M.kamas ?? []), ...Object.values(M.recolte ?? {}).flat()];
    f.push(...Object.values(M.sorts[this.classe] ?? {}));
    for (const a of Object.values(this.look.map)) { const s = M.sorts.commun[a.anim]; if (s) f.push(s); }
    const types = new Set(this.world.monsters.map(m => m.type));
    const zone = this.world.zone.open;
    if (zone) for (const s of Object.values(zone.subareas)) s.monsters.forEach(m => types.add(m));
    for (const t of types) { const m = M.monstres[t]; if (m) f.push(...m.attaque, ...m.hit, ...m.mort); }
    for (const id of [...Object.keys(GAME_DATA.classes[this.classe]?.spells ?? {}), ...[...types].flatMap(t => (GAME_DATA.monsters[t]?.spells ?? []).map(s => `m${s.id}`))])
      f.push(...this.gfxDe(id));
    Son.precharger(f);
  }
  private gfxDe(id: string): string[] {
    const s = FX[id]; if (!s) return [];
    return Object.values(s).flatMap(p => Array.isArray(p) ? p : []).flatMap(e => MANIFESTE.gfx[String((e as { gfx: number }).gfx)] ?? []);
  }

  /** Volume et côté (gauche/droite) d'un son placé dans le monde, selon le joueur. */
  private place(x: number, y: number) {
    const p = this.world.player, a = ISO.toScreen(p.x, p.y), b = ISO.toScreen(x, y);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return { vol: d < 300 ? 1 : Math.max(0, 1 - (d - 300) / 1100), pan: (b.x - a.x) / 1000 };
  }
  private monstre(id?: number) { return id == null ? undefined : this.world.monsters.find(m => m.id === id); }

  handle(e: SimEvent) {
    if (this.vitrine) return;
    const M = MANIFESTE;
    switch (e.k) {
      case 'spell': case 'spellFx': {
        // 4A : son officiel de l'effet du sort, là où il frappe
        const l = this.gfxDe(e.id); if (!l.length) break;
        const p = this.place(e.x, e.y);
        if (p.vol > 0.03) Son.jouer(Son.auHasard(l), 'effets', { ...p, vol: p.vol * (e.k === 'spell' && e.discret ? 0.6 : 0.9), cle: `fx${e.id}`, ecart: 0.12 });
        break;
      }
      case 'hit':
        if (e.target === 'monster') {
          // 4B : impact officiel, un peu varié ; 5A : le monstre crie parfois
          const p = this.place(e.x, e.y);
          Son.jouer(Son.auHasard(M.impacts), 'effets', { ...p, vol: p.vol * 0.55, vitesse: 0.92 + Math.random() * 0.16, cle: 'impact', ecart: 0.06 });
          const m = this.monstre(e.id), s = m && M.monstres[m.type];
          if (s && Math.random() < 0.35) Son.jouer(Son.auHasard(s.hit), 'effets', { ...p, vol: p.vol * 0.7, cle: `hit${m!.id}`, ecart: 0.7, monstre: true, type: m!.type });
        }
        break;
      case 'kill': {
        const s = M.monstres[e.monster], p = this.place(e.x, e.y);
        Son.jouer(Son.auHasard(s?.mort), 'effets', { ...p, vol: p.vol * 0.85, cle: `mort${e.monster}`, ecart: 0.15, monstre: true, type: e.monster });
        break;
      }
      case 'levelUp': Son.jouer(M.ui.niveau, 'interface'); break;
      case 'queteEtape': case 'objetQuete': Son.jouer(M.ui.objectif, 'interface', { cle: 'objectif', ecart: 0.5 }); break;
      case 'queteFin': if (!e.sautee) Son.jouer(M.ui.objectif, 'interface', { cle: 'objectif', ecart: 0.5 }); break;
      case 'succes': Son.jouer(M.ui.succes, 'interface'); break;
      case 'checkpoint': Son.jouer(M.ui.checkpoint, 'interface'); break;
      // Kamas D : tintement des pièces ramassées (son officiel, plus aigu que la chute au sol)
      case 'lootKamas': Son.jouer(Son.auHasard(M.kamas), 'effets', { vol: 0.7, vitesse: 1.12 + Math.random() * 0.1, cle: 'kamas', ecart: 0.08 }); break;
      case 'playerDeath': if (this.adversaire) { this.adversaire = null; Son.finCombat(false); } break;
    }
  }

  /** À chaque image : sorts du joueur, attaques des monstres, intensité de la musique, ambiance et décor. */
  update(inside: boolean) {
    // temps réel (Phaser lisse et plafonne son delta quand les images ralentissent : les fondus et silences seraient trop longs)
    const now = performance.now(), dt = Math.min(0.25, (now - (this.horloge || now)) / 1000); this.horloge = now;
    if (this.vitrine) { Son.update(dt); return; }
    const w = this.world, p = w.player, M = MANIFESTE;
    // 4A : son de l'animation officielle du sort, au moment où elle démarre (même numéro : AnimAttaque801)
    if (p.anim !== this.prevAnim || p.animT + 0.25 < this.prevT) {
      const st = this.look.map[p.anim], avant = this.look.map[this.prevAnim];
      const suite = avant && st && avant.anim === st.anim && (st.from ?? 0) > 0;   // Colère : charge puis coup, un seul son
      if (st && /^Anim(Attaque|Arme)\d+$/.test(st.anim) && !suite) {
        const f = M.sorts[this.classe]?.[st.anim] ?? M.sorts.commun[st.anim];
        Son.jouer(f, 'effets', { offset: (st.from ?? 0) * DUREE_ANIM, vol: 0.9, cle: 'lanceur', ecart: 0.05 });
      }
    }
    this.prevAnim = p.anim; this.prevT = p.animT;
    // Armes 9A : coups officiels de l'animation de récolte (la pêche n'a que le lancer de ligne, une fois)
    if (p.anim.startsWith('r_')) {
      const g = p.anim.slice(2), l = M.recolte?.[g];
      this.coupRecolte -= dt;
      if (l?.length && this.coupRecolte <= 0) {
        Son.jouer(Son.auHasard(l), 'effets', { vol: 0.75, vitesse: 0.95 + Math.random() * 0.1, cle: 'recolte', ecart: 0.1 });
        this.coupRecolte = g === 'AnimPeche' ? 99 : g === 'AnimCueillir0' ? 0.6 : 0.42;
      }
    } else this.coupRecolte = 0;
    // 5A : cri d'attaque des monstres ; 3A/3B : qui nous attaque
    let attaquants = 0, adv: Monster | null = null;
    const vus = new Set<number>();
    for (const m of w.monsters) {
      vus.add(m.id);
      const avant = this.etats.get(m.id);
      if (m.state !== avant) {
        this.etats.set(m.id, m.state);
        if (m.state === 'windup' && !m.dead) {
          const s = M.monstres[m.type], pl = this.place(m.x, m.y);
          // Sons 7B : un monstre normal sur deux crie en attaquant ; les élites et les boss crient toujours
          const crie = m.def.elite || m.def.boss || Math.random() < 0.5;
          if (s && crie && pl.vol > 0.05) Son.jouer(Son.auHasard(s.attaque), 'effets', { ...pl, vol: pl.vol * 0.75, cle: `atk${m.id}`, ecart: 0.8, monstre: true, type: m.type });
        }
      }
      if (m.dead || p.dead) continue;
      const engage = m.state === 'chase' || m.state === 'windup' || m.state === 'lunge' || m.state === 'recover';
      if (engage && Math.hypot(m.x - p.x, m.y - p.y) < PORTEE_COMBAT) {
        attaquants++;
        if ((m.def.elite || m.def.boss) && !m.summoner) adv = adv ?? m;
      }
    }
    for (const id of this.etats.keys()) if (!vus.has(id)) this.etats.delete(id);
    Son.setIntensite(Math.min(1, attaquants / 2));
    // 3B : élite ou boss engagé -> musique de combat ; tué -> victoire ; perdu de vue -> l'exploration reprend
    if (adv && !this.adversaire) { this.adversaire = adv; Son.setCombat(true); }
    else if (this.adversaire && !adv) {
      if (this.adversaire.dead) Son.finCombat(true); else if (!p.dead) Son.setCombat(false);
      this.adversaire = null;
    }
    // 7A : fond d'ambiance de l'endroit (une fois par seconde suffit)
    if ((this.fondT -= dt) <= 0) {
      this.fondT = 1;
      const temple = w.area?.name === 'Temple Céleste';
      Son.fond(!w.zone.open ? ['incarnam_vent'] : temple ? ['temple_tuto', 'temple_ethere'] : inside ? ['interieur'] : w.opts.zone === 'astrub' ? ['astrub_vent', 'astrub_oiseaux'] : ['incarnam_vent', 'incarnam']);
    }
    // 7B : sources du décor les plus proches
    const ps = ISO.toScreen(p.x, p.y), proches: Record<string, number> = {};
    for (const e of this.emetteurs) {
      const d = Math.hypot(e.x - ps.x, e.y - ps.y);
      if (d < (proches[e.k] ?? Infinity)) proches[e.k] = d;
    }
    Son.decorProche(inside ? {} : proches, dt);
    Son.update(dt);
  }
}

/** Petits sons synthétisés (carillon du butin, jauge pleine), sur le bus des effets. */
export function synthe(fn: (ctx: AudioContext, out: AudioNode) => void) {
  const s = Son.synth(); if (!s) return;
  try { fn(s.ctx, s.out); } catch { /* son indisponible */ }
}
