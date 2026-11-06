import { apercuSort } from '../sim/apercu';
import { v } from './assetUrl';
import Phaser from 'phaser';
import { GAME_DATA, ITEMS, QUETES } from '../sim/data';
import type { Compte } from '../sim/quests';
import { QuestView } from './questView';
import { DialogueView } from './dialogueView';
import { GridMap, WorldGrid, type MapData, type WorldData } from '../sim/gridmap';
import { ISO } from '../sim/iso';
import type { PlayerInput } from '../sim/input';
import type { SkillId } from '../sim/defs';
import type { Entity } from '../sim/entity';
import { World } from '../sim/world';
import { EntityView } from './entityView';
import { SpellFx } from './spellFx';
import { FX } from './fx';
import { Hud } from './hud';
import { LOOKS } from './looks';
import { drawMap } from './mapView';
import { WorldView } from './worldView';
import { Particules, type SysData } from './particles';
import { ambiance, chargerReglages, matriceSaturation, type Reglages } from './ambiance';
import { ICON_SHEET, iconFrame } from './icons';
import { Windows } from './windows';
import { spellTipHtml } from './spellTip';
import { RARITY_COLORS, RARITY_NAMES, rollItem } from '../sim/items';
import { exporterJoueur, restaurerJoueur } from '../sim/sauvegarde';
import { lirePersos, sauverPerso, supprimerPerso, type Perso } from './persos';

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
  /** Personnage joué (écran « Mes personnages ») et son emplacement ; absent en mode dév (#cra, #astrub, #jeu). */
  private perso: Perso | null = null;
  private slot = -1;
  /** Vitrine : la partie tourne derrière l'écran d'accueil, sans joueur ni interface ; la caméra se promène. */
  private vitrine = false;
  private vitrineT = 0;
  private sauveT = 0;
  private mortDefinitive = false;
  private world!: World;
  private worldView: WorldView | null = null;
  /** Le joueur vient de passer une porte : la caméra le rejoint d'un coup (pas de glissade à travers le monde). */
  private snapCam = false;
  private views = new Map<number, EntityView>();
  private fx!: FX;
  /** Aura de la jauge de classe pleine (ligne Rage 27B), sous le perso. */
  private rageAura?: Phaser.GameObjects.Graphics;
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
  /** PNJ cliqué (quêtes) et leur affichage. */
  private talkClick: string | null = null;
  private questView: QuestView | null = null;
  private dialogueView: DialogueView | null = null;
  private acc = 0;
  /** Le clic en cours a commencé sur l'interface : maintenir le bouton ne fait pas attaquer. */
  private uiClick = false;
  /** Bouton gauche enfoncé depuis un clic DANS le jeu (Phaser voit aussi les clics sur les fenêtres HTML). */
  private holding = false;
  /** Sort en cours de visée (aperçu affiché), la touche qui le tient, et le sort survolé dans la barre (6A). */
  private aimId: SkillId | null = null; private aimKey: string | null = null; private hoverId: SkillId | null = null;
  /** Clic gauche en cours : sur le sol, sur un monstre, ou attaque sur place (Maj). */
  private clickMode: 'ground' | 'target' | 'place' | null = null;
  private clickTarget: number | null = null;
  private clickDest = false;
  /** Zoom voulu (molette) ; la caméra le rejoint en douceur. */
  private zoom = 1;
  static readonly ZOOM: [number, number] = [0.55, 1.5];   // dézoom limité (Mathis, 2026-11-06 : à 0,45 on voyait trop loin)
  /** Réglages du joueur (fenêtre Réglages, touche O) et dernière mise à jour de l'ambiance. */
  private reglages: Reglages = chargerReglages();
  private ambT = 0;
  private sat?: Phaser.FX.ColorMatrix;
  private static readonly STEP = 1 / 60;

  constructor() { super('zone'); }

  init(data: { zone?: string; classe?: string; slot?: number; vitrine?: boolean }) {
    this.vitrine = !!data?.vitrine; this.vitrineT = 0; this.sauveT = 0; this.mortDefinitive = false;
    this.slot = data?.slot ?? -1;
    this.perso = this.slot >= 0 ? lirePersos()[this.slot] : null;
    this.classId = this.perso?.classe ?? data?.classe ?? (location.hash.includes('cra') ? 'cra' : 'iop');
    // #astrub dans l'adresse : l'ancienne zone à vagues des Champs d'Astrub
    if (data?.zone) this.zoneId = data.zone;
    else if (location.hash === '#astrub') this.zoneId = 'champs-astrub';
    this.views = new Map(); this.dropViews = new Map(); this.worldView = null; this.questView = null; this.dialogueView = null; this.talkClick = null; this.pressed = null; this.aimId = null; this.aimKey = null; this.hoverId = null; this.potion = false; this.hitstop = 0; this.acc = 0;
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
    // élites des quêtes (Milimilou, Caporale Mynerve...) : absents des sous-zones
    if (zone.open) {
      for (const q of Object.values(QUETES.quetes)) for (const e of Array.isArray(q.etapes) ? q.etapes : Object.values(q.etapes).flat())
        for (const o of e.objectifs) if (o.t === 'elite' && GAME_DATA.monsters[o.monstre]) types.add(o.monstre);
      QuestView.preload(this, QUETES);
    }
    else {
      const w = zone.waves!;
      [...w.pack.map(p => p.monster), w.boss, ...w.escort.monsters, ...w.archimonstres.monsters].forEach(m => types.add(m));
    }
    // invocations (ex. Kardorib) : monstres appelés par un sort, absents des listes de sous-zones
    for (const t of [...types]) for (const s of GAME_DATA.monsters[t].spells ?? []) for (const e of s.effects) if (e.k === 'invoque') types.add(e.monster);
    // Effets officiels des sorts : ceux de la classe et des monstres de la zone
    SpellFx.preload(this, [...Object.keys(GAME_DATA.classes[this.classId].spells),
      ...[...types].flatMap(t => (GAME_DATA.monsters[t].spells ?? []).map(s => `m${s.id}`))]);
    const looks = [this.look, ...[...types].map(t => LOOKS[GAME_DATA.monsters[t].look])];
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
      Particules.preload(this, dir, open.world, v);
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
    this.reglages = chargerReglages(); this.ambT = 0; this.sat = undefined;
    this.zoom = Phaser.Math.Clamp(this.reglages.zoom, ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]); this.cameras.main.setZoom(this.zoom);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoom = Phaser.Math.Clamp(this.zoom * (dy > 0 ? 0.9 : 1.1), ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]);
    });
    if (zone.open) {
      const open = zone.open;
      const wg = new WorldGrid(this.cache.json.get(WorldView.key(open.world, 'monde')) as WorldData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map: wg, seed, classId: this.classId, items: ITEMS, quetes: QUETES, compte: chargerCompte(), 
        // vitrine : les PNJ sont là, mais aucune quête ne démarre
        reprise: this.vitrine ? { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } : this.perso?.etat?.quetes });
      this.cameras.main.setBackgroundColor('#0d2b36');   // sous le ciel, au cas où il manque
      this.worldView = new WorldView(this, wg, worldDir(open.world), open.world);
      this.worldView.portes = this.world.portes.flatMap(p => p.ends);
      const parts = this.cache.json.get(`${open.world}_particules`) as Record<string, SysData[]> | undefined;
      if (parts) this.worldView.parts = new Particules(this, wg, parts, `${open.world}_particules_img`);
      this.worldView.create();
      if (this.world.quetes) {
        this.questView = new QuestView(this, this.world, this.worldView);
        const dv = this.dialogueView = new DialogueView(this, this.world, this.questView);
        this.events.once('shutdown', () => dv.destroy());
      }
    } else {
      const key = mapDir(zone.map!.coords).replace(/\W/g, '_');
      const map = new GridMap(this.cache.json.get(`${key}_carte`) as MapData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map, seed, classId: this.classId, items: ITEMS });
      this.cameras.main.setBackgroundColor('#12141b');
      drawMap(this, map, `${key}_sol`, `${key}_decor`);
    }
    this.fx = new FX(this, t => hex(GAME_DATA.monsters[t].color));
    if (this.perso?.etat) restaurerJoueur(this.world, this.perso.etat);
    this.hud = new Hud(this, this.world, this.perso ?? undefined);
    if (this.questView) { const qv = this.questView; this.hud.portraitPnj = id => qv.portrait(id); }
    const mini = this.cameras.getCamera('mini');
    if (mini && this.worldView?.sky) mini.ignore(this.worldView.sky);
    this.windows?.destroy();
    this.windows = new Windows(this.world);
    this.windows.portrait = v(`${ASSETS}/ui/perso_${this.classId}${this.perso?.sexe === 'f' ? '_f' : ''}.png`);
    if (this.perso) this.windows.onAccueil = () => this.versAccueil();   // rendu en grand (perso_planche : render.cjs échelle 2,2)
    this.windows.reglages = this.reglages;
    this.windows.onReglages = r => { this.zoom = Phaser.Math.Clamp(r.zoom, ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]); this.updateAmbiance(true); };
    this.windows.juice = { get: () => this.fx.juice, set: on => { this.fx.juice = on; } };
    this.windows.heureNom = () => ambiance(this.reglages, new Date(), !!this.world.worldGrid?.mapAt(this.world.player.x, this.world.player.y)?.inside).nom;
    this.events.once('shutdown', () => { this.windows?.destroy(); this.windows = null; });
    this.hud.onSlotHover = (id, x, y) => {
      this.hoverId = id;
      if (!id) { this.windows?.hideTip(); return; }
      const r = this.game.canvas.getBoundingClientRect();
      this.windows?.showHtmlTip(spellTipHtml(this.world.player, id), r.left + x, r.top + y);
    };
    this.hud.onMenu = name => {
      if (name === 'Inventaire') this.windows!.toggle('inv');
      else if (name === 'Caractéristiques') this.windows!.toggle('car');
      else if (name === 'Métiers') this.windows!.toggle('job');
      else if (name === 'Réglages') this.windows!.toggle('opt');
      else if (name === 'Sorts') this.windows!.toggle('sorts');
      else if (name === 'Quêtes' && this.world.quetes) this.windows!.toggle('quetes');
      else if (name === 'Succès' && this.world.quetes) this.windows!.toggle('succes');
      else this.hud.toast(`${name} : arrive dans une prochaine version`);
    };
    this.hud.onPasser = id => this.world.quetes?.passer(id);
    if (this.vitrine) this.initVitrine();
    else {
      this.cameras.main.startFollow(this.viewOf(this.world.player).sprite, true, 0.12, 0.12, 0, 30);
      this.bindInput();
    }
    if (this.perso) {
      const quitter = () => this.sauver(), cache = () => { if (document.hidden) this.sauver(); };
      window.addEventListener('beforeunload', quitter); document.addEventListener('visibilitychange', cache);
      this.events.once('shutdown', () => { this.sauver(); window.removeEventListener('beforeunload', quitter); document.removeEventListener('visibilitychange', cache); });
    }
    // Accès console / tests automatisés (captures) : la partie et le tirage d'objets
    (window as unknown as { diablofus: unknown }).diablofus = { scene: this, world: this.world, rollItem, ITEMS };
  }

  /** Apparence du joueur : planche de la classe, version femme si le perso en est une. */
  private get look() { return (this.perso?.sexe === 'f' && LOOKS[`${this.classId}_f`]) || LOOKS[this.classId]; }
  /** Sauvegarde automatique du perso (toutes les 5 s, en quittant la page, en revenant à l'accueil). */
  private sauver = () => {
    if (!this.perso || this.slot < 0 || this.mortDefinitive || !this.world) return;
    const p = this.perso;
    p.etat = exporterJoueur(this.world); p.maj = Date.now();
    p.lieu = this.world.area?.name ?? p.lieu;
    sauverPerso(this.slot, p);
  };
  /** Retour à l'écran d'accueil (main.ts relance la partie en vitrine). */
  private versAccueil() { this.sauver(); this.game.events.emit('accueil'); }

  private bindInput() {
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard!;
    // Déplacement à la souris (clic gauche) ; le clavier sert aux sorts, à la potion et aux menus
    this.keys = kb.addKeys({ SHIFT: K.SHIFT, ALT: K.ALT,
      SPACE: K.SPACE, S: K.S, E: K.E, K: K.K, I: K.I, C: K.C, J: K.J, ESC: K.ESC, F: K.F, H: K.H, O: K.O, ENTER: K.ENTER,
      ONE: K.ONE, TWO: K.TWO, THREE: K.THREE, FOUR: K.FOUR, FIVE: K.FIVE, SIX: K.SIX }) as Record<string, Phaser.Input.Keyboard.Key>;
    // Façon Diablo (demande de Mathis, 2026-11-05) : clic gauche sur le sol = y aller (maintenu : suivre le curseur),
    // sur un monstre = s'approcher et l'attaquer (maintenu : continuer), Maj + clic gauche = attaquer sur place ;
    // clic droit = sort favori, Espace = déplacement, 1 à 6 (& é " ' ( - en AZERTY) = barre de sorts.
    // Un clic sur l'interface (barre, mini-carte, menus, fiches) ne fait rien en jeu.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      this.dialogueView?.fermerMenu();
      if (over.length || this.hud.blocks(p.x, p.y)) { this.uiClick = true; return; }
      this.uiClick = false;
      if (p.rightButtonDown()) {
        // clic droit sur un PNJ : son petit menu d'actions (Dialogues 1C)
        const n = this.questView?.pnjUnder(p, this.cameras.main);
        if (n && this.dialogueView) { this.dialogueView.ouvrirMenu(n, p); return; }
        if (this.aimId) { this.aimId = null; this.aimKey = null; return; }   // clic droit pendant la visée : annuler le sort (Mathis, 2026-11-06)
        this.down('CLICD', this.world.player.bar[6]); return;
      }
      if (this.reglages.lancer === 'dofus' && this.aimId) { this.pressed = this.aimId; this.aimId = null; this.aimKey = null; this.uiClick = true; return; }
      this.holding = true;
      if (this.keys.SHIFT.isDown) { this.pressed = 'attaque'; this.clickMode = 'place'; return; }
      const n = this.questView?.pnjUnder(p, this.cameras.main);
      if (n) { this.talkClick = n; this.clickMode = null; this.holding = false; return; }
      const d = this.dropUnder(p);
      if (d != null) { this.pickClick = d; this.clickMode = null; this.holding = false; return; }
      const m = this.monsterUnder(p);
      this.clickMode = m ? 'target' : 'ground';
      this.clickTarget = m?.id ?? null;
      if (!m) this.moveMarker(p);
    });
    const release = (e: PointerEvent) => { if (e.button === 2) this.up('CLICD'); else this.holding = false; };
    window.addEventListener('pointerup', release);
    this.events.once('shutdown', () => window.removeEventListener('pointerup', release));
    this.keys.SPACE.on('down', () => this.down('SPACE', this.world.player.bar[7]));
    this.keys.SPACE.on('up', () => this.up('SPACE'));
    this.keys.E.on('down', () => { this.potion = true; });
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => {
      // pendant un dialogue, 1 à 4 choisissent la réponse (Dialogues 3B)
      this.keys[k].on('down', () => { if (this.dialogueView?.ouvert && i < 4) this.dialogueView.touche(i); else this.down(k, this.world.player.bar[i]); });
      this.keys[k].on('up', () => this.up(k));
    });
    this.keys.F.on('down', () => {
      this.fx.juice = !this.fx.juice;
      this.hud.toast(this.fx.juice ? 'Effets d\'impact : ACTIVÉS' : 'Effets d\'impact : DÉSACTIVÉS (compare !)');
    });
    this.keys.H.on('down', () => this.hud.toggleHelp());
    // I ou C : fenêtre Personnage (inventaire + caractéristiques) ; le jeu continue derrière
    this.keys.I.on('down', () => this.windows?.toggle('inv'));
    this.keys.C.on('down', () => this.windows?.toggle('car'));
    this.keys.J.on('down', () => this.windows?.toggle('job'));   // Métiers (choix 6A : Chasseur)
    this.keys.O.on('down', () => this.windows?.toggle('opt'));
    this.keys.S.on('down', () => this.windows?.toggle('sorts'));   // Sorts (choix 8A, touche S)   // Réglages (choix 10A + 10B)
    this.keys.ESC.on('down', () => { if (this.dialogueView?.ouvert) { this.dialogueView.touche(-1); return; } this.dialogueView?.fermerMenu(); this.aimId = null; this.aimKey = null; this.windows?.close(); });
    // K : changer de classe, seulement sans perso (mode dév #cra / #jeu) ; sinon la classe se choisit à la création
    if (!this.perso) this.keys.K.on('down', () => this.scene.restart({ zone: this.zoneId, classe: this.classId === 'iop' ? 'cra' : 'iop' }));
    this.keys.ENTER.on('down', () => {
      if (!this.world.over) return;
      if (this.mortDefinitive) this.game.events.emit('accueil');
      else if (this.world.zone.open) this.world.respawnPlayer();
      else this.scene.restart({ zone: this.zoneId });
    });
  }

  /** Objet au sol (Rare et plus, affiché) sous le curseur. */
  private dropUnder(ptr: Phaser.Input.Pointer): number | null {
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    for (const [uid, v] of this.dropViews) {
      if (!v.icon.visible || !v.label) continue;
      if (v.icon.getBounds().contains(wp.x, wp.y) || (v.label.visible && v.label.getBounds().contains(wp.x, wp.y))) return uid;
    }
    return null;
  }
  /** Petit carillon (synthétisé, pas de fichier) quand un objet Rare ou Légendaire tombe (choix 3D). */
  /** Jauge pleine : halo qui pulse aux pieds du perso, couleur de la jauge (ligne Rage 27B). */
  private drawRageAura() {
    const p = this.world.player, g = this.rageAura ??= this.add.graphics();
    g.clear();
    if (!p.rageFull || p.dead) return;
    const v = this.viewOf(p), s = ISO.toScreen(p.x, p.y), k = 0.5 + 0.5 * Math.sin(this.world.time * 6);
    g.setDepth(v.sprite.depth - 0.5).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xf08a2c, 0.16 + 0.12 * k); g.fillEllipse(s.x, s.y, 92 + 14 * k, 40 + 6 * k);
    g.lineStyle(2, 0xffc04d, 0.45 + 0.35 * k); g.strokeEllipse(s.x, s.y, 80 + 10 * k, 34 + 4 * k);
  }
  /** Son court quand la jauge se remplit (ligne Rage 27B), synthétisé comme le carillon du butin. */
  private rageSound() {
    try {
      const A = (this.sound as unknown as { context?: AudioContext }).context;
      if (!A) return;
      const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.18);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.08 * this.reglages.volume + 0.0001, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.connect(g).connect(A.destination); o.start(t0); o.stop(t0 + 0.4);
    } catch { /* son indisponible */ }
  }

  private chime(legendary: boolean) {
    try {
      const A = (this.sound as unknown as { context?: AudioContext }).context;
      if (!A) return;
      const notes = legendary ? [784, 988, 1319, 1568] : [880, 1175];
      notes.forEach((f, i) => {
        const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12 * this.reglages.volume + 0.0001, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
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

  /** Touche de sort enfoncée (maquette Aperçu, 1A/1B/1C selon les Réglages) : maintenir pour voir l'aperçu, relâcher pour lancer ;
   *  ou lancer tout de suite (Alt maintenu : aperçu) ; ou viser comme Dofus (la touche arme le sort, clic gauche pour lancer). */
  private down(key: string, id: SkillId | null) {
    if (!id) return;
    const mode = this.reglages.lancer;
    if (mode === 'immediat' && !this.keys.ALT.isDown) { this.pressed = id; return; }
    if (mode === 'dofus' && key !== 'SPACE') { if (this.aimId === id) { this.pressed = id; this.aimId = null; } else { this.aimId = id; this.aimKey = null; } return; }
    this.aimId = id; this.aimKey = key;
  }
  private up(key: string) {
    if (this.aimKey !== key || !this.aimId) return;
    this.pressed = this.aimId; this.aimId = null; this.aimKey = null;
  }

  private readInput(): PlayerInput {
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const aim = ISO.toWorld(wp.x, wp.y), held = this.holding && ptr.leftButtonDown() && !this.uiClick;
    const input: PlayerInput = { move: { x: 0, y: 0 }, aim, pressed: this.pressed, potion: this.potion,
      holdAttack: held && this.clickMode === 'place', pickup: this.pickClick, approach: this.reglages.approche,
      castOn: null };
    // un sort lancé sur un monstre vise le monstre (comme l'aperçu), pas le sol derrière son sprite
    const vise = this.pressed ? this.monsterUnder(ptr) : null;
    if (vise && !vise.dead) { input.castOn = vise.id; input.aim = { x: vise.x, y: vise.y }; }
    this.pickClick = null;
    const dv = this.dialogueView;
    if (dv) { input.reponse = dv.reponse; dv.reponse = null; if (dv.menuTalk) { this.talkClick = dv.menuTalk; dv.menuTalk = null; } }
    const np = this.talkClick && this.world.quetes?.pnj(this.talkClick);
    if (np) { input.talk = this.talkClick; input.dest = { x: np.x, y: np.y }; this.clickMode = null; }
    this.talkClick = null;
    if (held && this.clickMode === 'ground') input.dest = aim;
    if (held && this.clickMode === 'target' && this.clickTarget != null) input.target = this.clickTarget;
    // clic bref sur un monstre : on garde la cible jusqu'au premier coup (le perso continue de s'approcher)
    if (!held && this.clickMode === 'target' && this.clickTarget != null) { input.target = this.clickTarget; this.clickTarget = null; }
    // clic bref sur le sol : une seule destination
    if (!held && this.clickMode === 'ground' && this.clickDest) { input.dest = aim; }
    this.clickDest = held && this.clickMode === 'ground';
    this.pressed = null; this.potion = false;
    // curseur : une épée sur un monstre
    const surPnj = this.questView?.pnjUnder(ptr, this.cameras.main) ?? null;
    if (this.questView) this.questView.survole = surPnj;
    this.dialogueView?.survol(surPnj, ptr);
    this.game.canvas.style.cursor = this.monsterUnder(ptr) ? 'crosshair' : surPnj ? 'pointer' : 'default';
    return input;
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.fx.update(dt);
    if (this.vitrine) this.updateVitrine(dt);
    else if (this.perso) {
      this.perso.temps += dt;
      if ((this.sauveT += dt) >= 5) { this.sauveT = 0; this.sauver(); }
    }
    // GEL D'IMAGE : la simulation s'arrête, l'affichage continue (tremblement, chiffres)
    if (this.hitstop > 0) { this.hitstop -= dt; this.render(); return; }
    // Pas fixe : même résultat quelle que soit la fréquence de l'écran (indispensable pour la coop)
    this.acc += dt;
    if (this.acc < ZoneScene.STEP) { this.render(); return; }   // écran > 60 Hz : on garde la touche pour le prochain pas
    let input = this.vitrine ? { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pressed: null } as PlayerInput : this.readInput();
    while (this.acc >= ZoneScene.STEP && this.hitstop <= 0) {
      this.acc -= ZoneScene.STEP;
      this.world.step(ZoneScene.STEP, input);
      input = { ...input, pressed: null, potion: false, reponse: null };
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
        case 'rageFull': this.rageSound(); this.hud.toast(`${this.world.player.cls.rage.name} au maximum : ton prochain sort est renforcé !`); break;
        case 'bossDown': this.hud.banner(`${M[e.monster].name} vaincu !`); break;
        case 'playerDeath':
          if (this.perso?.hardcore) {
            // Hardcore (choix 10D) : la mort efface le personnage
            this.mortDefinitive = true; supprimerPerso(this.slot);
            this.hud.banner(`${this.perso.nom} est mort\nMode Hardcore : Entrée pour revenir à l'accueil`, 0, true);
          } else if (this.world.zone.open) this.hud.banner(`Vaincu\nEntrée : retour à ${this.world.checkpointName}`, 0, true);
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
        case 'itemDrop': if (e.rarity === 'epique' || e.rarity === 'legendaire' || e.rarity === 'mythique') this.chime(e.rarity !== 'epique'); break;
        case 'metierLevel': this.hud.banner(`${ITEMS.metiers?.[e.metier]?.name ?? 'Métier'} niveau ${e.level} !`, 1500); this.windows?.refresh(); break;
        case 'craft': this.hud.loot(`${ITEMS.resources[e.id]?.name ?? 'Objet'} x${e.n}`, '#9ad15a'); this.windows?.refresh(); break;
        case 'eat': this.windows?.refresh(); break;
        case 'lootResource': this.hud.loot(`${ITEMS.resources[e.id]?.name ?? 'Ressource'} x${e.n}`, '#c9c4ab'); this.windows?.refresh(); break;
        case 'levelUp': this.hud.banner(`Niveau ${e.level} !\n+5 points (C)${e.level === 100 ? '\n+1 PA' : ''}`, 1500); this.windows?.refresh(); break;
        case 'newSpell': {
          const KEY = ['&', 'é', '"', "'", '(', '-', 'clic droit', 'Espace'];
          this.hud.toast(`Nouveau sort : ${this.world.player.cls.spells[e.id]?.name ?? e.id}${e.slot >= 0 ? ` (${KEY[e.slot]})` : ' · S pour le placer'}`);
          this.windows?.refresh(); break;
        }
        case 'checkpoint': this.hud.banner(`Point de retour\n${e.name}`, 1400); break;
        case 'respawn': this.hud.banner('De retour !', 900); break;
        case 'enterArea': if (!this.vitrine) this.hud.zoneBanner(e.name, this.world.zone.name, e.level, this.decouvrir(e.name)); break;
        case 'queteDebut': {
          const q = QUETES.quetes[e.id];
          if (q.type !== 'tutoriel') this.hud.toast(`Nouvelle quête : ${q.nom}`);
          this.windows?.refresh(); break;
        }
        case 'queteEtape': this.windows?.refresh(); break;
        case 'queteFin': {
          const q = QUETES.quetes[e.id];
          if (!e.sautee) this.hud.banner(`Quête terminée\n${q.nom}`, 1600);
          if (q.type === 'tutoriel') sauverCompte(this.world, 1);
          this.windows?.refresh(); break;
        }
        case 'objetQuete': this.hud.loot(`${e.nom}  ${e.n}/${e.sur}`, '#9ad15a'); break;
        case 'succes': {
          const s = QUETES.succes[e.id];
          this.hud.succes(s.nom, s.points); sauverCompte(this.world); this.windows?.refresh(); break;
        }
        case 'portal': this.cameras.main.fadeIn(450, 0, 0, 0); this.snapCam = true; break;   // fondu au noir, la caméra saute avec le joueur
      }
    }
  }

  /** Butin au sol (choix 3A) : icône officielle qui flotte, colonne de lumière de la couleur de la rareté dès Rare
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
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, alt = !!this.keys?.ALT?.isDown;
    for (const d of w.drops) {
      if (d.t < 0) continue;
      seen.add(d.uid);
      let v = this.dropViews.get(d.uid);
      const p = ISO.toScreen(d.x, d.y);
      if (!v) {
        const col = d.item ? RARITY_COLORS[d.item.rarity] : '#f2d36b', tint = parseInt(col.slice(1), 16);
        const big = d.item ? ['rare', 'epique', 'legendaire', 'mythique'].indexOf(d.item.rarity) : -1;
        v = {
          glow: this.add.ellipse(p.x, p.y, 46, 20, tint, 0.35),
          icon: d.item ? this.add.image(p.x, p.y - 14, ICON_SHEET.key, Math.max(0, iconFrame(ITEMS.equipment[d.item.id]?.icon ?? 0))).setDisplaySize(34, 34)
            : this.add.image(p.x, p.y - 8, 'kamas_tas').setDisplaySize(22, 22),
          label: big >= 0 ? this.add.text(p.x, p.y - 40, ITEMS.equipment[d.item!.id]?.name ?? '', {
            fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 3,
            backgroundColor: '#0d0c0acc', padding: { x: 4, y: 2 },
          }).setOrigin(0.5) : undefined,
          // colonne : un halo de la couleur de la rareté et un cœur blanc, plus haute à chaque rang
          beam: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setTint(tint)
            .setDisplaySize(30 + big * 6, [110, 160, 220, 290][big]) : undefined,
          core: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setDisplaySize(8 + big * 2, [90, 135, 185, 250][big]) : undefined,
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
      const look = e.faction === 'player' ? this.look : LOOKS[GAME_DATA.monsters[(e as { type?: string }).type!].look];
      v = new EntityView(this, look);
      this.views.set(e.id, v);
    }
    return v;
  }

  /** Ambiance (render/ambiance.ts) : jour / soir / nuit selon l'heure du PC, lumière fixe dans les intérieurs. Quatre fois par seconde. */
  private updateAmbiance(force = false) {
    const now = this.time.now;
    if (!force && now - this.ambT < 250) return;
    this.ambT = now;
    const w = this.world, inside = !!w.worldGrid?.mapAt(w.player.x, w.player.y)?.inside;
    const a = ambiance(this.reglages, new Date(), inside || !w.zone.open);
    this.worldView?.setAmbiance(a.tint, a.lumieres, a.soleil);
    if (this.worldView) { this.worldView.vent = this.reglages.vent; this.worldView.eau = this.reglages.eau; if (this.worldView.parts) this.worldView.parts.actif = this.reglages.particules; }
    EntityView.ambiance = a.tintPerso;
    // couleurs adoucies (5B) : un filtre sur la caméra du jeu, seulement s'il sert (WebGL)
    const s = this.reglages.saturation, cam = this.cameras.main;
    if (Math.abs(s - 1) > 0.01 && cam.postFX) { this.sat ??= cam.postFX.addColorMatrix(); this.sat.set(matriceSaturation(s)); }
    else if (this.sat) { cam.postFX.remove(this.sat as unknown as Phaser.FX.Controller); this.sat = undefined; }
  }

  /** Sous-zones déjà vues (bandeau 2C : grand la première fois, petit ensuite) : par personnage. */
  private decouvrir(nom: string): boolean {
    if (!this.perso) return decouvrir(nom);
    if (this.perso.zones.includes(nom)) return false;
    this.perso.zones.push(nom);
    return true;
  }

  /** Vitrine de l'écran d'accueil (17A) : pas d'interface ni de joueur visible, les monstres ne le voient pas (mort pour eux),
   *  et la caméra glisse lentement d'une carte à l'autre autour du départ. Le « joueur » suit la caméra pour que les cartes
   *  se chargent et que les monstres autour vivent. */
  private tour: { x: number; y: number }[] = [];
  private initVitrine() {
    this.cameras.getCamera('ui')?.setVisible(false);
    this.cameras.getCamera('mini')?.setVisible(false);
    const w = this.world, wg = w.worldGrid, p = w.player;
    p.dead = true;
    this.tour = [{ x: p.x, y: p.y }];
    if (wg && w.zone.open) {
      const [sx, sy] = w.zone.open.start;
      // boucle sur les cartes du dehors autour du départ, dans l'ordre de l'angle
      const autour = wg.world.maps.filter(m => !m.inside && Math.abs(m.x - sx) <= 2 && Math.abs(m.y - sy) <= 2 && (m.x !== sx || m.y !== sy))
        .sort((a, b) => Math.atan2(a.y - sy, a.x - sx) - Math.atan2(b.y - sy, b.x - sx));
      for (const m of autour) {
        const free = wg.freeByMap.get(m.tag);
        if (free?.length) this.tour.push(wg.cellToWorld(free[Math.floor(free.length / 2)]));
      }
    }
    const s = ISO.toScreen(p.x, p.y);
    this.cameras.main.centerOn(s.x, s.y);
  }
  private updateVitrine(dt: number) {
    const p = this.world.player, n = this.tour.length;
    if (!n) return;
    // ~45 unités par seconde le long de la boucle : on voit le décor vivre sans que ça défile vite
    this.vitrineT += dt * 45;
    const seg = this.tour.map((a, i) => { const b = this.tour[(i + 1) % n]; return Math.hypot(b.x - a.x, b.y - a.y); });
    const total = seg.reduce((x, y) => x + y, 0);
    if (total > 0) {
      let d = this.vitrineT % total, i = 0;
      while (d > seg[i]) d -= seg[i++];
      const a = this.tour[i], b = this.tour[(i + 1) % n], t = seg[i] ? d / seg[i] : 0;
      p.x = a.x + (b.x - a.x) * t; p.y = a.y + (b.y - a.y) * t;
    }
    const s = ISO.toScreen(p.x, p.y), cam = this.cameras.main;
    cam.centerOn(cam.midPoint.x + (s.x - cam.midPoint.x) * 0.03, cam.midPoint.y + (s.y - 40 - cam.midPoint.y) * 0.03);
  }

  private render() {
    const w = this.world, alive = new Set<number>(), wv = this.worldView, wg = w.worldGrid;
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.zoom) > 0.001) cam.setZoom(cam.zoom + (this.zoom - cam.zoom) * 0.2);
    this.updateAmbiance();
    wv?.update(w.player.x, w.player.y);
    this.drawRageAura();
    for (const e of [w.player, ...w.monsters]) {
      // monde ouvert : on n'affiche que les monstres des cartes chargées (les autres vivent quand même dans la simulation)
      if (wv && wg && e !== w.player && !wv.isReady(wg.mapAt(e.x, e.y)?.tag)) continue;
      if (this.vitrine && e === w.player) continue;
      alive.add(e.id);
      // hors de l'écran (avec une marge) : la vue reste, mais on ne la met pas à jour
      if (e !== w.player) {
        const s = ISO.toScreen(e.x, e.y), r = cam.worldView;
        if (s.x < r.x - 250 || s.x > r.right + 250 || s.y < r.y - 150 || s.y > r.bottom + 350) { this.views.get(e.id)?.hide(); continue; }
      }
      this.viewOf(e).sync(e);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { v.destroy(); this.views.delete(id); }
    if (this.snapCam && !this.vitrine) { const pv = this.viewOf(w.player).sprite; cam.centerOn(pv.x, pv.y - 30); this.snapCam = false; }
    const s = w.player.skill;
    if (s && 'charge' in s.def && s.def.charge && !s.def.move && s.t < s.def.impactAt) this.fx.chargeSparks(w.player.x, w.player.y);
    this.fx.draw(w.telegraphs, w.projectiles);
    // Aperçu du sort visé (ou survolé dans la barre), et portée de l'arme en maintenant Maj (9B)
    {
      const p = w.player, id = this.aimId ?? this.hoverId, ptr = this.input.activePointer;
      const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, m = this.monsterUnder(ptr);
      const aim = m && !m.dead ? { x: m.x, y: m.y } : ISO.toWorld(wp.x, wp.y);
      this.fx.apercu(id && !p.dead ? apercuSort(w, id, aim) : null, p, w.monsters.filter(q => !q.dead), !!this.keys?.SHIFT?.isDown && !p.dead ? p.attackReach() : 0);
    }
    this.drawDrops();
    this.questView?.update();
    this.dialogueView?.update();
    this.hud.draw(this.fx.juice, this.game.loop.delta / 1000);
  }
}

/** Sous-zones déjà vues sans perso (mode dév), gardées dans le navigateur. Affichage seulement. */
function decouvrir(nom: string): boolean {
  try {
    const k = 'diablofus.zones', vues: string[] = JSON.parse(localStorage.getItem(k) ?? '[]');
    if (vues.includes(nom)) return false;
    localStorage.setItem(k, JSON.stringify([...vues, nom]));
  } catch { /* navigateur sans stockage : toujours le grand bandeau */ }
  return true;
}

/** Compte (succès du compte, 15A ; persos déjà joués, 7B), gardé dans le navigateur. Affichage seulement. */
function chargerCompte(): Compte {
  try { const c = JSON.parse(localStorage.getItem('diablofus.compte') ?? 'null'); if (c && Array.isArray(c.succes)) return { succes: c.succes, persos: +c.persos || 0 }; }
  catch { /* pas de stockage */ }
  return { succes: [], persos: 0 };
}
function sauverCompte(w: World, persos = 0) {
  const q = w.quetes; if (!q) return;
  try { localStorage.setItem('diablofus.compte', JSON.stringify({ succes: [...q.succes], persos: Math.max(q.compte.persos, persos) })); q.compte.persos = Math.max(q.compte.persos, persos); }
  catch { /* pas de stockage */ }
}
