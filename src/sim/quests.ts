import type { SimEvent } from './events';
import type { World } from './world';

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
  /** Équiper un objet (n'importe lequel, ou un objet précis par son id). */
  | { t: 'equiper'; objet?: string }
  /** Activer un Zaap (il devient le point de retour). */
  | { t: 'activer'; zaap: string }
  /** Parler à un PNJ (clic dessus) ; avec objet : lui montrer un objet de quête qu'on porte. */
  | { t: 'parler'; pnj: string; objet?: string }
  /** Métiers : récolter N ressources, fabriquer un objet (fil des métiers). */
  | { t: 'recolter'; ressource: string; n: number }
  /** Atteindre un niveau. */
  | { t: 'niveau'; n: number }
  | { t: 'fabriquer'; objet: string; n?: number }
);
export interface EtapeDef {
  nom: string;
  objectifs: ObjectifDef[];
  /** Bulle du PNJ qui donne la quête, au début de l'étape (5A : une ou deux phrases, le jeu continue). */
  bulle?: string;
  /** Aide visuelle du tutoriel : emplacement de la barre à entourer (0-5, 6 clic droit, 7 Espace) ou 'potion' / 'jauge'. */
  halo?: number | 'potion' | 'jauge';
  /** Objet donné au début de l'étape (id de items.json), ou un par classe (l'arme de niveau 1 du tutoriel). */
  donner?: string | Record<string, string>;
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
  options?: { immortel?: boolean; groupes?: { sousZones: number[]; taille: [number, number] }; sauterSiCompte?: boolean; passable?: boolean };
  /** Démarre dès le début de la partie (le tutoriel). */
  auDepart?: boolean;
  /** Sans PNJ : démarre seule en entrant dans cette sous-zone (ex. « Mort au rat ! » dans la Taverne). */
  zone?: number;
}
export interface PnjDef {
  nom: string; dofusId: number;
  /** Carte de monde.json où il se tient, et case Dofus (0-559) ; sans case : le coin le plus dégagé de la carte. */
  carte: string; case?: number;
}
/** Objectif d'un succès officiel : une quête finie, une étape de quête finie, un autre succès, une sous-zone découverte,
 *  un niveau atteint ou un monstre vaincu. */
export type SuccesObjectif = { nom: string } & (
  | { quete: string } | { etape: [string, number] } | { succes: string } | { sousZone: number } | { niveau: number } | { monstre: string }
);
export interface SuccesDef {
  nom: string; dofusId: number; description: string; categorie: string; sousCategorie: string; points: number; icone: number;
  objectifs: SuccesObjectif[];
  /** XP officielle (ratio des données × XP du niveau), objet officiel. */
  recompense?: { xp?: number; objet?: string };
}
export interface QuetesData { pnj: Record<string, PnjDef>; quetes: Record<string, QueteDef>; succes: Record<string, SuccesDef> }

/** Une quête en cours. */
export interface QueteEnCours { id: string; etape: number; compte: number[]; /** Étapes finies, en attente du rendu au PNJ. */ aRendre: boolean }
/** Ce qui dépasse la partie : succès du compte (15A) et nombre de persos déjà créés (7B). L'affichage le garde. */
export interface Compte { succes: string[]; persos: number }

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
  /** PNJ placés dans le monde (coordonnées monde). */
  pnjs: { id: string; def: PnjDef; x: number; y: number; tag: string }[] = [];
  /** Bulle en cours au-dessus d'un PNJ. */
  bulle: { pnj: string; texte: string; t: number } | null = null;
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
      const m = wg.mapByTag(def.carte);
      if (!m || !wg.freeByMap.get(def.carte)?.length) continue;   // carte pas (encore) exportée
      const free = wg.freeByMap.get(def.carte)!;
      let q = def.case != null ? wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(def.carte, def.case))), free) : world.openestCellOf(def.carte);
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
  /** Lance les quêtes du départ (le tutoriel, sauté dès le 2e perso si elle le demande). */
  demarrer() {
    for (const [id, q] of Object.entries(this.data.quetes)) {
      if (!q.auDepart) continue;
      if (q.options?.sauterSiCompte && this.compte.persos > 0) { this.terminer(id, true); continue; }
      this.prendre(id);
    }
  }

  def(id: string) { return this.data.quetes[id]; }
  etapes(id: string): EtapeDef[] {
    const e = this.def(id).etapes;
    return Array.isArray(e) ? e : e[this.classe] ?? Object.values(e)[0];
  }
  etapeDe(q: QueteEnCours): EtapeDef | undefined { return this.etapes(q.id)[q.etape]; }
  pnj(id: string) { return this.pnjs.find(p => p.id === id); }

  /** Quête que ce PNJ peut donner maintenant (niveau, quêtes requises). */
  aDonner(pnj: string): string | null {
    const lvl = this.world.player.level;
    for (const [id, q] of Object.entries(this.data.quetes)) {
      if (q.pnj !== pnj || this.finies.has(id) || this.enCours.some(c => c.id === id) || q.auDepart) continue;
      if (q.niveau > lvl + 2 || !(q.requiert ?? []).every(r => this.finies.has(r))) continue;
      // une quête qui suit une autre (fil principal) démarre seule à la fin de la précédente : son PNJ ne la propose pas
      if (Object.values(this.data.quetes).some(o => o.suivante === id)) continue;
      return id;
    }
    return null;
  }
  /** Quête finie qui attend d'être rendue à ce PNJ. */
  aRendre(pnj: string): string | null {
    return this.enCours.find(c => c.aRendre && this.def(c.id).rendre === pnj)?.id ?? null;
  }
  /** Icône officielle au-dessus d'un PNJ (8D) : quête à donner, à rendre, ou rien. */
  icone(pnj: string): { quete: string; rendre: boolean } | null {
    const r = this.aRendre(pnj); if (r) return { quete: r, rendre: true };
    const d = this.aDonner(pnj); return d ? { quete: d, rendre: false } : null;
  }
  /** Le PNJ attend qu'on lui parle pour un objectif « parler ». */
  attendParler(pnj: string): string | null {
    return this.enCours.find(c => !c.aRendre && this.etapeDe(c)?.objectifs.some((o, i) => o.t === 'parler' && o.pnj === pnj && c.compte[i] < 1))?.id ?? null;
  }

  prendre(id: string) {
    if (this.finies.has(id) || this.enCours.some(c => c.id === id)) return;
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
    if (e.bulle && q.pnj) this.dire(q.pnj, e.bulle);
    const don = typeof e.donner === 'string' ? e.donner : e.donner?.[this.classe];
    if (don) this.world.donnerObjet(don);
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
  get destination() { const p = this.versPnj && this.pnj(this.versPnj); return p ? { x: p.x, y: p.y } : null; }
  private parler(pnj: string) {
    const r = this.aRendre(pnj);
    if (r) { this.terminer(r); return; }
    if (this.attendParler(pnj)) {
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        if (o.t === 'parler' && o.pnj === pnj && (!o.objet || (this.objets[o.objet] ?? 0) > 0)) c.compte[i] = 1;
      });
      this.verifier();
      return;
    }
    const d = this.aDonner(pnj);
    if (d) { this.prendre(d); this.suivie = d; if (!this.etapeDe(this.enCours.find(c => c.id === d)!)?.bulle) this.dire(pnj, this.def(d).texte.split('. ')[0] + '.'); return; }
    const p = this.pnj(pnj); if (p) this.dire(pnj, 'Bonne route, aventurier.');
  }

  /** Un événement de la simulation fait avancer les objectifs et les succès. */
  observer(e: SimEvent) {
    const w = this.world;
    if (e.k === 'kill') {
      this.vaincus.add(e.monster);
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
      for (const c of this.enCours) this.etapeDe(c)?.objectifs.forEach((o, i) => {
        if (o.t !== 'utiliser') return;
        const ok = e.k === 'potion' ? o.quoi === 'potion'
          : e.k === 'rageSpent' ? o.quoi === 'jauge'
          : (o.sort && o.sort === e.id) || (o.quoi === 'mobilite' && e.id === p.cls.mobility) || (o.quoi === 'sort' && e.id !== p.cls.mobility && e.id !== 'attaque');
        if (ok) c.compte[i] = 1;
      });
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
    if (map) this.decouvertes.add(map.sub);
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
      } else if (o.t === 'niveau') {
        if (p.level >= o.n) c.compte[i] = 1;
      } else if (o.t === 'equiper') {
        if (Object.values(p.equipment).some(it => it && (!o.objet || it.id === o.objet))) c.compte[i] = 1;
      }
    });
    this.verifier();
    // succès de niveau et de sous-zone découverte
    this.verifierSucces();
  }

  /** Total d'un objectif (pour le suivi : « 2/4 »). */
  total(o: ObjectifDef): number { return o.t === 'vaincre' || o.t === 'ramasser' || o.t === 'recolter' ? o.n : o.t === 'fabriquer' ? o.n ?? 1 : 1; }

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
    const q = this.def(id), w = this.world, p = w.player;
    this.enCours = this.enCours.filter(c => c.id !== id);
    if (this.finies.has(id)) return;
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
    for (const o of this.etapes(id).flatMap(e => e.objectifs)) if (o.t === 'ramasser') delete this.objets[o.objet];
    if (this.suivie === id) this.suivie = null;
    w.emit({ k: 'queteFin', id, sautee });
    if (q.suivante) this.prendre(q.suivante);
    this.suivie ??= this.enCours[0]?.id ?? null;
    this.verifierSucces();
  }
  /** Bouton « Passer » (7A) : la quête est donnée comme finie. */
  passer(id: string) { if (this.enCours.some(c => c.id === id) && this.def(id).options?.passable) this.terminer(id, true); }

  /** Option du tutoriel : PV bloqués à 1. */
  get immortel() { return this.enCours.some(c => this.def(c.id).options?.immortel); }
  /** Option du tutoriel : taille des groupes dans une sous-zone pendant la quête. */
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
  /** Points de succès du compte. */
  get points() { return [...this.succes].reduce((n, id) => n + (this.data.succes[id]?.points ?? 0), 0); }

  /** Où aller pour la quête suivie (point sur la mini-carte, flèche au bord de l'écran) : le premier objectif pas fini. */
  cible(): { x: number; y: number } | null {
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
