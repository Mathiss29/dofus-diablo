import { ALMANAX } from './almanax';
import { CHATIMENTS, PC_PAR_ID } from './pouvoirsClasse';
import { DOFUS, EMPLACEMENTS_DOFUS, PASSIFS } from './dofus';
import type { CleDonjon } from './arene';
import type { CommandeFM } from './forgemagie';
import { Entity } from './entity';
import type { ClassDef, ComboHit, Element, SkillId, SpellDef } from './defs';
import { WEAPONS } from './data';
import { BASE_STATS, EQUIP_SLOTS, REDUCTION_RECHARGES_MAX, METIER_MAX, metierXpNeeded, type EquipSlot, type Item, type ItemsData, type Stat, type Stats } from './items';
import type { PlayerInput } from './input';
import type { HitDef, World } from './world';
import type { Quetes } from './quests';
import type { SimEvent } from './events';
import { etatMondeNeuf, type EtatMonde } from './etatMonde';
import { coutPoint, coutTotal, fuiteFactor, pointsAchetables, prospectionDeChance, soinRecu, tackleSlow, tacleOf, vitesseAgilite } from './caracs';
import { CASE, TOUR } from './monster';
import { SORTS, dmgMoyen, gradeAuNiveau, niveauRequis, type PaireSorts, type SortGrade, type SortOfficiel } from './sorts';
import { porteeSort } from './apercu';
import { aimanter, alchiRhetorique, apresCoupEniripsa, envol, impactEniripsa, majEniripsa } from './eniripsa';
import { DANGER } from './danger';
import type { EntreeCodex } from './codex';
import { POUVOIR_PAR_ID, classeDuPouvoir, gradeAvecPouvoirs, type CtxPouvoirs, type PouvoirDef } from './pouvoirs';

type ActiveSkill =
  | { id: 'attaque'; def: ComboHit; t: number; impacted: boolean; idx: number; boosted: false }
  | { id: string; def: SpellDef; t: number; impacted: boolean; sx: number; sy: number; tx: number; ty: number; boosted: boolean;
      /** Dommages du grade atteint / dommages du grade 1 ; zone d'explosion de la flèche (Abolition) ; portée de la flèche. */
      gm: number; explode?: number; range?: number };

/** Préréglage d'équipement (0.3, 13A). */
export interface Prereglage { nom: string; equipement: Partial<Record<EquipSlot, number>>; bar: (string | null)[]; variants: number[] }

export class Player extends Entity {
  readonly faction = 'player' as const;
  /** Nom du perso (coop : portraits du groupe, fenêtre Social) ; vide = celui de l'écran ne s'en sert pas. */
  nom = '';
  /** Quêtes et succès de ce perso (monde ouvert) : en multi, chaque joueur a les siens ; world.quetes = ceux de world.player. */
  quetes: Quetes | null = null;
  /** Son état dans le monde ouvert (porte, récolte, point de retour, Havre-Sac…), voir etatMonde.ts. */
  monde: EtatMonde = etatMondeNeuf();
  /** Multi : ses événements propres (fenêtres, butin, porte…) en attendant que l'hôte ou le serveur les lui envoie. */
  evenements: SimEvent[] = [];
  state: 'free' | 'skill' = 'free';
  skill: ActiveSkill | null = null;
  /** Recharge restante de chaque sort, et durée totale de la dernière recharge lancée (pour le voile de la barre). */
  cd: Record<string, number> = {};
  cdMax: Record<string, number> = {};
  combo = 0;
  comboTimer = 0;
  invuln = 0;
  /** Multi (« Multi complet » 7B) : temps à terre, et temps passé par un allié à le relever (s). */
  aTerre = 0;
  releve = 0;
  /** PA disponibles (fractionnaires : ils remontent en continu). */
  pa: number;
  /** Charges de déplacement disponibles (fractionnaires : elles se rechargent une à une). */
  pm: number;
  potions: number;
  potionCd = 0;
  level = 1;
  xp = 0;
  /** Jauge de classe (Rage du Iop). */
  rage = 0;
  /** Sorts à cumul (Fureur) : nombre de lancers cumulés et temps avant remise à zéro. */
  stacks: Record<string, { n: number; t: number }> = {};
  /** Points de caractéristiques placés (5 par niveau, choix 6C) et non placés. */
  base: Partial<Record<Stat, number>> = {};
  points = 0;
  /** Sac (objets tirés) et ressources par identifiant Dofus. */
  bag: Item[] = [];
  resources: Record<string, number> = {};
  /** Métiers (choix 6A : Chasseur) : niveau et XP. */
  metiers: Record<string, { level: number; xp: number }> = { chasseur: { level: 1, xp: 0 } };
  /** Recette suivie à l'écran (Métiers UI 9A) : l'objet fabriqué (id de ressource), sous la quête. */
  recetteSuivie: string | null = null;
  kamas = 0;
  /** Butin au sol affiché et aspiré (choix 4C, réglé dans l'inventaire) : 0 tout, 1 Rare et plus, 2 Épique et plus. */
  lootFilter = 0;
  /** « Équipement en trop » 5B : les objets Communs ramassés sont brisés tout seuls, leurs runes vont au sac (réglage à cocher). */
  autoBrisage = false;
  /** Objet au sol que l'on va ramasser (clic). */
  pickupId: number | null = null;
  equipment: Partial<Record<EquipSlot, Item>> = {};
  /** Zaaps découverts (maquette Hub 2C : le Zaap du Havre-Sac y mène) et zones déjà visitées (3A : les PNJ du Havre-Sac emménagent). */
  zaaps: { zone: string; name: string }[] = [];
  zonesVues: string[] = [];
  /** Clé d'un donjon encore valable (maquette « Donjons en vagues » 14A) : on y revient à la vague atteinte. */
  cleDonjon: CleDonjon | null = null;
  /** Commande en cours chez Malek le Forgemage (maquette Forgemagie UI 9E) : l'objet lui est confié, il revient quand c'est fini. */
  commandeFM: CommandeFM | null = null;
  /** Apparat (maquette Apparence 5A) : objets d'apparat officiels possédés (id Dofus), et ceux posés par-dessus
   *  la coiffe, la cape ou le bouclier (case Apparence de l'inventaire). « 0 » cache l'objet porté. Rien ne change les stats. */
  apparats: string[] = [];
  /** Codex des pouvoirs (0.3, src/sim/codex.ts) : pouvoirs enregistrés en brisant un Légendaire ou un Mythique chez Malek. */
  codex: EntreeCodex[] = [];
  /** 15B : archimonstres capturés (clés des monstres). */
  ames: string[] = [];
  /** 8C : Codex ouvert (quête « Le premier pouvoir » finie, ou premier Légendaire trouvé). */
  codexOuvert = false;
  /** 15C : jour (AAAA-MM-JJ) de la dernière offrande à l'Almanax ; son bonus dure jusqu'à minuit. */
  almanaxJour: string | null = null;
  /** Dofus possédés (ids officiels) et les 6 emplacements (version 0.3, src/sim/dofus.ts). */
  dofus: string[] = [];
  dofusPortes: (string | null)[] = Array(EMPLACEMENTS_DOFUS).fill(null);
  /** Moment (âge du perso) du dernier Souvenir d'Argent et du dernier bouclier du Cacao. */
  private argenteA = -1e9; private cacaoA = -1e9;
  apparat: Partial<Record<'chapeau' | 'cape' | 'bouclier' | 'familier', string>> = {};
  /** Caractéristiques totales (points + équipement + panoplies), recalculées à chaque changement. */
  stats: Stats = {};
  /** Panoplies portées : nombre d'objets par panoplie. */
  setCount: Record<string, number> = {};
  items: ItemsData | null = null;
  static readonly BAG_SIZE = 120;
  /** Déplacement à la souris : points de passage restants, monstre poursuivi, dernière destination. */
  path: { x: number; y: number }[] = [];
  chaseId: number | null = null;
  /** Sort en attente : on s'approche du monstre visé jusqu'à l'avoir à portée (option 5B). */
  castChase: { id: SkillId; m: number } | null = null;
  private dest: { x: number; y: number } | null = null;
  /** Le joueur a cliqué près de ce point (portes : on n'entre que si on a cliqué dessus, pas en passant devant). */
  /** Une destination est en cours (clic au sol). */
  get enMarche(): boolean { return !!this.dest; }
  vise(x: number, y: number, r: number): boolean { return !!this.dest && Math.hypot(this.dest.x - x, this.dest.y - y) <= r; }
  /** Arrête le déplacement en cours (après une porte : on ne repart pas vers l'ancien clic). */
  stopMove() { this.dest = null; this.path = []; this.chaseId = null; this.castChase = null; }
  /** Barre (choix 5A) : 6 touches (& é " ' ( -), le clic droit (6A, case libre) et Espace. Identifiants des sorts, null = vide. */
  bar: (SkillId | null)[] = Array(12).fill(null);
  static readonly CLIC_DROIT = 6;
  static readonly ESPACE = 7;
  /** Barre d'invocations de l'Osamodas (maquette Osamodas 4D, 2A) : touches A Z R T, emplacements 8 à 11. */
  static readonly INVOC = 8;
  /** Choix de chaque paire officielle (4A, comme Dofus 3) : 0 le sort, 1 sa variante ; l'un ou l'autre. */
  variants: number[] = [];
  /** Sorts déjà appris (placés une fois seuls dans la barre, choix 7A ; retirés à la main, ils n'y reviennent pas). */
  learned = new Set<string>();
  /** Lancers récents de chaque sort (limite officielle de lancers par tour = par 3 s). */
  /** Instants des derniers lancers de chaque sort (charges, 3A). */
  casts: Record<string, number[]> = {};
  /** Bouclier (Ferveur) : points et temps restant. */
  shield = 0; shieldT = 0; shieldT0 = 0; shieldSrc = '';
  /** Sorts officiels de monstres : dommages subis × subis pendant subisT s (Grognement : 1,2), Pacifiste pendant pacifiste s (Hyperleukocytine : ne peut plus infliger de dommages). */
  subis = 1; subisT = 0; pacifiste = 0;
  /** Sacrieur : palier de Souffrance gardé après un soin (maquette 3B) et secondes restantes ; Mutilation en cours ; Couronne d'Épines (renvoi). */
  souffPic = 0; souffT = 0;
  /** Forgelance : la Lance Immortelle plantée au sol (Désarmé) ou null (Armé, Lance en main) ; t = secondes depuis qu'elle est plantée. */
  lance: { x: number; y: number; t: number } | null = null;
  /** Forgelance : Lance en main (état officiel Armé). */
  get arme(): boolean { return !!this.cls.lance && !this.lance; }
  mutil: { n: number; next: number } | null = null;
  renvoiT = 0; renvoiPart = 0;
  /** Dernier souffle (légendaire Sacrieur D) : dernière fois qu'il a sauvé le perso. */
  dernierSouffleA = -999;
  private repathT = 0;
  private buffer: SkillId | null = null;
  private bufferT = 0;

  constructor(id: number, x: number, y: number, readonly cls: ClassDef) {
    super(id, x, y, cls.radius, cls.hp);
    this.pa = cls.pa.max; this.pm = cls.pm.max; this.potions = cls.potion.charges;
    this.recompute();
    for (const k of Object.keys(cls.spells)) this.cd[k] = 0;
    this.learnSpells(null);
  }

  // --- Sorts officiels de la classe (onglet Sorts, src/data/sorts.json) -------------
  /** Les 22 paires officielles de la classe, triées par niveau d'obtention. */
  get pairs(): PaireSorts[] { return SORTS[this.cls.sorts] ?? []; }
  /** Identifiant du sort jouable correspondant à un sort officiel (null : pas encore jouable). */
  keyOf(dofusId: number): SkillId | null {
    for (const [k, d] of Object.entries(this.cls.spells)) if (d.dofusId === dofusId) return k;
    return null;
  }
  /** Fiche officielle d'un sort de la classe. */
  official(id: SkillId): SortOfficiel | null {
    const d = this.cls.spells[id];
    if (!d?.dofusId) return null;
    for (const p of this.pairs) for (const s of p) if (s.id === d.dofusId) return s;
    return null;
  }
  /** Niveau requis (officiel, sauf le déplacement donné au niveau 1). */
  requiredLevel(s: SortOfficiel): number { return niveauRequis(s, this.cls.spells[this.cls.mobility]?.dofusId, this.cls.niveau1); }
  /** Grade officiel atteint pour ce sort (null pour un sort sans fiche : arme, attaque). */
  /** Valeur officielle propre au grade atteint (une valeur par grade, la dernière vaut pour les suivants). */
  parGrade(id: SkillId, v: number[]): number {
    const o = this.official(id), g = this.grade(id);
    return v[Math.min(v.length - 1, Math.max(0, o && g ? o.grades.indexOf(g) : 0))];
  }
  grade(id: SkillId): SortGrade | null {
    const o = this.official(id);
    return o ? gradeAvecPouvoirs(gradeAuNiveau(o, this.level), this.pouvoirsDuSort(id)) : null;
  }
  // --- Pouvoirs légendaires officiels (version 0.3, src/sim/pouvoirs.ts) ---------------------------
  /** 0.3 visible pour ce perso (partie de test, ou sortie publique). */
  v03 = false;
  private _pouvoirs: PouvoirDef[] | null = null;
  /** Pouvoirs officiels de sa classe portés, chacun une seule fois (5A : deux anneaux au même pouvoir ne cumulent pas). */
  get pouvoirsPortes(): PouvoirDef[] {
    if (this._pouvoirs) return this._pouvoirs;
    const m = new Map<string, PouvoirDef>();
    for (const it of Object.values(this.equipment)) for (const l of [it?.legendary, it?.legendary2]) {
      const p = l && POUVOIR_PAR_ID[l.id];
      if (p && classeDuPouvoir(p.id) === this.cls.sorts) m.set(p.id, p);
    }
    return (this._pouvoirs = [...m.values()]);
  }
  /** Pouvoirs officiels portés qui visent ce sort. */
  pouvoirsDuSort(id: SkillId): PouvoirDef[] {
    const did = this.cls.spells[id]?.dofusId;
    return did ? this.pouvoirsPortes.filter(p => p.dofusId === did) : [];
  }
  private aPouvoir(id: SkillId, effet: PouvoirDef['effet']): number {
    return this.pouvoirsDuSort(id).filter(p => p.effet === effet).reduce((a, p) => a + p.n, 0);
  }
  /** Sort lancé autour du perso (zone sans case visée) : la portée et la ligne de vue y deviennent de la taille de zone. */
  zoneSeule(id: SkillId): boolean { const d = this.spell(id); return !!d && d.hit.shape === 'circle' && !d.move; }
  /** Bonus de critique du sort (pouvoir « +N % Critique »), en part. */
  critSort(id: SkillId): number { return this.aPouvoir(id, 'crit') / 100; }
  /** Taille de zone en plus, en px : « lancer en ligne désactivé » = +1 case (6A) ; ligne de vue et portée d'un sort sans case visée. */
  zoneBonus(id: SkillId): number {
    const z = this.aPouvoir(id, 'ligne') * CASE / 2;
    return this.zoneSeule(id) ? z + (this.aPouvoir(id, 'ldv') ? CASE / 2 : 0) + this.aPouvoir(id, 'po') * CASE / 2 : z;
  }
  /** Portée en plus d'une ligne, d'un cône ou d'un déplacement (« +N Portée maximale »), en px. */
  porteePlus(id: SkillId): number {
    const d = this.spell(id);
    return d && !this.zoneSeule(id) && (d.move || d.hit.shape === 'line' || d.hit.shape === 'cone') ? this.aPouvoir(id, 'po') * CASE : 0;
  }
  /** La stat Portée s'applique-t-elle (« portée modifiable » officielle, ou le pouvoir qui la rend modifiable) ? */
  porteeModifiable(id: SkillId): boolean {
    const o = this.official(id);
    return !this.v03 || !o || o.pom === undefined || o.pom === 1 || this.aPouvoir(id, 'pom') > 0;
  }
  /** Portée ajoutée par la stat Portée de l'équipement, en px (0 si le sort n'a pas une portée modifiable). */
  porteeStat(id: SkillId): number { return this.porteeModifiable(id) ? this.stat('portee') * CASE : 0; }
  /** Le sort demande-t-il une ligne de vue vers la case visée (officiel, sauf pouvoir « ligne de vue désactivée ») ? */
  demandeVue(id: SkillId): boolean { return this.official(id)?.ldv === 1 && !this.aPouvoir(id, 'ldv'); }
  /** Pour tirer le pouvoir d'un Légendaire : classe, sorts connus, sorts du jeu à venir. */
  get ctxPouvoirs(): CtxPouvoirs {
    const connus: number[] = [], aVenir: { dofusId: number; niveau: number }[] = [];
    for (const [k, d] of Object.entries(this.cls.spells)) {
      if (!d.dofusId) continue;
      if (this.knows(k)) { connus.push(d.dofusId); continue; }
      const o = this.official(k), n = o ? this.requiredLevel(o) : 0;
      if (o && n > this.level) aVenir.push({ dofusId: d.dofusId, niveau: n });
    }
    return { classe: this.cls.sorts, connus, aVenir, sortsRecharge: this.sortsRecharge, v03: this.v03 };
  }
  /** État d'un pouvoir porté (infobulle) : actif, sort pas encore appris (niveau), autre classe, ou sort absent du jeu. */
  etatPouvoir(id: string): { actif: true } | { actif: false; raison: string } {
    const c = PC_PAR_ID[id];
    if (c) {   // légendaire de classe inventé : sa classe, et son sort connu
      if (c.classe !== this.cls.sorts) return { actif: false, raison: `pouvoir de ${({ iop: 'Iop', cra: 'Crâ', osamodas: 'Osamodas', sacrieur: 'Sacrieur', forgelance: 'Forgelance', eniripsa: 'Eniripsa' } as Record<string, string>)[c.classe] ?? 'une autre classe'}` };
      if (this.knows(c.sort)) return { actif: true };
      const o = this.official(c.sort), n = o ? this.requiredLevel(o) : 0;
      return { actif: false, raison: n > this.level ? `s'éveille au niveau ${n}` : 'variante non choisie' };
    }
    const p = POUVOIR_PAR_ID[id];
    if (!p) return { actif: true };
    if (classeDuPouvoir(id) !== this.cls.sorts) return { actif: false, raison: `pouvoir de ${({ iop: 'Iop', cra: 'Crâ', osamodas: 'Osamodas', sacrieur: 'Sacrieur', forgelance: 'Forgelance', eniripsa: 'Eniripsa' } as Record<string, string>)[classeDuPouvoir(id)] ?? 'une autre classe'}` };
    const k = Object.keys(this.cls.spells).find(x => this.cls.spells[x].dofusId === p.dofusId);
    if (!k) return { actif: false, raison: 'sort pas encore en jeu' };
    if (this.knows(k)) return { actif: true };
    const o = this.official(k), n = o ? this.requiredLevel(o) : 0;
    return { actif: false, raison: n > this.level ? `s'éveille au niveau ${n}` : 'variante non choisie' };
  }
  /** Le sort est-il connu : niveau atteint et choisi dans sa paire ? */
  knows(id: SkillId): boolean {
    const d = this.cls.spells[id];
    if (!d?.dofusId) return !!d;
    const i = this.pairs.findIndex(p => p.some(s => s.id === d.dofusId));
    if (i < 0) return true;
    const s = this.pairs[i][this.variants[i] ?? 0];
    return s.id === d.dofusId && this.level >= this.requiredLevel(s);
  }
  /** Place seuls dans la barre les sorts nouvellement connus (premier emplacement libre ; Espace pour le déplacement). */
  learnSpells(world: World | null) {
    this.pairs.forEach((p, i) => {
      const k = this.keyOf(p[this.variants[i] ?? 0].id);
      if (!k || this.learned.has(k) || !this.knows(k)) return;
      this.learned.add(k);
      if (this.bar.includes(k)) return;
      const inv = !!this.cls.spells[k]?.invoque && this.cls.rage.mode === 'eveil';   // Épées du Sacrieur : barre normale
      const slot = k === this.cls.mobility ? (this.bar[Player.ESPACE] ? -1 : Player.ESPACE)
        : k === this.cls.clicDroit && !this.bar[Player.CLIC_DROIT] ? Player.CLIC_DROIT
        : inv ? this.bar.findIndex((b, j) => !b && j >= Player.INVOC)
        : this.bar.findIndex((b, j) => !b && j < Player.ESPACE && (j !== Player.CLIC_DROIT || !this.cls.clicDroit));
      if (slot >= 0) this.bar[slot] = k;
      world?.emit({ k: 'newSpell', id: k, slot });
    });
    // Déplacement sans fiche officielle (Saut à la Lance du Forgelance, maquette 8B) : sur Espace dès le niveau 1
    const mob = this.cls.mobility;
    if (mob && this.cls.spells[mob] && !this.cls.spells[mob].dofusId && !this.learned.has(mob)) {
      this.learned.add(mob);
      if (!this.bar.includes(mob) && !this.bar[Player.ESPACE]) this.bar[Player.ESPACE] = mob;
    }
  }
  /** Met un sort (ou rien) dans un emplacement de la barre ; s'il était déjà ailleurs, les deux s'échangent. */
  assign(slot: number, id: SkillId | null): boolean {
    if (slot < 0 || slot >= this.bar.length || (id && !this.knows(id))) return false;
    const from = id ? this.bar.indexOf(id) : -1;
    if (from >= 0) this.bar[from] = this.bar[slot];
    this.bar[slot] = id;
    return true;
  }
  /** Choisit le sort (0) ou sa variante (1) d'une paire ; la barre suit. */
  setVariant(pair: number, v: 0 | 1): boolean {
    const p = this.pairs[pair];
    if (!p || this.level < this.requiredLevel(p[v])) return false;
    const old = this.keyOf(p[this.variants[pair] ?? 0].id);
    this.variants[pair] = v;
    const k = this.keyOf(p[v].id);
    const at = old ? this.bar.indexOf(old) : -1;
    if (at >= 0) this.bar[at] = k && this.knows(k) ? k : null;
    if (k) this.learned.add(k);
    return true;
  }

  // --- Caractéristiques -------------------------------------------------------
  stat(k: Stat): number { let v = this.stats[k] ?? 0; for (const m of this.mods) if (m.k === k) v += m.n; return v; }
  /** Bonus / malus temporaires (sorts de monstres : -40 Puissance pendant un tour…). */
  mods: { k: Stat; n: number; t: number; src?: string; t0?: number; plus?: number }[] = [];
  addMod(k: Stat, n: number, t: number, src?: string) { this.mods.push({ k, n, t, src, t0: t }); }
  /** Ralentissement (retrait de PM) : fraction de vitesse perdue et durée restante. */
  slowK = 0; slowT = 0;
  /** Durées de départ des malus (bulles d'effets actifs : l'anneau se vide de t0 à 0). */
  slowT0 = 0; subisT0 = 0; pacifisteT0 = 0;
  /** Forgelance : Lance de Mani (insensible aux ralentissements), Lance d'Elding et Prélude glorieux (vitesse de course en plus),
   *  Lance de Noa (soins reçus en plus) : durées restantes. */
  insensibleT = 0; courseK = 0; courseT = 0; soinsRecusT = 0;
  /** Eniripsa (reçus de n'importe quel Eniripsa du groupe) : Encouragement, soins continus (Jouvence, Peinture), Insoignable ;
   *  lancés : Farces qui ramènent les ennemis, dernier PA rendu par Alchi-Rhétorique. */
  encourage: { k: string; t: number; t0: number; regen: number } | null = null;
  soinContinu: { n: number; t: number; next: number; de: number; src: string }[] = [];
  insoignableT = 0; farces: { m: number; x: number; y: number; t: number }[] = []; alchiA = -99;
  courir(k: number, t: number) { this.courseK = this.courseT > 0 ? Math.max(this.courseK, k) : k; this.courseT = Math.max(this.courseT, t); }
  slow(t: number, k: number) { if (this.insensibleT > 0) return; k *= fuiteFactor(this.fuite); this.slowK = this.slowT > 0 ? Math.max(this.slowK, k) : k; if (t >= this.slowT) this.slowT0 = t; this.slowT = Math.max(this.slowT, t); }
  get speed(): number { return this.cls.speed * (1 + vitesseAgilite(this.stat('agilite'))) * this.vitesseTest * (this.slowT > 0 ? 1 - this.slowK : 1) * (this.courseT > 0 ? 1 + this.courseK : 1); }
  /** Partie de test (5D) : course ×3. */
  vitesseTest = 1;
  /** Tacle et Fuite (base Agilité / 10), Retrait et Esquive PA / PM (base Sagesse / 10), comme dans Dofus. */
  get tacle(): number { return tacleOf(this.stat('tacle'), this.stat('agilite')); }
  get fuite(): number { return tacleOf(this.stat('fuite'), this.stat('agilite')); }
  retrait(k: 'PA' | 'PM'): number { return this.stat(`retrait${k}`) + this.stat('sagesse') / 10; }
  esquive(k: 'PA' | 'PM'): number { return this.stat(`esquive${k}`) + this.stat('sagesse') / 10; }
  /** Prospection : objets + Chance / 10 (Caracs 3A). */
  get prospection(): number { return this.stat('prospection') + prospectionDeChance(this.stat('chance')); }
  /** Soigne le perso (potion, nourriture, soin à chaque monstre tué) : Intelligence et Soins s'y ajoutent (Caracs 3B + 3C). Renvoie les PV rendus. */
  soigner(base: number): number {
    if (this.dead || base <= 0) return 0;
    const n = Math.min(this.maxHp - this.hp, Math.round(soinRecu(base, this.stat('intelligence'), this.stat('soins')) * (this.soinsRecusT > 0 ? 1.2 : 1)));
    this.hp += Math.max(0, n);
    return Math.max(0, n);
  }
  get initiative(): number { return this.stat('initiative') + this.stat('force') + this.stat('intelligence') + this.stat('chance') + this.stat('agilite'); }
  /** Tacle des monstres au contact : on avance moins vite en s'éloignant d'eux (la Fuite y résiste). */
  private tackled(dx: number, dy: number, world: World): number {
    let k = 0;
    for (const m of world.monsters) {
      if (m.dead || m.state === 'spawn') continue;
      const ox = this.x - m.x, oy = this.y - m.y, d = Math.hypot(ox, oy);
      if (d > m.radius + this.radius + 12 || ox * dx + oy * dy <= 0) continue;
      k = Math.max(k, tackleSlow(tacleOf(m.def.caracs?.tacle ?? 0, m.def.caracs?.agilite ?? 0), this.fuite));
    }
    return 1 - k;
  }
  /** +1 PA au niveau 100, comme dans Dofus (6 PA au départ, 7 ensuite). */
  get paMax(): number { return this.cls.pa.max + (this.level >= 100 ? 1 : 0) + this.stat('pa'); }
  get pmMax(): number { return this.cls.pm.max + this.stat('pm'); }
  get critChance(): number { return this.cls.critChance + this.stat('critique') / 100; }
  /** Effet légendaire porté (somme si plusieurs). */
  legendary(id: string): number {
    let v = 0;
    for (const it of Object.values(this.equipment)) for (const l of [it?.legendary, it?.legendary2]) if (l?.id === id) v += l.value;
    return v;
  }
  /** Légendaire de classe inventé porté (0.3, ligne « Légendaires classe ») : meilleur jet porté, 0 s'il n'est pas de sa classe. */
  pcv(id: string): number {
    if (!this.v03 || PC_PAR_ID[id]?.classe !== this.cls.sorts) return 0;
    let v = 0;
    for (const it of Object.values(this.equipment)) for (const l of [it?.legendary, it?.legendary2]) if (l?.id === id) v = Math.max(v, l.value);
    return v;
  }
  /** Rage sans fond (Iop C) : dernière recharge offerte de Colère ; Couperet du bourreau (Iop F) : dernière exécution. */
  rageSansFondA = -99; couperetA = -99;
  /** Élan du héros (Iop P) : secondes restantes et bonus du prochain sort ; Déferlement sans fin (Iop N) : dernière recharge offerte ;
   *  Ferveur bouillonnante (Iop K) : bouclier de départ de Ferveur. */
  elanT = 0; elanV = 0; deferlementA = -99; ferveurBouclier = 0;
  /** Piqûre d'éveil (Osamodas O) : dernier éveil offert. */
  piqureA = -99;
  /** Un sort qui le demande (HitDef.tue) vient de tuer un monstre. */
  aTue(id: string, world: World) {
    const ta = this.pcv('pc-forgelance-L');
    if (id === 'talon_argile' && ta && this.age - this.talonA >= ta) {   // Talon d'acier
      this.talonA = this.age;
      for (const k of ['talon_argile', 'charge_heroique']) { this.cd[k] = 0; this.casts[k] = []; }
      world.emit({ k: 'status', x: this.x, y: this.y - 50, text: "Talon d'acier", color: '#e8b860' });
    }
    const v = this.pcv('pc-iop-N');
    if (id === 'deferlement' && v && this.age - this.deferlementA >= v) {
      this.deferlementA = this.age; this.cd.deferlement = 0; this.casts.deferlement = [];
      world.emit({ k: 'status', x: this.x, y: this.y - 50, text: 'Déferlement rechargé', color: '#6bb8ff' });
    }
  }
  /** Recalcule les caractéristiques et les PV max (5 PV par niveau + 1 par point de Vitalité, comme Dofus). */
  recompute() {
    this._pouvoirs = null;
    const st: Stats = {}, add = (k: Stat, v: number) => { st[k] = (st[k] ?? 0) + v; };
    for (const [k, v] of Object.entries(this.base) as [Stat, number][]) add(k, v);
    const sets: Record<string, number> = {};
    for (const it of Object.values(this.equipment)) {
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) add(k, v);
      const set = this.items?.equipment[it.id]?.set;
      if (set) sets[set] = (sets[set] ?? 0) + 1;
    }
    for (const id of this.dofusPortes) if (id) for (const [k, v] of Object.entries(DOFUS[id]?.stats ?? {}) as [Stat, number][]) add(k, v);
    for (const [id, n] of Object.entries(sets)) {
      const b = this.items?.sets[id]?.bonus[String(n - 1)];
      if (b) for (const [k, v] of Object.entries(b) as [Stat, number][]) add(k, v);
    }
    this.stats = st; this.setCount = sets;
    const was = this.maxHp;
    this.maxHp = Math.max(1, this.cls.hp + (this.level - 1) * 5 + this.stat('vitalite'));
    if (this.maxHp > was) this.hp += this.maxHp - was;
    this.hp = Math.min(this.hp, this.maxHp);
    this.buildWeapon();
  }
  /** « Meilleur élément » du lanceur = celui de sa plus forte caractéristique. */
  resolveElement(element: Element): Element {
    if (element !== 'meilleur') return element;
    const E: Record<string, Stat> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
    return (['terre', 'feu', 'eau', 'air'] as Element[]).reduce((a, b) => this.stat(E[b]) > this.stat(E[a]) ? b : a, 'terre');
  }
  /** Dommages d'un coup : base × (1 + (caractéristique de l'élément + Puissance) / 100) + Dommages fixes, comme Dofus. */
  /** Souffrance du Sacrieur d'après les PV seuls : 0 à pleine vie, puis un palier par tranche de 10 % perdus (officiel). */
  get souffranceBrute(): number {
    if (!this.cls.souffrance || this.hp >= this.maxHp || this.maxHp <= 0) return 0;
    return Math.max(1, Math.min(10, Math.ceil((1 - this.hp / this.maxHp) * 10 - 1e-9)));
  }
  /** Souffrance en jeu : le palier le plus haut tient encore quelques secondes après un soin (mémoire de la douleur, 3B). */
  get souffrance(): number { return Math.max(this.souffranceBrute, this.souffT > 0 ? this.souffPic : 0); }
  /** Sacrifie une part des PV actuels (Mutilation…) : jamais sous 1 PV (maquette Sacrieur 2A). Renvoie les PV perdus. */
  sacrifier(part: number, world: World): number {
    const n = Math.min(this.hp - 1, Math.round(this.hp * part));
    if (n <= 0) return 0;
    const ox = this.pcv('pc-sacrieur-Q');
    if (ox) {   // Offrande explosive : les PV sacrifiés explosent autour du Sacrieur
      world.hitCircle(this.x, this.y, CASE * 2, { dmg: n * ox / 100, knock: 0, element: 'feu' });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-sacrieur-Q', x: this.x, y: this.y, cx: this.x, cy: this.y, facing: this.facing, size: CASE * 2, arc: 0, element: 'feu', big: true, boosted: false });
    }
    this.hp -= n;
    world.emit({ k: 'sacrifice', x: this.x, y: this.y, amount: n });
    return n;
  }
  damage(base: number, element: Element): number {
    const E: Record<string, Stat> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
    const el = this.resolveElement(element);
    const c = E[el] ? this.stat(E[el]) : this.stat('force');
    const flat = this.stat('dommages') + this.stat((`dommages${el[0].toUpperCase()}${el.slice(1)}`) as Stat);
    const S = this.cls.souffrance, n = S ? this.souffrance : 0;   // Souffrance : dommages finaux en plus
    return Math.max(1, (base * (1 + Math.max(-50, c + this.stat('puissance')) / 100) + flat) * (n ? 1 + S!.finaux[n - 1] / 100 : 1));
  }
  /** Partie de test (4A) : passe directement au niveau n. Tous les points sont rendus (5 par niveau) ; carac donnée = ils y vont tous (au coût officiel), le reste en Vitalité.
   *  Les objets d'un niveau trop haut retournent dans le sac, les sorts pas encore connus quittent la barre. */
  fixerNiveau(n: number, carac: Stat | null) {
    this.level = Math.max(1, Math.min(this.cls.maxLevel, Math.round(n))); this.xp = 0;
    this.base = {}; this.points = this.pointsTotaux;
    if (carac && this.points) { const n = pointsAchetables(carac, 0, this.points); this.base[carac] = n; this.points -= coutTotal(carac, n); }
    if (carac && this.points) { this.base.vitalite = (this.base.vitalite ?? 0) + this.points; this.points = 0; }   // le reste (moins qu'un point) en Vitalité
    for (const [slot, it] of Object.entries(this.equipment) as [EquipSlot, Item][]) {
      if ((this.items?.equipment[it.id]?.level ?? 0) > this.level) { delete this.equipment[slot]; this.bag.push(it); }
    }
    this.pairs.forEach((p, i) => { if (this.level < this.requiredLevel(p[this.variants[i] ?? 0])) this.variants[i] = 0; });
    this.learned = new Set();
    this.bar = this.bar.map(k => (k && this.knows(k) ? k : null));
    this.learnSpells(null);
    this.recompute(); this.hp = this.maxHp; this.pa = this.paMax; this.pm = this.pmMax;
  }
  /** Place n points dans une caractéristique de base. */
  /** Place n points de caractéristique (coût officiel par point, voir coutPoint) ; s'arrête quand il ne reste plus de quoi payer.
   *  Vrai si au moins un point a été placé. */
  spendPoint(k: Stat, n = 1): boolean {
    if (!BASE_STATS.includes(k) || n < 1) return false;
    const m = Math.min(n, pointsAchetables(k, this.base[k] ?? 0, this.points));
    if (m < 1) return false;
    this.points -= coutTotal(k, (this.base[k] ?? 0) + m) - coutTotal(k, this.base[k] ?? 0);
    this.base[k] = (this.base[k] ?? 0) + m; this.recompute();
    return true;
  }
  /** Coût du prochain point dans cette caractéristique. */
  coutPoint(k: Stat): number { return coutPoint(k, this.base[k] ?? 0); }
  /** Points de caractéristique gagnés depuis le niveau 1 (5 par niveau). */
  get pointsTotaux(): number { return 5 * (this.level - 1); }
  /** Rend tous les points placés (Caracs 11A : gratuit, hors donjon, vérifié par World.reinitialiserCaracs). */
  reinitialiserPoints() {
    this.base = {}; this.points = this.pointsTotaux; this.recompute();
  }
  /** Sauvegarde d'avant les coûts officiels (tout coûtait 1) : si le compte ne tombe pas juste, on rend tous les points. */
  verifierPoints(): boolean {
    const depense = BASE_STATS.reduce((n, k) => n + coutTotal(k, this.base[k] ?? 0), 0);
    if (depense + this.points === this.pointsTotaux && depense >= 0) return false;
    this.reinitialiserPoints(); return true;
  }

  // --- Sac et équipement --------------------------------------------------------
  /** Emplacement où irait cet objet (le 2e anneau si le 1er est pris). */
  slotFor(it: Item): EquipSlot | null {
    const d = this.items?.equipment[it.id];
    if (!d) return null;
    if (d.slot === 'anneau') return !this.equipment.anneau1 || this.equipment.anneau2 ? 'anneau1' : 'anneau2';
    return d.slot as EquipSlot;
  }
  /** Équipe un objet du sac (l'ancien retourne dans le sac). Le niveau requis est celui de l'objet. */
  equip(uid: number, slot?: EquipSlot): boolean {
    const i = this.bag.findIndex(b => b.uid === uid), it = this.bag[i], d = it && this.items?.equipment[it.id];
    if (!it || !d || d.level > this.level) return false;
    const to = slot ?? this.slotFor(it);
    if (!to || !EQUIP_SLOTS.includes(to) || (d.slot === 'anneau' ? !to.startsWith('anneau') : to !== d.slot)) return false;
    this.bag.splice(i, 1);
    const old = this.equipment[to];
    if (old) this.bag.push(old);
    this.equipment[to] = it; this.recompute();
    return true;
  }
  unequip(slot: EquipSlot): boolean {
    const it = this.equipment[slot];
    if (!it || this.bag.length >= Player.BAG_SIZE) return false;
    delete this.equipment[slot]; this.bag.push(it); this.recompute();
    return true;
  }

  spell(id: SkillId): SpellDef | undefined { return id === 'arme' ? this.weaponDef ?? undefined : this.cls.spells[id]; }
  /** Auto-attaque (clic gauche) : celle de l'arme portée, sinon le coup de la classe (Coup de poing, Flèche Cinglante). */
  get autoAttack(): SkillId {
    if (this.cls.lance && this.lance) return 'attaque';   // Forgelance Désarmé : coups de poing (9A)
    return this.weaponDef ? 'arme' : this.cls.basic ?? 'attaque';
  }
  /** Auto-attaque de l'arme portée (src/data/armes.json), recalculée à chaque changement d'équipement. */
  weaponDef: SpellDef | null = null;
  private buildWeapon() {
    const it = this.equipment.arme, d = it && this.items?.equipment[it.id], w = d?.weapon, prof = w && WEAPONS[w.type];
    if (!d || !w || !prof) { this.weaponDef = null; return; }
    const best = [...w.dmg].sort((a, b) => (b.min + b.max) - (a.min + a.max))[0];
    const { base, mult, anim, ...rest } = prof;
    // Maquette Armes 5A : la Vitesse d'attaque accélère aussi le geste (jusqu'à ×1,6), on voit qu'on frappe plus vite
    const k = Math.min(Player.GESTE_MAX, Math.max(1, 1 + this.stat('vitesse') / 100));
    this.weaponDef = { ...rest, duration: rest.duration / k, impactAt: rest.impactAt / k, cancelAt: rest.cancelAt !== undefined ? rest.cancelAt / k : undefined,
      name: d.name, icon: anim, itemIcon: d.icon, element: (best?.element ?? 'neutre') as Element, cooldown: 0,
      dmg: Math.round(base + this.weaponDamage() * mult), anim: `arme${anim}` };
  }
  /** Coût en PA d'un sort (0 pour l'attaque de base). */
  paCost(id: SkillId): number {
    const s = this.spell(id);
    if (!s || s.pm) return s?.pa ?? 0;
    return this.grade(id)?.pa ?? s.pa ?? 0;
  }
  /** Maquette Recharges 7B : part retirée à toutes les recharges des sorts (stat « % Réduction des recharges », plafond 25 %). */
  get reductionRecharges(): number { return Math.min(REDUCTION_RECHARGES_MAX, Math.max(0, this.stat('reductionRecharges'))) / 100; }
  /** Temps de retour d'une charge (3A : la limite officielle « lancers par tour » en charges, chacune revient 3 s après usage). */
  get retourCharge(): number { return TOUR * (1 - this.reductionRecharges); }
  /** Charges d'un sort (3A) : « lancers par tour » officiels, à partir de 2. 0 = pas de charges (sort à recharge, 1 lancer par tour, déplacement). */
  chargesMax(id: SkillId): number {
    const d = this.spell(id);
    if (!d || d.pm || d.grosCoup) return 0;
    const n = this.grade(id)?.parTour ?? 0;
    return n >= 2 ? n + (id === 'epee' && this.pcv('pc-iop-O') ? 1 : 0) : 0;   // Tempête d'acier : une charge de plus
  }
  /** Lancers des 3 dernières secondes (raccourcies par la réduction des recharges). */
  private recents(id: SkillId): number[] { const r = this.retourDe(id); return (this.casts[id] ?? []).filter(t => this.age - t < r); }
  /** Retour d'une charge de ce sort (Tempête d'acier : Épée Céleste plus rapide). */
  retourDe(id: SkillId): number { return this.retourCharge * (id === 'epee' ? 1 - this.pcv('pc-iop-O') / 100 : 1); }
  /** Charges disponibles et temps avant le retour de la prochaine. */
  charges(id: SkillId): { n: number; max: number; prochaine: number } {
    const max = this.chargesMax(id);
    if (!max) return { n: 0, max: 0, prochaine: 0 };
    const r = this.recents(id), n = Math.max(0, max - r.length);
    return { n, max, prochaine: n < max ? Math.max(0, this.retourDe(id) - (this.age - Math.min(...r))) : 0 };
  }
  private castsLeft(id: SkillId): boolean {
    const max = this.chargesMax(id);
    return !max || this.recents(id).length < max;
  }
  /** Sorts de la classe à vraie recharge d'au moins 3 s (cibles du pouvoir légendaire Relance éclair, 7A). */
  get sortsRecharge(): string[] {
    return Object.keys(this.cls.spells).filter(id => {
      const d = this.cls.spells[id];
      if (d.grosCoup || d.cooldown >= 3) return true;
      if (d.pm && !d.relanceOfficielle) return false;
      return (this.official(id)?.grades[0].relance ?? 0) > 0;
    });
  }
  /** Recharge complète d'un sort, en secondes (maquette Recharges) :
   *  gros coup (5A) ; sinon relance officielle × 3 s (2A) ; un sort à 1 lancer par tour attend 3 s (4A) ;
   *  puis le pouvoir Relance éclair (7A) et la réduction des recharges (7B). */
  recharge(id: SkillId): number {
    const d = this.spell(id);
    if (!d) return 0;
    const gr = d.pm && !d.relanceOfficielle ? null : this.grade(id);
    let t = d.grosCoup ? d.grosCoup.recharge : gr ? Math.max(gr.relance * TOUR, d.cooldown, gr.parTour === 1 ? TOUR : 0) : d.cooldown;
    if (t <= 0) return 0;
    let bonus = 0;
    for (const it of Object.values(this.equipment)) for (const l of [it?.legendary, it?.legendary2]) if (l?.id === 'relance' && l.sort === id) bonus += l.value;
    t = Math.max(t > 1 ? 1 : t, t - bonus);
    return t * (1 - this.reductionRecharges);
  }
  /** Le sort a-t-il ses ressources (PA, ou une charge de PM pour un déplacement) ? */
  hasResource(id: SkillId): boolean {
    const s = this.spell(id);
    if (!s) return id === 'attaque';
    return this.pa >= this.paCost(id) && this.pm >= (s.pm ?? 0);
  }
  /** La ressource qui manque pour lancer ce sort. */
  missing(id: SkillId): 'pa' | 'pm' { const s = this.spell(id); return s && this.pm < (s.pm ?? 0) ? 'pm' : 'pa'; }
  get rageFull(): boolean { return this.rage >= this.cls.rage.max; }
  /** XP à gagner pour passer au niveau suivant. */
  get xpNeeded(): number { return this.cls.xpBase * this.level; }

  /** Ajoute l'XP (bonus de Sagesse compris) et renvoie ce qui a été gagné. */
  gainXp(n: number, world: World): number {
    if (this.level >= this.cls.maxLevel) return 0;
    const gain = Math.round(n * (1 + this.stat('sagesse') / 100));
    this.xp += gain;
    while (this.level < this.cls.maxLevel && this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded; this.level++; this.points += 5;
      this.recompute(); this.hp = this.maxHp;
      world.emit({ k: 'levelUp', level: this.level });
      this.learnSpells(world);
    }
    if (this.level >= this.cls.maxLevel) this.xp = 0;
    return gain;
  }

  /** L'arme en main a-t-elle l'effet officiel « Arme de chasse » ? */
  get huntingWeapon(): boolean { const it = this.equipment.arme; return !!(it && this.items?.equipment[it.id]?.chasse); }
  metierLevel(key: string): number { return this.metiers[key]?.level ?? 0; }
  /** XP de métier ; prévient l'affichage à chaque niveau. */
  gainMetierXp(key: string, n: number, world: World) {
    const m = this.metiers[key] ??= { level: 1, xp: 0 };
    if (m.level >= METIER_MAX) return;
    if (world.almanax?.effet === 'metier') n *= 1 + ALMANAX.metier;   // 15C
    m.xp += n;
    while (m.level < METIER_MAX && m.xp >= metierXpNeeded(m.level)) {
      m.xp -= metierXpNeeded(m.level); m.level++;
      world.emit({ k: 'metierLevel', metier: key, level: m.level });
    }
  }

  /** Dernier coup porté (la jauge baisse après 6 s sans frapper, ligne Rage 26B). */
  lastHitAt = -99;
  /** Dernier coup reçu (préréglages, 0.3 13D : pas de changement moins de 5 s après). */
  blesseA = -99;
  // --- Préréglages d'équipement (version 0.3, 13A+13D) ---------------------------------------------
  static readonly PREREGLAGES = 3;
  static readonly PREREGLAGE_DELAI = 5;
  /** 13A : 3 préréglages : équipement (numéros d'objets par emplacement), barre de sorts, variantes. */
  prereglages: (Prereglage | null)[] = Array(Player.PREREGLAGES).fill(null);
  /** Enregistre l'équipement porté, la barre et les variantes dans le préréglage i. */
  enregistrerPrereglage(i: number, nom?: string): boolean {
    if (i < 0 || i >= Player.PREREGLAGES) return false;
    const equipement: Partial<Record<EquipSlot, number>> = {};
    for (const s of EQUIP_SLOTS) { const it = this.equipment[s]; if (it) equipement[s] = it.uid; }
    this.prereglages[i] = { nom: (nom ?? this.prereglages[i]?.nom ?? `Préréglage ${i + 1}`).slice(0, 20), equipement, bar: [...this.bar], variants: [...this.variants] };
    return true;
  }
  /** 13D : temps avant de pouvoir changer (un monstre t'a touché il y a moins de 5 s). */
  get attentePrereglage(): number { return Math.max(0, Player.PREREGLAGE_DELAI - (this.age - this.blesseA)); }
  /** Met le préréglage i : les objets encore au perso (sac ou portés) reprennent leur place, puis la barre et les variantes. */
  mettrePrereglage(i: number): boolean {
    const r = this.prereglages[i];
    if (!r || this.dead || this.attentePrereglage > 0) return false;
    const ou = (uid: number) => this.bag.find(b => b.uid === uid) ?? Object.values(this.equipment).find(e => e?.uid === uid);
    // d'abord on retire ce qui n'est pas dans le préréglage (place faite dans le sac), puis on équipe
    for (const s of EQUIP_SLOTS) {
      const voulu = r.equipement[s], it = this.equipment[s];
      if (it && it.uid !== voulu && this.bag.length < Player.BAG_SIZE) { delete this.equipment[s]; this.bag.push(it); }
    }
    for (const s of EQUIP_SLOTS) {
      const uid = r.equipement[s];
      if (uid == null || this.equipment[s]?.uid === uid || !ou(uid)) continue;
      this.equip(uid, s);
    }
    r.variants.forEach((v, k) => { if ((v === 0 || v === 1) && v !== (this.variants[k] ?? 0)) this.setVariant(k, v); });
    this.bar = r.bar.map(k => (k && (k === 'arme' || this.knows(k as string)) ? k : null)) as (SkillId | null)[];
    while (this.bar.length < 12) this.bar.push(null);
    this.recompute();
    return true;
  }
  /** Coup porté à cette distance : la Rage du Iop monte plus en mêlée, la Précision du Crâ plus de loin (24B). */
  rageOnHit(dist: number, world: World) {
    const R = this.cls.rage;
    this.lastHitAt = this.age;
    const k = R.mode === 'melee' ? (dist <= CASE * 1.5 + this.radius ? 1.5 : 1) : R.mode === 'distance' ? (dist > CASE * 4 ? 2 : 0.5) : 1;
    this.addRage(R.perHit * k, world);
  }
  /** Remplit la jauge de classe ; prévient l'affichage quand elle devient pleine. */
  addRage(n: number, world: World) {
    const R = this.cls.rage, was = this.rageFull;
    this.rage = Math.min(R.max, this.rage + n * (1 + this.legendary('rage') / 100) * (world.quetes?.jaugeX ?? 1));
    if (!was && this.rageFull) {
      world.emit({ k: 'rageFull' });
      const v = this.pcv('pc-iop-C');   // Rage sans fond : Colère de Iop rechargée tout de suite
      if (v && this.age - this.rageSansFondA >= v && this.knows('colere')) {
        this.rageSansFondA = this.age; this.cd.colere = 0; this.casts.colere = [];
        world.emit({ k: 'status', x: this.x, y: this.y - 50, text: 'Colère rechargée', color: '#ff9a4a' });
      }
    }
  }

  drinkPotion(world: World): boolean {
    if (this.dead || this.potions <= 0 || this.potionCd > 0 || this.hp >= this.maxHp) return false;
    const amount = this.soigner(this.maxHp * this.cls.potion.heal * (1 + this.legendary('potion') / 100));
    this.potions--; this.potionCd = this.cls.potion.cooldown;
    world.emit({ k: 'potion', x: this.x, y: this.y, amount });
    return true;
  }

  canStart(id: SkillId): boolean {
    if (this.dead) return false;
    const sp = this.spell(id);
    if (!sp && id !== 'attaque') return false;
    if (sp && this.cd[id] > 0) return false;
    if (sp && id !== 'arme' && (!this.knows(id) || !this.castsLeft(id))) return false;
    if (id === this.autoAttack && this.autoCd > 0) return false;
    if (!this.hasResource(id)) return false;
    if (this.state === 'free' || !this.skill) return true;
    const s = this.skill;
    if (s.id !== 'attaque' && (s.def as SpellDef).move?.kind === 'leap') return false;
    if (sp?.move?.kind === 'leap') return true;           // le Bond annule tout (esquive)
    return s.t >= (s.def.cancelAt ?? s.def.duration);     // sinon on attend la fenêtre d'annulation
  }

  /** Temps mini entre deux auto-attaques : 1 / (attaques par seconde de l'arme x (1 + Vitesse d'attaque %)). */
  attackInterval(): number {
    const aps = this.spell(this.autoAttack)?.aps ?? Player.BASE_APS;
    return 1 / (aps * (1 + this.stat('vitesse') / 100));
  }
  static readonly BASE_APS = 1.2;
  /** Accélération maximale du geste d'auto-attaque par la Vitesse d'attaque (maquette Armes 5A). */
  static readonly GESTE_MAX = 1.6;
  /** Recharge de l'auto-attaque en cours. */
  autoCd = 0;

  /** Portée de la flèche (portée officielle du grade, en cases) et taille de son explosion (qui grandit à chaque lancer des 3 dernières secondes). */
  shot(id: SkillId): { range?: number; explode?: number } {
    const def = this.spell(id);
    if (!def) return {};
    const g = def.pm ? null : this.grade(id);
    const range = g && (def.hit.shape === 'projectile' || def.hit.shape === 'point') ? g.po[1] * CASE + CASE / 2 : undefined;
    let explode: number | undefined;
    if (def.grow) {
      const n = (this.casts[id] ?? []).filter(t => this.age - t < TOUR).length;
      explode = def.grow[Math.min(n, def.grow.length - 1)];
    }
    return { range, explode };
  }
  /** Point d'arrivée d'un sort de déplacement (Bond, Déferlement…) vers le point visé ; sinon la position du perso. */
  landing(id: SkillId, aim: { x: number; y: number }, world: World): { x: number; y: number } {
    const def = this.spell(id);
    let tx = this.x, ty = this.y;
    // Forgelance : Désarmé, un sort « sur la Lance » part d'elle (5A) ; le Saut à la Lance y bondit (8B)
    if (this.lance && (def?.lance?.surLance || def?.lance?.saut)) return { x: this.lance.x, y: this.lance.y };
    if (this.lance && def?.lance?.epilogue) return { x: this.lance.x, y: this.lance.y };
    if (def?.hit.shape === 'point' && !def.move) {   // case visée, ramenée à la portée du sort
      if (this.cls.eniripsa) aim = aimanter(this, def, aim, world);   // Eniripsa 3A : un Mot à cible unique s'aimante sur le perso le plus proche
      const R = (this.shot(id).range ?? def.hit.range) + this.porteeStat(id) + (def.souffrance6?.po && this.souffrance >= 6 ? def.souffrance6.po * CASE : 0), dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy);
      let L = Math.min(d, R) / (d || 1);
      // Ligne de vue officielle (0.3) : la case visée derrière un obstacle est ramenée devant lui
      if (this.v03 && this.demandeVue(id)) for (let i = 0; i < 20 && L > 0 && !world.clearShot(this, { x: this.x + dx * L, y: this.y + dy * L }); i++) L -= Math.min(d, R) / (d || 1) / 20;
      return { x: this.x + dx * Math.max(0, L), y: this.y + dy * Math.max(0, L) };
    }
    if (!def?.move) return { x: tx, y: ty };
    const dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy) || 1;
    const sig = this.rageFull && def.rage === 'dash' ? this.cls.rage.signature : 1;   // Déferlement renforcé : avance plus loin
    let L = Math.min(def.move.maxRange * sig + this.porteePlus(id), d);
    if (def.move.kind === 'dash') {
      // la ruée s'arrête devant le premier ennemi sur sa route
      for (const m of world.monsters) {
        if (m.dead) continue;
        const t = (m.x - this.x) * dx / d + (m.y - this.y) * dy / d, perp = Math.abs(-(m.x - this.x) * dy / d + (m.y - this.y) * dx / d);
        if (t > 0 && t < L + m.radius && perp < m.radius + this.radius) L = Math.max(0, Math.min(L, t - m.radius - this.radius));
      }
    }
    tx = this.x + (dx / d) * L; ty = this.y + (dy / d) * L;
    // on recule vers le départ jusqu'à une case où l'on peut arriver
    for (let i = 0; i < 20 && !world.walkable(tx, ty); i++) { tx -= (dx / d) * L / 20; ty -= (dy / d) * L / 20; }
    return { x: tx, y: ty };
  }
  start(id: SkillId, aim: { x: number; y: number }, world: World) {
    world.emit({ k: 'cast', id });
    if (id === this.autoAttack) this.autoCd = this.attackInterval();
    if (id === 'attaque') {
      const A = this.cls.attaque;
      const idx = this.comboTimer > 0 ? (this.combo + 1) % A.combo.length : 0;
      this.combo = idx; this.comboTimer = 0;
      this.skill = { id, def: A.combo[idx], t: 0, impacted: false, idx, boosted: false };
      this.setAnim('attack' + (idx + 1));
      this.facing = Math.atan2(aim.y - this.y, aim.x - this.x);
      this.state = 'skill';
      return;
    }
    const def = this.spell(id)!;
    if (this.cls.lance && !def.pm) this.incendies = id === 'lance_incendie' ? this.incendies + 1 : 0;   // Lance ardente : d'affilée
    if (def.lance?.rappel && this.lance) this.rappelerLance(world);   // Charge Héroïque, Talon d'Argile, Kyrja : la Lance revient d'abord
    const { x: tx, y: ty } = this.landing(id, aim, world);
    // Rage pleine : ce sort est renforcé (pas les déplacements)
    const boosted = this.rageFull && def.move?.kind !== 'leap' && this.cls.rage.mode !== 'eveil';   // l'Éveil ne renforce pas les sorts
    if (boosted) { this.rage = 0; world.emit({ k: 'rageSpent', spell: id }); }
    // Grade officiel : coût, relance (tours × 3 s), dommages (grade atteint / grade 1), portée des flèches (cases × 48 px)
    const g = def.pm ? null : this.grade(id), g0 = this.official(id)?.grades[0];
    const gm = g && g0 && dmgMoyen(g0) ? dmgMoyen(g) / dmgMoyen(g0) : 1;
    const { range, explode } = this.shot(id);
    this.skill = { id, def, t: 0, impacted: false, sx: this.x, sy: this.y, tx, ty, boosted, gm, explode, range };
    // Recharge (maquette Recharges) : relance officielle aussi pour un déplacement qui la demande (Pas Chassé : 3 tours = 9 s)
    this.cd[id] = this.cdMax[id] = this.recharge(id);
    this.pa -= this.paCost(id); this.pm -= def.pm ?? 0;
    (this.casts[id] ??= []).push(this.age);
    this.casts[id] = this.casts[id].filter(t => this.age - t < Math.max(TOUR, this.retourCharge));
    if (def.move?.kind === 'leap') this.invuln = Math.max(this.invuln, def.duration + 0.05);
    this.setAnim(def.charge ? `${id}_charge` : def.anim ?? id);
    this.facing = def.move && (tx !== this.x || ty !== this.y) ? Math.atan2(ty - this.y, tx - this.x) : Math.atan2(aim.y - this.y, aim.x - this.x);
    this.state = 'skill';
  }

  update(dt: number, input: PlayerInput, world: World) {
    this.age += dt;
    for (const k of Object.keys(this.cd)) {
      if (this.cd[k] <= 0) continue;
      this.cd[k] = Math.max(0, this.cd[k] - dt);
      // 9C : un éclat et un son quand une recharge de 5 s ou plus revient
      if (this.cd[k] === 0 && (this.cdMax[k] ?? 0) >= 5) world.emit({ k: 'rechargePrete', id: k });
    }
    this.autoCd = Math.max(0, this.autoCd - dt);
    if (this.elanT > 0) this.elanT = Math.max(0, this.elanT - dt);
    for (const [k, s] of Object.entries(this.stacks)) { s.t -= dt; if (s.t <= 0) delete this.stacks[k]; }
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
    if (this.cls.souffrance) this.majSouffrance(dt, world);
    if (this.lance) this.majLance(dt, world);
    if (this.encourage || this.soinContinu.length || this.insoignableT > 0 || this.farces.length) majEniripsa(this, dt, world);
    if (this.renvoiT > 0) this.renvoiT -= dt;
    if (this.mutil) {   // Mutilation : re-sacrifie toutes les `periode` s et gagne un cran de Puissance
      const M = this.cls.spells.mutilation?.mutilation;
      this.mutil.next -= dt;   // sans limite de durée : reste active jusqu'à la relance (Coagulation) ou la mort
      if (!M || this.dead) { this.mutil = null; this.mods = this.mods.filter(m => m.src !== 'mutilation'); }
      else if (this.mutil.next <= 0) {   // au-delà des crans : continue de sacrifier toutes les `periode` s (choix de Mathis), sans Puissance en plus
        this.sacrifier(M.sacrifice, world);
        if (this.mutil.n < M.crans) { this.addMod('puissance', M.cran, Infinity, 'mutilation'); this.mutil.n++; }
        this.mutil.next = M.periode;
      }
    }
    if (this.subisT > 0 && (this.subisT -= dt) <= 0) this.subis = 1;
    if (this.pacifiste > 0) this.pacifiste -= dt;
    if (this.rage > 0 && this.age - this.lastHitAt > 6) this.rage = Math.max(0, this.rage - 8 * dt);   // 26B : la jauge retombe hors combat
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.pa = Math.min(this.paMax, this.pa + this.cls.pa.regen * (1 + (this.encourage?.regen ?? 0)) * dt);   // Mot Stimulant
    this.pm = Math.min(this.pmMax, this.pm + dt * (1 + this.legendary('mobilite') / 100) / this.cls.pm.recharge);
    this.flash = Math.max(0, this.flash - dt);
    if (this.slowT > 0) this.slowT -= dt;
    if (this.insensibleT > 0) this.insensibleT -= dt;
    if (this.courseT > 0) this.courseT -= dt;
    if (this.soinsRecusT > 0) this.soinsRecusT -= dt;
    if (this.zonesFL.length) this.majZonesFL(dt, world);
    if (this.mods.length) {
      for (const m of this.mods) m.t -= dt;
      const vita = this.mods.some(m => m.t <= 0 && m.k === 'vitalite');
      this.mods = this.mods.filter(m => m.t > 0);
      if (vita) this.recompute();   // Châtiment Vitalesque : les PV max redescendent
    }
    if (this.dead) { this.setAnim('die', Math.min(1, this.animT + dt * 1.5)); return; }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (input.potion) this.drinkPotion(world);
    // Déplacement à la souris (clic gauche) : sur le sol on y va, sur un monstre on s'approche pour l'attaquer
    let aim = input.aim;
    this.repathT -= dt;
    if (input.pickup != null) {
      const d = world.drops.find(q => q.uid === input.pickup);
      if (d) { this.pickupId = d.uid; this.chaseId = null; this.dest = null; this.path = world.findPath(this, d); }
    }
    if (input.target != null) { this.chaseId = input.target; this.pickupId = null; }
    else if (input.dest) {
      this.chaseId = null; this.pickupId = null;
      if (!this.dest || Math.hypot(input.dest.x - this.dest.x, input.dest.y - this.dest.y) > 20 || this.repathT <= 0) {
        this.dest = { ...input.dest }; this.path = world.findPath(this, input.dest); this.repathT = 0.25;
      }
    }
    if (this.chaseId != null) {
      const m = world.monsters.find(q => q.id === this.chaseId && !q.dead);
      if (!m) { this.chaseId = null; this.path = []; }
      else {
        aim = { x: m.x, y: m.y };
        if (Math.hypot(m.x - this.x, m.y - this.y) <= this.attackReach() + m.radius) {
          this.path = [];
          if (!this.buffer) { this.buffer = this.autoAttack; this.bufferT = 0.05; }   // la poursuite s'arrête au premier coup porté
        } else if (this.repathT <= 0 || !this.path.length) { this.path = world.findPath(this, m); this.repathT = 0.2; }
      }
    }
    if (input.target != null || input.dest || input.pickup != null) this.castChase = null;
    // Tampon d'entrée : une touche pressée 150 ms trop tôt n'est pas perdue
    let pr = input.pressed === 'attaque' ? this.autoAttack : input.pressed;
    // Option 5B : sort lancé sur un monstre hors de portée → le perso s'approche, puis lance
    if (pr && pr !== this.autoAttack && input.approach && input.castOn != null && this.knows(pr) && !this.spell(pr)?.move) {
      const m = world.monsters.find(q => q.id === input.castOn && !q.dead), reach = porteeSort(world, pr);
      if (m && reach > 0 && Math.hypot(m.x - this.x, m.y - this.y) > reach + m.radius) {
        this.castChase = { id: pr, m: m.id }; this.chaseId = null; this.dest = null; this.path = world.findPath(this, m); this.repathT = 0.2; pr = null;
      }
    }
    if (this.castChase) {
      const c = this.castChase, m = world.monsters.find(q => q.id === c.m && !q.dead);
      if (!m) { this.castChase = null; this.path = []; }
      else {
        aim = { x: m.x, y: m.y };
        if (Math.hypot(m.x - this.x, m.y - this.y) <= porteeSort(world, c.id) + m.radius) { this.path = []; this.castChase = null; pr = c.id; }
        else if (this.repathT <= 0 || !this.path.length) { this.path = world.findPath(this, m); this.repathT = 0.2; }
      }
    }
    if (pr && this.spell(pr)?.invoque && this.knows(pr) && this.cls.rage.mode === 'eveil') pr = this.toucheInvocation(pr, world);
    if (pr && (pr === 'attaque' || (this.spell(pr) && (pr === 'arme' || this.knows(pr))))) {
      // sort sans ressource : on le signale (le HUD fait clignoter le compteur), sans le garder en tampon
      if (!this.hasResource(pr) && (pr === 'attaque' || this.cd[pr] <= 0)) world.emit({ k: 'noResource', res: this.missing(pr) });
      this.buffer = pr; this.bufferT = 0.15;
    }
    else if (input.holdAttack && !this.buffer) { this.buffer = this.autoAttack; this.bufferT = 0.05; }
    if (this.buffer) {
      this.bufferT -= dt;
      if (this.canStart(this.buffer)) {
        // un sort lancé arrête le déplacement à la souris (sauf l'auto-attaque d'une poursuite, déjà à portée)
        if (this.buffer !== this.autoAttack) { this.path = []; this.chaseId = null; this.dest = null; }
        else this.chaseId = null;
        this.endSkill(); this.start(this.buffer, aim, world); this.buffer = null;
      }
      else if (this.bufferT <= 0) this.buffer = null;
    }
    if (this.state === 'free') {
      const m = input.move;
      if (m.x || m.y) {
        this.path = []; this.chaseId = null;
        const v = this.speed * this.tackled(m.x, m.y, world);
        this.x += m.x * v * dt; this.y += m.y * v * dt;
        this.facing = Math.atan2(m.y, m.x); this.setAnim('run');
      } else if (this.path.length) {
        const t = this.path[0], dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy), step = this.speed * this.tackled(dx, dy, world) * dt;
        if (d <= step) { this.x = t.x; this.y = t.y; this.path.shift(); }
        else { this.x += dx / d * step; this.y += dy / d * step; }
        if (d > 0.5) this.facing = Math.atan2(dy, dx);
        this.setAnim('run');
      } else this.setAnim('idle');
    } else this.updateSkill(dt, world);
    this.applyKnock(dt);
  }

  /** Touche d'une bête (A Z R T) : bête déjà là -> 5A, jauge pleine, elle s'éveille ; sinon on l'invoque
   *  (s'il ne reste pas assez d'Invocations, la plus ancienne bête s'en va pour lui laisser la place). */
  private toucheInvocation(id: SkillId, world: World): SkillId | null {
    const b = world.beteDe(id);
    if (b) {
      if (this.rageFull && b.eveilT <= 0 && b.def.suivant) { if (b.eveiller(world)) { this.rage = 0; world.emit({ k: 'rageSpent', spell: id }); } }
      else world.emit({ k: 'status', x: b.x, y: b.y - 40, text: b.eveilT > 0 ? 'Déjà éveillé' : this.rageFull ? 'Rang maximal' : 'Éveil pas prêt', color: '#a89fb6' });
      return null;
    }
    return id;
  }

  /** Portée de l'auto-attaque : distance à laquelle on s'arrête pour frapper un monstre poursuivi. */
  attackReach(): number {
    const d = this.spell(this.autoAttack);
    if (!d) return this.cls.attaque.combo[0].range * 0.8;
    const h = d.hit;
    return h.shape === 'cone' ? h.range * 0.8 : h.shape === 'line' ? h.length * 0.75 : h.shape === 'circle' ? h.radius * 0.8 : h.range * 0.85;
  }

  /** Moyenne des dommages de l'arme portée, ajoutée à l'attaque de base. */
  weaponDamage(): number {
    const w = this.equipment.arme && this.items?.equipment[this.equipment.arme.id]?.weapon;
    return w ? w.dmg.reduce((a, d) => a + (d.min + d.max) / 2, 0) : 0;
  }

  endSkill() {
    if (this.skill?.id === 'attaque') this.comboTimer = this.cls.attaque.comboWindow;
    this.state = 'free'; this.skill = null; this.z = 0;
  }

  /** Vrai pendant un saut : on survole les obstacles et les monstres. */
  get airborne(): boolean { return !!this.skill && this.skill.id !== 'attaque' && (this.skill.def as SpellDef).move?.kind === 'leap'; }

  private updateSkill(dt: number, world: World) {
    const s = this.skill!;
    s.t += dt;
    const k = Math.min(1, s.t / s.def.duration);
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    if (s.id === 'attaque' && 'idx' in s) {
      const d = s.def;
      this.animT = k;
      if (s.t < d.impactAt + 0.03) { this.x += fx * d.step * dt; this.y += fy * d.step * dt; }   // petit pas en avant
      if (!s.impacted && s.t >= d.impactAt) {
        s.impacted = true;
        const arc = (d.arc * Math.PI) / 180;
        const hits = world.hitCone(this.x, this.y, this.facing, d.range, arc, { dmg: d.dmg + this.weaponDamage(), knock: d.knock, element: this.cls.attaque.element, sort: 'attaque' });
        this.frenesie(hits, world);
        world.emit({ k: 'spell', fx: 'arc', id: 'attaque', x: this.x, y: this.y, facing: this.facing, size: d.range * 0.85, arc, element: this.cls.attaque.element, big: s.idx === 2, boosted: false });
        world.emit({ k: 'impact', hitstop: hits ? d.hitstop : 0, shake: hits ? d.shake : d.shake * 0.25, big: false });
      }
      if (s.t >= d.duration) this.endSkill();
      return;
    }
    if (!('tx' in s)) return;
    const d = s.def, mv = d.move;
    // Animation : en deux temps pour les sorts chargés
    if (d.charge) {
      if (s.t < d.impactAt) this.setAnim(`${s.id}_charge`, s.t / d.impactAt);
      else this.setAnim(`${s.id}_hit`, (s.t - d.impactAt) / (d.duration - d.impactAt));
    } else this.animT = k;
    // Rage pleine (choix 2B) : dommages en plus, et l'effet qui caractérise le sort poussé de +50 %
    const R = this.cls.rage, boost = s.boosted ? 1 + R.bonus : 1, sig = (k: SpellDef['rage']) => (s.boosted && d.rage === k ? R.signature : 1);
    const area = Math.max(sig('length'), sig('radius'));
    const hz = d.hit;
    if (mv) {
      const kk = Math.min(1, s.t / d.impactAt);
      const e = mv.kind === 'leap' ? (kk < 0.5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2) : 1 - Math.pow(1 - kk, 3);
      if (!s.impacted) {
        this.x = s.sx + (s.tx - s.sx) * e; this.y = s.sy + (s.ty - s.sy) * e;
        this.z = mv.kind === 'leap' ? Math.sin(kk * Math.PI) * (mv.height ?? 0) : 0;
      }
      if (hz.shape === 'circle' && !s.impacted) world.telegraphs.push({ kind: 'circle', x: s.tx, y: s.ty, r: hz.radius * area, progress: kk, danger: false });
    } else if (d.charge && s.t < d.impactAt && hz.shape === 'circle') {
      world.telegraphs.push({ kind: 'circle', x: this.x, y: this.y, r: hz.radius * area, progress: s.t / d.impactAt, danger: false });
    }
    if (!s.impacted && s.t >= d.impactAt) {
      s.impacted = true; this.z = 0;
      if (mv) { this.x = s.tx; this.y = s.ty; }
      // Cumul (Fureur) : chaque lancer augmente les dommages du suivant
      let mult = boost;
      if (this.elanT > 0 && s.id !== 'bond') { mult *= 1 + this.elanV / 100; this.elanT = 0; }   // Élan du héros
      if (d.stack) {
        const st = this.stacks[s.id] ?? { n: 0, t: 0 }, fc = s.id === 'fureur' ? this.pcv('pc-iop-D') : 0;   // Fureur croissante
        mult *= 1 + (d.stack.per + fc / 100) * sig('stack') * st.n;
        this.stacks[s.id] = { n: Math.min(fc ? 5 : d.stack.max, st.n + 1), t: d.stack.time };
      }
      if (d.buff) {
        const n = Math.round(d.buff.n * sig('buff'));
        // Un même bonus ne se cumule pas : il est rafraîchi (sinon Pas Chassé s'enchaînait sans fin).
        // Le PM gagné relève le plafond mais n'est pas rendu : il se remplit avec la recharge normale.
        // Instinct (Osa nerf 1A) : un seul bonus d'instinct à la fois, le dernier lancé remplace les autres
        const inst = d.buff.instinct ? (m: { src?: string }) => !!m.src && !!(this.cls.spells[m.src]?.buff as { instinct?: boolean } | undefined)?.instinct : null;
        this.mods = this.mods.filter(m => m.src !== s.id && !inst?.(m));
        this.addMod(d.buff.stat, n, d.buff.t, s.id);
      }
      if (d.invoque && !d.lapino) {   // le Lapino de l'Eniripsa : voir impactEniripsa
        const key = d.invoque, cout = 1, max = world.invocationsMax(this);
        while (world.invocationsPrises(this) + cout > max) {   // place pour la nouvelle : la plus ancienne s'en va
          const old = world.betes.find(b => !b.dead && b.owner === this && !b.dompteT && !b.finT && !b.horsCompte); if (!old) break; old.mourir(world);
          for (const j of world.betes) if (j.horsCompte && !j.dead && j.owner === this && j.sort === old.sort) j.mourir(world);   // sa jumelle part avec elle
        }
        const b = world.invoquer(this, key, s.id, s.tx, s.ty), ej = key === 'epee_vorace' ? this.pcv('pc-sacrieur-N') : 0;
        if (b && ej) {   // Épées jumelles : deux épées plus faibles
          const b2 = world.invoquer(this, key, s.id, s.tx + CASE, s.ty); if (b2) b2.horsCompte = true;
          for (const e of [b, b2]) if (e) { e.force = ej / 100; e.maxHp = Math.max(1, Math.round(e.maxHp * ej / 100)); e.hp = e.maxHp; }
        }
      }
      if (d.soinAllies) for (const b of world.betes) if (!b.dead && Math.hypot(b.x - s.tx, b.y - s.ty) <= Math.max(60, hz.shape === 'point' || hz.shape === 'circle' ? hz.radius : 60) + b.radius) {
        b.soigner(Math.max(1, (d.dmgPV ? this.hp * d.dmgPV : d.dmg) * s.gm), world);
      }
      if (d.rappel) for (const b of world.betes) if (!b.dead) { const a = this.age * 3 + b.id; b.x = this.x + Math.cos(a) * CASE; b.y = this.y + Math.sin(a) * CASE; }
      if (d.dompte) world.dompter(this, s.tx, s.ty, d.dompte);
      if (d.shield) {
        // Couronne d'Épines à Souffrance 6+ : bouclier en plus par ennemi dans la zone
        const S6 = d.souffrance6?.bouclierParEnnemi && this.souffrance >= 6 && hz.shape === 'circle'
          ? d.souffrance6.bouclierParEnnemi * world.monsters.filter(m => !m.dead && Math.hypot(m.x - this.x, m.y - this.y) <= hz.radius + m.radius).length : 0;
        this.shield = Math.max(this.shield, Math.round(this.maxHp * (d.shield.part + S6) * sig('shield'))); this.shieldT = this.shieldT0 = d.shield.t; this.shieldSrc = s.id;
        if (s.id === 'ferveur') this.ferveurBouclier = this.shield;
      }
      if (d.renvoi) { this.renvoiT = d.renvoi.t; this.renvoiPart = d.renvoi.part; }
      if (d.mutilation) {
        const M = d.mutilation;
        if (this.mutil) {   // relancé : Coagulation, bouclier selon les crans de Mutilation
          const part = M.coagulation[Math.min(this.mutil.n, M.coagulation.length) - 1] ?? M.coagulation[0];
          this.shield = Math.max(this.shield, Math.round(this.maxHp * part)); this.shieldT = this.shieldT0 = 6; this.shieldSrc = 'coagulation';
          this.mutil = null; this.mods = this.mods.filter(m => m.src !== 'mutilation');
          world.emit({ k: 'status', x: this.x, y: this.y - 60, text: 'Coagulation', color: '#e06060' });
        } else {
          this.sacrifier(M.sacrifice, world); this.addMod('puissance', M.puissance, Infinity, 'mutilation');
          this.mutil = { n: 1, next: M.periode };
        }
      }
      if (d.selfKnock) {   // « Recule de n cases » : à l'opposé du tir (freinage de applyKnock : distance = vitesse / 7,13)
        const v = d.selfKnock * sig('selfKnock') * 7.13;
        this.kx -= Math.cos(this.facing) * v; this.ky -= Math.sin(this.facing) * v;
      }
      if (d.grosCoup) mult *= d.grosCoup.mult;   // 5A : gros coup
      // Forgelance : centre des zones « sur la Lance » (Phalange, Prélude au Fer, Muspel…), effets sur les alliés, Muspel par ennemi
      const L = this.lance, surL = !!(d.lance?.surLance && L), cx = surL && hz.shape === 'circle' ? L!.x : this.x, cy = surL && hz.shape === 'circle' ? L!.y : this.y;
      const rz = hz.shape === 'circle' || hz.shape === 'point' ? hz.radius : 0;
      if (d.allies || d.dissipe) this.effetsAllies(d, hz.shape === 'point' ? s.tx : cx, hz.shape === 'point' ? s.ty : cy, rz, world);
      const nZone = d.parEnnemi ? world.monsters.filter(m => !m.dead && Math.hypot(m.x - s.tx, m.y - s.ty) <= rz + m.radius).length : 0;
      if (d.parEnnemi) mult *= 1 + (d.parEnnemi + (s.id === 'muspel' ? this.pcv('pc-forgelance-O') / 100 : 0)) * nZone;   // Muspel insatiable
      if (s.id === 'muspel' && nZone && this.pcv('pc-forgelance-O')) this.cd.muspel = Math.max(0, (this.cd.muspel ?? 0) - 0.5 * nZone);
      const depuisLance = !!(d.lance?.surLance && L) && (hz.shape === 'circle' || Math.hypot(s.tx - L!.x, s.ty - L!.y) < CASE);
      if (depuisLance && this.pcv('pc-forgelance-enracinee')) { const v = this.pcv('pc-forgelance-enracinee'); mult *= 1 + Math.min(v * 7, v * L!.t) / 100; }   // Lance enracinée
      // Transfusion : dommages en part des PV restants ; Attirance (plus forte à Souffrance 6+), Condensation, Supplice
      const base = d.dmgPV ? this.hp * d.dmgPV : d.dmg * s.gm;
      const attire = d.attire && { px: ((this.souffrance >= 6 && d.souffrance6?.attire) || d.attire.cases) * CASE, vers: d.attire.vers };
      const hit = { dmg: (base + (s.id === this.cls.basic ? this.weaponDamage() : 0)) * mult, attire, supplice: d.supplice, knock: d.knock * sig('knock'), element: d.element, vsSummon: d.vsSummon && 1 + (d.vsSummon - 1) * sig('summon'), vsElite: sig('summon') > 1,
        pushDmg: (d.pushDmg && s.boosted) || (!!this.cls.lance && d.knock > 0),   // Forgelance : dommages de poussée officiels (10A)
        affaiblit: d.affaiblit,
        lifesteal: d.lifesteal && d.lifesteal * sig('lifesteal'), erosion: d.erosion && d.erosion * sig('erosion'),
        pmLoss: d.pmLoss && Math.round(d.pmLoss * sig('pm')), paLoss: d.paLoss && Math.round(d.paLoss * sig('pa')),
        poLoss: d.poLoss && this.parGrade(s.id, d.poLoss),
        // Maquette Armes 3B : un coup d'arme fait jaillir un éclat de la couleur de son élément sur chaque monstre touché
        eclat: s.id === 'arme' || undefined, crit: this.critSort(s.id) || undefined, sort: s.id,
        ...this.effetsPouvoirsClasse(s.id) };
      let hits = 0, size = 0;
      // Pouvoirs officiels (0.3) : zone plus grande, ligne ou cône plus long
      const zb = this.zoneBonus(s.id) + (s.boosted && R.mode === 'eloquence' ? this.cls.eniripsa?.zoneEloquence ?? 0 : 0), pp = this.porteePlus(s.id);   // Éloquence : +2 cases de zone
      // Eniripsa : effets des Mots sur les alliés d'abord ; vrai = aucun coup aux monstres (soutien, ou Mot posé sur un allié)
      const rEni = hz.shape === 'point' || hz.shape === 'circle' ? hz.radius * area + zb : 0;
      const eni = !!this.cls.eniripsa && !mv, pasDeCoup = eni && impactEniripsa(this, s.id, d, s.tx, s.ty, rEni, mult, world);
      world.degatsCoup = 0;
      if (d.self) { size = 60; }
      else if (pasDeCoup) { size = rEni; }
      else if (hz.shape === 'cone') { size = hz.range * area + pp + zb; hits = world.hitCone(this.x, this.y, this.facing, size, (hz.arc * Math.PI) / 180, hit, d.stun); }
      else if (hz.shape === 'line') { size = hz.length * area + pp; hits = world.hitLine(this.x, this.y, this.facing, size, hz.width * area + zb, hit, d.stun); }
      else if (hz.shape === 'point' && s.id === 'epee' && this.pcv('pc-iop-B')) {   // Lame tournoyante : tout autour du Iop
        size = hz.radius * area + zb; s.tx = this.x; s.ty = this.y;
        hits = world.hitCircle(this.x, this.y, size, { ...hit, dmg: hit.dmg * this.pcv('pc-iop-B') / 100 }, d.stun);
      }
      else if (hz.shape === 'point' && s.id === 'hemorragie' && this.pcv('pc-sacrieur-J')) {   // Rivière de sang : tout l'arc devant
        size = CASE * 2 + zb; s.tx = this.x + Math.cos(this.facing) * size * 0.6; s.ty = this.y + Math.sin(this.facing) * size * 0.6;
        hits = world.hitCone(this.x, this.y, this.facing, size, (120 * Math.PI) / 180, { ...hit, dmg: hit.dmg * this.pcv('pc-sacrieur-J') / 100 }, d.stun);
      }
      else if (hz.shape === 'point' && d.allies && !d.dmg) { size = hz.radius * area + zb; }   // soutien du Forgelance (Phalange, Prélude au Fer) : aucun coup aux monstres
      else if (hz.shape === 'point') { size = hz.radius * area + zb; hits = world.hitCircle(s.tx, s.ty, size, hit, d.stun, this.facing); }   // poussée dans l'axe du lanceur, comme Dofus
      else if (hz.shape === 'circle' && d.vuln && !d.dmg) { size = hz.radius * area + zb; world.markVuln(this.x, this.y, size, d.vuln.n, d.vuln.t); }
      else if (hz.shape === 'circle') {
        size = hz.radius * area + zb; hits = world.hitCircle(cx, cy, size, hit, d.stun);
        if (surL && this.jumelleT > 0 && hit.dmg > 0) hits += world.hitCircle(this.x, this.y, size, { ...hit, dmg: hit.dmg * this.jumelleV / 100 }, d.stun);   // Lance jumelle
      }
      else {
        // Flèche : la zone (et les dommages) partent avec le projectile ; l'effet d'impact se joue à l'arrivée
        const shot = { ...hz, range: s.range ?? hz.range, explode: s.explode ?? hz.explode };
        const rc = s.id === 'cinglante' ? this.pcv('pc-cra-B') : 0;   // Rafale cinglante : 3 flèches en éventail
        if (rc) for (const da of [-0.22, 0, 0.22]) world.shoot(this.x, this.y, this.facing + da, shot, { ...hit, dmg: hit.dmg * rc / 100 }, d.stun ?? 0, sig('explode'), s.id);
        else world.shoot(this.x, this.y, this.facing, shot, hit, d.stun ?? 0, sig('explode'), s.id);
        size = hz.range;
      }
      if (d.echange) world.echanger(this, s.tx, s.ty, CASE * 0.75);   // Assaut, Transposition : après le coup
      if (eni && !pasDeCoup) { apresCoupEniripsa(this, d, s.tx, s.ty, rEni, world.degatsCoup, world); alchiRhetorique(this, d, s.tx, s.ty, rEni, world); }
      if (d.envol) envol(this, s.sx, s.sy, s.tx, s.ty, world);   // Mot d'Envol : échange de place avec l'allié visé
      if (d.lance && this.cls.lance) this.apresImpactLance(d, s.tx, s.ty, world);
      if (d.traverse) {   // Balestra : de l'autre côté de la cible, puis petit recul
        const fx2 = Math.cos(this.facing), fy2 = Math.sin(this.facing), nx = this.x + fx2 * d.traverse * CASE, ny = this.y + fy2 * d.traverse * CASE;
        const bt = s.id === 'balestra' ? this.pcv('pc-forgelance-J') : 0;   // Balestra tranchante : frappe ce qu'il traverse
        if (bt) world.hitLine(this.x, this.y, this.facing, d.traverse * CASE, 30, { ...hit, dmg: hit.dmg * bt / 100, knock: 0 });
        if (world.walkable(nx, ny)) { this.x = nx; this.y = ny; }
      }
      if (s.id === 'arme') this.frenesie(hits, world);
      this.apresImpactClasse(s.id, s.sx, s.sy, s.tx, s.ty, hit, s.gm, size, world);
      const pt = hz.shape === 'point';
      if (d.self && surL && hz.shape === 'circle') size = hz.radius * area + zb;   // Forgelance Désarmé : l'effet se voit autour de la Lance
      if (hz.shape !== 'projectile') world.emit({ k: 'spell', fx: pt ? 'burst' : d.fx, id: s.id, x: pt ? s.tx : surL ? cx : this.x, y: pt ? s.ty : surL ? cy : this.y, cx: this.x, cy: this.y, facing: this.facing, size,
        arc: hz.shape === 'cone' ? (hz.arc * Math.PI) / 180 : 0, element: d.element, big: d.shake >= 0.012 || s.boosted, boosted: s.boosted });
      else world.emit({ k: 'shoot', id: s.id, x: this.x, y: this.y, facing: this.facing, element: d.element, boosted: s.boosted });
      if (hz.shape !== 'projectile') world.emit({ k: 'impact', hitstop: hits || d.charge ? d.hitstop * (s.boosted ? 1.4 : 1) : 0, shake: d.shake * (s.boosted ? 1.5 : 1), big: d.shake >= 0.012 || s.boosted });
    }
    if (s.t >= d.duration) this.endSkill();
  }

  // --- Forgelance : la Lance Immortelle (maquette Forgelance, 8 nov. 2026) -----------------------------------
  /** Plante la Lance (Désarmé). Si elle était déjà plantée, elle change de place sans bonus de reprise. */
  planterLance(x: number, y: number, world: World) {
    if (!world.walkable(x, y)) { const a = Math.atan2(y - this.y, x - this.x); for (let i = 0; i < 12 && !world.walkable(x, y); i++) { x -= Math.cos(a) * CASE / 3; y -= Math.sin(a) * CASE / 3; } }
    const o = this.lance;
    this.lance = { x, y, t: 0 };
    if (this.pcv('pc-forgelance-B')) { this.jumelleT = 4; this.jumelleV = this.pcv('pc-forgelance-B'); }   // Lance jumelle
    world.emit({ k: 'lance', quoi: 'plante', id: this.id, x, y, ox: o?.x ?? this.x, oy: o?.y ?? this.y });
  }
  /** Reprend la Lance : rappel (1B : elle revient en frappant ce qu'elle traverse) ou à pied (Reprise de Volée, bonus doublé, 3B).
   *  seule : retour automatique (trop loin, 4A), sans bonus ni coup. */
  reprendreLance(world: World, comment: 'rappel' | 'pied' | 'seule') {
    const L = this.lance, C = this.cls.lance;
    if (!L || !C) return;
    this.lance = null;
    if (comment === 'rappel') {   // Rappel tranchant : la Lance revient en ligne droite et frappe tout ce qu'elle traverse
      const d = Math.hypot(this.x - L.x, this.y - L.y);
      const rf = this.pcv('pc-forgelance-C');   // Rappel foudroyant : plus fort, et étourdit
      if (d > CASE) world.hitLine(L.x, L.y, Math.atan2(this.y - L.y, this.x - L.x), d, 26, { dmg: C.tranchant * (rf || 1), knock: 0, element: 'meilleur' }, rf ? 0.5 : undefined);
    }
    this.zonesFL = this.zonesFL.filter(z => !z.surLance);   // Lance ardente : le sol cesse de brûler
    if (comment !== 'seule') {
      const n = comment === 'pied' ? C.aPied : C.reprise;
      this.mods = this.mods.filter(m => m.src !== 'reprise');
      this.addMod('puissance', n, C.duree, 'reprise');
      world.emit({ k: 'status', x: this.x, y: this.y - 60, text: `${comment === 'pied' ? 'Reprise de Volée' : 'Reprise'} +${n} Puissance`, color: '#e8b860' });
      this.reprisesLegendaires(L, comment, world);
    }
    world.emit({ k: 'lance', quoi: comment === 'pied' ? 'reprise' : 'rappel', id: this.id, x: this.x, y: this.y, ox: L.x, oy: L.y });
  }
  rappelerLance(world: World) { this.reprendreLance(world, 'rappel'); }
  /** Reprise de Volée (marcher dans le glyphe de la Lance) et retour automatique au-delà de 15 cases (4A). */
  private majLance(dt: number, world: World) {
    const L = this.lance!, C = this.cls.lance;
    if (!C || this.dead) { this.lance = null; return; }
    L.t += dt;
    if (this.jumelleT > 0) this.jumelleT -= dt;
    const d = Math.hypot(this.x - L.x, this.y - L.y);
    if (d > C.portee) this.reprendreLance(world, 'seule');
    else if (L.t > 0.5 && d <= C.glyphe + this.radius && this.state === 'free') this.reprendreLance(world, 'pied');
  }
  /** Ce que fait un sort à la Lance après son impact (planter, rappeler, Épilogue, Saut à la Lance). */
  private apresImpactLance(d: SpellDef, tx: number, ty: number, world: World) {
    const l = d.lance!;
    if (l.epilogue) { if (this.lance) this.rappelerLance(world); else this.planterLance(tx, ty, world); return; }
    if (l.saut) { if (this.lance && Math.hypot(this.x - this.lance.x, this.y - this.lance.y) <= CASE * 1.5) this.reprendreLance(world, 'pied'); return; }
    if (l.plante) this.planterLance(tx, ty, world);
    if (l.rappelApres && this.lance) this.rappelerLance(world);
  }
  /** Sorts de soutien du Forgelance (11A) : bouclier et Puissance aux alliés de la zone (joueurs, bêtes, Épées) ; Prélude au Fer retire
   *  les bonus des ennemis. */
  private effetsAllies(d: SpellDef, x: number, y: number, r: number, world: World) {
    const a = d.allies;
    if (a) {
      for (const q of world.players) {
        if (q.dead || Math.hypot(q.x - x, q.y - y) > r + q.radius) continue;
        if (a.shield) { q.shield = Math.max(q.shield, Math.round(q.maxHp * a.shield)); q.shieldT = q.shieldT0 = a.t; q.shieldSrc = 'phalange'; }
        if (a.puissance) { q.mods = q.mods.filter(m => m.src !== 'prelude'); q.addMod('puissance', a.puissance, a.t, 'prelude'); }
        if (a.puissance && this.pcv('pc-forgelance-P')) q.courir(this.pcv('pc-forgelance-P') / 100, 4);   // Prélude glorieux
      }
      if (a.shield) for (const b of world.betes) if (!b.dead && Math.hypot(b.x - x, b.y - y) <= r + b.radius) { b.shield = Math.max(b.shield, Math.round(b.maxHp * a.shield)); b.shieldT = a.t; }
    }
    if (d.dissipe) for (const m of world.monsters) if (!m.dead && Math.hypot(m.x - x, m.y - y) <= r + m.radius && m.furyT > 0) {
      m.furyT = 0; m.furyPct = m.furyFlat = 0;
      world.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Bonus retirés', color: '#c8c8c8' });
    }
  }
  /** Frénésie (légendaire Sacrieur B) : à Souffrance 8+, un coup de poing ou d'arme qui touche accélère les attaques (5 cumuls, 3 s). */
  private frenesie(hits: number, world: World) {
    const v = hits > 0 && this.souffrance >= 8 ? this.pcv('pc-sacrieur-B') : 0;
    if (!v) return;
    const l = this.mods.filter(m => m.src === 'frenesie');
    if (l.length < 5) { this.addMod('vitesse', v, 3, 'frenesie'); if (l.length === 4) world.emit({ k: 'status', x: this.x, y: this.y - 60, text: 'Frénésie !', color: '#ff3b3b' }); }
    for (const m of l) m.t = 3;
  }
  /** Châtiments (légendaires Sacrieur E à I, Dofus Rétro) : chaque coup reçu donne la caractéristique 6 s, 5 cumuls. */
  private chatiments() {
    let vita = false;
    for (const [id, k] of Object.entries(CHATIMENTS)) {
      const v = this.pcv(id);
      if (!v) continue;
      const l = this.mods.filter(m => m.src === id);
      if (l.length < 5) { this.addMod(k, v, 6, id); vita ||= k === 'vitalite'; }
      for (const m of l) m.t = 6;
    }
    if (vita) this.recompute();
  }
  /** Champs de coup des légendaires de classe (0.3) : exécution, bonus à distance, gel, clouage, marque, rebonds, gerbe. */
  private effetsPouvoirsClasse(id: string): Partial<HitDef> {
    if (!this.v03) return {};
    const o: Partial<HitDef> = {}, v = (k: string) => this.pcv(k);
    if (id === 'couperet' && v('pc-iop-F')) o.execute = v('pc-iop-F') / 100;
    if (v('pc-cra-E') && this.mods.some(m => m.src === 'tirs_eloignes')) o.loin = v('pc-cra-E');
    if (id === 'glacee' && v('pc-cra-F')) o.givre = v('pc-cra-F');
    if (id === 'recul' && v('pc-cra-G')) { o.clouage = v('pc-cra-G'); o.pushDmg = true; }
    if (id === 'abolition' && v('pc-cra-H')) o.marque = v('pc-cra-H');
    if (id === 'vagabonde' && v('pc-cra-C')) o.rebonds = v('pc-cra-C');
    if (id === 'explosive' && v('pc-cra-A')) o.gerbe = v('pc-cra-A');
    if (id === 'stase' && v('pc-sacrieur-P')) o.stase = v('pc-sacrieur-P');
    // Suite (« Légendaires classes suite ») : Iop I J N, Crâ J K L M N
    if (id === 'pression' && v('pc-iop-I')) o.marque = v('pc-iop-I');
    if (id === 'concentration' && v('pc-iop-J')) o.vsGros = v('pc-iop-J');
    if (id === 'deferlement' && v('pc-iop-N')) o.tue = 'deferlement';
    if (id === 'detonante' && v('pc-cra-J')) o.gerbe = v('pc-cra-J');
    if (id === 'barrage' && v('pc-cra-K')) o.brule = v('pc-cra-K');
    if (id === 'dispersion' && v('pc-cra-L')) { o.knock = 0; o.attire = { px: CASE * 2, vers: 'centre' }; o.plus = v('pc-cra-L'); }
    if (id === 'glacee' && v('pc-cra-M')) o.perce = v('pc-cra-M') - 1;
    if (id === 'abolition' && v('pc-cra-N')) o.surplus = v('pc-cra-N');
    if (id === 'dents_piranya' && v('pc-osamodas-K')) o.festin = true;
    // Forgelance (« Légendaires forgelance : 4A-4P »)
    if (id === 'charge_heroique' && v('pc-forgelance-D')) o.choc = 100;
    if (id === 'kyrja' && v('pc-forgelance-K')) o.partage = v('pc-forgelance-K');
    if (id === 'talon_argile' && v('pc-forgelance-L')) o.tue = 'talon_argile';
    if (id === 'volee_airain' && v('pc-forgelance-M') && this.lance) o.enclume = { x: this.lance.x, y: this.lance.y, k: v('pc-forgelance-M') };
    if (id === 'estoc_brulant' && v('pc-forgelance-N')) o.plusChoc = v('pc-forgelance-N');
    return o;
  }
  /** Effets des légendaires de classe qui s'ajoutent à l'impact d'un sort (Iop A E G H, Osamodas A B C G H). */
  private apresImpactClasse(id: string, sx: number, sy: number, tx: number, ty: number, hit: HitDef, gm: number, size: number, world: World) {
    if (!this.v03) return;
    const v = (k: string) => this.pcv(k), cri = (text: string) => world.emit({ k: 'status', x: this.x, y: this.y - 60, text, color: '#ffb347' });
    if (id === 'bond' && v('pc-iop-A')) {   // Bond sismique : onde de choc Terre à l'atterrissage
      const pr = this.cls.spells.pression;
      world.hitCircle(this.x, this.y, CASE * 2, { dmg: (pr?.dmg ?? 26) * gm * v('pc-iop-A') / 100, knock: 0, element: 'terre' });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-iop-A', x: this.x, y: this.y, cx: this.x, cy: this.y, facing: this.facing, size: CASE * 2, arc: 0, element: 'terre', big: true, boosted: false });
    }
    if (id === 'deferlement' && v('pc-iop-E')) {   // Vague de retour : le point de départ de la charge est frappé aussi
      world.hitCircle(sx, sy, size, { ...hit, dmg: hit.dmg * v('pc-iop-E') / 100 });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-iop-E', x: sx, y: sy, cx: sx, cy: sy, facing: this.facing, size, arc: 0, element: hit.element ?? 'eau', big: false, boosted: false });
    }
    if (id === 'absorption' && v('pc-sacrieur-K')) {   // Absorption vorace : rebonds sur les monstres proches de la cible
      let fx = tx, fy = ty, dm = hit.dmg; const pris = new Set<number>();
      for (const m of world.monsters) if (!m.dead && Math.hypot(m.x - tx, m.y - ty) <= size + m.radius) pris.add(m.id);
      for (let i = 0; i < v('pc-sacrieur-K'); i++) {
        const nx = world.monsters.filter(m => !m.dead && m.state !== 'spawn' && !pris.has(m.id) && Math.hypot(m.x - fx, m.y - fy) <= CASE * 4)
          .sort((a, b) => Math.hypot(a.x - fx, a.y - fy) - Math.hypot(b.x - fx, b.y - fy))[0];
        if (!nx) break;
        pris.add(nx.id); dm *= 0.8;
        world.applyHits(m => m === nx, { ...hit, dmg: dm }, fx, fy, 0);
        world.emit({ k: 'spell', fx: 'burst', id: 'absorption', x: nx.x, y: nx.y, cx: fx, cy: fy, facing: Math.atan2(nx.y - fy, nx.x - fx), size: CASE * 0.6, arc: 0, element: 'feu', big: false, boosted: false });
        fx = nx.x; fy = nx.y;
      }
    }
    if (id === 'ravage' && v('pc-sacrieur-L')) {   // Sillage écarlate : une traînée de sang du départ à l'arrivée
      const L = Math.hypot(this.x - sx, this.y - sy), k = Math.max(1, Math.ceil(L / CASE)), touches = new Set<number>();
      for (let i = 0; i <= k; i++) world.zonesSol.push({ x: sx + (this.x - sx) * i / k, y: sy + (this.y - sy) * i / k, r: CASE * 0.6, t: 2, hit: { ...hit, dmg: hit.dmg * v('pc-sacrieur-L') / 100 }, touches, id: 'pc-sacrieur-L' });
    }
    if (id === 'attirance' && v('pc-sacrieur-M') && hit.attire)   // Chaîne de chair : les voisins de la cible viennent aussi
      world.hitCircle(tx, ty, size + v('pc-sacrieur-M') * CASE, { dmg: 0, knock: 0, attire: hit.attire });
    if (id === 'intimidation' && v('pc-iop-G')) { world.repousser(this.x, this.y, v('pc-iop-G') * CASE, 684); cri('Cri du champion'); }
    if (id === 'epee_divine' && v('pc-iop-H'))   // Épée jumelle : une épée reste au sol 3 s
      world.zonesSol.push({ x: this.x, y: this.y, r: size, t: 3, hit: { ...hit, dmg: hit.dmg * v('pc-iop-H') / 100 }, touches: new Set(), id: 'pc-iop-H' });
    if (id === 'cortege' && v('pc-osamodas-A')) world.horde(this, 2, v('pc-osamodas-A'));
    if (id === 'fouet' && v('pc-osamodas-B'))   // Coup de fouet : les bêtes près du coup s'emballent
      for (const b of world.betes) if (!b.dead && Math.hypot(b.x - tx, b.y - ty) <= CASE * 3) { b.hate = v('pc-osamodas-B'); b.hateT = 4; }
    if (id === 'souffle_draconique' && v('pc-osamodas-C')) {   // Souffle partagé : la Dragoune crache aussi
      const dr = world.betes.find(b => !b.dead && ['dragoune', 'dragonnet', 'sulfenix'].includes(b.type));
      if (dr) {
        const a = Math.atan2(ty - dr.y, tx - dr.x), L = Math.min(240, Math.hypot(tx - dr.x, ty - dr.y)), px = dr.x + Math.cos(a) * L, py = dr.y + Math.sin(a) * L;
        dr.facing = a;
        world.hitCircle(px, py, size, { ...hit, dmg: hit.dmg * v('pc-osamodas-C') / 100 }, 0, a);
        world.emit({ k: 'spell', fx: 'burst', id: 'souffle_draconique', x: px, y: py, cx: dr.x, cy: dr.y, facing: a, size, arc: 0, element: 'feu', big: false, boosted: false });
      }
    }
    if (id === 'saute_granouille' && v('pc-osamodas-G')) for (const b of world.betes) if (!b.dead) {   // Bond du crapaud
      const a = this.age * 3 + b.id; b.x = this.x + Math.cos(a) * CASE; b.y = this.y + Math.sin(a) * CASE;
      b.shield = Math.max(b.shield, Math.round(b.maxHp * v('pc-osamodas-G') / 100));
    }
    if (id === 'couperet' && v('pc-iop-L')) {   // Sillon brûlant : une fissure de feu reste 2 s sur la ligne
      const r = size / 2, cx = this.x + Math.cos(this.facing) * r, cy = this.y + Math.sin(this.facing) * r;
      world.zonesSol.push({ x: cx, y: cy, r, t: 2, hit: { ...hit, dmg: hit.dmg * v('pc-iop-L') / 100, execute: undefined, pmLoss: undefined }, touches: new Set(), id: 'pc-iop-L' });
    }
    if (id === 'colere' && v('pc-iop-M')) {   // Colère du ciel : les monstres à 1 case autour de la cible
      world.applyHits(m => { const d = Math.hypot(m.x - tx, m.y - ty) - m.radius; return d > size && d <= size + CASE; }, { ...hit, dmg: hit.dmg * v('pc-iop-M') / 100 }, tx, ty, 0);
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-iop-M', x: tx, y: ty, cx: tx, cy: ty, facing: this.facing, size: size + CASE, arc: 0, element: 'terre', big: true, boosted: false });
    }
    if (id === 'bond' && v('pc-iop-P')) { this.elanT = 3; this.elanV = v('pc-iop-P'); }
    if (id === 'pas_chasse' && v('pc-cra-I')) {   // Pas de l'ombre : gerbe de flèches au point de départ
      const ci = this.cls.spells.cinglante;
      world.hitCircle(sx, sy, CASE * 2, { dmg: (ci?.dmg ?? 15) * v('pc-cra-I') / 100, knock: 0, element: 'air' });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-cra-I', x: sx, y: sy, cx: sx, cy: sy, facing: this.facing, size: CASE * 2, arc: 0, element: 'air', big: false, boosted: false });
    }
    if (id === 'vagabonde' && v('pc-cra-P')) {   // Repli prudent : bouclier en s'éloignant
      this.shield = Math.max(this.shield, Math.round(this.maxHp * v('pc-cra-P') / 100)); this.shieldT = this.shieldT0 = 3; this.shieldSrc = 'pc-cra-P';
      cri('Repli prudent');
    }
    if (id === 'cri_corbac' && v('pc-osamodas-I')) {   // Nuée de corbacs : d'autres monstres près de la cible
      const pris = world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - tx, m.y - ty) > size + m.radius && Math.hypot(m.x - tx, m.y - ty) <= CASE * 3)
        .sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty)).slice(0, v('pc-osamodas-I'));
      if (pris.length) world.applyHits(m => pris.includes(m), hit, tx, ty, 0);
      for (const m of pris) world.emit({ k: 'spell', fx: 'burst', id: 'cri_corbac', x: m.x, y: m.y, cx: tx, cy: ty, facing: this.facing, size: 30, arc: 0, element: 'air', big: false, boosted: false });
    }
    if (id === 'pics_prespic' && v('pc-osamodas-J'))   // Tapis de piquants : épines au sol 3 s
      world.zonesSol.push({ x: tx, y: ty, r: Math.max(size, CASE), t: 3, hit: { ...hit, dmg: hit.dmg * v('pc-osamodas-J') / 100, lifesteal: undefined }, touches: new Set(), id: 'pc-osamodas-J' });
    if (id === 'dents_piranya' && v('pc-osamodas-K')) {   // Festin du piranya : la meute se soigne des dégâts faits
      const n = world.festin * v('pc-osamodas-K') / 100; world.festin = 0;
      if (n > 0) for (const b of world.betes) if (!b.dead) b.soigner(n, world);
    }
    if (id === 'cri_ours' && v('pc-osamodas-L')) {   // Peau de l'ours : bouclier pour l'Osamodas et les bêtes proches
      const k = v('pc-osamodas-L') / 100;
      this.shield = Math.max(this.shield, Math.round(this.maxHp * k)); this.shieldT = this.shieldT0 = 5; this.shieldSrc = 'pc-osamodas-L';
      for (const b of world.betes) if (!b.dead && Math.hypot(b.x - this.x, b.y - this.y) <= CASE * 3) { b.shield = Math.max(b.shield, Math.round(b.maxHp * k)); b.shieldT = 5; }
    }
    if (id === 'piqure' && v('pc-osamodas-O') && this.age - this.piqureA >= 20) {   // Piqûre d'éveil
      const b = world.betes.filter(q => !q.dead && !q.dompteT && q.eveilT <= 0).sort((a, c) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(c.x - this.x, c.y - this.y))[0];
      if (b && b.eveiller(world)) { b.eveilT = v('pc-osamodas-O'); this.piqureA = this.age; cri("Piqûre d'éveil"); }
    }
    if (id === 'charge_bestiale' && v('pc-osamodas-P')) {   // Charge de la meute : chaque bête bondit sur la cible
      const m = world.monsters.filter(q => !q.dead && q.state !== 'spawn' && Math.hypot(q.x - this.x, q.y - this.y) <= size + CASE + q.radius)
        .sort((a, c) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(c.x - this.x, c.y - this.y))[0];
      if (m) for (const b of world.betes) if (!b.dead && !b.dompteT) {
        const a = Math.atan2(b.y - m.y, b.x - m.x); b.x = m.x + Math.cos(a) * (m.radius + b.radius + 4); b.y = m.y + Math.sin(a) * (m.radius + b.radius + 4);
        if (!m.dead) world.applyHits(q => q === m, { ...hit, dmg: hit.dmg * v('pc-osamodas-P') / 100 }, b.x, b.y, 0);
      }
    }
    if (id === 'charge_bestiale' && v('pc-osamodas-H')) for (const b of world.betes) if (!b.dead) b.soigner(b.maxHp * v('pc-osamodas-H') / 100, world);
    // --- Forgelance ---
    if (id === 'trident' && v('pc-forgelance-A'))   // Tourbillon abyssal : 2 s, attire et frappe chaque demi-seconde
      this.zonesFL.push({ x: tx, y: ty, r: Math.max(size, CASE * 1.5), t: 2, next: 0.5, hit: { ...hit, dmg: hit.dmg * v('pc-forgelance-A') / 100 * 0.5, knock: 0, attire: { px: CASE * 0.6, vers: 'centre' } }, id: 'pc-forgelance-A' });
    if (id === 'charge_heroique' && v('pc-forgelance-D')) {   // Charge du champion : ce qu'elle traverse
      const L = Math.hypot(this.x - sx, this.y - sy);
      if (L > CASE * 0.5) world.hitLine(sx, sy, Math.atan2(this.y - sy, this.x - sx), L, 30, { ...hit, dmg: hit.dmg * v('pc-forgelance-D') / 100, knock: 0, choc: undefined });
    }
    if (id === 'saut' && v('pc-forgelance-F')) {   // Saut écrasant : onde Terre à l'arrivée
      const lp = this.cls.spells.lance_pierre;
      world.hitCircle(this.x, this.y, CASE * 2, { dmg: (lp?.dmg ?? 24) * gm * v('pc-forgelance-F') / 100, knock: 342, element: 'terre', pushDmg: true });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-forgelance-F', x: this.x, y: this.y, cx: this.x, cy: this.y, facing: this.facing, size: CASE * 2, arc: 0, element: 'terre', big: true, boosted: false });
    }
    if (id === this.cls.basic && this.cls.lance && this.arme && v('pc-forgelance-G') && ++this.estocs % 3 === 0) {   // Fer de la forge
      world.hitLine(this.x, this.y, this.facing, CASE * 4, 30, { dmg: hit.dmg * v('pc-forgelance-G') / 100, knock: 0, element: 'feu' });
      world.emit({ k: 'spell', fx: 'line', id: 'pc-forgelance-G', x: this.x, y: this.y, cx: this.x, cy: this.y, facing: this.facing, size: CASE * 4, arc: 0, element: 'feu', big: false, boosted: false });
    }
    if (id === 'lance_incendie' && v('pc-forgelance-I') && this.incendies >= 3 && this.lance && !this.zonesFL.some(z => z.surLance)) {   // Lance ardente
      this.zonesFL.push({ x: this.lance.x, y: this.lance.y, r: CASE * 2, t: Infinity, next: 0.5, hit: { ...hit, dmg: hit.dmg * v('pc-forgelance-I') / 100 * 0.5, knock: 0 }, id: 'pc-forgelance-I', surLance: true });
      cri('Lance ardente');
    }
    if (id === 'estoc_brulant' && v('pc-forgelance-N')) {   // Estoc en avant : 2 cases en avant avec le coup
      for (let i = 0; i < 8; i++) { const nx = this.x + Math.cos(this.facing) * CASE / 4, ny = this.y + Math.sin(this.facing) * CASE / 4; if (!world.walkable(nx, ny)) break; this.x = nx; this.y = ny; }
    }
  }
  /** Zones à nous (Tourbillon abyssal, Lance ardente) : frappent tout ce qui est dedans chaque demi-seconde. */
  zonesFL: { x: number; y: number; r: number; t: number; next: number; hit: HitDef; id: string; surLance?: boolean }[] = [];
  /** Lance jumelle (B) ; Fer de la forge (G) : estocs portés ; Lance ardente (I) : Lances à Incendie d'affilée ; Talon d'acier (L) : dernière remise à zéro. */
  jumelleT = 0; jumelleV = 0; estocs = 0; incendies = 0; talonA = -99;
  /** Les 7 lances (2A) : instants des derniers déclenchements (2 fois, puis 12 s). */
  lancesA: Record<string, number[]> = {};
  private majZonesFL(dt: number, world: World) {
    for (const z of this.zonesFL) {
      z.t -= dt; z.next -= dt;
      if (z.surLance && this.lance) { z.x = this.lance.x; z.y = this.lance.y; }
      if (z.next <= 0 && z.t > 0) {
        z.next += 0.5;
        world.applyHits(m => Math.hypot(m.x - z.x, m.y - z.y) <= z.r + m.radius, z.hit, z.x, z.y, 0);
        world.emit({ k: 'spell', fx: 'burst', id: z.id, x: z.x, y: z.y, cx: z.x, cy: z.y, facing: 0, size: z.r, arc: 0, element: z.hit.element ?? 'eau', big: false, boosted: false });
      }
    }
    this.zonesFL = this.zonesFL.filter(z => z.t > 0 && (!z.surLance || this.lance));
  }
  /** Les 7 lances (2A) et Phalange vivante (H), à chaque reprise de la Lance (pas au retour automatique). */
  private reprisesLegendaires(L: { x: number; y: number }, comment: 'rappel' | 'pied', world: World) {
    if (!this.v03) return;
    const v = (k: string) => this.pcv(`pc-forgelance-${k}`), cri = (text: string) => world.emit({ k: 'status', x: this.x, y: this.y - 80, text, color: '#f1c878' });
    const pret = (k: string) => {   // 2 fois, puis 12 s d'attente
      const l = (this.lancesA[k] ?? []).filter(t => this.age - t < 12);
      if (l.length >= 2) { this.lancesA[k] = l; return false; }
      this.lancesA[k] = [...l, this.age]; return true;
    };
    const proches = (x: number, y: number, r: number) => world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - x, m.y - y) <= r + m.radius);
    if (v('noa') && pret('noa')) { this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * v('noa') / 100)); this.soinsRecusT = 6; cri('Lance de Noa'); }
    if (v('sigel') && pret('sigel')) { this.addMod('puissance', v('sigel'), 6, 'sigel'); this.addMod('critique', v('sigel') / 4, 6, 'sigel'); cri('Lance de Sigel'); }
    if (v('jormun') && pret('jormun')) {
      if (comment === 'pied') world.hitCircle(L.x, L.y, v('jormun') * CASE, { dmg: 0, knock: 0, attire: { px: v('jormun') * CASE, vers: 'lanceur' } });
      else world.repousser(L.x, L.y, v('jormun') * CASE, 684);
      cri('Lance de Jormun');
    }
    if (v('ydra') && pret('ydra')) {
      this.shield = Math.max(this.shield, Math.round(this.maxHp * v('ydra') / 100)); this.shieldT = this.shieldT0 = 6; this.shieldSrc = 'pc-forgelance-ydra';
      for (const m of proches(this.x, this.y, CASE * 1.2)) { m.haste = Math.min(m.haste, 0.5); m.hasteT = Math.max(m.hasteT, 1); }
      cri("Lance d'Ydra");
    }
    if (v('mani') && pret('mani')) { this.insensibleT = v('mani'); this.slowT = 0; cri('Lance de Mani'); }
    if (v('elding') && pret('elding')) {
      this.courir(v('elding') / 100, 4);
      for (const m of proches(this.x, this.y, CASE * 2)) { m.haste = Math.min(m.haste, 0.6); m.hasteT = Math.max(m.hasteT, 2); }
      cri("Lance d'Elding");
    }
    if (v('muspel') && pret('muspel')) {
      const a = v('muspel');
      for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - a);
      for (const k of Object.keys(this.casts)) this.casts[k] = this.casts[k].map(t => t - a);
      for (const m of proches(this.x, this.y, CASE * 2)) m.atkCd = Math.max(m.atkCd, 0) + 0.6;
      cri('Lance de Muspel');
    }
    const ph = v('H'), P = this.cls.spells.phalange?.allies?.shield;
    if (ph && P) for (const q of world.players) {   // Phalange vivante : le bouclier de Phalange encore actif se renouvelle
      if (q.dead || q.shieldSrc !== 'phalange' || q.shieldT <= 0 || Math.hypot(q.x - this.x, q.y - this.y) > CASE * 3) continue;
      q.shield = Math.min(Math.round(q.maxHp * P), q.shield + Math.round(q.maxHp * P * ph / 100)); q.shieldT = q.shieldT0;
    }
  }

  /** Coup reçu : Résistance fixe puis % Résistance de l'élément (plafonnée à 50 %), comme Dofus. */
  /** Porte-t-il ce Dofus (clé du passif : argente, cacao…) ? */
  porteDofus(cle: string): boolean { return this.dofusPortes.some(id => id && DOFUS[id]?.cle === cle); }
  /** Reçoit un Dofus (récompense de quête) ; il va dans le premier emplacement libre. */
  gagnerDofus(id: string): boolean {
    if (!DOFUS[id] || this.dofus.includes(id)) return false;
    this.dofus.push(id);
    this.porterDofus(id);
    return true;
  }
  /** Met un Dofus possédé dans un emplacement (le premier libre si i est absent) ; chaque Dofus une seule fois. */
  porterDofus(id: string, i?: number): boolean {
    if (!this.dofus.includes(id) || this.dofusPortes.includes(id)) return false;
    const k = i ?? this.dofusPortes.indexOf(null);
    if (k < 0 || k >= EMPLACEMENTS_DOFUS) return false;
    this.dofusPortes[k] = id; this.recompute();
    return true;
  }
  retirerDofus(i: number): boolean {
    if (!this.dofusPortes[i]) return false;
    this.dofusPortes[i] = null; this.recompute();
    return true;
  }
  /** Passifs des Dofus au moment d'un coup reçu (les PV viennent de baisser). */
  private passifsDofus(fromX: number, fromY: number, loin: boolean | undefined, world: World) {
    const A = PASSIFS.argente, C = PASSIFS.cacao;
    if (this.porteDofus('cacao') && this.age - this.cacaoA >= C.recharge
        && (loin ?? Math.hypot(fromX - this.x, fromY - this.y) > C.distance)
        && world.monsters.some(m => !m.dead && Math.hypot(m.x - this.x, m.y - this.y) - m.radius - this.radius < C.contact)) {
      this.cacaoA = this.age;
      this.shield = Math.max(this.shield, Math.round(this.maxHp * C.bouclier)); this.shieldT = this.shieldT0 = C.duree; this.shieldSrc = 'dofus_cacao';
      world.emit({ k: 'dofusPassif', dofus: 'cacao', x: this.x, y: this.y });
    }
    if (this.hp > 0 && this.hp < this.maxHp * A.seuil && this.porteDofus('argente') && this.age - this.argenteA >= A.recharge) {
      this.argenteA = this.age;
      const n = this.soigner(this.maxHp * A.soin);
      world.emit({ k: 'dofusPassif', dofus: 'argente', x: this.x, y: this.y, n });
    }
  }
  /** Recharge restante du Souvenir d'Argent (bulle d'effet). */
  get rechargeArgente(): number { return this.porteDofus('argente') ? Math.max(0, PASSIFS.argente.recharge - (this.age - this.argenteA)) : 0; }
  /** Palier de Souffrance : monte tout de suite, redescend après la mémoire de la douleur (3B). */
  private majSouffrance(dt: number, world: World) {
    const avant = this.souffrance, b = this.souffranceBrute;
    if (b >= this.souffPic) { this.souffPic = b; this.souffT = this.cls.souffrance!.memoire; }
    else if (this.souffT > 0) this.souffT -= dt;
    else this.souffPic = b;
    const n = this.souffrance;
    if (n !== avant) world.emit({ k: 'souffrance', n, avant, x: this.x, y: this.y });
  }
  hurt(raw: number, fromX: number, fromY: number, world: World, element: Element = 'neutre', loin?: boolean): boolean {
    if (this.invuln > 0 || this.dead) return false;
    const E = element === 'meilleur' ? 'Neutre' : `${element[0].toUpperCase()}${element.slice(1)}`;
    const S = this.cls.souffrance, sf = S ? this.souffrance : 0;   // Souffrance : dommages subis réduits
    const gf = this.arme ? this.pcv('pc-forgelance-E') : 0;   // Garde de fer : Garde plus forte
    const garde = this.arme ? (gf ? 1 - gf / 100 : this.cls.lance!.garde) : 1;   // Forgelance Armé : la Garde (×0,85, officiel)
    let dmg = Math.max(1, Math.round((raw - this.stat(`red${E}` as Stat)) * (1 - Math.min(50, this.stat(`res${E}` as Stat)) / 100) * this.subis * (sf ? S!.subis[sf - 1] / 100 : 1) * garde));
    // Couronne d'Épines : les coups de mêlée sont renvoyés à celui qui frappe
    if (this.renvoiT > 0) {
      const auContact = !(loin ?? Math.hypot(fromX - this.x, fromY - this.y) > CASE * 1.6), ea = auContact ? 100 : this.pcv('pc-sacrieur-O');   // Épines acérées : aussi à distance
      if (ea) world.renvoyer(fromX, fromY, dmg * this.renvoiPart * ea / 100);
    }
    if (gf && !(loin ?? Math.hypot(fromX - this.x, fromY - this.y) > CASE * 1.6)) world.renvoyer(fromX, fromY, dmg * (gf - 3) / 100);   // Garde de fer : renvoi en mêlée
    if (this.shield > 0) {   // le bouclier prend les coups d'abord
      const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a;
      const fb = this.shield <= 0 && this.shieldSrc === 'ferveur' ? this.pcv('pc-iop-K') : 0;
      if (fb) {   // Ferveur bouillonnante : le bouclier qui casse éclate en dégâts Eau sur 2 cases
        world.hitCircle(this.x, this.y, CASE * 2, { dmg: this.ferveurBouclier * fb / 100, knock: 0, element: 'eau' });
        world.emit({ k: 'spell', fx: 'burst', id: 'pc-iop-K', x: this.x, y: this.y, cx: this.x, cy: this.y, facing: this.facing, size: CASE * 2, arc: 0, element: 'eau', big: true, boosted: false });
        this.shieldSrc = '';
      }
    }
    this.hp -= dmg; this.flash = 0.1; this.invuln = this.cls.iframesOnHit; this.blesseA = this.age;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * 260; this.ky += Math.sin(a) * 260;
    world.emit({ k: 'hit', target: 'player', x: this.x, y: this.y, z: 50, amount: dmg, crit: false, element: element === 'meilleur' ? 'neutre' : element });
    world.emit({ k: 'playerHurt' });
    // 3A (maquette « Danger ») : un gros coup secoue l'écran, fige l'action et rougit les bords
    const G = DANGER.grosCoup, gros = dmg >= this.maxHp * G.part;
    world.emit(gros ? { k: 'impact', hitstop: G.fige, shake: G.secousse, big: true } : { k: 'impact', hitstop: 0.04, shake: 0.006, big: false });
    if (gros) world.emit({ k: 'grosCoup' });
    this.addRage(this.cls.rage.perHurt, world);
    this.passifsDofus(fromX, fromY, loin, world);
    if (this.cls.souffrance) {
      if (dmg > 0) this.chatiments();
      const dv = this.hp <= 0 && sf >= 10 && this.age - this.dernierSouffleA >= 60 ? this.pcv('pc-sacrieur-D') : 0;
      if (dv) {   // Dernier souffle : le coup mortel laisse à 1 PV, invulnérable un instant
        this.dernierSouffleA = this.age; this.hp = 1; this.invuln = Math.max(this.invuln, dv);
        world.emit({ k: 'status', x: this.x, y: this.y - 60, text: 'Dernier souffle !', color: '#ff3b3b' });
      }
    }
    if (this.hp <= 0 && world.quetes?.immortel) this.hp = 1;   // tutoriel : PV bloqués à 1
    if (world.test?.invincible) this.hp = this.maxHp;   // partie de test (8A) : le coup s'affiche, les PV ne bougent pas
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.setAnim('die'); world.onPlayerDeath(); }
    return true;
  }
}
