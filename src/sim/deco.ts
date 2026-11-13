import type { World } from './world';
import type { WorldGrid } from './gridmap';
import { themeChoisi, themesPossedes } from './havresac';
import { CASES_CARTE, DECO, MEUBLES, casesDe, cleSac, meublesPossedes, type MeubleDef, type Pose, type SacVu, type SorteSpeciale } from './meubles';
import { PORTABLE } from './dofus';
import { xpRecolte } from './recolte';

/** Havre-Sac complet (0.6, 10A-E) : ce qui est posé dans le Havre-Sac, et ce que l'on en fait (src/sim/meubles.ts pour les meubles).
 *  Les meubles bloquants ferment leurs cases à la marche ; jamais au point de couper un coin de la pièce (on refuse la pose).
 *  Le joueur de l'écran (players[0]) décore ; en coop, l'invité voit le Havre-Sac de l'hôte (opts.sacHote, 10E). */
export class DecoHavreSac {
  readonly tag: string;
  /** Cases marchables de la carte du thème, sans meuble (grande grille). */
  private readonly base: Uint8Array;
  /** Cases réservées (locales) : arrivée, arche, coffre, établis, Poutch, PNJ, postes. */
  private readonly reserve = new Set<number>();
  constructor(private readonly w: World, private readonly wg: WorldGrid) {
    this.tag = wg.world.maps[0].tag;
    this.base = wg.mov.slice();
  }

  // --- état -----------------------------------------------------------------------------------------------------------
  /** Le Havre-Sac à voir : celui de l'hôte en coop (10E), sinon celui du compte. */
  get sac(): SacVu {
    const h = this.w.opts.sacHote;
    if (h) return h;
    const c = this.w.coffre, t = this.theme;
    return { theme: t, poses: c.deco?.[t] ?? [], potager: c.potager ?? {}, vitrine: c.vitrine ?? {} };
  }
  get theme(): number { return this.w.opts.sacHote?.theme ?? this.w.zone.open?.havreSac?.theme ?? (this.w.opts.themesHavreSac ? themeChoisi(this.w.opts.themesHavreSac, this.w.coffre).id : 0); }
  /** On peut décorer : c'est notre Havre-Sac (pas celui de l'hôte) et c'est le joueur de l'écran qui agit. */
  get decorable(): boolean { return !this.w.opts.sacHote && this.w.player === this.w.players[0]; }
  /** Meubles que l'on peut poser (thèmes possédés, gagnés un par un, nos meubles). */
  possedes(): Set<number> {
    const T = this.w.opts.themesHavreSac;
    return meublesPossedes(T ? themesPossedes(T, this.w.coffre) : [], this.w.coffre);
  }
  private get global() { return (c: number) => this.wg.cellOf(this.tag, c); }
  private locale(g: number) { return this.wg.caseLocale(g)?.c ?? -1; }

  /** À l'arrivée : cases réservées, puis les meubles posés ferment leurs cases. */
  installer() {
    const w = this.w, h = w.zone.open?.havreSac, R = this.reserve, wg = this.wg;
    const ici = (x: number, y: number) => this.locale(wg.cellAtWorld(x, y));
    if (h) {   // l'allée de l'arche à l'arrivée (en demi-cases : 2 de part et d'autre)
      const pos = (c: number) => [c % 14 * 2 + Math.floor(c / 14) % 2, Math.floor(c / 14)];
      const [ax, ay] = pos(h.arche), [bx, by] = pos(h.arrivee), L = Math.hypot(bx - ax, by - ay) || 1;
      for (let c = 0; c < CASES_CARTE; c++) {
        const [x, y] = pos(c), t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)));
        if (Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= 2.2) R.add(c);
      }
    }
    const l0 = new Set<number>();
    for (const po of w.postes) l0.add(ici(po.x, po.y));
    for (const n of w.quetes?.pnjs ?? []) l0.add(ici(n.x, n.y));
    const pt = w.monsters.find(m => m.id === w.poutch); if (pt) l0.add(ici(pt.x, pt.y));
    for (const c of l0) if (c >= 0) { R.add(c); for (const n of this.voisines(c)) R.add(n); }
    this.appliquer();
  }
  private voisines(c: number): number[] {
    const r = Math.floor(c / 14), k = c % 14, o = r % 2, out: number[] = [];
    for (const [dr, dk] of [[-1, k - 1 + o], [-1, k + o], [1, k - 1 + o], [1, k + o], [-2, k], [2, k], [0, k - 1], [0, k + 1]]) {
      const rr = r + dr; if (rr >= 0 && rr < 40 && dk >= 0 && dk < 14) out.push(rr * 14 + dk);
    }
    return out;
  }

  /** Cases (locales) fermées par les meubles posés, et cases portant un meuble empilable (où un bibelot peut aller). */
  private occupation(poses: Pose[]) {
    const bloque = new Set<number>(), meuble = new Map<number, number>(), sol = new Set<number>(), dessus = new Set<number>(), empilable = new Set<number>();
    poses.forEach((p, i) => {
      const m = MEUBLES[p.m]; if (!m) return;
      const cs = casesDe(m, p.c, !!p.r);
      if (m.couche === 0) { for (const c of cs) sol.add(c); return; }
      if (m.couche === 2 && poses.some((q, j) => j !== i && MEUBLES[q.m]?.empilable && casesDe(MEUBLES[q.m], q.c, !!q.r).includes(p.c))) { dessus.add(p.c); return; }
      for (const c of cs) { meuble.set(c, i); if (m.bloque) bloque.add(c); if (m.empilable) empilable.add(c); }
    });
    return { bloque, meuble, sol, dessus, empilable };
  }
  /** Les meubles bloquants ferment leurs cases ; le reste de la carte reprend sa marche d'origine. */
  appliquer() {
    const wg = this.wg, { bloque } = this.occupation(this.sac.poses);
    for (let c = 0; c < CASES_CARTE; c++) { const g = this.global(c); wg.mov[g] = bloque.has(c) ? 0 : this.base[g]; }
    wg.refaireLibres();
    this.w.postesDeco(this.postes());
  }
  /** 10B-D : socles, parcelles et mannequins posés deviennent des postes (on clique, on s'approche, on s'en sert). */
  private postes(): { sorte: SorteSpeciale; c: number; x: number; y: number }[] {
    const out: { sorte: SorteSpeciale; c: number; x: number; y: number }[] = [];
    for (const p of this.sac.poses) {
      const s = MEUBLES[p.m]?.sorte; if (!s) continue;
      const q = this.wg.cellToWorld(this.global(p.c));
      out.push({ sorte: s, c: p.c, x: q.x, y: q.y });
    }
    return out;
  }
  /** Cases marchables qu'on peut atteindre depuis l'arrivée (avec ces cases fermées en plus). */
  private atteignables(fermees: Set<number>): number {
    const h = this.w.zone.open?.havreSac, d = h?.arrivee ?? 0, ok = (c: number) => this.base[this.global(c)] === 1 && !fermees.has(c);
    if (!ok(d)) return 0;
    const vu = new Set([d]), file = [d];
    while (file.length) { const c = file.pop()!; for (const n of this.voisines(c)) if (!vu.has(n) && ok(n)) { vu.add(n); file.push(n); } }
    return vu.size;
  }

  // --- 10A : poser, tourner, ranger -----------------------------------------------------------------------------------
  /** Pourquoi on ne peut pas poser ce meuble ici (null : c'est possible). */
  refus(id: number, c: number, tourne = false): string | null {
    const m = MEUBLES[id], sac = this.sac;
    if (!this.decorable) return 'Ce n\'est pas ton Havre-Sac';
    if (!m || !this.possedes().has(id)) return 'Tu n\'as pas ce meuble';
    if (sac.poses.length >= DECO.max) return `${DECO.max} meubles au plus`;
    if (m.sorte === 'potager' && sac.poses.filter(p => MEUBLES[p.m]?.sorte === 'potager').length >= DECO.potagers) return `${DECO.potagers} parcelles au plus`;
    if (m.sorte === 'vitrine' && sac.poses.filter(p => MEUBLES[p.m]?.sorte === 'vitrine').length >= DECO.vitrines) return `${DECO.vitrines} socles au plus`;
    if (m.sorte === 'mannequin' && sac.poses.filter(p => MEUBLES[p.m]?.sorte === 'mannequin').length >= this.w.player.prereglages.length) return 'Un mannequin par préréglage';
    const cs = casesDe(m, c, tourne);
    if (!cs.length || cs.some(x => this.base[this.global(x)] !== 1)) return 'Hors de la pièce';
    const o = this.occupation(sac.poses);
    if (m.couche === 0) return cs.some(x => o.sol.has(x)) ? 'Il y a déjà un tapis' : null;
    if (m.couche === 2 && o.empilable.has(c)) return o.dessus.has(c) ? 'Il y a déjà un bibelot dessus' : null;   // bibelot sur une table
    if (cs.some(x => o.meuble.has(x))) return 'La place est prise';
    if (cs.some(x => this.reserve.has(x))) return 'Laisse ce passage libre';
    if (cs.some(x => this.w.players.some(p => this.locale(this.wg.cellAtWorld(p.x, p.y)) === x))) return 'Quelqu\'un se tient là';
    if (m.bloque || m.sorte) {
      const avant = this.atteignables(o.bloque), f = new Set([...o.bloque, ...cs]);
      const perdues = cs.filter(x => !o.bloque.has(x) && this.base[this.global(x)] === 1).length;
      if (this.atteignables(f) < avant - perdues) return 'Ça couperait un coin de la pièce';
    }
    return null;
  }
  /** Pose un meuble (10A). Un mannequin prend le premier préréglage libre (10D). */
  poser(id: number, c: number, tourne = false): boolean {
    const non = this.refus(id, c, tourne);
    if (non) { this.w.emit({ k: 'deco', ok: false, texte: non }); return false; }
    const w = this.w, t = String(this.theme), l = ((w.coffre.deco ??= {})[t] ??= []), m = MEUBLES[id];
    const p: Pose = { m: id, c, ...(tourne ? { r: 1 as const } : {}) };
    if (m.sorte === 'mannequin') { const pris = new Set(l.filter(q => q.p != null).map(q => q.p)); p.p = w.player.prereglages.findIndex((_, i) => !pris.has(i)); }
    l.push(p);
    this.appliquer();
    w.emit({ k: 'deco', ok: true }); w.emit({ k: 'coffre' });
    return true;
  }
  /** Range le meuble du dessus sur cette case (bibelot, puis meuble, puis tapis). */
  ranger(c: number): boolean {
    const w = this.w, t = String(this.theme), l = w.coffre.deco?.[t];
    if (!this.decorable || !l) return false;
    const sur = (p: Pose) => casesDe(MEUBLES[p.m], p.c, !!p.r).includes(c);
    const rang = (p: Pose) => { const m = MEUBLES[p.m]; return m.couche === 2 ? 0 : m.couche === 1 ? 1 : 2; };
    const i = l.map((p, i) => [p, i] as const).filter(([p]) => MEUBLES[p.m] && sur(p)).sort((a, b) => rang(a[0]) - rang(b[0]) || b[1] - a[1])[0]?.[1];
    if (i == null) return false;
    const [p] = l.splice(i, 1), k = cleSac(this.theme, p.c);
    if (MEUBLES[p.m]?.sorte === 'potager') delete w.coffre.potager?.[k];
    if (MEUBLES[p.m]?.sorte === 'vitrine') delete w.coffre.vitrine?.[k];
    if (!l.length) delete w.coffre.deco![t];
    this.appliquer();
    w.emit({ k: 'deco', ok: true }); w.emit({ k: 'coffre' });
    return true;
  }
  /** Tout ranger (bouton du mode déco). */
  toutRanger(): boolean {
    const w = this.w, t = String(this.theme);
    if (!this.decorable || !w.coffre.deco?.[t]) return false;
    for (const p of w.coffre.deco[t]) { const k = cleSac(this.theme, p.c); delete w.coffre.potager?.[k]; delete w.coffre.vitrine?.[k]; }
    delete w.coffre.deco[t];
    this.appliquer();
    w.emit({ k: 'deco', ok: true }); w.emit({ k: 'coffre' });
    return true;
  }
  /** Meuble posé sur cette case (le plus haut), pour le survol en mode déco. */
  pose(c: number): Pose | null {
    const l = this.sac.poses.filter(p => MEUBLES[p.m] && casesDe(MEUBLES[p.m], p.c, !!p.r).includes(c));
    return l.sort((a, b) => MEUBLES[b.m].couche - MEUBLES[a.m].couche)[0] ?? null;
  }

  // --- 10B : la vitrine -----------------------------------------------------------------------------------------------
  /** Ce que le joueur peut exposer : ses trophées, ses Dofus et les familiers de sa Ménagerie. */
  exposables(): string[] {
    const p = this.w.player;
    return [...p.trophees.filter(id => PORTABLE(id)).map(id => `t:${id}`), ...p.dofus.filter(id => PORTABLE(id)).map(id => `d:${id}`), ...this.w.menagerie().filter(id => this.w.opts.items?.equipment[id]).map(id => `f:${id}`)];
  }
  /** Expose un objet sur le socle de cette case (null : le reprendre). */
  exposer(c: number, quoi: string | null): boolean {
    const w = this.w, k = cleSac(this.theme, c);
    if (!this.decorable || MEUBLES[this.pose(c)?.m ?? 0]?.sorte !== 'vitrine') return false;
    if (quoi === null) { if (w.coffre.vitrine) delete w.coffre.vitrine[k]; }
    else { if (!this.exposables().includes(quoi)) return false; (w.coffre.vitrine ??= {})[k] = quoi; }
    w.emit({ k: 'coffre' });
    return true;
  }
  /** Nom de ce qui est exposé (bulle). */
  nomExpose(quoi: string): string {
    const [s, id] = quoi.split(':');
    return s === 'f' ? this.w.opts.items?.equipment[id]?.name ?? 'Familier' : PORTABLE(id)?.nom ?? 'Trophée';
  }

  // --- 10C : le potager -----------------------------------------------------------------------------------------------
  /** Plantes que ce perso peut semer : celles déjà récoltées une fois dans le monde. */
  plantables(): string[] {
    const R = this.w.opts.recoltes?.ressources ?? {};
    return this.w.player.recoltees.filter(id => DECO.plantes.includes(R[id]?.metier ?? ''));
  }
  /** État d'une parcelle : vide, en train de pousser, ou prête (le lendemain du semis). */
  parcelle(c: number): { r: string; pret: boolean } | null {
    const v = this.sac.potager[cleSac(this.theme, c)];
    return v ? { r: v.r, pret: v.j < (this.w.opts.aujourdhui ?? '') } : null;
  }
  /** Sème une plante (une parcelle vide, ou on change de plante : la pousse repart). */
  planter(c: number, r: string): boolean {
    const w = this.w;
    if (!this.decorable || MEUBLES[this.pose(c)?.m ?? 0]?.sorte !== 'potager' || !this.plantables().includes(r)) return false;
    (w.coffre.potager ??= {})[cleSac(this.theme, c)] = { r, j: w.opts.aujourdhui ?? '' };
    w.emit({ k: 'coffre' });
    return true;
  }
  /** Récolte une parcelle prête : quelques ressources et l'XP du métier, et ça repousse pour demain. */
  recolter(c: number): number {
    const w = this.w, p = w.player, v = this.parcelle(c), def = v && w.opts.recoltes?.ressources[v.r];
    if (!this.decorable || !v?.pret || !def) return 0;
    const n = DECO.recolte.base + Math.floor(Math.max(1, p.metierLevel(def.metier)) / DECO.recolte.parNiveaux);
    p.resources[v.r] = (p.resources[v.r] ?? 0) + n;
    if (def.metier) p.gainMetierXp(def.metier, xpRecolte(def.niveau, false), w);
    w.coffre.potager![cleSac(this.theme, c)].j = w.opts.aujourdhui ?? '';
    w.emit({ k: 'recolteFin', id: -1, item: v.r, n, dore: false });
    w.emit({ k: 'coffre' });
    return n;
  }

  // --- 10D : les mannequins -------------------------------------------------------------------------------------------
  /** Préréglage porté par le mannequin de cette case. */
  mannequin(c: number): number | null { const p = this.pose(c); return p && MEUBLES[p.m]?.sorte === 'mannequin' ? p.p ?? null : null; }
  /** Clic sur un mannequin : on prend sa tenue (le préréglage du perso qui clique). */
  changerTenue(c: number): boolean {
    const w = this.w, p = w.player, i = this.mannequin(c);
    const non = (texte: string) => { w.emit({ k: 'status', x: p.x, y: p.y - 60, text: texte, color: '#ff9a5a' }); return false; };
    if (i == null || i < 0) return non('Mannequin sans préréglage');
    if (!p.prereglages[i]) return non(`Préréglage ${i + 1} vide : enregistre-le dans l'inventaire`);
    if (p.attentePrereglage > 0) return non('Pas en plein combat');
    if (!p.mettrePrereglage(i)) return false;
    w.emit({ k: 'status', x: p.x, y: p.y - 60, text: p.prereglages[i]!.nom, color: '#b9e54b' });
    return true;
  }
}

/** Un meuble gagné hors du Havre-Sac (coffre de donjon, succès, fabrication) : sans Havre-Sac chargé, on écrit au coffre. */
export function gagnerMeuble(w: World, m: MeubleDef) {
  const c = w.coffre;
  if (c.meubles?.includes(m.id)) return false;
  (c.meubles ??= []).push(m.id);
  w.emit({ k: 'meubleGagne', id: m.id }); w.emit({ k: 'coffre' });
  return true;
}
