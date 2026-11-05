import { v } from './assetUrl';
import Phaser from 'phaser';
import { GAME_DATA, ITEMS } from '../sim/data';
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
import { ICON_SHEET, iconFrame } from './icons';
import { Windows } from './windows';
import { spellTipHtml } from './spellTip';
import { RARITY_COLORS, RARITY_NAMES, rollItem } from '../sim/items';

const ASSETS = 'assets';
const mapDir = ([x, y]: [number, number]) => `${ASSETS}/cartes/${x}_${y}`;
const worldDir = (w: string) => `${ASSETS}/mondes/${w}`;
const hex = (c: string) => parseInt(c.replace('#', ''), 16);

/** Scène d'une zone : charge la carte et les planches de la zone, fait tourner la simulation
 *  à pas fixe, et dessine son état. Toute la logique de jeu est dans World (src/sim). */
export class ZoneScene extends Phaser.Scene {
  private zoneId = 'incarnam';
  /** Classe jouée (#cra dans l'adresse, ou touche K pour changer). */
  private classId = 'iop';
  private world!: World;
  private worldView: WorldView | null = null;
  private views = new Map<number, EntityView>();
  private fx!: FX;
  private hud!: Hud;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pressed: SkillId | null = null;
  private potion = false;
  private hitstop = 0;
  private windows: Windows | null = null;
  /** Butin au sol : icône + nom de l'objet, couleur de sa rareté. */
  private dropViews = new Map<number, { icon: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse; beam?: Phaser.GameObjects.Image; core?: Phaser.GameObjects.Image }>();
  /** Objet au sol cliqué (à ramasser). */
  private pickClick: number | null = null;
  private acc = 0;
  /** Le clic en cours a commencé sur l'interface : maintenir le bouton ne fait pas attaquer. */
  private uiClick = false;
  /** Bouton gauche enfoncé depuis un clic DANS le jeu (Phaser voit aussi les clics sur les fenêtres HTML). */
  private holding = false;
  /** Clic gauche en cours : sur le sol, sur un monstre, ou attaque sur place (Maj). */
  private clickMode: 'ground' | 'target' | 'place' | null = null;
  private clickTarget: number | null = null;
  private clickDest = false;
  /** Zoom voulu (molette) ; la caméra le rejoint en douceur. */
  private zoom = 1;
  static readonly ZOOM: [number, number] = [0.7, 1.5];
  private static readonly STEP = 1 / 60;

  constructor() { super('zone'); }

  init(data: { zone?: string; classe?: string }) {
    this.classId = data?.classe ?? (location.hash.includes('cra') ? 'cra' : 'iop');
    // #astrub dans l'adresse : l'ancienne zone à vagues des Champs d'Astrub
    if (data?.zone) this.zoneId = data.zone;
    else if (location.hash === '#astrub') this.zoneId = 'champs-astrub';
    this.views = new Map(); this.dropViews = new Map(); this.worldView = null; this.pressed = null; this.potion = false; this.hitstop = 0; this.acc = 0;
  }

  preload() {
    Hud.preload(this);
    // Icônes des objets officiels : une seule planche
    if (!this.textures.exists('kamas_tas')) this.load.image('kamas_tas', v(`${ASSETS}/ui/inv/kamas.png`));
    if (!this.textures.exists(ICON_SHEET.key)) this.load.spritesheet(ICON_SHEET.key, v(`${ASSETS}/${ICON_SHEET.url}`), { frameWidth: ICON_SHEET.cell, frameHeight: ICON_SHEET.cell });
    const zone = GAME_DATA.zones[this.zoneId];
    // On ne charge que les planches utiles à cette zone
    const types = new Set<string>();
    if (zone.open) for (const s of Object.values(zone.open.subareas)) s.monsters.forEach(m => types.add(m));
    else {
      const w = zone.waves!;
      [...w.pack.map(p => p.monster), w.boss, ...w.escort.monsters, ...w.archimonstres.monsters].forEach(m => types.add(m));
    }
    const looks = [LOOKS[this.classId], ...[...types].map(t => LOOKS[GAME_DATA.monsters[t].look])];
    const seen = new Set<string>();
    for (const L of looks) {
      const a = L.atlas;
      if (this.textures.exists(a) || seen.has(a)) continue;
      seen.add(a);
      if (L.multi) this.load.multiatlas(a, v(`${ASSETS}/sprites/${a}.json`), `${ASSETS}/sprites/`);
      else this.load.atlas(a, v(`${ASSETS}/sprites/${a}.webp`), v(`${ASSETS}/sprites/${a}.json`));
    }
    if (zone.open) {
      // Monde ouvert : monde.json décrit les cartes ; on ne charge d'abord que le ciel et les cartes autour du départ,
      // les autres se chargent en jeu quand le joueur approche (WorldView)
      const open = zone.open, dir = worldDir(open.world);
      this.load.json(WorldView.key(open.world, 'monde'), v(`${dir}/monde.json`));
      this.load.once(`filecomplete-json-${WorldView.key(open.world, 'monde')}`, (_: string, __: string, data: WorldData) =>
        WorldView.preload(this, data, dir, open.world, open.start));
      return;
    }
    const dir = mapDir(zone.map!.coords), key = dir.replace(/\W/g, '_');
    this.load.json(`${key}_carte`, v(`${dir}/carte.json`));
    this.load.image(`${key}_sol`, v(`${dir}/sol.webp`));
    this.load.atlas(`${key}_decor`, v(`${dir}/decor.webp`), v(`${dir}/decor.json`));
  }

  create() {
    const zone = GAME_DATA.zones[this.zoneId], seed = (Math.random() * 2 ** 32) >>> 0;
    this.input.mouse?.disableContextMenu();
    // Deux caméras : celle du jeu (zoom à la molette) et celle de l'interface (jamais zoomée).
    // Tout objet ajouté à la scène est ignoré par la caméra d'interface, sauf l'interface elle-même (Hud).
    const ui = this.cameras.add(0, 0, this.scale.width, this.scale.height).setName('ui');
    this.scale.on('resize', (sz: Phaser.Structs.Size) => ui.setSize(sz.width, sz.height));
    const onAdd = (o: Phaser.GameObjects.GameObject) => ui.ignore(o);
    this.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    this.events.once('shutdown', () => this.sys.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd));
    this.zoom = 1; this.cameras.main.setZoom(1);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoom = Phaser.Math.Clamp(this.zoom * (dy > 0 ? 0.9 : 1.1), ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]);
    });
    if (zone.open) {
      const open = zone.open;
      const wg = new WorldGrid(this.cache.json.get(WorldView.key(open.world, 'monde')) as WorldData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map: wg, seed, classId: this.classId, items: ITEMS });
      this.cameras.main.setBackgroundColor('#0d2b36');   // sous le ciel, au cas où il manque
      this.worldView = new WorldView(this, wg, worldDir(open.world), open.world);
      this.worldView.create();
    } else {
      const key = mapDir(zone.map!.coords).replace(/\W/g, '_');
      const map = new GridMap(this.cache.json.get(`${key}_carte`) as MapData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map, seed, classId: this.classId, items: ITEMS });
      this.cameras.main.setBackgroundColor('#12141b');
      drawMap(this, map, `${key}_sol`, `${key}_decor`);
    }
    this.fx = new FX(this, t => hex(GAME_DATA.monsters[t].color));
    this.hud = new Hud(this, this.world);
    const mini = this.cameras.getCamera('mini');
    if (mini && this.worldView?.sky) mini.ignore(this.worldView.sky);
    this.windows?.destroy();
    this.windows = new Windows(this.world);
    this.windows.portrait = v(`${ASSETS}/ui/perso_${this.classId}.png`);   // rendu en grand (perso_planche : render.cjs échelle 2,2)
    this.events.once('shutdown', () => { this.windows?.destroy(); this.windows = null; });
    this.hud.onSlotHover = (id, x, y) => {
      if (!id) { this.windows?.hideTip(); return; }
      const r = this.game.canvas.getBoundingClientRect();
      this.windows?.showHtmlTip(spellTipHtml(this.world.player, id), r.left + x, r.top + y);
    };
    this.hud.onMenu = name => {
      if (name === 'Inventaire') this.windows!.toggle('inv');
      else if (name === 'Caractéristiques') this.windows!.toggle('car');
      else this.hud.toast(`${name} : arrive dans une prochaine version`);
    };
    this.cameras.main.startFollow(this.viewOf(this.world.player).sprite, true, 0.12, 0.12, 0, 30);
    this.bindInput();
    // Accès console / tests automatisés (captures) : la partie et le tirage d'objets
    (window as unknown as { diablofus: unknown }).diablofus = { scene: this, world: this.world, rollItem, ITEMS };
  }

  private bindInput() {
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard!;
    // Déplacement à la souris (clic gauche) ; le clavier sert aux sorts, à la potion et aux menus
    this.keys = kb.addKeys({ SHIFT: K.SHIFT, ALT: K.ALT,
      SPACE: K.SPACE, E: K.E, K: K.K, I: K.I, C: K.C, ESC: K.ESC, F: K.F, H: K.H, ENTER: K.ENTER,
      ONE: K.ONE, TWO: K.TWO, THREE: K.THREE, FOUR: K.FOUR, FIVE: K.FIVE, SIX: K.SIX }) as Record<string, Phaser.Input.Keyboard.Key>;
    const cls = this.world.player.cls;
    // Façon Diablo (demande de Mathis, 2026-11-05) : clic gauche sur le sol = y aller (maintenu : suivre le curseur),
    // sur un monstre = s'approcher et l'attaquer (maintenu : continuer), Maj + clic gauche = attaquer sur place ;
    // clic droit = sort favori, Espace = déplacement, 1 à 6 (& é " ' ( - en AZERTY) = barre de sorts.
    // Un clic sur l'interface (barre, mini-carte, menus, fiches) ne fait rien en jeu.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length || this.hud.blocks(p.x, p.y)) { this.uiClick = true; return; }
      this.uiClick = false;
      if (p.rightButtonDown()) { this.pressed = cls.favorite; return; }
      this.holding = true;
      if (this.keys.SHIFT.isDown) { this.pressed = 'attaque'; this.clickMode = 'place'; return; }
      const d = this.dropUnder(p);
      if (d != null) { this.pickClick = d; this.clickMode = null; this.holding = false; return; }
      const m = this.monsterUnder(p);
      this.clickMode = m ? 'target' : 'ground';
      this.clickTarget = m?.id ?? null;
      if (!m) this.moveMarker(p);
    });
    const release = () => { this.holding = false; };
    window.addEventListener('pointerup', release);
    this.events.once('shutdown', () => window.removeEventListener('pointerup', release));
    this.keys.SPACE.on('down', () => { this.pressed = cls.mobility; });
    this.keys.E.on('down', () => { this.potion = true; });
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => this.keys[k].on('down', () => { if (cls.bar[i]) this.pressed = cls.bar[i]; }));
    this.keys.F.on('down', () => {
      this.fx.juice = !this.fx.juice;
      this.hud.toast(this.fx.juice ? 'Effets d\'impact : ACTIVÉS' : 'Effets d\'impact : DÉSACTIVÉS (compare !)');
    });
    this.keys.H.on('down', () => this.hud.toggleHelp());
    // I ou C : fenêtre Personnage (inventaire + caractéristiques) ; le jeu continue derrière
    this.keys.I.on('down', () => this.windows?.toggle('inv'));
    this.keys.C.on('down', () => this.windows?.toggle('car'));
    this.keys.ESC.on('down', () => this.windows?.close());
    // K : changer de classe (en attendant l'écran de création de la 0.1b)
    this.keys.K.on('down', () => this.scene.restart({ zone: this.zoneId, classe: this.classId === 'iop' ? 'cra' : 'iop' }));
    this.keys.ENTER.on('down', () => {
      if (!this.world.over) return;
      if (this.world.zone.open) this.world.respawnPlayer();
      else this.scene.restart({ zone: this.zoneId });
    });
  }

  /** Objet au sol (Magique et plus, affiché) sous le curseur. */
  private dropUnder(ptr: Phaser.Input.Pointer): number | null {
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    for (const [uid, v] of this.dropViews) {
      if (!v.icon.visible || !v.label) continue;
      if (v.icon.getBounds().contains(wp.x, wp.y) || (v.label.visible && v.label.getBounds().contains(wp.x, wp.y))) return uid;
    }
    return null;
  }
  /** Petit carillon (synthétisé, pas de fichier) quand un objet Rare ou Légendaire tombe (choix 3D). */
  private chime(legendary: boolean) {
    try {
      const A = (this.sound as unknown as { context?: AudioContext }).context;
      if (!A) return;
      const notes = legendary ? [784, 988, 1319, 1568] : [880, 1175];
      notes.forEach((f, i) => {
        const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
        o.connect(g).connect(A.destination); o.start(t0); o.stop(t0 + 0.65);
      });
    } catch { /* son indisponible */ }
  }

  /** Monstre sous le curseur : on vise le corps dessiné (rectangle rogné de la frame), ou à défaut ses pieds ;
   *  s'il y en a plusieurs, le plus proche du curseur. */
  private monsterUnder(ptr: Phaser.Input.Pointer) {
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    let best: Entity | null = null, bd = Infinity;
    for (const m of this.world.monsters) {
      if (m.dead) continue;
      const v = this.views.get(m.id); if (!v) continue;
      const s = ISO.toScreen(m.x, m.y), feet = Math.hypot((s.x - wp.x) / 1.6, s.y - wp.y);
      const body = v.hit(wp.x, wp.y);
      const d = body >= 0 ? body : feet < m.radius + 10 ? feet : -1;
      if (d >= 0 && d < bd) { bd = d; best = m; }
    }
    return best;
  }
  /** Nom du sort officiel au-dessus du monstre qui le lance. */
  private castName(id: number, name: string) {
    const v = this.views.get(id); if (!v) return;
    const b = v.sprite, top = b.y - v.look.height * v.look.scale - 14;
    const t = this.add.text(b.x, top, name, { fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: '#ffd9a0', stroke: '#1a0f0a', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(1e6);
    this.tweens.add({ targets: t, y: top - 18, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }
  /** Petit cercle vert là où l'on a cliqué pour aller. */
  private moveMarker(ptr: Phaser.Input.Pointer) {
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const c = this.add.ellipse(wp.x, wp.y, 34, 16).setStrokeStyle(2, 0x9ad15a, 0.9).setDepth(wp.y - 1);
    this.tweens.add({ targets: c, scale: 0.3, alpha: 0, duration: 450, onComplete: () => c.destroy() });
  }

  private readInput(): PlayerInput {
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const aim = ISO.toWorld(wp.x, wp.y), held = this.holding && ptr.leftButtonDown() && !this.uiClick;
    const input: PlayerInput = { move: { x: 0, y: 0 }, aim, pressed: this.pressed, potion: this.potion,
      holdAttack: held && this.clickMode === 'place', pickup: this.pickClick };
    this.pickClick = null;
    if (held && this.clickMode === 'ground') input.dest = aim;
    if (held && this.clickMode === 'target' && this.clickTarget != null) input.target = this.clickTarget;
    // clic bref sur un monstre : on garde la cible jusqu'au premier coup (le perso continue de s'approcher)
    if (!held && this.clickMode === 'target' && this.clickTarget != null) { input.target = this.clickTarget; this.clickTarget = null; }
    // clic bref sur le sol : une seule destination
    if (!held && this.clickMode === 'ground' && this.clickDest) { input.dest = aim; }
    this.clickDest = held && this.clickMode === 'ground';
    this.pressed = null; this.potion = false;
    // curseur : une épée sur un monstre
    this.game.canvas.style.cursor = this.monsterUnder(ptr) ? 'crosshair' : 'default';
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
      this.hud.handle(e);
      const M = GAME_DATA.monsters;
      switch (e.k) {
        case 'impact':
          if (!this.fx.juice) break;
          if (e.hitstop > 0) this.hitstop = Math.max(this.hitstop, e.hitstop);
          if (e.shake > 0) this.cameras.main.shake(e.big ? 220 : 110, e.shake, true);
          break;
        case 'playerHurt': this.hud.hurtFlash(this.fx.juice); break;
        case 'wave':
          this.hud.banner(e.boss ? `Vague ${e.n}\n${M[e.boss].name}` : e.archi ? `Vague ${e.n}\nArchimonstre : ${M[e.archi].name} !` : `Vague ${e.n}`);
          break;
        case 'noResource': this.hud.noResource(e.res); break;
        case 'rageFull': this.hud.toast(`${this.world.player.cls.rage.name} au maximum : ton prochain sort est renforcé !`); break;
        case 'bossDown': this.hud.banner(`${M[e.monster].name} vaincu !`); break;
        case 'playerDeath':
          if (this.world.zone.open) this.hud.banner(`Vaincu\nEntrée : retour à ${this.world.checkpointName}`, 0, true);
          else this.hud.banner(`Vaincu à la vague ${e.wave}\nEntrée pour recommencer`, 0, true);
          break;
        case 'loot': {
          const d = ITEMS.equipment[e.item.id];
          this.hud.loot(`${d?.name ?? 'Objet'}  ·  ${RARITY_NAMES[e.item.rarity]}`, RARITY_COLORS[e.item.rarity]);
          this.windows?.refresh();
          break;
        }
        case 'lootKamas': this.hud.loot(`+${e.n} kamas`, '#f2d36b'); this.windows?.refresh(); break;
        case 'bagFull': this.hud.toast('Sac plein : recycle des objets (Maj + clic dans l\'inventaire)'); break;
        case 'monsterCast': this.castName(e.id, e.name); break;
        case 'itemDrop': if (e.rarity === 'rare' || e.rarity === 'legendaire') this.chime(e.rarity === 'legendaire'); break;
        case 'lootResource': this.hud.loot(`${ITEMS.resources[e.id]?.name ?? 'Ressource'} x${e.n}`, '#c9c4ab'); this.windows?.refresh(); break;
        case 'levelUp': this.hud.banner(`Niveau ${e.level} !\n+5 points (C)`, 1500); this.windows?.refresh(); break;
        case 'checkpoint': this.hud.banner(`Point de retour\n${e.name}`, 1400); break;
        case 'respawn': this.hud.banner('De retour !', 900); break;
        case 'enterArea': this.hud.banner(`${e.name}\nNiveau ${e.level}`, 1600); break;
      }
    }
  }

  /** Butin au sol (choix 3A) : icône officielle qui flotte, colonne de lumière de la couleur de la rareté dès Magique
   *  (plus haute pour Rare et Légendaire), nom au survol ou avec Alt ; les kamas sont un petit tas de pièces. */
  private drawDrops() {
    const seen = new Set<number>(), w = this.world;
    if (!this.textures.exists('beam')) {
      const c = this.textures.createCanvas('beam', 32, 256)!, x = c.getContext();
      const gr = x.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      const hz = x.createLinearGradient(0, 0, 32, 0);
      hz.addColorStop(0, 'rgba(0,0,0,1)'); hz.addColorStop(0.3, 'rgba(0,0,0,0.15)'); hz.addColorStop(0.7, 'rgba(0,0,0,0.15)'); hz.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = gr; x.fillRect(0, 0, 32, 256);
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = hz; x.fillRect(0, 0, 32, 256);
      c.refresh();
    }
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, alt = this.keys.ALT.isDown;
    for (const d of w.drops) {
      if (d.t < 0) continue;
      seen.add(d.uid);
      let v = this.dropViews.get(d.uid);
      const p = ISO.toScreen(d.x, d.y);
      if (!v) {
        const col = d.item ? RARITY_COLORS[d.item.rarity] : '#f2d36b', tint = parseInt(col.slice(1), 16);
        const big = d.item ? ['magique', 'rare', 'legendaire'].indexOf(d.item.rarity) : -1;
        v = {
          glow: this.add.ellipse(p.x, p.y, 46, 20, tint, 0.35),
          icon: d.item ? this.add.image(p.x, p.y - 14, ICON_SHEET.key, Math.max(0, iconFrame(ITEMS.equipment[d.item.id]?.icon ?? 0))).setDisplaySize(34, 34)
            : this.add.image(p.x, p.y - 8, 'kamas_tas').setDisplaySize(22, 22),
          label: big >= 0 ? this.add.text(p.x, p.y - 40, ITEMS.equipment[d.item!.id]?.name ?? '', {
            fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 3,
            backgroundColor: '#0d0c0acc', padding: { x: 4, y: 2 },
          }).setOrigin(0.5) : undefined,
          // colonne : un halo de la couleur de la rareté (orangé pour Rare, qui se perdrait sur les sols dorés) et un cœur blanc
          beam: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setTint(big === 1 ? 0xffa000 : tint)
            .setDisplaySize(30 + big * 6, [120, 180, 250][big]) : undefined,
          core: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setDisplaySize(8 + big * 2, [100, 150, 210][big]) : undefined,
        };
        this.dropViews.set(d.uid, v);
      }
      const shown = w.shown(d);
      const bob = d.item ? Math.sin(w.time * 4 + d.uid) * 3 : 0, pop = Math.min(1, d.t * 4);
      v.glow.setPosition(p.x, p.y).setDepth(p.y - 2).setScale(pop).setVisible(shown);
      v.icon.setPosition(p.x, p.y - (d.item ? 14 : 8) - bob - (1 - pop) * 30).setDepth(p.y + 1).setVisible(shown);
      const pulse = (0.85 + Math.sin(w.time * 3 + d.uid) * 0.15) * pop;
      v.beam?.setPosition(p.x, p.y).setDepth(p.y - 1).setAlpha(pulse).setVisible(shown);
      v.core?.setPosition(p.x, p.y).setDepth(p.y - 0.5).setAlpha(pulse * 0.8).setVisible(shown);
      if (v.label) {
        const hover = Math.abs(wp.x - p.x) < 26 && wp.y > p.y - 48 && wp.y < p.y + 10;
        v.label.setPosition(p.x, p.y - 46 - bob).setDepth(1e6 - 1).setVisible(shown && (alt || hover || w.player.pickupId === d.uid));
      }
    }
    for (const [uid, v] of this.dropViews) if (!seen.has(uid)) { v.icon.destroy(); v.label?.destroy(); v.glow.destroy(); v.beam?.destroy(); v.core?.destroy(); this.dropViews.delete(uid); }
  }

  private viewOf(e: Entity): EntityView {
    let v = this.views.get(e.id);
    if (!v) {
      const look = e.faction === 'player' ? LOOKS[this.classId] : LOOKS[GAME_DATA.monsters[(e as { type?: string }).type!].look];
      v = new EntityView(this, look);
      this.views.set(e.id, v);
    }
    return v;
  }

  private render() {
    const w = this.world, alive = new Set<number>(), wv = this.worldView, wg = w.worldGrid;
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.zoom) > 0.001) cam.setZoom(cam.zoom + (this.zoom - cam.zoom) * 0.2);
    wv?.update(w.player.x, w.player.y);
    for (const e of [w.player, ...w.monsters]) {
      // monde ouvert : on n'affiche que les monstres des cartes chargées (les autres vivent quand même dans la simulation)
      if (wv && wg && e !== w.player && !wv.isReady(wg.mapAt(e.x, e.y)?.tag)) continue;
      this.viewOf(e).sync(e); alive.add(e.id);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { v.destroy(); this.views.delete(id); }
    const s = w.player.skill;
    if (s && 'charge' in s.def && s.def.charge && !s.def.move && s.t < s.def.impactAt) this.fx.chargeSparks(w.player.x, w.player.y);
    this.fx.draw(w.telegraphs, w.projectiles);
    this.drawDrops();
    this.hud.draw(this.fx.juice, this.game.loop.delta / 1000);
  }
}
