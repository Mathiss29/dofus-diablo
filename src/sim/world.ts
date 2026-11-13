import { appliquerCarte, majCarteJoueur } from './carte';
import { achatsDuJour, BENEDICTION, BENEDICTIONS, CONFORT, etalDuJour, MAGASIN, type Benediction, type CtxMagasin, type Offre } from './magasin';
import { angleDiff, Rng } from './math';
import type { AtelierDef, DonjonDef, Element, GameData, HitZone, MonsterSpell, SubAreaDef, ZoneDef } from './defs';
import type { PointDeRetour, RetourHavreSac, SimEvent, Telegraph } from './events';
import { GridMap, WorldGrid } from './gridmap';
import { ISO } from './iso';
import { NO_INPUT, type PlayerInput } from './input';
import { AGGRO, CASE, Monster, TOUR, type Cible } from './monster';
import { jetOfficiel } from './danger';
import { REGLAGES_BUTIN, coefChanceQuiMonte, monstresDeZone, panoDuBoss, poolNiveau, poolOfficiel, rangDe, tirerButin, type Butin, type CtxButin, type Rang } from './butin';
import { PASSIFS, TROPHEES, tropheesDuBoss } from './dofus';
import { jouerMain } from './ecaflip';
import { ajouterPieces, CLE_COFFRE, enSurcharge, ouvrirCoffre, piecesMonstre, piecesObjet, seuilsCoffre } from './enutrof';
import { briser, chanceRune, coutKamas, coutRelance, orbeConvient, potionConvient, POTIONS, regenerer, relancerLigne, REGLES_V2, dureeCommande, estimerCommande, executerCommande, forger, fusionVers, FUSION_N, runeCommande, RUNES, SIGNATURE, type Commande, type CommandeFM, type Estimation } from './forgemagie';
import { V03_PUBLIC, V04_PUBLIC, V06_PUBLIC, niveauObjetsMax, slotAPouvoirConnu } from './pouvoirs';
import { fxImpression, imprimable, nouveauPourCodex, prixImpression } from './codex';
import { legendaryPower, FAMILIER_MAX, FAMILIER_XP, familierNiveau, familierStats, METIER_XP, PEPITE, RARITIES, kamasDefaire, noteObjet, rollItem, STAT_NAMES, type EquipSlot, type Item, type ItemsData, type Rarity, type RecipeDef, type Stat } from './items';
import { Player } from './player';
import { apparatsDuMonde, rareteApparat, tirerApparat } from './apparats';
import { Bete, BETES, REGLES_BETES, type EffetBete, type SortBete } from './bete';
import { initiativeBonus, removalChance } from './caracs';
import { planWave } from './waves';
import { Arene, ARENE } from './arene';
import { Guerre } from './guerre';
import { MondeVivant, VIVANT, bonusWeekEnd, type BonusWeekEnd, type VueVivant } from './mondeVivant';
import PASSANTS from '../data/passants.json';
import V06 from '../data/v06.json';
import { IDOLES_DEFS, basculerIdole, bonusIdoles, chargerJeu, defSousIdoles, enregistrerJeu, fxIdoles, recetteIdole, type FxIdole } from './idoles';
import type { EtatMonde } from './etatMonde';
import { Quetes, type Compte, type EtatQuetes, type QuetesData } from './quests';
import { appliquerTest, type ReglagesTest } from './outilsTest';
import { Passants, lieuxDeZone } from './passants';
import { ALMANAX, jourAlmanax, type JourAlmanax } from './almanax';
import { COFFRE, coffreVide, type Coffre } from './coffre';
import { FAMILIERS_SOURCES } from './menagerie';
import { placesTenues, prixPlaceTenue, styleDef, type SorteStyle } from './style';
import { avantage, BOUTIQUE_OGRINES, rangAbo, type Palier } from './boutiqueOgrines';
import { themeChoisi, themesEnJeu, themesPossedes, zoneAvecTheme, type Teintures, type ThemesHavreSac } from './havresac';
/** Archimonstres (0.3, 15B) : chance qu'un monstre d'un groupe soit son archimonstre ; pierres d'âme officielles (vide, pleine). */
export const ARCHI = { chance: 1 / 150, pierre: '9686', pleine: '10418',
  /** « Archis : » 5B : chance qu'un élite (archimonstres compris) lâche une Petite pierre d'âme. */
  pierreElite: 1 / 20,
  /** « Archis : » 7B : salle de l'arène des âmes au Bastion, et monstres de son groupe autour d'un archimonstre relâché (min, max). */
  arene: 'arene', groupe: [3, 5] as [number, number] };
import { FABRICATION, METIERS_FAB, chanceRare, ingredientsRares, type Poste } from './metiers';
import { PLACEMENT, analyserCarte, groupesAuto, placementPose, placementValide, proposerPlacement, type AnalyseCarte, type PlacementCarte } from './placement';
import { PC_PAR_ID } from './pouvoirsClasse';
import { BOISSONS, CONSO, ELIXIRS, PARCHEMINS, RARES_RECOLTE, REPAS, RES_BOISSON, sorteConso, texteBonus } from './consommables';
import { RECOLTE, porteeRecolte, quantite, xpRecolte, type Recolte, type RecoltesData } from './recolte';

export interface HitDef { dmg: number; knock: number; element?: Element; lifesteal?: number;
  /** Effets officiels : Érosion (part des dommages ôtée aux PV max), retrait de PM / PA. */
  erosion?: number; pmLoss?: number; paLoss?: number; poLoss?: number;
  /** Dommages multipliés sur les invocations (Concentration), et aussi sur les élites et les boss (Rage pleine). */
  vsSummon?: number; vsElite?: boolean;
  /** Dommages de poussée officiels si la cible heurte un obstacle ou un monstre. */
  pushDmg?: boolean;
  /** Coup d'arme (maquette Armes 3B) : l'affichage fait jaillir un éclat de la couleur de l'élément. */
  eclat?: boolean;
  /** Pouvoir légendaire officiel « +N % Critique » sur ce sort (0.3), en part (0,35). */
  crit?: number;
  /** Sacrieur : attire de px vers le lanceur ou vers le centre de la zone (Attirance, Condensation) ; Supplice posé sur la cible. */
  attire?: { px: number; vers: 'lanceur' | 'centre' }; supplice?: { part: number; t: number };
  /** Forgelance (Kyrja) : dommages du monstre réduits de n % pendant t s. */
  affaiblit?: { n: number; t: number };
  /** Légendaires de classe (0.3) : exécution sous cette part de PV (Couperet du bourreau), +n % par case de distance (Œil d'aigle),
   *  gel de n s au 3e coup (Givre mordant), +n % de dommages de poussée et étourdi (Clouage), marque +n % (Marque du chasseur),
   *  rebonds en plus (Flèche rebelle), 3 petites explosions à n % (Gerbe de feu). */
  execute?: number; loin?: number; givre?: number; clouage?: number; marque?: number; rebonds?: number; gerbe?: number;
  /** Légendaires de classe, suite : +n % sur élites et boss (Coup du duelliste), +n % (Œil du cyclone), brûlure de n % si repoussé
   *  (Barrage incendiaire), cibles traversées en plus (Flèche perçante), vie volée en trop → bouclier jusqu'à n % des PV
   *  (Sève d'Abolition), sort à prévenir quand il tue (Déferlement sans fin). */
  vsGros?: number; plus?: number; brule?: number; perce?: number; surplus?: number; tue?: string;
  /** Festin du piranya (Osamodas K) : les dégâts du coup sont comptés dans World.festin. */
  festin?: boolean;
  /** Stase de sang (Sacrieur P) : immobilise n s, une fois par monstre toutes les 5 s. */
  stase?: number;
  /** Forgelance : +n % de dommages de poussée (Charge du champion), vie volée partagée à n % avec les alliés à 3 cases (Kyrja du champion),
   *  la Lance plantée compte comme un mur et multiplie la poussée par k (Enclume), +n % de dégâts si la cible heurte un obstacle (Estoc en avant). */
  choc?: number; partage?: number; enclume?: { x: number; y: number; k: number }; plusChoc?: number;
  /** Juron fracassant (Eniripsa I) : l'Éloquence gagnée quand la cible heurte un obstacle. */
  chocRage?: number;
  /** Sort qui frappe (partie de test, DPS sort par sort : maquette « Panneau test » 6A). */
  sort?: string }
/** Zone laissée au sol par un légendaire de classe (Épée jumelle) : frappe une fois chaque monstre qui la traverse. */
export interface ZoneSol { x: number; y: number; r: number; t: number; hit: HitDef; touches: Set<number>; id: string }
/** Butin au sol (choix 1C 2D 6A) : équipements et kamas seulement. Les Communs et les kamas filent vers le joueur
 *  qui passe près ; Rare et plus se ramassent d'un clic. Les ressources vont directement dans le sac. */
export interface Drop { uid: number; x: number; y: number; item?: Item; kamas?: number; t: number; warned?: boolean;
  /** « Apparats : » 1B 1D : un apparat (id Dofus), qui se ramasse d'un clic et rejoint la collection. */
  apparat?: string;
  /** Rapporté par le familier : ramassé tout de suite. */
  familier?: boolean;
  /** Multi (« Multi : » 7C, butin chacun le sien) : seul ce joueur le voit et le ramasse. */
  pour?: number }

/** Flèche en vol (Crâ). */
export interface Projectile { id: number; spell: string; x: number; y: number; dx: number; dy: number; left: number; speed: number; width: number;
  explode: number; pierce: boolean; hit: HitDef; stun: number; touched: Set<number>;
  /** Flèche officielle de l'Arc (maquette Armes 4B) : dessinée par l'affichage, plantée au sol si elle manque. */
  fleche?: boolean;
  /** Tiré par un monstre : touche le joueur, pas les monstres. */
  hostile?: boolean;
  /** Sort officiel du monstre qui l'a lancé (ses effets s'appliquent à l'impact). */
  from?: { monster: Monster; spell: MonsterSpell };
  /** Multi : joueur qui l'a tiré (ses caracs, son XP quand la flèche tue). */
  tireur?: Player }

/** Monde ouvert : un groupe de monstres posé sur une carte Dofus, qui réapparaît quand il a été vaincu. */
interface MonsterGroup {
  id: number; map: string; sub: SubAreaDef; members: Monster[]; timer: number; cleared: boolean; x: number; y: number;
  /** Donjon : monstres fixes du groupe et nom du donjon (ne réapparaît pas tant que le joueur y est). */
  fixe?: string[]; donjon?: string;
  /** Point du placement de la carte où le groupe s'est posé (-1 : aucun). */
  point: number;
  /** Retiré par l'éditeur de placement (F1) : ne revient plus. */
  retire?: boolean;
  /** Loin de tous les joueurs : pas de monstres créés (posés quand un joueur approche, World.POSE). x, y = où l'attendre. */
  dort?: boolean;
}
export interface PorteEnd { tag: string; x: number; y: number }
const xy = (q: { x: number; y: number }): [number, number] => [q.x, q.y];

export interface WorldOptions {
  data: GameData;
  zone: string;
  map: GridMap;
  seed?: number;
  classId?: string;
  /** Objets officiels (src/data/items.json) ; sans eux, pas de butin. */
  items?: ItemsData;
  /** Quêtes et succès (src/data/quetes.json) ; compte = succès et persos déjà créés, gardés par l'affichage. */
  quetes?: QuetesData;
  compte?: Compte;
  /** Coffre partagé du compte (0.3, src/sim/coffre.ts), gardé par l'affichage ; celui des persos Hardcore est à part (12D). */
  coffre?: Coffre;
  /** Choix « Tutoriel » à la création du perso : faux = tutoriel passé (équipement de départ quand même donné). Absent = règle du compte (7B). */
  tuto?: boolean;
  /** Partie reprise : avancement des quêtes sauvegardé (sinon les quêtes du départ démarrent). */
  reprise?: EtatQuetes;
  /** Arrivée par un portail d'une autre zone : [carte, case] de la porte d'arrivée. */
  arrivee?: [string, number];
  /** Métiers de récolte (src/data/recoltes.json) : ressources et leurs emplacements par monde. */
  recoltes?: RecoltesData;
  /** Boutiques des PNJ (src/data/boutique.json) : articles et prix en Pépites. */
  boutiques?: Record<string, { id: string; prix: number; /** vendu seulement en 0.3 */ v03?: boolean; /** en 0.4 (clés d'Amakna) */ v04?: boolean;
    /** payé dans cette monnaie au lieu des Pépites (« kamas » = p.kamas ; Tiwa Cawoteuw : Cawottes) */ monnaie?: string; /** apparence (collection) au lieu d'un objet */ apparat?: boolean;
    /** vendu seulement après une victoire dans ce donjon (« Wabbits : 9C ») */ apres?: string }[]>;
  /** Objets d'apparat officiels (src/data/apparat.json) ; plus aucun ne s'achète (« Apparats : »). */
  apparats?: { objets: Record<string, { slot: string; collection?: boolean }> };
  /** Partie de test (#test) : réglages du panneau F1 ; absent dans une vraie partie. */
  test?: ReglagesTest;
  /** Éditeur de placement (F1 › Placement) : placements de cartes pas encore envoyés, qui remplacent ceux de src/data/placements.json. */
  placements?: Record<string, PlacementCarte>;
  /** Courbe d'XP officielle des familiers (XP totale par niveau, src/data/familiers.json). */
  familierXp?: number[];
  /** Sortie du Havre-Sac (maquette Hub 2A) : à cet endroit précis, avec le point de retour d'avant. */
  position?: { x: number; y: number };
  point?: PointDeRetour;
  /** Sortie par le Zaap du Havre-Sac (2C) : nom du Zaap d'arrivée. */
  zaap?: string;
  /** Dans le Havre-Sac : d'où l'on vient (pour en ressortir au même endroit). */
  retour?: RetourHavreSac;
  /** Thèmes du Havre-Sac (src/data/havresac_themes.json, Magasin 6B) : le Havre-Sac prend celui choisi par le compte (coffre.theme). */
  themesHavreSac?: ThemesHavreSac;
  /** Teintures (src/data/teintures.json, Magasin 6E). */
  teintures?: Teintures;
  /** Zones déjà visitées par le perso (3A : les PNJ du Havre-Sac emménagent au fil de l'histoire). */
  zonesVues?: string[];  /** Date du jour (AAAA-MM-JJ), donnée par l'affichage : premier passage d'un donjon au carnet de route (Tour 8B). */
  aujourdhui?: string;
  /** Partie tenue par le serveur multijoueur (maquette « Vrai multi : » 1A) : aucun joueur n'est « l'écran ». */
  partieServeur?: boolean;
  /** Pas de groupes de monstres dans le monde ouvert (donjon tenu par le serveur : seule l'arène compte, bien moins de calcul). */
  sansGroupes?: boolean;
  /** Nuit à l'heure du PC (donnée par l'affichage, « Wabbits : 12A ») : l'îlot des Tombeaux se réveille. */
  nuit?: () => boolean;
  /** 0.5 « monde vivant » (2E) : heure de Paris en secondes « murales » (comme si Paris était à l'heure UTC), donnée par
   *  l'affichage : boss du monde, invasions, bonus du week-end. Absente (tests, serveur) : pas de rendez-vous. */
  horloge?: () => number;
  /** Tous les groupes posés dès le départ, même loin des joueurs (tests qui regardent tout le monde ; le jeu pose à la demande, World.POSE). */
  groupesPartout?: boolean;
}

/** Le familier porté (maquette Familiers 4A) : il suit le perso et va chercher le butin autour de lui. */
export interface FamilierEtat { x: number; y: number; vx: number; vy: number; cible: number | null; proie?: number | null; mordT?: number }

/** La simulation d'une zone : joueur, monstres, vagues, collisions.
 *  Aucune dépendance à Phaser ni au navigateur : elle tourne telle quelle dans les tests
 *  (et plus tard sur un serveur pour la coop). L'affichage lit l'état et vide `events`. */
/** Événements qui ne parlent qu'au joueur qui agit : fenêtres, butin, portes et zones, quêtes, métiers (multi, étape 4). */
export const EVENEMENTS_PERSONNELS = new Set<SimEvent['k']>(['levelUp', 'newSpell', 'noResource', 'rageFull', 'enterArea', 'enterLieu', 'respawn',
  'loot', 'lootResource', 'sacQuete', 'queteInfo', 'metierLevel', 'craft', 'atelier', 'fabricationDebut', 'fabricationStop', 'eat', 'consommer', 'forge',
  'brisage', 'codex', 'codexOuvert', 'coffreOuvert', 'capture', 'lieuDecouvert', 'impression', 'apparence', 'fusion', 'commande', 'signature', 'achat', 'familierNiveau',
  'familierRepas', 'rappel', 'cleManquante', 'recolteDebut', 'recolteFin', 'recolteStop', 'recolteNiveau', 'service', 'almanax', 'dofusPassif',
  'dofusGagne', 'lootKamas', 'bagFull', 'checkpoint', 'portalStart', 'portal', 'changeZone', 'incantation', 'incantationStop', 'arche', 'zaapDecouvert',
  'zaapDepart', 'emmenage', 'queteDebut', 'queteEtape', 'queteFin', 'objetQuete', 'succes', 'succesRecupere', 'itemDrop', 'guerreDebut', 'guerreFin',
  'bossMondeVaincu', 'invasionPleine', 'invasionCoffre', 'evenementFin']);

export class World {
  readonly rng: Rng;
  readonly zone: ZoneDef;
  readonly map: GridMap;
  /** Joueurs présents dans cette simulation (Multi, étape 0) : le premier est le joueur de cet écran.
   *  Pour l'instant une partie normale n'en a qu'un ; ajouterJoueur() en pose d'autres (tests, coop à venir). */
  readonly players: Player[] = [];
  /** Joueur qui agit pendant son pas (sorts, coups, monstres tués) ; null hors de ce moment. */
  private acteur: Player | null = null;
  /** Le joueur dont on parle : celui qui agit pendant son pas, sinon le joueur de cet écran. Tout le code « un joueur »
   *  passe par là, ce qui donne à chaque joueur ses propres coups, son XP et ses soins quand il agit. */
  get player(): Player { return this.acteur ?? this.players[0]; }
  monsters: Monster[] = [];
  /** Bêtes de l'Osamodas (maquette Osamodas) : alliées du joueur, hors de monsters. */
  betes: Bete[] = [];
  /** 7A + 7C : cible de la meute (dernier monstre frappé par le joueur, ou ordre Alt + clic). */
  cibleMeute: number | null = null;
  projectiles: Projectile[] = [];
  drops: Drop[] = [];
  /** Familier porté (null sans familier). */
  familier: FamilierEtat | null = null;
  /** Familiers lâchés par chaque monstre (1A : la famille du monstre). */
  private familiersDe: Record<string, string[]> = {};
  /** Objets d'équipement par niveau, pour le butin de zone. */
  private equipByLevel: { id: string; level: number }[] = [];
  private equipSecours: { id: string; level: number }[] = [];
  /** Pièces des panoplies de chaque boss (0.4 suite 1C), calculées au premier besoin. */
  private panosBoss = new Map<string, { id: string; level: number }[]>();
  /** Événements produits depuis le dernier drainEvents(). */
  private events: SimEvent[] = [];
  /** Ressources à récolter du monde (métiers de récolte, 0.2b). */
  recoltes: Recolte[] = [];
  /** Ressource cliquée (le perso y va) et geste en cours (t = temps écoulé, hp = PV au début : un coup reçu l'interrompt). */
  get versRecolte(): EtatMonde['versRecolte'] { return this.player.monde.versRecolte; }
  set versRecolte(v: EtatMonde['versRecolte']) { this.player.monde.versRecolte = v; }
  /** Case libre où le perso va pour la ressource cliquée : arrivé là, il récolte même si la ressource est un peu plus loin que la portée. */
  private get approche(): EtatMonde['approche'] { return this.player.monde.approche; }
  private set approche(v: EtatMonde['approche']) { this.player.monde.approche = v; }
  get enRecolte(): EtatMonde['enRecolte'] { return this.player.monde.enRecolte; }
  set enRecolte(v: EtatMonde['enRecolte']) { this.player.monde.enRecolte = v; }
  /** Postes des ateliers (Métiers UI 3A) : machines officielles qu'on clique pour ouvrir l'Artisanat. */
  postes: Poste[] = [];
  /** Coffre partagé du compte (0.3, 12A) : le même objet que celui de l'affichage, qui le sauve. */
  coffre: Coffre;
  /** Poste cliqué (le perso y va) et case libre où il s'arrête devant. */
  get versPoste(): EtatMonde['versPoste'] { return this.player.monde.versPoste; }
  set versPoste(v: EtatMonde['versPoste']) { this.player.monde.versPoste = v; }
  private get approcheP(): EtatMonde['approcheP'] { return this.player.monde.approcheP; }
  private set approcheP(v: EtatMonde['approcheP']) { this.player.monde.approcheP = v; }
  /** Fabrication en cours (5B : une barre d'une seconde pour toute la série ; un coup reçu ou un geste l'interrompt). */
  get enFabrication(): EtatMonde['enFabrication'] { return this.player.monde.enFabrication; }
  set enFabrication(v: EtatMonde['enFabrication']) { this.player.monde.enFabrication = v; }
  /** Télégraphes du dernier pas (recalculés à chaque pas). */
  telegraphs: Telegraph[] = [];
  zonesSol: ZoneSol[] = [];
  /** Festin du piranya : dégâts comptés pendant le coup en cours. */
  festin = 0;
  /** Dommages faits par le dernier coup du joueur (Mot de Lamentations : soigne selon les dommages). */
  degatsCoup = 0;
  wave = 0;
  kills = 0;
  waveDelay = 1.2;
  over = false;
  time = 0;
  /** 6A : série de monstres tués de près (Massacre) : nombre, heure du dernier, et prochain appel à l'aide (4B). */
  massacre = { n: 0, t: -99 };
  private appelT = 0;
  private nextId = 1;
  private groups: MonsterGroup[] = [];
  /** Point de retour après une mort (le dernier Zaap atteint). */
  private get checkpoint(): EtatMonde['checkpoint'] { return this.player.monde.checkpoint; }
  private set checkpoint(v: EtatMonde['checkpoint']) { this.player.monde.checkpoint = v; }
  get checkpointName(): EtatMonde['checkpointName'] { return this.player.monde.checkpointName; }
  set checkpointName(v: EtatMonde['checkpointName']) { this.player.monde.checkpointName = v; }
  /** Sous-zone où se trouve le joueur (monde ouvert). */
  get area(): EtatMonde['area'] { return this.player.monde.area; }
  set area(v: EtatMonde['area']) { this.player.monde.area = v; }
  /** Intérieur où se trouve le joueur (maquette Entrées 5A) : nom de la porte qui y mène (« Taverne d'Astrub »), null dehors. */
  get lieu(): EtatMonde['lieu'] { return this.player.monde.lieu; }
  set lieu(v: EtatMonde['lieu']) { this.player.monde.lieu = v; }
  /** Arrivée protégée (maquette Entrées 13A) : après une porte, un Zaap ou un portail, les monstres de l'endroit attendent
   *  ton premier geste (au plus ARENE.protection s) ; le perso est intouchable pendant ce temps. */
  get calme(): EtatMonde['calme'] { return this.player.monde.calme; }
  set calme(v: EtatMonde['calme']) { this.player.monde.calme = v; }
  /** Carte d'un intérieur -> son nom : la carte d'arrivée de chaque porte qui mène dedans (première porte trouvée). */
  readonly lieux = new Map<string, string>();
  /** Portes du monde ouvert : les deux bouts en coordonnées monde, et la carte de chacun. */
  portes: { nom: string; ends: [PorteEnd, PorteEnd]; verrou: boolean; sens: boolean; cle?: string; prix?: number; marque?: boolean; vers?: { zone: string; arrivee: [string, number] };
    /** Portail cliquable (PorteDef.dessin) : milieu du dessin dans le monde et taille de la zone de clic à l'écran. */
    dessin?: { x: number; y: number; rx: number; ry: number } }[] = [];
  /** Bout de porte par lequel le joueur vient d'arriver : inactif tant qu'il ne s'en est pas éloigné. */
  private get portalLock(): EtatMonde['portalLock'] { return this.player.monde.portalLock; }
  private set portalLock(v: EtatMonde['portalLock']) { this.player.monde.portalLock = v; }
  /** Porte franchie : le joueur s'arrête devant pendant le fondu de sortie (PASSAGE s), puis arrive de l'autre côté. */
  get passage(): EtatMonde['passage'] { return this.player.monde.passage; }
  set passage(v: EtatMonde['passage']) { this.player.monde.passage = v; }
  /** Durée du fondu de sortie d'une porte (choix 5A : 0,2 s pour sortir, 0,3 s pour entrer). */
  static readonly PASSAGE = 0.2;
  /** Multi (7A) : bonus d'XP par allié proche quand un monstre tombe. */
  static readonly XP_PAR_ALLIE = 0.1;
  /** XP d'un monstre trop faible pour le joueur (Mathis 2026-11-10, à la place d'un niveau max) : entière jusqu'à 5 niveaux
   *  d'écart, moitié à 10, presque rien (5 %) à 20 et au-delà. La montée ralentit toute seule après la dernière zone. */
  static ecartXp(joueur: number, monstre: number): number {
    const d = joueur - monstre;
    if (d <= 5) return 1;
    if (d <= 10) return 1 - (d - 5) * 0.1;
    return Math.max(0.05, 0.5 - (d - 10) * 0.045);
  }
  /** Distance (|dx| + |dy|) au-delà de laquelle un monstre qui attend ne bouge plus. */
  static readonly SOMMEIL = 2400;
  /** Monde ouvert (0.4, Amakna : 11 000 monstres) : un groupe n'existe vraiment qu'à moins de POSE d'un joueur (distance en losange) ;
   *  au-delà de RETRAIT, un groupe au calme est rangé (ses monstres retirés) jusqu'au retour d'un joueur. */
  static readonly POSE = 4000;
  static readonly RETRAIT = 5200;
  /** Quêtes et succès (monde ouvert avec quetes.json). */
  /** Partie de test : invincible, recharges, course, murs (null dans une vraie partie). */
  test: ReglagesTest | null = null;
  /** Quêtes de world.player (chaque joueur a les siennes, dans Player). */
  get quetes(): Quetes | null { return this.player?.quetes ?? null; }
  set quetes(q: Quetes | null) { this.player.quetes = q; }
  /** Tous les joueurs qui ont des quêtes, chacun avec les siennes (this.player = lui pendant fn). */
  pourChaqueQuetes(fn: (q: Quetes, p: Player) => void) { for (const p of this.players) if (p.quetes) this.commeJoueur(p, () => fn(p.quetes!, p)); }
  /** Habitants qui flânent au Bastion des Douze (maquette Ville 5F), décor vivant. */
  passants: Passants | null = null;
  /** Havre-Sac (maquette Hub 2A) : incantation en cours (t écoulé, PV au début : un coup reçu la coupe). */
  get incantation(): EtatMonde['incantation'] { return this.player.monde.incantation; }
  set incantation(v: EtatMonde['incantation']) { this.player.monde.incantation = v; }
  static readonly INCANTATION = 1.5;
  /** Dans le Havre-Sac : d'où l'on vient. */
  get retour(): EtatMonde['retour'] { return this.player.monde.retour; }
  set retour(v: EtatMonde['retour']) { this.player.monde.retour = v; }
  /** Poutch Ingball du Havre-Sac (7A) : id du monstre. */
  poutch: number | null = null;
  /** Arène du donjon où l'on se bat (maquette « Donjons en vagues »), null ailleurs. */
  /** Guerre des Cawottes (0.4, île des Wabbits) : partie de test seulement tant que la 0.4 est cachée. */
  guerre: Guerre | null = null;
  /** 0.5 « monde vivant » (src/sim/mondeVivant.ts) : boss du monde, invasions, petits événements (monde d'Astrub). */
  vivant: MondeVivant | null = null;
  /** Coop, chez l'invité : l'état du monde vivant reçu de l'hôte (il ne fait pas tourner la partie). */
  vivantVu: VueVivant | null = null;
  /** Ce que l'affichage montre du monde vivant (hôte ou invité). */
  get vueVivant(): VueVivant | null { return this.vivantVu ?? this.vivant?.vue() ?? null; }
  arene: Arene | null = null;   // au-delà de ce qu'on voit même dézoomé à fond (avant : monstres figés au bord de l'écran)

  /** Contenu « essai » (0.4 : Amakna, Wabbits, Cania sud, Moon, leurs donjons) : public dès que V04_PUBLIC est vrai, sinon partie de test. */
  get essaiOuvert(): boolean { return V04_PUBLIC || !!this.opts.test; }

  constructor(readonly opts: WorldOptions) {
    this.coffre = opts.coffre ?? coffreVide();
    this.rng = new Rng(opts.seed ?? 1);
    this.zone = opts.data.zones[opts.zone];
    if (!this.zone) throw new Error(`Zone inconnue : ${opts.zone}`);
    if (opts.themesHavreSac) this.zone = zoneAvecTheme(this.zone, themeChoisi(opts.themesHavreSac, this.coffre));   // la carte chargée par l'affichage est celle du thème
    const dt = this.zone.open?.donjonsTest;   // 0.4 cachée : ses donjons seulement en partie de test (copie : les données restent intactes)
    if ((V04_PUBLIC || opts.test) && dt?.length) this.zone = { ...this.zone, open: { ...this.zone.open!, donjons: [...(this.zone.open!.donjons ?? []), ...dt] } };
    const sz = this.zone.open?.subareas;   // 0.4 cachée : les sous-zones d'Amakna (monstres, butin, contrats) seulement en partie de test
    if (!V04_PUBLIC && !opts.test && sz && Object.values(sz).some(s => s.essai))
      this.zone = { ...this.zone, open: { ...this.zone.open!, subareas: Object.fromEntries(Object.entries(sz).filter(([, s]) => !s.essai)),
        checkpoints: this.zone.open!.checkpoints.filter(c => !sz[String(c.sub)]?.essai) } };   // Zaaps d'Amakna (0.4 suite 7A) : partie de test
    this.map = opts.map;
    this.test = opts.test ? { ...opts.test } : null;
    let start = this.map.nearestFree(GridMap.OFFSET_Y, GridMap.OFFSET_Y);
    const open = this.zone.open;
    let cpName = '';
    if (open) {
      if (!(this.map instanceof WorldGrid)) throw new Error('Une zone en monde ouvert demande un WorldGrid');
      const m = this.map.mapByCoords(...open.start);
      if (!m) throw new Error(`Carte de départ absente du monde : ${open.start}`);
      // départ : la case la plus dégagée de la carte (le plus de cases marchables autour)
      start = this.openestCell(m.tag);
      cpName = open.checkpoints[0]?.name ?? '';
      // Havre-Sac : arrivée devant l'arche, qui sert aussi de point de retour
      // Bastion des Douze (maquette Ville) : arrivée sur la place, devant le Zaap
      const hub = open.havreSac ?? open.bastion;
      if (hub) { const wg = this.map; start = wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(m.tag, hub.arrivee))), wg.freeByMap.get(m.tag)!); cpName = open.havreSac ? 'Havre-Sac' : this.zone.name; }
    }
    this.players.push(new Player(this.nextId++, start.x, start.y, opts.data.classes[opts.classId ?? 'iop']));
    this.checkpoint = start; this.checkpointName = cpName;
    this.player.v03 = V03_PUBLIC || !!opts.test;
    this.player.v04 = V04_PUBLIC || !!opts.test;
    this.player.v06 = V06_PUBLIC || !!opts.test;
    if (opts.items) {
      this.player.items = opts.items;
      // équipement aléatoire : objets officiels des monstres de la zone (butin + fabrication), sinon de tout le jeu (Mathis 2026-11-09)
      const max = niveauObjetsMax(this.player.v03, this.player.v04), ok = (e: { level: number }) => e.level <= max;
      this.equipByLevel = poolOfficiel(opts.items, monstresDeZone(this.zone)).filter(ok);
      this.equipSecours = poolOfficiel(opts.items, Object.values(opts.data.zones).flatMap(monstresDeZone)).filter(ok);
      for (const [id, d] of Object.entries(opts.items.equipment)) for (const m of d.familier?.monstres ?? []) (this.familiersDe[m] ??= []).push(id);
      // sac vide au départ (Mathis, 2026-11-06) : l'équipement vient du tutoriel (panoplie de l'Intrépide, Arc de Chasse du Crâ)
    }
    if (open) this.ouvrirCouloirs();
    if (open) { this.buildPortes(); this.buildRecoltes(); this.buildPostes(); }
    if (open?.guerre && this.essaiOuvert && this.map instanceof WorldGrid && open.guerre.champs.every(c => this.map instanceof WorldGrid && this.map.mapByTag(c.tag))) this.guerre = new Guerre(this, open.guerre.champs);
    if (open && this.map instanceof WorldGrid && opts.zone === 'astrub' && !opts.partieServeur) this.vivant = new MondeVivant(this);
    if (open && opts.arrivee) this.arriver(opts.arrivee);
    if (open) this.sortieHavreSac(opts);
    // les PNJ d'abord : les groupes de monstres ne se posent pas sur eux
    if (open && opts.quetes) this.quetes = new Quetes(opts.quetes, this, opts.compte);
    // les quêtes d'abord : le tutoriel retient les groupes du Temple jusqu'à son étape « Frapper »
    if (this.quetes) { if (opts.reprise) this.quetes.reprendre(opts.reprise); else this.quetes.demarrer(); }
    if (open?.bastion && this.map instanceof WorldGrid) this.passants = new Passants(this.map, [this.map.mapByCoords(...open.start)!.tag], opts.seed ?? 1, -100);
    // autres lieux qui vivent (0.4 suite 6C : Château d'Amakna), un seul par zone pour l'instant
    else if (open && this.map instanceof WorldGrid) {
      const lieu = lieuxDeZone(opts.zone, this.player.v04)[0];
      if (lieu) this.passants = new Passants(this.map, lieu.cartes, opts.seed ?? 1, -100, lieu.habitants);
      if (!this.passants?.liste.length) this.passants = null;
    }
    if (open && !opts.sansGroupes) this.spawnGroups();
    if (open?.havreSac?.poutch != null) this.poserPoutch(open.havreSac.poutch);
    if (open) this.visiter(opts.zonesVues ?? []);
    if (open && (opts.arrivee || opts.position || opts.zaap)) this.proteger();
  }
  /** Multi (étape 0) : pose un autre joueur à côté du premier et le renvoie. Il se bat, prend des coups et gagne de l'XP ;
   *  avec `quetes` (monde ouvert), il a aussi ses propres quêtes, reprises de sa sauvegarde ; la récolte, les ateliers,
   *  les portes et le Havre-Sac restent ceux du joueur de cet écran pour l'instant. */
  ajouterJoueur(classId: string, quetes?: { reprise: EtatQuetes; compte?: Compte }): Player {
    const cls = this.opts.data.classes[classId];
    if (!cls) throw new Error(`Classe inconnue : ${classId}`);
    const h = this.players[0], n = this.players.length, f = this.map.nearestFree(h.x + h.radius * 3 * (n % 2 ? 1 : -1) * Math.ceil(n / 2), h.y + h.radius * 2 * (n - 1));
    const q = new Player(this.nextId++, f.x, f.y, cls);
    q.v03 = h.v03; q.v04 = h.v04; q.v06 = h.v06;
    q.monde.checkpoint = { ...h.monde.checkpoint }; q.monde.checkpointName = h.monde.checkpointName; q.monde.avant = { x: q.x, y: q.y };
    if (this.opts.items) q.items = this.opts.items;
    this.players.push(q);
    if (quetes && this.zone.open && this.opts.quetes) this.commeJoueur(q, () => {
      q.quetes = new Quetes(this.opts.quetes!, this, quetes.compte);
      q.quetes.classeId = classId;
      q.quetes.reprendre(quetes.reprise);
    });
    return q;
  }
  /** Fait agir q (this.player = q) le temps de fn : en coop, l'hôte y restaure ou exporte le perso d'un invité. */
  commeJoueur<T>(q: Player, fn: () => T): T {
    const a = this.acteur;
    this.acteur = q;
    try { return fn(); } finally { this.acteur = a; }
  }
  /** Retire un joueur (pas celui de cet écran) ; ses bêtes partent avec lui. */
  /** Retire un joueur. Le premier (le joueur de l'écran) ne part jamais, sauf sur le serveur (partieServeur) où
   *  personne n'est « l'écran » : là, le suivant prend sa place tant qu'il reste quelqu'un. */
  retirerJoueur(q: Player): boolean {
    const i = this.players.indexOf(q);
    if (i < 0 || (i === 0 && (!this.opts.partieServeur || this.players.length < 2))) return false;
    this.players.splice(i, 1);
    this.betes = this.betes.filter(b => b.owner !== q);
    return true;
  }
  /** Joueurs vivants. */
  vivants(): Player[] { return this.players.filter(q => !q.dead); }
  /** Distance au joueur vivant le plus proche (Infinity si tous sont à terre). */
  distJoueur(x: number, y: number): number {
    let d = Infinity;
    for (const q of this.players) if (!q.dead) d = Math.min(d, Math.hypot(q.x - x, q.y - y));
    return d;
  }
  /** 13A : arrivée protégée (porte, Zaap, portail, Rappel), comme à l'entrée des arènes. */
  proteger() {
    const p = this.player;
    p.invuln = Math.max(p.invuln, ARENE.protection);
    this.calme = { t: ARENE.protection, x: p.x, y: p.y };
  }

  // --- Havre-Sac (maquette Hub : 2A touche H, 2C Zaap du Havre-Sac, 3A PNJ qui emménagent, 7A Poutch) ---------------
  /** Dans le Havre-Sac. */
  get dansHavreSac() { return !!this.zone.open?.havreSac; }
  /** Au Bastion des Douze, notre ville (maquette Ville 1A). */
  get dansBastion() { return !!this.zone.open?.bastion; }
  /** Havre-Sac ou Bastion : on y garde d'où l'on vient, et leur Zaap mène partout (7A+7B). */
  get dansRefuge() { return this.dansHavreSac || this.dansBastion; }
  /** La zone du Bastion existe (absente des données de certains tests). */
  private get bastionOuvert() { return !!this.opts.data.zones.bastion?.open?.bastion; }
  /** Arrivée en sortant du Havre-Sac : au Zaap choisi (2C), sinon là où l'on était (2A). */
  private sortieHavreSac(opts: WorldOptions) {
    const p = this.player, wg = this.worldGrid!, open = this.zone.open!;
    this.retour = opts.retour ?? null;
    const cp = opts.zaap ? open.checkpoints.find(c => c.name === opts.zaap) : null, m = cp && wg.mapByCoords(...cp.map);
    if (cp && m) {
      const q = this.devantZaap(cp.name) ?? this.openestCell(m.tag);
      p.x = q.x; p.y = q.y; this.checkpoint = q; this.checkpointName = cp.name;
    } else if (opts.position && this.map.walkable(opts.position.x, opts.position.y)) {
      p.x = opts.position.x; p.y = opts.position.y;
      if (opts.point) this.setPointDeRetour(opts.point.name, opts.point.x, opts.point.y);
    }
  }
  /** Zone visitée : les PNJ du Havre-Sac qui attendaient cette zone emménagent (annonce à la première visite). */
  private visiter(vues: string[]) {
    const p = this.player, z = this.opts.zone;
    p.zonesVues = [...new Set([...vues, z])];
    if (vues.includes(z) || !vues.length) return;   // premier lancement d'un perso : rien à annoncer
    const noms = [...new Set(Object.values(this.opts.quetes?.pnj ?? {}).filter(d => d.apres === z).map(d => d.nom))];
    if (noms.length) this.emit({ k: 'emmenage', noms });
  }
  private poserPoutch(c: number) {
    const wg = this.worldGrid!, tag = wg.world.maps[0].tag, M = this.opts.data.monsters.poutch_ingball;
    if (!M) return;
    const q = wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(tag, c))), wg.freeByMap.get(tag)!);
    const m = this.spawnMonster('poutch_ingball', q.x, q.y, { ...M, hp: M.hp * 20 });
    m.mannequin = true; this.poutch = m.id;
  }
  /** Touche H : dans le Havre-Sac, on en ressort ; ailleurs, 1,5 s d'incantation (coupée si l'on bouge ou si l'on est touché). */
  havreSac(): boolean {
    const p = this.player;
    if (!this.zone.open || p.dead || this.passage) return false;
    if (this.dansHavreSac) { this.sortirHavreSac(-1, false); return true; }
    if (this.incantation) return false;
    const non = (text: string) => { this.emit({ k: 'status', x: p.x, y: p.y - 60, text, color: '#ff9a5a' }); return false; };
    const tag = this.worldGrid!.mapAt(p.x, p.y)?.tag ?? '';
    if (tag.startsWith('temple')) return non('Pas pendant le tutoriel');
    if (this.donjonIci()) return non('Impossible dans un donjon');
    if (this.monsters.some(m => !m.dead && !m.mannequin && m.state !== 'idle' && m.state !== 'spawn' && Math.hypot(m.x - p.x, m.y - p.y) < 700)) return non('Des monstres te poursuivent');
    p.stopMove();
    this.incantation = { t: 0, hp: p.hp };
    this.emit({ k: 'incantation', duree: World.INCANTATION });
    return true;
  }
  private couperIncantation() {
    if (!this.incantation) return;
    this.incantation = null;
    this.emit({ k: 'incantationStop' });
  }
  private updateIncantation(dt: number) {
    const inc = this.incantation, p = this.player;
    if (!inc) return;
    if (p.dead || p.hp < inc.hp || this.passage) {
      this.couperIncantation();
      if (!p.dead) this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Incantation interrompue', color: '#ff9a5a' });
      return;
    }
    if ((inc.t += dt) < World.INCANTATION) return;
    this.incantation = null;
    this.emit({ k: 'changeZone', zone: 'havresac', nom: 'Havre-Sac', retour: this.ici() });
  }
  /** D'où l'on part, pour y revenir (sortie du Havre-Sac ou du Bastion, « Là où j'étais »). */
  private ici() { const p = this.player; return { zone: this.opts.zone, x: p.x, y: p.y, point: this.pointDeRetour }; }
  /** Index du Bastion des Douze dans la liste des Zaaps (en tête, maquette Ville 7A). */
  static readonly ZAAP_BASTION = -2;
  /** Zaap du Havre-Sac ou du Bastion (2C, Ville 7A+7B) : -1 = ressortir là où l'on était, -2 = le Bastion des Douze,
   *  sinon l'index d'un Zaap découvert. */
  sortirHavreSac(i: number, tourbillon = true): boolean {
    if (!this.dansRefuge || this.zaapDepart) return false;
    // 9A : par le Zaap, le perso est happé par le tourbillon ; H fait sortir comme une porte (Entrées 14A)
    const go = (e: SimEvent) => { if (tourbillon) this.partirParZaap(e); else this.emit(e); return true; };
    if (i === World.ZAAP_BASTION) {
      if (this.dansBastion || !this.bastionOuvert) return false;
      return go({ k: 'changeZone', zone: 'bastion', nom: this.opts.data.zones.bastion.name, ...(this.retour ? { retour: this.retour } : {}) });
    }
    const z = i >= 0 ? this.player.zaaps[i] : null;
    if (i >= 0 && !z) return false;
    if (z) return go({ k: 'changeZone', zone: z.zone, nom: z.name, zaap: z.name });
    const r = this.retour;
    if (r) return go({ k: 'changeZone', zone: r.zone, nom: r.point.name, position: { x: r.x, y: r.y }, point: r.point });
    const d = this.player.zaaps[0];
    return go({ k: 'changeZone', zone: d?.zone ?? 'incarnam', nom: d?.name ?? 'Incarnam', ...(d ? { zaap: d.name } : {}) });
  }
  /** Zaap atteint : il rejoint la liste du Zaap du Havre-Sac. */
  private decouvrirZaap(name: string) {
    const z = this.player.zaaps;
    if (z.some(o => o.zone === this.opts.zone && o.name === name)) return;
    z.push({ zone: this.opts.zone, name });
    this.emit({ k: 'zaapDecouvert', name });   // 3A : bandeau, son, icône allumée sur la carte
  }

  // --- Zaaps du monde (maquette « Zaap : » 1A 2A 3A 4A 5A+5D 6A 7A 8A 9A) ----------------------------------------
  /** Durée du départ (9A) : le perso est happé par le tourbillon, puis le fondu. */
  static readonly ZAAP_DEPART = 0.35;
  /** Un Zaap répond à moins de cette distance (on est devant). */
  static readonly ZAAP_PORTEE = 300;
  private _zaaps: { name: string; x: number; y: number }[] | null = null;
  /** Zaaps de la zone : milieu de l'arche officielle, dans le monde du jeu. */
  zaapsIci(): { name: string; x: number; y: number }[] {
    const o = this.zone.open, wg = this.worldGrid;
    if (!o || !wg) return [];
    return this._zaaps ??= o.checkpoints.filter(c => c.zaap).map(c => {
      const s = wg.toScreen(c.zaap![0], c.zaap![1]), w = ISO.toWorld(s.x, s.y);
      return { name: c.name, x: w.x, y: w.y };
    });
  }
  /** Zaap du Bastion ou arche du Havre-Sac : le milieu de son dessin (survol et clic, comme les Zaaps du monde). */
  zaapRefuge(): { name: string; x: number; y: number } | null {
    const o = this.zone.open, c = o?.havreSac?.arche ?? o?.bastion?.zaap, wg = this.worldGrid;
    if (c == null || !wg) return null;
    const a = wg.cellToWorld(wg.cellOf(wg.world.maps[0].tag, c));
    return { name: o!.havreSac ? 'Zaap du Havre-Sac' : 'Zaap du Bastion', x: a.x, y: a.y };
  }
  /** Case marchable devant un Zaap (arrivée, point de retour, là où le perso va quand on clique dessus). */
  devantZaap(name: string): { x: number; y: number } | null {
    const z = this.zaapsIci().find(o => o.name === name), wg = this.worldGrid;
    const tag = z && wg?.mapAt(z.x, z.y)?.tag, free = tag ? wg!.freeByMap.get(tag) : null;
    // devant = vers le bas de l'écran (+x +y dans le monde) : le perso ne se retrouve pas derrière l'arche
    return z && free?.length ? wg!.nearestFree(z.x + 90, z.y + 90, free) : null;
  }
  /** Le Zaap devant lequel on se tient (ou null). */
  zaapProche(): { name: string; x: number; y: number } | null {
    const p = this.player;
    return this.zaapsIci().find(z => Math.hypot(z.x - p.x, z.y - p.y) <= World.ZAAP_PORTEE) ?? null;
  }
  /** Zaap vers lequel on marche après un clic dessus (1A). */
  get versZaap(): EtatMonde['versZaap'] { return this.player.monde.versZaap; }
  set versZaap(v: EtatMonde['versZaap']) { this.player.monde.versZaap = v; }
  /** Portail dessiné vers lequel on marche après un clic dessus (on ne le prend pas en passant à côté). */
  get versPortail(): EtatMonde['versPortail'] { return this.player.monde.versPortail; }
  set versPortail(v: EtatMonde['versPortail']) { this.player.monde.versPortail = v; }
  /** Départ en cours (9A) : le changement de zone part à la fin. */
  get zaapDepart(): EtatMonde['zaapDepart'] { return this.player.monde.zaapDepart; }
  set zaapDepart(v: EtatMonde['zaapDepart']) { this.player.monde.zaapDepart = v; }
  private partirParZaap(e: SimEvent) {
    const p = this.player;
    p.stopMove(); this.versZaap = null;
    this.zaapDepart = { t: World.ZAAP_DEPART, e };
    this.emit({ k: 'zaapDepart', x: p.x, y: p.y });
  }
  private updateZaap(dt: number) {
    const d = this.zaapDepart, p = this.player;
    if (d) {
      if (p.dead) { this.zaapDepart = null; return; }
      if ((d.t -= dt) <= 0) { this.zaapDepart = null; this.emit(d.e); }
      return;
    }
    if (!this.versZaap || p.dead) return;
    const z = this.zaapsIci().find(o => o.name === this.versZaap), q = z && this.devantZaap(z.name);
    if (!z || !q) { this.versZaap = null; return; }
    // arrivé devant, tout près de l'arche, ou bloqué à côté : la fenêtre s'ouvre
    const dz = Math.hypot(p.x - z.x, p.y - z.y);
    if (Math.hypot(p.x - q.x, p.y - q.y) < 40 || dz <= 200 || (!p.enMarche && dz <= World.ZAAP_PORTEE)) {
      this.versZaap = null; p.stopMove();
      this.emit({ k: 'arche' });
    }
  }
  /** Voyage depuis la fenêtre du Zaap : depuis le Havre-Sac ou le Bastion, ou devant un Zaap du monde (gratuit, 4A).
   *  -1 = là où l'on était (refuges), -2 = le Bastion des Douze, sinon l'index d'un Zaap découvert. */
  voyagerZaap(i: number): boolean {
    if (this.dansRefuge) return this.sortirHavreSac(i);
    const ici = this.zaapProche(), p = this.player;
    if (!ici || p.dead || this.passage || this.zaapDepart) return false;
    if (i === World.ZAAP_BASTION) {
      if (!this.bastionOuvert) return false;
      this.partirParZaap({ k: 'changeZone', zone: 'bastion', nom: this.opts.data.zones.bastion.name, retour: this.ici() });
      return true;
    }
    const z = this.player.zaaps[i];
    if (!z || (z.zone === this.opts.zone && z.name === ici.name)) return false;
    this.partirParZaap({ k: 'changeZone', zone: z.zone, nom: z.name, zaap: z.name });
    return true;
  }

  /** Arrivée par un portail d'une autre zone : un peu en avant de la porte d'arrivée (comme une porte normale). */
  arriver([tag, c]: [string, number]) {
    const wg = this.worldGrid;
    if (!wg?.mapByTag(tag)) return;
    const q = wg.cellToWorld(wg.cellOf(tag, c));
    this.traverser({ tag, ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(tag)!) }, '');
    this.events.length = 0;   // pas d'annonce de porte à l'arrivée
  }
  /** Rayon autour d'une porte qui la déclenche (≈ 1,4 case) et distance d'arrivée de l'autre côté. */
  static readonly PORTE_R = 65;
  /** Sortie d'un intérieur (maquette Entrées 19A) : tout le paillasson officiel dessiné autour réagit, pas seulement sa case. */
  static readonly SORTIE_R = 95;
  /** Ce bout de porte fait sortir d'un intérieur vers le dehors. */
  private estSortie(po: World['portes'][number], i: number): boolean {
    const wg = this.worldGrid;
    // l'archipel du Bastion est rangé en « dedans » (pas de cartes voisines) : sa porte du Marché couvert est pourtant une sortie
    const dehors = (t: string) => !wg!.mapByTag(t)?.inside || (!!this.zone.open?.bastion && t === 'bastion');
    return !!wg && !po.vers && !!wg.mapByTag(po.ends[i].tag)?.inside && dehors(po.ends[1 - i].tag) && !dehors(po.ends[i].tag);
  }
  private rayonPorte(po: World['portes'][number], i: number) { return this.estSortie(po, i) ? World.SORTIE_R : World.PORTE_R; }
  static readonly PORTE_ARRIVEE = 80;
  private buildPortes() {
    const wg = this.worldGrid!;
    // Donjons en arène (1B) : les portes des anciennes salles ne servent plus ; l'entrée mène droit à l'arène, sans retour (sortie = portail, 13A)
    const ancienne = new Map<string, DonjonDef>();
    const chaine = new Set<string>();   // salles d'un donjon en couloirs : reliées par leurs couloirs, plus par des portes
    for (const dj of this.zone.open!.donjons ?? []) if (dj.arene && wg.mapByTag(dj.arene.tag)) {
      const cl = this.couloirs(dj);
      if (cl) {   // en couloirs (partie de test) : l'antichambre reste, seule la salle du boss officielle ne sert plus
        for (const t of cl.salles) chaine.add(t);
        for (const t of Object.keys(dj.salles)) if (!cl.salles.includes(t) && wg.mapByTag(t)) ancienne.set(t, dj);
        for (const t of [...cl.salles, ...cl.tags, dj.arene.tag]) if (!this.lieux.has(t)) this.lieux.set(t, dj.nom);
        continue;
      }
      // ses salles, et l'antichambre de même nom (grange_0, cache_0)
      const pref = new Set(Object.keys(dj.salles).map(t => t.replace(/\d+$/, '')));
      for (const m of wg.world.maps) if (m.inside && pref.has(m.tag.replace(/\d+$/, '')) && /\d$/.test(m.tag)) ancienne.set(m.tag, dj);
    }
    // donjons de la 0.4 (« 0.4 suite : 5A ») : la porte mène droit à l'arrivée de l'arène (b = [tag de l'arène, 0])
    for (const dj of this.zone.open!.donjons ?? []) if (dj.arene && !Object.keys(dj.salles).length) ancienne.set(dj.arene.tag, dj);
    for (const d of this.zone.open!.portes ?? []) {
      if (d.v03 && !this.player.v03) continue;
      if (wg.mapByTag(d.a[0])?.essai && !this.essaiOuvert) continue;   // 0.4 cachée : portes d'Amakna en partie de test
      const dj = ancienne.get(d.b[0]);
      if (ancienne.has(d.a[0]) || chaine.has(d.a[0])) continue;
      if (dj && !d.zone && wg.mapByTag(d.a[0])) {
        const q = wg.cellToWorld(wg.cellOf(d.a[0], d.a[1])), A = dj.arene!, B = wg.cellToWorld(A.arrivee);
        this.portes.push({ nom: d.nom, ends: [{ tag: d.a[0], ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(d.a[0])!) }, { tag: A.tag, ...B }], verrou: false, sens: true, cle: d.cle, ...(d.marque ? { marque: true } : {}) });
        if (!this.lieux.has(A.tag)) this.lieux.set(A.tag, dj.nom);
        continue;
      }
      if (d.zone) {   // portail vers une autre zone : un seul bout ici
        if (!wg.mapByTag(d.a[0])) continue;
        const q = wg.cellToWorld(wg.cellOf(d.a[0], d.a[1])), a = { tag: d.a[0], ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(d.a[0])!) };
        const dz = d.dessin && wg.cellToWorld(wg.cellOf(d.a[0], d.dessin[0]));
        this.portes.push({ nom: d.nom, ends: [a, a], verrou: false, sens: true, vers: { zone: d.zone, arrivee: d.b },
          dessin: dz ? { ...dz, rx: d.dessin![1], ry: d.dessin![2] } : undefined });
        continue;
      }
      if (!wg.mapByTag(d.a[0]) || !wg.mapByTag(d.b[0])) continue;   // intérieur pas (encore) exporté dans ce monde
      // la porte est souvent sur un mur : on la ramène sur la case marchable la plus proche de sa carte
      const end = ([tag, c]: [string, number]): PorteEnd => {
        const q = wg.cellToWorld(wg.cellOf(tag, c));
        return { tag, ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(tag)!) };
      };
      this.portes.push({ nom: d.nom, ends: [end(d.a), end(d.b)], verrou: !!d.verrou, sens: !!d.sens, cle: d.cle, ...(d.prix ? { prix: d.prix } : {}), ...(d.marque ? { marque: true } : {}) });
      if (wg.mapByTag(d.b[0])?.inside && !this.lieux.has(d.b[0])) this.lieux.set(d.b[0], d.nom);
    }
  }
  /** Nom d'un endroit (carte) : l'intérieur, sinon la sous-zone. */
  nomCarte(tag: string): string | null {
    const m = this.worldGrid?.mapByTag(tag);
    if (!m) return null;
    return (m.inside ? this.lieux.get(tag) : null) ?? this.zone.open?.subareas[String(m.sub)]?.name ?? null;
  }
  /** Bout de porte sous un point (survol de la souris, maquette Entrées 3A et 8A) : où elle mène, et si c'est la sortie
   *  d'un intérieur. Les bouts qu'on ne peut pas prendre dans ce sens (sens unique) sont ignorés. */
  porteSous(x: number, y: number): { x: number; y: number; nom: string; sortie: boolean } | null {
    if (!this.worldGrid) return null;
    let best: { x: number; y: number; nom: string; sortie: boolean } | null = null, bd = Infinity;
    for (const po of this.portes) for (let i = 0; i < 2; i++) {
      if ((i === 1 && po.sens) || po.dessin) continue;   // portail dessiné : survol sur son dessin (zoneScene.portailSous)
      const from = po.ends[i], to = po.ends[1 - i], d = Math.hypot(x - from.x, y - from.y);
      if (d > bd || d > this.rayonPorte(po, i)) continue;
      bd = d;
      const dedans = !!this.worldGrid.mapByTag(from.tag)?.inside;
      if (po.vers) { best = { x: from.x, y: from.y, nom: po.nom, sortie: false }; continue; }
      const versDedans = !!this.worldGrid.mapByTag(to.tag)?.inside, ici = this.nomCarte(from.tag), la = this.nomCarte(to.tag) ?? po.nom;
      best = { x: from.x, y: from.y, nom: versDedans && dedans && la === ici ? 'Salle suivante' : la, sortie: this.estSortie(po, i) };
    }
    return best;
  }
  /** Position du joueur à l'image d'avant (sens de la marche, maquette Entrées 4B). */
  private get avant(): EtatMonde['avant'] { return this.player.monde.avant; }
  private set avant(v: EtatMonde['avant']) { this.player.monde.avant = v; }
  /** Passe la porte si le joueur est dessus : il arrive de l'autre côté, un peu en avant de la porte d'arrivée. */
  private updatePortes(dt: number) {
    const p = this.player, R = World.PORTE_R;
    // déplacement depuis l'image d'avant (un saut de plus de 60 = téléportation, pas une marche)
    const mx = p.x - this.avant.x, my = p.y - this.avant.y, pas = Math.hypot(mx, my);
    this.avant.x = p.x; this.avant.y = p.y;
    if (this.passage) {
      const q = this.passage;
      if (p.dead) { this.passage = null; return; }
      p.stopMove(); q.t -= dt;
      if (q.t > 0) return;
      this.passage = null;
      if (q.vers) { this.emit({ k: 'changeZone', zone: q.vers.zone, arrivee: q.vers.arrivee, nom: q.nom }); return; }
      this.traverser(q.to, q.nom);
      return;
    }
    if (p.dead || p.state !== 'free') return;   // pas au milieu d'un sort ou d'un bond
    if (this.portalLock && Math.hypot(p.x - this.portalLock.x, p.y - this.portalLock.y) > R + 30) this.portalLock = null;
    for (const po of this.portes) for (let i = 0; i < 2; i++) {
      const from = po.ends[i], to = po.ends[1 - i], Rp = this.rayonPorte(po, i);
      if ((i === 1 && po.sens) || from === this.portalLock || Math.hypot(p.x - from.x, p.y - from.y) > Rp) continue;
      // on passe la porte en cliquant dessus, ou en marchant droit dedans (4B) ; la frôler de côté ne fait rien
      const dp = Math.hypot(from.x - p.x, from.y - p.y);
      const marche = pas > 0.5 && pas < 60 && dp < R * 0.75 && (dp < 8 || (mx * (from.x - p.x) + my * (from.y - p.y)) / (pas * dp) > 0.6);
      const clic = p.vise(from.x, from.y, Rp + 40);
      if (po.dessin ? this.versPortail !== po.nom : !clic && !marche) continue;   // un portail dessiné ne se prend qu'en cliquant dessus
      if (po.verrou && !this.salleVide(from.tag)) {
        this.portalLock = from;   // un seul message tant qu'il reste sur la porte
        this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Vaincs les monstres de la salle', color: '#ff9a5a' });
        return;
      }
      // entrée d'un donjon gardé (maquette Gardiens 5A) : la porte ouvre le dialogue du gardien, qui fait entrer (« Entrer »)
      const gardien = i === 0 && this.quetes?.gardienDe(po.nom);
      if (gardien && po === this.entreeDonjon(po.nom)) { p.stopMove(); if (!clic) this.portalLock = from; this.quetes!.parlerA(gardien); return; }
      if (i === 0 && (!this.prendreCle(po) || !this.payerTraversee(po))) { this.portalLock = from; return; }
      this.passer(po, to);
      return;
    }
  }
  /** Arche du Havre-Sac (2C) : cliquer dessus et s'en approcher ouvre la liste des Zaaps (une fois par clic). */
  private get archeVue(): EtatMonde['archeVue'] { return this.player.monde.archeVue; }
  private set archeVue(v: EtatMonde['archeVue']) { this.player.monde.archeVue = v; }
  private updateArche() {
    const o = this.zone.open, p = this.player, c = o?.havreSac?.arche ?? o?.bastion?.zaap;
    if (c == null || p.dead) return;
    const wg = this.worldGrid!, a = wg.cellToWorld(wg.cellOf(wg.world.maps[0].tag, c));
    // l'arche est dans le mur : on clique sur son dessin, le perso s'arrête sur les cases devant
    const vise = p.vise(a.x, a.y, 150);
    if (!vise) { this.archeVue = false; return; }
    if (this.archeVue || Math.hypot(p.x - a.x, p.y - a.y) > 200) return;
    this.archeVue = true; p.stopMove();
    this.emit({ k: 'arche' });
  }
  /** Le perso s'arrête devant la porte pendant le fondu de sortie, puis passe (traverser). */
  private passer(po: World['portes'][number], to: PorteEnd) {
    this.player.stopMove(); this.versPortail = null;
    this.passage = { to, nom: po.nom, t: World.PASSAGE, vers: po.vers };
    this.emit({ k: 'portalStart', nom: po.nom });
  }
  /** Entrée d'un donjon : la clé officielle est prise en entrant (sans clé, la porte reste fermée). Vrai si on peut passer. */
  private prendreCle(po: World['portes'][number]): boolean {
    if (!po.cle) return true;
    const p = this.player, r = p.resources[po.cle] ?? 0;
    if (this.cleValable(po.nom)) return true;   // 14A : clé encore valable, rien n'est repris
    if (this.bonusDuWeekEnd('cles')) return true;   // 9B : Trousseau de clefs illimité
    if (r <= 0 && this.aboDuJour().cles < avantage(p.abo, 'cles')) {   // « Apparats : » 17J : une clé offerte par jour
      p.aboJour.cles++;
      this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Clé offerte par ton abonnement', color: '#c28bff' });
      return true;
    }
    if (r <= 0) {
      this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `Il faut une ${this.opts.items?.resources[po.cle]?.name ?? 'clé'}`, color: '#ff9a5a' });
      this.emit({ k: 'cleManquante', id: po.cle });
      return false;
    }
    if (r === 1) delete p.resources[po.cle]; else p.resources[po.cle] = r - 1;
    return true;
  }
  /** « Wabbits : 2C » : traversée payante à l'aller (bateau du Capitaine Lily), gratuite au retour. Vrai si on peut passer. */
  private payerTraversee(po: World['portes'][number]): boolean {
    if (!po.prix) return true;
    const p = this.player;
    if (p.kamas < po.prix) { this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `La traversée coûte ${po.prix} kamas`, color: '#ff9a5a' }); return false; }
    p.kamas -= po.prix;
    this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `-${po.prix} kamas`, color: '#f2d36b' });
    return true;
  }
  /** « Wabbits : 2D » : boire la Potion Wabbit (déguisement). */
  boire(id: string): boolean {
    const r = this.opts.items?.resources[id], p = this.player;
    if (!r?.deguisement || !(p.resources[id] > 0) || p.dead) return false;
    p.resources[id]--; if (!p.resources[id]) delete p.resources[id];
    p.deguise = r.deguisement;
    this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Déguisé en Wabbit !', color: '#e8902a' });
    this.emit({ k: 'potion', x: p.x, y: p.y, amount: 0 });
    return true;
  }
  /** « Archis : » 7B : dans l'arène des âmes du Bastion, relâcher une âme capturée : l'archimonstre revient avec son groupe (le boss seul),
   *  au milieu de l'arène, et se bat tout de suite ; meilleur butin (celui d'un boss), mais il ne se capture pas. L'âme est perdue. */
  dansAreneAmes(): boolean { const p = this.player; return this.dansBastion && this.worldGrid?.mapAt(p.x, p.y)?.tag === ARCHI.arene; }
  relacherAme(id: string): boolean {
    const p = this.player, r = this.opts.items?.resources[id], type = r?.ame, d = type ? this.opts.data.monsters[type] : undefined;
    if (!d || !(p.resources[id] > 0) || p.dead) return false;
    const non = (text: string) => { this.emit({ k: 'status', x: p.x, y: p.y - 60, text, color: '#ff9a5a' }); return false; };
    if (!this.dansAreneAmes()) return non('À relâcher dans l\'arène des âmes, au Marché couvert du Bastion');
    if (this.monsters.some(m => m.relache && !m.dead)) return non('L\'arène est déjà occupée');
    p.resources[id]--; if (!p.resources[id]) delete p.resources[id];
    const wg = this.worldGrid!, c = this.openestCellOf(ARCHI.arene), libres = wg.freeByMap.get(ARCHI.arene);
    const types = [type!];
    if (d.archiDe) { const [a, b] = ARCHI.groupe; for (let i = a + Math.floor(this.rng.next() * (b - a + 1)); i > 0; i--) types.push(d.archiDe); }
    types.forEach((t, i) => {
      const ang = i * 2 * Math.PI / Math.max(1, types.length - 1), q = i ? wg.nearestFree(c.x + Math.cos(ang) * 90, c.y + Math.sin(ang) * 45, libres) : c;
      const m = this.spawnMonster(t, q.x, q.y); m.arene = true; m.relache = true;
    });
    this.emit({ k: 'impact', hitstop: 0.05, shake: 0.012, big: true });
    this.emit({ k: 'ameRelachee', monster: type!, x: c.x, y: c.y });
    return true;
  }
  /** Clé de ce donjon encore valable (14A) : vague atteinte, sinon 0. */
  cleValable(nom: string): number {
    const c = this.player.cleDonjon;
    return c && c.nom === nom && c.reste > 0 ? c.vague : 0;
  }
  /** Porte d'entrée d'un donjon (dehors -> première salle) : celle qui demande la clé, sinon la première qui n'est pas verrouillée. */
  entreeDonjon(nom: string) {
    return this.portes.find(po => po.nom === nom && po.cle) ?? this.portes.find(po => po.nom === nom && !po.verrou && !po.vers);
  }
  /** « Entrer » chez le gardien : la clé est prise, puis fondu et arrivée dans la première salle. */
  entrerDonjon(nom: string): boolean {
    const po = this.entreeDonjon(nom);
    if (!po || this.passage || this.player.dead || !this.prendreCle(po)) return false;
    this.passer(po, po.ends[1]);
    return true;
  }
  /** Boss d'un donjon (monstre « boss » de ses salles). */
  bossDuDonjon(nom: string): string | null {
    const d = this.zone.open?.donjons?.find(x => x.nom === nom), M = this.opts.data.monsters;
    for (const gs of Object.values(d?.salles ?? {})) for (const g of gs) for (const m of g) if (M[m]?.boss) return m;
    // arènes de la 0.4 : le boss n'est pas dans les salles officielles, il arrive avec la dernière vague
    return d?.bossVague?.find(m => M[m]?.boss) ?? null;
  }
  /** Donjon où se trouve le joueur (nom), ou null. */
  /** Caracs 11A : rend tous les points de caractéristiques, gratuitement, hors donjon et hors arène. */
  reinitialiserCaracs(): boolean {
    const p = this.player;
    if (p.dead || this.arene || this.donjonIci()) { this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Impossible dans un donjon', color: '#ff9a5a' }); return false; }
    p.reinitialiserPoints();
    return true;
  }
  donjonIci(): string | null { return this.zone.open?.donjons?.find(d => this.dansDonjon(d.nom))?.nom ?? null; }
  /** Arrivée de l'autre côté : une case libre juste hors du rayon de la porte d'arrivée, du côté du milieu de la carte (pas collé au bord). */
  private traverser(to: PorteEnd, nom: string) {
    const p = this.player, wg = this.worldGrid!;
    const dj = this.zone.open?.donjons?.find(d => d.arene?.tag === to.tag);
    if (dj) {   // arène : pile au point d'arrivée, protégé 1,5 s (15A)
      p.x = to.x; p.y = to.y; p.kx = p.ky = 0; p.z = 0; p.stopMove(); p.invuln = Math.max(p.invuln, ARENE.protection);
      this.portalLock = to;
      this.emit({ k: 'portal', nom });
      this.lancerArene(dj);
      return;
    }
    const free = (wg.freeByMap.get(to.tag) ?? []).map(c => wg.cellToWorld(c));
    const mid = free.reduce((a, q) => ({ x: a.x + q.x / free.length, y: a.y + q.y / free.length }), { x: 0, y: 0 });
    let best = to, bd = Infinity;
    for (const q of free) {
      const d = Math.hypot(q.x - to.x, q.y - to.y);
      if (d < World.PORTE_ARRIVEE) continue;
      const score = d + 0.6 * Math.hypot(q.x - mid.x, q.y - mid.y);
      if (score < bd) { bd = score; best = { tag: to.tag, ...q }; }
    }
    p.x = best.x; p.y = best.y; p.kx = p.ky = 0; p.z = 0; p.stopMove();
    this.portalLock = to;
    this.proteger();
    this.emit({ k: 'portal', nom });
  }

  /** Plus aucun monstre vivant dans les groupes de cette carte (portes verrouillées des donjons). */
  salleVide(tag: string): boolean {
    return !this.groups.some(g => g.map === tag && g.members.some(m => !m.dead));
  }
  /** Le joueur est dans une salle de ce donjon. */
  dansDonjon(nom: string): boolean {
    const d = this.zone.open?.donjons?.find(x => x.nom === nom), tag = this.worldGrid?.mapAt(this.player.x, this.player.y)?.tag;
    return !!d && !!tag && (tag in d.salles || tag === d.arene?.tag || !!this.couloirs(d)?.tags.includes(tag));
  }
  /** Partie de test : les couloirs des donjons en couloirs s'ouvrent à la marche, et salles, couloirs et arène se voient
   *  ensemble depuis l'intérieur (WorldView). En partie publique, rien : l'arène reste fermée, comme avant. */
  private ouvrirCouloirs() {
    const wg = this.worldGrid;
    if (!wg || !this.essaiOuvert) return;
    wg.ouvrirEssai();   // 0.4 cachée : Amakna seulement en partie de test
    for (const d of this.zone.open!.donjons ?? []) {
      const c = d.couloirs;
      if (!c || !d.arene || ![...c.tags, ...c.salles, d.arene.tag].every(t => wg.mapByTag(t))) continue;
      wg.ouvrir(c.cases);
      for (const t of [...c.salles, ...c.tags, d.arene.tag]) wg.mapByTag(t)!.groupe = d.nom;
    }
  }
  /** Donjon en couloirs (maquette « Couloirs : 1C 2B 3A 4A ») : seulement en partie de test (0.4 cachée), et s'il est exporté. */
  couloirs(d: DonjonDef): DonjonDef['couloirs'] | null {
    const c = d.couloirs, wg = this.worldGrid;
    return c && this.essaiOuvert && wg && c.tags.every(t => wg.mapByTag(t)) && c.salles.every(t => wg.mapByTag(t)) ? c : null;
  }

  // --- Arènes des donjons (maquette « Donjons en vagues ») ---------------------------------------------------
  /** Arrivée dans l'arène : la clé reste valable 10 min (14A), on reprend à la vague atteinte ; carte-titre (11A). */
  private lancerArene(d: DonjonDef) {
    const p = this.player, reprise = this.cleValable(d.nom);
    this.arene?.abandonner();
    if (!reprise) p.cleDonjon = { nom: d.nom, vague: 1, reste: ARENE.cle };
    this.arene = new Arene(this, d, reprise || 1);
    const boss = this.bossDuDonjon(d.nom), cle = this.entreeDonjon(d.nom)?.cle ?? null;
    this.emit({ k: 'areneDebut', nom: d.nom, boss, vagues: this.arene.total, cle, reprise: reprise > 1 ? reprise : 0 });
  }
  private updateArene(dt: number) {
    const p = this.player, tag = this.worldGrid?.mapAt(p.x, p.y)?.tag;
    if (!this.arene && !this.passage && !p.dead && tag) {
      const d = this.zone.open?.donjons?.find(x => x.arene?.tag === tag && this.couloirs(x));
      if (d) this.lancerArene(d);
    }
    const a = this.arene;
    if (!a) return;
    if (this.couloirs(a.d)) {   // donjon en couloirs : l'arène tient tant qu'on est dans le donjon
      if (!this.passage && !p.dead && !this.dansDonjon(a.d.nom)) { a.abandonner(); this.arene = null; return; }
      a.update(dt);
      return;
    }
    // parti autrement que par le portail (Rappel…) : l'arène se vide
    if (!this.passage && !p.dead && this.worldGrid!.mapAt(p.x, p.y)?.tag !== a.d.arene!.tag) { a.abandonner(); this.arene = null; return; }
    a.update(dt);
  }
  /** Partie de test (F1) : droit dans l'arène de ce tag, comme par la porte du gardien. Faux si ce n'est pas une arène. */
  allerArene(tag: string): boolean {
    const d = this.zone.open?.donjons?.find(x => x.arene?.tag === tag), wg = this.worldGrid;
    if (!d || !wg?.mapByTag(tag)) return false;
    this.traverser({ tag, ...wg.cellToWorld(d.arene!.arrivee) }, d.nom);
    return true;
  }
  /** Partie rechargée (Ctrl+F5…) alors qu'on était dans une arène : l'arène n'existe plus en mémoire.
   *  Clé encore valable : on reprend à la vague atteinte, au point d'arrivée. Sinon (boss déjà tombé, clé
   *  expirée) : retour devant le gardien. Jamais coincé dans une arène vide. */
  reprendreArene() {
    const wg = this.worldGrid, p = this.player;
    if (!wg || this.arene) return;
    const tag = wg.mapAt(p.x, p.y)?.tag, d = this.zone.open?.donjons?.find(x => x.arene?.tag === tag);
    if (!d) return;
    if (this.cleValable(d.nom)) { this.traverser({ tag: tag!, ...wg.cellToWorld(d.arene!.arrivee) }, d.nom); return; }
    const po = this.entreeDonjon(d.nom);
    if (po) this.traverser(po.ends[0], d.nom);
    else { p.x = this.checkpoint.x; p.y = this.checkpoint.y; }
  }
  /** 13A : le portail de sortie ramène devant le gardien. */
  quitterArene(d: DonjonDef) {
    // partie tenue par le serveur : l'arène est toute la partie ; celui qui sort quitte le groupe et retrouve son monde
    if (this.opts.partieServeur) { this.player.stopMove(); this.emit({ k: 'sortieArene', joueur: this.player.id }); return; }
    const po = this.entreeDonjon(d.nom);
    if (!po || this.passage) return;
    this.arene = null;
    this.player.stopMove();
    this.passage = { to: po.ends[0], nom: d.nom, t: World.PASSAGE };
    this.emit({ k: 'portalStart', nom: d.nom });
  }
  /** « Wabbits : 9A » : le joueur saute dans le trou du boss enfui : fondu, puis la première salle du donjon suivant (sans clé). */
  suivreDansLeTrou(d: DonjonDef, suite: string) {
    const po = this.entreeDonjon(suite);
    if (!po || this.passage || this.opts.partieServeur) return;
    this.arene = null;
    this.player.stopMove();
    this.passage = { to: po.ends[1], nom: suite, t: World.PASSAGE };
    this.emit({ k: 'portalStart', nom: `Trou du ${this.bossDuDonjon(d.nom) ? this.opts.data.monsters[this.bossDuDonjon(d.nom)!].name : 'boss'}` });
  }
  /** 13A : coffre du donjon à côté du portail : un second butin du boss, et une bourse de kamas. Tiré à la mort du boss
   *  (maquette Coffres 4C : le coffre luit de la couleur du meilleur objet avant qu'on l'ouvre), posé à l'ouverture. */
  tirerCoffreDonjon(d: DonjonDef): Butin | null {
    const boss = this.bossDuDonjon(d.nom), M = this.opts.data.monsters;
    if (!boss || !this.opts.items) return null;
    const niveau = M[boss].level ?? this.zone.level;
    const b = tirerButin(this.rng, this.contexteButin(boss, 'boss', niveau), () => this.nextId++);
    b.kamas += 20 * niveau;
    // « Apparats : » 17J : Légende, un coffre de plus (un second tirage du boss dans le même coffre)
    for (let i = 0; i < avantage(this.player.abo, 'coffreDonjon'); i++) {
      const c = tirerButin(this.rng, this.contexteButin(boss, 'boss', niveau), () => this.nextId++);
      b.ressources.push(...c.ressources); b.objets.push(...c.objets); b.kamas += c.kamas + 20 * niveau;
    }
    this.noterBossLeg(boss, b, false);
    return b;
  }
  /** 0.6 (24A) : un Légendaire ou un Mythique de ce boss remet sa chance à zéro ; sinon (à la mort du boss seulement) elle monte d'un cran. */
  private noterBossLeg(boss: string, b: Butin, essai: boolean) {
    const p = this.player;
    if (!p.v06) return;
    if (b.objets.some(o => o.rarity === 'legendaire' || o.rarity === 'mythique')) delete p.bossSansLeg[boss];
    else if (essai) p.bossSansLeg[boss] = (p.bossSansLeg[boss] ?? 0) + 1;
  }
  /** Multi : le butin du coffre d'un joueur (commeJoueur), que lui seul voit et ramasse. */
  poserButinDe(b: Butin, x: number, y: number) { this.poserButin(b, x, y, this.player.id); }
  /** Le coffre s'ouvre : son butin jaillit là où il était. */
  ouvrirCoffreDonjon(b: Butin | null, x: number, y: number) {
    if (b) this.poserButin(b, x, y);
    this.emit({ k: 'status', x, y: y - 50, text: 'Coffre du donjon', color: '#f2d36b' });
  }

  /** Case la plus dégagée d'une carte (le plus de cases marchables autour). */
  openestCellOf(tag: string) { return this.openestCell(tag); }
  private openestCell(tag: string) {
    const wg = this.worldGrid!, free = wg.freeByMap.get(tag)!, ok = new Set(free), C = wg.cols;
    let best = free[0], bestN = -1;
    for (const c of free) {
      let n = 0;
      for (let dr = -6; dr <= 6; dr++) for (let dk = -3; dk <= 3; dk++) if (ok.has(c + dr * C + dk)) n++;
      if (n > bestN) { bestN = n; best = c; }
    }
    return wg.cellToWorld(best);
  }

  private freeSets = new Map<string, Set<number>>();
  private freeSet(tag: string) {
    let s = this.freeSets.get(tag);
    if (!s) { s = new Set(this.worldGrid!.freeByMap.get(tag)!); this.freeSets.set(tag, s); }
    return s;
  }
  get worldGrid(): WorldGrid | null { return this.map instanceof WorldGrid ? this.map : null; }

  // --- Monde ouvert ---------------------------------------------------------
  private spawnGroups() {
    const wg = this.worldGrid!, open = this.zone.open!;
    for (const m of wg.world.maps) {
      const sub = open.subareas[String(m.sub)];
      if (!sub || !wg.freeByMap.get(m.tag)!.length || (m.inside && !sub.interieur) || (sub.cartes && !sub.cartes.includes(m.tag))) continue;
      this.poserGroupes(m.tag, sub);
    }
    // Donjons : groupes officiels fixes, salle par salle
    for (const d of open.donjons ?? []) for (const [tag, groupes] of Object.entries(d.salles)) {
      const cl = this.couloirs(d);
      if (cl && !cl.salles.includes(tag)) continue;   // en couloirs : groupes officiels dans les salles du trajet, le boss attend dans l'arène
      if (!cl && d.arene && wg.mapByTag(d.arene.tag)) break;   // donjon en arène : les monstres arrivent par vagues
      const m = wg.mapByTag(tag);
      if (!m || !wg.freeByMap.get(tag)?.length) continue;
      const sub = open.subareas[String(m.sub)] ?? { name: d.nom, level: this.zone.level, monsters: [], groupsPerMap: 0, groupSize: [0, 0] };
      for (const fixe of groupes) {
        const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, fixe, donjon: d.nom, point: -1 };
        this.groups.push(g);
        this.spawnGroup(g);
      }
    }
    this.poserErrants();
  }
  /** 2B : monstres seuls qui rôdent dans les couloirs (tirés parmi ceux du donjon, sans le boss). */
  private poserErrants() {
    const wg = this.worldGrid!, M = this.opts.data.monsters;
    for (const d of this.zone.open!.donjons ?? []) {
      const cl = this.couloirs(d);
      if (!cl) continue;
      const pool = [...new Set(Object.values(d.salles).flat(2))].filter(m => M[m] && !M[m].boss);
      if (!pool.length) continue;
      for (const tag of cl.tags) {
        if (cl.annexes?.includes(tag)) continue;
        if (!wg.freeByMap.get(tag)?.length) continue;
        const m = wg.mapByTag(tag)!, sub = this.zone.open!.subareas[String(m.sub)] ?? { name: d.nom, level: this.zone.level, monsters: [], groupsPerMap: 0, groupSize: [0, 0] };
        for (let i = 0; i < cl.nErrants; i++) {
          const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, fixe: [pool[this.rng.int(pool.length)]], donjon: d.nom, point: -1 };
          this.groups.push(g);
          this.spawnGroup(g);
        }
      }
    }
  }
  // --- Placement des groupes (maquette « Monstres » : 1A+1C 2A 3A 4A+4D 5B 6A 7A) ---------------------------------
  /** Placement de chaque carte : posé à la main (éditeur F1, src/data/placements.json), sinon proposé tout seul (1C). */
  private placements = new Map<string, PlacementCarte>();
  private analyses = new Map<string, AnalyseCarte>();
  /** Cartes qui ont des groupes de monstres (sous-zone avec monstres, pas une maison). */
  private sousZoneGroupes(tag: string): SubAreaDef | null {
    const wg = this.worldGrid, open = this.zone.open, m = wg?.mapByTag(tag);
    if (!wg || !open || !m) return null;
    const sub = open.subareas[String(m.sub)];
    if (!sub || !wg.freeByMap.get(m.tag)!.length || (m.inside && !sub.interieur) || (sub.cartes && !sub.cartes.includes(m.tag))) return null;
    return sub;
  }
  /** Ce que la proposition automatique laisse libre sur une carte : passages entre sorties, portes, PNJ, Zaap et ateliers. */
  analyseCarte(tag: string): AnalyseCarte {
    let a = this.analyses.get(tag);
    if (a) return a;
    const wg = this.worldGrid!, open = this.zone.open!, m = wg.mapByTag(tag)!, lieux: { x: number; y: number }[] = [];
    for (const po of this.portes) for (const e of po.ends) if (e.tag === tag) lieux.push(e);
    for (const n of this.quetes?.pnjs ?? []) if (n.tag === tag || wg.mapAt(n.x, n.y)?.tag === tag) lieux.push(n);
    for (const p of this.postes) if (p.tag === tag) lieux.push(p);
    if (open.checkpoints.some(c => c.map[0] === m.x && c.map[1] === m.y)) lieux.push(this.openestCell(tag));
    a = analyserCarte(wg, tag, lieux);
    this.analyses.set(tag, a);
    return a;
  }
  /** Proposition automatique pour une carte (1C, 3A) : ce que l'éditeur montre avant qu'on la retouche. */
  propositionAuto(tag: string, groupes?: number): PlacementCarte {
    const sub = this.sousZoneGroupes(tag);
    return proposerPlacement(this.worldGrid!, tag, groupes ?? groupesAuto(sub?.groupsPerMap ?? 0, this.worldGrid!.freeByMap.get(tag)?.length ?? 0), this.analyseCarte(tag), this.quetes?.pnjs ?? []);
  }
  /** Placement en vigueur sur une carte (null : pas de groupes ici). */
  placementDe(tag: string): PlacementCarte | null { return this.placements.get(tag) ?? null; }
  /** Vrai si le placement de la carte a été posé à la main. */
  placementPoseMain(tag: string): boolean { return !!(this.opts.placements?.[tag] ?? placementPose(this.zone.open!.world, tag)); }
  /** Cartes de la zone qui ont des groupes de monstres, dans l'ordre du monde. */
  cartesAGroupes(): string[] { return (this.worldGrid?.world.maps ?? []).filter(m => this.sousZoneGroupes(m.tag)).map(m => m.tag); }
  private poserGroupes(tag: string, sub: SubAreaDef) {
    const pose = this.opts.placements?.[tag] ?? placementPose(this.zone.open!.world, tag);
    const pl = pose ? placementValide(pose) : this.propositionAuto(tag);
    this.placements.set(tag, pl);
    for (let i = 0; i < pl.g; i++) {
      const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, point: -1 };
      this.groups.push(g);
      if (!this.groupesPrets(g)) { g.cleared = true; continue; }   // tutoriel : apparaîtra à l'étape voulue (updateOpen)
      this.attendreAuMilieu(g);
      if (this.joueurPres(g, World.POSE)) this.spawnGroup(g);
      else g.dort = true;   // loin de tout joueur : posé quand l'un d'eux approche
    }
  }
  /** Éditeur de placement (F1) : la carte reprend ce placement tout de suite (null : retour au placement d'origine). */
  reposerCarte(tag: string, pl: PlacementCarte | null) {
    const sub = this.sousZoneGroupes(tag);
    if (!sub) return;
    const opts = this.opts as WorldOptions;
    opts.placements = { ...opts.placements };
    if (pl) opts.placements[tag] = placementValide(pl); else delete opts.placements[tag];
    const vieux = new Set<number>();
    for (const g of this.groups) if (g.map === tag && !g.fixe && !g.retire) { g.retire = true; vieux.add(g.id); }
    this.monsters = this.monsters.filter(m => !vieux.has(m.group));
    this.poserGroupes(tag, sub);
  }
  /** Partie de test (maquette « Panneau test » 9C) : les groupes vaincus reviennent tout de suite, même sous les yeux du joueur. */
  repeupler(): number {
    let n = 0;
    for (const g of this.groups) if (!g.retire && g.cleared && this.groupesPrets(g)) {
      if (!g.fixe && !g.members.length && !g.x && !g.y) this.attendreAuMilieu(g);
      if (g.fixe || this.joueurPres(g, World.POSE)) { this.spawnGroup(g); n++; } else { g.cleared = false; g.dort = true; }
    }
    return n;
  }
  /** Groupe jamais posé : il attend au milieu de sa carte. */
  private attendreAuMilieu(g: MonsterGroup) {
    const free = this.worldGrid!.freeByMap.get(g.map)!, q = this.worldGrid!.cellToWorld(free[free.length >> 1]);
    g.x = q.x; g.y = q.y;
  }
  /** Un joueur à moins de r du groupe (distance en losange, comme SOMMEIL). */
  private joueurPres(g: MonsterGroup, r: number) { return !!this.opts.groupesPartout || this.players.some(p => Math.abs(g.x - p.x) + Math.abs(g.y - p.y) <= r); }
  /** Groupes posés à la demande : poser ceux qu'un joueur approche, ranger ceux que tous ont quittés (au calme seulement). */
  private poserAutourDesJoueurs() {
    let retires = false;
    const loinDeTous = (x: number, y: number, r: number) => { for (const p of this.players) if (Math.abs(x - p.x) + Math.abs(y - p.y) <= r) return false; return true; };
    for (const g of this.groups) {
      if (g.retire || g.fixe) continue;
      if (g.dort) { if (!loinDeTous(g.x, g.y, World.POSE) && this.groupesPrets(g)) { g.dort = false; this.spawnGroup(g); } continue; }
      if (g.cleared) continue;
      const c = g.members.find(m => !m.dead);
      if (!c || !loinDeTous(c.x, c.y, World.RETRAIT)) continue;
      if (g.members.some(m => !m.dead && (m.state !== 'idle' || m.poseTest || m.saigneT > 0))) continue;
      g.x = c.x; g.y = c.y; g.dort = true; retires = true;
      for (const m of g.members) m.group = -2;   // retirés ci-dessous
      g.members = [];
    }
    if (retires) this.monsters = this.monsters.filter(m => m.group > -2);
  }
  /** 5B : point libre où le groupe se pose (aucun autre groupe en vie dessus), loin du joueur si possible. */
  private choisirPoint(g: MonsterGroup, pl: PlacementCarte): number {
    const wg = this.worldGrid!, p = this.player;
    const pris = new Set(this.groups.filter(o => o !== g && o.map === g.map && !o.retire && !o.cleared && !o.dort && o.point >= 0).map(o => o.point));
    const libres = pl.p.map((_, i) => i).filter(i => !pris.has(i));
    if (!libres.length) return pl.p.length ? this.rng.int(pl.p.length) : -1;
    const loin = libres.filter(i => { const q = wg.cellToWorld(wg.cellOf(g.map, pl.p[i].c)); return Math.hypot(q.x - p.x, q.y - p.y) >= 450; });
    return this.rng.pick(loin.length ? loin : libres);
  }
  private groupesPrets(g: MonsterGroup) {
    const sub = this.worldGrid!.mapByTag(g.map)?.sub;
    return g.fixe != null || sub == null || !this.quetes || this.quetes.groupesPrets(sub);
  }
  private spawnGroup(g: MonsterGroup) {
    const wg = this.worldGrid!, free = wg.freeByMap.get(g.map)!, p = this.player;
    const pl = g.fixe ? null : this.placements.get(g.map) ?? null;
    g.point = pl ? this.choisirPoint(g, pl) : -1;
    const pt = pl && g.point >= 0 ? pl.p[g.point] : null;
    // Donjons (et carte sans point) : le groupe se pose sur un coin dégagé (pas au bord d'une falaise ni dans un recoin), loin du joueur
    const ok = this.freeSet(g.map), C = wg.cols;
    const ouvert = (c: number) => { let n = 0; for (let dr = -6; dr <= 6; dr++) for (let dk = -3; dk <= 3; dk++) if (ok.has(c + dr * C + dk)) n++; return n; };
    let pos = wg.randomFree(this.rng, free), best = -1;
    for (let t = 0; t < 40; t++) {
      const c = free[this.rng.int(free.length)], q = wg.cellToWorld(c);
      const score = ouvert(c) - (Math.hypot(q.x - p.x, q.y - p.y) < 450 ? 1000 : 0)
        - (this.quetes?.pnjs.some(n => Math.hypot(q.x - n.x, q.y - n.y) < 420) ? 1000 : 0);   // pas de groupe sur un PNJ
      if (score > best) { best = score; pos = q; }
      if (best >= 80 || pt) break;
    }
    if (pt) { const c = wg.cellOf(g.map, pt.c); pos = ok.has(c) ? wg.cellToWorld(c) : wg.nearestFree(...xy(wg.cellToWorld(c)), free); }
    g.x = pos.x; g.y = pos.y; g.members = []; g.cleared = false;
    const taille = g.sub.nuit && this.estNuit() ? g.sub.nuit.groupSize : g.sub.groupSize;
    const [a, b] = (!g.fixe && this.quetes?.tailleGroupe(this.worldGrid!.mapByTag(g.map)?.sub ?? -1)) || pt?.n || taille;
    // 0.5 (5B) : dans la sous-zone envahie, groupes plus gros et monstres plus durs
    const envahi = !g.fixe && !!this.vivant?.envahie(wg.mapByTag(g.map)?.sub), n = g.fixe ? g.fixe.length : a + this.rng.int(b - a + 1) + (envahi ? VIVANT.invasion.membres : 0);
    const a0 = this.rng.range(0, Math.PI * 2), [r0, r1] = PLACEMENT.auto.rayonGroupe;
    // les membres restent du même côté des obstacles que le chef : cases atteignables à pied en quelques pas (plus de monstre derrière un mur ou une rivière)
    const c0 = wg.cellAtWorld(pos.x, pos.y), proches = new Map<number, number>(ok.has(c0) ? [[c0, 0]] : []), file = [...proches.keys()];
    for (let k = 0; k < file.length; k++) { const d = proches.get(file[k])!; if (d < 7) for (const v of wg.neighbors(file[k])) if (ok.has(v) && !proches.has(v)) { proches.set(v, d + 1); file.push(v); } }
    // jamais collé à un PNJ : les cases à moins de 260 px d'un PNJ ne comptent pas
    const prochePnj = (z: { x: number; y: number }) => this.quetes?.pnjs.some(o => Math.hypot(o.x - z.x, o.y - z.y) < 260);
    const autour = [...proches.keys()].filter(c => proches.get(c)! > 0 && !prochePnj(wg.cellToWorld(c)));
    const placeA = (x: number, y: number) => {
      if (autour.length < 4) return wg.nearestFree(x, y, free);
      let mc = autour[0], md = Infinity;
      for (const c of autour) { const q = wg.cellToWorld(c), d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < md) { md = d; mc = c; } }
      return wg.cellToWorld(mc);
    };
    for (let i = 0; i < n; i++) {
      // serrés autour du chef, chacun sa place (plus de tas de monstres les uns sur les autres)
      const ang = a0 + (i / Math.max(1, n - 1)) * Math.PI * 2 + this.rng.range(-0.3, 0.3), r = i === 0 ? 0 : this.rng.range(r0, r1);
      let q = i === 0 ? wg.nearestFree(pos.x, pos.y, free) : placeA(pos.x + Math.cos(ang) * r, pos.y + Math.sin(ang) * r);
      // sinon (pas assez de place autour du chef) on tourne autour du point jusqu'à trouver une place à plus de 260 px d'un PNJ
      for (let t = 1; t < 8 && i > 0 && prochePnj(q); t++) q = placeA(pos.x + Math.cos(ang + t * 0.8) * r, pos.y + Math.sin(ang + t * 0.8) * r);
      // l'élite unique de la sous-zone mène parfois un groupe (souvent sur son repaire, 4D), s'il n'est pas déjà en vie ailleurs
      const elite = !g.fixe && i === 0 && g.sub.elite && this.rng.next() < (pt?.r ? PLACEMENT.elite.repaire : PLACEMENT.elite.hasard) && !this.monsters.some(o => !o.dead && o.type === g.sub.elite);
      let type = g.fixe ? g.fixe[i] : elite ? g.sub.elite! : this.rng.pick(g.sub.monsters);
      // « Wabbits : 11C » : très rarement, un monstre caché mène le groupe (un seul en vie à la fois)
      const R = g.sub.rare;
      if (R && !g.fixe && i === 0 && !elite && this.rng.next() < R.chance * (this.test?.archis ? 100 : 1) && !this.monsters.some(o => !o.dead && o.type === R.monstre)) type = R.monstre;
      // 0.3 (15B) : parfois l'archimonstre officiel prend la place du monstre (un seul en vie à la fois par sorte)
      const archi = `archi_${type}`;
      if (!g.fixe && !elite && this.player.v03 && this.opts.data.monsters[archi]?.archiDe === type && this.rng.next() < ARCHI.chance * (this.test?.archis ? 100 : 1)   // partie de test (Outil test 4C) : ×100
        && !this.monsters.some(o => !o.dead && o.type === archi)) type = archi;
      const mo = this.spawnMonster(type, q.x, q.y, envahi ? this.vivant!.defEnvahi(type) : undefined);
      mo.group = g.id; mo.envahi = envahi; g.members.push(mo);
      if (elite) this.doreesPresElite(g.map, q.x, q.y);
    }
  }
  /** Ressources dorées près des élites (maquette Métiers 13C) : les ressources prêtes les plus proches de l'élite brillent. */
  private doreesPresElite(tag: string, x: number, y: number) {
    const pres = this.recoltes.filter(r => r.tag === tag && r.repousse <= 0 && Math.hypot(r.x - x, r.y - y) < RECOLTE.rayonElite)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    for (const r of pres.slice(0, RECOLTE.doreesElite)) r.dore = true;
  }
  /** Une élite en vie sur cette carte ? */
  private eliteSur(tag: string) {
    return this.monsters.some(m => !m.dead && m.def.elite && this.groups[m.group]?.map === tag);
  }
  /** Un monstre repère le joueur : tout son groupe passe à l'attaque. */
  /** Tout le groupe de m se lance à la poursuite, y compris ceux qui rentraient (3A). 7A : un « ! » rouge au réveil. */
  /** « Wabbits : 12A » : nuit à l'heure du PC (ou celle forcée dans les réglages), donnée par l'affichage. */
  estNuit(): boolean { return !!this.opts.nuit?.(); }
  aggroGroup(m: Monster) {
    const g = this.groups[m.group];
    let reveil = false;
    for (const o of g ? g.members : [m]) if (!o.dead && (o.state === 'idle' || o.state === 'return' || o === m)) {
      if (o.state === 'idle' || o.state === 'return') reveil = true;
      o.state = 'chase'; o.perduT = 0;
    }
    if (reveil && g && !m.mannequin) this.emit({ k: 'status', x: m.x, y: m.y - 30, text: '!', color: '#e0605a' });
  }
  /** 4B : un groupe qui voit un combat à quelques cases vient prêter main-forte. */
  private appelAide() {
    const r = AGGRO.appelAide.cases * CASE, p = this.player;
    const actifs = this.monsters.filter(m => !m.dead && m.group >= 0 && m.state !== 'idle' && m.state !== 'return' && m.state !== 'spawn');
    if (!actifs.length) return;
    for (const m of this.monsters) {
      if (m.dead || m.state !== 'idle' || m.group < 0 || m.poseTest || Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > World.SOMMEIL) continue;
      if (actifs.some(a => a.group !== m.group && Math.hypot(a.x - m.x, a.y - m.y) < r)) this.aggroGroup(m);
    }
  }
  /** Monde ouvert, ce qui est commun à tous : l'arène, la réapparition des groupes (hors de la vue de tous les joueurs). */
  private updateOpen(dt: number) {
    const open = this.zone.open!;
    this.updateArene(dt);
    this.guerre?.update(dt);
    this.vivant?.update(dt);
    if (!this.opts.groupesPartout) this.poserAutourDesJoueurs();
    for (const g of this.groups) {
      if (g.retire || g.dort || g.members.some(m => !m.dead)) continue;
      if (!g.cleared) {
        g.cleared = true; g.timer = open.respawn;
        for (const p of this.players) p.potions = Math.min(p.cls.potion.charges, p.potions + 1);   // un groupe vaincu rend une potion
        this.emit({ k: 'groupCleared' });
      }
      // tutoriel : les esprits du Temple reviennent vite, même pas loin (de quoi finir chaque étape sans attendre)
      const tuto = !g.fixe && !!this.quetes?.tailleGroupe(this.worldGrid!.mapByTag(g.map)?.sub ?? -1);
      g.timer -= tuto ? dt * 4 : this.vivant?.envahie(this.worldGrid!.mapByTag(g.map)?.sub) ? dt / VIVANT.invasion.reapparition : dt;   // 0.5 (5B) : l'invasion revient vite
      // Réapparition hors de la vue du joueur
      if (g.timer <= 0 && this.players.every(p => Math.hypot(g.x - p.x, g.y - p.y) > (tuto ? 500 : 900)) && !(g.donjon && this.dansDonjon(g.donjon)) && this.groupesPrets(g)) {
        if (!g.fixe && !g.members.length && !g.x && !g.y) this.attendreAuMilieu(g);   // tutoriel : jamais posé
        if (g.fixe || this.joueurPres(g, World.POSE)) this.spawnGroup(g);
        else { g.cleared = false; g.dort = true; }   // personne autour : il attend qu'un joueur approche
      }
    }
  }
  /** Monde ouvert, pour world.player (chaque joueur à son tour) : portes, calme d'arrivée, sous-zone, Zaap atteint. */
  private updateOpenJoueur(dt: number) {
    const p = this.player, open = this.zone.open!;
    this.updatePortes(dt);
    // 13A : le calme d'arrivée cesse au premier geste (sort, bond, quelques pas) ou au bout du temps
    if (this.calme) {
      const c = this.calme;
      if ((c.t -= dt) <= 0 || p.state !== 'free' || Math.hypot(p.x - c.x, p.y - c.y) > 60) this.calme = null;
    }
    const c = p.cleDonjon;
    if (c && (c.reste -= dt) <= 0) p.cleDonjon = null;
    this.updateCommande(dt);
    const m = this.worldGrid!.mapAt(p.x, p.y), sub = m ? open.subareas[String(m.sub)] ?? null : null;
    if (sub && sub !== this.area) { this.area = sub; this.emit({ k: 'enterArea', name: sub.name, level: sub.level }); }
    // intérieur (5A) : bandeau à son nom, sauf s'il porte le nom de la sous-zone (le bandeau de la sous-zone suffit)
    const lieu = m?.inside ? this.lieux.get(m.tag) ?? null : null;
    if (lieu !== this.lieu) {
      this.lieu = lieu;
      if (lieu && lieu !== sub?.name) this.emit({ k: 'enterLieu', name: lieu, region: sub?.name ?? this.zone.name, level: sub?.level ?? 0 });
    }
    // Zaap atteint : il devient le point de retour
    majCarteJoueur(this, m);   // brouillard, lieux à découvrir, tombe (« Carte : » 6A, 15A, 17A)
    const cp = m && open.checkpoints.find(c => c.map[0] === m.x && c.map[1] === m.y);
    if (cp) this.decouvrirZaap(cp.name);
    if (cp && cp.name !== this.checkpointName) {
      this.checkpointName = cp.name; this.checkpoint = this.devantZaap(cp.name) ?? this.openestCell(m.tag);
      this.emit({ k: 'checkpoint', name: cp.name });
    }
  }
  /** Monde ouvert, après une mort : retour au dernier Zaap atteint, sans pénalité (choix 10D). */
  /** Nouvel identifiant unique (objets restaurés d'une sauvegarde). */
  newUid(): number { return this.nextId++; }
  /** Point de retour courant (sauvegarde) et sa restauration. */
  get pointDeRetour() { return { name: this.checkpointName, ...this.checkpoint }; }
  setPointDeRetour(name: string, x: number, y: number) {
    if (!this.map.walkable(x, y)) return;
    this.checkpointName = name; this.checkpoint = { x, y };
  }
  /** Multi 7B : un allié debout à côté d'un joueur à terre le relève (temps, portée) ; sinon il revient seul au bout de
   *  « seul » secondes (arène : à l'arrivée ; monde ouvert : à son point de retour). Parties du serveur seulement. */
  static readonly RELEVE = { temps: 3, portee: 90, seul: 20, pv: 0.5 };
  private releverAllies(dt: number) {
    const R = World.RELEVE;
    for (const q of this.players) {
      if (!q.dead) { q.aTerre = q.releve = 0; continue; }
      q.aTerre += dt;
      const aide = this.players.some(a => a !== q && !a.dead && Math.hypot(a.x - q.x, a.y - q.y) <= R.portee);
      q.releve = aide ? q.releve + dt : Math.max(0, q.releve - dt);
      // le cercle autour du joueur à terre : où se tenir, et où en est la relève
      this.telegraphs.push({ kind: 'circle', x: q.x, y: q.y, r: R.portee, progress: Math.min(1, q.releve / R.temps), danger: false });
      if (q.releve >= R.temps) { this.relever(q, q.x, q.y, R.pv); this.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Relevé !', color: '#7fc47a' }); }
      else if (q.aTerre >= R.seul) {
        if (this.arene || !this.zone.open) { const a = this.arene?.pts.arrivee ?? this.players.find(o => !o.dead) ?? q, f = this.map.nearestFree(a.x, a.y); this.relever(q, f.x, f.y, 1); }
        else this.commeJoueur(q, () => this.respawnPlayer());
      }
    }
  }
  /** Mot de Reconstitution (Eniripsa 10B) : relève sur place un joueur à terre, à distance. */
  releverAvecSort(q: Player, pv: number) { if (q.dead) this.relever(q, q.x, q.y, pv); }
  private relever(q: Player, x: number, y: number, pv: number) {
    q.dead = false; q.hp = Math.max(1, Math.round(q.maxHp * pv)); q.x = x; q.y = y; q.kx = q.ky = 0; q.z = 0;
    q.state = 'free'; q.skill = null; q.invuln = 2; q.setAnim('idle'); q.aTerre = q.releve = 0;
  }
  respawnPlayer() {
    const p = this.player;
    if (!this.zone.open || !p.dead) return;
    if (this.arene) { this.arene.abandonner(); this.arene = null; }
    p.dead = false; p.hp = p.maxHp; p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0;
    // Guerre des Cawottes (10D) : mort sur l'île pendant une attaque = relevé au bord du champ, l'attaque continue
    const bord = this.guerre?.attaque && !this.guerre.attaque.fini && this.guerre.surIle().includes(p) ? this.guerre.bordDuChamp() : null;
    if (bord) { p.x = bord.x; p.y = bord.y; }
    p.state = 'free'; p.skill = null; p.invuln = 2; p.rage = 0; p.setAnim('idle');
    this.over = false;
    this.emit({ k: 'respawn' });
  }

  emit(e: SimEvent) {
    // un événement propre à un autre joueur que le premier (sa fenêtre, son butin, sa porte…) va dans sa boîte, pas à l'écran
    const a = this.acteur;
    if (a && a !== this.players[0] && EVENEMENTS_PERSONNELS.has(e.k)) a.evenements.push(e);
    else this.events.push(e);
    // un monstre vaincu compte pour tous les joueurs proches (groupe), le reste pour celui qui agit
    if (e.k === 'bossIntro' && this.players.length > 1) this.pourChaqueQuetes(q => q.observer(e));   // défis de donjon (succès 9C) : pour tout le groupe
    else if (e.k === 'kill' && this.players.length > 1) { const x = e.x, y = e.y, a = this.player; this.pourChaqueQuetes((q, p) => { if (p === a || Math.abs(p.x - x) + Math.abs(p.y - y) <= World.SOMMEIL) q.observer(e); }); }
    else this.quetes?.observer(e);
  }
  /** Événements propres à ce joueur depuis la dernière fois (multi : l'hôte ou le serveur les lui envoie). Le premier
   *  joueur reçoit les siens par drainEvents(). */
  evenementsDe(q: Player): SimEvent[] {
    if (q === this.players[0]) return [];
    const e = q.evenements; q.evenements = []; return e;
  }
  /** Coop, chez l'invité : événements venus de l'hôte, rejoués pour l'affichage seulement (pas de quête qui avance). */
  rejouer(evs: SimEvent[]) { this.events.push(...evs); }
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  walkable(x: number, y: number) { return this.map.walkable(x, y); }
  /** Chemin à pied (A* sur les cases de Dofus) vers un point. */
  findPath(from: { x: number; y: number }, to: { x: number; y: number }) { return this.test?.murs && from === this.player ? [{ x: to.x, y: to.y }] : this.map.findPath(from, to); }
  /** Partie de test (8A) : recharges, PA et PM pleins. */
  rechargerTout() {
    const p = this.player;
    for (const k of Object.keys(p.cd)) p.cd[k] = 0;
    p.casts = {};   // charges pleines
    p.pa = p.paMax; p.pm = p.pmMax; p.potionCd = 0;
  }
  /** Ligne de tir sans obstacle (cases marchables) entre deux points. */
  clearShot(from: { x: number; y: number }, to: { x: number; y: number }) { return this.map.clearLine(from, to); }

  /** Avance la simulation de dt secondes. */
  /** Entrées de world.player qui touchent au monde : récolte, atelier, Havre-Sac, Zaap, portail, PNJ. */
  private entreesMonde(input: PlayerInput) {
    appliquerCarte(this, this.player, input.carte);   // carte du monde : drapeaux, signal (« Carte : » 9A, 14A-B)
    if (input.recolte != null) { this.versRecolte = input.recolte; this.approche = this.approcheRecolte(input.recolte); this.enRecolte = null; }
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.move.x || input.move.y) {
      if (this.enRecolte) this.emit({ k: 'recolteStop' });
      this.versRecolte = null; this.enRecolte = null;
    }
    // Ateliers (Métiers UI) : clic sur un poste = y aller ; tout autre geste coupe la marche vers le poste et la fabrication
    if (input.atelier != null) { this.versPoste = input.atelier; this.approcheP = this.approchePoste(input.atelier); this.annulerFabrication(); }
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.recolte != null || input.move.x || input.move.y) {
      this.versPoste = null; this.annulerFabrication();
    }
    // Havre-Sac : bouger ou agir coupe l'incantation ; H la lance (ou fait sortir) ; le Zaap du Havre-Sac fait sortir
    if (this.incantation && (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.recolte != null || input.move.x || input.move.y)) this.couperIncantation();
    if (input.havreSac) this.havreSac();
    if (input.coffre && this.player.cls.coffre && !this.player.dead) ouvrirCoffre(this.player, this);   // Enutrof : touche du coffre
    if (input.coffre && this.player.cls.poker && !this.player.dead) jouerMain(this.player, this);   // Écaflip : la même touche Joue la Main
    if (input.meute != null && this.monsters.some(m => m.id === input.meute && !m.dead)) this.cibleMeute = input.meute;
    if (input.zaap != null) this.voyagerZaap(input.zaap);
    if (input.versZaap) this.versZaap = input.versZaap;
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.recolte != null || input.atelier != null || input.move.x || input.move.y) this.versZaap = null;
    if (input.versPortail) this.versPortail = input.versPortail;
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.recolte != null || input.atelier != null || input.move.x || input.move.y) this.versPortail = null;
    if (this.quetes) {
      if (input.reponse != null) this.quetes.repondre(input.reponse);
      if (input.talk) this.quetes.cliquer(input.talk);
      else if (input.dest || input.target != null || input.pickup != null) this.quetes.annulerClic();
    }
  }
  step(dt: number, input: PlayerInput, autres?: Record<number, PlayerInput>) {
    this.time += dt;
    this.telegraphs.length = 0;
    const p = this.player;
    if (this.test) {
      for (const c of input.test ?? []) appliquerTest(this, c);
      p.vitesseTest = this.test.course ? 3 : 1;
      if (this.test.recharges) this.rechargerTout();
    }
    const ents = [...this.players, ...this.monsters, ...this.betes], prev = ents.map(e => [e.x, e.y] as const);
    this.entreesMonde(input);
    p.update(dt, this.passage || this.zaapDepart ? { ...NO_INPUT, aim: input.aim } : input, this);   // devant une porte ou un Zaap : le perso attend le fondu
    // Multi (étape 0) : les autres joueurs agissent avec leurs propres entrées ; pendant leur pas, this.player = eux
    for (let i = 1; i < this.players.length; i++) {
      const q = this.players[i], e = autres?.[q.id];
      this.acteur = q;
      try {
        if (e) this.entreesMonde(e);
        q.update(dt, !e || this.passage || this.zaapDepart ? { ...NO_INPUT, aim: e?.aim ?? { x: q.x, y: q.y } } : e, this);
      } finally { this.acteur = null; }
    }
    if (this.test?.recharges) this.rechargerTout();
    // Monde ouvert : un monstre qui attend loin du joueur dort (pas d'errance ni d'IA) : bien moins de calcul
    for (const m of this.monsters) {
      if (m.saigneT > 0 && !m.dead) this.saigner(m, dt);
      if (this.zone.open && m.state === 'idle' && !m.dead && this.players.every(q => Math.abs(m.x - q.x) + Math.abs(m.y - q.y) > World.SOMMEIL)) { m.regenCalme(dt); continue; }
      if (m.guerre && this.guerre?.attaque?.piloter(m, dt)) continue;
      if (m.arene && this.arene?.piloter(m, dt)) continue;
      if (m.evenement >= 0 && this.vivant?.piloter(m, dt)) continue;
      m.update(dt, this.cibleDe(m), this);
    }
    for (const b of this.betes) b.update(dt, this);
    for (const q of this.players) this.renvoyerSurplus(q);
    this.betes = this.betes.filter(b => !(b.dead && b.t <= 0));
    if (this.zone.open && !p.dead && (this.appelT -= dt) <= 0) { this.appelT = AGGRO.appelAide.periode; this.appelAide(); }
    const M = AGGRO.massacre;
    if (this.massacre.n >= M.min && this.time - this.massacre.t > M.fenetre) { this.emit({ k: 'massacreFin', n: this.massacre.n }); this.massacre.n = 0; }
    this.updateProjectiles(dt);
    this.updateZonesSol(dt);
    this.updateDrops(dt);
    if (this.opts.partieServeur && this.players.length > 1) this.releverAllies(dt);
    this.separate();
    // Cases bloquantes : on glisse le long des obstacles (axe par axe), sauf en plein Bond
    ents.forEach((e, i) => {
      if (e instanceof Player && (e.airborne || this.test?.murs)) return;
      if (e.x === prev[i][0] && e.y === prev[i][1]) return;   // pas bougé : déjà vérifié (les monstres endormis, presque tous)
      if (this.walkable(e.x, e.y)) return;
      const [ox, oy] = prev[i];
      if (this.walkable(e.x, oy)) e.y = oy;
      else if (this.walkable(ox, e.y)) e.x = ox;
      else { e.x = ox; e.y = oy; }
      // L'ancienne position peut être bloquée aussi (fin de Bond au-dessus d'un obstacle) : case libre la plus proche
      if (!this.walkable(e.x, e.y)) { const f = this.map.nearestFree(e.x, e.y); e.x = f.x; e.y = f.y; }
      e.kx = 0; e.ky = 0;
    });
    this.monsters = this.monsters.filter(m => !(m.dead && m.t <= 0));
    // chaque joueur à son tour (this.player = lui) : son atelier, et en monde ouvert ses portes, sa récolte, son Havre-Sac, ses quêtes
    for (const q of this.players) this.commeJoueur(q, () => {
      this.updateAteliers(dt);
      if (!this.zone.open) return;
      this.updateOpenJoueur(dt); this.updateRecoltes(dt); this.updateIncantation(dt); this.updateArche(); this.updateZaap(dt); q.quetes?.update(dt);
    });
    if (this.zone.open) { this.updateOpen(dt); this.updateRepousse(dt); this.passants?.update(dt); return; }
    if (!this.over && this.monsters.length === 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.spawnWave(); this.waveDelay = 2; }
    }
  }

  spawnWave() {
    this.wave++;
    const plan = planWave(this.wave, this.zone.waves!, this.rng);
    this.emit({ k: 'wave', n: this.wave, boss: plan.boss, archi: plan.archi });
    // chaque nouvelle vague rend une potion
    const p = this.player;
    if (this.wave > 1) p.potions = Math.min(p.cls.potion.charges, p.potions + 1);
    for (const type of plan.monsters) {
      let pos = this.map.randomFree(this.rng), tries = 0;
      while (Math.hypot(pos.x - this.player.x, pos.y - this.player.y) < 300 && ++tries < 50) pos = this.map.randomFree(this.rng);
      this.spawnMonster(type, pos.x, pos.y);
    }
  }

  /** def : définition modifiée (élite de quête : PV et nom). */
  spawnMonster(type: string, x: number, y: number, def = this.opts.data.monsters[type]): Monster {
    if (!def) throw new Error(`Monstre inconnu : ${type}`);
    const fx = this.fxIdoles;
    if (fx) def = defSousIdoles(def, fx);   // 0.6 (17) : PV, dégâts, vitesse et résistances sous les idoles
    const m = new Monster(this.nextId++, type, def, x, y, this);
    this.monsters.push(m);
    return m;
  }

  // --- Flèches ---------------------------------------------------------------
  shoot(x: number, y: number, facing: number, hz: Extract<HitZone, { shape: 'projectile' }>, hit: HitDef, stun: number, area: number, spell: string) {
    this.projectiles.push({ id: this.nextId++, spell, x, y, dx: Math.cos(facing), dy: Math.sin(facing), left: hz.range + this.player.porteeStat(spell), speed: hz.speed,
      width: hz.width, explode: (hz.explode ?? 0) * area, pierce: !!hz.pierce, hit, stun, touched: new Set(), fleche: hz.fleche || undefined, tireur: this.player });
  }
  /** Projectile d'un monstre vers le joueur. */
  /** Projectile d'un sort de monstre (missileGfxId dans ses données), lancé vers le joueur. */
  monsterMissile(m: Monster, spell: MonsterSpell, range: number) {
    const el = (spell.effects.find(e => e.k === 'dmg') as { element: Element } | undefined)?.element ?? 'neutre';
    this.projectiles.push({ id: this.nextId++, spell: `m${spell.id}`, x: m.x + m.dirX * m.radius, y: m.y + m.dirY * m.radius, dx: m.dirX, dy: m.dirY,
      left: range, speed: 420, width: 12, explode: 0, pierce: false, hit: { dmg: 0, knock: 0, element: el }, stun: 0, touched: new Set(), hostile: true,
      from: { monster: m, spell } });
  }
  /** Applique au joueur les effets d'un sort de monstre, dans l'ordre des données de Dofus 3.
   *  Dommages : jet officiel ramené à l'échelle du monstre (son meilleur sort, tous ses coups additionnés = def.dmg) ;
   *  mult : attaque signature d'un boss (4A, ×2,5). */
  monsterSpellHits(m: Monster, spell: MonsterSpell, c: Cible, mult = 1) {
    if (c.dead) return;
    const k = m.def.dmg / Math.max(1, jetOfficiel(m.def)) * mult;
    if (c instanceof Bete) {   // une bête de l'Osamodas : dommages, vol de vie et poussées seulement
      for (const e of spell.effects) {
        if (e.k === 'dmg') {
          const n = Math.round((e.perPa ? e.min : this.rng.range(e.min, e.max + 1)) * k * (1 + m.furyPct / 100) + m.furyFlat * k);
          if (n > 0 && c.hurt(n, m.x, m.y, this, e.element) && e.steal) m.hp = Math.min(m.maxHp, m.hp + Math.round(n / 2));
        } else if (e.k === 'attire' || e.k === 'repousse') {
          const dx = m.x - c.x, dy = m.y - c.y, d = Math.hypot(dx, dy) || 1, sign = e.k === 'attire' ? 1 : -1;
          c.kx += sign * dx / d * e.n * CASE * 4; c.ky += sign * dy / d * e.n * CASE * 4;
        }
      }
      return;
    }
    const p = c;
    let landed = true;
    for (const e of spell.effects) {
      if (e.k === 'dmg') {
        const jet = e.perPa ? e.min * k * Math.max(0, p.paMax - p.pa) : this.rng.range(e.min, e.max + 1) * k;
        const n = Math.round(jet * (1 + m.furyPct / 100) + m.furyFlat * k);   // + bonus de Dommages (Frénésie…)
        if (n <= 0) continue;
        landed = p.hurt(n, m.x, m.y, this, e.element);
        if (!landed) return;
        if (e.steal) m.hp = Math.min(m.maxHp, m.hp + Math.round(n / 2));
      } else if (!landed) return;
      else if ((e.k === 'pa' || e.k === 'pm') && e.n < 0) {
        // Retrait officiel du monstre (Retrait PA ; pas de Retrait PM dans ses données) contre l'Esquive du joueur
        const n = this.removed(-e.n, e.k === 'pa' ? m.def.caracs?.retraitPA ?? 0 : 0, p.esquive(e.k === 'pa' ? 'PA' : 'PM'));
        // Dofus Cawotte (Sagesse Wabbit) : la tentative suffit, l'Esquive monte tout de suite pour les suivantes
        if (p.porteDofus('cawotte')) {
          const C = PASSIFS.cawotte, st = e.k === 'pa' ? 'esquivePA' : 'esquivePM', src = `cawotte_${e.k}`;
          if (p.mods.filter(x => x.src === src).length < C.max) { p.addMod(st, C.esquive, C.duree, src); this.emit({ k: 'status', x: p.x, y: p.y - 30, text: 'Sagesse Wabbit', color: '#e8902a' }); }
        }
        if (!n) this.emit({ k: 'status', x: p.x, y: p.y, text: 'Esquive', color: '#c8c8c8' });
        else if (e.k === 'pa') { p.pa = Math.max(0, p.pa - n); this.emit({ k: 'status', x: p.x, y: p.y, text: `-${n} PA`, color: '#5aa8ff' }); }
        else {
          p.pm = Math.max(0, p.pm - n); p.slow(Math.max(1, e.dur) * TOUR, Math.min(0.6, n * 0.15));
          this.emit({ k: 'status', x: p.x, y: p.y, text: `-${n} PM`, color: '#7be07b' });
        }
      }
      else if (e.k === 'puissance') { p.addMod('puissance', e.n, Math.max(1, e.dur) * TOUR); this.emit({ k: 'status', x: p.x, y: p.y, text: `${e.n} Puissance`, color: '#e0a030' }); }
      else if (e.k === 'attire' || e.k === 'repousse') {
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, sign = e.k === 'attire' ? 1 : -1;
        const len = sign > 0 ? Math.min(e.n * CASE, Math.max(0, d - m.radius - p.radius - 4)) : e.n * CASE;
        p.kx += sign * dx / d * len * 7.13; p.ky += sign * dy / d * len * 7.13;   // le recul freine en 0,0008^t : distance = vitesse / 7,13
      }
      else if (e.k === 'soin') m.hp = Math.min(m.maxHp, m.hp + Math.round(this.rng.range(e.min, e.max + 1) * k / mult));
      else if (e.k === 'subis') {   // Grognement, Bave Affaiblissante : le joueur prend plus de dommages
        p.subis = e.n / 100; p.subisT = p.subisT0 = Math.max(1, e.dur) * TOUR;
        this.emit({ k: 'status', x: p.x, y: p.y, text: `Dommages subis ${e.n > 100 ? '+' : ''}${e.n - 100} %`, color: '#e07cf0' });
      }
      else if (e.k === 'desenvoute') {   // Rinçage : bonus et bouclier raccourcis de n tours
        for (const md of p.mods) md.t -= e.n * TOUR;
        p.mods = p.mods.filter(md => md.t > 0);
        if (p.shieldT > 0) { p.shieldT -= e.n * TOUR; if (p.shieldT <= 0) { p.shieldT = 0; p.shield = 0; } }
        this.emit({ k: 'status', x: p.x, y: p.y, text: 'Désenvoûté', color: '#9ad0ff' });
      }
      else if (e.k === 'etat' && Math.hypot(p.x - m.x, p.y - m.y) <= (e.r + 0.5) * CASE + p.radius) {   // Hyperleukocytine : Pacifiste
        { const t = Math.max(1, e.dur) * TOUR; if (t >= p.pacifiste) p.pacifisteT0 = t; p.pacifiste = Math.max(p.pacifiste, t); }
        this.emit({ k: 'status', x: p.x, y: p.y - 20, text: 'Pacifiste', color: '#c8c8c8' });
      }
    }
  }
  /** Sort lancé sur un allié (ex. Bêlement : +PM -> le monstre court plus vite pendant la durée). */
  monsterSpellBuff(m: Monster, spell: MonsterSpell) {
    for (const e of spell.effects) if (e.k === 'pm' && e.n > 0) {
      m.haste = 1 + e.n * 0.25; m.hasteT = Math.max(1, e.dur) * TOUR;
      this.emit({ k: 'status', x: m.x, y: m.y, text: `+${e.n} PM`, color: '#7be07b' });
    } else if (e.k === 'subis') {   // Cuirasse Laineuse : ses alliés prennent moins de dommages
      m.subis = e.n / 100; m.subisT = Math.max(1, e.dur) * TOUR;
      this.emit({ k: 'status', x: m.x, y: m.y, text: `Dommages subis ${e.n > 100 ? '+' : ''}${e.n - 100} %`, color: '#c8b48a' });
    } else if (e.k === 'dommages') {
      if (e.pct) m.furyPct = e.n; else m.furyFlat = e.n;
      m.furyT = Math.max(1, e.dur) * TOUR;
      this.emit({ k: 'status', x: m.x, y: m.y, text: `+${e.n}${e.pct ? ' %' : ''} Dommages`, color: '#ff7a3a' });
    }
  }
  /** Invocation (ex. Appel de Kardorib) : le monstre invoqué apparaît au contact du lanceur et attaque tout de suite.
   *  Il ne donne ni XP ni butin et disparaît avec son invocateur. */
  summon(m: Monster, type: string) {
    if (!this.opts.data.monsters[type]) return;
    const a = this.rng.range(0, Math.PI * 2), d = m.radius + 30;
    const wg = this.worldGrid, tag = wg?.mapAt(m.x, m.y)?.tag;
    const q = wg && tag ? wg.nearestFree(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, wg.freeByMap.get(tag)!) : { x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d };
    const s = this.spawnMonster(type, q.x, q.y);
    s.summoner = m; s.homeX = m.homeX; s.homeY = m.homeY; s.t = 0.3;
    this.emit({ k: 'status', x: s.x, y: s.y - 40, text: s.def.name, color: '#e0d0b0' });
  }
  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      const st = Math.min(pr.left, pr.speed * dt);
      pr.x += pr.dx * st; pr.y += pr.dy * st; pr.left -= st;
      if (pr.hostile) {
        if (!this.walkable(pr.x, pr.y)) pr.left = 0;   // arrêté par le décor
        else {
          const c: Cible | undefined = [...this.players, ...this.betes].find(q => !q.dead && Math.hypot(q.x - pr.x, q.y - pr.y) <= q.radius + pr.width);
          if (c) {
            if (pr.from) this.monsterSpellHits(pr.from.monster, pr.from.spell, c);
            else if (c instanceof Player) c.hurt(pr.hit.dmg, pr.x - pr.dx * 20, pr.y - pr.dy * 20, this, pr.hit.element, true);   // un projectile : coup à distance (Dofus Cacao)
            else c.hurt(pr.hit.dmg, pr.x - pr.dx * 20, pr.y - pr.dy * 20, this, pr.hit.element);
            pr.left = 0;
          }
        }
        if (pr.left <= 0) this.emit({ k: 'spell', fx: 'burst', id: pr.spell, x: pr.x, y: pr.y, facing: Math.atan2(pr.dy, pr.dx), size: 18, arc: 0,
          element: pr.hit.element ?? 'neutre', big: false, boosted: false });
        continue;
      }
      const target = this.monsters.find(m => !m.dead && m.state !== 'spawn' && !pr.touched.has(m.id) && Math.hypot(m.x - pr.x, m.y - pr.y) <= m.radius + pr.width);
      let end = pr.left <= 0;
      const avant = this.acteur;
      if (pr.tireur && this.players.includes(pr.tireur)) this.acteur = pr.tireur;   // Multi : la flèche frappe avec les caracs de son tireur
      try {
        if (target) {
          if (pr.explode) { this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun); this.gerbe(pr); end = true; }
          else {
            pr.touched.add(target.id);
            this.applyHits(m => m === target, pr.hit, pr.x - pr.dx * 10, pr.y - pr.dy * 10, pr.stun, Math.atan2(pr.dy, pr.dx));
            if (pr.hit.perce) pr.hit = { ...pr.hit, dmg: pr.hit.dmg * 0.85, perce: pr.hit.perce - 1 };   // Flèche perçante
            else if (!pr.pierce) end = !this.rebondir(pr, target);
          }
          this.emit({ k: 'impact', hitstop: 0.03, shake: pr.explode ? 0.008 : 0.003, big: false });
        } else if (end && pr.explode) { this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun); this.gerbe(pr); }
      } finally { this.acteur = avant; }
      if (end) {
        pr.left = 0;
        if (pr.fleche) continue;   // la flèche se plante ou disparaît dans le monstre : pas d'explosion
        this.emit({ k: 'spell', fx: 'burst', id: pr.spell, x: pr.x, y: pr.y, facing: Math.atan2(pr.dy, pr.dx), size: pr.explode || 26, arc: 0,
          element: pr.hit.element ?? 'neutre', big: pr.explode > 0, boosted: false });
      }
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0);
  }

  /** Flèche rebelle (Crâ C) : la flèche repart vers le monstre le plus proche pas encore touché, −20 % par rebond. */
  private rebondir(pr: Projectile, from: Monster): boolean {
    if (!pr.hit.rebonds) return false;
    const next = this.monsters.filter(m => !m.dead && m.state !== 'spawn' && !pr.touched.has(m.id) && Math.hypot(m.x - from.x, m.y - from.y) <= CASE * 6)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (!next) return false;
    const d = Math.hypot(next.x - pr.x, next.y - pr.y) || 1;
    pr.dx = (next.x - pr.x) / d; pr.dy = (next.y - pr.y) / d; pr.left = d + CASE;
    pr.hit = { ...pr.hit, dmg: pr.hit.dmg * 0.8, rebonds: pr.hit.rebonds - 1 };
    return true;
  }
  /** Gerbe de feu (Crâ A) : 3 petites explosions autour du point d'impact. */
  private gerbe(pr: Projectile) {
    const v = pr.hit.gerbe;
    if (!v) return;
    for (let i = 0; i < 3; i++) {
      const a = Math.atan2(pr.dy, pr.dx) + (i * 2 * Math.PI) / 3, x = pr.x + Math.cos(a) * pr.explode * 0.8, y = pr.y + Math.sin(a) * pr.explode * 0.8;
      this.hitCircle(x, y, CASE, { ...pr.hit, dmg: pr.hit.dmg * v / 100, gerbe: undefined });
      this.emit({ k: 'spell', fx: 'burst', id: 'pc-cra-A', x, y, facing: a, size: CASE, arc: 0, element: pr.hit.element ?? 'feu', big: false, boosted: false });
    }
  }
  /** Zones au sol des légendaires de classe : chaque monstre qui y passe est frappé une fois. */
  private updateZonesSol(dt: number) {
    if (!this.zonesSol.length) return;
    for (const z of this.zonesSol) {
      z.t -= dt;
      this.telegraphs.push({ kind: 'circle', x: z.x, y: z.y, r: z.r, progress: 1, danger: false });
      const n = this.applyHits(m => !z.touches.has(m.id) && Math.hypot(m.x - z.x, m.y - z.y) <= z.r + m.radius, z.hit, z.x, z.y, 0);
      if (n) for (const m of this.monsters) if (!m.dead && Math.hypot(m.x - z.x, m.y - z.y) <= z.r + m.radius) z.touches.add(m.id);
    }
    this.zonesSol = this.zonesSol.filter(z => z.t > 0);
  }
  /** Repousse tous les monstres d'un cercle depuis son centre, sans les frapper (Cri du champion). */
  repousser(x: number, y: number, r: number, knock: number): number {
    let k = 0;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || m.intouchable || Math.hypot(m.x - x, m.y - y) > r + m.radius) continue;
      const a = Math.atan2(m.y - y, m.x - x), kb = knock / m.def.mass;
      m.kx += Math.cos(a) * kb; m.ky += Math.sin(a) * kb; k++;
    }
    return k;
  }

  // --- Zones de frappe (coordonnées monde) --------------------------------
  hitCone(x: number, y: number, facing: number, range: number, arc: number, def: HitDef, stun = 0) {
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
      return d <= range + m.radius && (d < m.radius + 8 || Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= arc / 2);
    }, def, x, y, stun);
  }
  hitLine(x: number, y: number, facing: number, length: number, width: number, def: HitDef, stun = 0) {
    const c = Math.cos(facing), s = Math.sin(facing);
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, t = dx * c + dy * s, perp = Math.abs(-dx * s + dy * c);
      return t >= -m.radius && t <= length + m.radius && perp <= width + m.radius;
    }, def, x, y, stun, facing);
  }
  hitCircle(x: number, y: number, r: number, def: HitDef, stun = 0, pushDir?: number) {
    return this.applyHits(m => Math.hypot(m.x - x, m.y - y) <= r + m.radius, def, x, y, stun, pushDir);
  }
  applyHits(test: (m: Monster) => boolean, def: HitDef, ox: number, oy: number, stun: number, pushDir?: number): number {
    const p = this.player, cls = p.cls;
    let n = 0;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || !test(m)) continue;
      if (p.pacifiste > 0) { this.emit({ k: 'status', x: m.x, y: m.y - 20, text: 'Pacifiste', color: '#c8c8c8' }); return 0; }   // Hyperleukocytine : aucun dommage
      if (m.intouchable) { if (this.time - this.intouchableT > 0.6) { this.intouchableT = this.time; this.emit({ k: 'status', x: m.x, y: m.y - 30, text: 'Intouchable', color: '#c8c8c8' }); } continue; }
      n++; this.cibleMeute = m.id;
      const crit = this.rng.next() < p.critChance + (def.crit ?? 0);
      // Choix 19A : résistances officielles du monstre dans l'élément du coup (plafonnées à 50 %, comme Dofus)
      const el = p.resolveElement(def.element ?? 'neutre'), res = Math.min(50, m.def.res?.[el] ?? 0);
      // Initiative : le premier coup porté à un monstre est renforcé ; Dommages Critiques et Dommages Poussée s'ajoutent au coup
      const first = m.struck ? 1 : 1 + initiativeBonus(p.initiative); m.struck = true;
      const flat = (crit ? p.stat('dommagesCritiques') : 0) + (def.knock > 0 ? p.stat('dommagesPoussee') : 0);
      const vs = def.vsSummon && (m.summoner || (def.vsElite && (m.def.elite || m.def.boss))) ? def.vsSummon : 1;
      const vu = (m.vulnT > 0 ? 1 + m.vuln / 100 : 1) * m.subis;   // dommages subis augmentés (Bond) ou réduits (Cuirasse Laineuse)
      // Légendaires de classe : Marque du chasseur (les autres coups), Œil d'aigle (par case de distance)
      const pc = (m.marqueJusqua > this.time && !def.marque ? 1 + m.marque / 100 : 1)
        * (def.vsGros && (m.def.elite || m.def.boss) ? 1 + def.vsGros / 100 : 1) * (def.plus ? 1 + def.plus / 100 : 1)
        * (def.loin ? 1 + Math.min(def.loin * 10, def.loin * Math.hypot(m.x - p.x, m.y - p.y) / CASE) / 100 : 1);
      // Sort sans dommages (Attirance, Transposition) : seulement ses effets
      const dmg = def.dmg <= 0 ? 0 : Math.max(1, Math.round((p.damage(def.dmg * vs, def.element ?? 'neutre') * this.rng.range(0.9, 1.1) * (crit ? cls.critMult : 1) * first + flat) * (1 - res / 100) * vu * pc));
      m.hp -= dmg; m.flash = 0.09; m.calmeT = 0; this.degatsCoup += dmg;
      if (def.festin) this.festin += dmg;
      if (dmg && m.suppliceT > 0) p.hp = Math.min(p.maxHp, p.hp + Math.round(dmg * m.supplice));   // Supplice : frapper la cible soigne
      if (def.supplice) { m.supplice = def.supplice.part; m.suppliceT = def.supplice.t; }
      if (def.affaiblit && m.furyPct <= 0) { m.furyPct = -def.affaiblit.n; m.furyT = Math.max(m.furyT, def.affaiblit.t); }   // Kyrja
      if (def.attire) {   // attire vers le lanceur (jusqu'au contact) ou vers le centre de la zone, sans tenir compte du poids (officiel)
        const vx = def.attire.vers === 'lanceur' ? p.x : ox, vy = def.attire.vers === 'lanceur' ? p.y : oy;
        const d0 = Math.hypot(vx - m.x, vy - m.y), marge = def.attire.vers === 'lanceur' ? m.radius + p.radius + 4 : 0;
        const L = Math.min(def.attire.px, Math.max(0, d0 - marge));
        if (L > 0 && d0 > 0) { m.kx += (vx - m.x) / d0 * L * 7.13; m.ky += (vy - m.y) / d0 * L * 7.13; }
      }
      if (m.state === 'idle' || m.state === 'return') this.aggroGroup(m);   // 3A + 4A : un coup, même de loin, réveille tout son groupe
      if (def.erosion) { m.maxHp = Math.max(1, m.maxHp - Math.round(dmg * def.erosion)); m.hp = Math.min(m.hp, m.maxHp); }
      // Retrait PA / PM du joueur contre l'Esquive officielle du monstre : chaque point a sa chance de passer
      const pm = this.removed(def.pmLoss ?? 0, p.retrait('PM'), m.def.caracs?.esquivePM ?? 0);
      const pa = this.removed(def.paLoss ?? 0, p.retrait('PA'), m.def.caracs?.esquivePA ?? 0);
      if (pm || pa || def.poLoss) m.entraveA = this.time;   // Enutrof 1B : un monstre entravé vaut une pièce de plus
      if (pm) { m.haste = Math.min(m.haste, Math.max(0.3, 1 - 0.15 * pm)); m.hasteT = Math.max(m.hasteT, TOUR);
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${pm} PM`, color: '#9ad15a' }); }
      if (pa) { m.atkCd = Math.max(m.atkCd, 0) + 0.4 * pa;
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${pa} PA`, color: '#5aa8ff' }); }
      if (def.poLoss) { m.poMalus = Math.max(m.poMalus, def.poLoss); m.poMalusT = TOUR;   // retrait de Portée : ne s'esquive pas
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${def.poLoss} PO`, color: '#c8a0ff' }); }
      if ((def.pmLoss && !pm) || (def.paLoss && !pa)) this.emit({ k: 'status', x: m.x, y: m.y, text: 'Esquive', color: '#c8c8c8' });
      const a = pushDir ?? Math.atan2(m.y - oy, m.x - ox);
      const kb = def.knock / m.def.mass * (m.peintT > 0 ? 1 + m.peintK : 1);   // Mot de Peinture : poussé plus loin
      m.kx += Math.cos(a) * kb; m.ky += Math.sin(a) * kb;
      const choc = def.pushDmg && kb > 0 && this.pushDamage(m, a, kb / 7.13, (def.clouage ?? 0) + (def.choc ?? 0), def.enclume);
      if (choc && def.chocRage) p.addRage(def.chocRage, this);
      if (choc && def.plusChoc && dmg > 0 && m.hp > 0) {   // Estoc en avant : la cible heurte un obstacle
        const sup = Math.max(1, Math.round(dmg * def.plusChoc / 100)); m.hp -= sup;
        this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 20, amount: sup, crit: false, element: el, sort: def.sort });
      }
      if (!m.def.boss) m.stun = Math.max(m.stun, stun || 0.12);   // petit vacillement : interrompt les télégraphes
      else if (stun) m.stun = Math.max(m.stun, stun * 0.3);
      if (def.brule && kb > 0 && dmg > 0 && m.hp > 0) {   // Barrage incendiaire : le monstre repoussé brûle 2 s
        if (m.saigneT <= 0) this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Brûle', color: '#ff8a3c' });
        m.saigne = dmg * def.brule / 100 / 2; m.saigneT = 2;
      }
      if (choc && def.clouage) { m.stun = Math.max(m.stun, m.def.boss ? 0.15 : 0.5); this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Cloué !', color: '#f2d36b' }); }
      if (def.marque) { m.marque = def.marque; m.marqueJusqua = this.time + 4; this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Marqué', color: '#ff7b6b' }); }
      if (def.givre && !m.def.boss) {   // Givre mordant : 3 coups en 5 s = gelé (une fois par monstre toutes les 6 s)
        m.glaceCoups = [...m.glaceCoups.filter(t => this.time - t < 5), this.time];
        if (m.glaceCoups.length >= 3 && this.time - m.gelA >= 6) {
          m.gelA = this.time; m.glaceCoups = [];
          m.stun = Math.max(m.stun, def.givre * (m.def.elite ? 0.5 : 1));
          this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Gelé !', color: '#8fd8ff' });
        }
      }
      if (def.stase && !m.def.boss && this.time - m.staseA >= 5) {   // Stase de sang
        m.staseA = this.time; m.stun = Math.max(m.stun, def.stase * (m.def.elite ? 0.5 : 1));
        this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Stase', color: '#d0102a' });
      }
      if (def.execute && m.hp > 0 && !m.def.boss && !m.mannequin && m.hp <= m.maxHp * def.execute * (m.def.elite ? 0.5 : 1) && p.age - p.couperetA >= 4) {
        p.couperetA = p.age; m.hp = 0;   // Couperet du bourreau
        this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Exécuté !', color: '#ff5050' });
      }
      if (dmg) this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit, element: el, eclat: def.eclat, sort: def.sort });
      if (n <= 3) p.rageOnHit(Math.hypot(m.x - p.x, m.y - p.y), this);
      if (def.lifesteal) {
        const soin = Math.round(dmg * def.lifesteal), trop = p.hp + soin - p.maxHp;
        p.hp = Math.min(p.maxHp, p.hp + soin);
        if (def.partage && soin > 0) {   // Kyrja du champion : les alliés à 3 cases en profitent
          const n = soin * def.partage / 100;
          for (const q of this.players) if (q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= CASE * 3) q.hp = Math.min(q.maxHp, q.hp + Math.round(n));
          for (const b of this.betes) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) <= CASE * 3) b.soigner(n, this);
        }
        if (def.surplus && trop > 0) {   // Sève d'Abolition : la vie volée en trop devient un bouclier (5 s)
          p.shield = Math.min(Math.round(p.maxHp * def.surplus / 100), Math.max(p.shieldSrc === 'pc-cra-N' ? p.shield : 0, 0) + trop);
          p.shieldT = p.shieldT0 = 5; p.shieldSrc = 'pc-cra-N';
        }
      }
      if (def.lifesteal && dmg > 0 && m.hp > 0 && p.souffrance >= 6 && p.pcv('pc-sacrieur-C')) {   // Coups qui saignent : 2 s de saignement
        if (m.saigneT <= 0) this.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Saigne', color: '#d0102a' });
        m.saigne = dmg * p.pcv('pc-sacrieur-C') / 100 / 2; m.saigneT = 2;
      }   // la Rage monte avec les coups portés (3 cibles max par coup)
      if (m.hp <= 0) { this.killMonster(m); if (def.tue) p.aTue(def.tue, this); }
    }
    return n;
  }
  /** Sacrieur (Assaut, Transposition) : échange de place avec le monstre le plus proche du point visé. */
  echanger(p: Player, x: number, y: number, r: number): boolean {
    let best: Monster | null = null, bd = Infinity;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || m.def.boss) continue;
      const d = Math.hypot(m.x - x, m.y - y) - m.radius;
      if (d <= r && d < bd) { bd = d; best = m; }
    }
    if (!best) return false;
    const ox = p.x, oy = p.y;
    p.x = best.x; p.y = best.y; best.x = ox; best.y = oy;
    this.emit({ k: 'echange', x: p.x, y: p.y, ox, oy });
    return true;
  }
  /** Couronne d'Épines : renvoie des dommages de mêlée au monstre qui vient de frapper (le plus proche du point d'où vient le coup). */
  renvoyer(fromX: number, fromY: number, dmg: number) {
    let best: Monster | null = null, bd = CASE * 1.6;
    for (const m of this.monsters) {
      if (m.dead || m.intouchable) continue;
      const d = Math.hypot(m.x - fromX, m.y - fromY) - m.radius;
      if (d < bd) { bd = d; best = m; }
    }
    if (!best || dmg < 1) return;
    const n = Math.round(dmg);
    best.hp -= n; best.flash = 0.09;
    this.emit({ k: 'hit', target: 'monster', id: best.id, x: best.x, y: best.y, z: best.radius * 2 + 10, amount: n, crit: false, element: 'neutre', sort: 'renvoi' });
    if (best.hp <= 0) this.killMonster(best);
  }
  /** Augmente les dommages subis par les monstres dans ce cercle, sans les frapper (Bond). */
  markVuln(x: number, y: number, r: number, n: number, t: number): number {
    let k = 0;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || Math.hypot(m.x - x, m.y - y) > r + m.radius) continue;
      m.vuln = Math.max(m.vuln, n); m.vulnT = Math.max(m.vulnT, t); k++;
      this.emit({ k: 'status', x: m.x, y: m.y - 20, text: `Dommages subis +${n} %`, color: '#e07cf0' });
    }
    return k;
  }
  /** Dommages de poussée de Dofus : (niveau / 2 + Dommages Poussée + 32) × cases de poussée restantes / 4,
   *  quand la cible heurte un obstacle ou un autre monstre avant la fin de son recul. */
  private intouchableT = -9;
  private pushDamage(m: Monster, a: number, dist: number, bonus = 0, enclume?: { x: number; y: number; k: number }): boolean {
    if (m.intouchable) return false;
    const c = Math.cos(a), s = Math.sin(a), step = 8;
    let t = 0, lance = false;
    for (; t < dist; t += step) {
      const x = m.x + c * (t + m.radius), y = m.y + s * (t + m.radius);
      if (enclume && Math.hypot(enclume.x - x, enclume.y - y) < 18) { lance = true; break; }   // Enclume : la Lance plantée arrête le monstre
      if (!this.walkable(x, y) || this.monsters.some(o => o !== m && !o.dead && Math.hypot(o.x - x, o.y - y) < o.radius)) break;
    }
    if (lance) { m.kx = m.ky = 0; }
    const left = (dist - t) / CASE;
    if (left <= 0.25) return false;
    const p = this.player, dmg = Math.max(1, Math.round((p.level / 2 + p.stat('dommagesPoussee') + 32) * left / 4 * (1 + bonus / 100) * (lance ? enclume!.k : 1)));
    m.hp -= dmg; m.flash = 0.09; m.calmeT = 0;
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 30, amount: dmg, crit: false, sort: 'poussee' });
    this.emit({ k: 'status', x: m.x, y: m.y - 20, text: 'Choc !', color: '#f2d36b' });
    return true;
  }
  /** Points de PA / PM réellement retirés : chacun passe selon Retrait contre Esquive. */
  private removed(n: number, retrait: number, esquive: number): number {
    let k = 0;
    for (let i = 0; i < n; i++) if (this.rng.next() < removalChance(retrait, esquive)) k++;
    return k;
  }
  /** Coups qui saignent : le saignement ronge le monstre en continu, affiché par paquets d'au moins 1. */
  private saigner(m: Monster, dt: number) {
    const t = Math.min(dt, m.saigneT); m.saigneT -= dt; m.saigneAcc += m.saigne * t;
    if (m.saigneAcc < 1 && m.saigneT > 0) return;
    const n = Math.max(1, Math.round(m.saigneAcc)); m.saigneAcc = 0;
    if (m.saigneT <= 0) m.saigne = 0;
    m.hp -= n;
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: n, crit: false, element: 'feu', sort: 'saignement' });
    if (m.hp <= 0) this.killMonster(m);
  }
  killMonster(m: Monster) {
    if (m.mannequin) { m.hp = m.maxHp; return; }   // partie de test (7D) : le mannequin ne meurt pas
    m.dead = true; m.t = 0.6; this.kills++;
    piecesMonstre(this, m);   // Enutrof (1A 1B) : le coffre au trésor des Enutrofs proches se remplit
    const tq = this.player.dead ? 0 : this.player.pcv('pc-cra-O');
    if (tq) for (const md of this.player.mods) if (md.src === 'tirs_eloignes') {   // Traque sans fin : prolongé, jusqu'à doubler sa durée
      const pl = md.plus ?? 0, base = (md.t0 ?? md.t) - pl, g = Math.min(tq, base - pl);
      if (g > 0) { md.t += g; md.t0 = (md.t0 ?? md.t) + g; md.plus = pl + g; }
    }
    const pj = this.player, sv = pj.dead ? 0 : pj.pcv('pc-sacrieur-A');
    if (sv) {   // Soif de sang : un monstre tué rend des PV, sans faire redescendre sous Souffrance 6
      let h = pj.hp + pj.maxHp * sv / 100;
      if (pj.souffrance >= 6) h = Math.min(h, Math.max(pj.hp, Math.floor(pj.maxHp * 0.45)));
      pj.hp = Math.min(pj.maxHp, Math.round(h));
    }
    for (const p of this.players) p.quetes?.eliteVaincu(m.id);
    for (const s of this.monsters) if (s.summoner === m && !s.dead) this.killMonster(s);   // ses invocations disparaissent avec lui
    if (m.summoner) { this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type }); return; }
    this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type });
    const p = this.player;
    p.soigner(p.cls.healOnKill + p.legendary('vampire'));
    if (!this.vivant?.monstreVaincu(m)) this.dropLoot(m);   // boss du monde : son coffre est donné par le monde vivant (4A)
    if ((m.def.archiDe || (m.def.boss && m.def.ame)) && !m.relache) this.capturer(m);
    const alm = (this.almanax?.effet === 'xp' ? 1 + ALMANAX.xp : 1) * (1 + p.beni('xp')) * (1 + this.bonusDuWeekEnd('xp'));   // 15C, Magasin 6D, 9B (week-end)
    // Multi (maquette « Multi : » 7A) : chaque joueur proche gagne l'XP comme en solo, +10 % par allié proche
    const proches = this.players.filter(q => q !== p && !q.dead && Math.abs(q.x - m.x) + Math.abs(q.y - m.y) <= World.SOMMEIL);
    const base = (m.def.xp ?? Math.round(m.def.hp / 5)) * this.bonusMassacre() * alm * (1 + World.XP_PAR_ALLIE * proches.length) * (1 + this.bonusIdoles);   // 0.6 (17) : idoles
    const nm = m.def.level ?? this.monsterLevel(m);
    const carte = this.groups[m.group]?.map, fini = !!carte && !this.groups[m.group].members.some(o => !o.dead);
    const xp = p.gainXp(Math.round(base * World.ecartXp(p.level, nm) * (1 + avantage(p.abo, 'xp')) * this.decouverte(p, carte, fini)), this);   // « Apparats : » 17E ; 0.6 6D
    if (xp > 0) this.emit({ k: 'xp', x: m.x, y: m.y, z: m.radius * 2 + 30, n: xp });
    for (const q of proches) { const a = this.acteur; this.acteur = q; try { q.gainXp(Math.round(base * World.ecartXp(q.level, nm) * (1 + avantage(q.abo, 'xp')) * this.decouverte(q, carte, fini)), this); } finally { this.acteur = a; } }
    this.xpFamilier(FAMILIER_XP.chasse(this.monsterLevel(m), !!m.def.elite, !!m.def.boss));
    if (m.def.boss) { this.emit({ k: 'impact', hitstop: 0.15, shake: 0.02, big: true }); this.emit({ k: 'bossDown', monster: m.type }); }
  }
  // --- Idoles (0.6, questions 17-18) : src/sim/idoles.ts ------------------------------------------------
  /** Idoles qui comptent dans ce monde : celles du joueur de cet écran (en coop, celles de l'hôte valent pour tout le groupe). */
  get idolesActives(): string[] { const h = this.players[0]; return h?.v06 ? h.idoles.actives : []; }
  private _fxIdoles: { cle: string; fx: FxIdole | null } = { cle: '', fx: null };
  get fxIdoles(): FxIdole | null {
    const ids = this.idolesActives, cle = ids.join(',');
    if (cle !== this._fxIdoles.cle) this._fxIdoles = { cle, fx: fxIdoles(ids) };
    return this._fxIdoles.fx;
  }
  /** Bonus d'XP et de butin des idoles (part de 1), plafonné en donjon. */
  get bonusIdoles(): number { return bonusIdoles(this.idolesActives, !!this.arene); }
  /** Recette de l'idole chez le Bricoleur. */
  recetteIdole(id: string): [string, number][] { return this.opts.recoltes ? recetteIdole(id, this.opts.recoltes) : []; }
  /** Fabrique une idole à l'atelier du Bricoleur : niveau de Bricoleur, ingrédients ; une seule fois, elle reste au perso. */
  fabriquerIdole(id: string): string | null {
    const I = IDOLES_DEFS[id], p = this.player;
    if (!I || !p.v06) return 'Idole inconnue.';
    if (p.idoles.possedees.includes(id)) return 'Déjà fabriquée.';
    if (this.atelierIci('bricoleur') === null) return 'Il faut être à un atelier de Bricoleur.';
    if (p.metierLevel('bricoleur') < I.niveau) return `Bricoleur niveau ${I.niveau} requis.`;
    const r = this.recetteIdole(id);
    if (!r.length || r.some(([x, q]) => (p.resources[x] ?? 0) < q)) return 'Ingrédients manquants.';
    for (const [x, q] of r) { p.resources[x] -= q; if (p.resources[x] <= 0) delete p.resources[x]; }
    p.idoles.possedees.push(id);
    p.gainMetierXp('bricoleur', METIER_XP.parIngredient * r.reduce((s, [, q]) => s + q, 0), this);
    this.emit({ k: 'idole', id, quoi: 'fabriquee' });
    return null;
  }
  /** Active ou retire une idole (une par famille, 6 au plus). */
  basculerIdole(id: string): string | null {
    const e = basculerIdole(this.player.idoles, id);
    if (!e) this.emit({ k: 'idole', id, quoi: 'active' });
    return e;
  }
  enregistrerJeuIdoles(i: number, nom?: string) { enregistrerJeu(this.player.idoles, i, nom); }
  chargerJeuIdoles(i: number): string | null { const e = chargerJeu(this.player.idoles, i); if (!e) this.emit({ k: 'idole', id: '', quoi: 'active' }); return e; }
  /** 0.6 (6D) : bonus de découverte. Tant que ce perso n'a vaincu aucun groupe sur cette carte du dehors, ses monstres rapportent +50 % d'XP ;
   *  le groupe fini (fini), la carte est notée comme chassée. */
  private decouverte(q: Player, carte: string | undefined, fini: boolean): number {
    if (!q.v06 || !carte || !/^-?\d+_-?\d+$/.test(carte)) return 1;
    const z = this.opts.zone ?? '', l = (q.chasse[z] ??= []);
    if (l.includes(carte)) return 1;
    if (fini) { l.push(carte); this.emit({ k: 'decouverte', carte }); }
    return 1 + V06.decouverte.xp;
  }
  /** 6A : chaque monstre tué moins de 3 s après le précédent allonge la série ; dès 5, +2 % d'XP par monstre (plafond +40 %). */
  private bonusMassacre(): number {
    const M = AGGRO.massacre, S = this.massacre;
    if (this.time - S.t > M.fenetre) { if (S.n >= M.min) this.emit({ k: 'massacreFin', n: S.n }); S.n = 0; }
    S.n++; S.t = this.time;
    if (S.n < M.min) return 1;
    const bonus = Math.min(M.plafond, M.xpParMonstre * S.n);
    this.emit({ k: 'massacre', n: S.n, bonus: Math.round(bonus * 100) });
    return 1 + bonus;
  }
  // --- Butin (choix 24) ----------------------------------------------------
  /** Niveau d'un monstre : celui de la sous-zone où il vit. */
  monsterLevel(m: Monster): number { return this.niveauEn(m.homeX, m.homeY); }
  /** Niveau de la sous-zone à cet endroit (celui de la zone hors du monde ouvert). */
  niveauEn(x: number, y: number): number {
    const wg = this.worldGrid, open = this.zone.open;
    const sub = wg && open ? open.subareas[String(wg.mapAt(x, y)?.sub)] : undefined;
    return sub?.level ?? this.zone.level;
  }
  /** Coffre au trésor de l'Enutrof (src/sim/enutrof.ts) : n tirages du butin d'un monstre de ce rang (équipement de la zone et kamas,
   *  sans butin officiel), avec la Prospection de q ; epique : un objet Épique ou mieux en plus (palier Trésor). Rien n'est posé. */
  tirerCoffre(q: Player, rang: Rang, n: number, niveau: number, epique = false): Butin {
    const out: Butin = { ressources: [], objets: [], kamas: 0 }, I = this.opts.items;
    if (!I) return out;
    this.commeJoueur(q, () => {
      const ctx = this.contexteButin(CLE_COFFRE, rang, niveau);
      for (let k = 0; k < n; k++) { const b = tirerButin(this.rng, ctx, () => this.nextId++); out.ressources.push(...b.ressources); out.objets.push(...b.objets); out.kamas += b.kamas; }
      if (epique) {
        const pool = poolNiveau(ctx);
        if (pool.length) { const id = this.rng.pick(pool).id; out.objets.push(rollItem(id, I.equipment[id], this.rng.next() < 0.1 ? 'legendaire' : 'epique', this.rng, this.nextId++, ctx.pouvoirs)); }
      }
    });
    return out;
  }
  /** Tire et pose tout de suite un butin de coffre pour q, réservé à `pour` (5A : la part d'un allié). */
  butinCoffre(q: Player, rang: Rang, n: number, niveau: number, x: number, y: number, pour?: number, epique = false) {
    const b = this.tirerCoffre(q, rang, n, niveau, epique);
    this.commeJoueur(q, () => this.poserButin(b, x, y, pour));
  }
  /** 7D : un morceau du coffre ouvert jaillit (le joueur qui agit est l'Enutrof). */
  ejecterCoffre(b: Butin, x: number, y: number) { this.poserButin(b, x, y, this.players.length > 1 ? this.player.id : undefined); }
  /** 15C : l'Enutrof donne un objet Rare ou Épique de son sac à son coffre, contre des pièces. Jamais un objet sous cadenas. */
  donnerAuCoffre(uid: number): boolean {
    const p = this.player, i = p.bag.findIndex(b => b.uid === uid), it = i >= 0 ? p.bag[i] : null;
    const n = it && !it.cadenas ? piecesObjet(p, it.rarity) : 0, S = p.cls.coffre ? seuilsCoffre(p.cls.coffre) : [];
    if (!it || !n || p.coffrePieces >= S[S.length - 1]) return false;   // coffre plein : l'objet reste dans le sac
    p.bag.splice(i, 1); this.collectionner(it.id); this.enregistrerCodex(it);
    ajouterPieces(p, n, this, p.x, p.y, `${this.opts.items?.equipment[it.id]?.name ?? 'Objet'} donné`);
    return true;
  }
  /** Interface du coffre 4C : donne d'un coup tous les Rares et Épiques sans cadenas du sac. Renvoie le nombre d'objets donnés. */
  donnerToutAuCoffre(): number {
    const p = this.player;
    let k = 0;
    for (const it of p.bag.filter(o => !o.cadenas && piecesObjet(p, o.rarity) > 0)) if (this.donnerAuCoffre(it.uid)) k++;
    return k;
  }
  private panoBoss(type: string) {
    let l = this.panosBoss.get(type);
    if (!l) {
      const max = niveauObjetsMax(this.player.v03, this.player.v04);
      this.panosBoss.set(type, l = this.opts.items ? panoDuBoss(this.opts.items, type).filter(e => e.level <= max) : []);
    }
    return l;
  }
  /** Ce que le calcul du butin doit savoir (src/sim/butin.ts) : sert au jeu, au Bestiaire et au simulateur de l'outil de test. */
  contexteButin(type: string, rang: Rang, niveau: number): CtxButin {
    const p = this.player;
    return { type, rang, niveau, prospection: p.prospection + (this.almanax?.effet === 'butin' ? ALMANAX.butin : 0) + p.beni('butin') * REGLAGES_BUTIN.prospection.chances + this.bonusDuWeekEnd('butin') + this.prospectionInvasion + avantage(p.abo, 'prospection') + this.bonusIdoles * REGLAGES_BUTIN.prospection.chances, legendaire: avantage(p.abo, 'legendaire') * (rang === 'boss' && p.v06 ? coefChanceQuiMonte(p.bossSansLeg[type] ?? 0) : 1), items: this.opts.items!, familiers: (this.familiersDe[type] ?? []).filter(id => !this.aLeFamilier(p, id)), pool: this.equipByLevel, poolSecours: this.equipSecours,
      panoBoss: rang === 'boss' ? this.panoBoss(type) : undefined,
      metierNiveau: j => p.metierLevel(j), armeChasse: !!p.huntingWeapon, pouvoirs: rang === 'boss' ? { ...p.ctxPouvoirs, boss: type } : p.ctxPouvoirs };
  }
  /** Un monstre vaincu lâche son butin officiel (ressources, parfois un équipement) et, plus rarement, un équipement
   *  de son niveau pris parmi les objets officiels des monstres de la zone. Élites et boss lâchent plus et mieux. Calcul : src/sim/butin.ts. */
  private dropLoot(m: Monster) {
    this.prospectionInvasion = m.envahi ? VIVANT.invasion.prospection : 0;   // 0.5 (5B) : butin meilleur pendant une invasion
    try { this.dropLootDe(m); } finally { this.prospectionInvasion = 0; }
  }
  /** Prospection en plus du butin en cours de tirage (envahisseur). */
  private prospectionInvasion = 0;
  private dropLootDe(m: Monster) {
    // « Archis : » 7B : l'archimonstre relâché dans l'arène lâche le butin d'un boss ; son niveau est le sien (l'arène est au Bastion)
    const rang = m.relache && m.def.archiDe ? 'boss' : rangDe(m.def), niv = m.relache ? m.def.level ?? this.monsterLevel(m) : this.monsterLevel(m);
    if (this.players.length < 2) { this.lacherButin(m.type, rang, niv, m.x, m.y); return; }
    // Multi (« Multi : » 7C) : chaque joueur proche a son propre tirage, que lui seul voit et ramasse
    for (const q of this.joueursProches(m.x, m.y)) this.commeJoueur(q, () => this.lacherButin(m.type, rang, niv, m.x, m.y, 0, q.id));
  }
  /** 0.5 (4A, 7B, 8A-8B) : n tirages de butin d'un monstre de ce rang (type vide : équipement de la zone et kamas) pour q, posés en (x, y)
   *  et réservés à q en multi ; garanti : un objet de cette rareté au moins (Légendaire avec la chance donnée). */
  butinMonstre(q: Player, type: string, rang: Rang, niveau: number, x: number, y: number, n: number, garanti?: { rarete: Rarity; legendaire: number }) {
    const I = this.opts.items;
    if (!I) return;
    this.commeJoueur(q, () => {
      const pour = this.players.length > 1 ? q.id : undefined, cle = type || CLE_COFFRE;
      for (let k = 0; k < n; k++) this.lacherButin(cle, rang, niveau, x, y, 0, pour);
      if (!garanti) return;
      const pool = poolNiveau(this.contexteButin(cle, rang, niveau));
      if (!pool.length) return;
      const id = this.rng.pick(pool).id, r: Rarity = this.rng.next() < garanti.legendaire ? 'legendaire' : garanti.rarete;
      this.poserButin({ ressources: [], objets: [rollItem(id, I.equipment[id], r, this.rng, this.nextId++, this.contexteButin(cle, rang, niveau).pouvoirs)], kamas: 0 }, x, y, pour);
    });
  }
  /** 9B : valeur du bonus officiel du week-end s'il est de cette sorte (0 sinon). */
  bonusDuWeekEnd(cle: BonusWeekEnd['cle']): number { const b = this.weekEnd; return b?.cle === cle ? b.n : 0; }
  /** 9B : bonus officiel du week-end en cours (heure de Paris), ou null. */
  get weekEnd(): BonusWeekEnd | null { const h = this.opts.horloge; return h ? bonusWeekEnd(h()) : null; }
  /** 5B : une invasion commence. Les groupes au calme de la sous-zone repartent (ils reviennent envahis, plus gros). */
  relancerSousZone(sub: number) {
    const wg = this.worldGrid;
    if (!wg) return;
    let retires = false;
    for (const g of this.groups) {
      if (g.retire || g.fixe || g.dort || g.cleared || wg.mapByTag(g.map)?.sub !== sub) continue;
      if (g.members.some(m => !m.dead && m.state !== 'idle')) continue;
      const c = g.members.find(m => !m.dead) ?? g;
      g.x = c.x; g.y = c.y; g.dort = true; retires = true;
      for (const m of g.members) m.group = -2;
      g.members = [];
    }
    if (retires) this.monsters = this.monsters.filter(m => m.group > -2);
  }
  /** Identifiant neuf (entités et événements du monde vivant). */
  nextIdPublic(): number { return this.nextId++; }
  /** 8A : habitants officiels qui peuvent appeler à l'aide (planches des passants du Bastion, src/data/passants.json). */
  habitantsEvenement(): { id: string; nom: string }[] { return (PASSANTS as { habitants: { id: string; nom: string }[] }).habitants; }
  /** Joueurs qui ont part à ce qui se passe en (x, y) : à moins de SOMMEIL (morts compris : ils se relèvent). */
  joueursProches(x: number, y: number): Player[] { return this.players.filter(q => Math.abs(q.x - x) + Math.abs(q.y - y) <= World.SOMMEIL); }
  private lacherButin(type: string, rang: Rang, niveau: number, mx: number, my: number, kamas = 0, pour?: number) {
    if (!this.opts.items) return;
    const ctx = this.contexteButin(type, rang, niveau), b = tirerButin(this.rng, ctx, () => this.nextId++);
    b.kamas += kamas;
    // « Archis : » 4B : un archimonstre lâche toujours au moins un objet Rare ; 5B : les élites, parfois une Petite pierre d'âme
    if (this.opts.data.monsters[type]?.archiDe && !b.objets.some(o => RARITIES.indexOf(o.rarity) >= RARITIES.indexOf('rare'))) {
      const pool = poolNiveau(ctx);
      if (pool.length) { const id = this.rng.pick(pool).id; b.objets.push(rollItem(id, this.opts.items.equipment[id], 'rare', this.rng, this.nextId++, ctx.pouvoirs)); }
    }
    if (rang === 'elite' && this.player.v03 && this.opts.items.resources[ARCHI.pierre] && this.rng.next() < ARCHI.pierreElite) b.ressources.push({ id: ARCHI.pierre });
    // trophées (0.4 suite 3A) : chaque boss de la 0.4 en a deux, rares, une fois chacun
    if (rang === 'boss' && this.player.v04) for (const id of tropheesDuBoss(type))
      if (!this.player.trophees.includes(id) && this.rng.next() < REGLAGES_BUTIN.trophee && this.player.gagnerTrophee(id)) this.emit({ k: 'dofusGagne', id });
    if (rang === 'boss') this.noterBossLeg(type, b, true);
    this.butinForge(b, rang, niveau);
    // « Apparats : » 1B (boss, 1 sur 75) et 1D (fêtes) : jamais un apparat déjà possédé (2A)
    const ap = tirerApparat(type, rang, this.opts.aujourdhui ?? '', this.player.apparats, this.rng);
    if (ap) (b.apparats ??= []).push(ap);
    this.poserButin(b, mx, my, pour);
  }
  /** Forgemagie v2 : les boss lâchent les runes maison (5B), élites et boss un Orbe régénérant du niveau du monstre (7A). */
  private butinForge(b: Butin, rang: Rang, niveau: number) {
    const R = this.opts.items?.resources;
    if (!R || (rang !== 'boss' && rang !== 'elite')) return;
    if (rang === 'boss') for (const id of ['990001', '990002']) if (R[id] && this.rng.next() < REGLES_V2.maison.boss) b.ressources.push({ id });
    if (this.rng.next() < (rang === 'boss' ? REGLES_V2.orbes.boss : REGLES_V2.orbes.elite)) {
      const orbe = Object.entries(R).filter(([, r]) => r.orbe && !/\(lié\)/.test(r.name)).sort((x, y) => x[1].orbe! - y[1].orbe!).find(([, r]) => r.orbe! >= niveau)?.[0];
      if (orbe) b.ressources.push({ id: orbe });
    }
  }
  /** Butin tiré : ressources dans le sac du joueur qui agit, objets et kamas au sol autour de (mx, my). */
  private poserButin(b: Butin, mx: number, my: number, pour?: number) {
    const m = { x: mx, y: my }, p = this.player;
    for (const r of b.ressources) {   // ressource : directement dans le sac ; une viande fait monter le Chasseur (choix 6A)
      if (r.job) p.gainMetierXp(r.job, METIER_XP.viande, this);
      const q = r.job && this.almanax?.effet === 'gibier' ? ALMANAX.gibier : 1;   // 15C : jour du gibier
      p.resources[r.id] = (p.resources[r.id] ?? 0) + q;
      this.emit({ k: 'lootResource', id: r.id, n: q });
    }
    const out: Omit<Drop, 'x' | 'y' | 't' | 'uid'>[] = b.objets.map(item => ({ item }));
    for (const apparat of b.apparats ?? []) out.push({ apparat });
    if (b.kamas) out.push({ kamas: b.kamas });
    out.forEach((o, i) => {
      const a = (i / Math.max(1, out.length)) * Math.PI * 2 + this.rng.range(0, 1), r = out.length > 1 ? 34 : 0;
      let x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r;
      if (!this.walkable(x, y)) { x = m.x; y = m.y; }
      this.drops.push({ ...o, uid: this.nextId++, x, y, t: 0, ...(pour != null ? { pour } : {}) });
      if (o.item) this.emit({ k: 'itemDrop', x, y, rarity: o.item.rarity });
      else if (o.apparat) this.emit({ k: 'itemDrop', x, y, rarity: rareteApparat(o.apparat) });
    });
  }
  /** Rareté minimale affichée et ramassable selon le filtre du joueur (0 Commun, 1 Rare, 2 Épique). */
  shown(d: Drop): boolean { return (d.pour == null || d.pour === this.player.id) && (!d.item || d.item.xpF != null || RARITIES.indexOf(d.item.rarity) >= this.player.lootFilter); }
  /** Aspiré quand on passe près (kamas et Communs) ou ramassé d'un clic (le reste). */
  static magnetic(d: Drop): boolean { return !d.apparat && (!d.item || d.item.rarity === 'commun'); }
  private updateDrops(dt: number) {
    const f = this.updateFamilier(dt);
    for (const d of this.drops) d.t += dt;
    // chaque joueur ramasse ce qui est à lui (le familier n'aide que le joueur de l'écran)
    for (const q of this.players) this.commeJoueur(q, () => this.ramasser(dt, q === this.players[0] ? f : null));
    // ramassé, ou oublié au sol depuis 3 minutes
    this.drops = this.drops.filter(d => d.t >= 0 && d.t < 180);
  }
  private ramasser(dt: number, f: FamilierEtat | null) {
    const p = this.player, cof = p.cls.coffre && !p.dead ? this.betes.find(b => b.owner === p && b.base === CLE_COFFRE && !b.dead) : undefined;
    const aimant = cof ? { x: cof.x, y: cof.y, r: p.cls.coffre!.aimant } : null;
    for (const d of this.drops) {
      if (p.dead || d.t < 0.5 || !this.shown(d)) continue;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (d.familier) { if (f) f.cible = null; }   // rapporté par le familier
      else if (!d.item && !d.apparat && aimant && Math.hypot(d.x - aimant.x, d.y - aimant.y) <= aimant.r && Math.hypot(d.x - aimant.x, d.y - aimant.y) < dist) {
        // Enutrof (interface du coffre 7B) : le coffre ramasse les kamas au sol autour de lui
        const dc = Math.hypot(d.x - aimant.x, d.y - aimant.y);
        if (dc > 26) { const s = Math.min(dc, 520 * dt); d.x += (aimant.x - d.x) / dc * s; d.y += (aimant.y - d.y) / dc * s; continue; }
      } else if (World.magnetic(d)) {
        if (dist > 130) continue;
        if (dist > 26) { const s = Math.min(dist, 520 * dt); d.x += (p.x - d.x) / dist * s; d.y += (p.y - d.y) / dist * s; continue; }
      } else if (p.pickupId !== d.uid || dist > 44) continue;
      if (d.apparat) {
        if (p.pickupId === d.uid) p.pickupId = null;
        this.ajouterApparat(d.apparat);
      } else if (d.item) {
        if (p.pickupId === d.uid) p.pickupId = null;
        const def = this.opts.items?.equipment[d.item.id];
        // Magasin 10D : cadenas posé tout seul sur les objets de panoplie et les Légendaires (ou mieux)
        if (def && (def.set != null || RARITIES.indexOf(d.item.rarity) >= RARITIES.indexOf('legendaire'))) d.item.cadenas = true;
        // Magasin 10A + 10C : défait dès le ramassage jusqu'à la rareté choisie, sauf s'il vaut mieux que l'objet porté
        if (p.autoDefaire && def && !def.familier && !d.item.cadenas && RARITIES.indexOf(d.item.rarity) <= RARITIES.indexOf(p.autoDefaire) && !this.meilleurQuePorte(d.item)) {
          const tout: Record<string, number> = {};
          this.finDefaire(1, tout, this.defaireUn(d.item, def, tout), d.item.id);
          d.t = -1; continue;
        }
        if (p.bag.length >= p.tailleSac) { if (!d.warned) this.emit({ k: 'bagFull' }); d.warned = true; d.familier = false; continue; }   // sac plein : l'objet reste au sol
        p.bag.push(d.item);
        this.emit({ k: 'loot', item: d.item });
        if (def?.familier) this.noterFamilier(d.item);
        this.ouvrirCodex(d.item);
      } else if (d.kamas) {
        const n = Math.round(d.kamas * (1 + avantage(p.abo, 'kamas')));   // 17G
        p.kamas += n;
        this.emit({ k: 'lootKamas', n });
      }
      d.t = -1;
    }
    if (p.pickupId != null && !this.drops.some(d => d.uid === p.pickupId && d.t >= 0)) p.pickupId = null;
  }
  // --- Familier (maquette Familiers) -------------------------------------------------------------------------------
  /** Rayon autour du perso où le familier va chercher le butin (4A). */
  static readonly FAMILIER_RAYON = 260;
  /** Le familier suit le perso (un peu derrière) ou court vers le butin le plus proche, qu'il rapporte en le touchant. */
  private updateFamilier(dt: number): FamilierEtat | null {
    const p = this.player;
    if (!p.equipment.familier) { this.familier = null; return null; }
    const f = this.familier ??= { x: p.x - 30, y: p.y + 10, vx: 0, vy: 0, cible: null };
    if (Math.hypot(f.x - p.x, f.y - p.y) > 600) { f.x = p.x - 30; f.y = p.y + 10; f.cible = null; }   // porte, Zaap, Rappel : il arrive avec toi
    let cible = f.cible != null ? this.drops.find(d => d.uid === f.cible && d.t >= 0.5) : undefined;
    if (!cible && !p.dead) {
      let best = World.FAMILIER_RAYON * avantage(p.abo, 'familierRayon');   // 17H
      for (const d of this.drops) {
        if (d.t < 0.5 || d.familier || !this.shown(d) || (d.item && p.bag.length >= p.tailleSac)) continue;
        const r = Math.hypot(d.x - p.x, d.y - p.y);
        if (r < best) { best = r; cible = d; }
      }
    }
    f.cible = cible?.uid ?? null;
    // maquette Osamodas 15F : le familier de l'Osamodas entre dans la meute et mord (le butin passe avant)
    const proie = !cible && !p.dead && p.cls.rage.mode === 'eveil' ? this.proieFamilier(f) : null;
    f.proie = proie?.id ?? null; f.mordT = Math.max(0, (f.mordT ?? 0) - dt);
    if (proie && Math.hypot(proie.x - f.x, proie.y - f.y) < proie.radius + 26 && f.mordT <= 0) { this.morsure(proie); f.mordT = World.MORSURE.cadence; }
    const tx = cible ? cible.x : proie ? proie.x : p.x - 34, ty = cible ? cible.y : proie ? proie.y : p.y + 12, dx = tx - f.x, dy = ty - f.y;
    const r = Math.hypot(dx, dy) - (proie ? proie.radius + 16 : 0);
    const v = cible ? 420 : proie ? 360 : r > 60 ? p.speed * 1.15 : r > 20 ? p.speed * 0.8 : 0;
    const s = Math.max(0, Math.min(r, v * dt)), n = Math.hypot(dx, dy) || 1;
    f.vx = r > 1 && s > 0 ? dx / n * s / dt : 0; f.vy = r > 1 && s > 0 ? dy / n * s / dt : 0;
    if (r > 1) { f.x += dx / n * s; f.y += dy / n * s; }
    if (cible && Math.hypot(cible.x - f.x, cible.y - f.y) < 22) {   // il ramasse : comme si le perso passait dessus
      cible.x = f.x; cible.y = f.y; cible.familier = true;
    }
    return f;
  }
  /** 15F : morsure du familier de l'Osamodas (inventé) : petit jet, cadence en secondes, portée autour du perso. */
  static readonly MORSURE = { jet: 6, cadence: 1.4, portee: 4 * CASE };
  /** Monstre que le familier mord : la cible de la meute, sinon le plus proche qui se bat, près de l'Osamodas. */
  private proieFamilier(f: FamilierEtat): Monster | null {
    const p = this.player, R = World.MORSURE.portee, ok = (m: Monster) => !m.dead && !m.intouchable && m.state !== 'idle' && m.state !== 'return' && Math.hypot(m.x - p.x, m.y - p.y) <= R;
    const c = this.monsters.find(m => m.id === (f.proie ?? this.cibleMeute));
    if (c && ok(c)) return c;
    let best: Monster | null = null, bd = Infinity;
    for (const m of this.monsters) if (ok(m)) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  /** Élément de la morsure : celui du plus gros bonus élémentaire du familier (Force = Terre, Intelligence = Feu, Chance = Eau, Agilité = Air). */
  private elementFamilier(): Element {
    const st = this.player.equipment.familier?.stats ?? {}, E: [keyof typeof st, Element][] = [['force', 'terre'], ['intelligence', 'feu'], ['chance', 'eau'], ['agilite', 'air']];
    let best: Element = 'neutre', v = 0;
    for (const [k, e] of E) if ((st[k] ?? 0) > v) { v = st[k] ?? 0; best = e; }
    return best;
  }
  private morsure(m: Monster) {
    const p = this.player, el = this.elementFamilier(), res = Math.min(50, m.def.res?.[el] ?? 0);
    const dmg = Math.max(1, Math.round(p.damage(World.MORSURE.jet, el) * this.rng.range(0.9, 1.1) * (1 - res / 100) * m.subis));
    m.hp -= dmg; m.flash = 0.09; m.calmeT = 0; m.struck = true;
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit: false, element: el, sort: 'familier' });
    if (m.hp <= 0) this.killMonster(m);
  }
  /** XP pour le familier porté (2C) ; ses bonus suivent son niveau. */
  xpFamilier(n: number) {
    const p = this.player, it = p.equipment.familier, def = it && this.opts.items?.equipment[it.id]?.familier;
    if (!it || !def || n <= 0 || (it.niv ?? 1) >= FAMILIER_MAX) return;
    it.xpF = (it.xpF ?? 0) + Math.round(n * avantage(p.abo, 'familierXp'));   // 17H
    const avant = it.niv ?? 1, niv = familierNiveau(it.xpF, this.opts.familierXp ?? []);
    if (niv === avant) return;
    it.niv = niv; it.stats = familierStats(def, niv); p.recompute();
    this.noterFamilier(it);
    this.emit({ k: 'familierNiveau', nom: def.nom, niveau: niv });
  }
  /** Nourrir le familier porté (2C) avec un objet du sac (sauf cadenas) ou une ressource (une unité, ou toute la pile). */
  nourrirFamilier(quoi: { uid: number } | { res: string; tout?: boolean }): boolean {
    const p = this.player, it = p.equipment.familier, I = this.opts.items;
    if (!it || !I || (it.niv ?? 1) >= FAMILIER_MAX) return false;
    let xp = 0;
    if ('uid' in quoi) {
      const i = p.bag.findIndex(b => b.uid === quoi.uid), o = p.bag[i], d = o && I.equipment[o.id];
      if (!o || !d || o.cadenas) return false;
      p.bag.splice(i, 1); xp = FAMILIER_XP.objet(d.level, o.rarity);
      // « Familiers : » 5A : un double du même familier = gros repas (+10 niveaux)
      if (o.id === it.id) { const C = this.opts.familierXp ?? [], cible = Math.min(FAMILIER_MAX, (it.niv ?? 1) + FAMILIERS_SOURCES.repasDouble); xp = Math.max(0, (C[cible - 1] ?? 0) - (it.xpF ?? 0)); }
    } else {
      const r = I.resources[quoi.res], n = p.resources[quoi.res] ?? 0;
      if (!r || !n || r.pepite || r.monnaie || r.cle || r.ame) return false;
      const k = quoi.tout ? n : 1;
      p.resources[quoi.res] -= k; if (!p.resources[quoi.res]) delete p.resources[quoi.res];
      xp = FAMILIER_XP.ressource(r.level) * k;
    }
    this.emit({ k: 'familierRepas', xp });
    this.xpFamilier(xp);
    return true;
  }
  // --- Métiers de récolte (0.2b) ---------------------------------------------------------------------------------
  private buildRecoltes() {
    const R = this.opts.recoltes, wg = this.worldGrid, open = this.zone.open;
    const l = R && open && (R[open.world] as [string, number, string, number?, number?, number?, number?][] | undefined);
    if (!R || !wg || !l) return;
    for (const [tag, cell, item, gfx, dx, dy, miroir] of l) {
      if (!wg.mapByTag(tag) || !R.ressources[item]) continue;
      if (wg.mapByTag(tag)!.essai && !this.essaiOuvert) continue;   // 0.4 cachée : récoltes d'Amakna en partie de test
      const q = wg.cellToWorld(wg.cellOf(tag, cell));
      this.recoltes.push({ id: this.nextId++, tag, x: q.x, y: q.y, item, dore: this.rng.next() < RECOLTE.dore, repousse: 0,
        gfx, dessin: dx || dy ? { x: dx!, y: dy! } : undefined, miroir: miroir === 1 });
    }
  }
  /** Case libre la plus proche d'une ressource (les arbres et les minerais sont souvent sur une case bloquante). */
  approcheRecolte(id: number) {
    const r = this.recoltes.find(x => x.id === id);
    return r ? this.map.nearestFree(r.x, r.y) : null;
  }
  /** Les ressources récoltées repoussent (commun à tous). */
  private updateRepousse(dt: number) {
    for (const r of this.recoltes) if (r.repousse > 0 && (r.repousse -= dt) <= 0) {
      r.repousse = 0; r.dore = this.rng.next() < (this.eliteSur(r.tag) ? RECOLTE.doreElite : RECOLTE.dore);
    }
  }
  /** Récolte de world.player. */
  private updateRecoltes(dt: number) {
    const p = this.player, R = this.opts.recoltes;
    if (!R || p.dead) { this.versRecolte = null; this.enRecolte = null; return; }
    if (this.enRecolte) {
      const g = this.enRecolte, r = this.recoltes.find(x => x.id === g.id);
      if (!r || r.repousse > 0 || p.hp < g.hp) { this.enRecolte = null; this.emit({ k: 'recolteStop' }); return; }
      p.stopMove(); g.t += dt;
      // Maquette Armes 9A : le perso joue l'animation officielle du métier (faucher, couper, piocher, cueillir, pêcher)
      const geste = R.ressources[r.item]?.anim;
      if (geste) p.setAnim(`r_${geste}`, g.t / this.dureeRecolte());
      if (g.t < this.dureeRecolte()) return;
      this.enRecolte = null;
      const def = R.ressources[r.item], lv = Math.max(1, p.metierLevel(def.metier));
      const n = quantite(this.rng, lv, def.niveau, r.dore) + (def.metier && this.almanax?.effet === 'recolte' ? ALMANAX.recolte : 0);   // 15C
      p.resources[r.item] = (p.resources[r.item] ?? 0) + n;
      if (def.metier) p.gainMetierXp(def.metier, xpRecolte(def.niveau, r.dore), this);   // puits : sans métier, sans XP
      this.emit({ k: 'recolteFin', id: r.id, item: r.item, n, dore: r.dore });
      const rare = RARES_RECOLTE[r.item];   // « Métiers : » 5A : la variante rare d'une plante (Trèfle Agare…), pour les parchemins
      if (rare && this.rng.next() < (r.dore ? CONSO.rare.dore : CONSO.rare.chance)) {
        p.resources[rare] = (p.resources[rare] ?? 0) + 1;
        this.emit({ k: 'lootResource', id: rare, n: 1 });
      }
      r.repousse = RECOLTE.repousse; r.dore = false;
      return;
    }
    if (this.versRecolte == null) return;
    const r = this.recoltes.find(x => x.id === this.versRecolte);
    if (!r || r.repousse > 0) { this.versRecolte = null; return; }
    const def = R.ressources[r.item];
    // Les arbres, minerais et puits sont sur une case bloquante, parfois à 130-190 px de la case libre la plus proche : arrivé sur
    // cette case, on récolte quand même (avant, le perso s'y arrêtait sans rien faire).
    const arrive = this.approche && Math.hypot(this.approche.x - p.x, this.approche.y - p.y) < 24;
    if ((Math.hypot(r.x - p.x, r.y - p.y) > porteeRecolte(def) && !arrive) || p.state !== 'free') return;
    this.versRecolte = null;
    const lv = Math.max(1, p.metierLevel(def.metier));
    if (def.metier && lv < def.niveau) {
      p.stopMove();
      this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `${R.metiers[def.metier]?.nom ?? 'Métier'} niveau ${def.niveau} requis`, color: '#ff9a5a' });
      this.emit({ k: 'recolteNiveau', metier: def.metier, niveau: def.niveau });
      return;
    }
    p.stopMove();
    p.facing = Math.atan2(r.y - p.y, r.x - p.x);
    this.enRecolte = { id: r.id, t: 0, hp: p.hp };
    if (def.anim) p.setAnim(`r_${def.anim}`, 0);
    this.emit({ k: 'recolteDebut', id: r.id, duree: this.dureeRecolte() });
  }

  // --- Emp, le Méryde du Recyclage (maquette 0.2, 8A+8B+8C, 9A+9B) ---------------------------------------------
  /** Collection d'apparences (1C) : le premier exemplaire brisé ou recyclé d'une coiffe, cape ou bouclier débloque son apparence. */
  /** « Apparats : » : l'apparat rejoint la collection du joueur qui agit (une fois pour toutes : 2A). */
  ajouterApparat(id: string): boolean {
    const p = this.player;
    if (p.apparats.includes(id)) return false;
    p.apparats.push(id);
    this.emit({ k: 'apparence', id, rarete: rareteApparat(id) });
    return true;
  }
  // --- Boutique Ogrines et abonnements (« Apparats : » 9-17) -------------------------------------------------------
  /** Le compte de ce joueur a cet abonnement (ou aucun) : les styles offerts par un palier perdu sont retirés. */
  reglerAbo(p: Player, palier: Palier | null) {
    p.abo = palier;
    for (const sorte of ['aureoles', 'zaaps', 'ornements'] as SorteStyle[]) {
      const d = styleDef(sorte, p.style[sorte]);
      if (d?.abo && rangAbo(palier) < rangAbo(d.abo as Palier)) delete p.style[sorte];
    }
  }
  /** Achats Ogrines du compte (articles de boutique_ogrines.json, et apparats du mois), donnés au joueur de cet écran
   *  sans bruit : apparats dans sa collection, styles dans le coffre du compte. Rend le nombre de nouveautés. */
  recevoirAchats(articles: string[], apparats: string[] = []): number {
    const p = this.players[0], A = BOUTIQUE_OGRINES.articles, c = this.coffre;
    let n = 0;
    const ids = [...apparats, ...articles.flatMap(a => A[a]?.apparats ?? [])];
    for (const id of ids) if (!p.apparats.includes(id)) { p.apparats.push(id); n++; }
    for (const a of articles) { const s = A[a]?.style; if (s && !c.styles?.includes(s)) { (c.styles ??= []).push(s); n++; } }
    return n;
  }
  /** 17C + 17J : avantages déjà pris aujourd'hui (remis à zéro chaque jour). */
  aboDuJour() { const p = this.player, j = this.opts.aujourdhui ?? ''; if (p.aboJour.jour !== j) p.aboJour = { jour: j, beni: 0, cles: 0 }; return p.aboJour; }
  /** 17K : durée d'une récolte (plus courte avec l'abonnement). */
  dureeRecolte() { return RECOLTE.duree * avantage(this.player.abo, 'recolte'); }
  // --- Ménagerie (« Familiers : » 1B 4C 5C 5D 6A 7A) ---------------------------------------------------------------
  /** 5C : ce familier est déjà dans la Ménagerie de ce joueur (celle du compte pour le joueur de cet écran). */
  aLeFamilier(p: Player, id: string): boolean { return p.menagerie.includes(id) || (p === this.players[0] && this.coffre.familiers?.[id] != null); }
  /** Familiers de la Ménagerie du joueur qui agit (perso + compte). */
  menagerie(): string[] {
    const p = this.player;
    return [...new Set([...p.menagerie, ...(p === this.players[0] ? Object.keys(this.coffre.familiers ?? {}) : [])])];
  }
  /** Un familier entre dans la Ménagerie (6A), débloque son apparence (6B) et garde son plus haut niveau pour le compte (7A). */
  noterFamilier(it: Item) {
    const p = this.player, def = this.opts.items?.equipment[it.id]?.familier;
    if (!def) return;
    const nouveau = !this.aLeFamilier(p, it.id);
    if (!p.menagerie.includes(it.id)) p.menagerie.push(it.id);
    if (!p.apparats.includes(it.id)) p.apparats.push(it.id);
    if (p === this.players[0]) { const f = this.coffre.familiers ??= {}; f[it.id] = Math.max(f[it.id] ?? 1, it.niv ?? 1); }
    if (nouveau) this.emit({ k: 'menagerie', id: it.id, nom: def.nom, n: this.menagerie().length });
  }
  /** Le familier est-il sur ce perso (sac, équipement) ou dans le coffre du compte ? */
  private familierIci(id: string): boolean {
    const p = this.player;
    return p.bag.some(o => o.id === id) || p.equipment.familier?.id === id || (p === this.players[0] && this.coffre.onglets.some(l => l.some(o => o.id === id)));
  }
  /** 7A : un perso du compte sort de la Ménagerie un familier que le compte a déjà eu, à son plus haut niveau. */
  sortirDeLaMenagerie(id: string): boolean {
    const p = this.player, niv = p === this.players[0] ? this.coffre.familiers?.[id] : undefined, d = this.opts.items?.equipment[id];
    if (!niv || !d?.familier || this.familierIci(id) || p.bag.length >= p.tailleSac) return false;
    p.bag.push(this.familierAuNiveau(id, niv));
    this.emit({ k: 'loot', item: p.bag[p.bag.length - 1] });
    return true;
  }
  private familierAuNiveau(id: string, niv: number): Item {
    const d = this.opts.items!.equipment[id], it = rollItem(id, d, 'commun', this.rng, this.nextId++);
    if (niv > 1) { it.xpF = (this.opts.familierXp ?? [])[niv - 1] ?? 0; it.niv = niv; it.stats = familierStats(d.familier!, niv); }
    return it;
  }
  /** 1B + 4A : l'Animalerie du Marché vend les familiers domestiques en kamas, toujours (un double se donne ou se mange, 5A + 5D). */
  acheterFamilier(id: string): boolean {
    const p = this.player, prix = FAMILIERS_SOURCES.animalerie[id], d = this.opts.items?.equipment[id];
    if (prix == null || !d?.familier || p.kamas < prix || p.bag.length >= p.tailleSac) return false;
    p.kamas -= prix;
    const it = rollItem(id, d, 'commun', this.rng, this.nextId++);
    p.bag.push(it);
    this.emit({ k: 'achat', id, n: 1, prix, monnaie: 'kamas' });
    this.noterFamilier(it);
    return true;
  }
  /** 4C : au niveau 10, l'Animalerie offre un familier de départ au choix (une fois par perso). */
  familierDeDepartPossible(): boolean { const p = this.player; return !p.familierOffert && p.level >= FAMILIERS_SOURCES.depart.niveau; }
  prendreFamilierDeDepart(id: string): boolean {
    const p = this.player, d = this.opts.items?.equipment[id];
    if (!this.familierDeDepartPossible() || !FAMILIERS_SOURCES.depart.familiers.includes(id) || !d?.familier || p.bag.length >= p.tailleSac) return false;
    p.familierOffert = true;
    const it = rollItem(id, d, 'commun', this.rng, this.nextId++);
    p.bag.push(it);
    this.emit({ k: 'loot', item: it });
    this.noterFamilier(it);
    return true;
  }
  /** 5D : donner un familier du sac à un autre joueur de la partie (coop), proche de soi. */
  donnerFamilier(uid: number, joueur: number): boolean {
    const p = this.player, q = this.players.find(x => x.id === joueur), i = p.bag.findIndex(o => o.uid === uid), it = p.bag[i];
    if (!q || q === p || !it || it.cadenas || !this.opts.items?.equipment[it.id]?.familier || q.bag.length >= q.tailleSac || Math.hypot(q.x - p.x, q.y - p.y) > 600) return false;
    p.bag.splice(i, 1);
    this.commeJoueur(q, () => { q.bag.push(it); this.emit({ k: 'loot', item: it }); this.noterFamilier(it); });
    return true;
  }
  /** 1C : le coffre d'invasion peut contenir son familier (Écumouth), une chance sur N, s'il n'est pas déjà dans la Ménagerie. */
  familierInvasion(x: number, y: number) {
    const p = this.player, I = this.opts.items, l = FAMILIERS_SOURCES.invasion.filter(id => I?.equipment[id] && !this.aLeFamilier(p, id));
    if (!l.length || !I || this.rng.next() >= 1 / FAMILIERS_SOURCES.chances.invasion) return;
    const id = this.rng.pick(l);
    this.poserButin({ ressources: [], objets: [rollItem(id, I.equipment[id], 'commun', this.rng, this.nextId++)], kamas: 0 }, x, y, this.players.length > 1 ? p.id : undefined);
  }
  /** « Apparats : » 1E : un boss du monde ou une invasion (clé « monde » de apparats_sources.json : gelees_royales, maitre_vampire,
   *  invasion…) donne au joueur qui agit un de ses apparats qu'il n'a pas encore, avec une chance sur `sur` (1 = toujours). */
  gagnerApparat(evenement: string, sur = 1): string | null {
    const p = this.player, manque = apparatsDuMonde(evenement).filter(id => !p.apparats.includes(id));
    if (!manque.length || this.rng.next() >= 1 / Math.max(1, sur)) return null;
    const id = this.rng.pick(manque);
    return this.ajouterApparat(id) ? id : null;
  }
  private collectionner(id: string) {
    const p = this.player;
    if (!this.opts.apparats?.objets[id]?.collection || p.apparats.includes(id)) return;
    p.apparats.push(id);
    this.emit({ k: 'apparence', id });
  }
  // --- Codex des pouvoirs (version 0.3, src/sim/codex.ts) -----------------------------------------------
  /** 8C : le Codex s'ouvre à la fin de la quête « Le premier pouvoir », ou au premier Légendaire (ou Mythique) trouvé. Sans objet : la quête. */
  ouvrirCodex(it?: Item) {
    const p = this.player;
    if (!p.v03 || p.codexOuvert || (it && it.rarity !== 'legendaire' && it.rarity !== 'mythique')) return;
    p.codexOuvert = true;
    this.emit({ k: 'codexOuvert' });
  }
  /** 5A : briser un Légendaire ou un Mythique chez Malek garde ses pouvoirs (ceux de sa classe et les pouvoirs maison). */
  private enregistrerCodex(it: Item) {
    const p = this.player;
    if (!p.v03) return;
    this.ouvrirCodex(it);
    for (const l of [it.legendary, it.legendary2]) {
      if (!l || !nouveauPourCodex(p.codex, p.cls.sorts, l)) continue;
      const e = p.codex.find(c => c.id === l.id);
      if (e) e.value = l.value;   // 4A : légendaire de classe, meilleur jet que celui gardé
      else p.codex.push(l.sort ? { id: l.id, sort: l.sort } : PC_PAR_ID[l.id] ? { id: l.id, value: l.value } : { id: l.id });
      this.emit({ k: 'codex', id: l.id });
    }
  }
  /** 5B + 6A/6B : imprime un pouvoir du Codex sur un objet Rare ou Épique (sac ou porté) du bon emplacement ; il devient Légendaire.
   *  Paiement en kamas + runes de l'objet, ou en Pépites. */
  imprimerCodex(uid: number, id: string, paiement: 'kamas' | 'pepites'): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items?.equipment[it.id], e = p.codex.find(c => c.id === id);
    if (!p.v03 || !it || !def || !e || !imprimable(def, it, e)) return false;
    const prix = prixImpression(def, it);
    if (paiement === 'kamas') {
      if (p.kamas < prix.kamas || (prix.rune && (p.resources[prix.rune] ?? 0) < prix.runes)) return false;
      p.kamas -= prix.kamas;
      if (prix.rune) p.resources[prix.rune] -= prix.runes;
    } else {
      if ((p.resources[PEPITE] ?? 0) < prix.pepites) return false;
      p.resources[PEPITE] -= prix.pepites;
    }
    it.rarity = 'legendaire'; it.legendary = fxImpression(def, e, legendaryPower);
    p.recompute();
    this.emit({ k: 'impression', uid, id });
    return true;
  }
  // --- Forgemagie (maquette « Forgemagie » 2A 3B 4B 6A+6D 7A+7B 8D 9B 11B), chez le forgemage --------------------------------
  /** Objet du sac ou porté, par son uid. */
  objetForgeable(uid: number): Item | null {
    const p = this.player, it = p.bag.find(b => b.uid === uid) ?? Object.values(p.equipment).find(e => e?.uid === uid) ?? null;
    return it && this.opts.items?.equipment[it.id] && !this.opts.items.equipment[it.id].familier ? it : null;
  }
  /** Pose une rune du sac sur un objet (payée en kamas, 9B). viser : posée par le forgemage, avec sa commission (8D). */
  forgemager(uid: number, rune: string, viser = false): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id];
    if (!it || !def || !((p.resources[rune] ?? 0) > 0)) return false;
    const kamas = coutKamas(def, rune, viser);
    if (p.kamas < kamas || 'refus' in chanceRune(def, it, rune)) return false;
    const r = forger(this.rng, def, it, rune);
    if (!r) return false;
    p.kamas -= kamas;
    if (!--p.resources[rune]) delete p.resources[rune];
    if (Object.values(p.equipment).includes(it)) p.recompute();
    this.emit({ k: 'forge', uid, rune, issue: r.issue, stat: r.stat, gain: r.gain, pertes: r.pertes, kamas, exo: it.exo === r.stat, over: r.over, objet: def.name });
    return true;
  }
  // --- Forgemagie v2 (maquette « Forgemagie v2 », Mathis 2026-11-12) -----------------------------------------------------------------
  /** 7A : un Orbe régénérant du sac relance tous les jets de l'objet (niveau d'objet au plus celui de l'orbe). */
  utiliserOrbe(uid: number, orbe: string): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id], o = this.opts.items!.resources[orbe]?.orbe;
    if (!it || !def || !o || !((p.resources[orbe] ?? 0) > 0) || !orbeConvient(def, o)) return false;
    regenerer(this.rng, def, it, it.id);
    if (!--p.resources[orbe]) delete p.resources[orbe];
    if (Object.values(p.equipment).includes(it)) p.recompute();
    this.emit({ k: 'fmOrbe', uid, objet: def.name });
    return true;
  }
  /** 7B : Malek relance une ligne (deux jets, il garde le meilleur, jamais moins que l'actuel) ; le prix double à chaque fois. */
  relancerLigneFM(uid: number, s: Stat): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id];
    if (!it || !def) return false;
    const k = coutRelance(def, it);
    if (p.kamas < k) return false;
    const r = relancerLigne(this.rng, def, it, s);
    if (!r) return false;
    p.kamas -= k;
    if (Object.values(p.equipment).includes(it)) p.recompute();
    this.emit({ k: 'fmRelance', uid, stat: s, jets: r.jets, avant: r.avant, apres: r.apres, kamas: k });
    return true;
  }
  /** 6A : une Potion de forgemagie du sac change les dommages neutres de l'arme dans son élément (remplace une potion déjà posée). */
  poserPotionFM(uid: number, potion: string): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id], P = POTIONS[potion];
    if (!it || !def || !P || !((p.resources[potion] ?? 0) > 0) || !potionConvient(def) || it.potion === potion) return false;
    it.potion = potion;
    if (!--p.resources[potion]) delete p.resources[potion];
    if (Object.values(p.equipment).includes(it)) p.recompute();
    this.emit({ k: 'fmPotion', uid, potion, element: P.element });
    return true;
  }
  // --- Commande à Malek (maquette « Forgemagie UI » 9A-9E) : objectifs, planchers, budget ; estimée, puis confiée --------------
  /** Runes du sac (stock de Malek pour une commande). */
  private stockRunes(): Record<string, number> {
    const r = this.player.resources; return Object.fromEntries(Object.keys(r).filter(id => RUNES[id] && r[id] > 0).map(id => [id, r[id]]));
  }
  /** 9D : estimation de la commande (simulée sur des copies, rien ne change). */
  estimerCommande(uid: number, cmd: Commande): Estimation | null {
    const it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id];
    return it && def ? estimerCommande(this.rng, def, it, this.stockRunes(), this.player.kamas, cmd) : null;
  }
  /** 9E : confie l'objet à Malek (une commande à la fois). Il pose les runes du sac, paie avec les kamas (commission comprise,
   *  au plus le budget), et rend l'objet quand le temps de travail est passé. L'objet porté est d'abord retiré. */
  confierCommande(uid: number, cmd: Commande): boolean {
    const p = this.player, it = this.objetForgeable(uid), def = it && this.opts.items!.equipment[it.id];
    if (!it || !def || p.commandeFM || !runeCommande(def, it, this.stockRunes(), cmd)) return false;
    const avant = { ...it.stats }, stock = this.stockRunes();
    const rapport = executerCommande(this.rng, def, it, stock, p.kamas, cmd);
    if (!rapport.essais) return false;
    const slot = (Object.keys(p.equipment) as EquipSlot[]).find(k => p.equipment[k] === it);
    if (slot) { delete p.equipment[slot]; p.recompute(); } else p.bag = p.bag.filter(b => b !== it);
    p.kamas -= rapport.kamas;
    for (const [id, n] of Object.entries(rapport.runes)) { p.resources[id] -= n; if (p.resources[id] <= 0) delete p.resources[id]; }
    const total = dureeCommande(rapport.essais, !!this.test);
    p.commandeFM = { item: it, reste: total, total, rapport, avant };
    this.emit({ k: 'commande', etat: 'confiee', reste: total, essais: rapport.essais });
    return true;
  }
  private updateCommande(dt: number) {
    const c = this.player.commandeFM;
    if (!c || c.prete) return;
    if ((c.reste -= dt) <= 0) { c.reste = 0; c.prete = true; this.emit({ k: 'commande', etat: 'prete', reste: 0, essais: c.rapport.essais }); }
  }
  /** Reprend l'objet chez Malek une fois la commande finie ; il retourne dans le sac. */
  retirerCommande(): CommandeFM | null {
    const p = this.player, c = p.commandeFM;
    if (!c?.prete) return null;
    p.bag.push(c.item); p.commandeFM = null;
    this.emit({ k: 'commande', etat: 'retiree', reste: 0, essais: c.rapport.essais });
    return c;
  }
  /** 6A : grave le nom du perso sur l'objet avec une Rune de Signature (achetée à Malek s'il n'y en a pas dans le sac). */
  signer(uid: number, nom: string): boolean {
    const p = this.player, it = this.objetForgeable(uid), id = SIGNATURE.rune;
    if (!it || it.signe || !nom) return false;
    if ((p.resources[id] ?? 0) > 0) { if (!--p.resources[id]) delete p.resources[id]; }
    else if (p.kamas >= SIGNATURE.kamas) p.kamas -= SIGNATURE.kamas;
    else return false;
    it.signe = nom;
    this.emit({ k: 'signature', uid, nom });
    return true;
  }
  /** « Défaire » (maquette Magasin 7A, 9A-9C) : l'objet rend ses runes et des kamas ; une apparence inconnue rejoint la collection,
   *  un pouvoir légendaire nouveau va au Codex. Renvoie les kamas gagnés ; les runes sont ajoutées à `tout`. */
  private defaireUn(it: Item, def: NonNullable<ItemsData['equipment'][string]>, tout: Record<string, number>): number {
    for (const [id, k] of Object.entries(briser(this.rng, def, it))) tout[id] = (tout[id] ?? 0) + k;
    this.collectionner(it.id); this.enregistrerCodex(it);
    return kamasDefaire(def, it);
  }
  private finDefaire(n: number, tout: Record<string, number>, kamas: number, auto?: string) {
    const p = this.player;
    for (const [id, k] of Object.entries(tout)) p.resources[id] = (p.resources[id] ?? 0) + k;
    p.kamas += kamas;
    if (n) this.emit({ k: 'brisage', n, runes: tout, kamas, ...(auto ? { auto } : {}) });
  }
  /** Défait d'un coup les objets choisis chez Kerubim (jamais un objet sous cadenas ni un familier). */
  briserChoix(uids: number[]): number {
    const p = this.player, I = this.opts.items, tout: Record<string, number> = {};
    let n = 0, kamas = 0;
    p.bag = p.bag.filter(it => {
      const def = I?.equipment[it.id];
      if (!uids.includes(it.uid) || !def || def.familier || it.cadenas) return true;
      kamas += this.defaireUn(it, def, tout); n++; return false;
    });
    this.finDefaire(n, tout, kamas);
    return n;
  }
  /** Défait un objet du sac. Jamais un objet sous cadenas. */
  briserObjet(uid: number): boolean { return this.briserChoix([uid]) === 1; }
  /** Défaire en lot : tous les objets du sac jusqu'à cette rareté comprise, sauf ceux sous cadenas. */
  briserLot(jusqua: Rarity): number {
    const max = RARITIES.indexOf(jusqua);
    return this.briserChoix(this.player.bag.filter(it => RARITIES.indexOf(it.rarity) <= max).map(it => it.uid));
  }
  /** Tri 10C : l'objet vaut mieux que celui porté au même emplacement (flèche verte) ; jamais défait automatiquement. */
  meilleurQuePorte(it: Item): boolean {
    const p = this.player, def = this.opts.items?.equipment[it.id];
    if (!def || def.level > p.level) return false;
    const slot = p.slotFor(it), cur = slot ? p.equipment[slot] : undefined;
    return !cur || noteObjet(it) > noteObjet(cur);
  }
  /** Fusion (6D) : 3 runes donnent 1 rune du palier suivant, autant de fois que possible (ou une seule fois). */
  fusionner(rune: string, tout = false): number {
    const p = this.player, vers = fusionVers(rune);
    if (!vers) return 0;
    const n = Math.min(tout ? Infinity : 1, Math.floor((p.resources[rune] ?? 0) / FUSION_N));
    if (n <= 0) return 0;
    p.resources[rune] -= n * FUSION_N; if (!p.resources[rune]) delete p.resources[rune];
    p.resources[vers] = (p.resources[vers] ?? 0) + n;
    this.emit({ k: 'fusion', de: rune, vers, n });
    return n;
  }
  /** Pose ou retire le cadenas d'un objet du sac (8C). */
  cadenas(uid: number): boolean {
    const it = this.player.bag.find(b => b.uid === uid);
    if (!it) return false;
    if (it.cadenas) delete it.cadenas; else it.cadenas = true;
    return true;
  }
  /** 15B : un archimonstre vaincu avec une Petite pierre d'âme dans le sac est capturé (pierre pleine, et sa page du Bestiaire). */
  /** « Archis : » 5E : en groupe, chaque joueur proche qui a une pierre capture sa propre âme ; 6A : l'âme officielle nommée ;
   *  9C : un boss de donjon aussi (son « Âme capturée » officielle, une seule fois). */
  private capturer(m: Monster) {
    for (const p of this.joueursProches(m.x, m.y)) {
      if (!p.v03 || p.dead || !(p.resources[ARCHI.pierre] > 0)) continue;
      if (m.def.boss && p.ames.includes(m.type)) continue;   // « Archis : » 9C : l'âme d'un boss se capture une fois (la pierre reste)
      p.resources[ARCHI.pierre]--; if (!p.resources[ARCHI.pierre]) delete p.resources[ARCHI.pierre];
      const ame = m.def.ame && this.opts.items?.resources[m.def.ame] ? m.def.ame : ARCHI.pleine;
      p.resources[ame] = (p.resources[ame] ?? 0) + 1;
      const neuf = !p.ames.includes(m.type);
      if (neuf) p.ames.push(m.type);
      this.commeJoueur(p, () => this.emit({ k: 'capture', monster: m.type, neuf, ame }));
    }
  }
  /** Achat dans une boutique (src/data/boutique.json), payé dans la monnaie de l'article : kamas pour l'utile (Magasin 5B), Cawottes chez Tiwa Cawoteuw, sinon Pépites.
   *  Un article « apparat » rejoint la collection d'apparences, une fois pour toutes. */
  acheter(boutique: string, id: string, n = 1): boolean {
    const a = this.opts.boutiques?.[boutique]?.find(x => x.id === id && (!x.v03 || this.player.v03) && (!x.v04 || this.player.v04)), p = this.player;
    if (!a || (a.apres && !((this.quetes?.donjons[a.apres]?.v ?? 0) > 0))) return false;
    if (a.apparat) n = 1;
    return this.payer(a.prix * n, a.monnaie ?? PEPITE, () => {
      if (a.apparat) { if (p.apparats.includes(id)) return false; p.apparats.push(id); }
      else p.resources[id] = (p.resources[id] ?? 0) + n;
      return true;
    }, id, n);
  }
  /** Solde d'une monnaie : « kamas », ou une ressource (Pépites, Cawottes). */
  solde(monnaie: string) { const p = this.player; return monnaie === 'kamas' ? p.kamas : (p.resources[monnaie] ?? 0); }
  /** Paie prix dans cette monnaie si le joueur l'a et si donner() accepte ; émet l'achat. */
  private payer(prix: number, monnaie: string, donner: () => boolean, id: string, n = 1): boolean {
    const p = this.player;
    if (this.solde(monnaie) < prix || !donner()) return false;
    if (monnaie === 'kamas') p.kamas -= prix;
    else { p.resources[monnaie] -= prix; if (!p.resources[monnaie]) delete p.resources[monnaie]; }
    this.emit({ k: 'achat', id, prix, ...(monnaie !== PEPITE ? { monnaie } : {}), ...(n > 1 ? { n } : {}) });
    return true;
  }
  // --- Magasin du Bastion (maquette « Magasin : » 3A+3B 4C) ---------------------
  private ctxMagasin(): CtxMagasin {
    return { boutiques: (this.opts.boutiques ?? {}) as CtxMagasin['boutiques'], v03: this.player.v03, v04: this.player.v04 };
  }
  /** Les achats du jour de ce joueur (remis à zéro à minuit). */
  achatsDuJour() { const p = this.player; return (p.magasin = achatsDuJour(p.magasin, this.opts.aujourdhui ?? '')); }
  /** L'étal du jour (3A) : six offres tirées de la date, deux à -30 %. */
  etalDuJour(): Offre[] { return etalDuJour(this.opts.aujourdhui ?? '', this.ctxMagasin()); }
  /** Achète l'offre i de l'étal (une fois par jour). */
  acheterEtal(i: number): boolean {
    const o = this.etalDuJour()[i], a = this.achatsDuJour(), p = this.player;
    if (!o || a.etal.includes(i)) return false;
    const ok = this.payer(o.prix, o.monnaie, () => { p.resources[o.id] = (p.resources[o.id] ?? 0) + 1; return true; }, o.id);
    if (ok) a.etal.push(i);
    return ok;
  }
  /** 6C : +20 places de sac (prix qui monte à chaque achat). */
  prixSacEnPlus(): number | null { return CONFORT.sac.prix[this.player.sacEnPlus / CONFORT.sac.pas] ?? null; }
  acheterPlacesSac(): boolean {
    const prix = this.prixSacEnPlus(), p = this.player;
    return prix != null && this.payer(prix, PEPITE, () => { p.sacEnPlus += CONFORT.sac.pas; return true; }, 'confort:sac');
  }
  /** 6C : un préréglage d'équipement de plus (4e, puis 5e). */
  prixPrereglage(): number | null { return CONFORT.prereglage.prix[this.player.prereglages.length - Player.PREREGLAGES] ?? null; }
  acheterPrereglage(): boolean {
    const prix = this.prixPrereglage(), p = this.player;
    return prix != null && this.payer(prix, PEPITE, () => { p.prereglages.push(null); return true; }, 'confort:prereglage');
  }
  /** 6C : un onglet de plus au coffre partagé (tout le compte). */
  prixOngletCoffre(): number | null { return CONFORT.onglet.prix[this.coffre.onglets.length - COFFRE.onglets] ?? null; }
  acheterOngletCoffre(): boolean {
    const prix = this.prixOngletCoffre();
    const ok = prix != null && this.payer(prix, PEPITE, () => { this.coffre.onglets.push([]); return true; }, 'confort:onglet');
    if (ok) this.emit({ k: 'coffre' });
    return ok;
  }
  /** 6C : un emplacement de perso de plus (tout le compte : gardé avec le coffre). */
  prixEmplacement(): number | null { return CONFORT.emplacement.prix[this.coffre.emplacementsEnPlus ?? 0] ?? null; }
  acheterEmplacement(): boolean {
    const prix = this.prixEmplacement();
    const ok = prix != null && this.payer(prix, PEPITE, () => { this.coffre.emplacementsEnPlus = (this.coffre.emplacementsEnPlus ?? 0) + 1; return true; }, 'confort:emplacement');
    if (ok) this.emit({ k: 'coffre' });
    return ok;
  }
  /** 6B : un thème du Havre-Sac (pour tout le compte), posé aussitôt. */
  acheterTheme(id: number): boolean {
    const T = this.opts.themesHavreSac, c = this.coffre;
    if (!T || !themesEnJeu(T).some(t => t.id === id) || themesPossedes(T, c).includes(id)) return false;
    const ok = this.payer(T.prix, PEPITE, () => { (c.themes ??= []).push(id); return true; }, `theme:${id}`);
    if (ok) this.poserTheme(id);
    return ok;
  }
  /** 6B : pose un thème possédé ; dans le Havre-Sac, on y revient aussitôt avec le nouveau décor (même point de retour). */
  poserTheme(id: number): boolean {
    const T = this.opts.themesHavreSac, c = this.coffre;
    if (!T || !themesPossedes(T, c).includes(id) || !themesEnJeu(T).some(t => t.id === id)) return false;
    const avant = themeChoisi(T, c).id;
    c.theme = id;
    this.emit({ k: 'coffre' });
    if (this.dansHavreSac && avant !== id) this.emit({ k: 'changeZone', zone: 'havresac', nom: 'Havre-Sac', retour: this.retour ?? undefined });
    return true;
  }
  /** 6E : une teinture (couleurs officielles d'une classe) pour tout le compte ; elle se pose à la garde-robe. */
  acheterTeinture(id: string): boolean {
    const T = this.opts.teintures, c = this.coffre;
    if (!T?.teintures.some(t => t.id === id) || c.teintures?.includes(id)) return false;
    const ok = this.payer(T.prix, PEPITE, () => { (c.teintures ??= []).push(id); return true; }, `teinture:${id}`);
    if (ok) this.emit({ k: 'coffre' });
    return ok;
  }
  // --- Style (« Apparats : » 5B) : auréoles, effets de Zaap, ornements de nom (compte) ; tenues enregistrées (perso) ----------
  aLeStyle(sorte: SorteStyle, id: string): boolean {
    const d = styleDef(sorte, id);
    if (d?.abo) return rangAbo(this.player.abo) >= rangAbo(d.abo as Palier);   // 17A : offert pendant l'abonnement
    return !!this.coffre.styles?.includes(`${sorte}:${id}`);
  }
  acheterStyle(sorte: SorteStyle, id: string): boolean {
    const d = styleDef(sorte, id), c = this.coffre;
    if (!d || d.ogrines || d.abo || this.aLeStyle(sorte, id)) return false;   // Ogrines et abonnement : pas en Pépites
    const ok = this.payer(d.prix, PEPITE, () => { (c.styles ??= []).push(`${sorte}:${id}`); return true; }, `style:${sorte}:${id}`);
    if (ok) { this.player.style[sorte] = id; this.emit({ k: 'coffre' }); }
    return ok;
  }
  /** Porter un style acheté, ou rien (null). */
  porterStyle(sorte: SorteStyle, id: string | null): boolean {
    const p = this.player;
    if (id === null) { delete p.style[sorte]; return true; }
    if (!this.aLeStyle(sorte, id)) return false;
    p.style[sorte] = id;
    return true;
  }
  /** Une place de tenue de plus (Pépites, le prix monte). */
  acheterPlaceTenue(): boolean {
    const p = this.player, prix = prixPlaceTenue(p.placesTenue);
    if (prix == null) return false;
    return this.payer(prix, PEPITE, () => { p.placesTenue++; return true; }, 'placeTenue');
  }
  /** Enregistre la tenue du moment (apparats posés, couleurs données par l'affichage) dans la place i. */
  enregistrerTenue(i: number, nom: string, couleurs?: number[]): boolean {
    const p = this.player;
    if (!Number.isInteger(i) || i < 0 || i >= placesTenues(p.placesTenue) || i > p.tenues.length) return false;
    p.tenues[i] = { nom: (nom.trim() || `Tenue ${i + 1}`).slice(0, 24), apparat: { ...p.apparat }, ...(couleurs ? { couleurs: [...couleurs] } : {}) };
    return true;
  }
  /** Remet la tenue i : ses apparats (ceux qu'on a toujours) ; renvoie ses couleurs pour l'affichage. */
  mettreTenue(i: number): { couleurs?: number[] } | null {
    const p = this.player, t = p.tenues[i];
    if (!t) return null;
    p.apparat = {};
    for (const [slot, id] of Object.entries(t.apparat) as ['chapeau' | 'cape' | 'bouclier' | 'familier', string][]) this.porterApparat(slot, id);
    return { couleurs: t.couleurs };
  }
  supprimerTenue(i: number): boolean { const p = this.player; if (!p.tenues[i]) return false; p.tenues.splice(i, 1); return true; }
  /** 6D : une bénédiction de 30 minutes ; elle remplace celle en cours. */
  acheterBenediction(k: Benediction): boolean {
    const p = this.player;
    if (!BENEDICTIONS[k]) return false;
    // « Apparats : » 17C : bénédictions offertes chaque jour par l'abonnement
    if (this.aboDuJour().beni < avantage(p.abo, 'benedictions')) { p.aboJour.beni++; p.benediction = { k, reste: BENEDICTION.duree }; return true; }
    return this.payer(BENEDICTION.prix, PEPITE, () => { p.benediction = { k, reste: BENEDICTION.duree }; return true; }, `benediction:${k}`);
  }
  /** 4C : un sac à rareté garantie (Rare ou Épique) de son niveau, un seul par jour. */
  acheterSacDuJour(rarete: 'rare' | 'epique'): boolean {
    const a = this.achatsDuJour(), p = this.player;
    if (a.sac || p.bag.length >= p.tailleSac) return false;
    const ok = this.payer(MAGASIN.sac[rarete], PEPITE, () => true, `sac:${rarete}`);
    if (ok) { a.sac = true; this.donnerSac(rarete, p.level); }
    return ok;
  }
  /** Case Apparence de l'inventaire : pose un apparat possédé sur l'emplacement, « 0 » cache l'objet porté, null rend sa vraie apparence. */
  porterApparat(slot: 'chapeau' | 'cape' | 'bouclier' | 'familier', id: string | null): boolean {
    const p = this.player;
    if (id === null) { delete p.apparat[slot]; return true; }
    if (id !== '0' && (!p.apparats.includes(id) || this.opts.apparats?.objets[id]?.slot !== slot)) return false;
    p.apparat[slot] = id;
    return true;
  }
  /** Potion de Rappel : retour au dernier Zaap atteint (le point de retour). */
  rappel(id: string): boolean {
    const r = this.opts.items?.resources[id], p = this.player;
    if (!r?.rappel || !(p.resources[id] > 0) || p.dead || !this.zone.open) return false;
    const non = (text: string) => { this.emit({ k: 'status', x: p.x, y: p.y - 60, text, color: '#ff9a5a' }); return false; };
    if (this.dansBastion) return non('Tu es déjà au Bastion des Douze');
    if (this.dansHavreSac && !this.bastionOuvert) return non('Sors du Havre-Sac par son Zaap');
    if ((this.worldGrid?.mapAt(p.x, p.y)?.tag ?? '').startsWith('temple')) return non('Pas pendant le tutoriel');
    p.resources[id]--; if (!p.resources[id]) delete p.resources[id];
    // maquette Ville 7A : la Potion de Rappel ramène au Bastion des Douze (le Zaap y ramène ensuite là où l'on était)
    if (this.bastionOuvert) {
      p.stopMove();
      const retour = this.dansHavreSac ? this.retour : this.ici();
      this.emit({ k: 'changeZone', zone: 'bastion', nom: this.opts.data.zones.bastion.name, ...(retour ? { retour } : {}) });
      return true;
    }
    p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0; p.stopMove();
    this.passage = null; this.portalLock = null;
    this.proteger();
    this.emit({ k: 'rappel', name: this.checkpointName });
    this.emit({ k: 'portal', nom: this.checkpointName });
    return true;
  }

  // --- Métiers (choix 6A, ateliers 10A, Fabriquer ×N 10B) ----------------------
  /** Atelier où se trouve le joueur pour ce métier (null : pas d'atelier ici). Sans ateliers déclarés (tests, vagues), partout. */
  atelierIci(metier: string): AtelierDef | null | undefined {
    const A = this.zone.open?.ateliers;
    if (!A) return undefined;
    const tag = this.worldGrid?.mapAt(this.player.x, this.player.y)?.tag;
    return A.find(a => a.metiers.includes(metier) && !!tag && a.cartes.includes(tag)) ?? null;
  }
  /** Ateliers de ce métier dans la zone (pour dire où aller). */
  ateliersDe(metier: string): AtelierDef[] { return (this.zone.open?.ateliers ?? []).filter(a => a.metiers.includes(metier)); }
  /** Combien de fois on peut faire la recette i avec le sac actuel. */
  craftMax(i: number, rare: string | null = null): number {
    const r = this.opts.items?.recipes?.[i], p = this.player;
    if (!r || !this.recetteVisible(r) || Math.max(1, p.metierLevel(r.metier)) < r.level) return 0;
    let n = Math.min(...r.ingredients.map(([id, q]) => Math.floor((p.resources[id] ?? 0) / q)));
    if (this.opts.items?.equipment[r.result]) {
      n = Math.min(n, p.tailleSac - p.bag.length);   // un objet par place du sac
      if (rare) n = this.ingredientsRares.has(rare) ? Math.min(n, Math.floor((p.resources[rare] ?? 0) / (1 + (r.ingredients.find(([x]) => x === rare)?.[1] ?? 0)))) : 0;
    }
    if (TROPHEES[r.result]) n = p.trophees.includes(r.result) ? 0 : Math.min(n, 1);   // un trophée se possède une fois (3B)
    return Math.max(0, n);
  }
  /** 0.3 (9A) : les métiers de fabrication d'équipement n'existent qu'en partie de test tant que la 0.3 n'est pas sortie. */
  recetteVisible(r: RecipeDef): boolean { return (this.player.v03 || !METIERS_FAB.includes(r.metier)) && (this.player.v04 || !TROPHEES[r.result]); }
  private _rares: Set<string> | null = null;
  /** 10B : ressources de boss ou d'élite qui garantissent un objet fabriqué Rare. */
  get ingredientsRares(): Set<string> {
    return this._rares ??= this.opts.items ? ingredientsRares(this.opts.items, this.opts.data.monsters) : new Set();
  }
  /** Postes des ateliers : les machines officielles (ateliers_postes.py), sinon un poste au milieu de la première carte. */
  private buildPostes() {
    const wg = this.worldGrid, A = this.zone.open?.ateliers;
    if (!wg) return;
    this.buildCoffres();
    for (const e of this.zone.open?.etablis ?? []) {   // Forgemagie v2 2B : l'établi du Havre-Sac
      if (!wg.mapByTag(e.carte)) continue;
      const c = wg.cellToWorld(wg.cellOf(e.carte, e.case)), q = wg.nearestFree(c.x, c.y, wg.freeByMap.get(e.carte)!);
      this.postes.push({ id: this.nextId++, atelier: e.nom, metiers: [], tag: e.carte, x: q.x, y: q.y, forge: true });
    }
    if (!A) return;
    for (const a of A) {
      if (!this.player.v03 && a.metiers.every(m => METIERS_FAB.includes(m))) continue;   // 0.3 : ateliers de fabrication
      const l = (a.postes ?? []).filter(([tag]) => wg.mapByTag(tag));
      for (const [tag, cell, gfx, dx, dy] of l) {
        const q = wg.cellToWorld(wg.cellOf(tag, cell));
        // une machine partagée par deux ateliers (mineurs et forgerons, bûcherons et sculpteurs) : un seul poste, tous les métiers
        const deja = this.postes.find(po => po.tag === tag && po.x === q.x && po.y === q.y && !po.coffre);
        if (deja) { deja.metiers = [...new Set([...deja.metiers, ...a.metiers])]; continue; }
        this.postes.push({ id: this.nextId++, atelier: a.nom, metiers: a.metiers, tag, x: q.x, y: q.y, gfx, dessin: dx || dy ? { x: dx, y: dy } : undefined });
      }
      const tag = a.cartes.find(t => wg.mapByTag(t) && wg.freeByMap.get(t)?.length);
      if (!l.length && tag) { const q = this.openestCell(tag); this.postes.push({ id: this.nextId++, atelier: a.nom, metiers: a.metiers, tag, x: q.x, y: q.y }); }
    }
  }
  /** 12A+12B : le coffre partagé, au Havre-Sac et à la Banque d'Astrub (0.3 : partie de test tant qu'elle n'est pas sortie). */
  private buildCoffres() {
    const wg = this.worldGrid;
    if (!wg || !this.player.v03) return;
    for (const c of this.zone.open?.coffres ?? []) {
      if (!wg.mapByTag(c.carte)) continue;
      const q = c.case != null ? wg.cellToWorld(wg.cellOf(c.carte, c.case)) : this.openestCell(c.carte);
      this.postes.push({ id: this.nextId++, atelier: c.nom, metiers: [], tag: c.carte, x: q.x, y: q.y, coffre: true, ...(c.case != null ? { gfx: 0 } : {}) });
    }
  }
  // --- Almanax (0.3, 15C) ---------------------------------------------------
  /** Jour de l'Almanax d'aujourd'hui (date du PC), en 0.3 seulement. */
  get almanaxDuJour(): JourAlmanax | null { return this.player.v03 ? jourAlmanax(this.opts.aujourdhui) : null; }
  /** Bonus de l'Almanax actif : l'offrande du jour a été faite. */
  get almanax(): JourAlmanax | null { const j = this.almanaxDuJour; return j && this.player.almanaxJour === this.opts.aujourdhui ? j : null; }
  /** Fait l'offrande du jour : prend l'objet, donne les Pépites et le bonus jusqu'à minuit. */
  offrirAlmanax(): boolean {
    const p = this.player, j = this.almanaxDuJour;
    if (!j || this.almanax || (p.resources[j.offrande] ?? 0) < j.n) return false;
    p.resources[j.offrande] -= j.n;
    if (p.resources[j.offrande] <= 0) delete p.resources[j.offrande];
    const pep = ALMANAX.pepites * (j.effet === 'pepites' ? 2 : 1);
    p.resources[PEPITE] = (p.resources[PEPITE] ?? 0) + pep;
    p.almanaxJour = this.opts.aujourdhui!;
    this.emit({ k: 'almanax', bonus: j.bonus, pepites: pep });
    return true;
  }
  /** Le joueur se tient devant un coffre (il peut y ranger et y prendre). */
  get presCoffre(): boolean {
    const p = this.player;
    return this.postes.some(po => po.coffre && Math.hypot(po.x - p.x, po.y - p.y) <= FABRICATION.portee + 60);
  }
  /** Range un objet du sac dans l'onglet du coffre (12A). */
  deposer(uid: number, onglet: number): boolean {
    const p = this.player, i = p.bag.findIndex(b => b.uid === uid), l = this.coffre.onglets[onglet];
    if (!this.presCoffre || i < 0 || !l || l.length >= COFFRE.places) return false;
    l.push(p.bag.splice(i, 1)[0]);
    this.emit({ k: 'coffre' });
    return true;
  }
  /** Reprend un objet du coffre dans le sac (il prend un numéro de ce perso : il peut venir d'un autre). */
  retirer(onglet: number, index: number): boolean {
    const p = this.player, l = this.coffre.onglets[onglet], it = l?.[index];
    if (!this.presCoffre || !it || p.bag.length >= p.tailleSac) return false;
    l.splice(index, 1);
    p.bag.push({ ...it, uid: this.nextId++ });
    this.emit({ k: 'coffre' });
    return true;
  }
  /** Case libre la plus proche d'un poste (les machines sont sur des cases bloquantes). */
  approchePoste(id: number) {
    const po = this.postes.find(x => x.id === id);
    return po ? this.map.nearestFree(po.x, po.y) : null;
  }
  private updateAteliers(dt: number) {
    const p = this.player, f = this.enFabrication;
    if (f) {
      if (p.dead || p.hp < f.hp) { this.annulerFabrication(); return; }
      p.stopMove(); f.t += dt;
      if (f.t < FABRICATION.duree) return;
      this.enFabrication = null;
      this.craft(f.recette, f.n, f.rare);
      return;
    }
    if (this.versPoste == null) return;
    const po = this.postes.find(x => x.id === this.versPoste);
    if (!po || p.dead) { this.versPoste = null; return; }
    const arrive = this.approcheP && Math.hypot(this.approcheP.x - p.x, this.approcheP.y - p.y) < 24;
    if ((Math.hypot(po.x - p.x, po.y - p.y) > FABRICATION.portee && !arrive) || p.state !== 'free') return;
    this.versPoste = null;
    p.stopMove(); p.facing = Math.atan2(po.y - p.y, po.x - p.x);
    if (po.coffre) { this.emit({ k: 'coffreOuvert' }); return; }
    if (po.forge) { this.emit({ k: 'etabliForge' }); return; }
    this.emit({ k: 'atelier', poste: po.id, metier: po.metiers[0] });
  }
  /** Lance la fabrication de n fois la recette i (fenêtre Artisanat) : une barre d'une seconde, puis tout est fait d'un coup. */
  lancerFabrication(i: number, n = 1, rare: string | null = null): boolean {
    const r = this.opts.items?.recipes?.[i], p = this.player;
    if (!r || this.enFabrication || p.dead || this.atelierIci(r.metier) === null) return false;
    n = Math.min(Math.max(1, Math.floor(n)), this.craftMax(i, rare));
    if (n <= 0) return false;
    p.stopMove(); this.versPoste = null;
    this.enFabrication = { recette: i, n, t: 0, hp: p.hp, rare };
    this.emit({ k: 'fabricationDebut', recette: i, n, duree: FABRICATION.duree });
    return true;
  }
  annulerFabrication() { if (this.enFabrication) { this.enFabrication = null; this.emit({ k: 'fabricationStop' }); } }
  /** Fait n fois une recette officielle si on a les ingrédients, le niveau de métier et qu'on est à son atelier. Rend le nombre fait. */
  craft(i: number, n = 1, rare: string | null = null): number {
    const r = this.opts.items?.recipes?.[i], p = this.player, def = this.opts.items?.equipment[r?.result ?? ''];
    if (!r || this.atelierIci(r.metier) === null) return 0;
    if (!def) rare = null;
    n = Math.min(Math.max(1, Math.floor(n)), this.craftMax(i, rare));
    if (n <= 0) return 0;
    const retirer = (id: string, q: number) => { p.resources[id] -= q; if (p.resources[id] <= 0) delete p.resources[id]; };
    for (const [id, q] of r.ingredients) retirer(id, q * n);
    if (def) {
      // 0.3 (9A, 10A+10B, 11E) : un objet par recette, Commun ou Rare, jamais plus ; l'ingrédient rare garantit Rare
      if (rare) retirer(rare, n);
      const ch = chanceRare(Math.max(1, p.metierLevel(r.metier))) + (this.almanax?.effet === 'fabrication' ? ALMANAX.fabrication : 0);   // 15C
      let rares = 0;
      for (let k = 0; k < n; k++) {
        const it = rollItem(r.result, def, rare || this.rng.next() < ch ? 'rare' : 'commun', this.rng, this.nextId++);
        if (it.rarity === 'rare') rares++;
        p.bag.push(it);
      }
      p.gainMetierXp(r.metier, n * METIER_XP.parIngredient * r.ingredients.reduce((s, [, q]) => s + q, 0), this);
      this.emit({ k: 'craft', id: r.result, n, rares });
      return n;
    }
    if (TROPHEES[r.result]) {   // trophée (0.4 suite 3B) : dans les emplacements de Dofus, pas dans le sac
      p.gainMetierXp(r.metier, METIER_XP.parIngredient * r.ingredients.reduce((s, [, q]) => s + q, 0), this);
      if (p.gagnerTrophee(r.result)) this.emit({ k: 'dofusGagne', id: r.result });
      this.emit({ k: 'craft', id: r.result, n: 1 });
      return 1;
    }
    p.resources[r.result] = (p.resources[r.result] ?? 0) + n;
    p.gainMetierXp(r.metier, n * METIER_XP.parIngredient * r.ingredients.reduce((s, [, q]) => s + q, 0), this);
    this.emit({ k: 'craft', id: r.result, n });
    return n;
  }
  /** Mange une ressource qui soigne (Bouillon de Chair : +11 PV). */
  eat(id: string): boolean {
    const r = this.opts.items?.resources[id], p = this.player;
    if (!r?.soin || !(p.resources[id] > 0) || p.dead) return false;
    p.resources[id]--; if (!p.resources[id]) delete p.resources[id];
    const heal = p.soigner(r.soin);
    this.emit({ k: 'eat', id, heal });
    this.emit({ k: 'potion', x: p.x, y: p.y, amount: r.soin });
    return true;
  }

  /** Utilise un consommable du sac (clic droit) : nourriture qui soigne, ou repas, élixir, boisson, parchemin (« Métiers : » 4A-4C, 5A). */
  utiliser(id: string): boolean {
    const p = this.player, sorte = sorteConso(id), nom = this.opts.items?.resources[id]?.name ?? id;
    if (!sorte) return this.eat(id);
    if (p.dead || !((p.resources[id] ?? 0) > 0)) return false;
    const dire = (text: string, color = '#b9e54b') => this.emit({ k: 'status', x: p.x, y: p.y - 60, text, color });
    if (sorte === 'boisson') {
      p.ceinture = id;   // la dernière boisson bue va sur sa touche
      if (p.boissonCd > 0) return false;
      const k = RES_BOISSON[BOISSONS[id]];
      p.mods = p.mods.filter(m => m.src !== 'boisson');   // une boisson à la fois
      p.addMod(k, CONSO.boisson.bonus, CONSO.boisson.duree, 'boisson');
      p.boissonCd = CONSO.boisson.recharge;
      this.emit({ k: 'potion', x: p.x, y: p.y, amount: 0 });
    } else if (sorte === 'parchemin') {
      const k = PARCHEMINS[id], n = p.parchemins[k] ?? 0;
      if (n >= CONSO.parcheminMax) { dire(`${STAT_NAMES[k]} : déjà ${CONSO.parcheminMax} points de parchemin`, '#ff9a5a'); return false; }
      p.parchemins[k] = n + 1; p.recompute();
      dire(`+1 ${STAT_NAMES[k]} pour toujours (${n + 1} / ${CONSO.parcheminMax})`);
    } else {
      const b = sorte === 'repas' ? REPAS[id] : ELIXIRS[id], avant = p[sorte];
      p[sorte] = { id, reste: CONSO.duree }; p.recompute();
      dire(`${nom} : ${texteBonus(b)} pendant 30 min${avant && avant.id !== id ? ' (remplace le précédent)' : ''}`);
    }
    if (!--p.resources[id]) delete p.resources[id];
    this.emit({ k: 'consommer', id, sorte });
    return true;
  }

  /** Récompense de quête ou de succès : un équipement (Commun) dans le sac, ou une ressource. */
  donnerObjet(id: string, n = 1) {
    const I = this.opts.items, p = this.player;
    if (I?.equipment[id]) { for (let i = 0; i < n; i++) { const it = rollItem(id, I.equipment[id], 'commun', this.rng, this.nextId++); p.bag.push(it); if (I.equipment[id].familier) this.noterFamilier(it); } }
    else { p.resources[id] = (p.resources[id] ?? 0) + n; this.emit({ k: 'lootResource', id, n }); }
  }
  /** Sac à rareté garantie (récompense de contrat, d'Avis de recherche, Quêtes roadmap 5A) : un équipement de ce niveau, de cette rareté. */
  /** garanti (quête « Le premier pouvoir », 8C) : un pouvoir officiel de la classe, sur un sort connu, donc un emplacement qui en a un. */
  donnerSac(rarete: Rarity, niveau: number, garanti = false) {
    const I = this.opts.items, p = this.player, ctx = { ...p.ctxPouvoirs, garanti: garanti && p.v03 };
    if (!I) return;
    const okSlot = (e: { id: string }) => !ctx.garanti || (!I.equipment[e.id].familier && slotAPouvoirConnu(ctx, I.equipment[e.id].slot));
    let pool = poolNiveau({ pool: this.equipByLevel, poolSecours: this.equipSecours, niveau }).filter(okSlot);
    if (!pool.length) pool = this.equipSecours.filter(okSlot).sort((x, y) => Math.abs(x.level - niveau) - Math.abs(y.level - niveau)).slice(0, 20);
    if (!pool.length) return;
    const id = this.rng.pick(pool).id, it = rollItem(id, I.equipment[id], rarete, this.rng, this.nextId++, ctx);
    p.bag.push(it);
    this.emit({ k: 'sacQuete', id, rarity: rarete });
    this.ouvrirCodex(it);
  }
  // --- Bêtes de l'Osamodas (maquette Osamodas, 2026-11-08) ---------------------------
  /** 8A : un monstre en chasse frappe la bête qui l'a frappé (si elle est à moins de 4 cases), ou la bête bien plus proche que le joueur. */
  cibleDe(m: Monster): Cible {
    // Multi : le joueur vivant le plus proche (le joueur de cet écran s'ils sont tous à terre)
    let p = this.players[0];
    if (this.players.length > 1) {
      let dm = p.dead ? Infinity : Math.hypot(p.x - m.x, p.y - m.y);
      for (const q of this.players) { if (q.dead) continue; const d = Math.hypot(q.x - m.x, q.y - m.y); if (d < dm) { dm = d; p = q; } }
      // Eniripsa 11A : le soigneur qui vient de soigner un allié proche attire ce monstre quelques secondes
      if (m.viseJusqua > this.time) { const v = this.players.find(q => q.id === m.viseId && !q.dead); if (v && Math.hypot(v.x - m.x, v.y - m.y) < CASE * 12) p = v; }
    }
    if (!this.betes.length || m.state === 'idle' || m.state === 'return') return p;
    const vivantes = this.betes.filter(b => !b.dead && b.state !== 'spawn');
    const ag = vivantes.find(b => b.id === m.agresseur);
    if (ag && (m.provoqueJusqua > this.time || Math.hypot(ag.x - m.x, ag.y - m.y) < CASE * 4)) return ag;   // Laine épaisse : provoqué
    // Enutrof (interface du coffre 6B) : le coffre en surcharge attire les monstres en chasse autour de lui
    const sur = vivantes.find(b => b.base === CLE_COFFRE && b.owner.cls.coffre && enSurcharge(b.owner) && Math.hypot(b.x - m.x, b.y - m.y) <= CASE * b.owner.cls.coffre.surcharge.attire);
    if (sur) return sur;
    const dp = Math.hypot(p.x - m.x, p.y - m.y);
    let best: Cible = p, bd = p.dead ? Infinity : dp * 0.6;
    for (const b of vivantes) { const d = Math.hypot(b.x - m.x, b.y - m.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  /** Bête vivante invoquée par ce sort (une par sort, la touche la rappelle ou l'éveille). */
  beteDe(sort: string): Bete | undefined { return this.betes.find(b => b.sort === sort && !b.dead); }
  /** Coût en Invocations (2A) : 1 / 2 / 3 selon le rang ; le joueur en a 1 de base + objets + Cortège Sauvage. */
  invocationsPrises(p?: Player): number { return this.betes.filter(b => !b.dead && !b.dompteT && !b.finT && !b.horsCompte && (!p || b.owner === p)).reduce((a, b) => a + BETES[b.base].rang, 0); }
  /** Cortège Sauvage : quand le bonus d'Invocations retombe, les bêtes en trop repartent (les plus anciennes d'abord). */
  renvoyerSurplus(p: Player) {
    const max = this.invocationsMax(p);
    for (const b of this.betes) {
      if (this.invocationsPrises(p) <= max) return;
      if (b.dead || b.owner !== p || b.dompteT || b.finT || b.horsCompte) continue;
      this.emit({ k: 'status', x: b.x, y: b.y - 40, text: 'Repart', color: '#a89fb6' });
      for (const q of this.betes) if (q === b || (q.horsCompte && !q.dead && q.owner === p && q.sort === b.sort)) { q.dead = true; q.t = 0; }
    }
  }
  invocationsMax(p: Player): number { if (this.test?.invocations) return 99;   // partie de test (Outil test 7B)
    return REGLES_BETES.invocationsBase + Math.max(0, p.stat('invocations')); }
  /** Fait apparaître la bête d'un sort au point visé (case libre la plus proche). */
  invoquer(p: Player, key: string, sort: string, x: number, y: number, discret = false): Bete | null {
    if (!BETES[key]) return null;
    const q = this.walkable(x, y) ? { x, y } : this.map.nearestFree(x, y);
    const b = new Bete(this.nextId++, p, key, sort, q.x, q.y);
    this.betes.push(b);
    if (!discret) this.emit({ k: 'status', x: b.x, y: b.y - 40, text: b.def.name, color: '#9fe07a' });
    this.emit({ k: 'invocation', id: b.id, x: b.x, y: b.y });
    return b;
  }
  /** Horde sauvage (Osamodas A) : n bêtes de la meute en plus pendant t s (hors du compte des Invocations). */
  horde(p: Player, n: number, t: number) {
    const pool = ['tofu', 'bouftou', 'crapipou', 'dragoune'];
    for (let i = 0; i < n; i++) {
      const a = p.facing + Math.PI + (i - 0.5) * 1.2;
      const b = this.invoquer(p, this.rng.pick(pool), 'horde', p.x + Math.cos(a) * CASE * 1.5, p.y + Math.sin(a) * CASE * 1.5);
      if (b) b.finT = t;
    }
  }
  /** 14A Meute bigarrée : +5 % de dommages à la meute par élément différent présent parmi les bêtes. */
  bonusMeute(p: Player): number {
    const els = new Set(this.betes.filter(b => !b.dead && b.owner === p).map(b => b.def.element).filter(e => e !== 'neutre'));
    return 1 + REGLES_BETES.meuteBigarree * (els.size >= 2 ? els.size : 0);
  }
  /** Coup d'une bête sur un monstre : caractéristiques de l'Osamodas, résistance officielle du monstre ; remplit l'Éveil (4A). */
  coupDeBete(b: Bete, m: Monster, jet: number, element: Element): number {
    const p = b.owner;
    if (m.intouchable) return 0;
    const el = p.resolveElement(element), res = Math.min(50, m.def.res?.[el] ?? 0);
    const vu = (m.vulnT > 0 ? 1 + m.vuln / 100 : 1) * m.subis;
    const dmg = Math.max(1, Math.round(p.damage(jet, element) * this.rng.range(0.9, 1.1) * (1 - res / 100) * vu));
    m.hp -= dmg; m.flash = 0.09; m.calmeT = 0; m.struck = true; m.agresseur = b.id;
    if (m.state === 'idle' || m.state === 'return') this.aggroGroup(m);
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit: false, element: el, sort: 'invocations' });
    if (p.cls.rage.mode === 'eveil') { p.lastHitAt = p.age; p.addRage(REGLES_BETES.eveil.parCoupBete, this); }
    if (m.hp <= 0) this.killMonster(m);
    return dmg;
  }

  /** 15A : Laisse Spirituelle sur un monstre sous le seuil de PV (pas un boss) : il se bat pour l'Osamodas pendant duree s,
   *  avec ses propres sorts officiels, puis s'enfuit (ni XP ni butin). */
  dompter(p: Player, x: number, y: number, D: { seuil: number; duree: number }): boolean {
    const m = this.monsters.filter(q => !q.dead && !q.def.boss && q.hp <= q.maxHp * D.seuil && Math.hypot(q.x - x, q.y - y) <= q.radius + CASE)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (!m) return false;
    const sorts: SortBete[] = (m.def.spells ?? []).map(sp => ({ id: sp.id, name: sp.name, pa: sp.pa, po: sp.po, anim: sp.anim, zone: sp.zone,
      effets: sp.effects.flatMap((e): EffetBete[] => e.k === 'dmg' ? [{ k: 'dmg' as const, element: e.element, min: e.min, max: e.max, vol: e.steal }]
        : e.k === 'soin' ? [{ k: 'soin' as const, min: e.min, max: e.max }]
        : e.k === 'repousse' || e.k === 'attire' || e.k === 'avance' ? [{ k: e.k, n: e.n }] : []) }));
    if (!sorts.some(sp => sp.effets.some(e => e.k === 'dmg'))) sorts.push({ id: 0, name: 'Coup', pa: 2, po: [1, 1], anim: 0, zone: 'P1', effets: [{ k: 'dmg', element: 'neutre', min: m.def.dmg, max: m.def.dmg, vol: false }] });
    const def = { dofusId: m.def.dofusId ?? 0, name: m.def.name, look: 0, atlas: m.def.look, rang: 0, element: 'neutre' as const, suivant: null, pv: 0, sorts };
    m.dead = true; m.t = 0;   // le monstre quitte son groupe sans mourir (ni XP ni butin)
    const la = p.pcv('pc-osamodas-F');   // Lien des âmes : reste plus longtemps et garde ses PV
    const b = new Bete(this.nextId++, p, m.type, 'dompte', m.x, m.y, def, Math.max(1, Math.round(la ? m.maxHp : m.maxHp * 0.6)));
    b.dompteT = D.duree * (la || 1); b.state = 'suit';
    this.betes.push(b);
    this.emit({ k: 'dompte', id: b.id, name: m.def.name, x: b.x, y: b.y });
    this.emit({ k: 'status', x: b.x, y: b.y - 40, text: `${m.def.name} dompté !`, color: '#9fe07a' });
    return true;
  }

  onPlayerDeath() { for (const b of this.betes) b.mourir(this); this.over = true; this.emit({ k: 'playerDeath', wave: this.wave }); }

  /** Évite que les monstres se superposent (O(n²), suffisant sous 100 monstres). */
  private separate() {
    // Monde ouvert : seuls les monstres près d'un joueur (éveillés, et les dormeurs juste au bord) se poussent. Les milliers
    // d'autres dorment immobiles : les comparer coûtait un quart du calcul de chaque image (mesure du 10 nov. 2026).
    const loin = World.SOMMEIL + 400, proche = (m: Monster) => !this.zone.open || this.players.some(q => Math.abs(m.x - q.x) + Math.abs(m.y - q.y) <= loin);
    const all = this.monsters.filter(m => !m.dead && proche(m));
    // Grille de 128 : seuls les monstres de cases voisines peuvent se toucher (rayons ≤ 36). Monde ouvert = des centaines
    // de monstres, tester toutes les paires coûtait l'essentiel du pas de simulation.
    const G = 128, cells = new Map<number, number[]>(), key = (cx: number, cy: number) => cx * 65536 + cy;
    all.forEach((m, i) => { const k = key(Math.floor(m.x / G), Math.floor(m.y / G)); const c = cells.get(k); if (c) c.push(i); else cells.set(k, [i]); });
    const near: number[] = [];
    for (let i = 0; i < all.length; i++) {
      const cx = Math.floor(all[i].x / G), cy = Math.floor(all[i].y / G);
      near.length = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const j of cells.get(key(cx + ox, cy + oy)) ?? []) if (j > i) near.push(j);
      near.sort((x, y) => x - y);
      for (const j of near) {
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.radius + b.radius;
      if (d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d, wa = b.def.mass / (a.def.mass + b.def.mass), wb = 1 - wa;
        a.x -= nx * push * 2 * wa; a.y -= ny * push * 2 * wa; b.x += nx * push * 2 * wb; b.y += ny * push * 2 * wb;
      }
      }
    }
    const p = this.player;
    if (p.z > 5) return;
    for (const m of all) {
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 0.01, min = p.radius + m.radius;
      if (d < min) {
        const push = min - d;
        p.x += (dx / d) * push * 0.5; p.y += (dy / d) * push * 0.5;
        m.x -= (dx / d) * push * 0.5; m.y -= (dy / d) * push * 0.5;
      }
    }
  }
}
