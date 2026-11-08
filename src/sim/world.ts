import { angleDiff, Rng } from './math';
import type { AtelierDef, DonjonDef, Element, GameData, HitZone, MonsterSpell, SubAreaDef, ZoneDef } from './defs';
import type { PointDeRetour, RetourHavreSac, SimEvent, Telegraph } from './events';
import { GridMap, WorldGrid } from './gridmap';
import { ISO } from './iso';
import { NO_INPUT, type PlayerInput } from './input';
import { AGGRO, CASE, Monster, TOUR, type Cible } from './monster';
import { jetOfficiel } from './danger';
import { poolNiveau, rangDe, tirerButin, type CtxButin, type Rang } from './butin';
import { briser, chanceRune, coutKamas, dureeCommande, estimerCommande, executerCommande, forger, fusionVers, FUSION_N, runeCommande, RUNES, SIGNATURE, type Commande, type CommandeFM, type Estimation } from './forgemagie';
import { FAMILIER_MAX, FAMILIER_XP, familierNiveau, familierStats, METIER_XP, PEPITE, RARITIES, recycleResource, recycleValue, rollItem, type EquipSlot, type Item, type ItemsData, type Rarity } from './items';
import { Player } from './player';
import { Bete, BETES, REGLES_BETES, type EffetBete, type SortBete } from './bete';
import { initiativeBonus, removalChance } from './caracs';
import { planWave } from './waves';
import { Arene, ARENE } from './arene';
import { Quetes, type Compte, type EtatQuetes, type QuetesData } from './quests';
import { appliquerTest, type ReglagesTest } from './outilsTest';
import { FABRICATION, type Poste } from './metiers';
import { PLACEMENT, analyserCarte, placementPose, placementValide, proposerPlacement, type AnalyseCarte, type PlacementCarte } from './placement';
import { RECOLTE, porteeRecolte, quantite, xpRecolte, type Recolte, type RecoltesData } from './recolte';

interface HitDef { dmg: number; knock: number; element?: Element; lifesteal?: number;
  /** Effets officiels : Érosion (part des dommages ôtée aux PV max), retrait de PM / PA. */
  erosion?: number; pmLoss?: number; paLoss?: number; poLoss?: number;
  /** Dommages multipliés sur les invocations (Concentration), et aussi sur les élites et les boss (Rage pleine). */
  vsSummon?: number; vsElite?: boolean;
  /** Dommages de poussée officiels si la cible heurte un obstacle ou un monstre. */
  pushDmg?: boolean;
  /** Coup d'arme (maquette Armes 3B) : l'affichage fait jaillir un éclat de la couleur de l'élément. */
  eclat?: boolean }
/** Butin au sol (choix 1C 2D 6A) : équipements et kamas seulement. Les Communs et les kamas filent vers le joueur
 *  qui passe près ; Rare et plus se ramassent d'un clic. Les ressources vont directement dans le sac. */
export interface Drop { uid: number; x: number; y: number; item?: Item; kamas?: number; t: number; warned?: boolean;
  /** Rapporté par le familier : ramassé tout de suite. */
  familier?: boolean }

/** Flèche en vol (Crâ). */
export interface Projectile { id: number; spell: string; x: number; y: number; dx: number; dy: number; left: number; speed: number; width: number;
  explode: number; pierce: boolean; hit: HitDef; stun: number; touched: Set<number>;
  /** Flèche officielle de l'Arc (maquette Armes 4B) : dessinée par l'affichage, plantée au sol si elle manque. */
  fleche?: boolean;
  /** Tiré par un monstre : touche le joueur, pas les monstres. */
  hostile?: boolean;
  /** Sort officiel du monstre qui l'a lancé (ses effets s'appliquent à l'impact). */
  from?: { monster: Monster; spell: MonsterSpell } }

/** Monde ouvert : un groupe de monstres posé sur une carte Dofus, qui réapparaît quand il a été vaincu. */
interface MonsterGroup {
  id: number; map: string; sub: SubAreaDef; members: Monster[]; timer: number; cleared: boolean; x: number; y: number;
  /** Donjon : monstres fixes du groupe et nom du donjon (ne réapparaît pas tant que le joueur y est). */
  fixe?: string[]; donjon?: string;
  /** Point du placement de la carte où le groupe s'est posé (-1 : aucun). */
  point: number;
  /** Retiré par l'éditeur de placement (F1) : ne revient plus. */
  retire?: boolean;
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
  /** Choix « Tutoriel » à la création du perso : faux = tutoriel passé (équipement de départ quand même donné). Absent = règle du compte (7B). */
  tuto?: boolean;
  /** Partie reprise : avancement des quêtes sauvegardé (sinon les quêtes du départ démarrent). */
  reprise?: EtatQuetes;
  /** Arrivée par un portail d'une autre zone : [carte, case] de la porte d'arrivée. */
  arrivee?: [string, number];
  /** Métiers de récolte (src/data/recoltes.json) : ressources et leurs emplacements par monde. */
  recoltes?: RecoltesData;
  /** Boutiques des PNJ (src/data/boutique.json) : articles et prix en Pépites. */
  boutiques?: Record<string, { id: string; prix: number }[]>;
  /** Objets d'apparat officiels (src/data/apparat.json) et leur prix en Pépites chez Emp (boutique.json, apparat_prix). */
  apparats?: { objets: Record<string, { slot: string; collection?: boolean }>; prix: Record<string, number> };
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
  /** Zones déjà visitées par le perso (3A : les PNJ du Havre-Sac emménagent au fil de l'histoire). */
  zonesVues?: string[];  /** Date du jour (AAAA-MM-JJ), donnée par l'affichage : premier passage d'un donjon au carnet de route (Tour 8B). */
  aujourdhui?: string;
}

/** Le familier porté (maquette Familiers 4A) : il suit le perso et va chercher le butin autour de lui. */
export interface FamilierEtat { x: number; y: number; vx: number; vy: number; cible: number | null; proie?: number | null; mordT?: number }

/** La simulation d'une zone : joueur, monstres, vagues, collisions.
 *  Aucune dépendance à Phaser ni au navigateur : elle tourne telle quelle dans les tests
 *  (et plus tard sur un serveur pour la coop). L'affichage lit l'état et vide `events`. */
export class World {
  readonly rng: Rng;
  readonly zone: ZoneDef;
  readonly map: GridMap;
  readonly player: Player;
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
  /** Événements produits depuis le dernier drainEvents(). */
  private events: SimEvent[] = [];
  /** Ressources à récolter du monde (métiers de récolte, 0.2b). */
  recoltes: Recolte[] = [];
  /** Ressource cliquée (le perso y va) et geste en cours (t = temps écoulé, hp = PV au début : un coup reçu l'interrompt). */
  versRecolte: number | null = null;
  /** Case libre où le perso va pour la ressource cliquée : arrivé là, il récolte même si la ressource est un peu plus loin que la portée. */
  private approche: { x: number; y: number } | null = null;
  enRecolte: { id: number; t: number; hp: number } | null = null;
  /** Postes des ateliers (Métiers UI 3A) : machines officielles qu'on clique pour ouvrir l'Artisanat. */
  postes: Poste[] = [];
  /** Poste cliqué (le perso y va) et case libre où il s'arrête devant. */
  versPoste: number | null = null;
  private approcheP: { x: number; y: number } | null = null;
  /** Fabrication en cours (5B : une barre d'une seconde pour toute la série ; un coup reçu ou un geste l'interrompt). */
  enFabrication: { recette: number; n: number; t: number; hp: number } | null = null;
  /** Télégraphes du dernier pas (recalculés à chaque pas). */
  telegraphs: Telegraph[] = [];
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
  private checkpoint = { x: 0, y: 0 };
  checkpointName = '';
  /** Sous-zone où se trouve le joueur (monde ouvert). */
  area: SubAreaDef | null = null;
  /** Intérieur où se trouve le joueur (maquette Entrées 5A) : nom de la porte qui y mène (« Taverne d'Astrub »), null dehors. */
  lieu: string | null = null;
  /** Arrivée protégée (maquette Entrées 13A) : après une porte, un Zaap ou un portail, les monstres de l'endroit attendent
   *  ton premier geste (au plus ARENE.protection s) ; le perso est intouchable pendant ce temps. */
  calme: { t: number; x: number; y: number } | null = null;
  /** Carte d'un intérieur -> son nom : la carte d'arrivée de chaque porte qui mène dedans (première porte trouvée). */
  readonly lieux = new Map<string, string>();
  /** Portes du monde ouvert : les deux bouts en coordonnées monde, et la carte de chacun. */
  portes: { nom: string; ends: [PorteEnd, PorteEnd]; verrou: boolean; sens: boolean; cle?: string; vers?: { zone: string; arrivee: [string, number] } }[] = [];
  /** Bout de porte par lequel le joueur vient d'arriver : inactif tant qu'il ne s'en est pas éloigné. */
  private portalLock: PorteEnd | null = null;
  /** Porte franchie : le joueur s'arrête devant pendant le fondu de sortie (PASSAGE s), puis arrive de l'autre côté. */
  passage: { to: PorteEnd; nom: string; t: number; vers?: { zone: string; arrivee: [string, number] } } | null = null;
  /** Durée du fondu de sortie d'une porte (choix 5A : 0,2 s pour sortir, 0,3 s pour entrer). */
  static readonly PASSAGE = 0.2;
  /** Distance (|dx| + |dy|) au-delà de laquelle un monstre qui attend ne bouge plus. */
  static readonly SOMMEIL = 2400;
  /** Quêtes et succès (monde ouvert avec quetes.json). */
  /** Partie de test : invincible, recharges, course, murs (null dans une vraie partie). */
  test: ReglagesTest | null = null;
  quetes: Quetes | null = null;
  /** Havre-Sac (maquette Hub 2A) : incantation en cours (t écoulé, PV au début : un coup reçu la coupe). */
  incantation: { t: number; hp: number } | null = null;
  static readonly INCANTATION = 1.5;
  /** Dans le Havre-Sac : d'où l'on vient. */
  retour: RetourHavreSac | null = null;
  /** Poutch Ingball du Havre-Sac (7A) : id du monstre. */
  poutch: number | null = null;
  /** Arène du donjon où l'on se bat (maquette « Donjons en vagues »), null ailleurs. */
  arene: Arene | null = null;   // au-delà de ce qu'on voit même dézoomé à fond (avant : monstres figés au bord de l'écran)

  constructor(readonly opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? 1);
    this.zone = opts.data.zones[opts.zone];
    if (!this.zone) throw new Error(`Zone inconnue : ${opts.zone}`);
    this.map = opts.map;
    this.test = opts.test ? { ...opts.test } : null;
    let start = this.map.nearestFree(GridMap.OFFSET_Y, GridMap.OFFSET_Y);
    const open = this.zone.open;
    if (open) {
      if (!(this.map instanceof WorldGrid)) throw new Error('Une zone en monde ouvert demande un WorldGrid');
      const m = this.map.mapByCoords(...open.start);
      if (!m) throw new Error(`Carte de départ absente du monde : ${open.start}`);
      // départ : la case la plus dégagée de la carte (le plus de cases marchables autour)
      start = this.openestCell(m.tag);
      this.checkpointName = open.checkpoints[0]?.name ?? '';
      // Havre-Sac : arrivée devant l'arche, qui sert aussi de point de retour
      // Bastion des Douze (maquette Ville) : arrivée sur la place, devant le Zaap
      const hub = open.havreSac ?? open.bastion;
      if (hub) { const wg = this.map; start = wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(m.tag, hub.arrivee))), wg.freeByMap.get(m.tag)!); this.checkpointName = open.havreSac ? 'Havre-Sac' : this.zone.name; }
    }
    this.checkpoint = start;
    this.player = new Player(this.nextId++, start.x, start.y, opts.data.classes[opts.classId ?? 'iop']);
    if (opts.items) {
      this.player.items = opts.items;
      this.equipByLevel = Object.entries(opts.items.equipment).filter(([, d]) => !d.familier).map(([id, d]) => ({ id, level: d.level }));
      for (const [id, d] of Object.entries(opts.items.equipment)) for (const m of d.familier?.monstres ?? []) (this.familiersDe[m] ??= []).push(id);
      // sac vide au départ (Mathis, 2026-11-06) : l'équipement vient du tutoriel (panoplie de l'Intrépide, Arc de Chasse du Crâ)
    }
    if (open) { this.buildPortes(); this.buildRecoltes(); this.buildPostes(); }
    if (open && opts.arrivee) this.arriver(opts.arrivee);
    if (open) this.sortieHavreSac(opts);
    // les PNJ d'abord : les groupes de monstres ne se posent pas sur eux
    if (open && opts.quetes) this.quetes = new Quetes(opts.quetes, this, opts.compte);
    // les quêtes d'abord : le tutoriel retient les groupes du Temple jusqu'à son étape « Frapper »
    if (this.quetes) { if (opts.reprise) this.quetes.reprendre(opts.reprise); else this.quetes.demarrer(); }
    if (open) this.spawnGroups();
    if (open?.havreSac?.poutch != null) this.poserPoutch(open.havreSac.poutch);
    if (open) this.visiter(opts.zonesVues ?? []);
    if (open && (opts.arrivee || opts.position || opts.zaap)) this.proteger();
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
  versZaap: string | null = null;
  /** Départ en cours (9A) : le changement de zone part à la fin. */
  zaapDepart: { t: number; e: SimEvent } | null = null;
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
    return !!wg && !po.vers && !!wg.mapByTag(po.ends[i].tag)?.inside && !wg.mapByTag(po.ends[1 - i].tag)?.inside;
  }
  private rayonPorte(po: World['portes'][number], i: number) { return this.estSortie(po, i) ? World.SORTIE_R : World.PORTE_R; }
  static readonly PORTE_ARRIVEE = 80;
  private buildPortes() {
    const wg = this.worldGrid!;
    // Donjons en arène (1B) : les portes des anciennes salles ne servent plus ; l'entrée mène droit à l'arène, sans retour (sortie = portail, 13A)
    const ancienne = new Map<string, DonjonDef>();
    for (const dj of this.zone.open!.donjons ?? []) if (dj.arene && wg.mapByTag(dj.arene.tag)) {
      // ses salles, et l'antichambre de même nom (grange_0, cache_0)
      const pref = new Set(Object.keys(dj.salles).map(t => t.replace(/\d+$/, '')));
      for (const m of wg.world.maps) if (m.inside && pref.has(m.tag.replace(/\d+$/, '')) && /\d$/.test(m.tag)) ancienne.set(m.tag, dj);
    }
    for (const d of this.zone.open!.portes ?? []) {
      const dj = ancienne.get(d.b[0]);
      if (ancienne.has(d.a[0])) continue;
      if (dj && !d.zone && wg.mapByTag(d.a[0])) {
        const q = wg.cellToWorld(wg.cellOf(d.a[0], d.a[1])), A = dj.arene!, B = wg.cellToWorld(A.arrivee);
        this.portes.push({ nom: d.nom, ends: [{ tag: d.a[0], ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(d.a[0])!) }, { tag: A.tag, ...B }], verrou: false, sens: true, cle: d.cle });
        if (!this.lieux.has(A.tag)) this.lieux.set(A.tag, dj.nom);
        continue;
      }
      if (d.zone) {   // portail vers une autre zone : un seul bout ici
        if (!wg.mapByTag(d.a[0])) continue;
        const q = wg.cellToWorld(wg.cellOf(d.a[0], d.a[1])), a = { tag: d.a[0], ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(d.a[0])!) };
        this.portes.push({ nom: d.nom, ends: [a, a], verrou: false, sens: true, vers: { zone: d.zone, arrivee: d.b } });
        continue;
      }
      if (!wg.mapByTag(d.a[0]) || !wg.mapByTag(d.b[0])) continue;   // intérieur pas (encore) exporté dans ce monde
      // la porte est souvent sur un mur : on la ramène sur la case marchable la plus proche de sa carte
      const end = ([tag, c]: [string, number]): PorteEnd => {
        const q = wg.cellToWorld(wg.cellOf(tag, c));
        return { tag, ...wg.nearestFree(q.x, q.y, wg.freeByMap.get(tag)!) };
      };
      this.portes.push({ nom: d.nom, ends: [end(d.a), end(d.b)], verrou: !!d.verrou, sens: !!d.sens, cle: d.cle });
      if (wg.mapByTag(d.b[0])?.inside && !this.lieux.has(d.b[0])) this.lieux.set(d.b[0], d.nom);
    }
  }
  /** Nom d'un endroit (carte) : l'intérieur, sinon la sous-zone. */
  private nomCarte(tag: string): string | null {
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
      if (i === 1 && po.sens) continue;
      const from = po.ends[i], to = po.ends[1 - i], d = Math.hypot(x - from.x, y - from.y);
      if (d > bd || d > this.rayonPorte(po, i)) continue;
      bd = d;
      const dedans = !!this.worldGrid.mapByTag(from.tag)?.inside;
      if (po.vers) { best = { x: from.x, y: from.y, nom: po.nom, sortie: false }; continue; }
      const versDedans = !!this.worldGrid.mapByTag(to.tag)?.inside, ici = this.nomCarte(from.tag), la = this.nomCarte(to.tag) ?? po.nom;
      best = { x: from.x, y: from.y, nom: versDedans && dedans && la === ici ? 'Salle suivante' : la, sortie: dedans && !versDedans };
    }
    return best;
  }
  /** Position du joueur à l'image d'avant (sens de la marche, maquette Entrées 4B). */
  private avant = { x: 0, y: 0 };
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
      if (!clic && !marche) continue;
      if (po.verrou && !this.salleVide(from.tag)) {
        this.portalLock = from;   // un seul message tant qu'il reste sur la porte
        this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Vaincs les monstres de la salle', color: '#ff9a5a' });
        return;
      }
      // entrée d'un donjon gardé (maquette Gardiens 5A) : la porte ouvre le dialogue du gardien, qui fait entrer (« Entrer »)
      const gardien = i === 0 && this.quetes?.gardienDe(po.nom);
      if (gardien && po === this.entreeDonjon(po.nom)) { p.stopMove(); if (!clic) this.portalLock = from; this.quetes!.parlerA(gardien); return; }
      if (i === 0 && !this.prendreCle(po)) { this.portalLock = from; return; }
      this.passer(po, to);
      return;
    }
  }
  /** Arche du Havre-Sac (2C) : cliquer dessus et s'en approcher ouvre la liste des Zaaps (une fois par clic). */
  private archeVue = false;
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
    this.player.stopMove();
    this.passage = { to, nom: po.nom, t: World.PASSAGE, vers: po.vers };
    this.emit({ k: 'portalStart', nom: po.nom });
  }
  /** Entrée d'un donjon : la clé officielle est prise en entrant (sans clé, la porte reste fermée). Vrai si on peut passer. */
  private prendreCle(po: World['portes'][number]): boolean {
    if (!po.cle) return true;
    const p = this.player, r = p.resources[po.cle] ?? 0;
    if (this.cleValable(po.nom)) return true;   // 14A : clé encore valable, rien n'est repris
    if (r <= 0) {
      this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `Il faut une ${this.opts.items?.resources[po.cle]?.name ?? 'clé'}`, color: '#ff9a5a' });
      this.emit({ k: 'cleManquante', id: po.cle });
      return false;
    }
    if (r === 1) delete p.resources[po.cle]; else p.resources[po.cle] = r - 1;
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
    return null;
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
    return !!d && !!tag && (tag in d.salles || tag === d.arene?.tag);
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
    const p = this.player, c = p.cleDonjon;
    if (c && (c.reste -= dt) <= 0) p.cleDonjon = null;
    const a = this.arene;
    if (!a) return;
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
    const po = this.entreeDonjon(d.nom);
    if (!po || this.passage) return;
    this.arene = null;
    this.player.stopMove();
    this.passage = { to: po.ends[0], nom: d.nom, t: World.PASSAGE };
    this.emit({ k: 'portalStart', nom: d.nom });
  }
  /** 13A : coffre du donjon à côté du portail : un second butin du boss, et une bourse de kamas. */
  coffreDonjon(d: DonjonDef, x: number, y: number) {
    const boss = this.bossDuDonjon(d.nom), M = this.opts.data.monsters;
    if (!boss) return;
    const niveau = M[boss].level ?? this.zone.level;
    this.lacherButin(boss, 'boss', niveau, x, y, 20 * niveau);
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
      if (d.arene && wg.mapByTag(d.arene.tag)) break;   // donjon en arène : les monstres arrivent par vagues
      const m = wg.mapByTag(tag);
      if (!m || !wg.freeByMap.get(tag)?.length) continue;
      const sub = open.subareas[String(m.sub)] ?? { name: d.nom, level: this.zone.level, monsters: [], groupsPerMap: 0, groupSize: [0, 0] };
      for (const fixe of groupes) {
        const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, fixe, donjon: d.nom, point: -1 };
        this.groups.push(g);
        this.spawnGroup(g);
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
    return proposerPlacement(this.worldGrid!, tag, groupes ?? sub?.groupsPerMap ?? 0, this.analyseCarte(tag));
  }
  /** Placement en vigueur sur une carte (null : pas de groupes ici). */
  placementDe(tag: string): PlacementCarte | null { return this.placements.get(tag) ?? null; }
  /** Vrai si le placement de la carte a été posé à la main. */
  placementPoseMain(tag: string): boolean { return !!(this.opts.placements?.[tag] ?? placementPose(this.zone.open!.world, tag)); }
  /** Cartes de la zone qui ont des groupes de monstres, dans l'ordre du monde. */
  cartesAGroupes(): string[] { return (this.worldGrid?.world.maps ?? []).filter(m => this.sousZoneGroupes(m.tag)).map(m => m.tag); }
  private poserGroupes(tag: string, sub: SubAreaDef) {
    const pose = this.opts.placements?.[tag] ?? placementPose(this.zone.open!.world, tag);
    const pl = pose ? placementValide(pose) : this.propositionAuto(tag, sub.groupsPerMap);
    this.placements.set(tag, pl);
    for (let i = 0; i < pl.g; i++) {
      const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, point: -1 };
      this.groups.push(g);
      if (this.groupesPrets(g)) this.spawnGroup(g);
      else g.cleared = true;   // tutoriel : apparaîtra à l'étape voulue (updateOpen)
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
  /** 5B : point libre où le groupe se pose (aucun autre groupe en vie dessus), loin du joueur si possible. */
  private choisirPoint(g: MonsterGroup, pl: PlacementCarte): number {
    const wg = this.worldGrid!, p = this.player;
    const pris = new Set(this.groups.filter(o => o !== g && o.map === g.map && !o.retire && !o.cleared && o.point >= 0).map(o => o.point));
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
    const [a, b] = (!g.fixe && this.quetes?.tailleGroupe(this.worldGrid!.mapByTag(g.map)?.sub ?? -1)) || pt?.n || g.sub.groupSize, n = g.fixe ? g.fixe.length : a + this.rng.int(b - a + 1);
    const a0 = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      // en cercle autour du chef, chacun sa place (plus de tas de monstres les uns sur les autres)
      const ang = a0 + (i / Math.max(1, n - 1)) * Math.PI * 2 + this.rng.range(-0.3, 0.3), r = i === 0 ? 0 : this.rng.range(90, 150);
      let q = wg.nearestFree(pos.x + Math.cos(ang) * r, pos.y + Math.sin(ang) * r, free);
      // jamais collé à un PNJ : on tourne autour du point jusqu'à trouver une place à plus de 260 px de lui
      const prochePnj = (z: { x: number; y: number }) => this.quetes?.pnjs.some(o => Math.hypot(o.x - z.x, o.y - z.y) < 260);
      for (let t = 1; t < 8 && i > 0 && prochePnj(q); t++) q = wg.nearestFree(pos.x + Math.cos(ang + t * 0.8) * r, pos.y + Math.sin(ang + t * 0.8) * r, free);
      // l'élite unique de la sous-zone mène parfois un groupe (souvent sur son repaire, 4D), s'il n'est pas déjà en vie ailleurs
      const elite = !g.fixe && i === 0 && g.sub.elite && this.rng.next() < (pt?.r ? PLACEMENT.elite.repaire : PLACEMENT.elite.hasard) && !this.monsters.some(o => !o.dead && o.type === g.sub.elite);
      const mo = this.spawnMonster(g.fixe ? g.fixe[i] : elite ? g.sub.elite! : this.rng.pick(g.sub.monsters), q.x, q.y);
      mo.group = g.id; g.members.push(mo);
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
  private updateOpen(dt: number) {
    const p = this.player, open = this.zone.open!;
    this.updatePortes(dt);
    // 13A : le calme d'arrivée cesse au premier geste (sort, bond, quelques pas) ou au bout du temps
    if (this.calme) {
      const c = this.calme, p = this.player;
      if ((c.t -= dt) <= 0 || p.state !== 'free' || Math.hypot(p.x - c.x, p.y - c.y) > 60) this.calme = null;
    }
    this.updateArene(dt);
    this.updateCommande(dt);
    for (const g of this.groups) {
      if (g.retire || g.members.some(m => !m.dead)) continue;
      if (!g.cleared) {
        g.cleared = true; g.timer = open.respawn;
        p.potions = Math.min(p.cls.potion.charges, p.potions + 1);   // un groupe vaincu rend une potion
        this.emit({ k: 'groupCleared' });
      }
      // tutoriel : les esprits du Temple reviennent vite, même pas loin (de quoi finir chaque étape sans attendre)
      const tuto = !g.fixe && !!this.quetes?.tailleGroupe(this.worldGrid!.mapByTag(g.map)?.sub ?? -1);
      g.timer -= tuto ? dt * 4 : dt;
      // Réapparition hors de la vue du joueur
      if (g.timer <= 0 && Math.hypot(g.x - p.x, g.y - p.y) > (tuto ? 500 : 900) && !(g.donjon && this.dansDonjon(g.donjon)) && this.groupesPrets(g)) this.spawnGroup(g);
    }
    const m = this.worldGrid!.mapAt(p.x, p.y), sub = m ? open.subareas[String(m.sub)] ?? null : null;
    if (sub && sub !== this.area) { this.area = sub; this.emit({ k: 'enterArea', name: sub.name, level: sub.level }); }
    // intérieur (5A) : bandeau à son nom, sauf s'il porte le nom de la sous-zone (le bandeau de la sous-zone suffit)
    const lieu = m?.inside ? this.lieux.get(m.tag) ?? null : null;
    if (lieu !== this.lieu) {
      this.lieu = lieu;
      if (lieu && lieu !== sub?.name) this.emit({ k: 'enterLieu', name: lieu, region: sub?.name ?? this.zone.name, level: sub?.level ?? 0 });
    }
    // Zaap atteint : il devient le point de retour
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
  respawnPlayer() {
    const p = this.player;
    if (!this.zone.open || !p.dead) return;
    if (this.arene) { this.arene.abandonner(); this.arene = null; }
    p.dead = false; p.hp = p.maxHp; p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0;
    p.state = 'free'; p.skill = null; p.invuln = 2; p.rage = 0; p.setAnim('idle');
    this.over = false;
    this.emit({ k: 'respawn' });
  }

  emit(e: SimEvent) { this.events.push(e); this.quetes?.observer(e); }
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  walkable(x: number, y: number) { return this.map.walkable(x, y); }
  /** Chemin à pied (A* sur les cases de Dofus) vers un point. */
  findPath(from: { x: number; y: number }, to: { x: number; y: number }) { return this.test?.murs && from === this.player ? [{ x: to.x, y: to.y }] : this.map.findPath(from, to); }
  /** Partie de test (8A) : recharges, PA et PM pleins. */
  private rechargerTout() {
    const p = this.player;
    for (const k of Object.keys(p.cd)) p.cd[k] = 0;
    p.casts = {};   // charges pleines
    p.pa = p.paMax; p.pm = p.pmMax; p.potionCd = 0;
  }
  /** Ligne de tir sans obstacle (cases marchables) entre deux points. */
  clearShot(from: { x: number; y: number }, to: { x: number; y: number }) { return this.map.clearLine(from, to); }

  /** Avance la simulation de dt secondes. */
  step(dt: number, input: PlayerInput) {
    this.time += dt;
    this.telegraphs.length = 0;
    const p = this.player;
    if (this.test) {
      for (const c of input.test ?? []) appliquerTest(this, c);
      p.vitesseTest = this.test.course ? 3 : 1;
      if (this.test.recharges) this.rechargerTout();
    }
    const ents = [p, ...this.monsters, ...this.betes], prev = ents.map(e => [e.x, e.y] as const);
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
    if (input.meute != null && this.monsters.some(m => m.id === input.meute && !m.dead)) this.cibleMeute = input.meute;
    if (input.zaap != null) this.voyagerZaap(input.zaap);
    if (input.versZaap) this.versZaap = input.versZaap;
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.recolte != null || input.atelier != null || input.move.x || input.move.y) this.versZaap = null;
    if (this.quetes) {
      if (input.reponse != null) this.quetes.repondre(input.reponse);
      if (input.talk) this.quetes.cliquer(input.talk);
      else if (input.dest || input.target != null || input.pickup != null) this.quetes.annulerClic();
    }
    p.update(dt, this.passage || this.zaapDepart ? { ...NO_INPUT, aim: input.aim } : input, this);   // devant une porte ou un Zaap : le perso attend le fondu
    if (this.test?.recharges) this.rechargerTout();
    // Monde ouvert : un monstre qui attend loin du joueur dort (pas d'errance ni d'IA) : bien moins de calcul
    for (const m of this.monsters) {
      if (this.zone.open && m.state === 'idle' && !m.dead && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > World.SOMMEIL) { m.regenCalme(dt); continue; }
      m.update(dt, this.cibleDe(m), this);
    }
    for (const b of this.betes) b.update(dt, this);
    this.betes = this.betes.filter(b => !(b.dead && b.t <= 0));
    if (this.zone.open && !p.dead && (this.appelT -= dt) <= 0) { this.appelT = AGGRO.appelAide.periode; this.appelAide(); }
    const M = AGGRO.massacre;
    if (this.massacre.n >= M.min && this.time - this.massacre.t > M.fenetre) { this.emit({ k: 'massacreFin', n: this.massacre.n }); this.massacre.n = 0; }
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.separate();
    // Cases bloquantes : on glisse le long des obstacles (axe par axe), sauf en plein Bond
    ents.forEach((e, i) => {
      if (e === p && (p.airborne || this.test?.murs)) return;
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
    this.updateAteliers(dt);
    if (this.zone.open) { this.updateOpen(dt); this.updateRecoltes(dt); this.updateIncantation(dt); this.updateArche(); this.updateZaap(dt); this.quetes?.update(dt); return; }
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
    const m = new Monster(this.nextId++, type, def, x, y, this);
    this.monsters.push(m);
    return m;
  }

  // --- Flèches ---------------------------------------------------------------
  shoot(x: number, y: number, facing: number, hz: Extract<HitZone, { shape: 'projectile' }>, hit: HitDef, stun: number, area: number, spell: string) {
    this.projectiles.push({ id: this.nextId++, spell, x, y, dx: Math.cos(facing), dy: Math.sin(facing), left: hz.range + this.player.stat('portee') * CASE, speed: hz.speed,
      width: hz.width, explode: (hz.explode ?? 0) * area, pierce: !!hz.pierce, hit, stun, touched: new Set(), fleche: hz.fleche || undefined });
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
        p.subis = e.n / 100; p.subisT = Math.max(1, e.dur) * TOUR;
        this.emit({ k: 'status', x: p.x, y: p.y, text: `Dommages subis ${e.n > 100 ? '+' : ''}${e.n - 100} %`, color: '#e07cf0' });
      }
      else if (e.k === 'desenvoute') {   // Rinçage : bonus et bouclier raccourcis de n tours
        for (const md of p.mods) md.t -= e.n * TOUR;
        p.mods = p.mods.filter(md => md.t > 0);
        if (p.shieldT > 0) { p.shieldT -= e.n * TOUR; if (p.shieldT <= 0) { p.shieldT = 0; p.shield = 0; } }
        this.emit({ k: 'status', x: p.x, y: p.y, text: 'Désenvoûté', color: '#9ad0ff' });
      }
      else if (e.k === 'etat' && Math.hypot(p.x - m.x, p.y - m.y) <= (e.r + 0.5) * CASE + p.radius) {   // Hyperleukocytine : Pacifiste
        p.pacifiste = Math.max(p.pacifiste, Math.max(1, e.dur) * TOUR);
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
        const p = this.player;
        if (!this.walkable(pr.x, pr.y)) pr.left = 0;   // arrêté par le décor
        else {
          const c: Cible | undefined = [p, ...this.betes].find(q => !q.dead && Math.hypot(q.x - pr.x, q.y - pr.y) <= q.radius + pr.width);
          if (c) {
            if (pr.from) this.monsterSpellHits(pr.from.monster, pr.from.spell, c);
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
      if (target) {
        if (pr.explode) { this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun); end = true; }
        else {
          pr.touched.add(target.id);
          this.applyHits(m => m === target, pr.hit, pr.x - pr.dx * 10, pr.y - pr.dy * 10, pr.stun, Math.atan2(pr.dy, pr.dx));
          if (!pr.pierce) end = true;
        }
        this.emit({ k: 'impact', hitstop: 0.03, shake: pr.explode ? 0.008 : 0.003, big: false });
      } else if (end && pr.explode) this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun);
      if (end) {
        pr.left = 0;
        if (pr.fleche) continue;   // la flèche se plante ou disparaît dans le monstre : pas d'explosion
        this.emit({ k: 'spell', fx: 'burst', id: pr.spell, x: pr.x, y: pr.y, facing: Math.atan2(pr.dy, pr.dx), size: pr.explode || 26, arc: 0,
          element: pr.hit.element ?? 'neutre', big: pr.explode > 0, boosted: false });
      }
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0);
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
  private applyHits(test: (m: Monster) => boolean, def: HitDef, ox: number, oy: number, stun: number, pushDir?: number): number {
    const p = this.player, cls = p.cls;
    let n = 0;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || !test(m)) continue;
      if (p.pacifiste > 0) { this.emit({ k: 'status', x: m.x, y: m.y - 20, text: 'Pacifiste', color: '#c8c8c8' }); return 0; }   // Hyperleukocytine : aucun dommage
      if (m.intouchable) { if (this.time - this.intouchableT > 0.6) { this.intouchableT = this.time; this.emit({ k: 'status', x: m.x, y: m.y - 30, text: 'Intouchable', color: '#c8c8c8' }); } continue; }
      n++; this.cibleMeute = m.id;
      const crit = this.rng.next() < p.critChance;
      // Choix 19A : résistances officielles du monstre dans l'élément du coup (plafonnées à 50 %, comme Dofus)
      const el = p.resolveElement(def.element ?? 'neutre'), res = Math.min(50, m.def.res?.[el] ?? 0);
      // Initiative : le premier coup porté à un monstre est renforcé ; Dommages Critiques et Dommages Poussée s'ajoutent au coup
      const first = m.struck ? 1 : 1 + initiativeBonus(p.initiative); m.struck = true;
      const flat = (crit ? p.stat('dommagesCritiques') : 0) + (def.knock > 0 ? p.stat('dommagesPoussee') : 0);
      const vs = def.vsSummon && (m.summoner || (def.vsElite && (m.def.elite || m.def.boss))) ? def.vsSummon : 1;
      const vu = (m.vulnT > 0 ? 1 + m.vuln / 100 : 1) * m.subis;   // dommages subis augmentés (Bond) ou réduits (Cuirasse Laineuse)
      const dmg = Math.max(1, Math.round((p.damage(def.dmg * vs, def.element ?? 'neutre') * this.rng.range(0.9, 1.1) * (crit ? cls.critMult : 1) * first + flat) * (1 - res / 100) * vu));
      m.hp -= dmg; m.flash = 0.09; m.calmeT = 0;
      if (m.state === 'idle' || m.state === 'return') this.aggroGroup(m);   // 3A + 4A : un coup, même de loin, réveille tout son groupe
      if (def.erosion) { m.maxHp = Math.max(1, m.maxHp - Math.round(dmg * def.erosion)); m.hp = Math.min(m.hp, m.maxHp); }
      // Retrait PA / PM du joueur contre l'Esquive officielle du monstre : chaque point a sa chance de passer
      const pm = this.removed(def.pmLoss ?? 0, p.retrait('PM'), m.def.caracs?.esquivePM ?? 0);
      const pa = this.removed(def.paLoss ?? 0, p.retrait('PA'), m.def.caracs?.esquivePA ?? 0);
      if (pm) { m.haste = Math.min(m.haste, Math.max(0.3, 1 - 0.15 * pm)); m.hasteT = Math.max(m.hasteT, TOUR);
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${pm} PM`, color: '#9ad15a' }); }
      if (pa) { m.atkCd = Math.max(m.atkCd, 0) + 0.4 * pa;
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${pa} PA`, color: '#5aa8ff' }); }
      if (def.poLoss) { m.poMalus = Math.max(m.poMalus, def.poLoss); m.poMalusT = TOUR;   // retrait de Portée : ne s'esquive pas
        this.emit({ k: 'status', x: m.x, y: m.y, text: `-${def.poLoss} PO`, color: '#c8a0ff' }); }
      if ((def.pmLoss && !pm) || (def.paLoss && !pa)) this.emit({ k: 'status', x: m.x, y: m.y, text: 'Esquive', color: '#c8c8c8' });
      const a = pushDir ?? Math.atan2(m.y - oy, m.x - ox);
      const kb = def.knock / m.def.mass;
      m.kx += Math.cos(a) * kb; m.ky += Math.sin(a) * kb;
      if (def.pushDmg && kb > 0) this.pushDamage(m, a, kb / 7.13);
      if (!m.def.boss) m.stun = Math.max(m.stun, stun || 0.12);   // petit vacillement : interrompt les télégraphes
      else if (stun) m.stun = Math.max(m.stun, stun * 0.3);
      this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit, element: el, eclat: def.eclat });
      if (n <= 3) p.rageOnHit(Math.hypot(m.x - p.x, m.y - p.y), this);
      if (def.lifesteal) p.hp = Math.min(p.maxHp, p.hp + Math.round(dmg * def.lifesteal));   // la Rage monte avec les coups portés (3 cibles max par coup)
      if (m.hp <= 0) this.killMonster(m);
    }
    return n;
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
  private pushDamage(m: Monster, a: number, dist: number) {
    if (m.intouchable) return;
    const c = Math.cos(a), s = Math.sin(a), step = 8;
    let t = 0;
    for (; t < dist; t += step) {
      const x = m.x + c * (t + m.radius), y = m.y + s * (t + m.radius);
      if (!this.walkable(x, y) || this.monsters.some(o => o !== m && !o.dead && Math.hypot(o.x - x, o.y - y) < o.radius)) break;
    }
    const left = (dist - t) / CASE;
    if (left <= 0.25) return;
    const p = this.player, dmg = Math.max(1, Math.round((p.level / 2 + p.stat('dommagesPoussee') + 32) * left / 4));
    m.hp -= dmg; m.flash = 0.09; m.calmeT = 0;
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 30, amount: dmg, crit: false });
    this.emit({ k: 'status', x: m.x, y: m.y - 20, text: 'Choc !', color: '#f2d36b' });
  }
  /** Points de PA / PM réellement retirés : chacun passe selon Retrait contre Esquive. */
  private removed(n: number, retrait: number, esquive: number): number {
    let k = 0;
    for (let i = 0; i < n; i++) if (this.rng.next() < removalChance(retrait, esquive)) k++;
    return k;
  }
  killMonster(m: Monster) {
    if (m.mannequin) { m.hp = m.maxHp; return; }   // partie de test (7D) : le mannequin ne meurt pas
    m.dead = true; m.t = 0.6; this.kills++;
    this.quetes?.eliteVaincu(m.id);
    for (const s of this.monsters) if (s.summoner === m && !s.dead) this.killMonster(s);   // ses invocations disparaissent avec lui
    if (m.summoner) { this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type }); return; }
    this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type });
    const p = this.player;
    p.soigner(p.cls.healOnKill + p.legendary('vampire'));
    this.dropLoot(m);
    const xp = p.gainXp(Math.round((m.def.xp ?? Math.round(m.def.hp / 5)) * this.bonusMassacre()), this);
    if (xp > 0) this.emit({ k: 'xp', x: m.x, y: m.y, z: m.radius * 2 + 30, n: xp });
    this.xpFamilier(FAMILIER_XP.chasse(this.monsterLevel(m), !!m.def.elite, !!m.def.boss));
    if (m.def.boss) { this.emit({ k: 'impact', hitstop: 0.15, shake: 0.02, big: true }); this.emit({ k: 'bossDown', monster: m.type }); }
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
  monsterLevel(m: Monster): number {
    const wg = this.worldGrid, open = this.zone.open;
    const sub = wg && open ? open.subareas[String(wg.mapAt(m.homeX, m.homeY)?.sub)] : undefined;
    return sub?.level ?? this.zone.level;
  }
  /** Ce que le calcul du butin doit savoir (src/sim/butin.ts) : sert au jeu, au Bestiaire et au simulateur de l'outil de test. */
  contexteButin(type: string, rang: Rang, niveau: number): CtxButin {
    const p = this.player;
    return { type, rang, niveau, prospection: p.prospection, items: this.opts.items!, familiers: this.familiersDe[type] ?? [], pool: this.equipByLevel,
      metierNiveau: j => p.metierLevel(j), armeChasse: !!p.huntingWeapon, sortsRecharge: p.sortsRecharge };
  }
  /** Un monstre vaincu lâche son butin officiel (ressources, parfois un équipement) et, plus rarement, un équipement
   *  de son niveau pris dans tous les objets de Dofus. Élites et boss lâchent plus et mieux. Calcul : src/sim/butin.ts. */
  private dropLoot(m: Monster) { this.lacherButin(m.type, rangDe(m.def), this.monsterLevel(m), m.x, m.y); }
  private lacherButin(type: string, rang: Rang, niveau: number, mx: number, my: number, kamas = 0) {
    const I = this.opts.items;
    if (!I) return;
    const m = { x: mx, y: my };
    const p = this.player, b = tirerButin(this.rng, this.contexteButin(type, rang, niveau), () => this.nextId++);
    b.kamas += kamas;
    for (const r of b.ressources) {   // ressource : directement dans le sac ; une viande fait monter le Chasseur (choix 6A)
      if (r.job) p.gainMetierXp(r.job, METIER_XP.viande, this);
      p.resources[r.id] = (p.resources[r.id] ?? 0) + 1;
      this.emit({ k: 'lootResource', id: r.id, n: 1 });
    }
    const out: Omit<Drop, 'x' | 'y' | 't' | 'uid'>[] = b.objets.map(item => ({ item }));
    if (b.kamas) out.push({ kamas: b.kamas });
    out.forEach((o, i) => {
      const a = (i / Math.max(1, out.length)) * Math.PI * 2 + this.rng.range(0, 1), r = out.length > 1 ? 34 : 0;
      let x = m.x + Math.cos(a) * r, y = m.y + Math.sin(a) * r;
      if (!this.walkable(x, y)) { x = m.x; y = m.y; }
      this.drops.push({ ...o, uid: this.nextId++, x, y, t: 0 });
      if (o.item) this.emit({ k: 'itemDrop', x, y, rarity: o.item.rarity });
    });
  }
  /** Rareté minimale affichée et ramassable selon le filtre du joueur (0 Commun, 1 Rare, 2 Épique). */
  shown(d: Drop): boolean { return !d.item || RARITIES.indexOf(d.item.rarity) >= this.player.lootFilter; }
  /** Aspiré quand on passe près (kamas et Communs) ou ramassé d'un clic (le reste). */
  static magnetic(d: Drop): boolean { return !d.item || d.item.rarity === 'commun'; }
  private updateDrops(dt: number) {
    const p = this.player, f = this.updateFamilier(dt);
    for (const d of this.drops) {
      d.t += dt;
      if (p.dead || d.t < 0.5 || !this.shown(d)) continue;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (d.familier) { if (f) f.cible = null; }   // rapporté par le familier
      else if (World.magnetic(d)) {
        if (dist > 130) continue;
        if (dist > 26) { const s = Math.min(dist, 520 * dt); d.x += (p.x - d.x) / dist * s; d.y += (p.y - d.y) / dist * s; continue; }
      } else if (p.pickupId !== d.uid || dist > 44) continue;
      if (d.item) {
        if (p.pickupId === d.uid) p.pickupId = null;
        const def = this.opts.items?.equipment[d.item.id];
        if (p.autoBrisage && d.item.rarity === 'commun' && def && !def.familier) {   // 5B : brisé dès le ramassage, ses runes vont au sac
          const g = briser(this.rng, def, d.item);
          for (const [id, n] of Object.entries(g)) p.resources[id] = (p.resources[id] ?? 0) + n;
          this.collectionner(d.item.id);
          this.emit({ k: 'brisage', n: 1, runes: g, auto: d.item.id });
          d.t = -1; continue;
        }
        if (p.bag.length >= Player.BAG_SIZE) { if (!d.warned) this.emit({ k: 'bagFull' }); d.warned = true; d.familier = false; continue; }   // sac plein : l'objet reste au sol
        p.bag.push(d.item);
        this.emit({ k: 'loot', item: d.item });
      } else if (d.kamas) {
        p.kamas += d.kamas;
        this.emit({ k: 'lootKamas', n: d.kamas });
      }
      d.t = -1;
    }
    if (p.pickupId != null && !this.drops.some(d => d.uid === p.pickupId && d.t >= 0)) p.pickupId = null;
    // ramassé, ou oublié au sol depuis 3 minutes
    this.drops = this.drops.filter(d => d.t >= 0 && d.t < 180);
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
      let best = World.FAMILIER_RAYON;
      for (const d of this.drops) {
        if (d.t < 0.5 || d.familier || !this.shown(d) || (d.item && p.bag.length >= Player.BAG_SIZE)) continue;
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
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit: false, element: el });
    if (m.hp <= 0) this.killMonster(m);
  }
  /** XP pour le familier porté (2C) ; ses bonus suivent son niveau. */
  xpFamilier(n: number) {
    const p = this.player, it = p.equipment.familier, def = it && this.opts.items?.equipment[it.id]?.familier;
    if (!it || !def || n <= 0 || (it.niv ?? 1) >= FAMILIER_MAX) return;
    it.xpF = (it.xpF ?? 0) + Math.round(n);
    const avant = it.niv ?? 1, niv = familierNiveau(it.xpF, this.opts.familierXp ?? []);
    if (niv === avant) return;
    it.niv = niv; it.stats = familierStats(def, niv); p.recompute();
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
    } else {
      const r = I.resources[quoi.res], n = p.resources[quoi.res] ?? 0;
      if (!r || !n || r.pepite || r.cle) return false;
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
  private updateRecoltes(dt: number) {
    for (const r of this.recoltes) if (r.repousse > 0 && (r.repousse -= dt) <= 0) {
      r.repousse = 0; r.dore = this.rng.next() < (this.eliteSur(r.tag) ? RECOLTE.doreElite : RECOLTE.dore);
    }
    const p = this.player, R = this.opts.recoltes;
    if (!R || p.dead) { this.versRecolte = null; this.enRecolte = null; return; }
    if (this.enRecolte) {
      const g = this.enRecolte, r = this.recoltes.find(x => x.id === g.id);
      if (!r || r.repousse > 0 || p.hp < g.hp) { this.enRecolte = null; this.emit({ k: 'recolteStop' }); return; }
      p.stopMove(); g.t += dt;
      // Maquette Armes 9A : le perso joue l'animation officielle du métier (faucher, couper, piocher, cueillir, pêcher)
      const geste = R.ressources[r.item]?.anim;
      if (geste) p.setAnim(`r_${geste}`, g.t / RECOLTE.duree);
      if (g.t < RECOLTE.duree) return;
      this.enRecolte = null;
      const def = R.ressources[r.item], lv = Math.max(1, p.metierLevel(def.metier));
      const n = quantite(this.rng, lv, def.niveau, r.dore);
      p.resources[r.item] = (p.resources[r.item] ?? 0) + n;
      if (def.metier) p.gainMetierXp(def.metier, xpRecolte(def.niveau, r.dore), this);   // puits : sans métier, sans XP
      this.emit({ k: 'recolteFin', id: r.id, item: r.item, n, dore: r.dore });
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
    this.emit({ k: 'recolteDebut', id: r.id, duree: RECOLTE.duree });
  }

  // --- Emp, le Méryde du Recyclage (maquette 0.2, 8A+8B+8C, 9A+9B) ---------------------------------------------
  /** Collection d'apparences (1C) : le premier exemplaire brisé ou recyclé d'une coiffe, cape ou bouclier débloque son apparence. */
  private collectionner(id: string) {
    const p = this.player;
    if (!this.opts.apparats?.objets[id]?.collection || p.apparats.includes(id)) return;
    p.apparats.push(id);
    this.emit({ k: 'apparence', id });
  }
  private pepites(n: number) { const p = this.player; p.resources[PEPITE] = (p.resources[PEPITE] ?? 0) + n; }
  /** Recycle un objet du sac contre des Pépites (un objet sous cadenas n'est jamais recyclé). */
  recycle(uid: number): boolean {
    const p = this.player, i = p.bag.findIndex(b => b.uid === uid), d = i >= 0 && this.opts.items?.equipment[p.bag[i].id];
    if (i < 0 || p.bag[i].cadenas) return false;
    const n = d ? recycleValue(d, p.bag[i]) : 1;
    this.collectionner(p.bag[i].id);
    p.bag.splice(i, 1); this.pepites(n);
    this.emit({ k: 'recycle', n: 1, pepites: n });
    return true;
  }
  /** Recyclage en lot (8B) : tous les objets du sac jusqu'à cette rareté comprise, sauf ceux sous cadenas. */
  recycleLot(jusqua: Rarity): number {
    const p = this.player, max = RARITIES.indexOf(jusqua), I = this.opts.items;
    let n = 0, pep = 0;
    p.bag = p.bag.filter(it => {
      if (it.cadenas || RARITIES.indexOf(it.rarity) > max) return true;
      const d = I?.equipment[it.id]; n++; pep += d ? recycleValue(d, it) : 1; this.collectionner(it.id); return false;
    });
    if (n) { this.pepites(pep); this.emit({ k: 'recycle', n, pepites: pep }); }
    return n;
  }
  /** Pépites que rendrait recycleLot (aperçu dans la fenêtre d'Emp). */
  apercuLot(jusqua: Rarity): { n: number; pepites: number } {
    const max = RARITIES.indexOf(jusqua), I = this.opts.items;
    const l = this.player.bag.filter(it => !it.cadenas && RARITIES.indexOf(it.rarity) <= max);
    return { n: l.length, pepites: l.reduce((a, it) => a + (I?.equipment[it.id] ? recycleValue(I.equipment[it.id], it) : 1), 0) };
  }
  /** Recycle toute une pile de ressources (pas les Pépites, ni les clés, ni ce qui se mange). */
  recycleRessource(id: string): boolean {
    const p = this.player, r = this.opts.items?.resources[id], q = p.resources[id] ?? 0;
    if (!r || q <= 0 || r.pepite || r.cle || r.soin || r.rappel) return false;
    const n = recycleResource(r) * q;
    delete p.resources[id]; this.pepites(n);
    this.emit({ k: 'recycle', n: q, pepites: n });
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
    this.emit({ k: 'forge', uid, rune, issue: r.issue, stat: r.stat, gain: r.gain, pertes: r.pertes, kamas, exo: it.exo === r.stat });
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
  /** 8A (Concasseur) : brise d'un coup les objets choisis (jamais un objet sous cadenas). */
  briserChoix(uids: number[]): number {
    const p = this.player, I = this.opts.items, tout: Record<string, number> = {};
    let n = 0;
    p.bag = p.bag.filter(it => {
      const def = I?.equipment[it.id];
      if (!uids.includes(it.uid) || !def || def.familier || it.cadenas) return true;
      for (const [id, k] of Object.entries(briser(this.rng, def, it))) tout[id] = (tout[id] ?? 0) + k;
      this.collectionner(it.id); n++; return false;
    });
    for (const [id, k] of Object.entries(tout)) p.resources[id] = (p.resources[id] ?? 0) + k;
    if (n) this.emit({ k: 'brisage', n, runes: tout });
    return n;
  }
  /** Brise un objet du sac en runes (7A+7B, chez le forgemage : 11B). Jamais un objet sous cadenas. */
  briserObjet(uid: number): boolean {
    const p = this.player, i = p.bag.findIndex(b => b.uid === uid), it = i >= 0 ? p.bag[i] : null, def = it && this.opts.items?.equipment[it.id];
    if (!it || !def || it.cadenas || def.familier) return false;
    const g = briser(this.rng, def, it);
    p.bag.splice(i, 1); this.collectionner(it.id);
    for (const [id, n] of Object.entries(g)) p.resources[id] = (p.resources[id] ?? 0) + n;
    this.emit({ k: 'brisage', n: 1, runes: g });
    return true;
  }
  /** Brisage en lot : tous les objets du sac jusqu'à cette rareté comprise, sauf ceux sous cadenas. */
  briserLot(jusqua: Rarity): number {
    const p = this.player, max = RARITIES.indexOf(jusqua), I = this.opts.items, tout: Record<string, number> = {};
    let n = 0;
    p.bag = p.bag.filter(it => {
      const def = I?.equipment[it.id];
      if (!def || def.familier || it.cadenas || RARITIES.indexOf(it.rarity) > max) return true;
      for (const [id, k] of Object.entries(briser(this.rng, def, it))) tout[id] = (tout[id] ?? 0) + k;
      this.collectionner(it.id); n++; return false;
    });
    for (const [id, k] of Object.entries(tout)) p.resources[id] = (p.resources[id] ?? 0) + k;
    if (n) this.emit({ k: 'brisage', n, runes: tout });
    return n;
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
  /** Achat dans une boutique (src/data/boutique.json), payé en Pépites. */
  acheter(boutique: string, id: string): boolean {
    const a = this.opts.boutiques?.[boutique]?.find(x => x.id === id), p = this.player;
    if (!a || (p.resources[PEPITE] ?? 0) < a.prix) return false;
    p.resources[PEPITE] -= a.prix; if (!p.resources[PEPITE]) delete p.resources[PEPITE];
    p.resources[id] = (p.resources[id] ?? 0) + 1;
    this.emit({ k: 'achat', id, prix: a.prix });
    return true;
  }
  /** Achat d'un objet d'apparat chez Emp (Apparence 5A) : il rejoint la collection du perso, une fois pour toutes. */
  acheterApparat(id: string): boolean {
    const d = this.opts.apparats?.objets[id], prix = d && this.opts.apparats!.prix[d.slot], p = this.player;
    if (!d || d.collection || prix == null || p.apparats.includes(id) || (p.resources[PEPITE] ?? 0) < prix) return false;
    p.resources[PEPITE] -= prix; if (!p.resources[PEPITE]) delete p.resources[PEPITE];
    p.apparats.push(id);
    this.emit({ k: 'achat', id, prix });
    return true;
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
  craftMax(i: number): number {
    const r = this.opts.items?.recipes?.[i], p = this.player;
    if (!r || Math.max(1, p.metierLevel(r.metier)) < r.level) return 0;
    return Math.min(...r.ingredients.map(([id, q]) => Math.floor((p.resources[id] ?? 0) / q)));
  }
  /** Postes des ateliers : les machines officielles (ateliers_postes.py), sinon un poste au milieu de la première carte. */
  private buildPostes() {
    const wg = this.worldGrid, A = this.zone.open?.ateliers;
    if (!wg || !A) return;
    for (const a of A) {
      const l = (a.postes ?? []).filter(([tag]) => wg.mapByTag(tag));
      for (const [tag, cell, gfx, dx, dy] of l) {
        const q = wg.cellToWorld(wg.cellOf(tag, cell));
        this.postes.push({ id: this.nextId++, atelier: a.nom, metiers: a.metiers, tag, x: q.x, y: q.y, gfx, dessin: dx || dy ? { x: dx, y: dy } : undefined });
      }
      const tag = a.cartes.find(t => wg.mapByTag(t) && wg.freeByMap.get(t)?.length);
      if (!l.length && tag) { const q = this.openestCell(tag); this.postes.push({ id: this.nextId++, atelier: a.nom, metiers: a.metiers, tag, x: q.x, y: q.y }); }
    }
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
      this.craft(f.recette, f.n);
      return;
    }
    if (this.versPoste == null) return;
    const po = this.postes.find(x => x.id === this.versPoste);
    if (!po || p.dead) { this.versPoste = null; return; }
    const arrive = this.approcheP && Math.hypot(this.approcheP.x - p.x, this.approcheP.y - p.y) < 24;
    if ((Math.hypot(po.x - p.x, po.y - p.y) > FABRICATION.portee && !arrive) || p.state !== 'free') return;
    this.versPoste = null;
    p.stopMove(); p.facing = Math.atan2(po.y - p.y, po.x - p.x);
    this.emit({ k: 'atelier', poste: po.id, metier: po.metiers[0] });
  }
  /** Lance la fabrication de n fois la recette i (fenêtre Artisanat) : une barre d'une seconde, puis tout est fait d'un coup. */
  lancerFabrication(i: number, n = 1): boolean {
    const r = this.opts.items?.recipes?.[i], p = this.player;
    if (!r || this.enFabrication || p.dead || this.atelierIci(r.metier) === null) return false;
    n = Math.min(Math.max(1, Math.floor(n)), this.craftMax(i));
    if (n <= 0) return false;
    p.stopMove(); this.versPoste = null;
    this.enFabrication = { recette: i, n, t: 0, hp: p.hp };
    this.emit({ k: 'fabricationDebut', recette: i, n, duree: FABRICATION.duree });
    return true;
  }
  annulerFabrication() { if (this.enFabrication) { this.enFabrication = null; this.emit({ k: 'fabricationStop' }); } }
  /** Fait n fois une recette officielle si on a les ingrédients, le niveau de métier et qu'on est à son atelier. Rend le nombre fait. */
  craft(i: number, n = 1): number {
    const r = this.opts.items?.recipes?.[i], p = this.player;
    if (!r || this.atelierIci(r.metier) === null) return 0;
    n = Math.min(Math.max(1, Math.floor(n)), this.craftMax(i));
    if (n <= 0) return 0;
    for (const [id, q] of r.ingredients) { p.resources[id] -= q * n; if (p.resources[id] <= 0) delete p.resources[id]; }
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

  /** Récompense de quête ou de succès : un équipement (Commun) dans le sac, ou une ressource. */
  donnerObjet(id: string, n = 1) {
    const I = this.opts.items, p = this.player;
    if (I?.equipment[id]) { for (let i = 0; i < n; i++) p.bag.push(rollItem(id, I.equipment[id], 'commun', this.rng, this.nextId++)); }
    else { p.resources[id] = (p.resources[id] ?? 0) + n; this.emit({ k: 'lootResource', id, n }); }
  }
  /** Sac à rareté garantie (récompense de contrat, d'Avis de recherche, Quêtes roadmap 5A) : un équipement de ce niveau, de cette rareté. */
  donnerSac(rarete: Rarity, niveau: number) {
    const I = this.opts.items, p = this.player;
    if (!I) return;
    let pool = poolNiveau({ pool: this.equipByLevel, niveau });
    if (!pool.length) pool = [...this.equipByLevel].sort((x, y) => Math.abs(x.level - niveau) - Math.abs(y.level - niveau)).slice(0, 20);
    if (!pool.length) return;
    const id = this.rng.pick(pool).id, it = rollItem(id, I.equipment[id], rarete, this.rng, this.nextId++, p.sortsRecharge);
    p.bag.push(it);
    this.emit({ k: 'sacQuete', id, rarity: rarete });
  }
  // --- Bêtes de l'Osamodas (maquette Osamodas, 2026-11-08) ---------------------------
  /** 8A : un monstre en chasse frappe la bête qui l'a frappé (si elle est à moins de 4 cases), ou la bête bien plus proche que le joueur. */
  cibleDe(m: Monster): Cible {
    const p = this.player;
    if (!this.betes.length || m.state === 'idle' || m.state === 'return') return p;
    const vivantes = this.betes.filter(b => !b.dead && b.state !== 'spawn');
    const ag = vivantes.find(b => b.id === m.agresseur);
    if (ag && Math.hypot(ag.x - m.x, ag.y - m.y) < CASE * 4) return ag;
    const dp = Math.hypot(p.x - m.x, p.y - m.y);
    let best: Cible = p, bd = p.dead ? Infinity : dp * 0.6;
    for (const b of vivantes) { const d = Math.hypot(b.x - m.x, b.y - m.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  /** Bête vivante invoquée par ce sort (une par sort, la touche la rappelle ou l'éveille). */
  beteDe(sort: string): Bete | undefined { return this.betes.find(b => b.sort === sort && !b.dead); }
  /** Coût en Invocations (2A) : 1 / 2 / 3 selon le rang ; le joueur en a 1 de base + objets + Cortège Sauvage. */
  invocationsPrises(): number { return this.betes.filter(b => !b.dead && !b.dompteT).reduce((a, b) => a + BETES[b.base].rang, 0); }
  invocationsMax(p: Player): number { return REGLES_BETES.invocationsBase + Math.max(0, p.stat('invocations')); }
  /** Fait apparaître la bête d'un sort au point visé (case libre la plus proche). */
  invoquer(p: Player, key: string, sort: string, x: number, y: number): Bete | null {
    if (!BETES[key]) return null;
    const q = this.walkable(x, y) ? { x, y } : this.map.nearestFree(x, y);
    const b = new Bete(this.nextId++, p, key, sort, q.x, q.y);
    this.betes.push(b);
    this.emit({ k: 'status', x: b.x, y: b.y - 40, text: b.def.name, color: '#9fe07a' });
    this.emit({ k: 'invocation', id: b.id, x: b.x, y: b.y });
    return b;
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
    this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit: false, element: el });
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
    const b = new Bete(this.nextId++, p, m.type, 'dompte', m.x, m.y, def, Math.max(1, Math.round(m.maxHp * 0.6)));
    b.dompteT = D.duree; b.state = 'suit';
    this.betes.push(b);
    this.emit({ k: 'dompte', id: b.id, name: m.def.name, x: b.x, y: b.y });
    this.emit({ k: 'status', x: b.x, y: b.y - 40, text: `${m.def.name} dompté !`, color: '#9fe07a' });
    return true;
  }

  onPlayerDeath() { for (const b of this.betes) b.mourir(this); this.over = true; this.emit({ k: 'playerDeath', wave: this.wave }); }

  /** Évite que les monstres se superposent (O(n²), suffisant sous 100 monstres). */
  private separate() {
    const all = this.monsters.filter(m => !m.dead);
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
