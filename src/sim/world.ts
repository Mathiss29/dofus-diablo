import { angleDiff, Rng } from './math';
import type { AtelierDef, Element, GameData, HitZone, MonsterSpell, SubAreaDef, ZoneDef } from './defs';
import type { SimEvent, Telegraph } from './events';
import { GridMap, WorldGrid } from './gridmap';
import { NO_INPUT, type PlayerInput } from './input';
import { CASE, Monster, TOUR } from './monster';
import { METIER_XP, PEPITE, RARITIES, recycleResource, recycleValue, rollItem, rollRarity, type Item, type ItemsData, type Rarity } from './items';
import { Player } from './player';
import { initiativeBonus, removalChance } from './caracs';
import { planWave } from './waves';
import { Quetes, type Compte, type EtatQuetes, type QuetesData } from './quests';
import { RECOLTE, quantite, xpRecolte, type Recolte, type RecoltesData } from './recolte';

interface HitDef { dmg: number; knock: number; element?: Element; lifesteal?: number;
  /** Effets officiels : Érosion (part des dommages ôtée aux PV max), retrait de PM / PA. */
  erosion?: number; pmLoss?: number; paLoss?: number; poLoss?: number;
  /** Dommages multipliés sur les invocations (Concentration), et aussi sur les élites et les boss (Rage pleine). */
  vsSummon?: number; vsElite?: boolean;
  /** Dommages de poussée officiels si la cible heurte un obstacle ou un monstre. */
  pushDmg?: boolean }
/** Butin au sol (choix 1C 2D 6A) : équipements et kamas seulement. Les Communs et les kamas filent vers le joueur
 *  qui passe près ; Rare et plus se ramassent d'un clic. Les ressources vont directement dans le sac. */
export interface Drop { uid: number; x: number; y: number; item?: Item; kamas?: number; t: number; warned?: boolean }

/** Flèche en vol (Crâ). */
export interface Projectile { id: number; spell: string; x: number; y: number; dx: number; dy: number; left: number; speed: number; width: number;
  explode: number; pierce: boolean; hit: HitDef; stun: number; touched: Set<number>;
  /** Tiré par un monstre : touche le joueur, pas les monstres. */
  hostile?: boolean;
  /** Sort officiel du monstre qui l'a lancé (ses effets s'appliquent à l'impact). */
  from?: { monster: Monster; spell: MonsterSpell } }

/** Monde ouvert : un groupe de monstres posé sur une carte Dofus, qui réapparaît quand il a été vaincu. */
interface MonsterGroup {
  id: number; map: string; sub: SubAreaDef; members: Monster[]; timer: number; cleared: boolean; x: number; y: number;
  /** Donjon : monstres fixes du groupe et nom du donjon (ne réapparaît pas tant que le joueur y est). */
  fixe?: string[]; donjon?: string;
}
export interface PorteEnd { tag: string; x: number; y: number }

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
  apparats?: { objets: Record<string, { slot: string }>; prix: Record<string, number> };
}

/** La simulation d'une zone : joueur, monstres, vagues, collisions.
 *  Aucune dépendance à Phaser ni au navigateur : elle tourne telle quelle dans les tests
 *  (et plus tard sur un serveur pour la coop). L'affichage lit l'état et vide `events`. */
export class World {
  readonly rng: Rng;
  readonly zone: ZoneDef;
  readonly map: GridMap;
  readonly player: Player;
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  drops: Drop[] = [];
  /** Objets d'équipement par niveau, pour le butin de zone. */
  private equipByLevel: { id: string; level: number }[] = [];
  /** Événements produits depuis le dernier drainEvents(). */
  private events: SimEvent[] = [];
  /** Ressources à récolter du monde (métiers de récolte, 0.2b). */
  recoltes: Recolte[] = [];
  /** Ressource cliquée (le perso y va) et geste en cours (t = temps écoulé, hp = PV au début : un coup reçu l'interrompt). */
  versRecolte: number | null = null;
  enRecolte: { id: number; t: number; hp: number } | null = null;
  /** Télégraphes du dernier pas (recalculés à chaque pas). */
  telegraphs: Telegraph[] = [];
  wave = 0;
  kills = 0;
  waveDelay = 1.2;
  over = false;
  time = 0;
  private nextId = 1;
  private groups: MonsterGroup[] = [];
  /** Point de retour après une mort (le dernier Zaap atteint). */
  private checkpoint = { x: 0, y: 0 };
  checkpointName = '';
  /** Sous-zone où se trouve le joueur (monde ouvert). */
  area: SubAreaDef | null = null;
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
  quetes: Quetes | null = null;   // au-delà de ce qu'on voit même dézoomé à fond (avant : monstres figés au bord de l'écran)

  constructor(readonly opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? 1);
    this.zone = opts.data.zones[opts.zone];
    if (!this.zone) throw new Error(`Zone inconnue : ${opts.zone}`);
    this.map = opts.map;
    let start = this.map.nearestFree(GridMap.OFFSET_Y, GridMap.OFFSET_Y);
    const open = this.zone.open;
    if (open) {
      if (!(this.map instanceof WorldGrid)) throw new Error('Une zone en monde ouvert demande un WorldGrid');
      const m = this.map.mapByCoords(...open.start);
      if (!m) throw new Error(`Carte de départ absente du monde : ${open.start}`);
      // départ : la case la plus dégagée de la carte (le plus de cases marchables autour)
      start = this.openestCell(m.tag);
      this.checkpointName = open.checkpoints[0]?.name ?? '';
    }
    this.checkpoint = start;
    this.player = new Player(this.nextId++, start.x, start.y, opts.data.classes[opts.classId ?? 'iop']);
    if (opts.items) {
      this.player.items = opts.items;
      this.equipByLevel = Object.entries(opts.items.equipment).map(([id, d]) => ({ id, level: d.level }));
      // sac vide au départ (Mathis, 2026-11-06) : l'équipement vient du tutoriel (panoplie de l'Intrépide, Arc de Chasse du Crâ)
    }
    if (open) { this.buildPortes(); this.buildRecoltes(); }
    if (open && opts.arrivee) this.arriver(opts.arrivee);
    // les PNJ d'abord : les groupes de monstres ne se posent pas sur eux
    if (open && opts.quetes) this.quetes = new Quetes(opts.quetes, this, opts.compte);
    // les quêtes d'abord : le tutoriel retient les groupes du Temple jusqu'à son étape « Frapper »
    if (this.quetes) { if (opts.reprise) this.quetes.reprendre(opts.reprise); else this.quetes.demarrer(); }
    if (open) this.spawnGroups();
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
  static readonly PORTE_ARRIVEE = 80;
  private buildPortes() {
    const wg = this.worldGrid!;
    for (const d of this.zone.open!.portes ?? []) {
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
    }
  }
  /** Passe la porte si le joueur est dessus : il arrive de l'autre côté, un peu en avant de la porte d'arrivée. */
  private updatePortes(dt: number) {
    const p = this.player, R = World.PORTE_R;
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
      const from = po.ends[i], to = po.ends[1 - i];
      if ((i === 1 && po.sens) || from === this.portalLock || Math.hypot(p.x - from.x, p.y - from.y) > R) continue;
      if (!p.vise(from.x, from.y, R + 40)) continue;   // on passe la porte en cliquant dessus, pas en la frôlant
      if (po.verrou && !this.salleVide(from.tag)) {
        this.portalLock = from;   // un seul message tant qu'il reste sur la porte
        this.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Vaincs les monstres de la salle', color: '#ff9a5a' });
        return;
      }
      // entrée d'un donjon : la clé officielle est prise en entrant (sans clé, la porte reste fermée)
      if (po.cle && i === 0) {
        const r = p.resources[po.cle] ?? 0;
        if (r <= 0) {
          this.portalLock = from;
          this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `Il faut une ${this.opts.items?.resources[po.cle]?.name ?? 'clé'}`, color: '#ff9a5a' });
          this.emit({ k: 'cleManquante', id: po.cle });
          return;
        }
        if (r === 1) delete p.resources[po.cle]; else p.resources[po.cle] = r - 1;
      }
      // le perso s'arrête devant la porte pendant le fondu de sortie, puis passe (traverser)
      p.stopMove();
      this.passage = { to, nom: po.nom, t: World.PASSAGE, vers: po.vers };
      this.emit({ k: 'portalStart', nom: po.nom });
      return;
    }
  }
  /** Arrivée de l'autre côté : une case libre juste hors du rayon de la porte d'arrivée, du côté du milieu de la carte (pas collé au bord). */
  private traverser(to: PorteEnd, nom: string) {
    const p = this.player, wg = this.worldGrid!;
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
    this.emit({ k: 'portal', nom });
  }

  /** Plus aucun monstre vivant dans les groupes de cette carte (portes verrouillées des donjons). */
  salleVide(tag: string): boolean {
    return !this.groups.some(g => g.map === tag && g.members.some(m => !m.dead));
  }
  /** Le joueur est dans une salle de ce donjon. */
  private dansDonjon(nom: string): boolean {
    const d = this.zone.open?.donjons?.find(x => x.nom === nom), tag = this.worldGrid?.mapAt(this.player.x, this.player.y)?.tag;
    return !!d && !!tag && tag in d.salles;
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
      for (let i = 0; i < sub.groupsPerMap; i++) {
        const g: MonsterGroup = { id: this.groups.length, map: m.tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0 };
        this.groups.push(g);
        if (this.groupesPrets(g)) this.spawnGroup(g);
        else g.cleared = true;   // tutoriel : apparaîtra à l'étape voulue (updateOpen)
      }
    }
    // Donjons : groupes officiels fixes, salle par salle
    for (const d of open.donjons ?? []) for (const [tag, groupes] of Object.entries(d.salles)) {
      const m = wg.mapByTag(tag);
      if (!m || !wg.freeByMap.get(tag)?.length) continue;
      const sub = open.subareas[String(m.sub)] ?? { name: d.nom, level: this.zone.level, monsters: [], groupsPerMap: 0, groupSize: [0, 0] };
      for (const fixe of groupes) {
        const g: MonsterGroup = { id: this.groups.length, map: tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0, fixe, donjon: d.nom };
        this.groups.push(g);
        this.spawnGroup(g);
      }
    }
  }
  private groupesPrets(g: MonsterGroup) {
    const sub = this.worldGrid!.mapByTag(g.map)?.sub;
    return g.fixe != null || sub == null || !this.quetes || this.quetes.groupesPrets(sub);
  }
  private spawnGroup(g: MonsterGroup) {
    const wg = this.worldGrid!, free = wg.freeByMap.get(g.map)!, p = this.player;
    // Le groupe se pose sur un coin dégagé (pas au bord d'une falaise ni dans un recoin), loin du joueur
    const ok = this.freeSet(g.map), C = wg.cols;
    const ouvert = (c: number) => { let n = 0; for (let dr = -6; dr <= 6; dr++) for (let dk = -3; dk <= 3; dk++) if (ok.has(c + dr * C + dk)) n++; return n; };
    let pos = wg.randomFree(this.rng, free), best = -1;
    for (let t = 0; t < 40; t++) {
      const c = free[this.rng.int(free.length)], q = wg.cellToWorld(c);
      const score = ouvert(c) - (Math.hypot(q.x - p.x, q.y - p.y) < 450 ? 1000 : 0)
        - (this.quetes?.pnjs.some(n => Math.hypot(q.x - n.x, q.y - n.y) < 420) ? 1000 : 0);   // pas de groupe sur un PNJ
      if (score > best) { best = score; pos = q; }
      if (best >= 80) break;
    }
    g.x = pos.x; g.y = pos.y; g.members = []; g.cleared = false;
    const [a, b] = (!g.fixe && this.quetes?.tailleGroupe(this.worldGrid!.mapByTag(g.map)?.sub ?? -1)) || g.sub.groupSize, n = g.fixe ? g.fixe.length : a + this.rng.int(b - a + 1);
    const a0 = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      // en cercle autour du chef, chacun sa place (plus de tas de monstres les uns sur les autres)
      const ang = a0 + (i / Math.max(1, n - 1)) * Math.PI * 2 + this.rng.range(-0.3, 0.3), r = i === 0 ? 0 : this.rng.range(90, 150);
      const q = wg.nearestFree(pos.x + Math.cos(ang) * r, pos.y + Math.sin(ang) * r, free);
      // l'élite unique de la sous-zone mène un groupe sur 8 environ, s'il n'est pas déjà en vie ailleurs
      const elite = !g.fixe && i === 0 && g.sub.elite && this.rng.next() < 0.12 && !this.monsters.some(o => !o.dead && o.type === g.sub.elite);
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
  aggroGroup(m: Monster) {
    const g = this.groups[m.group];
    for (const o of g ? g.members : [m]) if (!o.dead && (o.state === 'idle' || o === m)) o.state = 'chase';
  }
  private updateOpen(dt: number) {
    const p = this.player, open = this.zone.open!;
    this.updatePortes(dt);
    for (const g of this.groups) {
      if (g.members.some(m => !m.dead)) continue;
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
    // Zaap atteint : il devient le point de retour
    const cp = m && open.checkpoints.find(c => c.map[0] === m.x && c.map[1] === m.y);
    if (cp && cp.name !== this.checkpointName) {
      this.checkpointName = cp.name; this.checkpoint = this.openestCell(m.tag);
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
    p.dead = false; p.hp = p.maxHp; p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0;
    p.state = 'free'; p.skill = null; p.invuln = 2; p.rage = 0; p.setAnim('idle');
    this.over = false;
    this.emit({ k: 'respawn' });
  }

  emit(e: SimEvent) { this.events.push(e); this.quetes?.observer(e); }
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  walkable(x: number, y: number) { return this.map.walkable(x, y); }
  /** Chemin à pied (A* sur les cases de Dofus) vers un point. */
  findPath(from: { x: number; y: number }, to: { x: number; y: number }) { return this.map.findPath(from, to); }
  /** Ligne de tir sans obstacle (cases marchables) entre deux points. */
  clearShot(from: { x: number; y: number }, to: { x: number; y: number }) { return this.map.clearLine(from, to); }

  /** Avance la simulation de dt secondes. */
  step(dt: number, input: PlayerInput) {
    this.time += dt;
    this.telegraphs.length = 0;
    const p = this.player;
    const ents = [p, ...this.monsters], prev = ents.map(e => [e.x, e.y] as const);
    if (input.recolte != null) { this.versRecolte = input.recolte; this.enRecolte = null; }
    else if (input.dest || input.target != null || input.pickup != null || input.talk || input.pressed || input.move.x || input.move.y) {
      if (this.enRecolte) this.emit({ k: 'recolteStop' });
      this.versRecolte = null; this.enRecolte = null;
    }
    if (this.quetes) {
      if (input.reponse != null) this.quetes.repondre(input.reponse);
      if (input.talk) this.quetes.cliquer(input.talk);
      else if (input.dest || input.target != null || input.pickup != null) this.quetes.annulerClic();
    }
    p.update(dt, this.passage ? { ...NO_INPUT, aim: input.aim } : input, this);   // devant une porte : le perso attend le fondu
    // Monde ouvert : un monstre qui attend loin du joueur dort (pas d'errance ni d'IA) : bien moins de calcul
    for (const m of this.monsters) {
      if (this.zone.open && m.state === 'idle' && !m.dead && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > World.SOMMEIL) continue;
      m.update(dt, p, this);
    }
    this.updateProjectiles(dt);
    this.updateDrops(dt);
    this.separate();
    // Cases bloquantes : on glisse le long des obstacles (axe par axe), sauf en plein Bond
    ents.forEach((e, i) => {
      if (e === p && p.airborne) return;
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
    if (this.zone.open) { this.updateOpen(dt); this.updateRecoltes(dt); this.quetes?.update(dt); return; }
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
      width: hz.width, explode: (hz.explode ?? 0) * area, pierce: !!hz.pierce, hit, stun, touched: new Set() });
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
   *  Dommages : jet officiel ramené à l'échelle du monstre (son meilleur sort = def.dmg). */
  monsterSpellHits(m: Monster, spell: MonsterSpell, p: Player) {
    if (p.dead) return;
    const ref = Math.max(1, ...(m.def.spells ?? []).flatMap(s => s.effects).filter(e => e.k === 'dmg' && !e.perPa).map(e => (e as { min: number; max: number }).min / 2 + (e as { max: number }).max / 2));
    const k = m.def.dmg / ref;
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
      else if (e.k === 'soin') m.hp = Math.min(m.maxHp, m.hp + Math.round(this.rng.range(e.min, e.max + 1) * k));
    }
  }
  /** Sort lancé sur un allié (ex. Bêlement : +PM -> le monstre court plus vite pendant la durée). */
  monsterSpellBuff(m: Monster, spell: MonsterSpell) {
    for (const e of spell.effects) if (e.k === 'pm' && e.n > 0) {
      m.haste = 1 + e.n * 0.25; m.hasteT = Math.max(1, e.dur) * TOUR;
      this.emit({ k: 'status', x: m.x, y: m.y, text: `+${e.n} PM`, color: '#7be07b' });
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
        else if (!p.dead && Math.hypot(p.x - pr.x, p.y - pr.y) <= p.radius + pr.width) {
          if (pr.from) this.monsterSpellHits(pr.from.monster, pr.from.spell, p);
          else p.hurt(pr.hit.dmg, pr.x - pr.dx * 20, pr.y - pr.dy * 20, this, pr.hit.element);
          pr.left = 0;
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
      n++;
      const crit = this.rng.next() < p.critChance;
      // Choix 19A : résistances officielles du monstre dans l'élément du coup (plafonnées à 50 %, comme Dofus)
      const el = p.resolveElement(def.element ?? 'neutre'), res = Math.min(50, m.def.res?.[el] ?? 0);
      // Initiative : le premier coup porté à un monstre est renforcé ; Dommages Critiques et Dommages Poussée s'ajoutent au coup
      const first = m.struck ? 1 : 1 + initiativeBonus(p.initiative); m.struck = true;
      const flat = (crit ? p.stat('dommagesCritiques') : 0) + (def.knock > 0 ? p.stat('dommagesPoussee') : 0);
      const vs = def.vsSummon && (m.summoner || (def.vsElite && (m.def.elite || m.def.boss))) ? def.vsSummon : 1;
      const vu = m.vulnT > 0 ? 1 + m.vuln / 100 : 1;   // dommages subis augmentés (Bond)
      const dmg = Math.max(1, Math.round((p.damage(def.dmg * vs, def.element ?? 'neutre') * this.rng.range(0.9, 1.1) * (crit ? cls.critMult : 1) * first + flat) * (1 - res / 100) * vu));
      m.hp -= dmg; m.flash = 0.09;
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
      this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit, element: el });
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
  private pushDamage(m: Monster, a: number, dist: number) {
    const c = Math.cos(a), s = Math.sin(a), step = 8;
    let t = 0;
    for (; t < dist; t += step) {
      const x = m.x + c * (t + m.radius), y = m.y + s * (t + m.radius);
      if (!this.walkable(x, y) || this.monsters.some(o => o !== m && !o.dead && Math.hypot(o.x - x, o.y - y) < o.radius)) break;
    }
    const left = (dist - t) / CASE;
    if (left <= 0.25) return;
    const p = this.player, dmg = Math.max(1, Math.round((p.level / 2 + p.stat('dommagesPoussee') + 32) * left / 4));
    m.hp -= dmg; m.flash = 0.09;
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
    m.dead = true; m.t = 0.6; this.kills++;
    this.quetes?.eliteVaincu(m.id);
    for (const s of this.monsters) if (s.summoner === m && !s.dead) this.killMonster(s);   // ses invocations disparaissent avec lui
    if (m.summoner) { this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type }); return; }
    this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type });
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.cls.healOnKill + p.legendary('vampire'));
    this.dropLoot(m);
    const xp = p.gainXp(m.def.xp ?? Math.round(m.def.hp / 5), this);
    if (xp > 0) this.emit({ k: 'xp', x: m.x, y: m.y, z: m.radius * 2 + 30, n: xp });
    if (m.def.boss) { this.emit({ k: 'impact', hitstop: 0.15, shake: 0.02, big: true }); this.emit({ k: 'bossDown', monster: m.type }); }
  }
  // --- Butin (choix 24) ----------------------------------------------------
  /** Niveau d'un monstre : celui de la sous-zone où il vit. */
  monsterLevel(m: Monster): number {
    const wg = this.worldGrid, open = this.zone.open;
    const sub = wg && open ? open.subareas[String(wg.mapAt(m.homeX, m.homeY)?.sub)] : undefined;
    return sub?.level ?? this.zone.level;
  }
  /** Un monstre vaincu lâche son butin officiel (ressources, parfois un équipement) et, plus rarement, un équipement
   *  de son niveau pris dans tous les objets de Dofus. Élites et boss lâchent plus et mieux. */
  private dropLoot(m: Monster) {
    const I = this.opts.items;
    if (!I) return;
    const p = this.player, pros = p.stat('prospection'), boss = !!m.def.boss, elite = !!m.def.elite;
    const lvl = this.monsterLevel(m), more = 1 + pros / 100;
    const out: Omit<Drop, 'x' | 'y' | 't' | 'uid'>[] = [];
    for (const d of I.drops[m.type] ?? []) {
      // viandes (choix 6A) : critère officiel = arme de chasse en main et niveau de Chasseur suffisant
      const job = d.metier && Object.entries(I.metiers ?? {}).find(([, j]) => j.id === d.metier!.id)?.[0];
      if (d.metier && (!job || p.metierLevel(job) < d.metier.min || (d.chasse && !p.huntingWeapon))) continue;
      if (this.rng.next() * 100 >= d.chance * more) continue;
      if (job) p.gainMetierXp(job, METIER_XP.viande, this);
      if (I.equipment[d.item]) out.push({ item: rollItem(d.item, I.equipment[d.item], rollRarity(this.rng, boss, pros), this.rng, this.nextId++) });
      else {   // ressource : directement dans le sac
        p.resources[d.item] = (p.resources[d.item] ?? 0) + 1;
        this.emit({ k: 'lootResource', id: d.item, n: 1 });
      }
    }
    const equipChance = boss ? 1 : elite ? 0.3 : 0.06;
    for (let k = 0; k < (boss ? 2 : 1); k++) {
      if (this.rng.next() >= equipChance * more) continue;
      const pool = this.equipByLevel.filter(e => e.level >= lvl - 4 && e.level <= lvl + 6);
      if (!pool.length) continue;
      const id = this.rng.pick(pool).id;
      out.push({ item: rollItem(id, I.equipment[id], rollRarity(this.rng, boss, pros), this.rng, this.nextId++) });
    }
    // kamas : un petit tas de pièces, plus gros pour les élites et les boss
    if (boss || elite || this.rng.next() < 0.6) out.push({ kamas: Math.max(1, Math.round(lvl * this.rng.range(1, 3) * (boss ? 12 : elite ? 4 : 1) * more)) });
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
    const p = this.player;
    for (const d of this.drops) {
      d.t += dt;
      if (p.dead || d.t < 0.5 || !this.shown(d)) continue;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (World.magnetic(d)) {
        if (dist > 130) continue;
        if (dist > 26) { const s = Math.min(dist, 520 * dt); d.x += (p.x - d.x) / dist * s; d.y += (p.y - d.y) / dist * s; continue; }
      } else if (p.pickupId !== d.uid || dist > 44) continue;
      if (d.item) {
        if (p.pickupId === d.uid) p.pickupId = null;
        if (p.bag.length >= Player.BAG_SIZE) { if (!d.warned) this.emit({ k: 'bagFull' }); d.warned = true; continue; }   // sac plein : l'objet reste au sol
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
      if (g.t < RECOLTE.duree) return;
      this.enRecolte = null;
      const def = R.ressources[r.item], lv = Math.max(1, p.metierLevel(def.metier));
      const n = quantite(this.rng, lv, def.niveau, r.dore);
      p.resources[r.item] = (p.resources[r.item] ?? 0) + n;
      p.gainMetierXp(def.metier, xpRecolte(def.niveau, r.dore), this);
      this.emit({ k: 'recolteFin', id: r.id, item: r.item, n, dore: r.dore });
      r.repousse = RECOLTE.repousse; r.dore = false;
      return;
    }
    if (this.versRecolte == null) return;
    const r = this.recoltes.find(x => x.id === this.versRecolte);
    if (!r || r.repousse > 0) { this.versRecolte = null; return; }
    if (Math.hypot(r.x - p.x, r.y - p.y) > RECOLTE.portee || p.state !== 'free') return;
    this.versRecolte = null;
    const def = R.ressources[r.item], lv = Math.max(1, p.metierLevel(def.metier));
    if (lv < def.niveau) {
      p.stopMove();
      this.emit({ k: 'status', x: p.x, y: p.y - 60, text: `${R.metiers[def.metier]?.nom ?? 'Métier'} niveau ${def.niveau} requis`, color: '#ff9a5a' });
      this.emit({ k: 'recolteNiveau', metier: def.metier, niveau: def.niveau });
      return;
    }
    p.stopMove();
    p.facing = Math.atan2(r.y - p.y, r.x - p.x);
    this.enRecolte = { id: r.id, t: 0, hp: p.hp };
    this.emit({ k: 'recolteDebut', id: r.id, duree: RECOLTE.duree });
  }

  // --- Emp, le Méryde du Recyclage (maquette 0.2, 8A+8B+8C, 9A+9B) ---------------------------------------------
  private pepites(n: number) { const p = this.player; p.resources[PEPITE] = (p.resources[PEPITE] ?? 0) + n; }
  /** Recycle un objet du sac contre des Pépites (un objet sous cadenas n'est jamais recyclé). */
  recycle(uid: number): boolean {
    const p = this.player, i = p.bag.findIndex(b => b.uid === uid), d = i >= 0 && this.opts.items?.equipment[p.bag[i].id];
    if (i < 0 || p.bag[i].cadenas) return false;
    const n = d ? recycleValue(d, p.bag[i]) : 1;
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
      const d = I?.equipment[it.id]; n++; pep += d ? recycleValue(d, it) : 1; return false;
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
    if (!d || prix == null || p.apparats.includes(id) || (p.resources[PEPITE] ?? 0) < prix) return false;
    p.resources[PEPITE] -= prix; if (!p.resources[PEPITE]) delete p.resources[PEPITE];
    p.apparats.push(id);
    this.emit({ k: 'achat', id, prix });
    return true;
  }
  /** Case Apparence de l'inventaire : pose un apparat possédé sur l'emplacement, « 0 » cache l'objet porté, null rend sa vraie apparence. */
  porterApparat(slot: 'chapeau' | 'cape' | 'bouclier', id: string | null): boolean {
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
    p.resources[id]--; if (!p.resources[id]) delete p.resources[id];
    p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0; p.stopMove();
    this.passage = null; this.portalLock = null;
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
    const heal = Math.min(r.soin, p.maxHp - p.hp); p.hp += heal;
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
  onPlayerDeath() { this.over = true; this.emit({ k: 'playerDeath', wave: this.wave }); }

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
