import { Entity } from './entity';
import type { MonsterDef, MonsterSpell } from './defs';
import type { Player } from './player';
import type { Bete } from './bete';
/** Ce qu'un monstre poursuit et frappe : le joueur, ou une bête de l'Osamodas (maquette Osamodas 8A). */
export type Cible = Player | Bete;
import type { World } from './world';
import { tackleSlow, tacleOf } from './caracs';
import { DANGER } from './danger';
import AGGRO from '../data/aggro.json';

/** Réglages de poursuite et de retour (src/data/aggro.json, maquette « Aggro » de Mathis). */
export { AGGRO };

/** Dofus -> temps réel : 1 case = CASE px (pas d'une case à sa voisine en diagonale), 1 tour = TOUR s. */
export const CASE = 48, TOUR = 3;
/** Façon de lancer un sort de monstre, déduite de ses données officielles. */
export type CastKind = 'melee' | 'charge' | 'missile' | 'ligne' | 'target' | 'self' | 'invoque';
export function castKind(s: MonsterSpell): CastKind {
  if (s.effects.some(e => e.k === 'invoque')) return 'invoque';
  if (s.po[1] === 0) return 'self';
  if (s.effects.some(e => e.k === 'avance')) return 'charge';
  if (s.missile) return 'missile';
  if (s.zone[0] === 'L' && Number(s.zone.slice(1)) >= 2) return 'ligne';   // zone officielle en ligne (Dégraissage L8 : 8 cases devant lui)
  return s.po[1] <= 1 ? 'melee' : 'target';
}
/** Sort qui ne sert qu'à ses alliés (Frénésie, Bêlement…). Dans les données, « allies » veut dire que le sort touche
 *  AUSSI les alliés (cible « a » = tout le monde) : un sort qui fait des dommages (Flèche de Feu, Glougloutte…) vise d'abord le joueur. */
export function soutienSeul(s: MonsterSpell): boolean { return s.allies && !s.effects.some(e => e.k === 'dmg'); }
/** Rayon touché par la zone du sort : P = la case visée, X / C n = n cases autour. */
export function zoneRadius(s: MonsterSpell): number {
  const n = Number(s.zone.slice(1)) || 0;
  return s.zone[0] === 'P' ? CASE * 0.6 : (n + 0.5) * CASE;
}

/** Longueur (px) d'un sort en ligne : sa portée plus les n cases de sa zone L n, depuis le bord du lanceur. */
export function ligneLen(s: MonsterSpell, radius: number): number { return (Math.max(1, s.po[1]) + (Number(s.zone.slice(1)) || 0)) * CASE + radius; }
/** Le joueur (rayon pr) est-il dans le rectangle qui part de (x, y) vers facing ? */
export function dansRect(px: number, py: number, pr: number, x: number, y: number, facing: number, len: number, w: number): boolean {
  const c = Math.cos(facing), sn = Math.sin(facing), u = (px - x) * c + (py - y) * sn, v = -(px - x) * sn + (py - y) * c;
  return u >= -pr && u <= len + pr && Math.abs(v) <= w / 2 + pr;
}
/** Forme d'une attaque signature de boss (4A) : rectangle devant lui, ou cercle (autour de lui, devant lui ou sur le joueur). */
export type FormeSig = { k: 'rect'; len: number; w: number } | { k: 'cercle'; x: number; y: number; r: number };

/** Monstre à états : spawn -> chase -> windup (télégraphe) -> lunge | slam -> recover.
 *  En monde ouvert, il attend d'abord près de son point de départ (idle, petite errance), poursuit le joueur
 *  qui s'approche, et rentre chez lui s'il l'a perdu (return) : il y garde ses blessures, sauf les boss. */
export class Monster extends Entity {
  readonly faction = 'monster' as const;
  state: 'spawn' | 'idle' | 'return' | 'chase' | 'windup' | 'lunge' | 'recover' = 'spawn';
  /** Point de départ (monde ouvert) et groupe auquel il appartient. */
  homeX: number; homeY: number;
  group = -1;
  private wanderT = 0;
  private wanderX: number; private wanderY: number;
  /** Minuteur de l'état courant (et de l'animation de mort). */
  t = 0.6;
  atkCd: number;
  stun = 0;
  dirX = 1; dirY = 0;
  hitDone = false;
  mode: 'lunge' | 'slam' | 'spell' = 'lunge';
  /** Sort officiel en cours (null : charge simple), son type, le point visé et la relance de chaque sort (s). */
  spell: MonsterSpell | null = null;
  kind: CastKind = 'melee';
  tx = 0; ty = 0;
  spellCd: number[];
  /** Bonus de vitesse (sort qui donne des PM, ex. Bêlement) : multiplicateur et durée restante. */
  haste = 1; hasteT = 0;
  /** Dommages subis augmentés de vuln % pendant vulnT s (Bond). */
  vuln = 0; vulnT = 0;
  /** Supplice (Sacrieur) : pendant suppliceT s, chaque coup du joueur sur ce monstre le soigne de supplice × les dommages. */
  supplice = 0; suppliceT = 0;
  /** Coups qui saignent (légendaire Sacrieur C) : dégâts par seconde, durée restante, dégâts pas encore affichés. */
  saigne = 0; saigneT = 0; saigneAcc = 0;
  /** Portée retirée (cases) à ses sorts à distance pendant poMalusT s (Flèche Détonante). */
  poMalus = 0; poMalusT = 0;
  /** Bonus de Dommages (Frénésie : %, Euphorie malsaine : fixes) et durée restante. */
  furyPct = 0; furyFlat = 0; furyT = 0;
  /** Invocateur (Kardorib invoqué par Kardorim). */
  summoner: Monster | null = null;
  /** Déjà touché par le joueur (l'Initiative ne renforce que le premier coup). */
  struck = false;
  /** Dernière bête de l'Osamodas qui l'a frappé (il la vise en retour, maquette Osamodas 8A). */
  agresseur: number | null = null;
  /** Laine épaisse (Osamodas E) : provoqué par sa bête jusqu'à ce moment (temps du monde). */
  provoqueJusqua = -1;
  /** Légendaires de classe Crâ : Marque du chasseur (+marque % jusqu'à marqueJusqua), Givre mordant (coups récents, dernier gel). */
  marque = 0; marqueJusqua = -1; glaceCoups: number[] = []; gelA = -99; staseA = -99;
  /** Dommages subis × subis pendant subisT s (Cuirasse Laineuse : 0,7). */
  subis = 1; subisT = 0;
  /** Boss (maquette « Danger ») : attaque signature en cours (4A) et sa relance, Furieux sous 50 % des PV (5A), entrée annoncée (7A). */
  sig = false; sigCd = 0; sigF: FormeSig | null = null;
  furieux = false; intro = false;
  /** Aggro (1B, 2B) : temps passé loin du joueur, et temps au calme chez lui (le soin lent ne commence qu'après). */
  perduT = 0; calmeT = 0;
  /** Partie de test : posé par le panneau F1 ; mannequin = immobile et increvable (compteur de DPS, 7D). */
  poseTest = false;
  mannequin = false;
  /** Partie de test (maquette « Outil test » 8B) : le mannequin frappe le perso N fois par seconde (0 : il ne frappe pas). */
  frappe = 0; frappeT = 0;
  /** Arène d'un donjon : arrive en courant vers le joueur et ne lâche jamais ; intouchable = palier du boss (8C). */
  arene = false;
  intouchable = false;

  /** Zone d'une attaque annoncée au sol avant l'impact : seulement pour les élites et les boss (maquette Aperçu 8A, Mathis 2026-11-06). */
  private annonce(world: World, tg: World['telegraphs'][number]) { if (this.def.elite || this.def.boss) world.telegraphs.push(tg); }
  constructor(id: number, readonly type: string, readonly def: MonsterDef, x: number, y: number, world: World) {
    super(id, x, y, def.radius, def.hp);
    this.homeX = this.wanderX = x; this.homeY = this.wanderY = y;
    this.wanderT = world.rng.range(1, 4);
    this.atkCd = world.rng.range(0.3, 1.2);
    this.age = world.rng.next() * 10;
    this.spellCd = (def.spells ?? []).map(() => 0);
    this.sigCd = world.rng.range(2.5, 4.5);
    this.setAnim('spawn');
  }

  update(dt: number, player: Cible, world: World) {
    this.age += dt; this.flash = Math.max(0, this.flash - dt);
    const D = this.def;
    if (this.dead) { this.t -= dt; this.setAnim('die', 1 - this.t / 0.6); this.applyKnock(dt); return; }
    const open = world.zone.open;
    if (this.state === 'spawn') { this.t -= dt; this.setAnim('spawn', 1 - this.t / 0.6); if (this.t <= 0) this.state = open && !this.arene ? 'idle' : 'chase'; return; }
    if (this.mannequin) {
      this.stun = 0; this.kx = this.ky = 0; this.setAnim('idle');
      // 8B : mannequin qui frappe (classes qui se renforcent en prenant des coups) : à portée, des coups de ses dommages normaux
      if (this.frappe > 0 && (this.frappeT -= dt) <= 0 && world.players.includes(player as Player) && Math.hypot(player.x - this.x, player.y - this.y) < 260) {
        this.frappeT = 1 / this.frappe; player.hurt(D.dmg, this.x, this.y, world);
      }
      return;
    }
    if (this.stun > 0) { this.stun -= dt; this.setAnim('stun'); this.applyKnock(dt); if (this.state === 'windup') { this.state = 'chase'; this.sig = false; } if (this.state === 'idle') this.state = 'chase'; return; }
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy) || 1;
    this.atkCd -= dt;
    const rel = this.furieux ? 1 / DANGER.furieux.relance : 1;   // Furieux : relances plus courtes
    for (let i = 0; i < this.spellCd.length; i++) this.spellCd[i] -= dt * rel;
    this.sigCd -= dt * rel;
    if (this.subisT > 0 && (this.subisT -= dt) <= 0) this.subis = 1;
    // 5A : sous la moitié de ses PV, le boss devient Furieux
    if (D.boss && !this.furieux && this.state !== 'idle' && this.state !== 'return' && this.hp <= this.maxHp * DANGER.furieux.seuil) {
      this.furieux = true;
      world.emit({ k: 'furieux', id: this.id, name: D.name, x: this.x, y: this.y });
      world.emit({ k: 'impact', hitstop: 0.06, shake: 0.014, big: true });
    }
    if (this.hasteT > 0 && (this.hasteT -= dt) <= 0) this.haste = 1;
    if (this.vulnT > 0 && (this.vulnT -= dt) <= 0) this.vuln = 0;
    if (this.suppliceT > 0 && (this.suppliceT -= dt) <= 0) this.supplice = 0;
    if (this.poMalusT > 0 && (this.poMalusT -= dt) <= 0) this.poMalus = 0;
    if (this.furyT > 0 && (this.furyT -= dt) <= 0) this.furyPct = this.furyFlat = 0;
    // Tacle du joueur : un monstre à son contact avance moins vite (sa Fuite officielle y résiste)
    const near = Math.hypot(player.x - this.x, player.y - this.y) <= this.radius + player.radius + 12;
    const speed = D.speed * this.haste * (this.furieux ? DANGER.furieux.vitesse : 1) * (near ? 1 - tackleSlow(player.tacle, tacleOf(D.caracs?.fuite ?? 0, D.caracs?.agilite ?? 0)) : 1);
    if (open && this.state !== 'idle' && this.state !== 'return' && this.abandonne(dist, open.leash, player, dt)) {
      this.state = 'return'; this.wanderT = 0; this.calmeT = 0;
      if (!player.dead) world.emit({ k: 'status', x: this.x, y: this.y - 20, text: 'Abandonne', color: '#a89fb6' });   // 7A
    }
    switch (this.state) {
      case 'idle': {
        // arrivée protégée (maquette Entrées 13A) : on ne remarque pas le joueur qui vient de passer une porte
        if (!player.dead && !world.calme && dist < (D.aggro ?? open?.aggro ?? 250)) { world.aggroGroup(this); break; }
        this.regenCalme(dt);
        // Petite errance autour du point de départ
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = world.rng.range(4, 9);   // plus calme : de petits pas, de temps en temps
          const a = world.rng.range(0, Math.PI * 2), r = world.rng.range(0, 45);
          this.wanderX = this.homeX + Math.cos(a) * r; this.wanderY = this.homeY + Math.sin(a) * r;
        }
        if (this.moveTo(this.wanderX, this.wanderY, D.speed * 0.35, dt)) this.setAnim('run'); else this.setAnim('idle');
        break;
      }
      case 'return': {
        // 8A : un boss se soigne en rentrant et repart à neuf ; 2B : les autres gardent leurs blessures
        if (D.boss) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
        this.wanderT -= dt;
        if (this.wanderT < -6) { this.x = this.homeX; this.y = this.homeY; }   // coincé derrière un obstacle
        if (!this.moveTo(this.homeX, this.homeY, D.speed * 1.4, dt, world)) {
          this.state = 'idle'; this.maxHp = this.def.hp; this.struck = false; this.furieux = false; this.intro = false; this.calmeT = 0;
          this.hp = D.boss ? this.maxHp : Math.min(this.hp, this.maxHp);
          this.setAnim('idle');
        }
        else this.setAnim('run');
        break;
      }
      case 'chase': {
        this.facing = Math.atan2(dy, dx);
        if (player.dead) { this.setAnim('idle'); break; }
        if (D.boss && !this.intro) { this.intro = true; world.emit({ k: 'bossIntro', id: this.id, monster: this.type }); }   // 7A
        if (D.spells?.length) {
          if (this.atkCd <= 0 && this.castSpell(dist, player, world)) break;
          // Sans sort au corps à corps, il garde ses distances (à 80 % de sa plus grande portée)
          const far = this.spellReach(player);
          if (far && dist < far * 0.8 && world.clearShot(this, player)) { this.setAnim('idle'); break; }
        } else {
          // Les monstres à piétinement choisissent : piétinement (près) ou charge (loin)
          if (D.slamRange && dist < D.slamRange && this.atkCd <= 0) { this.state = 'windup'; this.mode = 'slam'; this.t = D.slamWindup!; break; }
          const range = D.attackRange + player.radius;
          if (dist < range && this.atkCd <= 0 && (!D.slamRange || dist > D.slamRange)) {
            this.state = 'windup'; this.mode = 'lunge'; this.spell = null; this.t = D.windup; this.dirX = dx / dist; this.dirY = dy / dist; break;
          }
        }
        if (dist > this.radius + player.radius + 4) {
          const [mx, my] = this.evite(...(this.versCible(player.x, player.y, dt, world) ?? this.contourne(dx / dist, dy / dist, dist, player, world)), world);
          const v = speed * this.rattrapage(dist);
          this.x += mx * v * dt; this.y += my * v * dt; this.setAnim('run');
        }
        else this.setAnim('idle');
        break;
      }
      case 'windup': {
        this.t -= dt;
        if (this.mode === 'slam') {
          const k = 1 - this.t / D.slamWindup!;
          this.setAnim('slam_charge', k);
          this.annonce(world, { kind: 'circle', x: this.x, y: this.y, r: D.slamRadius!, progress: k, danger: true });
          if (this.t <= 0) {
            if (Math.hypot(player.x - this.x, player.y - this.y) < D.slamRadius! + player.radius) player.hurt(Math.round(D.dmg * 1.3), this.x, this.y, world);
            world.emit({ k: 'slam', x: this.x, y: this.y, radius: D.slamRadius! });
            world.emit({ k: 'impact', hitstop: 0, shake: 0.012, big: false });
            this.state = 'recover'; this.t = D.recover; this.atkCd = world.rng.range(...DANGER.rythme.pausePietinement as [number, number]);
          }
        } else if (this.mode === 'spell') {
          const S = this.spell!, w = this.sig ? this.sigWindup() : this.windupOf(S), k = 1 - this.t / w;
          this.setAnim(`windup${S.anim}`, k);
          if (this.sig) {
            const F = this.sigF!;
            this.facing = Math.atan2(this.dirY, this.dirX);
            if (F.k === 'rect') world.telegraphs.push({ kind: 'rect', x: this.x, y: this.y, facing: this.facing, len: F.len, w: F.w, progress: k, danger: true });
            else world.telegraphs.push({ kind: 'circle', x: F.x, y: F.y, r: F.r, progress: k, danger: true });
            if (this.t <= 0) this.releaseSignature(player, world);
            break;
          }
          if (this.kind === 'invoque') { /* pas de zone : l'invocation apparaît à son contact */ }
          else if (this.kind === 'target' || this.kind === 'self') {
            if (this.kind === 'self') { this.tx = this.x; this.ty = this.y; }
            if (!soutienSeul(S)) this.annonce(world, { kind: 'circle', x: this.tx, y: this.ty, r: zoneRadius(S), progress: k, danger: true });
          } else {
            this.facing = Math.atan2(this.dirY, this.dirX);
            const len = this.kind === 'charge' ? this.chargeLen(S) + this.radius : this.kind === 'missile' ? this.missileRange(S) : this.kind === 'ligne' ? ligneLen(S, this.radius) : D.lungeSpeed * D.lungeTime + this.radius;
            this.annonce(world, { kind: 'rect', x: this.x, y: this.y, facing: this.facing, len, w: this.kind === 'missile' ? 12 : this.kind === 'ligne' ? CASE * 0.8 : this.radius * 0.9, progress: k, danger: true });
          }
          if (this.t <= 0) this.release(player, world);
        } else {
          const k = 1 - this.t / D.windup;
          this.setAnim('windup', k);
          this.spell = null;
          this.facing = Math.atan2(this.dirY, this.dirX);
          this.annonce(world, { kind: 'rect', x: this.x, y: this.y, facing: this.facing, len: D.lungeSpeed * D.lungeTime + this.radius, w: this.radius * 0.9, progress: k, danger: true });
          if (this.t <= 0) { this.state = 'lunge'; this.t = D.lungeTime; this.hitDone = false; }
        }
        break;
      }
      case 'lunge': {
        const S = this.spell, dur = D.lungeTime, sp = S && this.kind === 'charge' ? this.chargeLen(S) / dur : D.lungeSpeed;
        this.t -= dt; this.setAnim(S ? `lunge${S.anim}` : 'lunge', 1 - this.t / dur);
        this.x += this.dirX * sp * dt; this.y += this.dirY * sp * dt;
        if (!this.hitDone && Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius + 6) {
          this.hitDone = true;
          if (S) {
            world.monsterSpellHits(this, S, player); if (this.kind === 'charge') this.t = 0;
            world.emit({ k: 'spellFx', id: `m${S.id}`, x: player.x, y: player.y, facing: this.facing });
          }
          else player.hurt(D.dmg, this.x, this.y, world);
        }
        if (this.t <= 0) this.endCast(world);
        break;
      }
      case 'recover': {
        this.t -= dt;
        // fin de l'animation du sort à distance après son lancer
        const S = this.spell, after = D.recover - this.t;
        if (S && (this.sig || (this.kind !== 'melee' && this.kind !== 'charge')) && after < 0.35) this.setAnim(`lunge${S.anim}`, after / 0.35);
        else this.setAnim('idle');
        if (this.t <= 0) { this.state = 'chase'; this.sig = false; }
        break;
      }
    }
    this.applyKnock(dt);
  }

  /** Abandon de la poursuite en monde ouvert. 8A : un boss garde sa laisse courte autour de son arène.
   *  1B : les autres ne lâchent que s'ils t'ont perdu (loin de toi assez longtemps), ou au garde-fou loin de chez eux. */
  private abandonne(dist: number, leash: number, player: Cible, dt: number): boolean {
    if (player.dead) return true;
    if (this.arene) return false;
    const home = Math.hypot(this.x - this.homeX, this.y - this.homeY);
    if (this.def.boss) return dist > leash * 1.5 || home > leash;
    if (home > AGGRO.gardeFou * CASE) return true;
    if (dist > AGGRO.perdu.cases * CASE) this.perduT += dt; else this.perduT = 0;
    return this.perduT >= AGGRO.perdu.duree;
  }
  /** 5A : loin du joueur, un monstre accélère (jusqu'à ×1,5) pour garder le paquet groupé ; au contact, sa vitesse officielle. */
  rattrapage(dist: number): number {
    const R = AGGRO.rattrapage, d0 = R.cases * CASE;
    return dist <= d0 ? 1 : Math.min(R.mult, 1 + (R.mult - 1) * (dist - d0) / (R.progressif * CASE));
  }
  /** 2B : chez lui et au calme depuis quelques secondes, il reprend lentement ses PV (2 % par seconde). */
  regenCalme(dt: number) {
    if (this.hp >= this.maxHp) return;
    this.calmeT += dt;
    if (this.calmeT >= AGGRO.soin.calme) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * AGGRO.soin.parSeconde * dt);
  }

  /** Portée d'un sort en pixels (bord à bord). Les sorts au contact gardent la portée de charge du monstre. */
  private reach(S: MonsterSpell, player: Cible): [number, number] {
    const k = castKind(S), pad = this.radius + player.radius;
    if (k === 'invoque') return [0, CASE * 6];
    if (k === 'self') return [0, soutienSeul(S) ? Infinity : zoneRadius(S) + player.radius];
    if (k === 'melee') return [0, this.def.attackRange + player.radius];
    if (k === 'ligne') return [0, ligneLen(S, this.radius) + player.radius];
    return [S.po[0] >= 2 ? S.po[0] * CASE : 0, this.po(S) * CASE + pad];
  }
  /** Plus grande portée d'un sort offensif à distance, si le monstre n'a aucun sort au contact (sinon 0 : il vient au contact). */
  private spellReach(player: Cible): number {
    const S = (this.def.spells ?? []).filter(s => !soutienSeul(s) && castKind(s) !== 'self');
    if (!S.length || S.some(s => s.po[1] <= 1)) return 0;
    return Math.max(...S.map(s => this.reach(s, player)[1]));
  }
  private windupOf(S: MonsterSpell): number {
    const k = castKind(S);
    return k === 'melee' ? this.def.windup : k === 'target' || k === 'self' || k === 'ligne' ? Math.max(0.7, this.def.windup + 0.2) : Math.max(0.55, this.def.windup);
  }
  private chargeLen(S: MonsterSpell): number { return (S.effects.find(e => e.k === 'avance') as { n: number } | undefined ?? { n: 1 }).n * CASE; }
  private missileRange(S: MonsterSpell): number { return (this.po(S) + 0.5) * CASE + this.radius; }
  /** Portée maximale du sort en cases, moins la Portée retirée (jamais sous sa portée minimale, ni sous 1). */
  po(S: MonsterSpell): number { return Math.max(S.po[0], 1, S.po[1] - this.poMalus); }

  /** Choisit un sort utilisable (relance finie, à portée, ligne de vue) et commence à le lancer. */
  private castSpell(dist: number, player: Cible, world: World): boolean {
    const S = this.def.spells!, ok: number[] = [];
    if (this.def.signature != null && this.sigCd <= 0) {
      const s = S.find(x => x.id === this.def.signature);
      const vise = this.joueurProche(world) ?? player, dv = Math.hypot(vise.x - this.x, vise.y - this.y);
      if (s && this.trySignature(s, dv, vise, world)) return true;   // 3B : le grand sort vise le joueur, même si une bête a l'aggro
    }
    S.forEach((s, i) => {
      if (this.spellCd[i] > 0) return;
      const k = castKind(s), [a, b] = this.reach(s, player);
      if (k === 'invoque') {   // une invocation à la fois, quand le joueur est proche
        const max = this.furieux ? DANGER.furieux.invocations : 1;   // Furieux : plus d'invocations à la fois
        if (dist < CASE * 6 && world.monsters.filter(m => m.summoner === this && !m.dead).length < max) ok.push(i);
        return;
      }
      if (soutienSeul(s) && k === 'self') {
        if (s.effects.some(e => e.k === 'dommages')) { if (this.furyT <= 0 && dist < CASE * 4) ok.push(i); }   // Frénésie : juste avant le contact
        else if (this.hasteT <= 0 && dist > CASE * 2) ok.push(i);
        return;
      }
      if (dist < a || dist > b) return;
      if (k !== 'self' && k !== 'melee' && !world.clearShot(this, player)) return;
      ok.push(i);
    });
    if (!ok.length) return false;
    const i = world.rng.pick(ok), s = S[i], dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 1;
    this.spell = s; this.kind = castKind(s); this.sig = false; this.mode = 'spell'; this.state = 'windup'; this.t = this.windupOf(s);
    this.dirX = dx / d; this.dirY = dy / d; this.facing = Math.atan2(dy, dx);
    this.tx = player.x; this.ty = player.y;   // le sort tombe là où était le joueur : on peut l'esquiver
    this.spellCd[i] = Math.max(1, s.relance) * TOUR * 0.5;
    if (this.def.elite || this.def.boss) world.emit({ k: 'monsterCast', id: this.id, name: s.name, x: this.x, y: this.y });
    return true;
  }
  /** Fin de l'incantation : coup au contact (lunge), projectile, ou effet sur la zone visée. */
  private release(player: Cible, world: World) {
    const S = this.spell!;
    if (this.kind === 'melee' || this.kind === 'charge') { this.state = 'lunge'; this.t = this.def.lungeTime; this.hitDone = false; return; }
    if (this.kind === 'invoque') {
      for (const e of S.effects) if (e.k === 'invoque') world.summon(this, e.monster);
    } else if (this.kind === 'missile') {
      world.monsterMissile(this, S, this.missileRange(S));
    } else if (this.kind === 'ligne') {
      const len = ligneLen(S, this.radius), el = (S.effects.find(e => e.k === 'dmg') as { element: string } | undefined)?.element ?? 'neutre';
      if (dansRect(player.x, player.y, player.radius, this.x, this.y, this.facing, len, CASE * 0.8)) world.monsterSpellHits(this, S, player);
      world.emit({ k: 'spell', fx: 'line', id: `m${S.id}`, x: this.x, y: this.y, facing: this.facing, size: len, arc: 0, element: el as never, big: false, boosted: false, ...(this.def.elite || this.def.boss ? {} : { discret: true }) });
    } else {
      const r = zoneRadius(S), el = (S.effects.find(e => e.k === 'dmg') as { element: string } | undefined)?.element ?? 'neutre';
      // Boost d'alliés : sa zone officielle (ex. C63 = tout le combat) devient son groupe, à portée de voix
      const vis = Math.min(r, CASE * 3);   // l'effet dessiné reste autour du lanceur, jamais sur toute la carte
      if (S.allies) {
        for (const m of world.monsters) if (!m.dead && (m === this || (m.group >= 0 && m.group === this.group) || m.summoner === this)
          && Math.hypot(m.x - this.tx, m.y - this.ty) <= Math.min(r, CASE * 8) + m.radius) world.monsterSpellBuff(m, S);
      }
      if (!soutienSeul(S) && Math.hypot(player.x - this.tx, player.y - this.ty) <= r + player.radius) world.monsterSpellHits(this, S, player);
      // Monstre de base : pas de cercle de zone ni de nom de sort, seulement l'éclat de l'impact (comme 8A)
      const zone = this.def.elite || this.def.boss;
      if (zone && this.kind === 'self' && !soutienSeul(S)) world.emit({ k: 'slam', x: this.tx, y: this.ty, radius: vis });
      world.emit({ k: 'spell', fx: 'burst', id: `m${S.id}`, x: this.tx, y: this.ty, facing: 0, size: soutienSeul(S) ? this.radius * 2 : vis, arc: 0, element: el as never, big: false, boosted: false, ...(zone ? {} : { discret: true }) });
    }
    this.endCast(world);
  }
  /** 4A : forme de l'attaque signature, prise dans la zone officielle du sort puis agrandie. null : le joueur est hors de portée. */
  private formeSignature(S: MonsterSpell, dist: number, player: Cible): FormeSig | null {
    const Z = DANGER.signature.zone, k = castKind(S), n = Number(S.zone.slice(1)) || 0;
    if (k === 'invoque' || !S.effects.some(e => e.k === 'dmg')) return null;   // il faut des dommages (Kankroulahoup soigne ses alliés ET brûle autour)
    if (S.zone[0] === 'L') {   // ligne officielle, allongée
      const len = (Math.max(1, S.po[1]) + Math.max(1, n)) * CASE * Z + this.radius;
      return dist <= len * 0.9 ? { k: 'rect', len, w: CASE * Z } : null;
    }
    if (k === 'self') { const r = zoneRadius(S) * Z; return dist <= r * 0.9 ? { k: 'cercle', x: this.x, y: this.y, r } : null; }
    if (S.po[1] <= 1) {   // coup au contact : grand cercle juste devant lui
      const r = (Math.max(1, n) + 0.5) * CASE * Z, d = this.radius + r * 0.5;
      if (dist > d + r * 0.8) return null;
      return { k: 'cercle', x: this.x + this.dirX * d, y: this.y + this.dirY * d, r };
    }
    const [a, b] = this.reach(S, player);   // sort à distance : grand cercle là où est le joueur
    return dist >= a && dist <= b ? { k: 'cercle', x: player.x, y: player.y, r: Math.max(zoneRadius(S), CASE) * Z } : null;
  }
  /** Joueur vivant le plus proche (multi : n'importe lequel des joueurs). */
  private joueurProche(world: World): Cible | null {
    let best: Cible | null = null, bd = Infinity;
    for (const q of world.players) { if (q.dead) continue; const d = Math.hypot(q.x - this.x, q.y - this.y); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  private sigWindup(): number { return DANGER.signature.telegraphe * (this.furieux ? 0.85 : 1); }
  private trySignature(S: MonsterSpell, dist: number, player: Cible, world: World): boolean {
    const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 1;
    this.dirX = dx / d; this.dirY = dy / d;
    const F = this.formeSignature(S, dist, player);
    if (!F) return false;
    this.spell = S; this.kind = castKind(S); this.sig = true; this.sigF = F; this.mode = 'spell'; this.state = 'windup';
    this.t = this.sigWindup(); this.facing = Math.atan2(dy, dx);
    this.sigCd = DANGER.signature.relance;
    world.emit({ k: 'monsterCast', id: this.id, name: S.name, x: this.x, y: this.y });
    return true;
  }
  /** Impact de la signature : tout ce qui est dans la zone annoncée prend les dégâts ×2,5. Puis une fenêtre pour riposter. */
  private releaseSignature(player: Cible, world: World) {
    const S = this.spell!, F = this.sigF!, el = (S.effects.find(e => e.k === 'dmg') as { element: string } | undefined)?.element ?? 'neutre';
    const dans = (c: Cible) => F.k === 'rect' ? dansRect(c.x, c.y, c.radius, this.x, this.y, this.facing, F.len, F.w)
      : Math.hypot(c.x - F.x, c.y - F.y) <= F.r + c.radius;
    // 3B : tous les joueurs dans la zone annoncée prennent le coup, et la bête visée si c'en est une
    const cibles = new Set<Cible>(world.players.filter(q => !q.dead));
    if (!world.players.includes(player as never)) cibles.add(player);
    for (const c of cibles) if (dans(c)) world.monsterSpellHits(this, S, c, DANGER.signature.degats);
    if (F.k === 'rect') world.emit({ k: 'spell', fx: 'line', id: `m${S.id}`, x: this.x, y: this.y, facing: this.facing, size: F.len, arc: 0, element: el as never, big: true, boosted: false });
    else {
      world.emit({ k: 'slam', x: F.x, y: F.y, radius: F.r });
      world.emit({ k: 'spell', fx: 'burst', id: `m${S.id}`, x: F.x, y: F.y, facing: 0, size: F.r, arc: 0, element: el as never, big: true, boosted: false });
    }
    world.emit({ k: 'impact', hitstop: 0.1, shake: 0.022, big: true });
    this.state = 'recover'; this.t = this.def.recover + DANGER.signature.repos; this.atkCd = world.rng.range(0.6, 1.1);
  }
  /** 2A : près du joueur, un monstre bloqué derrière un autre déjà plus proche fait un pas de côté pour l'encercler. */
  private contourne(ux: number, uy: number, dist: number, player: Cible, world: World): [number, number] {
    if (dist > DANGER.rythme.encerclement) return [ux, uy];
    const o = world.monsters.find(o => o !== this && !o.dead && Math.hypot(o.x - this.x, o.y - this.y) < this.radius + o.radius + 18
      && Math.hypot(player.x - o.x, player.y - o.y) < dist);
    if (!o) return [ux, uy];
    const px = -uy, py = ux, side = (o.x - this.x) * px + (o.y - this.y) * py >= 0 ? -1 : 1;
    const vx = ux * 0.4 + px * side * 0.9, vy = uy * 0.4 + py * side * 0.9, n = Math.hypot(vx, vy) || 1;
    return [vx / n, vy / n];
  }
  /** Évitement : un monstre qui en voit un autre devant lui fait un pas de côté (et s'en écarte un peu)
   *  au lieu de lui rentrer dedans et de se faire repousser. Ceux de derrière sont ignorés. */
  private evite(ux: number, uy: number, world: World): [number, number] {
    const E = DANGER.rythme.evitement, px = -uy, py = ux;
    let ax = 0, ay = 0;
    for (const o of world.monsters) {
      if (o === this || o.dead) continue;
      const reach = this.radius + o.radius + E.vue, dx = o.x - this.x, dy = o.y - this.y;
      if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= reach) continue;
      const devant = (dx * ux + dy * uy) / d;
      if (devant < -0.2) continue;
      const w = (1 - d / reach) * (0.5 + 0.5 * Math.max(0, devant)), cote = dx * px + dy * py;
      const s = Math.abs(cote) > 1 ? (cote > 0 ? -1 : 1) : (this.id % 2 ? 1 : -1);
      ax += px * s * w - (dx / d) * w * 0.5; ay += py * s * w - (dy / d) * w * 0.5;
    }
    if (!ax && !ay) return [ux, uy];
    const vx = ux + ax * E.force, vy = uy + ay * E.force, n = Math.hypot(vx, vy) || 1;
    return [vx / n, vy / n];
  }
  private endCast(world: World) { this.state = 'recover'; this.t = this.def.recover; this.atkCd = world.rng.range(...DANGER.rythme.pause as [number, number]); }

  /** Avance vers (x, y) ; false si déjà arrivé. Avec world, contourne le décor (chemin A*). */
  private moveTo(x: number, y: number, speed: number, dt: number, world?: World): boolean {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 6) return false;
    const st = Math.min(d, speed * dt), dir = world ? this.versCible(x, y, dt, world) : null;
    const [ux, uy] = world ? this.evite(...(dir ?? [dx / d, dy / d]), world) : dir ?? [dx / d, dy / d];
    this.x += ux * st; this.y += uy * st; this.facing = Math.atan2(uy, ux);
    return true;
  }

  /** Chemin à pied autour du décor (points de passage) et quand le recalculer. */
  private chemin: { x: number; y: number }[] = [];
  private cheminT = 0; private cheminX = 0; private cheminY = 0;
  /** Coût maximal d'un calcul de chemin de monstre (cases explorées). */
  static readonly CHEMIN_MAX = 2500;
  /** Marge (px) gardée avec le décor quand il le contourne : il ne frotte plus les coins (Mathis, 2026-11-07). */
  static readonly MARGE = 12;
  /** Le décor (autel, coffre, arbre, mur…) barre la ligne droite vers (tx, ty) : direction du prochain point d'un chemin A*
   *  qui le contourne, recalculé régulièrement ou quand la cible a bougé. null = la voie est libre, on va tout droit. */
  private versCible(tx: number, ty: number, dt: number, world: World): [number, number] | null {
    const libre = (b: { x: number; y: number }) => world.map.clearLineLarge(this, b, Monster.MARGE);
    if (libre({ x: tx, y: ty })) { this.chemin.length = 0; return null; }
    this.cheminT -= dt;
    if (!this.chemin.length || this.cheminT <= 0 || Math.hypot(tx - this.cheminX, ty - this.cheminY) > CASE) {
      this.chemin = world.map.findPath(this, { x: tx, y: ty }, Monster.CHEMIN_MAX, Monster.MARGE);
      this.cheminX = tx; this.cheminY = ty;
      this.cheminT = 0.4 + (this.id % 5) * 0.06;   // décalés d'un monstre à l'autre : pas tous les calculs à la même image
    }
    // on passe au point suivant quand on touche le point courant ou qu'on voit déjà le suivant
    while (this.chemin.length > 1 && (Math.hypot(this.chemin[0].x - this.x, this.chemin[0].y - this.y) < 10 || libre(this.chemin[1]))) this.chemin.shift();
    const q = this.chemin[0];
    if (!q) return null;
    const ux = q.x - this.x, uy = q.y - this.y, n = Math.hypot(ux, uy);
    if (n < 1) { this.chemin.shift(); return null; }
    return [ux / n, uy / n];
  }
}
