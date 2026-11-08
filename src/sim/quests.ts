import type { SimEvent } from './events';
import type { World } from './world';
import { PEPITE, type Rarity } from './items';
import { contrat, hache, semaine, tirerContrats, type CtxContrats } from './contrats';

/** Quêtes et succès (maquette « Quêtes et succès », tranchée le 2026-11-06).
 *  Une quête est une suite d'étapes ; une étape a un ou plusieurs objectifs qui avancent en même temps (3A+3B).
 *  Chaque objectif écoute les événements de la simulation (monstre vaincu, sort lancé, Zaap atteint…) ou l'état du joueur
 *  (sous-zone, PNJ proche, objet équipé). Les succès écoutent les mêmes choses. Contenu : src/data/quetes.json. */

/** Objectif d'une étape. `texte` est la ligne affichée dans le suivi et le journal. */
export type ObjectifDef = { texte: string } & (
  /** Aller dans une sous-zone, sur une carte (tag de monde.json) ou près d'un PNJ (« passer près de lui », sans dialogue). */
  | { t: 'aller'; sousZone?: number; carte?: string; pnj?: string }
  /** Vaincre N monstres : d'une liste, d'une sous-zone, ou les deux. */
  | { t: 'vaincre'; n: number; monstres?: string[]; sousZone?: number }
  /** Un élite de quête : il apparaît sur la carte quand l'étape commence (PV ×pv, doré sur la mini-carte). */
  | { t: 'elite'; monstre: string; carte: string; pv?: number; nom?: string }
  /** Objet de quête lâché par les monstres (chance par monstre vaincu, 0 à 1). */
  | { t: 'ramasser'; objet: string; n: number; chance: number; monstres?: string[]; sousZone?: number }
  /** Utiliser : un sort précis, la mobilité (Espace), la jauge de classe pleine, ou la potion. */
  | { t: 'utiliser'; sort?: string; quoi?: 'mobilite' | 'jauge' | 'potion' | 'sort' }
  /** Équiper un objet (n'importe lequel, ou un objet précis par son id), ou tous les objets d'une liste (panoplie de départ). */
  | { t: 'equiper'; objet?: string; objets?: string[] }
  /** Activer un Zaap (il devient le point de retour). */
  | { t: 'activer'; zaap: string }
  /** Parler à un PNJ (clic dessus) ; avec objet : lui montrer un objet de quête qu'on porte. */
  | { t: 'parler'; pnj: string; objet?: string }
  /** Métiers : récolter N ressources, fabriquer un objet (fil des métiers). */
  | { t: 'recolter'; ressource: string; n: number }
  /** Atteindre un niveau. */
  | { t: 'niveau'; n: number }
  | { t: 'fabriquer'; objet: string; n?: number }
  /** Le tour du monde : vaincre le boss de ce donjon (une victoire d'avant la quête compte, 5A). boss, niveau et région : carnet de route. */
  | { t: 'donjon'; donjon: string; boss: string; niveau: number; region: string }
  /** Défense (Quêtes roadmap 6A) : tenir s secondes sur cette carte pendant que des vagues de monstres de la sous-zone arrivent. */
  | { t: 'defense'; carte: string; s: number }
  /** Contre la montre (6D) : vider cette carte de ses monstres en moins de s secondes après y être entré. */
  | { t: 'chrono'; carte: string; s: number }
  /** Défi de donjon du jour (3B) : vaincre le boss de ce donjon en respectant la règle (sans potion, ou en moins de s secondes). */
  | { t: 'defi'; donjon: string; regle: 'sansPotion' | 'chrono'; s?: number }
);
export interface EtapeDef {
  nom: string;
  objectifs: ObjectifDef[];
  /** Bulle du PNJ qui donne la quête, au début de l'étape (5A : une ou deux phrases, le jeu continue). */
  bulle?: string;
  /** Aide visuelle du tutoriel : emplacement de la barre à entourer (0-5, 6 clic droit, 7 Espace) ou 'potion' / 'jauge'. */
  halo?: number | 'potion' | 'jauge';
  /** Objet donné au début de l'étape (id de items.json), ou un par classe (l'arme de niveau 1 du tutoriel). */
  donner?: string | string[] | Record<string, string | string[]>;
  /** PNJ qui dit la bulle de cette étape (par défaut celui de la quête) : Ganymède accueille au Temple, puis attend sur la Route. */
  pnj?: string;
}
export interface RecompenseDef {
  xp?: number; kamas?: number;
  /** Objet donné (id de items.json), ou un par classe (l'arme officielle de niveau 1 du tutoriel). */
  objet?: string; objetParClasse?: Record<string, string>;
  /** Objets officiels avec leur quantité (ressources de quête). */
  objets?: [string, number][];
  /** Potions remplies. */
  potions?: boolean;
  /** XP donnée jusqu'à atteindre ce niveau. */
  niveau?: number;
  /** Sac à rareté garantie (Quêtes roadmap 5A) : un équipement tiré au niveau de la quête, de cette rareté. */
  sac?: Rarity;
  /** Pépites (la monnaie d'Emp, 5B). */
  pepites?: number;
}
export type QueteType = 'tutoriel' | 'principale' | 'secondaire' | 'prime' | 'evenement';
export interface QueteDef {
  nom: string; type: QueteType;
  /** PNJ qui la donne (clé de pnj). Sans PNJ : elle démarre seule quand ses conditions sont remplies. */
  pnj?: string;
  /** Texte complet, lisible dans le journal (5C). */
  texte: string;
  niveau: number;
  /** Quêtes à finir avant. */
  requiert?: string[];
  /** Quête principale suivante : elle démarre seule à la fin de celle-ci (6C). */
  suivante?: string;
  /** Rendu (17B) : au PNJ (les séries : il donne la suivante) ; sans rendu, validée sur place. */
  rendre?: string;
  /** Série officielle (Milice, Exploration…), affichée dans le journal. */
  serie?: string;
  /** Les étapes, ou une liste d'étapes par classe (tutoriel : trame différente par classe, 9B). */
  etapes: EtapeDef[] | Record<string, EtapeDef[]>;
  recompense: RecompenseDef;
  /** Options du tutoriel : PV bloqués à 1 (6A), groupes réduits dans ces sous-zones (5A), sautée si le compte a déjà un perso (7B). */
  /** groupes.etape : les groupes de ces sous-zones n'apparaissent qu'à partir de cette étape (tutoriel : pas de monstres dès l'entrée dans la salle). */
  /** jauge : la jauge de classe se remplit N fois plus vite pendant la quête (le Crâ du tutoriel n'a pas encore d'arc). */
  options?: { immortel?: boolean; groupes?: { sousZones: number[]; taille: [number, number]; etape?: number }; sauterSiCompte?: boolean; passable?: boolean; jauge?: number };
  /** Démarre dès le début de la partie (le tutoriel). */
  auDepart?: boolean;
  /** Carte (tag de monde.json) où le perso apparaît quand la quête démarre au départ (tutoriel : le Temple Céleste). */
  depart?: string;
  /** Carte où le PNJ envoie le perso à la fin (ou quand on passe la quête) s'il est encore dans la sous-zone du départ :
   *  Ganymède fait descendre du Temple Céleste sur la Route des âmes, comme dans Dofus (pas de porte dans le vide). */
  arrivee?: string;
  /** Case Dofus (0-559) d'arrivée sur cette carte ; sans : le coin le plus dégagé. */
  arriveeCase?: number;
  /** Sans PNJ : démarre seule en entrant dans cette sous-zone (ex. « Mort au rat ! » dans la Taverne). */
  zone?: number;
  /** Remerciement du PNJ quand on rend la quête (Dialogues 6B) ; sans : une ligne commune. */
  merci?: string;
  /** Chapitre du tour du monde dont les donjons ne sont pas encore dans le jeu : visible au carnet de route, pas encore proposé. */
  bientot?: boolean;
  /** Répétable (Avis de recherche : une traque par semaine, 3A) : on peut la reprendre au jour ou à la semaine suivante. */
  repetable?: 'jour' | 'semaine';
  /** Contrat du jour ou de la semaine (src/sim/contrats.ts) : la période où il a été proposé. */
  contrat?: string;
}
export interface PnjDef {
  nom: string; dofusId: number;
  /** Zone où il se tient (sans : Incarnam) ; les tags de carte de deux mondes peuvent se ressembler. */
  zone?: string;
  /** Carte de monde.json où il se tient, et case Dofus (0-559) ; sans case : le coin le plus dégagé de la carte. */
  carte: string; case?: number;
  /** Planche de sprites d'un autre PNJ (le même personnage à deux endroits : Ganymède au Temple puis sur la Route). */
  sprite?: string;
  /** Ce qu'il dit quand on lui parle sans quête (maquette Dialogues 10A). */
  phrase?: string;
  /** Havre-Sac (maquette Hub 3A) : il n'emménage qu'après la première visite de cette zone. */
  apres?: string;
  /** Métier affiché dans la fenêtre de ses services (Antiquaire, Couturière…). */
  titre?: string;
  /** Services du PNJ (recycler, boutique, apparat, garde-robe) : la réponse ferme le dialogue et l'affichage ouvre la fenêtre du service. */
  services?: { texte: string; service: string }[];
  /** Discussion officielle (dialogMessages / dialogReplies) : la réponse n mène au texte n, la dernière laisse adieu pour partir. */
  discussion?: { reponse: string; texte: string }[];
  /** Texte officiel de la réponse qui ferme le dialogue (sinon « Au revoir. »). */
  adieu?: string;
  /** Gardien de l'entrée d'un donjon (maquette Gardiens) : il fait entrer avec la clé. Répliques inédites. Sans case, il se poste
   *  à quelques pas de la porte d'entrée. */
  gardien?: GardienDef;
  /** Tient le tableau des contrats du jour (Quêtes roadmap 3C). */
  contrats?: boolean;
}
export interface GardienDef {
  /** Nom du donjon (zones.json, open.donjons[].nom). */
  donjon: string;
  /** Petite bulle quand on passe devant (9A, une fois par visite). */
  approche: string;
  /** Ce qu'il dit après ta victoire sur le boss, ou après ta mort dans le donjon (8A). */
  victoire: string; mort: string;
  /** Sans clé (6A). {vendeur} = le PNJ qui vend la clé. */
  sansCle?: string;
}
/** Ligne d'infos sous la réplique du gardien (7A + 7B). */
export interface InfoDonjon { nom: string; boss: string | null; niveau: number; salles: number; cle: string | null; cles: number; victoires: number; butin: string[];
  /** Donjon en arène : nombre de vagues, meilleur temps (s, 12A), vague où l'on reprend avec une clé encore valable (14A). */
  vagues?: number; meilleur?: number; reprise?: number }
/** Temps « 3:07 ». */
export const chrono = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Durée lisible : « 4 min 30 s ». */
const chronoTexte = (s: number) => { const m = Math.floor(s / 60), r = Math.round(s % 60); return m ? `${m} min${r ? ` ${r} s` : ''}` : `${r} s`; };
/** Réponse du cadre vert sous la bulle (maquette Dialogues 3A) : voir une quête, l'accepter, revenir à la liste, fermer. */
export type Reponse = { texte: string; detail?: string } & (
  { a: 'voir' | 'accepter'; quete: string } | { a: 'retour' } | { a: 'fermer' } | { a: 'service'; service: string } | { a: 'suite'; i: number }
  | { a: 'entrer'; donjon: string } | { a: 'sansCle'; donjon: string } | { a: 'contrats' }
);
/** Dialogue ouvert avec un PNJ (bulle officielle à ruban, réponses 1 à 4). Le jeu continue derrière (4A). */
export interface Dialogue { pnj: string; texte: string; reponses: Reponse[]; quete?: string; recompense?: RecompenseDef; donjon?: InfoDonjon }
/** Objectif d'un succès officiel : une quête finie, une étape de quête finie, un autre succès, une sous-zone découverte,
 *  un niveau atteint ou un monstre vaincu. */
export type SuccesObjectif = { nom: string } & (
  | { quete: string } | { etape: [string, number] } | { succes: string } | { sousZone: number } | { niveau: number } | { monstre: string }
  /** Collection d'apparences (« Équipement en trop » 1C) : apparence débloquée. */
  | { apparence: string }
);
export interface SuccesDef {
  nom: string; dofusId: number; description: string; categorie: string; sousCategorie: string; points: number; icone: number;
  objectifs: SuccesObjectif[];
  /** XP officielle (ratio des données × XP du niveau), objet officiel. */
  recompense?: { xp?: number; objet?: string; /** Titre affiché sous le nom du perso (Tour 7A). */ titre?: string };
}
export interface QuetesData { pnj: Record<string, PnjDef>; quetes: Record<string, QueteDef>; succes: Record<string, SuccesDef>;
  /** Contrats du jour : titres officiels et une ligne de texte par sous-zone (2A). */
  contrats?: { titres: Record<string, [string, string][]> } }

/** Une quête en cours. */
export interface QueteEnCours { id: string; etape: number; compte: number[]; /** Étapes finies, en attente du rendu au PNJ. */ aRendre: boolean }
/** Ce qui dépasse la partie : succès du compte (15A) et nombre de persos déjà créés (7B). L'affichage le garde. */
export interface Compte { succes: string[]; persos: number }
/** Ce que la sauvegarde d'un perso garde de ses quêtes. */
export interface EtatQuetes {
  enCours: QueteEnCours[]; finies: string[]; etapesFinies: string[]; suivie: string | null;
  decouvertes: number[]; vaincus: string[]; objets: Record<string, number>;
  /** Donjons (8A) : victoires sur le boss, morts, et dernier résultat pas encore commenté par le gardien. */
  donjons?: Record<string, BilanDonjon>;
  /** Quêtes répétables finies : id -> période (jour AAAA-MM-JJ ou semaine AAAA-Snn) où elles l'ont été. */
  refaites?: Record<string, string>;
  /** Tableau des contrats (4A) : ceux proposés aujourd'hui et cette semaine (gardés pour que monter de niveau ne les change pas). */
  tableau?: Tableau;
}
export interface Tableau { jour: string; ids: string[]; semaine: string; hebdo: string[] }
export interface BilanDonjon { v: number; m: number; dernier?: 'v' | 'm';
  /** Meilleur temps dans l'arène (s, 12A) ; nouveau record à commenter par le gardien. */
  t?: number; record?: boolean;
  /** Premier passage (carnet de route, Tour 8B) : date (AAAA-MM-JJ) et temps passé dans le donjon jusqu'au boss (s). */
  premier?: { d?: string; t?: number } }
/** Page du carnet de route : un donjon du tour du monde, son chapitre, et ton premier passage. */
export interface PageCarnet { donjon: string; boss: string; niveau: number; region: string; chapitre: number; nomChapitre: string; bientot: boolean; premier: BilanDonjon['premier'] | null; victoires: number }

export class Quetes {
  enCours: QueteEnCours[] = [];
  finies = new Set<string>();
  /** Étapes finies de chaque quête (pour les succès d'étape, ex. « Premiers pas »). */
  etapesFinies = new Set<string>();
  suivie: string | null = null;
  succes = new Set<string>();
  /** Sous-zones découvertes par ce perso. */
  decouvertes = new Set<number>();
  /** Monstres vaincus au moins une fois (succès de boss). */
  vaincus = new Set<string>();
  /** Objets de quête dans le sac (onglet « Objets de quête »). */
  objets: Record<string, number> = {};
  /** Victoires et morts dans chaque donjon (8A). */
  donjons: Record<string, BilanDonjon> = {};
  /** Vendeur de clés montré par un gardien (6A) : la carte M le met en avant. */
  marqueVendeur: string | null = null;
  /** Répétables finies (Avis, contrats) : id -> période. */
  refaites: Record<string, string> = {};
  /** Contrats proposés aujourd'hui et cette semaine. */
  tableau: Tableau | null = null;
  /** Défense en cours : quête, objectif, temps tenu, prochaine vague. */
  private defense: { q: string; i: number; t: number; vague: number; hors: number } | null = null;
  /** Contre la montre en cours : quête, objectif, temps écoulé. */
  private course: { q: string; i: number; t: number; n0: number } | null = null;
  /** Potion bue depuis l'entrée dans le donjon (défi « sans potion »). */
  private potionDonjon = false;
  /** Contrats déjà écrits (src/sim/contrats.ts), par id. */
  private dyn = new Map<string, QueteDef | null>();
  /** Donjon où se trouve le perso et moment où il y est entré (temps du premier passage, Tour 8B). */
  private dansDonjon: { nom: string; t: number } | null = null;
  /** Gardiens qui ont déjà dit leur bulle d'approche pendant cette visite (9A). */
  private salues = new Set<string>();
  /** PNJ placés dans le monde (coordonnées monde). */
  pnjs: { id: string; def: PnjDef; x: number; y: number; tag: string }[] = [];
  /** Bulle en cours au-dessus d'un PNJ. */
  bulle: { pnj: string; texte: string; t: number } | null = null;
  /** Dialogue ouvert (clic sur un PNJ à portée). */
  dialogue: Dialogue | null = null;
  /** Distance au PNJ au-delà de laquelle le dialogue se ferme (4B). */
  static readonly DIALOGUE_MAX = 300;
  /** PNJ cliqué : le perso s'en approche, la discussion part quand il est à portée. */
  private versPnj: string | null = null;
  /** Élites de quête vivants : id du monstre -> quête. */
  private elites = new Map<number, string>();
  static readonly PORTEE = 130;
  get classe() { return this.world.opts.classId ?? 'iop'; }

  constructor(readonly data: QuetesData, private world: World, readonly compte: Compte = { succes: [], persos: 0 }) {
    for (const s of compte.succes) this.succes.add(s);
    const wg = world.worldGrid;
    if (wg) for (const [id, def] of Object.entries(data.pnj)) {
      if ((def.zone ?? 'incarnam') !== world.opts.zone) continue;
      if (def.apres && !(world.opts.zonesVues ?? []).includes(def.apres) && world.opts.zone !== def.apres) continue;   // pas encore emménagé (3A)
      const m = wg.mapByTag(def.carte);
      if (!m || !wg.freeByMap.get(def.carte)?.length) continue;   // carte pas (encore) exportée
      const free = wg.freeByMap.get(def.carte)!;
      let q = def.case != null ? wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(def.carte, def.case))), free)
        : def.gardien ? this.posteDeGarde(def.gardien.donjon, def.carte) ?? world.openestCellOf(def.carte) : world.openestCellOf(def.carte);
      // deux PNJ sur la même carte : le second se pose à côté (case libre la plus proche à plus de 5 cases)
      if (this.pnjs.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 200)) {
        let best = q, bd = Infinity;
        for (const c of free) {
          const z = wg.cellToWorld(c), d = Math.hypot(z.x - q.x, z.y - q.y);
          if (d < bd && this.pnjs.every(o => Math.hypot(o.x - z.x, o.y - z.y) >= 260)) { bd = d; best = z; }
        }
        q = best;
      }
      this.pnjs.push({ id, def, x: q.x, y: q.y, tag: def.carte });
    }
  }
  /** Case du gardien : à quelques pas de la porte d'entrée de son donjon, du côté du milieu de la carte. */
  private posteDeGarde(donjon: string, tag: string) {
    const wg = this.world.worldGrid!, po = this.world.entreeDonjon(donjon), e = po?.ends[0];
    if (!e || e.tag !== tag) return null;
    const free = (wg.freeByMap.get(tag) ?? []).map(c => wg.cellToWorld(c));
    const mid = free.reduce((a, q) => ({ x: a.x + q.x / free.length, y: a.y + q.y / free.length }), { x: 0, y: 0 });
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const q of free) {
      const d = Math.hypot(q.x - e.x, q.y - e.y);
      if (d < 110 || d > 200) continue;
      const score = Math.abs(d - 140) + 0.25 * Math.hypot(q.x - mid.x, q.y - mid.y);
      if (score < bd) { bd = score; best = q; }
    }
    return best;
  }
  /** Gardien d'un donjon (id du PNJ placé dans ce monde). */
  gardienDe(donjon: string): string | null { return this.pnjs.find(p => p.def.gardien?.donjon === donjon)?.id ?? null; }
  /** PNJ qui vend cette clé (boutiques des PNJ), pour le gardien sans clé (6A) et la carte M. */
  vendeurDe(cle: string): string | null {
    return Object.entries(this.world.opts.boutiques ?? {}).find(([k, l]) => this.data.pnj[k] && Array.isArray(l) && l.some(a => a.id === cle))?.[0] ?? null;
  }
  /** Infos du donjon sous la réplique du gardien (7A + 7B : boss, niveau, salles, clés dans le sac, victoires, butin du boss). */
  infoDonjon(nom: string): InfoDonjon {
    const w = this.world, d = w.zone.open?.donjons?.find(x => x.nom === nom), boss = w.bossDuDonjon(nom), M = w.opts.data.monsters;
    const cle = w.entreeDonjon(nom)?.cle ?? null, I = w.opts.items;
    // butin officiel du boss : équipements d'abord, puis ressources du plus courant au plus rare (sans les caisses à 100 %)
    const l = boss && I ? (I.drops[boss] ?? []).filter(x => (I.equipment[x.item] || I.resources[x.item]) && (I.equipment[x.item] || x.chance < 100)) : [];
    l.sort((x, y) => +!!I!.equipment[y.item] - +!!I!.equipment[x.item] || y.chance - x.chance);
    const butin = [...new Set(l.map(x => x.item))].slice(0, 8);
    const arene = !!d?.arene && !!w.worldGrid?.mapByTag(d.arene.tag), reprise = w.cleValable(nom);
    return { nom, boss: boss ? M[boss].name : null, niveau: boss ? M[boss].level ?? 1 : 1, salles: Object.keys(d?.salles ?? {}).length,
      cle, cles: cle ? w.player.resources[cle] ?? 0 : 0, victoires: this.donjons[nom]?.v ?? 0, butin,
      ...(arene ? { vagues: d!.vagues?.length ?? 0, ...(this.donjons[nom]?.t ? { meilleur: this.donjons[nom].t } : {}), ...(reprise ? { reprise } : {}) } : {}) };
  }
  /** Fin de l'arène (12A) : garde le meilleur temps ; vrai si c'est un nouveau record. */
  tempsDonjon(nom: string, t: number): boolean {
    const b = this.donjons[nom] ??= { v: 0, m: 0 };
    const record = b.t == null || t < b.t;
    if (record) { b.t = Math.round(t * 10) / 10; b.record = true; }
    return record;
  }
  /** Lance les quêtes du départ (le tutoriel, sauté dès le 2e perso si elle le demande). */
  demarrer() {
    for (const [id, q] of Object.entries(this.data.quetes)) {
      if (!q.auDepart) continue;
      // choix « Tutoriel » à la création (world.opts.tuto) ; sans choix, sauté dès le 2e perso du compte (7B)
      const tuto = this.world.opts.tuto ?? !(q.options?.sauterSiCompte && this.compte.persos > 0);
      if (q.type === 'tutoriel' && !tuto) { this.terminer(id, true); continue; }
      this.prendre(id);
      // le tutoriel commence au Temple Céleste ; le point de retour reste le Zaap de la Route des âmes
      if (q.depart && this.world.worldGrid?.mapByTag(q.depart)) {
        const z = this.world.openestCellOf(q.depart), p = this.world.player;
        p.x = z.x; p.y = z.y;
      }
    }
  }

  /** Avancement des quêtes du perso (sauvegarde, src/sim/sauvegarde.ts). */
  exporter(): EtatQuetes {
    return JSON.parse(JSON.stringify({ enCours: this.enCours, finies: [...this.finies], etapesFinies: [...this.etapesFinies], suivie: this.suivie,
      decouvertes: [...this.decouvertes], vaincus: [...this.vaincus], objets: this.objets, donjons: this.donjons, refaites: this.refaites,
      ...(this.tableau ? { tableau: this.tableau } : {}) }));
  }
  /** Reprend une partie sauvegardée au lieu de demarrer() : mêmes quêtes, mêmes étapes, et les élites de l'étape en cours reviennent. */
  reprendre(e: EtatQuetes) {
    this.refaites = { ...e.refaites }; this.tableau = e.tableau ?? null;
    this.enCours = (e.enCours ?? []).filter(c => this.existe(c.id) && this.etapeDe(c));
    // les contrats finis des jours passés ne servent plus à rien
    const vieux = (id: string) => (id.startsWith('ctr:') || id.startsWith('defi:')) && !this.enPeriode(id);
    this.finies = new Set((e.finies ?? []).filter(id => !vieux(id))); this.etapesFinies = new Set((e.etapesFinies ?? []).filter(k => !k.startsWith('ctr:') && !k.startsWith('defi:')));
    this.suivie = e.suivie && this.enCours.some(c => c.id === e.suivie) ? e.suivie : this.enCours[0]?.id ?? null;
    this.decouvertes = new Set(e.decouvertes ?? []); this.vaincus = new Set(e.vaincus ?? []); this.objets = { ...e.objets };
    this.donjons = JSON.parse(JSON.stringify(e.donjons ?? {}));
    for (const c of this.enCours) if (!c.aRendre) this.etapeDe(c)!.objectifs.forEach((o, i) => {
      if (o.t === 'elite' && (c.compte[i] ?? 0) < 1) this.faireApparaitre(c.id, o);
    });
  }

  def(id: string): QueteDef { return this.data.quetes[id] ?? this.ecrireContrat(id) ?? this.ecrireDefi(id)!; }
  /** La quête existe (écrite dans quetes.json, ou contrat dont la sous-zone existe). */
  existe(id: string) { return !!(this.data.quetes[id] ?? this.ecrireContrat(id) ?? this.ecrireDefi(id)); }

  // --- Répétables et contrats du jour (Quêtes roadmap 1C, 3A+3C, 4A) ----------
  /** Aujourd'hui (AAAA-MM-JJ, heure du PC) et la semaine. */
  get jour() { return this.world.opts.aujourdhui ?? ''; }
  periode(rep: 'jour' | 'semaine') { return rep === 'jour' ? this.jour : semaine(this.jour); }
  /** Un contrat de la période en cours (les autres ne sont plus proposés). */
  private enPeriode(id: string) { const p = id.split(':')[1]; return p === this.jour || p === semaine(this.jour); }
  /** Défi du jour d'un donjon en arène (3B) : « defi:<jour>:<donjon> », règle tirée de la date. Rendu au gardien. */
  private ecrireDefi(id: string): QueteDef | null {
    if (!id.startsWith('defi:')) return null;
    if (this.dyn.has(id)) return this.dyn.get(id)!;
    const [, jour, donjon] = id.split(':'), w = this.world, boss = w.bossDuDonjon(donjon), g = this.gardienDe(donjon);
    let q: QueteDef | null = null;
    if (boss && g) {
      const M = w.opts.data.monsters[boss], lvl = M.level ?? 20, chrono = hache(id) % 2 === 1, s = 240 + Math.round(lvl / 10) * 30;
      const o: ObjectifDef = chrono ? { t: 'defi', donjon, regle: 'chrono', s, texte: `Vaincre ${M.name} en moins de ${chronoTexte(s)} après l'entrée` }
        : { t: 'defi', donjon, regle: 'sansPotion', texte: `Vaincre ${M.name} sans boire de potion` };
      q = { nom: `Défi du jour : ${chrono ? 'contre la montre' : 'sans potion'}`, type: 'prime', pnj: g, rendre: g, niveau: lvl, serie: 'Défi de donjon', contrat: jour,
        texte: `${donjon}, une fois par jour. ${chrono ? `Le chrono part quand tu passes la porte : ${chronoTexte(s)} pour atteindre le boss et le battre.` : 'Pas une gorgée de potion entre la porte et le boss.'} Si tu rates, ressors et retente.`,
        etapes: [{ nom: donjon, objectifs: [o] }], recompense: { xp: Math.round(4 * lvl * 50), kamas: Math.round(4 * lvl * 10), sac: 'epique', pepites: lvl } };
    }
    this.dyn.set(id, q);
    return q;
  }
  /** Défi du jour de ce donjon, s'il est encore à prendre. */
  defiLibre(donjon: string): string | null {
    const id = `defi:${this.jour}:${donjon}`;
    return this.jour && this.existe(id) && !this.finies.has(id) && !this.enCours.some(c => c.id === id) ? id : null;
  }
  private ecrireContrat(id: string): QueteDef | null {
    if (!id.startsWith('ctr:')) return null;
    if (!this.dyn.has(id)) this.dyn.set(id, contrat(id, this.ctxContrats()));
    return this.dyn.get(id)!;
  }
  /** Ce que src/sim/contrats.ts doit savoir de la zone. */
  private ctxContrats(): CtxContrats {
    const w = this.world, I = w.opts.items, M = w.opts.data.monsters, wg = w.worldGrid;
    const pnj = Object.entries(this.data.pnj).find(([, d]) => d.contrats && (d.zone ?? 'incarnam') === w.opts.zone)?.[0] ?? '';
    return { sousZones: Object.fromEntries(Object.entries(w.zone.open?.subareas ?? {}).filter(([, s]) => s.monsters.length)),
      nomMonstre: id => M[id]?.name ?? id,
      ressourcesDe: id => (I?.drops[id] ?? []).filter(d => I!.resources[d.item] && d.chance >= 5 && d.chance < 100).map(d => d.item),
      nomRessource: id => I?.resources[id]?.name ?? id,
      cartesDe: sub => (wg?.world.maps ?? []).filter(m => String(m.sub) === sub && (wg!.freeByMap.get(m.tag)?.length ?? 0) > 40).map(m => m.tag),
      titres: this.data.contrats?.titres ?? {}, pnj };
  }
  /** Les contrats du tableau (3 du jour + 1 de la semaine), tirés au premier coup d'œil de la période. */
  contrats(): string[] {
    const j = this.jour, s = semaine(j), lvl = this.world.player.level, ctx = this.ctxContrats();
    if (!j || !ctx.pnj) return [];
    const t = this.tableau ??= { jour: '', ids: [], semaine: '', hebdo: [] };
    if (t.jour !== j) { t.jour = j; t.ids = tirerContrats(j, false, lvl, ctx); }
    if (t.semaine !== s) { t.semaine = s; t.hebdo = tirerContrats(s, true, lvl, ctx); }
    return [...t.ids, ...t.hebdo].filter(id => this.existe(id));
  }
  /** Contrats qu'on peut encore prendre (ni en cours, ni finis cette période). */
  contratsLibres(): string[] { return this.contrats().filter(id => !this.finies.has(id) && !this.enCours.some(c => c.id === id)); }
  /** Une répétable finie peut être reprise à la période suivante. */
  private reprenable(id: string) { const q = this.def(id); return !!q.repetable && this.refaites[id] !== this.periode(q.repetable); }
  etapes(id: string): EtapeDef[] {
    const e = this.def(id).etapes;
    return Array.isArray(e) ? e : e[this.classe] ?? Object.values(e)[0];
  }
  etapeDe(q: QueteEnCours): EtapeDef | undefined { return this.etapes(q.id)[q.etape]; }
  pnj(id: string) { return this.pnjs.find(p => p.id === id); }

  /** Quête que ce PNJ peut donner maintenant (niveau, quêtes requises). */
  aDonner(pnj: string): string | null { return this.aDonnerTous(pnj)[0] ?? null; }
  /** Toutes les quêtes que ce PNJ peut donner maintenant (5C : listées comme réponses). */
  aDonnerTous(pnj: string): string[] {
    const lvl = this.world.player.level, out: string[] = [];
    for (const [id, q] of Object.entries(this.data.quetes)) {
      if (q.pnj !== pnj || q.bientot || (this.finies.has(id) && !this.reprenable(id)) || this.enCours.some(c => c.id === id) || q.auDepart) continue;
      if (q.niveau > lvl + 2 || !(q.requiert ?? []).every(r => this.finies.has(r))) continue;
      // une quête qui suit une autre (fil principal) démarre seule à la fin de la précédente : son PNJ ne la propose pas
      if (Object.values(this.data.quetes).some(o => o.suivante === id)) continue;
      out.push(id);
    }
    return out;
  }
  /** Quête finie qui attend d'être rendue à ce PNJ. */
  aRendre(pnj: string): string | null {
    return this.enCours.find(c => c.aRendre && this.def(c.id).rendre === pnj)?.id ?? null;
  }
  /** Icône officielle au-dessus d'un PNJ (8D) : quête à donner, à rendre, ou rien. */
  icone(pnj: string): { quete: string; rendre: boolean } | null {
    const r = this.aRendre(pnj); if (r) return { quete: r, rendre: true };
    const def = this.data.pnj[pnj];
    const d = this.aDonner(pnj) ?? (def?.contrats ? this.contratsLibres()[0] : null) ?? (def?.gardien ? this.defiLibre(def.gardien.donjon) : null);
    return d ? { quete: d, rendre: false } : null;
  }
  /** Le PNJ attend qu'on lui parle pour un objectif « parler ». */
  attendParler(pnj: string): string | null {
    return this.enCours.find(c => !c.aRendre && this.etapeDe(c)?.objectifs.some((o, i) => o.t === 'parler' && o.pnj === pnj && c.compte[i] < 1))?.id ?? null;
  }

  prendre(id: string) {
    if (this.finies.has(id) && this.existe(id) && this.reprenable(id)) this.finies.delete(id);
    if (this.finies.has(id) || this.enCours.some(c => c.id === id) || !this.existe(id)) return;
    const c: QueteEnCours = { id, etape: 0, compte: [], aRendre: false };
    this.enCours.push(c);
    this.suivie ??= id;
    if (this.def(id).type === 'principale' || this.def(id).type === 'tutoriel') this.suivie = id;
    this.world.emit({ k: 'queteDebut', id });
    this.entrerEtape(c);
  }
  private entrerEtape(c: QueteEnCours) {
    const e = this.etapeDe(c)!, q = this.def(c.id);
    c.compte = e.objectifs.map(() => 0);
    const qui = e.pnj ?? q.pnj;
    if (e.bulle && qui) this.dire(qui, e.bulle);
    for (const o of this.dons(e)) this.world.donnerObjet(o);
    for (const o of e.objectifs) if (o.t === 'elite') this.faireApparaitre(c.id, o);
    this.world.emit({ k: 'queteEtape', id: c.id, etape: c.etape });
    this.verifier();
  }
  private faireApparaitre(quete: string, o: Extract<ObjectifDef, { t: 'elite' }>) {
    const w = this.world, base = w.opts.data.monsters[o.monstre];
    if (!base || !w.worldGrid?.mapByTag(o.carte)) return;
    const q = w.openestCellOf(o.carte);
    const m = w.spawnMonster(o.monstre, q.x, q.y, { ...base, elite: true, hp: Math.round(base.hp * (o.pv ?? 3)), name: o.nom ?? base.name, xp: (base.xp ?? Math.round(base.hp / 5)) * 3 });
    this.elites.set(m.id, quete);
  }
  dire(pnj: string, texte: string) { this.bulle = { pnj, texte, t: 5 }; this.world.emit({ k: 'bulle', pnj, texte }); }

  /** Clic sur un PNJ : le perso y va ; à portée, il prend la quête, la rend ou lui parle. */
  cliquer(pnj: string) { this.versPnj = pnj; }
  annulerClic() { this.versPnj = null; }
  /** Ouvre tout de suite le dialogue d'un PNJ (porte d'un donjon gardé : le gardien se tient à côté). */
  parlerA(pnj: string) { this.versPnj = null; if (this.dialogue?.pnj !== pnj) this.parler(pnj); }
  get destination() { const p = this.versPnj && this.pnj(this.versPnj); return p ? { x: p.x, y: p.y } : null; }
  /** À portée du PNJ : il valide ce qui l'attend (rendu 6B, objectif « parler »), puis ouvre le dialogue. */
  private parler(pnj: string) {
    const avant = this.bulle;
    let intro: string | null = null;
    const r = this.aRendre(pnj);
    if (r) { this.terminer(r); intro = this.def(r).merci ?? 'Beau travail. Voici ta récompense.'; }
    else if (this.attendParler(pnj)) {
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        if (o.t === 'parler' && o.pnj === pnj && (!o.objet || (this.objets[o.objet] ?? 0) > 0)) c.compte[i] = 1;
      });
      this.verifier();
    }
    // la bulle de l'étape qui vient de commencer, dite par ce PNJ, passe dans le dialogue
    if (this.bulle && this.bulle !== avant && this.bulle.pnj === pnj) { intro = intro ? `${intro} ${this.bulle.texte}` : this.bulle.texte; this.bulle = null; }
    this.ouvrir(pnj, intro);
  }
  /** Ouvre le dialogue : une seule quête à donner = son offre (5A), plusieurs = la liste (5C), aucune = sa phrase (10A). */
  private ouvrir(pnj: string, intro: string | null, liste = false) {
    const ds = this.aDonnerTous(pnj), def = this.data.pnj[pnj], dis = def?.discussion?.[0];
    if (def?.gardien) { this.garder(pnj, def, intro, ds); return; }
    if (ds.length === 1 && !liste && !def?.contrats) { this.offre(pnj, ds[0], intro); return; }
    this.dialogue = { pnj, texte: intro ?? def?.phrase ?? 'Bonne route, aventurier.',
      reponses: [...ds.map(id => ({ a: 'voir' as const, quete: id, texte: this.def(id).nom })),
        ...(def?.contrats ? [{ a: 'contrats' as const, texte: 'Le tableau des contrats.', detail: `${this.contratsLibres().length} à prendre` }] : []),
        ...(def?.services ?? []).map(s => ({ a: 'service' as const, service: s.service, texte: s.texte })),
        ...(dis && !ds.length ? [{ a: 'suite' as const, i: 0, texte: dis.reponse }] : []),
        { a: 'fermer', texte: def?.adieu ?? 'Au revoir.' }] };
  }
  /** Dialogue d'un gardien : sa réplique (ou ce qu'il pense de ta dernière visite), les infos du donjon, « Entrer ». */
  private garder(pnj: string, def: PnjDef, intro: string | null, ds: string[]) {
    const g = def.gardien!, b = this.donjons[g.donjon], info = this.infoDonjon(g.donjon);
    // 12A : après une victoire, il commente ton temps (record ou non)
    const temps = b?.dernier === 'v' && b.t ? (b.record ? ` Nouveau record : ${chrono(b.t)} !` : ` Ton meilleur temps reste ${chrono(b.t)}.`) : '';
    const dernier = b?.dernier === 'v' ? g.victoire + temps : b?.dernier === 'm' ? g.mort : null;
    if (b) { delete b.dernier; delete b.record; }
    const nomCle = info.cle ? this.world.opts.items?.resources[info.cle]?.name ?? 'clé' : null;
    const entrer: Reponse = info.reprise
      ? { a: 'entrer', donjon: g.donjon, texte: 'Y retourner.', detail: `clé encore valable, vague ${Math.min(info.reprise, info.vagues ?? info.reprise)}${info.reprise > (info.vagues ?? 99) ? ' (boss)' : ''}` }
      : !info.cle || info.cles > 0
      ? { a: 'entrer', donjon: g.donjon, texte: 'Entrer.', ...(nomCle ? { detail: `utiliser 1 ${nomCle}` } : {}) }
      : { a: 'sansCle', donjon: g.donjon, texte: "Je n'ai pas de clé." };
    const dis = def.discussion?.[0];
    this.dialogue = { pnj, donjon: info, texte: intro ?? dernier ?? def.phrase ?? 'Bonne route, aventurier.',
      reponses: [entrer, ...[...ds, ...(this.defiLibre(g.donjon) ? [this.defiLibre(g.donjon)!] : [])].map(id => ({ a: 'voir' as const, quete: id, texte: this.def(id).nom })),
        ...(dis ? [{ a: 'suite' as const, i: 0, texte: dis.reponse }] : []), { a: 'fermer' as const, texte: def.adieu ?? 'Au revoir.' }].slice(0, 4) };
    if (this.dialogue.reponses.at(-1)!.a !== 'fermer') this.dialogue.reponses[3] = { a: 'fermer', texte: def.adieu ?? 'Au revoir.' };
  }
  /** Suite de la discussion officielle : le texte n, puis la réponse vers le n + 1 (ou l'adieu). */
  private suite(pnj: string, i: number) {
    const def = this.data.pnj[pnj], l = def?.discussion ?? [], n = l[i + 1];
    if (!l[i]) { this.ouvrir(pnj, null); return; }
    if (def.gardien && !n) { this.ouvrir(pnj, l[i].texte); return; }   // le gardien répond, puis « Entrer » revient
    this.dialogue = { pnj, texte: l[i].texte, reponses: [...(n ? [{ a: 'suite' as const, i: i + 1, texte: n.reponse }] : []),
      ...(def?.services ?? []).map(s => ({ a: 'service' as const, service: s.service, texte: s.texte })).slice(0, n ? 2 : 3),
      { a: 'fermer', texte: def?.adieu ?? 'Au revoir.' }] };
  }
  /** Le tableau des contrats (3C) : ceux du jour et celui de la semaine, ou « reviens demain ». */
  private tableauContrats(pnj: string) {
    const l = this.contratsLibres(), fait = this.contrats().length - l.length;
    this.dialogue = { pnj, texte: l.length ? `Voilà les contrats du jour. Ils changent à minuit, celui de la semaine change le lundi.${fait ? ` Tu en as déjà pris ${fait}.` : ''}`
      : "Plus rien pour aujourd'hui. Reviens demain, les fauteurs de troubles d'Astrub ne prennent jamais de vacances.",
      reponses: [...l.map(id => ({ a: 'voir' as const, quete: id, texte: this.def(id).nom, detail: `niv ${this.def(id).niveau}` })),
        { a: 'retour', texte: 'Retour.' }, { a: 'fermer', texte: 'Au revoir.' }] };
  }
  private offre(pnj: string, id: string, intro: string | null) {
    const q = this.def(id);
    this.dialogue = { pnj, quete: id, recompense: q.recompense, texte: intro ? `${intro}\n\n${q.texte}` : q.texte, reponses: [
      { a: 'accepter', quete: id, texte: 'Accepter.', detail: q.nom }, { a: 'retour', texte: 'Plus tard.' }, { a: 'fermer', texte: 'Au revoir.' }] };
  }
  /** Réponse choisie (clic sur le cadre vert ou touches 1 à 4) ; -1 = croix ou Échap. */
  repondre(i: number) {
    const d = this.dialogue; if (!d) return;
    const r = d.reponses[i];
    if (i < 0 || r?.a === 'fermer') { this.dialogue = null; return; }
    if (!r) return;
    if (r.a === 'retour') this.ouvrir(d.pnj, null, true);
    else if (r.a === 'voir') this.offre(d.pnj, r.quete, null);
    else if (r.a === 'suite') this.suite(d.pnj, r.i);
    else if (r.a === 'entrer') { this.dialogue = null; this.world.entrerDonjon(r.donjon); }
    else if (r.a === 'sansCle') {
      const def = this.data.pnj[d.pnj], cle = this.world.entreeDonjon(r.donjon)?.cle ?? '', v = this.vendeurDe(cle);
      const vendeur = v ? `${this.data.pnj[v].nom}, au Bastion des Douze (par un Zaap),` : "Un marchand d'Astrub";
      const t = (def?.gardien?.sansCle ?? "Sans clé, la porte ne s'ouvre pas. {vendeur} en vend.").replace('{vendeur}', vendeur);
      this.marqueVendeur = v;
      this.dialogue = { pnj: d.pnj, donjon: d.donjon, texte: t, reponses: [{ a: 'fermer', texte: def?.adieu ?? 'Au revoir.' }] };
    }
    else if (r.a === 'contrats') this.tableauContrats(d.pnj);
    else if (r.a === 'service') { this.dialogue = null; this.world.emit({ k: 'service', service: r.service, pnj: d.pnj }); }
    else { this.dialogue = null; this.prendre(r.quete); this.suivie = r.quete; }
  }

  /** Un événement de la simulation fait avancer les objectifs et les succès. */
  observer(e: SimEvent) {
    const w = this.world;
    if (e.k === 'kill') {
      this.vaincus.add(e.monster);
      const ici = w.donjonIci();   // victoire sur le boss du donjon (8A)
      if (ici && w.bossDuDonjon(ici) === e.monster) {
        const b = this.donjons[ici] ??= { v: 0, m: 0 }; b.v++; b.dernier = 'v';
        const tps = this.dansDonjon?.nom === ici ? w.time - this.dansDonjon.t : Infinity;
        for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
          if (o.t !== 'defi' || o.donjon !== ici) return;
          const ok = o.regle === 'sansPotion' ? !this.potionDonjon && this.dansDonjon?.nom === ici : tps <= (o.s ?? 300);
          if (ok) c.compte[i] = 1; else w.emit({ k: 'queteInfo', texte: o.regle === 'sansPotion' ? 'Défi raté : une potion a été bue.' : `Défi raté : ${chronoTexte(tps)}, trop lent.` });
        });
        if (!b.premier) b.premier = { ...(w.opts.aujourdhui ? { d: w.opts.aujourdhui } : {}),
          ...(this.dansDonjon?.nom === ici ? { t: Math.round(w.time - this.dansDonjon.t) } : {}) };
      }
      const sub = w.worldGrid?.mapAt(e.x, e.y)?.sub;
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        const okSub = !('sousZone' in o) || o.sousZone == null || o.sousZone === sub;
        if (o.t === 'vaincre' && okSub && (!o.monstres || o.monstres.includes(e.monster))) c.compte[i] = Math.min(o.n, c.compte[i] + 1);
        if (o.t === 'ramasser' && okSub && (!o.monstres || o.monstres.includes(e.monster)) && c.compte[i] < o.n && w.rng.next() < o.chance) {
          c.compte[i]++; this.objets[o.objet] = (this.objets[o.objet] ?? 0) + 1;
          w.emit({ k: 'objetQuete', nom: o.objet, n: c.compte[i], sur: o.n });
        }
      });
    } else if (e.k === 'cast' || e.k === 'rageSpent' || e.k === 'potion') {
      const p = w.player;
      if (e.k === 'potion' && this.dansDonjon) this.potionDonjon = true;
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        if (o.t !== 'utiliser') return;
        const ok = e.k === 'potion' ? o.quoi === 'potion'
          : e.k === 'rageSpent' ? o.quoi === 'jauge'
          : (o.sort && o.sort === e.id) || (o.quoi === 'mobilite' && e.id === p.cls.mobility) || (o.quoi === 'sort' && e.id !== p.cls.mobility && e.id !== 'attaque');
        if (ok) c.compte[i] = 1;
      });
    } else if (e.k === 'playerDeath') {
      const ici = w.donjonIci();
      if (ici) { const b = this.donjons[ici] ??= { v: 0, m: 0 }; b.m++; b.dernier = 'm'; }
      return;
    } else if (e.k === 'playerHurt') {
      this.dialogue = null;   // un coup reçu ferme le dialogue (4B)
      return;
    } else if (e.k === 'checkpoint') {
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => { if (o.t === 'activer' && o.zaap === e.name) c.compte[i] = 1; });
    } else if (e.k === 'lootResource' || e.k === 'craft') {
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        if (o.t === 'recolter' && e.k === 'lootResource' && o.ressource === e.id) c.compte[i] = Math.min(o.n, c.compte[i] + e.n);
        if (o.t === 'fabriquer' && e.k === 'craft' && o.objet === e.id) c.compte[i] = Math.min(o.n ?? 1, c.compte[i] + e.n);
      });
    } else return;
    this.verifier();
  }
  /** Élite de quête vaincu. */
  eliteVaincu(id: number) {
    const q = this.elites.get(id); if (!q) return;
    this.elites.delete(id);
    const c = this.enCours.find(x => x.id === q);
    this.etapeDe(c!)?.objectifs.forEach((o, i) => { if (o.t === 'elite') c!.compte[i] = 1; });
  }
  estEliteDeQuete(id: number) { return this.elites.has(id); }

  /** Chaque pas : objectifs d'état (sous-zone, PNJ proche, objet équipé), clic sur un PNJ, bulle. */
  update(dt: number) {
    const w = this.world, p = w.player, map = w.worldGrid?.mapAt(p.x, p.y);
    if (this.bulle && (this.bulle.t -= dt) <= 0) this.bulle = null;
    if (this.dialogue) {   // s'éloigner du PNJ ferme le dialogue (4B)
      const n = this.pnj(this.dialogue.pnj);
      if (!n || p.dead || Math.hypot(n.x - p.x, n.y - p.y) > Quetes.DIALOGUE_MAX) this.dialogue = null;
    }
    if (map) this.decouvertes.add(map.sub);
    const ici = map?.inside ? w.donjonIci() : null;   // entrée dans un donjon : départ du chrono du premier passage
    if (ici !== (this.dansDonjon?.nom ?? null)) { this.dansDonjon = ici ? { nom: ici, t: w.time } : null; this.potionDonjon = false; }
    this.majDefense(dt, map?.tag ?? null);
    this.majCourse(dt, map?.tag ?? null);
    // bulle du gardien quand on passe devant (9A), une fois par visite
    for (const n of this.pnjs) {
      if (!n.def.gardien) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d > 900) this.salues.delete(n.id);
      else if (d < 380 && !this.salues.has(n.id) && !this.dialogue && !this.bulle && !p.dead) { this.salues.add(n.id); this.dire(n.id, n.def.gardien.approche); }
    }
    // quêtes sans PNJ : elles démarrent seules en entrant dans leur sous-zone
    if (map) for (const [id, q] of Object.entries(this.data.quetes))
      if (q.zone === map.sub && !q.pnj && !this.finies.has(id) && !this.enCours.some(c => c.id === id) && p.level + 2 >= q.niveau
        && (q.requiert ?? []).every(r => this.finies.has(r))) this.prendre(id);
    if (this.versPnj) {
      const n = this.pnj(this.versPnj);
      if (!n || p.dead) this.versPnj = null;
      else if (Math.hypot(n.x - p.x, n.y - p.y) < Quetes.PORTEE) { const id = this.versPnj; this.versPnj = null; p.stopMove(); this.parler(id); }
    }
    for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
      if (c.compte[i] >= 1 && o.t !== 'vaincre' && o.t !== 'ramasser' && o.t !== 'recolter' && o.t !== 'fabriquer') return;
      if (o.t === 'aller') {
        const n = o.pnj ? this.pnj(o.pnj) : null;
        if ((o.sousZone != null && map?.sub === o.sousZone) || (o.carte && map?.tag === o.carte) || (n && Math.hypot(n.x - p.x, n.y - p.y) < Quetes.PORTEE * 1.6)) c.compte[i] = 1;
      } else if (o.t === 'donjon') {
        if ((this.donjons[o.donjon]?.v ?? 0) > 0) c.compte[i] = 1;
      } else if (o.t === 'niveau') {
        if (p.level >= o.n) c.compte[i] = 1;
      } else if (o.t === 'equiper') {
        const portes = Object.values(p.equipment).filter(it => it).map(it => it!.id);
        if (o.objets ? o.objets.every(id => portes.includes(id)) : portes.some(id => !o.objet || id === o.objet)) c.compte[i] = 1;
      }
    });
    this.verifier();
    // succès de niveau et de sous-zone découverte
    this.verifierSucces();
  }

  /** Total d'un objectif (pour le suivi : « 2/4 »). */
  total(o: ObjectifDef): number { return o.t === 'vaincre' || o.t === 'ramasser' || o.t === 'recolter' ? o.n : o.t === 'fabriquer' ? o.n ?? 1 : o.t === 'defense' ? o.s : 1; }

  /** Objectif pas fini de ce type dans les quêtes en cours (le premier). */
  private objectifActif<T extends ObjectifDef['t']>(t: T, carte: string | null): { c: QueteEnCours; i: number; o: Extract<ObjectifDef, { t: T }> } | null {
    if (!carte) return null;
    for (const c of this.enCours) {
      if (c.aRendre) continue;
      const e = this.etapeDe(c); if (!e) continue;
      for (let i = 0; i < e.objectifs.length; i++) {
        const o = e.objectifs[i] as ObjectifDef;
        if (o.t === t && 'carte' in o && o.carte === carte && c.compte[i] < this.total(o)) return { c, i, o: o as Extract<ObjectifDef, { t: T }> };
      }
    }
    return null;
  }
  /** Défense (6A) : sur la carte, le temps tenu monte et une vague arrive toutes les 12 s ; quitter la carte ou mourir remet à zéro. */
  private majDefense(dt: number, carte: string | null) {
    const w = this.world, p = w.player, a = this.objectifActif('defense', carte);
    if (!a && this.defense && !p.dead && (this.defense.hors += dt) < 3) return;   // repoussé hors de la carte un instant : on tient encore
    if (!a || p.dead) {
      if (this.defense) { const c = this.enCours.find(x => x.id === this.defense!.q); if (c && c.compte[this.defense.i] < this.total(this.etapeDe(c)!.objectifs[this.defense.i])) c.compte[this.defense.i] = 0; this.defense = null; }
      return;
    }
    const d = this.defense ??= { q: a.c.id, i: a.i, t: 0, vague: 0, hors: 0 };
    d.hors = 0; d.t += dt; d.vague -= dt;
    if (d.vague <= 0) {
      d.vague = 12;
      const sub = w.worldGrid?.mapByTag(a.o.carte)?.sub, sz = w.zone.open?.subareas[String(sub)], free = w.worldGrid?.freeByMap.get(a.o.carte) ?? [];
      if (sz?.monsters.length && free.length) for (let k = 0; k < 3; k++) {
        const ang = w.rng.range(0, Math.PI * 2), z = w.worldGrid!.nearestFree(p.x + Math.cos(ang) * 320, p.y + Math.sin(ang) * 220, free);
        w.spawnMonster(w.rng.pick(sz.monsters), z.x, z.y);
      }
      if (d.t < 1) w.emit({ k: 'queteInfo', texte: `Tiens bon ${a.o.s} secondes !` });
    }
    a.c.compte[a.i] = Math.min(a.o.s, Math.floor(d.t));
    if (d.t >= a.o.s) this.defense = null;
  }
  /** Contre la montre (6D) : le chrono part à l'entrée sur la carte ; carte vidée à temps = fait, sinon il faut ressortir et revenir. */
  private majCourse(dt: number, carte: string | null) {
    const w = this.world, a = this.objectifActif('chrono', carte);
    if (!a) { this.course = null; return; }
    if (!this.course || this.course.q !== a.c.id) { this.course = { q: a.c.id, i: a.i, t: 0, n0: 0 }; w.emit({ k: 'queteInfo', texte: `Chrono lancé : ${chronoTexte(a.o.s)} pour vider la carte !` }); }
    const k = this.course; if (k.t < 0) return;   // raté : attendre de ressortir
    k.t += dt;
    const wg = w.worldGrid!, restants = w.monsters.filter(m => !m.dead && wg.mapAt(m.x, m.y)?.tag === a.o.carte && !this.elites.has(m.id)).length;
    k.n0 = Math.max(k.n0, restants);
    if (restants === 0 && k.n0 > 0) { a.c.compte[a.i] = 1; this.course = null; }
    else if (k.t > a.o.s) { k.t = -1; w.emit({ k: 'queteInfo', texte: `Trop lent ! Ressors de la carte et reviens pour retenter.` }); }
  }

  /** Étapes finies -> étape suivante, puis rendu ou fin de quête. */
  private verifier() {
    for (const c of [...this.enCours]) {
      const e = this.etapeDe(c);
      if (!e || c.aRendre || !e.objectifs.every((o, i) => c.compte[i] >= this.total(o))) continue;
      this.etapesFinies.add(`${c.id}:${c.etape}`);
      c.etape++;
      if (c.etape < this.etapes(c.id).length) { this.entrerEtape(c); continue; }
      const q = this.def(c.id);
      if (q.rendre && this.pnj(q.rendre)) { c.aRendre = true; this.world.emit({ k: 'queteEtape', id: c.id, etape: c.etape }); }
      else this.terminer(c.id);
    }
  }
  /** Fin de la quête : récompense, quête suivante, succès. sautee = passée (tutoriel au 2e perso, bouton Passer). */
  terminer(id: string, sautee = false) {
    const q = this.def(id), w = this.world, p = w.player, c = this.enCours.find(x => x.id === id);
    this.enCours = this.enCours.filter(c => c.id !== id);
    if (this.finies.has(id)) return;
    if (q.repetable) this.refaites[id] = this.periode(q.repetable);
    // quête passée : les objets des étapes pas encore atteintes sont quand même donnés et portés (équipement de départ du tutoriel)
    if (sautee) {
      const dons = this.etapes(id).flatMap((e, i) => i > (c?.etape ?? -1) ? this.dons(e) : []);
      for (const o of dons) w.donnerObjet(o);
      for (const it of p.bag.filter(b => dons.includes(b.id))) { const s = p.slotFor(it); if (s && !p.equipment[s]) p.equip(it.uid, s); }
    }
    this.finies.add(id);
    this.etapes(id).forEach((_, i) => this.etapesFinies.add(`${id}:${i}`));
    for (const [m, qid] of this.elites) if (qid === id) { this.elites.delete(m); }
    const r = q.recompense;
    if (r.niveau) while (p.level < r.niveau && p.level < p.cls.maxLevel) p.gainXp(p.xpNeeded - p.xp, w);
    if (r.xp) p.gainXp(r.xp, w);
    if (r.kamas) p.kamas += r.kamas;
    if (r.potions) p.potions = p.cls.potion.charges;
    const obj = r.objetParClasse?.[this.classe] ?? r.objet;
    if (obj) w.donnerObjet(obj);
    for (const [o, n] of r.objets ?? []) w.donnerObjet(o, n);
    if (r.sac) w.donnerSac(r.sac, q.niveau);
    if (r.pepites) w.donnerObjet(PEPITE, r.pepites);
    for (const o of this.etapes(id).flatMap(e => e.objectifs)) if (o.t === 'ramasser') delete this.objets[o.objet];
    if (this.suivie === id) this.suivie = null;
    w.emit({ k: 'queteFin', id, sautee });
    const wg = w.worldGrid, ici = wg?.mapAt(p.x, p.y), dep = q.depart ? wg?.mapByTag(q.depart) : null;
    if (q.arrivee && wg?.mapByTag(q.arrivee) && ici && dep && ici.sub === dep.sub) {
      const z = q.arriveeCase != null ? wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(q.arrivee, q.arriveeCase))), wg.freeByMap.get(q.arrivee)) : w.openestCellOf(q.arrivee);
      p.x = z.x; p.y = z.y; p.kx = p.ky = 0; p.z = 0; p.stopMove();
      w.emit({ k: 'portal', nom: this.def(id).nom });
    }
    if (q.suivante) this.prendre(q.suivante);
    this.suivie ??= this.enCours[0]?.id ?? null;
    this.verifierSucces();
  }
  /** Objets donnés au début d'une étape, pour la classe du perso. */
  private dons(e: EtapeDef): string[] {
    const don = typeof e.donner === 'string' || Array.isArray(e.donner) ? e.donner : e.donner?.[this.classe];
    return don == null ? [] : Array.isArray(don) ? don : [don];
  }
  /** Bouton « Passer » (7A) : la quête est donnée comme finie. */
  passer(id: string) { if (this.enCours.some(c => c.id === id) && this.def(id).options?.passable) this.terminer(id, true); }

  /** Option du tutoriel : PV bloqués à 1. */
  /** Option du tutoriel : multiplicateur de la jauge de classe. */
  get jaugeX() { let k = 1; for (const c of this.enCours) k = Math.max(k, this.def(c.id).options?.jauge ?? 1); return k; }
  get immortel() { return this.enCours.some(c => this.def(c.id).options?.immortel); }
  /** Option du tutoriel : taille des groupes dans une sous-zone pendant la quête. */
  /** Faux tant qu'une quête en cours retient les groupes de cette sous-zone (étape pas encore atteinte). */
  groupesPrets(sub: number): boolean {
    for (const c of this.enCours) { const g = this.def(c.id).options?.groupes; if (g?.etape != null && g.sousZones.includes(sub) && c.etape < g.etape) return false; }
    return true;
  }
  tailleGroupe(sub: number): [number, number] | null {
    for (const c of this.enCours) { const g = this.def(c.id).options?.groupes; if (g?.sousZones.includes(sub)) return g.taille; }
    return null;
  }

  // --- Succès (12A, 13A+13C, 14A+14B, 15A) ------------------------------------
  objectifSuccesFait(o: SuccesObjectif): boolean {
    if ('quete' in o) return this.finies.has(o.quete);
    if ('etape' in o) return this.etapesFinies.has(`${o.etape[0]}:${o.etape[1]}`);
    if ('succes' in o) return this.succes.has(o.succes);
    if ('sousZone' in o) return this.decouvertes.has(o.sousZone);
    if ('niveau' in o) return this.world.player.level >= o.niveau;
    if ('apparence' in o) return this.world.player.apparats.includes(o.apparence);
    return this.vaincus.has(o.monstre);
  }
  private verifierSucces() {
    let encore = true;
    while (encore) {
      encore = false;
      for (const [id, s] of Object.entries(this.data.succes)) {
        if (this.succes.has(id) || !s.objectifs.every(o => this.objectifSuccesFait(o))) continue;
        this.succes.add(id); encore = true;
        const w = this.world;
        if (s.recompense?.xp) w.player.gainXp(s.recompense.xp, w);
        if (s.recompense?.objet) w.donnerObjet(s.recompense.objet);
        w.emit({ k: 'succes', id });
      }
    }
  }
  /** Titre du perso (Tour 7A) : celui du dernier succès obtenu qui en donne un. */
  get titre(): string | null {
    let t: string | null = null;
    for (const id of this.succes) t = this.data.succes[id]?.recompense?.titre ?? t;
    return t;
  }
  /** Carnet de route (Tour 8B) : une page par donjon du tour du monde, dans l'ordre des chapitres. */
  carnet(): PageCarnet[] {
    const out: PageCarnet[] = []; let n = 0;
    for (const [, q] of Object.entries(this.data.quetes)) {
      if (q.serie !== 'Le tour du monde') continue;
      n++;
      for (const e of Array.isArray(q.etapes) ? q.etapes : []) for (const o of e.objectifs) if (o.t === 'donjon') {
        const b = this.donjons[o.donjon];
        out.push({ donjon: o.donjon, boss: o.boss, niveau: o.niveau, region: o.region, chapitre: n, nomChapitre: q.nom, bientot: !!q.bientot,
          premier: b?.v ? b.premier ?? {} : null, victoires: b?.v ?? 0 });
      }
    }
    return out;
  }
  /** Points de succès du compte. */
  get points() { return [...this.succes].reduce((n, id) => n + (this.data.succes[id]?.points ?? 0), 0); }

  /** Où aller pour la quête suivie (point sur la mini-carte, flèche au bord de l'écran) : le premier objectif pas fini. */
  cible(): { x: number; y: number } | null {
    const t = this.cibleBrute(), w = this.world, wg = w.worldGrid, p = w.player;
    if (!t || !wg) return t;
    // dans un intérieur (Temple Céleste…), viser la porte qui rapproche du but plutôt que le but à travers le vide
    const ici = wg.mapAt(p.x, p.y), la = wg.mapAt(t.x, t.y);
    if (!ici?.inside || la?.tag === ici.tag) return t;
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const po of w.portes) for (let i = 0; i < 2; i++) {
      if (i === 1 && po.sens) continue;
      const a = po.ends[i], b = po.ends[1 - i];
      if (a.tag !== ici.tag) continue;
      const d = Math.hypot(b.x - t.x, b.y - t.y);
      if (d < bd) { bd = d; best = { x: a.x, y: a.y }; }
    }
    return best ?? t;
  }
  private cibleBrute(): { x: number; y: number } | null {
    const c = this.enCours.find(x => x.id === this.suivie) ?? this.enCours[0];
    if (!c) return null;
    const w = this.world, wg = w.worldGrid, p = w.player, q = this.def(c.id);
    if (c.aRendre) { const n = this.pnj(q.rendre!); return n ? { x: n.x, y: n.y } : null; }
    const e = this.etapeDe(c); if (!e || !wg) return null;
    const proche = (pred: (sub: number, tag: string) => boolean) => {
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (const m of wg.world.maps) {
        if (!pred(m.sub, m.tag) || !wg.freeByMap.get(m.tag)?.length) continue;
        const z = w.openestCellOf(m.tag), d = Math.hypot(z.x - p.x, z.y - p.y);
        if (d < bd) { bd = d; best = z; }
      }
      return best;
    };
    for (let i = 0; i < e.objectifs.length; i++) {
      const o = e.objectifs[i];
      if (c.compte[i] >= this.total(o)) continue;
      if ((o.t === 'aller' || o.t === 'parler') && o.pnj) { const n = this.pnj(o.pnj); if (n) return { x: n.x, y: n.y }; }
      if (o.t === 'aller' && o.carte) return proche((_, t) => t === o.carte);
      if (o.t === 'elite') {
        const m = w.monsters.find(x => !x.dead && this.elites.get(x.id) === c.id);
        if (m) return { x: m.x, y: m.y };
        return proche((_, t) => t === o.carte);
      }
      if (o.t === 'defense' || o.t === 'chrono') return proche((_, t) => t === o.carte);
      if (o.t === 'defi') { const po = w.entreeDonjon(o.donjon); if (po) return { x: po.ends[0].x, y: po.ends[0].y }; continue; }
      if (o.t === 'donjon') { const po = w.entreeDonjon(o.donjon); if (po) return { x: po.ends[0].x, y: po.ends[0].y }; continue; }
      if (o.t === 'activer') { const cp = w.zone.open?.checkpoints.find(k => k.name === o.zaap); if (cp) return proche((_, t) => t === `${cp.map[0]}_${cp.map[1]}`); }
      if ('sousZone' in o && o.sousZone != null) {
        if (wg.mapAt(p.x, p.y)?.sub === o.sousZone) return null;   // on y est : pas de flèche
        return proche(s => s === o.sousZone);
      }
    }
    return null;
  }
}
const xy = (q: { x: number; y: number }): [number, number] => [q.x, q.y];
