import Phaser from 'phaser';
import { GAME_DATA } from '../sim/data';
import { GridMap, WorldGrid, type MapData, type WorldData } from '../sim/gridmap';
import { ISO } from '../sim/iso';
import type { PlayerInput } from '../sim/input';
import type { SkillId } from '../sim/defs';
import type { Entity } from '../sim/entity';
import { World } from '../sim/world';
import { EntityView } from './entityView';
import { FX } from './fx';
import { Hud } from './hud';
import { LOOKS } from './looks';
import { drawMap } from './mapView';
import { WorldView } from './worldView';

const ASSETS = 'assets';
const mapDir = ([x, y]: [number, number]) => `${ASSETS}/cartes/${x}_${y}`;
const worldDir = (w: string) => `${ASSETS}/mondes/${w}`;
const hex = (c: string) => parseInt(c.replace('#', ''), 16);

/** Scène d'une zone : charge la carte et les planches de la zone, fait tourner la simulation
 *  à pas fixe, et dessine son état. Toute la logique de jeu est dans World (src/sim). */
export class ZoneScene extends Phaser.Scene {
  private zoneId = 'incarnam';
  private world!: World;
  private worldView: WorldView | null = null;
  private views = new Map<number, EntityView>();
  private fx!: FX;
  private hud!: Hud;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pressed: SkillId | null = null;
  private potion = false;
  private hitstop = 0;
  private acc = 0;
  private static readonly STEP = 1 / 60;

  constructor() { super('zone'); }

  init(data: { zone?: string }) {
    // #astrub dans l'adresse : l'ancienne zone à vagues des Champs d'Astrub
    if (data?.zone) this.zoneId = data.zone;
    else if (location.hash === '#astrub') this.zoneId = 'champs-astrub';
    this.views = new Map(); this.worldView = null; this.pressed = null; this.potion = false; this.hitstop = 0; this.acc = 0;
  }

  preload() {
    Hud.preload(this);
    const zone = GAME_DATA.zones[this.zoneId];
    // On ne charge que les planches utiles à cette zone
    const types = new Set<string>();
    if (zone.open) for (const s of Object.values(zone.open.subareas)) s.monsters.forEach(m => types.add(m));
    else {
      const w = zone.waves!;
      [...w.pack.map(p => p.monster), w.boss, ...w.escort.monsters, ...w.archimonstres.monsters].forEach(m => types.add(m));
    }
    const atlases = new Set(['iop', ...[...types].map(t => LOOKS[GAME_DATA.monsters[t].look].atlas)]);
    for (const a of atlases) if (!this.textures.exists(a)) this.load.atlas(a, `${ASSETS}/sprites/${a}.webp`, `${ASSETS}/sprites/${a}.json`);
    if (zone.open) {
      // Monde ouvert : monde.json décrit les cartes ; on ne charge d'abord que le ciel et les cartes autour du départ,
      // les autres se chargent en jeu quand le joueur approche (WorldView)
      const open = zone.open, dir = worldDir(open.world);
      this.load.json(WorldView.key(open.world, 'monde'), `${dir}/monde.json`);
      this.load.once(`filecomplete-json-${WorldView.key(open.world, 'monde')}`, (_: string, __: string, data: WorldData) =>
        WorldView.preload(this, data, dir, open.world, open.start));
      return;
    }
    const dir = mapDir(zone.map!.coords), key = dir.replace(/\W/g, '_');
    this.load.json(`${key}_carte`, `${dir}/carte.json`);
    this.load.image(`${key}_sol`, `${dir}/sol.webp`);
    this.load.atlas(`${key}_decor`, `${dir}/decor.webp`, `${dir}/decor.json`);
  }

  create() {
    const zone = GAME_DATA.zones[this.zoneId], seed = (Math.random() * 2 ** 32) >>> 0;
    this.input.mouse?.disableContextMenu();
    if (zone.open) {
      const open = zone.open;
      const wg = new WorldGrid(this.cache.json.get(WorldView.key(open.world, 'monde')) as WorldData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map: wg, seed });
      this.cameras.main.setBackgroundColor('#0d2b36');   // sous le ciel, au cas où il manque
      this.worldView = new WorldView(this, wg, worldDir(open.world), open.world);
      this.worldView.create();
    } else {
      const key = mapDir(zone.map!.coords).replace(/\W/g, '_');
      const map = new GridMap(this.cache.json.get(`${key}_carte`) as MapData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map, seed });
      this.cameras.main.setBackgroundColor('#12141b');
      drawMap(this, map, `${key}_sol`, `${key}_decor`);
    }
    this.fx = new FX(this, t => hex(GAME_DATA.monsters[t].color));
    this.hud = new Hud(this);
    this.cameras.main.startFollow(this.viewOf(this.world.player).sprite, true, 0.12, 0.12, 0, 30);
    this.bindInput();
  }

  private bindInput() {
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard!;
    // ZQSD (AZERTY), WASD (QWERTY) et flèches
    this.keys = kb.addKeys({ W: K.W, Z: K.Z, A: K.A, Q: K.Q, S: K.S, D: K.D, UP: K.UP, DOWN: K.DOWN, LEFT: K.LEFT, RIGHT: K.RIGHT,
      SPACE: K.SPACE, R: K.R, E: K.E, F: K.F, H: K.H, ENTER: K.ENTER, ONE: K.ONE, TWO: K.TWO }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pressed = p.rightButtonDown() ? 'epee' : 'attaque'; });
    this.keys.SPACE.on('down', () => { this.pressed = 'bond'; });
    this.keys.R.on('down', () => { this.pressed = 'colere'; });
    this.keys.E.on('down', () => { this.potion = true; });
    this.keys.ONE.on('down', () => { this.pressed = 'epee'; });
    this.keys.TWO.on('down', () => { this.pressed = 'colere'; });
    this.keys.F.on('down', () => {
      this.fx.juice = !this.fx.juice;
      this.hud.toast(this.fx.juice ? 'Effets d\'impact : ACTIVÉS' : 'Effets d\'impact : DÉSACTIVÉS (compare !)');
    });
    this.keys.H.on('down', () => this.hud.toggleHelp());
    this.keys.ENTER.on('down', () => {
      if (!this.world.over) return;
      if (this.world.zone.open) this.world.respawnPlayer();
      else this.scene.restart({ zone: this.zoneId });
    });
  }

  private readInput(): PlayerInput {
    const k = this.keys;
    let sx = 0, sy = 0;
    if (k.W.isDown || k.Z.isDown || k.UP.isDown) sy -= 1;
    if (k.S.isDown || k.DOWN.isDown) sy += 1;
    if (k.A.isDown || k.Q.isDown || k.LEFT.isDown) sx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) sx += 1;
    const move = sx || sy ? ISO.dirFromScreen(sx, sy) : { x: 0, y: 0 };
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const input = { move, aim: ISO.toWorld(wp.x, wp.y), pressed: this.pressed, holdAttack: ptr.leftButtonDown(), potion: this.potion };
    this.pressed = null; this.potion = false;
    return input;
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.fx.update(dt);
    // GEL D'IMAGE : la simulation s'arrête, l'affichage continue (tremblement, chiffres)
    if (this.hitstop > 0) { this.hitstop -= dt; this.render(); return; }
    // Pas fixe : même résultat quelle que soit la fréquence de l'écran (indispensable pour la coop)
    this.acc += dt;
    if (this.acc < ZoneScene.STEP) { this.render(); return; }   // écran > 60 Hz : on garde la touche pour le prochain pas
    let input = this.readInput();
    while (this.acc >= ZoneScene.STEP && this.hitstop <= 0) {
      this.acc -= ZoneScene.STEP;
      this.world.step(ZoneScene.STEP, input);
      input = { ...input, pressed: null, potion: false };
      this.consumeEvents();
    }
    if (this.hitstop > 0) this.acc = 0;
    this.render();
  }

  private consumeEvents() {
    for (const e of this.world.drainEvents()) {
      this.fx.handle(e);
      const M = GAME_DATA.monsters;
      switch (e.k) {
        case 'impact':
          if (!this.fx.juice) break;
          if (e.hitstop > 0) this.hitstop = Math.max(this.hitstop, e.hitstop);
          if (e.shake > 0) this.cameras.main.shake(e.big ? 220 : 110, e.shake, true);
          break;
        case 'playerHurt': this.hud.hurtFlash(this.fx.juice); break;
        case 'wave':
          this.hud.onWave(e.n);
          this.hud.banner(e.boss ? `Vague ${e.n}\n${M[e.boss].name}` : e.archi ? `Vague ${e.n}\nArchimonstre : ${M[e.archi].name} !` : `Vague ${e.n}`);
          break;
        case 'potion': this.hud.potionDrunk(); break;
        case 'noResource': this.hud.noResource(e.res); break;
        case 'levelUp': this.hud.banner(`Niveau ${e.level} !`, 1200); break;
        case 'bossDown': this.hud.banner(`${M[e.monster].name} vaincu !`); break;
        case 'playerDeath':
          if (this.world.zone.open) this.hud.banner('Vaincu\nEntrée pour revenir au départ', 0, true);
          else this.hud.banner(`Vaincu à la vague ${e.wave}\nEntrée pour recommencer`, 0, true);
          break;
        case 'groupCleared': this.hud.onWave(2); break;
        case 'respawn': this.hud.banner('De retour !', 900); break;
        case 'enterArea': this.hud.banner(`${e.name}\nNiveau ${e.level}`, 1600); break;
      }
    }
  }

  private viewOf(e: Entity): EntityView {
    let v = this.views.get(e.id);
    if (!v) {
      const look = e.faction === 'player' ? LOOKS.iop : LOOKS[GAME_DATA.monsters[(e as { type?: string }).type!].look];
      v = new EntityView(this, look);
      this.views.set(e.id, v);
    }
    return v;
  }

  private render() {
    const w = this.world, alive = new Set<number>(), wv = this.worldView, wg = w.worldGrid;
    wv?.update(w.player.x, w.player.y);
    for (const e of [w.player, ...w.monsters]) {
      // monde ouvert : on n'affiche que les monstres des cartes chargées (les autres vivent quand même dans la simulation)
      if (wv && wg && e !== w.player && !wv.isReady(wg.mapAt(e.x, e.y)?.tag)) continue;
      this.viewOf(e).sync(e); alive.add(e.id);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { v.destroy(); this.views.delete(id); }
    const s = w.player.skill;
    if (s?.id === 'colere' && s.t < s.def.impactAt) this.fx.chargeSparks(w.player.x, w.player.y);
    this.fx.draw(w.telegraphs);
    this.hud.draw(w, this.fx.juice, this.game.loop.delta / 1000);
  }
}
