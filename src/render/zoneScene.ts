import { PORTABLE, TROPHEES } from '../sim/dofus';
import { apercuSort } from '../sim/apercu';
import { dossier, v } from './assetUrl';
import Phaser from 'phaser';
import { calerCamera, densite } from './pixel';
import { APPARATS, BOUTIQUES, FAMILIERS, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../sim/data';
import type { Compte } from '../sim/quests';
import { QuestView } from './questView';
import { PassantsView } from './passantsView';
import { RecolteView } from './recolteView';
import { AtelierView } from './atelierView';
import { estPalier, recettesAuNiveau } from '../sim/metiers';
import { HavreSacView } from './havreSacView';
import { AreneView } from './areneView';
import { GuerreView } from './guerreView';
import { GUERRE } from '../sim/guerre';
import { chrono } from '../sim/quests';
import type { PointDeRetour, RetourHavreSac, SimEvent } from '../sim/events';
import { DialogueView } from './dialogueView';
import { GridMap, WorldGrid, type MapData, type WorldData } from '../sim/gridmap';
import { ISO } from '../sim/iso';
import type { PlayerInput } from '../sim/input';
import { entreesAllies } from '../sim/allie';
import type { SkillId } from '../sim/defs';
import type { Entity } from '../sim/entity';
import { World } from '../sim/world';
import { DANGER } from '../sim/danger';
import { EntityView } from './entityView';
import * as Touches from './touches';
import { Attente, PersoVivant } from './persoVivant';
import { Assemblage, LANCE_EN_MAIN, apparenceValide, fiches, objetsPortes, type Apparence } from './squelette';
import { SpellFx } from './spellFx';
import { FX } from './fx';
import { FamilierView } from './familierView';
import { Hud } from './hud';
import { LOOKS, type Look } from './looks';
import { BETES, Bete } from '../sim/bete';
import { Player } from '../sim/player';
import { drawMap } from './mapView';
import { Transparence, type Cache } from './transparence';
import { WorldView } from './worldView';
import { Particules, type SysData } from './particles';
import { ambiance, chargerReglages, matriceSaturation, sauverReglages, type Reglages } from './ambiance';
import { ICON_SHEET, iconFrame } from './icons';
import { CarteMonde, COULEURS_GROUPE, type GesteCarte } from './carteMonde';
import { SIGNAL_DUREE } from '../sim/carte';
import { Windows } from './windows';
import { mmss } from './forgeVue';
import { Chargement, type Arrivee } from './chargement';
import { inviterDiscord } from './inviteDiscord';
import { Parcours } from './parcours';
import { spellTipHtml } from './spellTip';
import { LEGENDARY, RARITY_COLORS, RARITY_NAMES, rollItem } from '../sim/items';
import { POUVOIR_PAR_ID, V03_PUBLIC, V04_PUBLIC } from '../sim/pouvoirs';
import { lieuxDeZone } from '../sim/passants';
import { PC_PAR_ID } from '../sim/pouvoirsClasse';
import { exporterJoueur, restaurerJoueur } from '../sim/sauvegarde';
import { lireBestiaire, noter, nouvelleSession, sauverBestiaire, statsVides } from './carnet';
import { dernier, enterrer, persosEnLigne, lireCoffre, lirePersos, sauverCoffre, sauverPerso, supprimerPerso, type Perso, type SorteCoffre } from './persos';
import { SonView, synthe } from './sonView';
import { MANIFESTE, Son } from './son';
import { retouchesPlacement } from './placementVue';
import { etatsPrets, jourDuPC, PanneauTest, lireTest, modeTest, sauverTest, type EtatTest } from './panneauTest';
import { CalquesTest } from './calquesTest';
import { REGLAGES_TEST, type CommandeTest } from '../sim/outilsTest';
import { Coop } from './coop';
import { appliquerInstantane, lisserMiroir } from '../sim/miroir';
import { EnLigne } from './presence';
import { Compte as CompteEnLigne } from './compte';
import { PassantsEnLigne } from './passantsEnLigne';
import { ChatVue } from './chat';
import { BullesChat } from './bullesChat';
import { demandesEnAttente, menuJoueur, montrerInvitation } from './social';

const ASSETS = 'assets';
const mapDir = ([x, y]: [number, number]) => `${ASSETS}/cartes/${x}_${y}`;
const worldDir = (w: string) => `${ASSETS}/mondes/${w}`;
const hex = (c: string) => parseInt(c.replace('#', ''), 16);
/** Curseur au survol d'une porte ou d'une sortie (maquette Entrées 17A) : la maison officielle de Dofus 3 (uidarkstone « house »). */
const CURSEUR_PORTE = `url("${v(`${ASSETS}/ui/curseur_porte.png`)}") 1 1, pointer`;

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
  /** Accueil 8B : essai d'une classe, 60 s dans les Champs d'Astrub, sans perso ni sauvegarde (sexe choisi, temps écoulé). */
  private essai: { sexe: 'm' | 'f'; t: number; averti: boolean } | null = null;
  static readonly ESSAI = 60;
  private sauveT = 0;
  /** Partie de test (#test, maquette « Test : ») : le perso de test, son panneau (F1) et les ordres à passer à la simulation. */
  private test: EtatTest | null = null;
  private panneau: PanneauTest | null = null;
  private cmdTest: CommandeTest[] = [];
  private mortDefinitive = false;
  private world!: World;
  private worldView: WorldView | null = null;
  /** Le joueur vient de passer une porte : la caméra le rejoint d'un coup (pas de glissade à travers le monde). */
  private snapCam = false;
  /** Rideau des arrivées (choix 1A + 5A) : 'sortie' = fondu au noir devant une porte ; 'attente' = noir tant que la carte
   *  d'arrivée et ses voisines ne sont pas posées (la partie est en pause). Au-delà de RIDEAU_ECRAN s, l'écran de chargement s'affiche. */
  private rideau: { etat: 'sortie' | 'attente'; t: number; ecran: boolean; arrivee?: boolean } | null = null;
  /** Changement de zone en cours (Entrées 14A) : fondu au noir de 0,2 s, la partie s'arrête, puis la scène repart. */
  private depart = false;
  /** Comment on arrive dans cette zone : écran de voyage (15A), noir de porte (Havre-Sac, 14A) ou logo. */
  private arriveePar: Arrivee = null;
  static readonly RIDEAU_ECRAN = 0.6;
  /** Première arrivée en jeu depuis l'ouverture de la page (Arrivée 4A : tourbillon du Zaap à la connexion). */
  static connexion = true;
  /** Moment du clic sur « Jouer » (Arrivée 7A) : le temps jusqu'au monde affiché part dans les stats de parcours. */
  static clicJouer: number | null = null;
  static readonly RIDEAU_MAX = 10;
  private views = new Map<number, EntityView>();
  private transparence: Transparence | null = null;
  private fx!: FX;
  /** Aura de la jauge de classe pleine (ligne Rage 27B), sous le perso. */
  private rageAura?: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pressed: SkillId | null = null;
  private potion = false;
  private hitstop = 0;
  private windows: Windows | null = null;
  /** Carte du monde (touche M, 0.2 18A). */
  private carte: CarteMonde | null = null;
  /** Butin au sol : icône + nom de l'objet, couleur de sa rareté. */
  private dropViews = new Map<number, { icon: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Ellipse; beam?: Phaser.GameObjects.Image; core?: Phaser.GameObjects.Image;
    /** Kamas (choix Kamas A+B+D) : pièces de la gerbe, reflet, taille du tas, chute déjà sonnée. */
    coins?: Phaser.GameObjects.Image[]; shine?: Phaser.GameObjects.Image; tier?: number; sonne?: boolean }>();
  /** Objet au sol cliqué (à ramasser). */
  private pickClick: number | null = null;
  /** Métiers de récolte (0.2b) : ressources du monde, et celle cliquée. */
  private recolteView: RecolteView | null = null;
  private havreSacView: HavreSacView | null = null;
  private areneView: AreneView | null = null;
  private guerreView: GuerreView | null = null;
  /** Boss enfui dans son trou (« Wabbits : 8B »), pour la bannière de fin qui suit. */
  private fuite: { suite: string; premier: boolean; name: string } | null = null;
  /** Havre-Sac : touche H ou bouton du HUD (2A), choix dans la fenêtre du Zaap du Havre-Sac (2C), pour le prochain pas. */
  private havreSacDemande = false;
  /** Enutrof : touche du coffre au trésor. */
  private coffreDemande = false;
  private zaapChoix: number | null = null;
  /** Clic sur un Zaap du monde (maquette « Zaap : » 1A) et Zaap tout juste découvert (3A : un seul bandeau). */
  private zaapClick: string | null = null;
  /** Clic sur un portail dessiné (bassin d'Incarnam, arche de la tour d'Astrub) : son nom ; le perso y va et passe. */
  private portailClick: string | null = null;
  private zaapAnnonce: string | null = null;
  private zaapLabel: Phaser.GameObjects.Text | null = null;
  private recolteClick: number | null = null;
  private atelierView: AtelierView | null = null;
  private posteClick: number | null = null;
  /** PNJ cliqué (quêtes) et leur affichage. */
  private talkClick: string | null = null;
  private questView: QuestView | null = null;
  private passantsView: PassantsView | null = null;
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
  static readonly ZOOM: [number, number] = [0.55, 1.2];   // dézoom limité (Mathis, 2026-11-06 : à 0,45 on voyait trop loin) ; au-delà de 1,2 les planches (SCALE 0,7) sont agrandies donc floues
  /** Réglages du joueur (fenêtre Réglages, touche O) et dernière mise à jour de l'ambiance. */
  private reglages: Reglages = chargerReglages();
  private ambT = 0;
  private sat?: Phaser.FX.ColorMatrix;
  /** Musique et sons (maquette Son). */
  private son!: SonView;
  private static readonly STEP = 1 / 60;

  /** Monstres vaincus par le compte (Bestiaire, Accueil 1A). */
  private bestiaire: Record<string, number> = {};
  constructor() { super('zone'); }

  /** Arrivée par un portail d'une autre zone (Incarnam <-> Astrub), ou par le Havre-Sac (entrée, sortie, son Zaap). */
  private arrivee?: [string, number];
  private transit: Transit = {};
  init(data: { zone?: string; classe?: string; slot?: number; vitrine?: boolean; arrivee?: [string, number]; essai?: 'm' | 'f'; apparence?: Apparence; par?: Arrivee } & Transit) {
    this.depart = false; this.rideau = null; this.arriveePar = data?.par ?? null;
    this.essai = data?.essai ? { sexe: data.essai, t: 0, averti: false } : null;
    this.apparenceEssai = data?.apparence;
    this.vitrine = !!data?.vitrine; this.vitrineT = 0; this.sauveT = 0; this.mortDefinitive = false;
    this.slot = data?.slot ?? -1;
    this.perso = this.slot >= 0 ? lirePersos()[this.slot] : null;
    // Accueil 4A/4C : résumé du perso et nouvelle « dernière partie » ; Bestiaire du compte (1A)
    if (this.perso) { this.perso.stats ??= statsVides(); this.perso.session = nouvelleSession(this.perso.etat?.level ?? 1); }
    this.bestiaire = lireBestiaire();
    this.test = !this.perso && !this.vitrine && !this.essai && modeTest() ? lireTest() : null; this.cmdTest = [];
    this.classId = this.perso?.classe ?? data?.classe ?? this.test?.classe ?? (location.hash.includes('cra') ? 'cra' : 'iop');
    // #astrub dans l'adresse : l'ancienne zone à vagues des Champs d'Astrub
    // #astrub2 : Astrub en monde ouvert, sans perso (mode dév) ; un perso reprend dans sa zone
    this.arrivee = data?.arrivee;
    this.transit = { position: data?.position, point: data?.point, zaap: data?.zaap, retour: data?.retour, vues: data?.vues };
    if (data?.zone) this.zoneId = data.zone;
    else if (this.perso?.etat?.zone && GAME_DATA.zones[this.perso.etat.zone]) this.zoneId = this.perso.etat.zone;
    else if (this.test) { const z = this.test.zone ?? this.test.etat?.zone; this.zoneId = z && GAME_DATA.zones[z] ? z : 'incarnam'; }
    else if (location.hash === '#astrub') this.zoneId = 'champs-astrub';
    else if (location.hash.includes('astrub2')) this.zoneId = 'astrub';
    else this.zoneId = 'incarnam';
    // dessins gardés d'une partie à l'autre : ils appartenaient à la scène d'avant (détruits avec elle), on les refait
    // (avant : Sacrieur qui change de zone ou rejoint une coop -> goutte de souffrance d'une scène détruite, jeu figé)
    this.rageAura = undefined; this.goutteSouffrance = undefined; this.sangG = undefined; this.laisseG = undefined; this.signalG = undefined; this.lanceG = undefined; this.lancesVues = new Map(); this.gouttesSol = [];
    this.views = new Map(); this.dropViews = new Map(); this.worldView = null; this.questView = null; this.passantsView = null; this.dialogueView = null; this.talkClick = null; this.zaapClick = null; this.zaapAnnonce = null; this.pressed = null; this.aimId = null; this.aimKey = null; this.hoverId = null; this.potion = false; this.hitstop = 0; this.acc = 0;
  }

  preload() {
    Chargement.montrer(this.arriveePar);
    this.load.off('progress', Chargement.progres).off('progress', Chargement.fichiers).on('progress', Chargement.fichiers);   // le chargeur survit aux relances de la scène
    Hud.preload(this);
    // Icônes des objets officiels : une seule planche
    // kamas au sol (Kamas A) : le tas de pièces officiel (figs_/kamastack) et une pièce seule, prise sur le dessus du tas
    if (!this.textures.exists('kamas_tas')) this.load.image('kamas_tas', v(`${ASSETS}/ui/kamas_tas.png`));
    if (!this.textures.exists('fleche_arme')) this.load.image('fleche_arme', v(`${ASSETS}/fx/fleche_arme.webp`));   // Armes 4B
    if (!this.textures.exists('kamas_piece')) this.load.image('kamas_piece', v(`${ASSETS}/ui/kamas_piece.png`));
    // paillasson posé à chaque sortie d'intérieur, comme Sanstour (Mathis, 2026-11-08) : dalle, soleil vert, étincelles
    for (const n of ['paillasson', 'paillasson_soleil', 'paillasson_etincelle'])
      if (!this.textures.exists(n)) this.load.image(n, v(`${ASSETS}/ui/${n}.png`));
    // Sacrieur : goutte de Souffrance officielle (états SacriNice 1 à 10), au-dessus du perso
    if (GAME_DATA.classes[this.classId].souffrance) for (let i = 1; i <= 10; i++)
      if (!this.textures.exists(`souffrance_${i}`)) this.load.image(`souffrance_${i}`, v(`${ASSETS}/ui/souffrance/s${i}.png`));
    if (!this.textures.exists(ICON_SHEET.key)) this.load.spritesheet(ICON_SHEET.key, v(`${ASSETS}/${ICON_SHEET.url}`), { frameWidth: ICON_SHEET.cell, frameHeight: ICON_SHEET.cell });
    const zone = GAME_DATA.zones[this.zoneId];
    // On ne charge que les planches utiles à cette zone
    const types = new Set<string>();
    if (zone.open) for (const s of Object.values(zone.open.subareas)) s.monsters.forEach(m => types.add(m));
    // élites des quêtes (Milimilou, Caporale Mynerve...) : absents des sous-zones
    if (zone.open) {
      for (const q of Object.values(QUETES.quetes)) for (const e of Array.isArray(q.etapes) ? q.etapes : Object.values(q.etapes).flat())
        for (const o of e.objectifs) if (o.t === 'elite' && GAME_DATA.monsters[o.monstre]) types.add(o.monstre);
      QuestView.preload(this, QUETES, V03_PUBLIC || !!this.test, this.zoneId, V04_PUBLIC || !!this.test);
      if (zone.open.bastion) PassantsView.preload(this);
      else for (const l of lieuxDeZone(this.zoneId, V04_PUBLIC || !!this.test)) PassantsView.preload(this, l.habitants);
    }
    else {
      const w = zone.waves!;
      [...w.pack.map(p => p.monster), w.boss, ...w.escort.monsters, ...w.archimonstres.monsters].forEach(m => types.add(m));
    }
    // invocations (ex. Kardorib) : monstres appelés par un sort, absents des listes de sous-zones
    for (const t of [...types]) for (const s of GAME_DATA.monsters[t].spells ?? []) for (const e of s.effects) if (e.k === 'invoque') types.add(e.monster);
    // Effets officiels des sorts : ceux de la classe et des monstres de la zone
    // Osamodas : effets officiels des sorts de ses 4 bêtes de base (b<id du sort>) ; ceux des rangs éveillés arrivent à la demande
    const sortsBetes = GAME_DATA.classes[this.classId].rage.mode === 'eveil' ? Object.values(BETES).filter(b => b.rang === 1).flatMap(b => b.sorts.map(s => `b${s.id}`)) : [];
    SpellFx.preload(this, [...Object.keys(GAME_DATA.classes[this.classId].spells), ...sortsBetes,
      ...[...types].flatMap(t => (GAME_DATA.monsters[t].spells ?? []).map(s => `m${s.id}`))]);
    // monde ouvert : les planches des monstres arrivent à la demande (planche()), quand un monstre est près de l'écran
    // (Astrub : 38 monstres, 70 Mo de planches) ; les zones à vagues les chargent toutes d'avance
    // Perso du joueur dessiné en direct depuis son squelette (Apparence 3A) ; l'ancienne planche ne sert plus qu'en secours
    const looks = [...(zone.open ? [] : [...types].map(t => LOOKS[GAME_DATA.monsters[t].look]))];
    this.assemblage = null;
    // coiffe, cape et bouclier portés (et leur apparat) dessinés dès le départ, d'après la sauvegarde (Apparence 4A+4B+5A)
    const e0 = this.perso?.etat, obj0 = [...objetsPortes(e0?.equipment, e0?.apparat), ...(GAME_DATA.classes[this.classId]?.lance ? [LANCE_EN_MAIN] : [])];
    this.apparenceCle = this.cleApparence(obj0);
    const pret = Assemblage.creer(this.clePerso, this.perso?.apparence ?? this.apparenceEssai, obj0).then(a => { this.assemblage = a; }, () => {
      const L = this.look;
      if (!this.textures.exists(L.atlas)) this.load.multiatlas(L.atlas, v(`${ASSETS}/sprites/${L.atlas}.json`), dossier(`${ASSETS}/sprites/`));
    });
    this.load.addFile(new Attente(this.load, `vivant_${this.clePerso}`, pret));
    const seen = new Set<string>();
    for (const L of looks) {
      const a = L.atlas;
      if (this.textures.exists(a) || seen.has(a)) continue;
      seen.add(a);
      if (L.multi) this.load.multiatlas(a, v(`${ASSETS}/sprites/${a}.json`), dossier(`${ASSETS}/sprites/`));
      else this.load.atlas(a, v(`${ASSETS}/sprites/${a}.avif`), v(`${ASSETS}/sprites/${a}.json`));
    }
    if (zone.open) {
      // Monde ouvert : monde.json décrit les cartes ; on ne charge d'abord que le ciel et les cartes autour du départ,
      // les autres se chargent en jeu quand le joueur approche (WorldView)
      const open = zone.open, dir = worldDir(open.world);
      this.load.json(WorldView.key(open.world, 'monde'), v(`${dir}/monde.json`));
      this.load.once(`filecomplete-json-${WorldView.key(open.world, 'monde')}`, (_: string, __: string, data: WorldData) =>
        WorldView.preload(this, data, dir, open.world, open.start));
      if (!open.havreSac) Particules.preload(this, dir, open.world, v);   // le Havre-Sac n'a pas de particules
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
    this.zoom = Phaser.Math.Clamp(this.reglages.zoom, ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]); this.cameras.main.setZoom(this.zoom * densite());
    // Phaser arrondit chaque coin d'image séparément : avec un défilement entre deux pixels, une image agrandie gagnait ou
    // perdait un pixel et « tremblait » (2026-11-06), puis tout « bavait » en course (2026-11-08). Le défilement dessiné est
    // donc calé sur un pixel entier de l'écran (pixel.ts) ; l'arrondi des coins (remis par startFollow) devient alors sans effet de bord.
    this.cameras.main.setRoundPixels(false);
    calerCamera(this.cameras.main);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.reglages.zoomMolette) return;   // Réglages 5A
      this.zoom = Phaser.Math.Clamp(this.zoom * (dy > 0 ? 0.9 : 1.1), ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]);
    });
    if (zone.open) {
      const open = zone.open;
      const wg = new WorldGrid(this.cache.json.get(WorldView.key(open.world, 'monde')) as WorldData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map: wg, seed, classId: this.classId, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, apparats: APPARATS, familierXp: FAMILIERS.xp, recoltes: RECOLTES, compte: chargerCompte(), coffre: lireCoffre(this.sorteCoffre), aujourdhui: this.test?.jour ?? jourDuPC(), tuto: this.test ? false : this.perso?.tuto, test: this.test?.reglages,
        placements: this.test ? retouchesPlacement(open.world) : undefined,   // éditeur F1 › Placement : retouches pas encore envoyées
        // vitrine : les PNJ sont là, mais aucune quête ne démarre
        arrivee: this.arrivee, position: this.transit.position, point: this.transit.point, zaap: this.transit.zaap, retour: this.transit.retour,
        zonesVues: [...new Set([...(this.perso?.etat?.zonesVues ?? this.test?.etat?.zonesVues ?? []), ...(this.transit.vues ?? [])])],
        reprise: this.vitrine ? { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } : this.perso?.etat?.quetes ?? this.test?.etat?.quetes });
      this.cameras.main.setBackgroundColor('#0d2b36');   // sous le ciel, au cas où il manque
      this.worldView = new WorldView(this, wg, worldDir(open.world), open.world);
      // bouts de portes : où chacun mène (préchargement 2A) et sorties des intérieurs (repère 8A)
      const dedans = (tag: string) => !!wg.mapByTag(tag)?.inside;
      // (arrivée dans l'arène d'un donjon : pas de repère, on en sort par le portail de la fin)
      this.worldView.portes = this.world.portes.flatMap(p => p.ends.flatMap((e, i) => {
        const to = p.ends[1 - i], marche = !p.vers && !(i === 1 && p.sens);
        if (i === 1 && p.sens && open.donjons?.some(d => d.arene?.tag === e.tag)) return [];
        return [{ ...e, vers: marche ? to.tag : undefined, sortie: marche && dedans(e.tag) && !dedans(to.tag) }];
      }));
      const parts = this.cache.json.get(`${open.world}_particules`) as Record<string, SysData[]> | undefined;
      if (parts) this.worldView.parts = new Particules(this, wg, parts, `${open.world}_particules_img`);
      const tr = this.transparence = new Transparence(this);
      this.worldView.transparence = tr;
      this.events.once('shutdown', () => { tr.destroy(); if (this.transparence === tr) this.transparence = null; });
      this.worldView.create();
      if (this.world.zone.open) { const hv = this.havreSacView = new HavreSacView(this, this.world); this.events.once('shutdown', () => { hv.destroy(); if (this.havreSacView === hv) this.havreSacView = null; }); }
      if (this.world.zone.open?.donjons?.some(d => d.arene)) { const av = this.areneView = new AreneView(this, this.world); this.events.once('shutdown', () => { av.destroy(); if (this.areneView === av) this.areneView = null; }); }
      if (this.world.guerre) { const gv = this.guerreView = new GuerreView(this, this.world); this.events.once('shutdown', () => { gv.destroy(); if (this.guerreView === gv) this.guerreView = null; }); }
      if (this.world.postes.length) { const av = this.atelierView = new AtelierView(this, this.world, `${ASSETS}/ui/reperes`); this.events.once('shutdown', () => { av.destroy(); if (this.atelierView === av) this.atelierView = null; }); }
      if (this.world.recoltes.length) { const rv = this.recolteView = new RecolteView(this, this.world); this.events.once('shutdown', () => { rv.destroy(); if (this.recolteView === rv) this.recolteView = null; }); }
      if (this.world.quetes) {
        this.questView = new QuestView(this, this.world, this.worldView);
        if (this.world.passants) this.passantsView = new PassantsView(this, this.world.passants);
        const dv = this.dialogueView = new DialogueView(this, this.world, this.questView);
        this.events.once('shutdown', () => dv.destroy());
      }
    } else {
      const key = mapDir(zone.map!.coords).replace(/\W/g, '_');
      const map = new GridMap(this.cache.json.get(`${key}_carte`) as MapData);
      this.world = new World({ data: GAME_DATA, zone: this.zoneId, map, seed, classId: this.classId, items: ITEMS, familierXp: FAMILIERS.xp, test: this.test?.reglages });
      this.cameras.main.setBackgroundColor('#12141b');
      drawMap(this, map, `${key}_sol`, `${key}_decor`);
    }
    this.fx = new FX(this, t => hex(GAME_DATA.monsters[t].color));
    const fv = this.familierView = new FamilierView(this, a => this.planche({ atlas: a, multi: true } as Look), () => this.assemblage?.couleursPerso);
    this.events.once('shutdown', () => { fv.destroy(); if (this.familierView === fv) this.familierView = null; });
    if (this.perso?.etat) restaurerJoueur(this.world, this.perso.etat);
    else if (this.test?.etat) restaurerJoueur(this.world, this.test.etat);
    if (this.test?.apres) { this.cmdTest = this.test.apres; this.test.apres = undefined; }
    this.hud = new Hud(this, this.world, this.perso ?? undefined);
    // Accès de test (?test dans l'adresse) : le robot de test lit la partie et téléporte le perso. Le jeu normal n'en a pas.
    if (/[?&]test\b/.test(location.search)) (window as unknown as { __df: unknown }).__df = {
      scene: this, world: this.world,
      /** Téléporte le joueur sur une case libre de la carte « x_y » (noir puis cartes chargées, comme un portail). */
      aller: (tag: string) => {
        if (this.world.allerArene(tag)) { this.attendreCartes(); this.snapCam = true; return true; }   // arène d'un donjon : comme par le gardien
        const wg = this.world.worldGrid, libres = wg?.freeByMap.get(tag);
        if (!wg || !libres?.length) return false;
        const q = wg.cellToWorld(libres[Math.floor(libres.length / 2)]);
        this.world.player.x = q.x; this.world.player.y = q.y; this.attendreCartes(); this.snapCam = true; return true;
      },
      cartes: () => this.world.worldGrid?.world.maps.map(m => m.tag) ?? [],
      transp: () => this.transparence, iso: ISO,
      /** Position à l'écran (pixels du canvas) d'un point du monde, pour cliquer dessus. */
      ecran: (x: number, y: number) => { const q = ISO.toScreen(x, y), c = this.cameras.main, r = c.worldView; return { x: (q.x - r.x) * c.zoom, y: (q.y - r.y) * c.zoom }; },
    };
    this.son = new SonView(this.world, this.look, this.classId, this.vitrine,
      zone.open ? this.cache.json.get(`${zone.open.world}_particules`) as Record<string, SysData[]> | undefined : undefined, this.world.worldGrid ?? undefined);
    this.appliquerSon();
    if (this.questView) { const qv = this.questView; this.hud.portraitPnj = id => qv.portrait(id); }
    this.hud.vivant = () => this.vivant;   // portrait vivant du cadre (Interface 4A)
    const mini = this.cameras.getCamera('mini');
    if (mini && this.worldView?.sky) mini.ignore(this.worldView.sky);
    if (mini && this.transparence) mini.ignore(this.transparence.calque);
    this.windows?.destroy();
    this.windows = new Windows(this.world);
    this.windows.socialSlot = this.perso && persosEnLigne() ? this.slot : -1; this.windows.socialTest = !!this.test;
    // Bestiaire (maquette « Drops » 1A) : les monstres vaincus du compte ; la partie de test voit tout
    this.windows.vaincus = () => this.bestiaire; this.windows.toutVoir = !!this.test;
    this.windows.onZaap = i => { this.zaapChoix = i; };
    this.windows.onCarte = m => { if (this.carte?.dispo) this.carte.montrer(m); };   // Métiers UI 8B, 11B : où trouver une ressource
    this.windows.portrait = v(`${ASSETS}/ui/perso_${this.classId}${this.perso?.sexe === 'f' ? '_f' : ''}.png`);
    // perso dessiné en direct dans l'inventaire, l'aperçu des apparats et la garde-robe (Apparence 5A, 6B)
    this.fichePerso();
    this.windows.onApparence = a => {
      if (this.perso) { this.perso.apparence = a; this.sauver(); } else this.apparenceEssai = a;   // majApparence() réassemble le perso
    };
    if (this.perso) this.windows.onAccueil = () => this.versAccueil();
    this.windows.onMenu = c => this.versAccueil(c === 'persos' ? 'persos' : undefined);   // menu principal (Échap)   // rendu en grand (perso_planche : render.cjs échelle 2,2)
    this.windows.reglages = this.reglages;
    this.appliquerReglages();
    this.hud.onModules = () => { sauverReglages(this.reglages); this.windows?.refresh(); };
    // idée 1 (2026-11-08) : losange au-dessus des monstres qui comptent pour une quête en cours
    EntityView.deQuete = m => { const Q = this.world.quetes; return !!Q && this.hud.flecheQuete && (Q.estEliteDeQuete(m.id) || Q.pourQuete(m.type, m.x, m.y)); };
    this.windows.onReglages = r => { this.zoom = Phaser.Math.Clamp(r.zoom, ZoneScene.ZOOM[0], ZoneScene.ZOOM[1]); this.appliquerReglages(); this.updateAmbiance(true); this.appliquerSon(); };
    this.windows.juice = { get: () => this.fx.juice, set: on => { this.fx.juice = on; } };
    this.windows.nomPerso = () => this.perso?.nom ?? 'Aventurier';
    this.windows.heureNom = () => ambiance(this.reglages, new Date(), !!this.world.worldGrid?.mapAt(this.world.player.x, this.world.player.y)?.inside).nom;
    this.panneau?.destroy(); this.panneau = null;
    this.calques = null;   // ses dessins sont partis avec l'ancienne scène
    this.anims.globalTimeScale = 1; this.tweens.timeScale = 1;   // Panneau test 5B : le ralenti ne survit pas à la partie
    if (this.test) { const pt = this.panneau = new PanneauTest(this.world, this.actionsTest(), this.zoneId); this.events.once('shutdown', () => { pt.destroy(); if (this.panneau === pt) this.panneau = null; }); }
    // Coop (maquette « Multi : » 3A) : l'hôte repose ses invités ici ; chez l'invité, ce monde n'est qu'un miroir de celui de l'hôte
    this.miroir = Coop.miroir;
    const wc = this.world;
    Coop.attacher({ world: wc, annonce: t => this.hud.toast(t), nom: this.perso?.nom ?? '', sauver: () => this.sauver(),
      allerA: (zone, position, arrivee) => { if (this.world === wc) this.scene.restart(zone ? { slot: this.slot, zone, position, arrivee } : { slot: this.slot }); } });
    this.events.once('shutdown', () => Coop.detacher(wc));
    // Présence en ligne (Bastion partagé) : seulement avec un perso du compte, hors partie de test et hors vitrine
    if (this.perso && persosEnLigne() && !this.test && !this.vitrine && !this.essai && this.slot >= 0) {
      const p = this.world.player;
      { const Qd = this.world.quetes; EnLigne.annoncer(this.slot, Coop.miroir ? '__groupe' : this.zoneId, p.x, p.y, objetsPortes(p.equipment, p.apparat), { titre: Qd?.titre ?? '', ornement: Qd?.ornement ? Qd.ornement.icone + 1 : 0 }); }
      // invitation dans un groupe : on le rejoint sans bouger ; donjon lancé par le chef : on le rejoint (on y part)
      EnLigne.onInvitation = (de, g) => montrerInvitation(de, 't\'invite dans son groupe', () => EnLigne.repondreGroupe(g, true), () => EnLigne.repondreGroupe(g, false));
      EnLigne.onDonjon = (de, code, lieu) => montrerInvitation(de, lieu === 'Incarnam' ? 'te propose de jouer ensemble à Incarnam' : `part en donjon${lieu ? ` (${lieu})` : ''}`, () => {
        const j = CompteEnLigne.jeton; if (!j) return;
        if (Coop.etat !== 'hors') { this.hud.toast('Quitte d\'abord ton donjon (Social › Groupe)'); return; }
        Coop.rejoindre(code, { jeton: j, emplacement: this.slot });
      });
      EnLigne.onInfo = t => this.hud.toast(t);
      this.hud.pastilleSocial = demandesEnAttente;
      // chat à canaux (Social 4A) et bulles au-dessus des têtes (4B)
      const ch = this.chat = new ChatVue(), bu = this.bullesChat = new BullesChat(this);
      this.events.once('shutdown', () => { ch.destroy(); bu.destroy(); if (this.chat === ch) this.chat = null; if (this.bullesChat === bu) this.bullesChat = null; });
    } else EnLigne.arreter();
    const pel = this.passantsEnLigne = new PassantsEnLigne(this);
    this.events.once('shutdown', () => { pel.destroy(); if (this.passantsEnLigne === pel) this.passantsEnLigne = null; });
    this.carte?.destroy();
    this.carte = zone.open ? new CarteMonde(this.world, worldDir, `${ASSETS}/ui/reperes`, `${this.slot}_${this.world.player.nom}`) : null;
    // drapeaux et signal posés depuis la carte (9A, 14B) : partent dans l'entrée du joueur
    if (this.carte) this.carte.onGeste = g => { this.carteGeste = { ...this.carteGeste, ...g }; };
    this.events.once('shutdown', () => { this.windows?.destroy(); this.windows = null; this.carte?.destroy(); this.carte = null; });
    this.hud.onSlotHover = (id, x, y) => {
      this.hoverId = id;
      if (!id) { this.windows?.hideTip(); return; }
      const r = this.game.canvas.getBoundingClientRect();
      const k = Phaser.Math.Clamp(this.reglages.echelle || 1, 0.8, 1.5);   // l'interface est à l'échelle choisie (Réglages 7A)
      this.windows?.showHtmlTip(spellTipHtml(this.world.player, id), r.left + x * k, r.top + y * k);
    };
    this.hud.onSlotClick = id => { this.windows?.hideTip(); if (this.world.player.cls.spells[id]) this.windows?.ouvrirSort(id); };
    this.hud.onMenu = name => {
      if (name === 'Inventaire') this.windows!.toggle('inv');
      else if (name === 'Caractéristiques') this.windows!.toggle('car');
      else if (name === 'Métiers') this.windows!.toggle('job');
      else if (name === 'Réglages') this.windows!.toggle('opt');
      else if (name === 'Guide') this.windows!.toggle('guide');
      else if (name === 'Social') this.windows!.toggle('social');
      else if (name === 'Classement') this.windows!.toggle('ladder');
      else if (name === 'Havre-Sac') this.havreSacDemande = true;
      else if (name === 'Sorts') this.windows!.toggle('sorts');
      else if (name === 'Quêtes' && this.world.quetes) this.windows!.toggle('quetes');
      else if (name === 'Succès' && this.world.quetes) this.windows!.toggle('succes');
      else if (name === 'Carte du monde') this.basculerCarte();
      else if (name === 'Bestiaire') this.windows!.toggle('bestiaire');
      else this.hud.toast(`${name} : arrive dans une prochaine version`);
    };
    this.hud.onPasser = id => this.world.quetes?.passer(id);
    this.hud.onSucces = id => this.windows?.ouvrirSucces(id);
    this.hud.onCarteQuete = () => { if (this.carte?.dispo) this.carte.montrerQuete(); };
    this.hud.onMini = () => this.basculerCarte();   // 11A : clic sur la mini-carte
    if (this.vitrine) this.initVitrine();
    else {
      this.cameras.main.startFollow(this.viewOf(this.world.player).sprite, true, 0.12, 0.12, 0, 30);
      // Arrivée 2A : la caméra est posée sur le perso dès la première image (avant : elle glissait depuis le coin de la carte)
      const s = ISO.toScreen(this.world.player.x, this.world.player.y);
      this.cameras.main.centerOn(s.x, s.y - 30); this.snapCam = true;
      this.bindInput();
    }
    if (this.perso || this.test) {
      const quitter = () => this.sauver(), cache = () => { if (document.hidden) this.sauver(); };
      window.addEventListener('beforeunload', quitter); document.addEventListener('visibilitychange', cache);
      this.events.once('shutdown', () => { this.sauver(); window.removeEventListener('beforeunload', quitter); document.removeEventListener('visibilitychange', cache); });
    }
    // Toute arrivée (premier lancement compris, maquette « Arrivée : » 1A ; avant : seulement Zaap, Havre-Sac, porte d'une
    // autre zone) : l'écran de chargement reste jusqu'à ce que la carte du joueur et ses voisines soient posées, au lieu de
    // montrer un fond vide qui se remplit. Interface (5A) et musique (6A) attendent aussi le lever du rideau.
    const wv = this.worldView;
    if (wv && !this.vitrine && !wv.pret(this.world.player.x, this.world.player.y).ok) {
      this.cameras.main.fadeEffect.start(true, 0, 0, 0, 0, true);
      this.cameras.getCamera('ui')?.fadeEffect.start(true, 0, 0, 0, 0, true);
      this.rideau = { etat: 'attente', t: 0, ecran: true, arrivee: true }; wv.presse = true; this.snapCam = true;
      Son.voiler();
    } else { Chargement.cacher(); if (!this.vitrine) this.arriver(); }
    // Accès console / tests automatisés (captures) : la partie et le tirage d'objets
    (window as unknown as { diablofus: unknown }).diablofus = { scene: this, world: this.world, rollItem, ITEMS };
  }

  /** Apparence du joueur : planche de la classe, version femme si le perso en est une. */
  /** Clé du perso dans assets/sprites/squelette/persos.json (iop_m, cra_f...). */
  private get clePerso() { return `${this.classId}_${(this.perso?.sexe ?? this.essai?.sexe) === 'f' ? 'f' : 'm'}`; }
  private assemblage: Assemblage | null = null;
  /** Essai d'une classe (Accueil 8B) : apparence choisie sur l'écran de création. */
  private apparenceEssai?: Apparence;
  private vivant: PersoVivant | null = null;
  private familierView: FamilierView | null = null;
  /** Tête, couleurs et objets visibles du perso dessiné : quand ils changent (objet porté, apparat, garde-robe), le perso est réassemblé. */
  private apparenceCle = '';
  private cleApparence(objets: string[]) { const a = this.perso?.apparence ?? this.apparenceEssai; return JSON.stringify([a?.tete, a?.couleurs, objets]); }
  /** Classe, sexe et apparence complète (tête et couleurs validées) donnés aux fenêtres. */
  private fichePerso() {
    fiches().then(f => { const fi = f[this.clePerso]; if (fi && this.windows) this.windows.perso = { cle: this.clePerso, app: apparenceValide(fi, this.perso?.apparence ?? this.apparenceEssai) }; }, () => {});
  }
  /** Alliés (multi, étape 0) : chaque autre joueur est assemblé comme le perso (classe, tête par défaut, objets portés). */
  private vivantsAllies = new Map<number, PersoVivant | null>();
  private vivantAllie(q: Player): boolean {
    const vv = this.vivantsAllies.get(q.id);
    if (vv !== undefined) return vv !== null;
    this.vivantsAllies.set(q.id, null);
    const cle = Object.keys(GAME_DATA.classes).find(c => GAME_DATA.classes[c] === q.cls) ?? 'iop';
    Assemblage.creer(`${cle}_m`, null, this.objetsDe(q)).then(a => {
      if (!this.sys.isActive() || !this.world.players.includes(q)) return;
      this.vivantsAllies.set(q.id, this.nouveauVivant(a));
    }, () => { /* hors ligne : l'allié reste invisible */ });
    return false;
  }
  private nouveauVivant(a: Assemblage) {
    const vv = new PersoVivant(this, a);
    this.events.once('shutdown', () => { vv.destroy(); if (this.vivant === vv) this.vivant = null; });
    return vv;
  }
  /** Objets dessinés sur un joueur : coiffe, cape, bouclier, apparats, et la Lance en main du Forgelance Armé. */
  private objetsDe(p: Player) { return [...objetsPortes(p.equipment, p.apparat), ...(p.arme ? [LANCE_EN_MAIN] : [])]; }
  /** Réassemble le perso quand son apparence change ; l'ancien reste affiché jusqu'à ce que le nouveau soit prêt. */
  private majApparence() {
    if (!this.assemblage) return;   // perso en planche (secours hors ligne)
    const p = this.world.player, objets = this.objetsDe(p), k = this.cleApparence(objets);
    if (k === this.apparenceCle) return;
    this.apparenceCle = k;
    Assemblage.creer(this.clePerso, this.perso?.apparence ?? this.apparenceEssai, objets).then(a => {
      if (this.apparenceCle !== k || !this.sys.isActive()) return;
      const old = this.vivant;
      this.assemblage = a; this.vivant = this.nouveauVivant(a);
      this.views.get(p.id)?.changerVivant(this.vivant);
      this.time.delayedCall(250, () => old?.destroy());   // le sprite a pris une image du nouveau entre-temps
    }, () => { /* hors ligne : on garde l'ancien */ });
  }
  private get look() { return ((this.perso?.sexe ?? this.essai?.sexe) === 'f' && LOOKS[`${this.classId}_f`]) || LOOKS[this.classId]; }
  /** Coffre partagé (0.3, 12D) : celui des Hardcore est à part, la partie de test a le sien. */
  private get sorteCoffre(): SorteCoffre { return this.test ? 'test' : this.perso?.hardcore ? 'hardcore' : 'normal'; }
  /** Sauvegarde automatique du perso (toutes les 5 s, en quittant la page, en revenant à l'accueil). */
  private sauver = () => {
    if (this.miroir) return;   // coop, chez l'invité : le monde est celui de l'hôte, rien à garder
    if (this.test && this.world) {
      const t = this.test;
      t.etat = exporterJoueur(this.world); t.zone = this.zoneId; t.reglages = { ...REGLAGES_TEST, ...this.world.test };
      const j = this.world.opts.aujourdhui; t.jour = j && j !== jourDuPC() ? j : undefined;   // Outil test 5A
      sauverTest(t); return;
    }
    if (!this.perso || this.slot < 0 || this.mortDefinitive || !this.world) return;
    const p = this.perso;
    p.etat = exporterJoueur(this.world); p.maj = Date.now();
    p.lieu = this.world.area?.name ?? (this.world.dansHavreSac ? 'Havre-Sac' : this.world.dansBastion ? this.world.zone.name : p.lieu);
    sauverPerso(this.slot, p); sauverBestiaire(this.bestiaire);
  };
  /** Retour à l'écran d'accueil (main.ts relance la partie en vitrine). */
  private versAccueil(page?: 'persos') { this.sauver(); this.game.events.emit('accueil', page); }

  /** Partie de test : relance la partie depuis un perso de test écrit d'avance (classe, zone ou état tout prêt). */
  /** Coop, chez l'invité : la partie est celle de l'hôte (ou du serveur), les outils de test n'y ont pas prise. */
  private bloqueEnGroupe() {
    if (!this.miroir) return false;
    this.hud.toast('Pas pendant une partie à plusieurs : quitte d’abord le groupe (F1 › Multi)');
    return true;
  }
  private relancerTest(t: EtatTest) {
    if (this.bloqueEnGroupe()) return;
    sauverTest(t);
    this.test = null;   // la sauvegarde de fin de scène ne doit pas écraser ce qu'on vient d'écrire
    this.scene.restart({});
  }
  private actionsTest() {
    const reglages = () => ({ ...REGLAGES_TEST, ...this.world.test });
    return {
      envoyer: (c: CommandeTest) => { if (!this.bloqueEnGroupe()) this.cmdTest.push(c); },
      forge: () => this.windows?.ouvrirForge(),
      // 4B : même perso, autre classe (les sorts, la barre et les variantes sont ceux de la nouvelle classe)
      classe: (id: string) => {
        if (!this.test) return;
        this.relancerTest({ ...this.test, classe: id, zone: this.zoneId, reglages: reglages(), apres: undefined,
          etat: { ...exporterJoueur(this.world), variants: [], bar: [], learned: [] } });
      },
      zone: (id: string, apres?: CommandeTest[]) => {
        if (!this.test) return;
        const j = this.world.opts.aujourdhui;
        this.relancerTest({ ...this.test, zone: id, reglages: reglages(), etat: exporterJoueur(this.world), jour: j && j !== jourDuPC() ? j : undefined, apres });
      },
      // 9A : un perso tout neuf, monté au niveau, habillé, puis sur la bonne carte
      pret: (i: number) => {
        const e = etatsPrets()[i]; if (!e || !this.test) return;
        const apres: CommandeTest[] = [{ k: 'niveau', n: e.niveau, auto: true }, { k: 'tenue', rarete: e.tenue }, ...e.apres ?? []];
        if (e.carte) apres.push({ k: 'aller', tag: e.carte[0], nom: e.carte[1] });
        this.relancerTest({ classe: e.classe, sexe: this.test.sexe, zone: e.zone, reglages: reglages(), apres, zones: [] });
      },
      poser: () => {},
      // Panneau test 8A, 8B : le perso tel qu'il est (gardé dans « Mes états » ou en code), et le recharger
      instantane: (): EtatTest | null => {
        if (!this.test) return null;
        const j = this.world.opts.aujourdhui;
        return { classe: this.classId, sexe: this.test.sexe, zone: this.zoneId, reglages: reglages(), etat: exporterJoueur(this.world), jour: j && j !== jourDuPC() ? j : undefined, zones: this.test.zones };
      },
      charger: (t: EtatTest) => this.relancerTest({ ...t, reglages: { ...REGLAGES_TEST, ...t.reglages }, apres: undefined }),
      nouveau: () => { if (this.test) this.relancerTest({ classe: this.classId, sexe: this.test.sexe, reglages: reglages(), zones: [] }); },
    };
  }

  private bindInput() {
    const K = Phaser.Input.Keyboard.KeyCodes, kb = this.input.keyboard!;
    // Déplacement à la souris (clic gauche) ; le clavier sert aux sorts, à la potion et aux menus
    // Touches fixes (Maj, Alt, Échap, Entrée, K) ; les autres se changent dans Options › Touches (maquette Réglages 3A, render/touches.ts)
    this.keys = kb.addKeys({ SHIFT: K.SHIFT, ALT: K.ALT, ESC: K.ESC, ENTER: K.ENTER, K: K.K }) as Record<string, Phaser.Input.Keyboard.Key>;
    // Façon Diablo (demande de Mathis, 2026-11-05) : clic gauche sur le sol = y aller (maintenu : suivre le curseur),
    // sur un monstre = s'approcher et l'attaquer (maintenu : continuer), Maj + clic gauche = attaquer sur place ;
    // clic droit = sort favori, Espace = déplacement, 1 à 6 (& é " ' ( - en AZERTY) = barre de sorts.
    // Un clic sur l'interface (barre, mini-carte, menus, fiches) ne fait rien en jeu.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      this.dialogueView?.fermerMenu();
      // Eniripsa 3D : un sort armé (façon Dofus) se lance sur l'allié dont on clique le portrait
      if (this.aimId && this.world.player.cls.eniripsa && this.hud.joueurPortrait(p.x, p.y) != null) { this.pressed = this.aimId; this.aimId = null; this.aimKey = null; this.uiClick = true; return; }
      if (over.length || this.hud.blocks(p.x, p.y)) { this.uiClick = true; return; }
      this.uiClick = false;
      // Panneau test 4E : Ctrl + clic droit copie la carte et la case sous la souris
      if (this.panneau?.calques.coords && p.rightButtonDown() && (p.event as MouseEvent).ctrlKey) {
        const t = this.caseSouris(); this.uiClick = true;
        if (t) navigator.clipboard?.writeText(t).then(() => this.hud.toast(`Copié : ${t}`), () => this.hud.toast(t));
        return;
      }
      // partie de test, onglet Placement (maquette « Monstres » 2A) : clic = poser un point, clic droit = le retirer
      if (this.panneau?.editionPlacement) {
        this.uiClick = true;
        const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, q = ISO.toWorld(wp.x, wp.y);
        this.panneau.editeur.clic(q.x, q.y, p.rightButtonDown()); return;
      }
      // partie de test (7A, 7D) : ce clic pose les monstres choisis dans le panneau (clic droit : annuler)
      const pose = this.panneau?.pose;
      if (pose) {
        this.uiClick = true;
        if (!p.rightButtonDown()) { const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, q = ISO.toWorld(wp.x, wp.y); this.cmdTest.push({ k: 'monstre', ...pose, x: q.x, y: q.y }); }
        this.panneau!.posee(); return;
      }
      // clic droit sur un joueur du Bastion : son menu (Social 6A)
      if (p.rightButtonDown() && this.passantsEnLigne) {
        const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, j = this.passantsEnLigne.sous(wp.x, wp.y);
        if (j) { const e = p.event as MouseEvent; menuJoueur(e.clientX, e.clientY, j); this.uiClick = true; return; }
      }
      // clic droit sur un PNJ : son petit menu d'actions (Dialogues 1C)
      if (p.rightButtonDown()) { const n = this.questView?.pnjUnder(p, this.cameras.main); if (n && this.dialogueView) { this.dialogueView.ouvrirMenu(n, p); return; } }
      // Réglages 5B : le bouton de déplacement peut être le clic droit ; l'autre bouton lance le sort de la case « clic »
      if (this.boutonSort(p.button)) {
        if (this.aimId) { this.aimId = null; this.aimKey = null; return; }   // clic droit pendant la visée : annuler le sort (Mathis, 2026-11-06)
        this.down('CLICD', this.world.player.bar[6]); return;
      }
      if (this.reglages.lancer === 'dofus' && this.aimId) { this.pressed = this.aimId; this.aimId = null; this.aimKey = null; this.uiClick = true; return; }
      // Alt + clic sur un monstre (Osamodas 7C) : la meute l'attaque
      if (this.keys.ALT.isDown && this.world.betes.length) { const m = this.monsterUnder(p); if (m && !m.dead) { this.ordreMeute = m.id; this.uiClick = true; return; } }
      // Alt + clic au sol (carte « suite » 14B) : un signal qui pulse chez tout le groupe
      if (this.keys.ALT.isDown && this.world.zone.open) {
        const wp = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, q = ISO.toWorld(wp.x, wp.y);
        this.carteGeste = { ...this.carteGeste, signal: { x: q.x, y: q.y } }; this.uiClick = true; return;
      }
      this.holding = true;
      if (this.keys.SHIFT.isDown) { this.pressed = 'attaque'; this.clickMode = 'place'; return; }
      const n = this.questView?.pnjUnder(p, this.cameras.main);
      if (n) { this.talkClick = n; this.clickMode = null; this.holding = false; return; }
      const zp = this.zaapSous(p);
      if (zp) { this.zaapClick = zp.name; this.clickMode = null; this.holding = false; return; }
      const pt = this.portailSous(p);
      if (pt) { this.portailClick = pt.nom; this.clickMode = null; this.holding = false; this.moveMarker(p); return; }
      const d = this.dropUnder(p);
      if (d != null) { this.pickClick = d; this.clickMode = null; this.holding = false; return; }
      // un monstre passe avant les ressources et les ateliers derrière lui : sinon impossible de viser un mob près d'un arbre
      const m = this.monsterUnder(p);
      if (!m) {
        const at = this.atelierView?.sous(p, this.cameras.main);
        if (at != null) { this.posteClick = at; this.clickMode = null; this.holding = false; return; }
        const rc = this.recolteView?.sous(p, this.cameras.main);
        if (rc != null) { this.recolteClick = rc; this.clickMode = null; this.holding = false; return; }
      }
      this.clickMode = m ? 'target' : 'ground';
      this.clickTarget = m?.id ?? null;
      if (!m) this.moveMarker(p);
    });
    const release = (e: PointerEvent) => { if (this.boutonSort(e.button)) this.up('CLICD'); else this.holding = false; };
    window.addEventListener('pointerup', release);
    this.events.once('shutdown', () => window.removeEventListener('pointerup', release));
    // Maj (14B) : fil de laisse et barre de vie de chaque bête
    this.keys.SHIFT.on('down', () => { EntityView.barresAllies = true; });
    this.keys.SHIFT.on('up', () => { EntityView.barresAllies = false; });
    // Touches qu'on peut changer : un seul écouteur, l'action vient de render/touches.ts (la touche tenue est retenue pour son relâchement)
    const tenues = new Map<string, string>();
    const bas = (e: KeyboardEvent) => {
      Touches.observer(e);
      if (!this.sys.isActive() || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (this.windows?.capteTouches) return;   // fenêtre des touches : la touche sert à la choisir
      const a = Touches.actionDe(e); if (!a) return;
      e.preventDefault();
      if (e.repeat) return;
      tenues.set(e.code, a);
      this.action(a, true);
    };
    const haut = (e: KeyboardEvent) => { const a = tenues.get(e.code); if (a) { tenues.delete(e.code); this.action(a, false); } };
    const perdu = () => { for (const a of tenues.values()) this.action(a, false); tenues.clear(); };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut); window.addEventListener('blur', perdu);
    this.events.once('shutdown', () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); window.removeEventListener('blur', perdu); });
    this.keys.ESC.on('down', () => { if (this.panneau?.pose) { this.panneau.posee(); return; } if (this.essai) { this.essai = null; this.game.events.emit('accueil', 'creation'); return; } if (this.dialogueView?.ouvert) { this.dialogueView.touche(-1); return; } this.aimId = null; this.aimKey = null;
      // Échap ferme d'abord ce qui est ouvert (fenêtre, carte, menu d'un PNJ, outils F1) ; sinon, ouvre ou ferme le menu principal
      if (this.windows?.open || this.carte?.ouverte || this.dialogueView?.menuOuvert || this.panneau?.ouvert) { this.dialogueView?.fermerMenu(); this.windows?.close(); this.carte?.fermer(); if (this.panneau?.ouvert) this.panneau.basculer(); return; }
      if (!this.vitrine) this.windows?.toggle('menu');
    });
    // K : changer de classe, seulement sans perso (mode dév #cra / #jeu, partie de test) ; sinon la classe se choisit à la création
    if (!this.perso) this.keys.K.on('down', () => { const cl = Object.keys(GAME_DATA.classes), c = cl[(cl.indexOf(this.classId) + 1) % cl.length]; if (this.test) this.actionsTest().classe(c); else this.scene.restart({ zone: this.zoneId, classe: c }); });
    // F1 : outils de la partie de test (3A) ; la touche n'ouvre plus l'aide du navigateur
    if (this.test) kb.addKey(K.F1).on('down', () => this.panneau?.basculer());
    // Panneau test 5A : F2 = pause, F3 = image suivante
    if (this.test) { kb.addKey(K.F2).on('down', () => this.panneau?.basculerPause()); kb.addKey(K.F3).on('down', () => this.panneau?.avancerImage()); }
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
  /** Maquette Recharges 9C : petit tintement discret quand une grosse recharge revient. */
  private rechargeSound() {
    synthe((A, out) => {
      const t0 = A.currentTime;
      for (const [f, d] of [[1320, 0], [1980, 0.05]] as const) {
        const o = A.createOscillator(), g = A.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, t0 + d);
        g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(0.045, t0 + d + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.25);
        o.connect(g).connect(out); o.start(t0 + d); o.stop(t0 + d + 0.3);
      }
    });
  }
  private rageSound() {
    synthe((A, out) => {
      const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.18);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.1, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.4);
    });
  }

  /** Son d'un beau butin. 0.3 (14C) : le Mythique a le sien, plus grave et plus fort que le Légendaire (un gong puis l'arpège). */
  private chime(rarete: 'epique' | 'legendaire' | 'mythique') {
    synthe((A, out) => {
      const mythe = rarete === 'mythique';
      if (mythe) {
        for (const [f, v] of [[196, 0.22], [294, 0.14]] as const) {
          const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime;
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.6);
          o.connect(g).connect(out); o.start(t0); o.stop(t0 + 1.7);
        }
      }
      const notes = mythe ? [587, 880, 1175, 1480, 1760] : rarete === 'legendaire' ? [784, 988, 1319, 1568] : [880, 1175];
      notes.forEach((f, i) => {
        const o = A.createOscillator(), g = A.createGain(), t0 = A.currentTime + (mythe ? 0.18 : 0) + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(mythe ? 0.2 : 0.15, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + (mythe ? 0.9 : 0.6));
        o.connect(g).connect(out); o.start(t0); o.stop(t0 + (mythe ? 0.95 : 0.65));
      });
    });
  }

  /** Volumes des Réglages vers le son (8A), et l'icône du son sur le HUD (8B). */
  private appliquerSon() {
    const r = this.reglages;
    Son.volumes({ general: r.volume, musique: r.volMusique, effets: r.volEffets, monstres: r.volMonstres, ambiance: r.volAmbiance, interface: r.volInterface, muet: r.muet, musiqueBoss: r.musiqueBoss !== false });
    this.hud.muet = r.muet;
  }
  /** M : carte du monde (0.2 18A). */
  private basculerCarte() {
    if (this.carte?.dispo) { this.windows?.close(); this.carte.basculer(); }
    else this.hud.toast('Pas de carte du monde ici');
  }
  private basculerMuet() {
    this.reglages.muet = !this.reglages.muet; sauverReglages(this.reglages); this.appliquerSon();
    this.hud.toast(this.reglages.muet ? 'Son coupé (Ctrl+M pour le remettre)' : 'Son remis');
    this.windows?.refresh();
  }

  /** Survol d'une porte (maquette Entrées 3A, 8A) : son nom au-dessus, « Sortie · … » pour la sortie d'un intérieur.
   *  Le bout survolé fait aussi précharger ce qu'il y a derrière (2A, voir WorldView.prefetch). */
  private porteLabel: Phaser.GameObjects.Text | null = null;
  private porteSurvol(aim: { x: number; y: number }): boolean {
    const po = this.vitrine || this.world.passage ? null : this.world.porteSous(aim.x, aim.y);
    if (!po) { this.porteLabel?.setVisible(false); return false; }   // le contour s'efface plus loin (sauf sur un portail dessiné)
    if (!this.porteLabel) {
      this.porteLabel = this.add.text(0, 0, '', { fontFamily: 'Lexend, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#f3e3bf', backgroundColor: '#0b0910e0',
        padding: { x: 9, y: 5 }, align: 'center' }).setOrigin(0.5, 1).setDepth(1e6);
      this.cameras.getCamera('mini')?.ignore(this.porteLabel);
      const lab = this.porteLabel;
      this.events.once('shutdown', () => { lab.destroy(); if (this.porteLabel === lab) this.porteLabel = null; });
    }
    const c = ISO.toScreen(po.x, po.y);
    // contour du dessin de la porte (façon Sanstour)
    // une sortie d'intérieur : c'est le paillasson posé sur la case qui s'entoure
    this.worldView?.contour(c.x, po.sortie ? c.y + 50 : c.y);
    this.porteLabel.setText(po.sortie ? `Sortie · ${po.nom}` : po.nom).setColor(po.sortie ? '#ffe08a' : '#f3e3bf')
      // une sortie est un repère au sol, souvent sous le perso : son nom va dessous ; une porte dans un mur, au-dessus
      .setOrigin(0.5, po.sortie ? 0 : 1).setPosition(c.x, po.sortie ? c.y + 34 : c.y - 96).setScale(densite() / this.cameras.main.zoom).setVisible(true);
    return true;
  }

  /** Zaap du monde sous le curseur (1A) : l'arche dessinée autour de sa particule officielle. */
  private zaapSous(ptr: Phaser.Input.Pointer) {
    if (this.vitrine || !this.world.zone.open) return null;
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const r = this.world.zaapRefuge(), l = r ? [...this.world.zaapsIci(), r] : this.world.zaapsIci();
    return l.find(z => { const c = ISO.toScreen(z.x, z.y); return ((wp.x - c.x) / 90) ** 2 + ((wp.y - c.y) / 100) ** 2 <= 1; }) ?? null;
  }
  /** Nom d'un Zaap comme dans la fenêtre (Territoire : sa sous-zone). */
  private nomZaap(name: string) {
    const o = this.world.zone.open, c = o?.checkpoints.find(k => k.name === name);
    if (name === this.world.zaapRefuge()?.name) return o?.havreSac ? 'Havre-Sac' : this.world.zone.name;
    return (c?.sub != null ? o!.subareas[String(c.sub)]?.name : null) ?? name;
  }
  /** Survol d'un Zaap (1A) : son nom au-dessus de l'arche. */
  private zaapSurvol(ptr: Phaser.Input.Pointer): boolean {
    const z = this.world.passage || this.world.zaapDepart ? null : this.zaapSous(ptr);
    if (!z) { this.zaapLabel?.setVisible(false); return false; }
    if (!this.zaapLabel) {
      this.zaapLabel = this.add.text(0, 0, '', { fontFamily: 'Lexend, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#dbeeff', backgroundColor: '#0b0910e0',
        padding: { x: 9, y: 5 }, align: 'center' }).setOrigin(0.5, 1).setDepth(1e6);
      this.cameras.getCamera('mini')?.ignore(this.zaapLabel);
      const lab = this.zaapLabel;
      this.events.once('shutdown', () => { lab.destroy(); if (this.zaapLabel === lab) this.zaapLabel = null; });
    }
    const c = ISO.toScreen(z.x, z.y);
    this.zaapLabel.setText(`Zaap · ${this.nomZaap(z.name)}\nClic : voyager`).setPosition(c.x, c.y - 110).setScale(densite() / this.cameras.main.zoom).setVisible(true);
    return true;
  }
  /** Portail dessiné sous le curseur (bassin d'Incarnam, arche de la tour d'Astrub) : l'ovale de son dessin à l'écran. */
  private portailSous(ptr: Phaser.Input.Pointer) {
    if (this.vitrine || this.world.passage || !this.world.zone.open) return null;
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return this.world.portes.find(po => {
      const d = po.dessin; if (!d) return false;
      const c = ISO.toScreen(d.x, d.y);
      return ((wp.x - c.x) / d.rx) ** 2 + ((wp.y - c.y) / d.ry) ** 2 <= 1;
    }) ?? null;
  }
  /** Survol d'un portail dessiné : son contour officiel, et où il mène au-dessus. */
  private portailLabel: Phaser.GameObjects.Text | null = null;
  private portailSurvol(ptr: Phaser.Input.Pointer): boolean {
    const po = this.portailSous(ptr);
    if (!po) { this.portailLabel?.setVisible(false); return false; }
    if (!this.portailLabel) {
      this.portailLabel = this.add.text(0, 0, '', { fontFamily: 'Lexend, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#c9fff4', backgroundColor: '#0b0910e0',
        padding: { x: 9, y: 5 }, align: 'center' }).setOrigin(0.5, 1).setDepth(1e6);
      this.cameras.getCamera('mini')?.ignore(this.portailLabel);
      const lab = this.portailLabel;
      this.events.once('shutdown', () => { lab.destroy(); if (this.portailLabel === lab) this.portailLabel = null; });
    }
    const d = po.dessin!, c = ISO.toScreen(d.x, d.y);
    this.worldView?.contour(c.x, c.y + 50);   // le contour officiel du portail (survols de la carte), comme les portes
    this.portailLabel.setText(`Portail · ${po.nom}\nClic : y aller`).setPosition(c.x, c.y - d.ry - 6).setScale(densite() / this.cameras.main.zoom).setVisible(true);
    return true;
  }
  /** Tourbillon du Zaap (9A) : des éclats bleus happés vers le perso (départ) ou qui s'en échappent (arrivée). */
  private tourbillon(x: number, y: number, arrivee: boolean) {
    const c = ISO.toScreen(x, y), g = this.add.graphics().setDepth(c.y + 5), o = { k: 0 };
    this.cameras.getCamera('mini')?.ignore(g);
    const N = 22, depart = Math.random() * Math.PI * 2;
    this.tweens.add({ targets: o, k: 1, duration: arrivee ? 450 : World.ZAAP_DEPART * 1000, ease: arrivee ? 'Sine.easeOut' : 'Sine.easeIn',
      onUpdate: () => {
        const k = arrivee ? 1 - o.k : o.k;   // k : 0 = loin, 1 = sur le perso
        g.clear();
        g.fillStyle(0x9fd8ff, 0.25 * (1 - Math.abs(0.6 - k))).fillEllipse(c.x, c.y - 40, 70 * (1.2 - k * 0.5), 110 * (1.2 - k * 0.5));
        for (let i = 0; i < N; i++) {
          const a = depart + i / N * Math.PI * 2 + k * 5, r = 90 * (1 - k) + 6, h = 20 + (i % 5) * 18;
          g.fillStyle(i % 3 ? 0x7cc7ff : 0xe8f6ff, arrivee ? o.k < 0.9 ? 1 - o.k : 0 : 0.4 + k * 0.6);
          g.fillCircle(c.x + Math.cos(a) * r, c.y - h + Math.sin(a) * r * 0.5, 2.5 + (i % 2));
        }
      },
      onComplete: () => g.destroy() });
    this.fx.ring(x, y, arrivee ? 10 : 90, arrivee ? 90 : 10, 0x7cc7ff, arrivee ? 0.45 : World.ZAAP_DEPART, 4);
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
    const t = this.add.text(b.x, top, name, { fontFamily: 'Lexend, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: '#ffd9a0', stroke: '#1a0f0a', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(1e6);
    this.tweens.add({ targets: t, y: top - 18, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }
  /** Petit cercle vert là où l'on a cliqué pour aller. */
  private moveMarker(ptr: Phaser.Input.Pointer) {
    const wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const c = this.add.ellipse(wp.x, wp.y, 34, 16).setStrokeStyle(2, 0x9ad15a, 0.9).setDepth(wp.y - 1);
    this.tweens.add({ targets: c, scale: 0.3, alpha: 0, duration: 450, onComplete: () => c.destroy() });
  }

  /** Options ouvertes depuis l'écran d'accueil (Réglages 11A). */
  ouvrirOptions() { this.windows?.show('opt'); this.windows?.devant(); }
  /** Réglages (maquette « Réglages ») qui ne passent pas par l'ambiance ni le son : touches, interface, chiffres, images par seconde. */
  private appliquerReglages() {
    const r = this.reglages;
    Touches.appliquer(r.touches); Touches.regler(r.clavier);
    this.hud.reglages = r; this.hud.flecheQuete = r.flecheQuete;
    this.fx.chiffres = r.chiffres; this.fx.tailleChiffres = r.tailleChiffres === 'petite' ? 0.8 : r.tailleChiffres === 'grande' ? 1.3 : 1;
    EntityView.barresVie = r.barresVie;
    // 7A : échelle de l'interface (caméra de l'interface zoomée depuis le coin haut gauche ; les fenêtres en CSS)
    const k = Phaser.Math.Clamp(r.echelle || 1, 0.8, 1.5), ui = this.cameras.getCamera('ui');
    ui?.setOrigin(0, 0).setZoom(k * densite());   // × vrais pixels de l'écran (pixel.ts)
    document.documentElement.style.setProperty('--echelle', String(k));
    // 7C : images par seconde (0 = sans limite)
    const loop = this.game.loop, fps = r.fps > 0 ? r.fps : 0;
    if (loop.fpsLimit !== fps) {
      loop.fpsLimit = fps; loop.hasFpsLimit = fps > 0; (loop as unknown as { _limitRate: number })._limitRate = fps > 0 ? 1000 / fps : 0;
      loop.sleep(); loop.wake();
    }
  }
  /** Bouton de la souris qui lance le sort de la case « clic » : le droit, ou le gauche si l'on se déplace au clic droit (Réglages 5B). */
  private boutonSort(b: number) { return this.reglages.deplacement === 'droit' ? b === 0 : b === 2; }
  /** Action d'une touche (render/touches.ts) enfoncée ou relâchée. */
  private action(a: string, enfonce: boolean) {
    const p = this.world.player, w = this.windows;
    const sort = /^sort(\d)$/.exec(a), invoc = /^invoc(\d)$/.exec(a);
    if (!enfonce) { if (sort || invoc || a === 'deplacement') this.up(a); return; }
    if (sort) {
      const i = +sort[1] - 1;
      // pendant un dialogue, les touches des sorts 1 à 4 choisissent la réponse (Dialogues 3B)
      if (this.dialogueView?.ouvert && i < 4) this.dialogueView.touche(i); else this.down(a, p.bar[i]);
      return;
    }
    // Osamodas (maquette 2A) : les 4 invocations (cases 8 à 11 de la barre) ; touche de la bête déjà sortie et Éveil plein = l'éveiller (5A)
    if (invoc) { this.down(a, p.bar[Player.INVOC + +invoc[1] - 1]); return; }
    switch (a) {
      case 'deplacement': this.down(a, p.bar[7]); break;
      case 'potion': this.potion = true; break;
      case 'inventaire': w?.toggle('inv'); break;
      case 'caracs': w?.toggle('car'); break;
      case 'sorts': w?.toggle('sorts'); break;
      case 'metiers': w?.toggle('job'); break;
      case 'bestiaire': w?.toggle('bestiaire'); break;
      case 'succes': if (this.world.quetes) w?.toggle('succes'); break;
      case 'dofus': if (p.v03) w?.toggle('dofus'); break;
      case 'guide': w?.toggle('guide'); break;
      case 'social': w?.toggle('social'); break;
      case 'ladder': w?.toggle('ladder'); break;
      case 'chat': this.chat?.ouvrir(); break;
      case 'options': w?.toggle('opt'); break;
      case 'carte': this.basculerCarte(); break;   // M, comme dans Dofus (maquette 0.2, 18A)
      case 'carteTab': if (this.carte?.dispo && !this.carte.ouverte) this.carte.basculerSurimpression(); break;   // 11B : carte en surimpression
      case 'havresac': this.havreSacDemande = true; break;
      case 'coffre': this.coffreDemande = true; break;
      case 'muet': this.basculerMuet(); break;
      case 'impact':
        this.fx.juice = !this.fx.juice;
        this.hud.toast(this.fx.juice ? 'Effets d\'impact : ACTIVÉS' : 'Effets d\'impact : DÉSACTIVÉS (compare !)');
        break;
      case 'fps': this.reglages.compteurFps = !this.reglages.compteurFps; sauverReglages(this.reglages); break;
    }
  }

  /** Touche de sort enfoncée (maquette Aperçu, 1A/1B/1C selon les Réglages) : maintenir pour voir l'aperçu, relâcher pour lancer ;
   *  ou lancer tout de suite (Alt maintenu : aperçu) ; ou viser comme Dofus (la touche arme le sort, clic gauche pour lancer). */
  private down(key: string, id: SkillId | null) {
    if (!id) return;
    const mode = this.reglages.lancer;
    if (this.keys.ALT.isDown && this.world.player.cls.eniripsa) { this.pressed = id; this.aimId = null; this.aimKey = null; return; }   // Eniripsa 3C : Alt + touche = sur soi
    if (mode === 'immediat' && !this.keys.ALT.isDown) { this.pressed = id; return; }
    if (mode === 'dofus' && key !== 'deplacement') { if (this.aimId === id) { this.pressed = id; this.aimId = null; } else { this.aimId = id; this.aimKey = null; } return; }
    this.aimId = id; this.aimKey = key;
  }
  private up(key: string) {
    if (this.aimKey !== key || !this.aimId) return;
    this.pressed = this.aimId; this.aimId = null; this.aimKey = null;
  }

  private readInput(): PlayerInput {
    const ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const aim = ISO.toWorld(wp.x, wp.y), held = this.holding && (this.reglages.deplacement === 'droit' ? ptr.rightButtonDown() : ptr.leftButtonDown()) && !this.uiClick;
    const input: PlayerInput = { move: { x: 0, y: 0 }, aim, pressed: this.pressed, potion: this.potion,
      holdAttack: held && this.clickMode === 'place', pickup: this.pickClick, approach: this.reglages.approche,
      castOn: null };
    // un sort lancé sur un monstre vise le monstre (comme l'aperçu), pas le sol derrière son sprite
    const vise = this.pressed ? this.monsterUnder(ptr) : null;
    if (vise && !vise.dead) { input.castOn = vise.id; input.aim = { x: vise.x, y: vise.y }; }
    // Eniripsa : Alt maintenu = le Mot part sur soi (3C) ; curseur sur le portrait d'un allié = sur lui (3D)
    const moi = this.world.player;
    if (this.pressed && moi.cls.eniripsa) {
      const id = this.keys.ALT.isDown ? moi.id : this.hud.joueurPortrait(ptr.x, ptr.y), q = id == null ? null : this.world.players.find(o => o.id === id);
      if (q) { input.castOn = null; input.aim = { x: q.x, y: q.y }; }
    }
    this.pickClick = null;
    if (this.ordreMeute != null) { input.meute = this.ordreMeute; this.ordreMeute = null; }
    if (this.carteGeste) { input.carte = this.carteGeste; this.carteGeste = null; }
    if (this.havreSacDemande) { input.havreSac = true; this.havreSacDemande = false; }
    if (this.coffreDemande) { input.coffre = true; this.coffreDemande = false; }
    if (this.zaapChoix != null) { input.zaap = this.zaapChoix; this.zaapChoix = null; }
    if (this.cmdTest.length) { input.test = this.cmdTest; this.cmdTest = []; }
    const dv = this.dialogueView;
    if (dv) { input.reponse = dv.reponse; dv.reponse = null; if (dv.menuTalk) { this.talkClick = dv.menuTalk; dv.menuTalk = null; } }
    const np = this.talkClick && this.world.quetes?.pnj(this.talkClick);
    if (np) { input.talk = this.talkClick; input.dest = { x: np.x, y: np.y }; this.clickMode = null; }
    this.talkClick = null;
    // Zaap du Bastion ou arche du Havre-Sac : on marche vers son dessin, la fenêtre s'ouvre devant (World.updateArche)
    const zr = this.world.zaapRefuge(), refuge = !!zr && this.zaapClick === zr.name;
    const zq = this.zaapClick ? refuge ? { x: zr!.x, y: zr!.y } : this.world.devantZaap(this.zaapClick) : null;
    if (zq) { if (!refuge) input.versZaap = this.zaapClick; input.dest = zq; this.clickMode = null; }
    this.zaapClick = null;
    // portail dessiné : on marche jusqu'à sa case ; World le passe en y arrivant (fondu, puis l'autre zone)
    const pc = this.portailClick && this.world.portes.find(o => o.dessin && o.nom === this.portailClick);
    if (pc) { input.dest = { x: pc.ends[0].x, y: pc.ends[0].y }; input.versPortail = pc.nom; this.clickMode = null; }
    this.portailClick = null;
    const ar = this.recolteClick != null ? this.world.approcheRecolte(this.recolteClick) : null;
    if (ar) { input.recolte = this.recolteClick; input.dest = ar; this.clickMode = null; }
    this.recolteClick = null;
    const ap = this.posteClick != null ? this.world.approchePoste(this.posteClick) : null;
    if (ap) { input.atelier = this.posteClick; input.dest = ap; this.clickMode = null; }
    this.posteClick = null;
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
    const monstre = this.monsterUnder(ptr), porte = !monstre && !surPnj ? this.porteSurvol(aim) : false;
    const zaap = !monstre && !surPnj && !porte && this.zaapSurvol(ptr);
    const portail = !monstre && !surPnj && !porte && !zaap && this.portailSurvol(ptr);
    if (!porte) this.porteLabel?.setVisible(false);
    if (!porte && !portail) this.worldView?.contour(null);
    this.game.canvas.style.cursor = monstre ? 'crosshair' : surPnj || zaap ? 'pointer' : porte || portail ? CURSEUR_PORTE : this.atelierView?.curseur() ?? this.recolteView?.curseur() ?? 'default';
    return input;
  }

  private secCommande = -1;
  /** Coop, chez l'invité : la partie tourne chez l'hôte, cette scène recopie ses instantanés et lui envoie les entrées. */
  private miroir = false;
  private passantsEnLigne: PassantsEnLigne | null = null;
  private chat: ChatVue | null = null;
  private bullesChat: BullesChat | null = null;
  private updateMiroir(dt: number) {
    this.acc += dt;
    if (this.acc >= ZoneScene.STEP) { this.acc %= ZoneScene.STEP; Coop.entree(this.readInput(), performance.now()); }
    // une erreur ne doit pas figer l'invité : on la note et on redemande tout à l'hôte (le miroir repart de zéro)
    try {
      for (const s of Coop.prendre()) this.world.rejouer(appliquerInstantane(this.world, s, true));
      lisserMiroir(this.world, dt);   // les autres joueurs et les monstres glissent entre deux instantanés
      this.consumeEvents();
      this.hitstop = 0;
      this.render();
    } catch (e) {
      console.error('coop (invité)', e);
      Coop.toutRedemander();
    }
  }
  update(_: number, deltaMs: number) {
    const t0 = performance.now();
    this.updateJeu(deltaMs);
    // Panneau test 4D, 4E : compteur de fluidité et case sous la souris
    const pt = this.panneau;
    if (pt) {
      this.msMoyen += (performance.now() - t0 - this.msMoyen) * 0.05;
      this.calques ??= new CalquesTest(this);
      this.calques.dessiner(this.world, pt.calques);
      pt.majPerf(pt.calques.perf || pt.calques.coords ? this.texteDebug(pt) : null);
    }
  }
  /** Temps de calcul moyen d'une image (ms), pour le compteur de fluidité de la partie de test. */
  private msMoyen = 0;
  private calques: CalquesTest | null = null;
  private texteDebug(pt: PanneauTest): string {
    const w = this.world, l: string[] = [];
    if (pt.calques.perf) {
      const vivants = w.monsters.filter(m => !m.dead), dort = vivants.filter(m => w.zone.open && m.state === 'idle' && w.players.every(q => Math.abs(m.x - q.x) + Math.abs(m.y - q.y) > World.SOMMEIL)).length;
      l.push(`${Math.round(this.game.loop.actualFps)} FPS · ${this.msMoyen.toFixed(1).replace('.', ',')} ms de calcul par image`);
      l.push(`${vivants.length} monstres (${vivants.length - dort} actifs, ${dort} endormis) · ${w.projectiles.length} projectiles · ${w.betes.filter(b => !b.dead).length} bêtes`);
      if (pt.pause || pt.vitesse !== 1) l.push(pt.pause ? 'EN PAUSE (F2 : reprendre, F3 : image suivante)' : `Vitesse ×${String(pt.vitesse).replace('.', ',')}`);
    }
    if (pt.calques.coords) l.push(this.caseSouris() ?? 'Souris hors de la carte');
    return l.join('\n');
  }
  /** Carte et case sous la souris (4E). */
  private caseSouris(): string | null {
    const wg = this.world.worldGrid, ptr = this.input.activePointer, wp = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, q = ISO.toWorld(wp.x, wp.y);
    const c = wg?.caseLocale(wg.cellAtWorld(q.x, q.y));
    if (!c) return null;
    return `Carte [${c.x},${c.y}] · ${c.tag} · case ${c.c}${wg!.walkable(q.x, q.y) ? '' : ' (bloquée)'}`;
  }
  private updateJeu(deltaMs: number) {
    // Panneau test 5A-5C : pause (le jeu attend, sauf une image demandée), ralenti, accéléré
    const pt = this.panneau, echelle = pt ? (pt.pause ? 0 : pt.vitesse) : 1;
    if (pt && (this.anims.globalTimeScale !== echelle || this.tweens.timeScale !== echelle)) { this.anims.globalTimeScale = echelle; this.tweens.timeScale = echelle; }
    if (pt?.pause && (pt.pasDemande || this.cmdTest.length)) { pt.pasDemande = false; this.acc += ZoneScene.STEP; }   // une image (ou un ordre du panneau)
    const dt = Math.min(deltaMs / 1000, 0.1) * echelle;
    this.fx.update(dt);
    this.carte?.update();
    this.majMarquesCarte();
    // fenêtre d'un Zaap du monde : elle se ferme si l'on s'en éloigne
    if (this.windows?.ouverte === 'zaap' && !this.world.dansRefuge && !this.world.zaapProche() && !this.world.zaapDepart) this.windows.close(false);
    // commande chez Malek (Forgemagie UI 9E) : compte à rebours de la fenêtre, une fois par seconde
    const cmd = this.world.player.commandeFM;
    if (cmd && !cmd.prete && Math.ceil(cmd.reste) !== this.secCommande) { this.secCommande = Math.ceil(cmd.reste); this.windows?.majForge(); }
    if (this.vitrine) this.updateVitrine(dt);
    else if (this.essai) {
      const e = this.essai; e.t += dt;
      if (e.t - dt <= 3 && e.t > 3) this.hud.banner(`Essai : ${ZoneScene.ESSAI} secondes\nÉchap pour revenir à la création`, 2500);
      if (!e.averti && e.t >= ZoneScene.ESSAI - 10) { e.averti = true; this.hud.toast('Plus que 10 secondes d\'essai'); }
      if (e.t >= ZoneScene.ESSAI) { this.essai = null; this.game.events.emit('accueil', 'creation'); return; }
    }
    else if (this.perso || this.test) {
      if (this.perso) this.perso.temps += dt;
      if ((this.sauveT += dt) >= 5) { this.sauveT = 0; this.sauver(); }
    }
    // GEL D'IMAGE : la simulation s'arrête, l'affichage continue (tremblement, chiffres)
    if (this.depart) { this.render(); return; }   // fondu vers une autre zone : plus rien ne bouge
    if (this.miroir) { this.updateMiroir(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; this.render(); return; }
    // ARRIVÉE : écran noir tant que les cartes ne sont pas posées, la partie attend (pas de coup reçu dans le noir)
    if (this.rideau?.etat === 'attente') { this.acc = 0; this.render(); return; }
    // Pas fixe : même résultat quelle que soit la fréquence de l'écran (indispensable pour la coop)
    this.acc += dt;
    if (this.acc < ZoneScene.STEP) { this.render(); return; }   // écran > 60 Hz : on garde la touche pour le prochain pas
    let input = this.vitrine ? { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pressed: null } as PlayerInput : this.readInput();
    while (this.acc >= ZoneScene.STEP && this.hitstop <= 0) {
      this.acc -= ZoneScene.STEP;
      // alliés de test (F1) conduits par le jeu, invités de la coop par leurs propres entrées
      const autres = this.world.players.length > 1 ? { ...entreesAllies(this.world), ...Coop.entrees() } : undefined;
      this.world.step(ZoneScene.STEP, input, autres);
      input = { ...input, pressed: null, potion: false, reponse: null, test: null, havreSac: false, zaap: null };
      this.consumeEvents();
      Coop.apresPas(this.world, ZoneScene.STEP);
    }
    if (this.hitstop > 0) this.acc = 0;
    this.render();
  }

  private consumeEvents() {
    for (const e of this.world.drainEvents()) {
      Coop.noter(e);
      if (this.perso?.stats && this.perso.session) noter(e, this.perso.stats, this.perso.session, this.bestiaire, GAME_DATA.monsters, ITEMS.equipment);
      this.fx.handle(e);
      this.hud.handle(e);
      this.havreSacView?.handle(e);
      if (this.panneau && e.k === 'hit' && e.target === 'monster') this.panneau.noterCoup(e);   // DPS sort par sort, journal (Panneau test 6A, 6B)
      if (this.panneau && e.k === 'hit' && e.target === 'player' && Math.hypot(e.x - this.world.player.x, e.y - this.world.player.y) < 8) this.panneau.noterRecu(e);   // Outil test 8C
      if (this.panneau && (e.k === 'test' || e.k === 'queteDebut' || e.k === 'queteEtape' || e.k === 'queteFin' || e.k === 'lootResource')) this.panneau.rafraichir();
      if (this.panneau && e.k === 'heal' && Math.hypot(e.x - this.world.player.x, e.y - this.world.player.y) < 8) this.panneau.noterSoin(e.amount);
      this.son.handle(e);
      const M = GAME_DATA.monsters;
      switch (e.k) {
        case 'impact':
          if (!this.fx.juice) break;
          if (e.hitstop > 0) this.hitstop = Math.max(this.hitstop, e.hitstop);
          if (e.shake > 0) this.cameras.main.shake(e.big ? 220 : 110, e.shake, true);
          break;
        case 'playerHurt': this.hud.hurtFlash(this.fx.juice); break;
        case 'grosCoup': if (this.fx.juice) this.hud.grosCoup(); break;
        // Maquette « Danger » : entrée du boss (7A) et phase Furieux (5A)
        case 'bossIntro': if (!this.world.arene) this.hud.banner(`${M[e.monster].name}\n${this.world.area?.name ?? this.world.zone.name}`, 2200); break;
        case 'furieux': this.hud.banner(`${e.name}\nFurieux !`, 1300, true); break;
        case 'wave':
          this.hud.banner(e.boss ? `Vague ${e.n}\n${M[e.boss].name}` : e.archi ? `Vague ${e.n}\nArchimonstre : ${M[e.archi].name} !` : `Vague ${e.n}`);
          break;
        case 'noResource': this.hud.noResource(e.res); break;
        case 'rechargePrete': this.rechargeSound(); break;
        case 'rageFull': this.rageSound(); this.hud.toast(`${this.world.player.cls.rage.name} au maximum : ton prochain sort est renforcé !`); break;
        case 'bossDown': if (!this.world.arene) this.hud.banner(`${M[e.monster].name} vaincu !`); break;
        // Arène d'un donjon (maquette « Donjons en vagues ») : carte-titre (11A), vagues, paliers du boss (8C), fin (12A, 13A)
        case 'areneDebut': {
          const cle = e.cle ? ITEMS.resources[e.cle]?.name : null;
          this.hud.banner(`${e.nom}\n${e.boss ? `${M[e.boss].name} · ` : ''}${e.vagues} vagues + le boss${e.reprise ? ` · reprise à la vague ${Math.min(e.reprise, e.vagues)}` : cle ? ` · ${cle}` : ''}`, 1500);
          break;
        }
        case 'areneVague':
          if (e.boss) this.hud.banner(`${M[e.boss].name}\narrive !`, 1600, true);
          else this.hud.banner(e.nom ? `Vague ${e.n} / ${e.total}\n${e.nom} en nombre !` : `Vague ${e.n} / ${e.total}`, 900);
          break;
        case 'arenePalier':
          // « Wabbits : 8A » : paliers propres au boss (Cawottes Woyales à casser, Awmuwe Woyale)
          if (e.renforts) this.hud.banner(`${e.name}\nIl plante des ${M[e.renforts]?.name ?? 'renforts'}s : casse-les !`, 1600, true);
          else if (e.awmuwe) this.hud.banner(`${e.name}\nAwmuwe Woyale : abats ses renforts, gare à son rayon !`, 1600, true);
          else this.hud.banner(`${e.name}\nIntouchable : abats ses renforts !`, 1500, true);
          break;
        // « Wabbits : 7C » : le Kiafin court prévenir la garde (n = 0), ou l'a prévenue
        case 'areneAlarme':
          if (e.n) this.hud.banner(`Alarme !\n${e.n} gardes accourent`, 1200, true);
          else this.hud.toast('Un Tiwabbit Kiafin court donner l\'alarme : rattrape-le !');
          break;
        case 'bossFuite': this.fuite = { suite: e.suite, premier: e.premiers.includes(this.world.player.id), name: e.name }; break;
        case 'areneFin': {
          // « Wabbits : 8B + 9A » : le boss s'est enfui ; la première fois, son trou mène au donjon suivant
          const f = this.fuite; this.fuite = null;
          if (f) this.hud.banner(`Le ${f.name} s'enfuit dans son trou !\n${f.premier ? `Saute dedans pour le suivre : ${f.suite}` : 'Le trou se referme derrière lui'} · ${chrono(e.temps)}${e.record ? ' · record !' : ''}`, 3200);
          else this.hud.banner(`${e.nom} terminé !\n${chrono(e.temps)}${e.record ? ' · nouveau record !' : ''} · portail et coffre à l'estrade`, 2600);
          break;
        }
        // Guerre des Cawottes (maquette « Guerre : » 6C, 10A, 10D) : annonce aux joueurs de l'île, vagues, vols, bilan
        case 'guerreDebut': this.hud.banner(`${e.spontanee ? 'Les Wabbits attaquent !' : 'L\'attaque commence !'}\n${e.champ} · ${e.vagues} vagues · ${e.cawottes} cawottes à défendre${e.spontanee ? ' · +50 % de Cawottes' : ''}`, 2200, e.spontanee); break;
        case 'guerreVague': this.hud.banner(`Vague ${e.n} / ${e.total}`, 800); break;
        case 'guerreVol': this.hud.toast(e.fuite ? `Le Kiafin s'est enfui avec une cawotte (${e.reste} restantes)` : `Une cawotte arrachée ! (${e.reste} restantes)`); break;
        case 'guerreFuite': this.hud.toast('Un Tiwabbit Kiafin s\'enfuit avec une cawotte : rattrape-le !'); break;
        case 'guerreReplantee': this.hud.toast('Kiafin rattrapé : la cawotte est replantée'); break;
        case 'guerreFin': {
          const C = { or: 'Coffre en or', argent: 'Coffre en argent', bronze: 'Coffre en bronze' };
          this.hud.banner(e.coffre ? `${e.champ} défendu !\n${e.sauvees} / ${e.total} cawottes · ${C[e.coffre]} : +${e.gain} Cawottes · ${chrono(e.temps)}${e.record ? ' · record !' : ''}`
            : `${e.champ} ravagé\nToutes les cawottes ont été volées`, 3200, !e.coffre);
          this.windows?.refresh();
          break;
        }
        case 'playerDeath':
          if (this.essai) { this.hud.banner('Essai terminé', 1500); this.time.delayedCall(1500, () => { if (this.essai) { this.essai = null; this.game.events.emit('accueil', 'creation'); } }); }
          else if (this.perso?.hardcore) {
            // Hardcore (choix 10D) : la mort efface le personnage
            this.mortDefinitive = true;
            // Cimetière des héros (Accueil 11A) : une stèle avec le monstre le plus proche au moment de la mort
            const p = this.world.player, pr = this.perso;
            const tueur = this.world.monsters.filter(m => !m.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
            const stele = { cree: pr.cree, nom: pr.nom, classe: pr.classe, sexe: pr.sexe, niveau: p.level, temps: Math.round(pr.temps), lieu: this.world.area?.name ?? pr.lieu, tueur: tueur?.def.name ?? 'Inconnu', date: Date.now() };
            enterrer(stele);
            // Ladder 3B : en ligne, le classement garde sa ligne dans « Tombés en Hardcore »
            CompteEnLigne.tomber(this.slot, { niveau: stele.niveau, lieu: stele.lieu, tueur: stele.tueur });
            supprimerPerso(this.slot);
            this.hud.banner(`${this.perso.nom} est mort\nMode Hardcore : Entrée pour revenir à l'accueil`, 0, true);
          } else if (this.world.guerre?.attaque && !this.world.guerre.attaque.fini && this.world.guerre.surIle().includes(this.world.player)) {
            this.hud.banner(`Vaincu\nRetour au bord du champ dans ${GUERRE.retour} s`, GUERRE.retour * 1000, true);
            this.time.delayedCall(GUERRE.retour * 1000, () => { if (this.world.player.dead && this.world.over) this.world.respawnPlayer(); });
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
        case 'bagFull': this.hud.toast('Sac plein : recycle des objets chez Kerubim Crépin (son guichet du Havre-Sac, touche H) ou Maj + clic dans l\'inventaire'); break;
        case 'monsterCast': this.castName(e.id, e.name); break;
        case 'itemDrop': if (this.reglages.alerteButin !== false && (e.rarity === 'epique' || e.rarity === 'legendaire' || e.rarity === 'mythique')) this.chime(e.rarity === 'mythique' && !this.world.player.v03 ? 'legendaire' : e.rarity); break;   // 14C : son du Mythique en 0.3
        // Métiers UI 10C : bannière aux paliers (10, 20, 30…) avec les recettes débloquées, une ligne dans le fil sinon
        case 'metierLevel': {
          const nom = ITEMS.metiers?.[e.metier]?.name ?? 'Métier', neuves = recettesAuNiveau(ITEMS, e.metier, e.level).map(r => ITEMS.resources[r.result]?.name).filter(Boolean);
          if (estPalier(e.level)) this.hud.banner(`${nom} niveau ${e.level} !${neuves.length ? `\n${neuves.length > 1 ? `${neuves.length} nouvelles recettes` : 'Nouvelle recette'} : ${neuves.slice(0, 3).join(', ')}` : ''}`, 2200);
          else this.hud.loot(`${nom} niveau ${e.level}${neuves.length ? ` · nouvelle recette : ${neuves.join(', ')}` : ''}`, '#b9e54b');
          this.windows?.refresh(); break;
        }
        case 'atelier': this.windows?.artisanat(e.metier); break;
        case 'fabricationDebut': Son.jouer(MANIFESTE.ui.ok, 'interface', { cle: 'clic', ecart: 0.05 }); this.windows?.refresh(); break;
        case 'fabricationStop': this.hud.toast('Fabrication interrompue'); this.windows?.refresh(); break;
        case 'craft': this.hud.loot(`${(ITEMS.resources[e.id] ?? ITEMS.equipment[e.id])?.name ?? 'Objet'} x${e.n}${e.rares ? ` (${e.rares} Rare${e.rares > 1 ? 's' : ''})` : ''}`, e.rares ? '#6fb2e8' : '#9ad15a'); this.windows?.refresh(); break;
        case 'eat': this.windows?.refresh(); break;
        // PNJ du Havre-Sac (maquette Hub 4A) : la réponse « service » de son dialogue ouvre sa fenêtre (recycler, boutique, apparats, miroir)
        case 'service': if (this.windows && (e.service === 'recycler' || e.service === 'boutique' || e.service === 'apparat')) { this.windows.empPnj = e.pnj; this.windows.empOnglet = e.service; this.windows.show('emp'); }
          else if (this.windows && e.service === 'forgemagie') this.windows.ouvrirForge();
          else if (this.windows && e.service === 'garde-robe') this.windows.show('garde');
          else if (this.windows && e.service === 'almanax') this.windows.show('almanax');
          break;
        case 'incantation': this.hud.toast('Havre-Sac : incantation…'); break;
        case 'arche': this.windows?.show('zaap'); break;
        case 'emmenage': this.hud.toast(`${e.noms.join(', ')} ${e.noms.length > 1 ? 'ont emménagé' : 'a emménagé'} au Bastion des Douze (Zaap ou Potion de Rappel)`); break;
        case 'forge': this.windows?.noteForgeEvt(e); break;
        case 'brisage': { const n = Object.values(e.runes).reduce((a, b) => a + b, 0);
          if (e.auto) { this.hud.loot(`${ITEMS.equipment[e.auto]?.name ?? 'Objet'} brisé : ${n} rune${n > 1 ? 's' : ''}`, '#b77cf0'); this.windows?.refresh(); break; }
          this.hud.loot(`${n} rune${n > 1 ? 's' : ''} (${e.n} objet${e.n > 1 ? 's' : ''} brisé${e.n > 1 ? 's' : ''})`, '#b77cf0');
          this.windows?.noteForge({ t: `${e.n > 1 ? `${e.n} objets brisés` : 'Objet brisé'} : ${Object.entries(e.runes).map(([id, k]) => `${k} ${ITEMS.resources[id]?.name ?? id}`).join(', ') || 'aucune rune'}`, c: 'br' }); break; }
        case 'codex': { const o = POUVOIR_PAR_ID[e.id], c = PC_PAR_ID[e.id]; this.hud.loot(`Codex : ${o ? o.sort : c ? c.nom : LEGENDARY[e.id as keyof typeof LEGENDARY]?.name ?? e.id} enregistré`, '#f08a2c');
          this.windows?.noteForge({ t: `Pouvoir enregistré dans le Codex : ${o ? o.officiel : c ? c.nom : LEGENDARY[e.id as keyof typeof LEGENDARY]?.name ?? e.id}`, c: 'ok' }); break; }
        case 'capture': this.hud.loot(`${GAME_DATA.monsters[e.monster]?.name ?? 'Archimonstre'} capturé dans une pierre d'âme${e.neuf ? ' (nouveau)' : ''}`, '#ffd27a'); this.windows?.refresh(); break;
        case 'dofusGagne': this.hud.loot(`${PORTABLE(e.id)?.nom ?? 'Dofus'} obtenu ! ${TROPHEES[e.id] && !this.world.player.dofusPortes.includes(e.id) ? 'Il est dans ton sac (fenêtre des Dofus, onglet Trophées)' : 'Il est dans tes emplacements de Dofus (Inventaire)'}`, '#e8c76b'); this.sauver(); this.windows?.refresh(); break;
        case 'dofusPassif': if (e.dofus === 'argente') this.hud.loot(`Souvenir d'Argent : +${e.n ?? 0} PV`, '#e8c76b'); break;   // le bouclier du Cacao se voit déjà (bouclier violet)
        case 'almanax': this.hud.loot(`Almanax : offrande faite, +${e.pepites} Pépites et « ${e.bonus} » jusqu'à minuit`, '#ffd27a'); this.sauver(); this.windows?.refresh(); break;
        case 'coffreOuvert': if (this.windows) { this.windows.coffreHardcore = this.sorteCoffre === 'hardcore'; this.windows.show('coffre'); } break;
        // l'objet a changé de place : coffre et perso sauvés ensemble (pas d'objet perdu ni doublé si la page se ferme)
        case 'coffre': sauverCoffre(this.sorteCoffre, this.world.coffre); this.sauver(); this.windows?.refresh(); break;
        case 'codexOuvert': this.hud.loot('Le Codex des pouvoirs s\'ouvre : brise un Légendaire chez Malek pour garder son pouvoir', '#f08a2c'); this.windows?.refresh(); break;
        case 'impression': { const o = POUVOIR_PAR_ID[e.id], c = PC_PAR_ID[e.id]; this.hud.loot('Impression réussie : l\'objet devient Légendaire', '#f08a2c');
          this.windows?.noteForge({ t: `Impression : ${o ? o.officiel : c ? c.nom : LEGENDARY[e.id as keyof typeof LEGENDARY]?.name ?? e.id}`, c: 'ok' }); break; }
        case 'apparence': this.hud.loot(`Apparence débloquée : ${ITEMS.equipment[e.id]?.name ?? 'objet'}`, '#e6b85c'); break;
        case 'fusion': this.windows?.noteForge({ t: `Fusion : ${e.n} ${ITEMS.resources[e.vers]?.name ?? e.vers}`, c: 'br' }); break;
        case 'commande':
          if (e.etat === 'confiee') this.windows?.noteForge({ t: `Objet confié à Malek : ${e.essais} rune${e.essais > 1 ? 's' : ''} à poser, prêt dans ${mmss(e.reste)}`, c: 'ne' });
          else if (e.etat === 'prete') { this.hud.toast('Malek le Forgemage a fini ta commande : ton objet t\'attend au Bastion des Douze'); this.windows?.noteForge({ t: 'Malek a fini ta commande', c: 'ok' }); }
          this.windows?.majForge(); break;
        case 'signature': this.hud.loot(`Objet signé : ${e.nom}`, '#e6b85c'); break;
        case 'recycle': this.hud.loot(`+${e.pepites} Pépite${e.pepites > 1 ? 's' : ''}${e.n > 1 ? ` (${e.n} recyclés)` : ''}`, '#b9e54b'); break;
        case 'achat': this.hud.loot(`${ITEMS.resources[e.id]?.name ?? 'Objet'} acheté (−${e.prix} Pépites)`, '#b9e54b'); break;
        case 'rappel': this.hud.banner(`Rappel\n${e.name}`, 1200); this.snapCam = true; break;
        // 17A : lieu découvert (bandeau, un peu d'XP)
        case 'lieuDecouvert': this.hud.banner(`Lieu découvert : ${e.nom}\n+${e.xp} XP`, 2000); Son.jouer(MANIFESTE.ui.objectif, 'interface', { vol: 0.7 }); break;
        // 14B : signal d'un joueur du groupe (Alt + clic)
        case 'signal': Son.jouer(MANIFESTE.ui.checkpoint, 'interface', { vol: 0.6, vitesse: 1.3, cle: 'signal', ecart: 0.5 }); break;
        case 'recolteFin': {
          const r = RECOLTES.ressources[e.item];
          this.hud.loot(`${r?.nom ?? 'Ressource'} x${e.n}${e.dore ? ' (dorée !)' : ''}`, e.dore ? '#ffd34a' : '#9ad15a'); this.windows?.refresh(); break;
        }
        case 'recolteNiveau': this.hud.toast(`Il faut ${RECOLTES.metiers[e.metier]?.nom ?? 'ce métier'} niveau ${e.niveau} pour récolter cette ressource`); break;
        case 'cleManquante': {
          const ve = this.world.quetes?.vendeurDe(e.id), nom = ve ? this.world.quetes!.data.pnj[ve].nom : 'un marchand';
          this.hud.toast(`${ITEMS.resources[e.id]?.name ?? 'Une clé'} requise : ${nom} en vend une, au Bastion des Douze`); break;
        }
        case 'lootResource': this.hud.loot(`${ITEMS.resources[e.id]?.name ?? 'Ressource'} x${e.n}`, '#c9c4ab'); this.windows?.refresh(); break;
        case 'levelUp': this.hud.banner(`Niveau ${e.level} !\n+5 points (C)${e.level === 100 ? '\n+1 PA' : ''}`, 1500); this.windows?.refresh(); break;
        case 'newSpell': {
          const KEY = [...[1, 2, 3, 4, 5, 6].map(i => Touches.nomAction(`sort${i}`)), this.reglages.deplacement === 'droit' ? 'clic gauche' : 'clic droit', Touches.nomAction('deplacement')];
          this.hud.toast(`Nouveau sort : ${this.world.player.cls.spells[e.id]?.name ?? e.id}${e.slot >= 0 ? ` (${KEY[e.slot]})` : ` · ${Touches.nomAction('sorts')} pour le placer`}`);
          this.windows?.refresh(); break;
        }
        // 3A : un Zaap tout juste découvert a son bandeau (qui dit aussi « point de retour »)
        case 'checkpoint': if (e.name === this.zaapAnnonce) this.zaapAnnonce = null; else this.hud.banner(`Point de retour\n${e.name}`, 1400); break;
        case 'zaapDecouvert': this.zaapAnnonce = e.name; this.hud.banner(`Zaap découvert : ${this.nomZaap(e.name)}\nPoint de retour, et voyage gratuit vers tous tes Zaaps`, 2200); break;
        case 'zaapDepart': this.windows?.close(false); this.tourbillon(e.x, e.y, false);
          Son.jouer(MANIFESTE.teleport?.[Math.floor(Math.random() * (MANIFESTE.teleport?.length ?? 1))], 'ambiance', { vol: 0.9 }); break;
        case 'respawn': this.hud.banner('De retour !', 900); this.attendreCartes(); this.snapCam = true; break;
        // même nom que l'intérieur où l'on est déjà annoncé (salles d'un donjon) : pas de second bandeau
        case 'enterArea': if (!this.vitrine && e.name !== this.world.lieu) this.hud.zoneBanner(e.name, this.world.area?.region ?? this.world.zone.name, e.level, this.decouvrir(e.name)); break;
        case 'enterLieu': if (!this.vitrine) this.hud.zoneBanner(e.name, e.region, e.level, this.decouvrir(e.name)); break;
        case 'queteDebut': {
          const q = this.world.quetes!.def(e.id);
          if (q.type !== 'tutoriel') this.hud.toast(`Nouvelle quête : ${q.nom}`);
          this.windows?.refresh(); break;
        }
        case 'queteEtape': this.windows?.refresh(); break;
        case 'queteFin': {
          const q = this.world.quetes!.def(e.id);
          if (!e.sautee) this.hud.banner(`Quête terminée\n${q.nom}`, 1600);
          if (q.type === 'tutoriel' && !this.test) sauverCompte(this.world, 1);   // partie de test : rien ne compte (10A)
          // fin du tutoriel (idée B) : plus aucune quête de tutoriel en cours un instant après, on invite au Discord
          if (q.type === 'tutoriel' && !e.sautee && !this.test) this.time.delayedCall(2500, () => {
            const qs = this.world.quetes; if (!qs || qs.enCours.some(c => qs.def(c.id).type === 'tutoriel')) return;
            Parcours.noter('tuto'); inviterDiscord();
          });
          this.windows?.refresh(); break;
        }
        case 'queteInfo': this.hud.toast(e.texte); break;
        case 'sacQuete': { const it = ITEMS.equipment[e.id]; if (it) this.hud.loot(`Sac de quête : ${it.name}`, RARITY_COLORS[e.rarity]); break; }
        case 'objetQuete': this.hud.loot(`${e.nom}  ${e.n}/${e.sur}`, '#9ad15a'); break;
        case 'succes': {
          const s = QUETES.succes[e.id];
          this.hud.succes(s.nom, s.points, e.id); if (!this.test) sauverCompte(this.world); this.windows?.refresh(); break;
        }
        case 'test': this.hud.toast(e.texte); this.windows?.refresh(); break;
        case 'portalStart': {
          // portail dessiné (bassin, arche) : l'anneau turquoise se referme sur le perso pendant le fondu
          if (this.world.portes.some(o => o.dessin && o.nom === e.nom)) this.fx.ring(this.world.player.x, this.world.player.y, 110, 10, 0x5ff2dc, World.PASSAGE + 0.1, 5);
          this.baisserRideau(); break;
        }   // fondu de sortie (0,2 s), le perso attend devant la porte
        // portail vers une autre zone : on sauve le perso puis la partie repart là-bas (même emplacement)
        case 'changeZone': this.partir(e); return;
        case 'portal': this.attendreCartes(); this.snapCam = true; break;   // noir, la caméra saute avec le joueur
      }
    }
  }

  /** Vers une autre zone : on sauve le perso, fondu au noir de 0,2 s (sauf s'il est déjà noir : porte, mort),
   *  puis la partie repart là-bas. Le Havre-Sac passe comme une porte, avec le son du sac (Entrées 14A) ;
   *  les autres zones ont l'écran de voyage (15A). */
  private partir(e: Extract<SimEvent, { k: 'changeZone' }>) {
    if (this.depart) return;
    this.sauver();
    this.depart = true;
    const sac = e.zone === 'havresac';
    const par: Arrivee = sac ? { mode: 'porte' } : { mode: 'voyage', zone: e.zone, nom: GAME_DATA.zones[e.zone]?.name ?? e.nom };
    if (sac || this.world.dansHavreSac) Son.jouer(MANIFESTE.ui.ouvrir, 'interface', { vitesse: sac ? 0.8 : 0.9, vol: 0.8 });
    const go = () => this.scene.restart({ slot: this.slot, zone: e.zone, arrivee: e.arrivee, position: e.position, point: e.point, zaap: e.zaap, retour: e.retour, vues: this.world.player.zonesVues, par });
    const cam = this.cameras.main, noir = this.rideau?.etat === 'sortie' || (cam.fadeEffect.isRunning && cam.fadeEffect.direction) || (cam.fadeEffect.isComplete && cam.fadeEffect.direction);
    if (noir || this.vitrine) { go(); return; }
    cam.fadeOut(World.PASSAGE * 1000, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }

  /** Fondu au noir de sortie (5A : 0,2 s, la durée World.PASSAGE). */
  private baisserRideau() {
    if (this.vitrine || !this.worldView) return;
    this.cameras.main.fadeOut(World.PASSAGE * 1000, 0, 0, 0);
    this.rideau = { etat: 'sortie', t: 0, ecran: false };
  }
  /** Arrivée d'un coup (porte, mort, fin de quête, Zaap) : noir tout de suite, puis attente des cartes (render). */
  private attendreCartes() {
    if (this.vitrine || !this.worldView) { this.cameras.main.fadeIn(450, 0, 0, 0); return; }
    this.cameras.main.fadeEffect.start(true, 0, 0, 0, 0, true);
    this.rideau = { etat: 'attente', t: 0, ecran: false };
    this.worldView.presse = true;
  }
  /** Lève le rideau quand la carte du joueur et ses voisines sont posées (fondu d'entrée 0,3 s). */
  private leverRideau(dt: number) {
    const r = this.rideau, wv = this.worldView;
    if (!r || !wv) return;
    r.t += dt;
    if (r.etat === 'sortie') {   // porte annulée (mort pendant le fondu) : on rouvre
      if (!this.world.passage && r.t > World.PASSAGE + 0.3) { this.cameras.main.fadeIn(300, 0, 0, 0); this.rideau = null; }
      return;
    }
    const p = this.world.player, etat = wv.pret(p.x, p.y);
    if (!r.ecran && r.t > ZoneScene.RIDEAU_ECRAN && !etat.ok) { r.ecran = true; Chargement.montrer(); }
    if (r.ecran) Chargement.monde(etat.p);
    if (!etat.ok && r.t < ZoneScene.RIDEAU_MAX) return;
    if (r.ecran) Chargement.cacher();
    this.cameras.main.fadeIn(r.ecran ? 400 : 300, 0, 0, 0);
    // 5A : l'interface (HUD, bandeau, mini-carte) apparaît sous le même fondu que le monde, jamais sur un écran vide
    if (r.arrivee) this.cameras.getCamera('ui')?.fadeIn(400, 0, 0, 0);
    wv.presse = false; this.rideau = null;
    if (r.arrivee) this.arriver();
  }
  /** Le monde est affiché après un chargement : musique en fondu (6A), tourbillon à la connexion (4A), chrono (7A). */
  private arriver() {
    Son.lever(1.5);
    const open = this.world.zone.open, connexion = ZoneScene.connexion && !this.essai, p = () => this.world.player;
    if (!this.essai) ZoneScene.connexion = false;
    // maquette « Zaap : » 9A : arrivée par un Zaap, les éclats du tourbillon s'échappent du perso ; Arrivée 4A : pareil à la
    // connexion, avec le son du Zaap. Joués au lever du rideau (avant : 0,3 s après la création, donc souvent sous l'écran noir).
    if (open && (this.transit.zaap || connexion)) this.time.delayedCall(300, () => {
      this.tourbillon(p().x, p().y, true);
      const l = MANIFESTE.teleport; if (connexion && l?.length) Son.jouer(l[Math.floor(Math.random() * l.length)], 'ambiance', { vol: 0.6 });
    });
    // arrivée par un portail d'une autre zone : un anneau turquoise s'ouvre autour du perso, posé à côté du portail
    else if (open && this.arrivee) this.time.delayedCall(300, () => this.fx.ring(p().x, p().y, 10, 110, 0x5ff2dc, 0.6, 5));
    if (ZoneScene.clicJouer !== null) { Parcours.arrivee(performance.now() - ZoneScene.clicJouer); ZoneScene.clicJouer = null; }
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
            : this.kamasIcon(d.kamas ?? 1, p),
          label: big >= 0 ? this.add.text(p.x, p.y - 40, ITEMS.equipment[d.item!.id]?.name ?? '', {
            fontFamily: 'Lexend, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: col, stroke: '#000', strokeThickness: 3,
            backgroundColor: '#0d0c0acc', padding: { x: 4, y: 2 },
          }).setOrigin(0.5) : undefined,
          // colonne : un halo de la couleur de la rareté et un cœur blanc, plus haute à chaque rang
          beam: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setTint(tint)
            .setDisplaySize(30 + big * 6, [110, 160, 220, 290][big]) : undefined,
          core: big >= 0 ? this.add.image(p.x, p.y, 'beam').setOrigin(0.5, 1).setDisplaySize(8 + big * 2, [90, 135, 185, 250][big]) : undefined,
        };
        if (!d.item) {
          const tier = this.kamasTier(d.kamas ?? 1), n = [3, 5, 8][tier];
          v.tier = tier;
          v.coins = Array.from({ length: n }, () => this.add.image(p.x, p.y, 'kamas_piece').setDisplaySize(15, 8).setOrigin(0.5, 1));
          v.shine = this.add.image(p.x, p.y, v.icon.texture.key).setOrigin(0.5, 1).setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        }
        this.dropViews.set(d.uid, v);
      }
      if (!d.item) { this.drawKamas(d, v, p, w.shown(d)); continue; }
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
    for (const [uid, v] of this.dropViews) if (!seen.has(uid)) { v.icon.destroy(); v.label?.destroy(); v.glow.destroy(); v.beam?.destroy(); v.core?.destroy(); v.coins?.forEach(c => c.destroy()); v.shine?.destroy(); this.dropViews.delete(uid); }
  }

  /** Kamas A : taille du tas selon la somme, comparée au niveau du joueur (petite poignée, tas, gros tas d'élite ou de boss). */
  private kamasTier(n: number) { const r = n / Math.max(1, this.world.player.level); return r < 2.2 ? 0 : r < 8 ? 1 : 2; }
  private kamasIcon(n: number, p: { x: number; y: number }) {
    const t = this.kamasTier(n);
    return t === 0 ? this.add.image(p.x, p.y, 'kamas_piece').setDisplaySize(17, 9).setOrigin(0.5, 1)
      : this.add.image(p.x, p.y, 'kamas_tas').setDisplaySize(t === 1 ? 24 : 36, t === 1 ? 24 : 36).setOrigin(0.5, 1);
  }
  /** Kamas B + D : la gerbe de pièces qui jaillit, tourne sur elle-même et rebondit, puis le tas qui scintille.
   *  Tout se calcule depuis l'âge du butin (d.t) : rien n'est gardé à part la chute déjà sonnée. */
  private drawKamas(d: { uid: number; t: number }, v: NonNullable<ReturnType<typeof this.dropViews.get>>, p: { x: number; y: number }, shown: boolean) {
    const t = d.t, U = 0.42, B = 0.16, pop = Math.min(1, t * 4);
    v.glow.setPosition(p.x, p.y).setDepth(p.y - 2).setScale(pop * (0.6 + 0.2 * (v.tier ?? 0))).setVisible(shown);
    // le tas (ou la pièce seule) se pose quand la gerbe retombe
    const k = Phaser.Math.Clamp((t - U * 0.8) / 0.18, 0, 1), sc = k < 1 ? Phaser.Math.Easing.Back.Out(k) : 1;
    const [iw, ih] = v.tier === 0 ? [17, 9] : v.tier === 1 ? [24, 24] : [36, 36];
    v.icon.setPosition(p.x, p.y).setDepth(p.y + 1).setDisplaySize(Math.max(0.01, iw * sc), Math.max(0.01, ih * sc)).setVisible(shown && sc > 0.01);
    // la gerbe : chaque pièce part dans sa direction, monte, retombe et rebondit une fois
    const coins = v.coins ?? [], n = coins.length;
    coins.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + d.uid * 1.7, r = 9 + ((d.uid * 7 + i * 13) % 13), H = 26 + ((d.uid + i * 5) % 4) * 7;
      const f = Math.min(1, t / U), ox = Math.cos(a) * r * f, oy = Math.sin(a) * r * 0.5 * f;
      const h = t < U ? Math.sin(Math.PI * f) * H : t < U + B ? Math.sin(Math.PI * (t - U) / B) * H * 0.22 : 0;
      const air = t < U + B, spin = air ? 0.15 + 0.85 * Math.abs(Math.cos(t * 19 + i * 1.3)) : 1;
      c.setPosition(p.x + ox, p.y + oy - h).setScale(15 / c.width * spin, 8 / c.height).setDepth(p.y + oy + (air ? 2 : 0.5)).setVisible(shown);
    });
    // chute : le son officiel des pièces, une fois, quand la gerbe touche le sol (seulement si c'est à l'écran)
    if (!v.sonne && t >= U && t < U + 0.5) {
      v.sonne = true;
      const cam = this.cameras.main;
      if (!this.vitrine && cam.worldView.contains(p.x, p.y)) Son.jouer(Son.auHasard(MANIFESTE.kamas), 'effets', { vol: 0.45, vitesse: 0.95 + Math.random() * 0.1, cle: 'kamasSol', ecart: 0.1 });
    }
    // Kamas D : un reflet doré passe toutes les 2 secondes
    const g = (this.world.time + d.uid * 0.37) % 2, flash = t > U + B && g < 0.3 ? Math.sin(Math.PI * g / 0.3) * 0.55 : 0;
    v.shine?.setPosition(p.x, p.y).setDisplaySize(iw, ih).setDepth(p.y + 1.2).setAlpha(flash).setVisible(shown && flash > 0.01);
  }

  /** Planche d'un monstre prête ? Sinon on la demande (une fois) et le monstre apparaît dès qu'elle est arrivée. */
  private planche(L: Look): boolean {
    const a = L.atlas;
    if (this.textures.exists(a)) { this.vuPlanche.set(a, this.time.now); return true; }
    if (!this.demandees.has(a)) {
      this.demandees.add(a);
      if (L.multi) this.load.multiatlas(a, v(`${ASSETS}/sprites/${a}.json`), dossier(`${ASSETS}/sprites/`));
      else this.load.atlas(a, v(`${ASSETS}/sprites/${a}.avif`), v(`${ASSETS}/sprites/${a}.json`));
      this.load.once(`filecomplete-${L.multi ? 'multiatlas' : 'atlasjson'}-${a}`, () => this.time.delayedCall(0, () => this.demandees.delete(a)));
      if (!this.load.isLoading()) this.load.start();
    }
    return false;
  }
  private demandees = new Set<string>();
  /** Alt + clic sur un monstre : ordre donné à la meute de l'Osamodas (7C). */
  private ordreMeute: number | null = null;
  /** Gestes de la carte du monde (drapeaux, signal) pour la prochaine entrée. */
  private carteGeste: GesteCarte | null = null;
  /** Dernier usage de chaque planche de monstre chargée à la demande (ms). */
  private readonly vuPlanche = new Map<string, number>();
  private oubliT = 0;
  /** Planches des monstres qu'on n'a plus vus depuis 30 s : rendues à la carte graphique. Sans ça, une longue balade dans
   *  Astrub gardait toutes les planches croisées (chasse aux bugs du 6 nov. : 1,2 -> 2,9 Go de textures en 14 cartes). */
  private oublierPlanches() {
    const now = this.time.now;
    if (now - this.oubliT < 5000) return;
    this.oubliT = now;
    for (const [a, t] of this.vuPlanche) {
      if (now - t < 30000 || this.demandees.has(a) || a.startsWith('fam_')) continue;   // (familier : sa vue garde la planche)
      this.vuPlanche.delete(a);
      if (this.textures.exists(a)) this.textures.remove(a);
    }
  }
  /** Apparence d'un monstre ou d'une bête de l'Osamodas (sa planche osa_<bête>, ou celle du monstre dompté). */
  private lookDe(e: Entity): Look {
    if (e instanceof Player) return LOOKS.iop;   // allié (multi) : dessiné par son assemblage, la planche ne sert qu'aux mesures
    return e instanceof Bete ? LOOKS[e.look] ?? LOOKS.osa_tofu : LOOKS[GAME_DATA.monsters[(e as { type?: string }).type!].look];
  }
  private viewOf(e: Entity): EntityView {
    let v = this.views.get(e.id);
    // bête éveillée (ou revenue à son rang) : nouvelle planche, nouvelle vue
    if (v && e instanceof Bete && v.look !== this.lookDe(e)) { v.destroy(); this.views.delete(e.id); v = undefined; }
    if (!v) {
      const moi = e === this.world.player, look = moi ? this.look : this.lookDe(e);
      if (moi && this.assemblage && !this.vivant) {
        this.vivant = this.nouveauVivant(this.assemblage);
      }
      v = new EntityView(this, look, moi ? this.vivant ?? undefined : e instanceof Player ? this.vivantsAllies.get(e.id) ?? undefined : undefined);
      this.views.set(e.id, v);
    }
    return v;
  }

  /** Sacrieur : la goutte de Souffrance numérotée au-dessus du perso (officiel) ; à partir de Souffrance 6, une aura de sang
   *  et quelques gouttes laissées au sol en courant (maquette Sacrieur 9B). */
  private goutteSouffrance?: Phaser.GameObjects.Image;
  private sangG?: Phaser.GameObjects.Graphics;
  private gouttesSol: { x: number; y: number; t: number; r: number }[] = [];
  private gouttesT = 0;
  private dessinerSouffrance() {
    const w = this.world, p = w.player;
    if (!p.cls.souffrance) return;
    const n = p.dead || this.vitrine ? 0 : p.souffrance, s = ISO.toScreen(p.x, p.y), v = this.viewOf(p);
    const im = this.goutteSouffrance ??= this.add.image(0, 0, 'souffrance_1').setOrigin(0.5, 1);
    im.setVisible(n > 0 && this.textures.exists(`souffrance_${n}`));
    if (n > 0 && im.visible) im.setTexture(`souffrance_${n}`).setPosition(s.x, s.y - 128 - p.z).setDisplaySize(30, 30).setDepth(v.sprite.depth + 2);
    const g = this.sangG ??= this.add.graphics();
    g.clear(); g.setDepth(v.sprite.depth - 0.6);
    const t = w.time;
    if (n >= 6) {
      const k = 0.5 + 0.5 * Math.sin(t * 5), f = (n - 5) / 5;
      g.fillStyle(0xb01818, (0.12 + 0.1 * k) * (0.6 + 0.4 * f)); g.fillEllipse(s.x, s.y, 86 + 12 * k, 36 + 5 * k);
      if (p.anim === 'run' && t - this.gouttesT > 0.22) { this.gouttesT = t; this.gouttesSol.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y + (Math.random() - 0.5) * 10, t, r: 2 + Math.random() * 2.5 }); }
    }
    this.gouttesSol = this.gouttesSol.filter(d => t - d.t < 2.5).slice(-40);
    for (const d of this.gouttesSol) {
      const q = ISO.toScreen(d.x, d.y), a = 1 - (t - d.t) / 2.5;
      g.fillStyle(0x7a0c0c, 0.7 * a); g.fillEllipse(q.x, q.y, d.r * 2.4, d.r * 1.2);
    }
  }
  /** Forgelance (maquette 4A, 13A, 13C) : la Lance Immortelle plantée de chaque joueur (squelette officiel 7139 : chute du ciel
   *  à la pose, puis immobile), son glyphe au sol, et un fil de lumière qui la relie à son Forgelance. */
  private lancesVues = new Map<number, Phaser.GameObjects.Sprite>();
  private lanceG?: Phaser.GameObjects.Graphics;
  private dessinerLances() {
    const w = this.world, L = LOOKS.forgelance_lance, g = this.lanceG ??= this.add.graphics();
    g.clear();
    const vus = new Set<number>();
    for (const p of w.players) {
      if (!p.lance || p.dead || this.vitrine) continue;
      vus.add(p.id);
      const s = ISO.toScreen(p.lance.x, p.lance.y), q = ISO.toScreen(p.x, p.y), t = w.time;
      // glyphe (Reprise de Volée) et fil de lumière, sous les persos
      g.setDepth(s.y + 0.4);   // juste sous la Lance (plus bas, les pavés du sol le cachent)
      const rg = p.cls.lance?.glyphe ?? 40, k = 0.5 + 0.5 * Math.sin(t * 4);
      g.fillStyle(0x3a2408, 0.22); g.fillEllipse(s.x, s.y, 2.4 * rg, 1.2 * rg);
      g.lineStyle(3, 0xffc24a, 0.7 + 0.25 * k); g.strokeEllipse(s.x, s.y, 2.4 * rg, 1.2 * rg);
      g.lineStyle(7, 0xffc24a, 0.2); g.lineBetween(q.x, q.y - 34 - p.z, s.x, s.y - 60);
      g.lineStyle(2, 0xfff0b8, 0.75); g.lineBetween(q.x, q.y - 34 - p.z, s.x, s.y - 60);
      if (!this.planche(L)) continue;
      let sp = this.lancesVues.get(p.id);
      if (!sp) {
        const tex = this.textures.get(L.atlas), meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.97] };
        sp = this.add.sprite(0, 0, L.atlas, 'AnimStatique_1_0').setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]).setScale(L.scale);
        this.lancesVues.set(p.id, sp);
      }
      // arrivée : les 0,5 premières secondes, l'animation officielle de chute (AnimAttaque0, 60 images)
      const n = this.textures.get(L.atlas).getFrameNames().filter(f => f.startsWith('AnimAttaque0_1_')).length;
      const f = p.lance.t < 0.5 && n ? `AnimAttaque0_1_${Math.min(n - 1, Math.floor(p.lance.t / 0.5 * n))}` : 'AnimStatique_1_0';
      if (sp.frame.name !== f && this.textures.get(L.atlas).has(f)) sp.setFrame(f);
      sp.setPosition(s.x, s.y).setDepth(s.y + 0.5).setVisible(true);
    }
    for (const [id, sp] of this.lancesVues) if (!vus.has(id)) { sp.destroy(); this.lancesVues.delete(id); }
  }
  /** Drapeaux (9A, 14A), tombe (15A) et groupe sur la mini-carte ; drapeau suivi pour la flèche du HUD. */
  private majMarquesCarte() {
    const c = this.carte, w = this.world, zone = w.opts.zone ?? '', l: Hud['marquesMini'] = [];
    let suivi: Hud['drapeauSuivi'] = null;
    if (c) w.players.forEach((o, i) => {
      const coul = parseInt(COULEURS_GROUPE[i % COULEURS_GROUPE.length].slice(1), 16);
      if (o !== w.player) l.push({ x: o.x, y: o.y, genre: 'allie', coul });
      o.drapeaux.forEach((d, j) => {
        if (d.zone !== zone) return;
        const q = c.versJeu(d.x, d.y); if (!q) return;
        l.push({ ...q, genre: 'drapeau', coul: o === w.player ? 0xf2d36b : coul });
        if (o === w.player && c.suivi === j) suivi = { ...q, note: d.note };
      });
    });
    const t = w.player.tombe;
    if (t && t.zone === zone) l.push({ x: t.x, y: t.y, genre: 'tombe', coul: 0xffffff });
    this.hud.marquesMini = l; this.hud.drapeauSuivi = suivi;
  }
  /** Signal Alt + clic (carte « suite » 14B) : cercles qui pulsent au sol, de la couleur du joueur, chez tout le groupe. */
  private signalG?: Phaser.GameObjects.Graphics;
  private dessinerSignaux() {
    const w = this.world, g = this.signalG ??= this.add.graphics().setDepth(1e5), zone = w.opts.zone ?? '';
    g.clear();
    w.players.forEach((o, i) => {
      const s = o.signal; if (!s || s.zone !== zone) return;
      const age = w.time - s.t, c = ISO.toScreen(s.x, s.y), coul = parseInt(COULEURS_GROUPE[i % COULEURS_GROUPE.length].slice(1), 16);
      for (const k of [0, 0.33, 0.66]) {
        const f = (age * 1.1 + k) % 1, a = Math.max(0, 1 - f) * Math.min(1, (SIGNAL_DUREE - age) * 2);
        g.lineStyle(4, coul, a); g.strokeEllipse(c.x, c.y, 40 + 140 * f, (40 + 140 * f) / 2);
      }
      g.fillStyle(coul, 0.8); g.fillCircle(c.x, c.y, 6);
    });
  }
  /** Maj enfoncée (maquette Osamodas 14B) : un fil de laisse relie l'Osamodas à chacune de ses bêtes (bleu pour une bête domptée). */
  private laisseG?: Phaser.GameObjects.Graphics;
  private dessinerLaisse() {
    const w = this.world, g = this.laisseG ??= this.add.graphics().setDepth(1e5);
    g.clear();
    if (!this.keys?.SHIFT?.isDown || w.player.dead || this.vitrine) return;
    const a = ISO.toScreen(w.player.x, w.player.y), t = this.time.now / 1000;
    for (const b of w.betes) {
      if (b.dead) continue;
      const c = ISO.toScreen(b.x, b.y), mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2 + 14 + Math.sin(t * 3 + b.id) * 3;
      g.lineStyle(2, b.dompteT > 0 ? 0x7fd0ff : 0x9ad15a, 0.75);
      const crb = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y - 30), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(c.x, c.y - 20));
      crb.draw(g, 16);
    }
  }

  /** Ambiance (render/ambiance.ts) : jour / soir / nuit selon l'heure du PC, lumière fixe dans les intérieurs. Quatre fois par seconde. */
  private updateAmbiance(force = false) {
    const now = this.time.now;
    if (!force && now - this.ambT < 250) return;
    this.ambT = now;
    const w = this.world, inside = !!w.worldGrid?.mapAt(w.player.x, w.player.y)?.inside;
    const a = ambiance(this.panneau && this.panneau.heure !== 'auto' ? { ...this.reglages, heure: this.panneau.heure } : this.reglages, new Date(), inside || !w.zone.open);   // Panneau test 9B
    this.worldView?.setAmbiance(a.tint, a.lumieres, a.soleil);
    Transparence.reglages.actif = this.reglages.transparence !== false;
    if (this.worldView) { this.worldView.vent = this.reglages.vent; this.worldView.eau = this.reglages.eau; if (this.worldView.parts) this.worldView.parts.actif = this.reglages.particules; }
    EntityView.ambiance = a.tintPerso;
    // couleurs adoucies (5B) : un filtre sur la caméra du jeu, seulement s'il sert (WebGL)
    const s = this.reglages.saturation, cam = this.cameras.main;
    if (Math.abs(s - 1) > 0.01 && cam.postFX) { this.sat ??= cam.postFX.addColorMatrix(); this.sat.set(matriceSaturation(s)); }
    else if (this.sat) { cam.postFX.remove(this.sat as unknown as Phaser.FX.Controller); this.sat = undefined; }
  }

  /** Sous-zones déjà vues (bandeau 2C : grand la première fois, petit ensuite) : par personnage. */
  private decouvrir(nom: string): boolean {
    if (this.test) { const z = this.test.zones ??= []; if (z.includes(nom)) return false; z.push(nom); return true; }
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
    // Accueil 6A : le fond montre la carte où le dernier perso s'est arrêté (si elle est dehors), sinon le départ
    const d = dernier(), e = d != null ? lirePersos()[d]?.etat : undefined, m = e && wg?.mapAt(e.x, e.y);
    if (e && m && !m.inside && w.zone.open) { p.x = e.x; p.y = e.y; }
    this.tour = [{ x: p.x, y: p.y }];
    if (wg && w.zone.open) {
      const [sx, sy] = m && !m.inside && e ? [m.x, m.y] : w.zone.open.start;
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
    // 7A : pendant un combat de boss, la caméra recule un peu pour voir ses zones
    const bossEnCombat = w.monsters.some(m => m.def.boss && !m.dead && m.state !== 'idle' && m.state !== 'return' && Math.hypot(m.x - w.player.x, m.y - w.player.y) < 900);
    const zoomVise = this.zoom * densite() * (bossEnCombat ? DANGER.camera.recul : 1);
    if (Math.abs(cam.zoom - zoomVise) > 0.001) cam.setZoom(cam.zoom + (zoomVise - cam.zoom) * (bossEnCombat ? 0.04 : 0.2));
    this.updateAmbiance();
    this.son.update(!!wg?.mapAt(w.player.x, w.player.y)?.inside);
    wv?.update(w.player.x, w.player.y);
    this.leverRideau(this.game.loop.delta / 1000);
    this.drawRageAura();
    for (const e of [...w.players, ...w.betes, ...w.monsters]) {
      // monde ouvert : on n'affiche que les monstres des cartes chargées (les autres vivent quand même dans la simulation)
      if (wv && wg && e !== w.player && !wv.isReady(wg.mapAt(e.x, e.y)?.tag)) continue;
      if (this.vitrine && e === w.player) continue;
      alive.add(e.id);
      // hors de l'écran (avec une marge) : la vue reste, mais on ne la met pas à jour
      if (e !== w.player) {
        const s = ISO.toScreen(e.x, e.y), r = cam.worldView;
        if (s.x < r.x - 250 || s.x > r.right + 250 || s.y < r.y - 150 || s.y > r.bottom + 350) {
          const vu = this.views.get(e.id);
          if (vu) { vu.hide(); this.vuPlanche.set(this.lookDe(e).atlas, this.time.now); }   // vue gardée : sa planche aussi
          continue;
        }
      }
      // bête de l'Osamodas : la planche de son rang suivant arrive d'avance, l'Éveil la change sans trou
      if (e instanceof Bete && e.def.suivant && LOOKS[`osa_${e.def.suivant}`]) this.planche(LOOKS[`osa_${e.def.suivant}`]);
      if (e instanceof Player ? e !== w.player && !this.vivantAllie(e) : !this.planche(this.lookDe(e))) { alive.delete(e.id); continue; }
      this.viewOf(e).sync(e);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { v.destroy(); this.views.delete(id); }
    for (const [id, vv] of this.vivantsAllies) if (!w.players.some(q => q.id === id)) { vv?.destroy(); this.vivantsAllies.delete(id); }
    // Bastion partagé : les autres joueurs en ligne s'y promènent ; on donne aussi sa position
    if (EnLigne.connecte && !this.vitrine) {
      const p = w.player;
      EnLigne.position(this.miroir ? '__groupe' : this.zoneId, p.x, p.y, p.facing, p.anim === 'run' ? 'run' : 'idle', this.time.now);
    }
    this.passantsEnLigne?.maj(w.dansBastion && !this.miroir && !this.vitrine, this.game.loop.delta / 1000, w.player.x, w.player.y);
    this.bullesChat?.maj(w, !!this.miroir);
    this.chat?.placer(this.hud.hautSuivi());
    this.dessinerLaisse();
    this.dessinerSignaux();
    this.dessinerSouffrance();
    this.dessinerLances();
    this.oublierPlanches();
    if (!this.vitrine) this.familierView?.maj(w, this.game.loop.delta / 1000);
    if (this.transparence) {
      const caches: Cache[] = [];
      for (const e of [...w.players, ...w.betes, ...w.monsters]) {
        const v = this.views.get(e.id);
        if (v && alive.has(e.id) && !e.dead) caches.push({ id: e.id, sprite: v.sprite, joueur: e === w.player, w: Math.max(34, e.radius * 2.2), h: v.look.height * Math.abs(v.look.scale) });
      }
      this.transparence.update(this.game.loop.delta / 1000, caches);
    }
    this.majApparence();
    this.vivant?.maj();
    this.windows?.majPerso(this.time.now);
    this.panneau?.maj(this.time.now);
    this.panneau?.editeur.dessiner(this, this.panneau.ouvert && this.panneau.ongletPlacement);
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
    // monstre sous le curseur : pas de halo ni de bulle sur la ressource ou l'atelier derrière lui
    const mobSurvol = !!this.monsterUnder(this.input.activePointer);
    this.recolteView?.update(this.cameras.main, this.input.activePointer, mobSurvol);
    this.atelierView?.update(this.cameras.main, this.input.activePointer, mobSurvol);
    this.havreSacView?.update(this.game.loop.delta / 1000);
    this.areneView?.update(this.game.loop.delta / 1000);
    this.guerreView?.update(this.game.loop.delta / 1000);
    this.questView?.update();
    this.passantsView?.update();
    this.dialogueView?.update();
    EntityView.temps = this.world.time;
    if (this.reglages.barresVie === 'survol' && !this.vitrine) EntityView.survol = this.monsterUnder(this.input.activePointer)?.id ?? null;
    this.hud.draw(this.fx.juice, this.game.loop.delta / 1000);
  }
}

/** Passage par le Havre-Sac (maquette Hub) : sortie à une position précise ou à un Zaap, entrée (retour), zones visitées. */
interface Transit { position?: { x: number; y: number }; point?: PointDeRetour; zaap?: string; retour?: RetourHavreSac; vues?: string[] }

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
