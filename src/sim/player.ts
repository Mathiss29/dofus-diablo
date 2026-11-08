import type { CleDonjon } from './arene';
import type { CommandeFM } from './forgemagie';
import { Entity } from './entity';
import type { ClassDef, ComboHit, Element, SkillId, SpellDef } from './defs';
import { WEAPONS } from './data';
import { BASE_STATS, EQUIP_SLOTS, REDUCTION_RECHARGES_MAX, METIER_MAX, metierXpNeeded, type EquipSlot, type Item, type ItemsData, type Stat, type Stats } from './items';
import type { PlayerInput } from './input';
import type { World } from './world';
import { coutPoint, coutTotal, fuiteFactor, pointsAchetables, prospectionDeChance, soinRecu, tackleSlow, tacleOf, vitesseAgilite } from './caracs';
import { CASE, TOUR } from './monster';
import { SORTS, dmgMoyen, gradeAuNiveau, niveauRequis, type PaireSorts, type SortGrade, type SortOfficiel } from './sorts';
import { porteeSort } from './apercu';
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
  state: 'free' | 'skill' = 'free';
  skill: ActiveSkill | null = null;
  /** Recharge restante de chaque sort, et durée totale de la dernière recharge lancée (pour le voile de la barre). */
  cd: Record<string, number> = {};
  cdMax: Record<string, number> = {};
  combo = 0;
  comboTimer = 0;
  invuln = 0;
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
    const p = POUVOIR_PAR_ID[id];
    if (!p) return { actif: true };
    if (classeDuPouvoir(id) !== this.cls.sorts) return { actif: false, raison: `pouvoir de ${({ iop: 'Iop', cra: 'Crâ', osamodas: 'Osamodas' } as Record<string, string>)[classeDuPouvoir(id)] ?? 'une autre classe'}` };
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
      const inv = !!this.cls.spells[k]?.invoque;
      const slot = k === this.cls.mobility ? (this.bar[Player.ESPACE] ? -1 : Player.ESPACE)
        : k === this.cls.clicDroit && !this.bar[Player.CLIC_DROIT] ? Player.CLIC_DROIT
        : inv ? this.bar.findIndex((b, j) => !b && j >= Player.INVOC)
        : this.bar.findIndex((b, j) => !b && j < Player.ESPACE && (j !== Player.CLIC_DROIT || !this.cls.clicDroit));
      if (slot >= 0) this.bar[slot] = k;
      world?.emit({ k: 'newSpell', id: k, slot });
    });
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
  mods: { k: Stat; n: number; t: number; src?: string; t0?: number }[] = [];
  addMod(k: Stat, n: number, t: number, src?: string) { this.mods.push({ k, n, t, src, t0: t }); }
  /** Ralentissement (retrait de PM) : fraction de vitesse perdue et durée restante. */
  slowK = 0; slowT = 0;
  /** Durées de départ des malus (bulles d'effets actifs : l'anneau se vide de t0 à 0). */
  slowT0 = 0; subisT0 = 0; pacifisteT0 = 0;
  slow(t: number, k: number) { k *= fuiteFactor(this.fuite); this.slowK = this.slowT > 0 ? Math.max(this.slowK, k) : k; if (t >= this.slowT) this.slowT0 = t; this.slowT = Math.max(this.slowT, t); }
  get speed(): number { return this.cls.speed * (1 + vitesseAgilite(this.stat('agilite'))) * this.vitesseTest * (this.slowT > 0 ? 1 - this.slowK : 1); }
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
    const n = Math.min(this.maxHp - this.hp, Math.round(soinRecu(base, this.stat('intelligence'), this.stat('soins'))));
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
  damage(base: number, element: Element): number {
    const E: Record<string, Stat> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
    const el = this.resolveElement(element);
    const c = E[el] ? this.stat(E[el]) : this.stat('force');
    const flat = this.stat('dommages') + this.stat((`dommages${el[0].toUpperCase()}${el.slice(1)}`) as Stat);
    return Math.max(1, base * (1 + Math.max(-50, c + this.stat('puissance')) / 100) + flat);
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
  get autoAttack(): SkillId { return this.weaponDef ? 'arme' : this.cls.basic ?? 'attaque'; }
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
    return n >= 2 ? n : 0;
  }
  /** Lancers des 3 dernières secondes (raccourcies par la réduction des recharges). */
  private recents(id: SkillId): number[] { return (this.casts[id] ?? []).filter(t => this.age - t < this.retourCharge); }
  /** Charges disponibles et temps avant le retour de la prochaine. */
  charges(id: SkillId): { n: number; max: number; prochaine: number } {
    const max = this.chargesMax(id);
    if (!max) return { n: 0, max: 0, prochaine: 0 };
    const r = this.recents(id), n = Math.max(0, max - r.length);
    return { n, max, prochaine: n < max ? Math.max(0, this.retourCharge - (this.age - Math.min(...r))) : 0 };
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
    if (!was && this.rageFull) world.emit({ k: 'rageFull' });
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
    if (def?.hit.shape === 'point' && !def.move) {   // case visée, ramenée à la portée du sort
      const R = (this.shot(id).range ?? def.hit.range) + this.porteeStat(id), dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy);
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
    for (const [k, s] of Object.entries(this.stacks)) { s.t -= dt; if (s.t <= 0) delete this.stacks[k]; }
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
    if (this.subisT > 0 && (this.subisT -= dt) <= 0) this.subis = 1;
    if (this.pacifiste > 0) this.pacifiste -= dt;
    if (this.rage > 0 && this.age - this.lastHitAt > 6) this.rage = Math.max(0, this.rage - 8 * dt);   // 26B : la jauge retombe hors combat
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.pa = Math.min(this.paMax, this.pa + this.cls.pa.regen * dt);
    this.pm = Math.min(this.pmMax, this.pm + dt * (1 + this.legendary('mobilite') / 100) / this.cls.pm.recharge);
    this.flash = Math.max(0, this.flash - dt);
    if (this.slowT > 0) this.slowT -= dt;
    if (this.mods.length) { for (const m of this.mods) m.t -= dt; this.mods = this.mods.filter(m => m.t > 0); }
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
    if (pr && this.spell(pr)?.invoque && this.knows(pr)) pr = this.toucheInvocation(pr, world);
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
        const hits = world.hitCone(this.x, this.y, this.facing, d.range, arc, { dmg: d.dmg + this.weaponDamage(), knock: d.knock, element: this.cls.attaque.element });
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
      if (d.stack) {
        const st = this.stacks[s.id] ?? { n: 0, t: 0 };
        mult *= 1 + d.stack.per * sig('stack') * st.n;
        this.stacks[s.id] = { n: Math.min(d.stack.max, st.n + 1), t: d.stack.time };
      }
      if (d.buff) {
        const n = Math.round(d.buff.n * sig('buff'));
        // Un même bonus ne se cumule pas : il est rafraîchi (sinon Pas Chassé s'enchaînait sans fin).
        // Le PM gagné relève le plafond mais n'est pas rendu : il se remplit avec la recharge normale.
        this.mods = this.mods.filter(m => m.src !== s.id);
        this.addMod(d.buff.stat, n, d.buff.t, s.id);
      }
      if (d.invoque) {
        const key = d.invoque, cout = 1, max = world.invocationsMax(this);
        while (world.betes.length && world.invocationsPrises() + cout > max) {   // place pour la nouvelle : la plus ancienne s'en va
          const old = world.betes.find(b => !b.dead); if (!old) break; old.mourir(world);
        }
        world.invoquer(this, key, s.id, s.tx, s.ty);
      }
      if (d.soinAllies) for (const b of world.betes) if (!b.dead && Math.hypot(b.x - s.tx, b.y - s.ty) <= Math.max(60, hz.shape === 'point' || hz.shape === 'circle' ? hz.radius : 60) + b.radius) {
        b.soigner(Math.max(1, d.dmg * s.gm), world);
      }
      if (d.rappel) for (const b of world.betes) if (!b.dead) { const a = this.age * 3 + b.id; b.x = this.x + Math.cos(a) * CASE; b.y = this.y + Math.sin(a) * CASE; }
      if (d.dompte) world.dompter(this, s.tx, s.ty, d.dompte);
      if (d.shield) { this.shield = Math.max(this.shield, Math.round(this.maxHp * d.shield.part * sig('shield'))); this.shieldT = this.shieldT0 = d.shield.t; this.shieldSrc = s.id; }
      if (d.selfKnock) {   // « Recule de n cases » : à l'opposé du tir (freinage de applyKnock : distance = vitesse / 7,13)
        const v = d.selfKnock * sig('selfKnock') * 7.13;
        this.kx -= Math.cos(this.facing) * v; this.ky -= Math.sin(this.facing) * v;
      }
      if (d.grosCoup) mult *= d.grosCoup.mult;   // 5A : gros coup
      const hit = { dmg: (d.dmg * s.gm + (s.id === this.cls.basic ? this.weaponDamage() : 0)) * mult, knock: d.knock * sig('knock'), element: d.element, vsSummon: d.vsSummon && 1 + (d.vsSummon - 1) * sig('summon'), vsElite: sig('summon') > 1,
        pushDmg: d.pushDmg && s.boosted,
        lifesteal: d.lifesteal && d.lifesteal * sig('lifesteal'), erosion: d.erosion && d.erosion * sig('erosion'),
        pmLoss: d.pmLoss && Math.round(d.pmLoss * sig('pm')), paLoss: d.paLoss && Math.round(d.paLoss * sig('pa')),
        poLoss: d.poLoss && this.parGrade(s.id, d.poLoss),
        // Maquette Armes 3B : un coup d'arme fait jaillir un éclat de la couleur de son élément sur chaque monstre touché
        eclat: s.id === 'arme' || undefined, crit: this.critSort(s.id) || undefined };
      let hits = 0, size = 0;
      // Pouvoirs officiels (0.3) : zone plus grande, ligne ou cône plus long
      const zb = this.zoneBonus(s.id), pp = this.porteePlus(s.id);
      if (d.self) { size = 60; }
      else if (hz.shape === 'cone') { size = hz.range * area + pp + zb; hits = world.hitCone(this.x, this.y, this.facing, size, (hz.arc * Math.PI) / 180, hit, d.stun); }
      else if (hz.shape === 'line') { size = hz.length * area + pp; hits = world.hitLine(this.x, this.y, this.facing, size, hz.width * area + zb, hit, d.stun); }
      else if (hz.shape === 'point') { size = hz.radius * area + zb; hits = world.hitCircle(s.tx, s.ty, size, hit, d.stun, this.facing); }   // poussée dans l'axe du lanceur, comme Dofus
      else if (hz.shape === 'circle' && d.vuln && !d.dmg) { size = hz.radius * area + zb; world.markVuln(this.x, this.y, size, d.vuln.n, d.vuln.t); }
      else if (hz.shape === 'circle') { size = hz.radius * area + zb; hits = world.hitCircle(this.x, this.y, size, hit, d.stun); }
      else {
        // Flèche : la zone (et les dommages) partent avec le projectile ; l'effet d'impact se joue à l'arrivée
        const shot = { ...hz, range: s.range ?? hz.range, explode: s.explode ?? hz.explode };
        world.shoot(this.x, this.y, this.facing, shot, hit, d.stun ?? 0, sig('explode'), s.id);
        size = hz.range;
      }
      const pt = hz.shape === 'point';
      if (hz.shape !== 'projectile') world.emit({ k: 'spell', fx: pt ? 'burst' : d.fx, id: s.id, x: pt ? s.tx : this.x, y: pt ? s.ty : this.y, cx: this.x, cy: this.y, facing: this.facing, size,
        arc: hz.shape === 'cone' ? (hz.arc * Math.PI) / 180 : 0, element: d.element, big: d.shake >= 0.012 || s.boosted, boosted: s.boosted });
      else world.emit({ k: 'shoot', id: s.id, x: this.x, y: this.y, facing: this.facing, element: d.element, boosted: s.boosted });
      if (hz.shape !== 'projectile') world.emit({ k: 'impact', hitstop: hits || d.charge ? d.hitstop * (s.boosted ? 1.4 : 1) : 0, shake: d.shake * (s.boosted ? 1.5 : 1), big: d.shake >= 0.012 || s.boosted });
    }
    if (s.t >= d.duration) this.endSkill();
  }

  /** Coup reçu : Résistance fixe puis % Résistance de l'élément (plafonnée à 50 %), comme Dofus. */
  hurt(raw: number, fromX: number, fromY: number, world: World, element: Element = 'neutre'): boolean {
    if (this.invuln > 0 || this.dead) return false;
    const E = element === 'meilleur' ? 'Neutre' : `${element[0].toUpperCase()}${element.slice(1)}`;
    let dmg = Math.max(1, Math.round((raw - this.stat(`red${E}` as Stat)) * (1 - Math.min(50, this.stat(`res${E}` as Stat)) / 100) * this.subis));
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }   // le bouclier prend les coups d'abord
    this.hp -= dmg; this.flash = 0.1; this.invuln = this.cls.iframesOnHit; this.blesseA = this.age;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * 260; this.ky += Math.sin(a) * 260;
    world.emit({ k: 'hit', target: 'player', x: this.x, y: this.y, z: 50, amount: dmg, crit: false });
    world.emit({ k: 'playerHurt' });
    // 3A (maquette « Danger ») : un gros coup secoue l'écran, fige l'action et rougit les bords
    const G = DANGER.grosCoup, gros = dmg >= this.maxHp * G.part;
    world.emit(gros ? { k: 'impact', hitstop: G.fige, shake: G.secousse, big: true } : { k: 'impact', hitstop: 0.04, shake: 0.006, big: false });
    if (gros) world.emit({ k: 'grosCoup' });
    this.addRage(this.cls.rage.perHurt, world);
    if (this.hp <= 0 && world.quetes?.immortel) this.hp = 1;   // tutoriel : PV bloqués à 1
    if (world.test?.invincible) this.hp = this.maxHp;   // partie de test (8A) : le coup s'affiche, les PV ne bougent pas
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.setAnim('die'); world.onPlayerDeath(); }
    return true;
  }
}
