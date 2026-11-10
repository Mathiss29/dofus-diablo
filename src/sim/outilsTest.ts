import type { PlacementCarte } from './placement';
import { degatsMonstre } from './danger';
import { EQUIP_SLOTS, RARITIES, RARITY_NAMES, rollItem, type EquipSlot, type Rarity, type Slot } from './items';
import type { Element } from './defs';
import type { World } from './world';
import { DOFUS, EMPLACEMENTS_DOFUS } from './dofus';
import { LEGENDARY, legendaryPower, type LegendaryFx, type LegendaryId } from './items';
import { POUVOIR_PAR_ID } from './pouvoirs';
import { PC_PAR_ID } from './pouvoirsClasse';
import { ARENE } from './arene';

/** Partie de test (maquette « Test : 1B 2B 3A 4A+4B 5A+5D 6A+6B+6C 7A+7D 8A 9A 10A ») : réglages qui changent les règles
 *  pour le perso de test. Absents (World.test = null) dans une vraie partie. */
export interface ReglagesTest {
  /** 8A : les coups reçus s'affichent mais ne retirent pas de PV. */
  invincible: boolean;
  /** 8A : recharges, PA et PM toujours pleins. */
  recharges: boolean;
  /** 5D : course ×3 et passer à travers les murs. */
  course: boolean;
  murs: boolean;
  /** Outil test 4C : archimonstres 100 fois plus fréquents dans les groupes. */
  archis: boolean;
  /** Outil test 7B : invocations sans limite. */
  invocations: boolean;
}
export const REGLAGES_TEST: ReglagesTest = { invincible: false, recharges: false, course: false, murs: false, archis: false, invocations: false };

/** Ce qu'on fait d'une quête depuis le panneau (Outil test 3A-3E). */
export type GesteQuete = 'prendre' | 'etape' | 'finir' | 'zero' | 'aller';

/** Rang d'un monstre posé (7A). */
export type RangTest = 'normal' | 'elite' | 'boss';

/** Ordres du panneau de test (F1), passés à la simulation par les entrées du joueur (PlayerInput.test). */
export type CommandeTest =
  /** 4A : niveau 1 à 200 ; auto = les points vont dans la caractéristique de l'élément principal de la classe. */
  | { k: 'niveau'; n: number; auto: boolean }
  /** 5A : va sur une carte du monde (tag de monde.json). */
  | { k: 'aller'; tag: string; nom: string; case?: number; vague?: number }
  /** 6A / 6C : un objet officiel (équipement de la rareté voulue) ou une ressource, n fois. */
  | { k: 'objet'; id: string; rarete: Rarity; n: number }
  /** 6B : tenue complète du niveau du perso, de cette rareté. */
  | { k: 'tenue'; rarete: Rarity }
  | { k: 'kamas'; n: number }
  /** 7A / 7D : monstres posés autour d'un point ; mannequin = increvable et immobile (compteur de DPS). */
  | { k: 'monstre'; type: string; n: number; rang: RangTest; x: number; y: number; mannequin: boolean; frappe?: number;
      /** Panneau test 6C : résistances du mannequin (sinon celles du monstre). */
      res?: Partial<Record<Element, number>> }
  /** Retire tous les monstres posés par le panneau. */
  | { k: 'retirer' }
  | { k: 'reglage'; cle: keyof ReglagesTest; on: boolean }
  /** Éditeur de placement (maquette « Monstres » 2A) : la carte reprend ce placement (null : celui d'origine). */
  | { k: 'placement'; tag: string; pl: PlacementCarte | null }
  /** Outil test 2A-2D : un Dofus (« codes » : tous ceux dont le passif est codé), remplir les 6 cases, tout retirer. */
  | { k: 'dofus'; id: string; porter: boolean }
  | { k: 'dofusRemplir' }
  | { k: 'dofusVider' }
  /** Outil test 3A-3E. */
  | { k: 'quete'; id: string; geste: GesteQuete; etape?: number }
  /** Outil test 5A-5B : jour de l'Almanax (AAAA-MM-JJ), offrande du jour dans le sac. */
  | { k: 'jour'; date: string }
  | { k: 'offrande' }
  /** Outil test 7C : renvoie toutes les invocations. */
  | { k: 'renvoyer' }
  /** Multi (étape 0) : un allié de test de cette classe, au niveau du perso, conduit par la simulation (allie.ts). */
  | { k: 'allie'; classe: string }
  | { k: 'alliesRetirer' }
  /** Panneau test 3A : PV pleins, recharges, PA et PM pleins. */
  | { k: 'soigner' }
  /** Panneau test 3A : tous les monstres autour du perso tombent (XP et butin comme d'habitude), sauf les mannequins. */
  | { k: 'tuer' }
  /** Panneau test 9C : les groupes vaincus reviennent tout de suite. */
  | { k: 'repeupler' }
  /** Panneau test 7A : un objet Légendaire de l'emplacement du pouvoir, avec ce pouvoir-là (officiel, de classe ou maison). */
  | { k: 'pouvoir'; id: string }
  /** Panneau test 7C. */
  | { k: 'viderSac' };

/** Rayon de « Tuer la carte » (px du monde) : à peu près l'écran autour du perso. */
export const RAYON_TUER = 1100;

/** Emplacement et effet d'un pouvoir légendaire choisi dans le panneau (7A) : officiel (src/data/pouvoirs.json), de classe (pc-…), maison. */
export function pouvoirChoisi(id: string, niveauObjet: number, sortsRecharge: string[]): { slot: Slot | null; fx: LegendaryFx } | null {
  const o = POUVOIR_PAR_ID[id];
  if (o) return { slot: o.slot, fx: { id, value: 0 } };
  const c = PC_PAR_ID[id];
  if (c) return { slot: c.slot, fx: { id, value: c.jet[1] } };   // le meilleur jet, pour bien voir l'effet
  if (!(id in LEGENDARY)) return null;
  const L = LEGENDARY[id as LegendaryId];
  if (id === 'relance') return sortsRecharge.length ? { slot: null, fx: { id, value: Math.max(0.5, Math.round(L.max * legendaryPower(niveauObjet) * 2) / 2), sort: sortsRecharge[0] } } : null;
  return { slot: null, fx: { id, value: Math.round(L.max * legendaryPower(niveauObjet)) } };
}

const xy = (q: { x: number; y: number }): [number, number] => [q.x, q.y];

/** Arme préférée de la classe pour la tenue toute faite (6B) : l'arme de Dofus de chaque classe. */
const ARME_CLASSE: Record<string, string> = { iop: 'Épée', cra: 'Arc' };
const STAT_ELEMENT: Partial<Record<Element, 'force' | 'intelligence' | 'chance' | 'agilite'>> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };

/** Caractéristique principale d'une classe : l'élément le plus présent dans ses sorts (le premier rencontré en cas d'égalité). */
export function caracPrincipale(spells: Record<string, { element?: Element }>): 'force' | 'intelligence' | 'chance' | 'agilite' {
  const n = new Map<string, number>();
  for (const s of Object.values(spells)) { const k = s.element && STAT_ELEMENT[s.element]; if (k) n.set(k, (n.get(k) ?? 0) + 1); }
  let best: 'force' | 'intelligence' | 'chance' | 'agilite' = 'force', bn = 0;
  for (const [k, v] of n) if (v > bn) { best = k as typeof best; bn = v; }
  return best;
}

/** Applique un ordre du panneau. Toute l'aléatoire passe par world.rng. */
export function appliquerTest(w: World, c: CommandeTest) {
  const p = w.player, I = w.opts.items, dire = (texte: string) => w.emit({ k: 'test', texte });
  switch (c.k) {
    case 'niveau': {
      p.fixerNiveau(c.n, c.auto ? caracPrincipale(p.cls.spells) : null);
      dire(`Niveau ${p.level}${c.auto ? '' : ` : ${p.points} points à placer (C)`}`);
      break;
    }
    case 'aller': {
      // Panneau test 9A : arène d'un donjon à la vague voulue (au-delà de la dernière : le boss), comme une clé déjà avancée
      const dj = c.vague ? w.zone.open?.donjons?.find(x => x.arene?.tag === c.tag) : null;
      if (dj) p.cleDonjon = { nom: dj.nom, vague: c.vague!, reste: ARENE.cle };
      if (w.allerArene(c.tag)) break;
      const wg = w.worldGrid, libres = wg?.freeByMap.get(c.tag);
      if (!wg || !libres?.length) { dire('Carte introuvable dans cette zone'); break; }
      const q = c.case != null ? wg.nearestFree(...xy(wg.cellToWorld(wg.cellOf(c.tag, c.case))), libres) : wg.cellToWorld(libres[Math.floor(libres.length / 2)]);
      p.stopMove(); p.x = q.x; p.y = q.y; p.kx = p.ky = 0;
      w.emit({ k: 'portal', nom: c.nom });
      break;
    }
    case 'objet': {
      const d = I?.equipment[c.id];
      if (d) {
        for (let i = 0; i < c.n; i++) p.bag.push(rollItem(c.id, d, c.rarete, w.rng, w.newUid(), p.ctxPouvoirs));
        dire(`${d.name} (${RARITY_NAMES[c.rarete]}) dans le sac`);
      } else if (I?.resources[c.id]) {
        p.resources[c.id] = (p.resources[c.id] ?? 0) + c.n;
        w.emit({ k: 'lootResource', id: c.id, n: c.n });
      }
      break;
    }
    case 'tenue': {
      if (!I) break;
      const pris = new Set<string>();
      for (const slot of EQUIP_SLOTS) {
        const genre: Slot = slot.startsWith('anneau') ? 'anneau' : slot as Exclude<EquipSlot, 'anneau1' | 'anneau2'>;
        let pool = Object.entries(I.equipment).filter(([id, d]) => d.slot === genre && !d.horsJeu && d.level <= p.level && !pris.has(id));
        if (genre === 'arme') { const a = pool.filter(([, d]) => d.weapon?.type === ARME_CLASSE[w.opts.classId ?? 'iop']); if (a.length) pool = a; }
        if (!pool.length) continue;
        const max = Math.max(...pool.map(([, d]) => d.level)), [id, d] = w.rng.pick(pool.filter(([, d]) => d.level === max));
        pris.add(id);
        p.equipment[slot] = rollItem(id, d, c.rarete, w.rng, w.newUid(), p.ctxPouvoirs);
      }
      p.recompute(); p.hp = p.maxHp;
      dire(`Tenue ${RARITY_NAMES[c.rarete]} du niveau ${Math.min(p.level, 25)} équipée`);
      break;
    }
    case 'kamas': p.kamas += c.n; w.emit({ k: 'lootKamas', n: c.n }); break;
    case 'monstre': {
      const base = w.opts.data.monsters[c.type];
      if (!base) break;
      const xp = base.xp ?? Math.round(base.hp / 5);
      const def = c.mannequin ? { ...base, hp: base.hp * 20, name: `${base.name} (mannequin)`, ...(c.res ? { res: c.res } : {}) }
        : c.rang === 'elite' && !base.elite && !base.boss ? { ...base, elite: true, hp: Math.round(base.hp * 3), xp: xp * 3 }
        : c.rang === 'boss' && !base.boss ? { ...base, boss: true, hp: Math.round(base.hp * 10), xp: xp * 10 } : base;
      if (def !== base && !c.mannequin) def.dmg = degatsMonstre(def);   // maquette « Danger » 1A : le rang choisi change aussi ses dégâts
      const n = Math.max(1, Math.min(20, c.n)), a0 = w.rng.range(0, Math.PI * 2);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2, r = i === 0 ? 0 : w.rng.range(60, 120);
        const q = w.map.nearestFree(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
        const m = w.spawnMonster(c.type, q.x, q.y, def);
        m.poseTest = true; m.mannequin = c.mannequin; m.frappe = c.mannequin ? c.frappe ?? 0 : 0;
        if (!c.mannequin && w.zone.open) m.state = 'spawn';
      }
      break;
    }
    case 'retirer': {
      const n = w.monsters.filter(m => m.poseTest && !m.dead).length;
      w.monsters = w.monsters.filter(m => !m.poseTest);
      dire(n ? `${n} monstre${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}` : 'Aucun monstre posé');
      break;
    }
    case 'reglage': if (w.test) w.test[c.cle] = c.on; break;
    case 'placement': w.reposerCarte(c.tag, c.pl); break;
    case 'dofus': {
      const ids = c.id === 'codes' ? Object.keys(DOFUS).filter(id => DOFUS[id].jeu) : [c.id];
      for (const id of ids) { if (!DOFUS[id]) continue; if (!p.dofus.includes(id)) p.dofus.push(id); if (c.porter) p.porterDofus(id); }
      p.recompute();
      dire(ids.length === 1 ? `${DOFUS[ids[0]]?.nom ?? 'Dofus'} ${c.porter ? 'porté' : 'obtenu'}` : `${ids.length} Dofus ${c.porter ? 'portés' : 'obtenus'}`);
      break;
    }
    case 'dofusRemplir': {
      const libres = p.dofus.filter(id => !p.dofusPortes.includes(id)).sort((a, b) => DOFUS[b].niveau - DOFUS[a].niveau);
      for (let i = 0; i < EMPLACEMENTS_DOFUS && libres.length; i++) if (!p.dofusPortes[i]) p.dofusPortes[i] = libres.shift()!;
      p.recompute(); dire('Emplacements des Dofus remplis');
      break;
    }
    case 'dofusVider': p.dofus = []; p.dofusPortes = Array(EMPLACEMENTS_DOFUS).fill(null); p.recompute(); dire('Plus aucun Dofus'); break;
    case 'quete': {
      const Q = w.quetes;
      if (!Q || !Q.existe(c.id)) { dire('Pas de quêtes dans cette zone'); break; }
      const nom = Q.def(c.id).nom;
      if (c.geste === 'prendre') { Q.finies.delete(c.id); Q.prendre(c.id); Q.suivie = c.id; dire(`Quête prise : ${nom}`); }
      else if (c.geste === 'etape') { Q.sauterEtape(c.id, c.etape ?? 0); dire(`${nom} : étape ${(c.etape ?? 0) + 1}`); }
      else if (c.geste === 'finir') { Q.finies.delete(c.id); if (!Q.enCours.some(x => x.id === c.id)) Q.prendre(c.id); Q.terminer(c.id); }
      else if (c.geste === 'zero') { Q.remettre(c.id); dire(`${nom} : remise à zéro`); }
      else {
        const t = Q.butDe(c.id);
        if (!t) { dire('Le but de cette étape n\'est pas dans cette zone'); break; }
        const q = w.map.nearestFree(t.x, t.y);
        p.stopMove(); p.x = q.x; p.y = q.y; p.kx = p.ky = 0;
        w.emit({ k: 'portal', nom: t.nom });
      }
      break;
    }
    case 'jour': w.opts.aujourdhui = c.date; { const j = w.almanaxDuJour; dire(j ? `Almanax du ${c.date} : ${j.bonus}` : `Pas d'Almanax le ${c.date}`); } break;
    case 'offrande': {
      const j = w.almanaxDuJour;
      if (!j) { dire('Pas d\'Almanax ce jour-là'); break; }
      p.resources[j.offrande] = (p.resources[j.offrande] ?? 0) + j.n;
      w.emit({ k: 'lootResource', id: j.offrande, n: j.n });
      break;
    }
    case 'allie': {
      if (!w.opts.data.classes[c.classe]) break;
      if (w.players.length >= 4) { dire('4 joueurs au plus dans un groupe'); break; }
      const q = w.ajouterJoueur(c.classe);
      q.level = p.level; q.recompute(); q.hp = q.maxHp; q.learnSpells(null);
      dire(`Allié ${w.opts.data.classes[c.classe].name} niv. ${q.level} ajouté`);
      break;
    }
    case 'alliesRetirer': {
      const n = w.players.length - 1;
      for (const q of w.players.slice(1)) w.retirerJoueur(q);
      dire(n ? `${n} allié${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''}` : 'Aucun allié');
      break;
    }
    case 'soigner': {
      if (p.dead) break;
      p.hp = p.maxHp; w.rechargerTout();
      dire('PV, recharges, PA et PM pleins');
      break;
    }
    case 'tuer': {
      const l = w.monsters.filter(m => !m.dead && !m.mannequin && Math.hypot(m.x - p.x, m.y - p.y) <= RAYON_TUER);
      for (const m of l) { m.intouchable = false; m.hp = 0; w.killMonster(m); }
      dire(l.length ? `${l.length} monstre${l.length > 1 ? 's' : ''} vaincu${l.length > 1 ? 's' : ''}` : 'Aucun monstre autour');
      break;
    }
    case 'repeupler': { const n = w.repeupler(); dire(n ? `${n} groupe${n > 1 ? 's' : ''} revenu${n > 1 ? 's' : ''}` : 'Aucun groupe à faire revenir'); break; }
    case 'viderSac': { const n = p.bag.length; p.bag = []; dire(`Sac vidé (${n} objet${n > 1 ? 's' : ''})`); break; }
    case 'pouvoir': {
      if (!I) break;
      const ch = pouvoirChoisi(c.id, p.level, p.sortsRecharge);
      if (!ch) { dire('Pouvoir inconnu'); break; }
      // l'objet du plus haut niveau (jusqu'au niveau du perso) de cet emplacement ; pouvoir maison : n'importe quel emplacement à pouvoir
      const pool = Object.entries(I.equipment).filter(([, d]) => !d.horsJeu && !d.familier && d.slot !== 'familier' && (ch.slot ? d.slot === ch.slot : true) && d.level <= Math.max(p.level, 1));
      const tous = pool.length ? pool : Object.entries(I.equipment).filter(([, d]) => !d.horsJeu && d.slot !== 'familier' && (ch.slot ? d.slot === ch.slot : true));
      if (!tous.length) { dire('Aucun objet pour cet emplacement'); break; }
      const max = Math.max(...tous.map(([, d]) => d.level)), [id, d] = w.rng.pick(tous.filter(([, d]) => d.level === max));
      const it = rollItem(id, d, 'legendaire', w.rng, w.newUid(), p.ctxPouvoirs);
      it.legendary = c.id === 'relance' || !(c.id in LEGENDARY) ? ch.fx : pouvoirChoisi(c.id, d.level, p.sortsRecharge)!.fx; delete it.legendary2;
      p.bag.push(it);
      dire(`${d.name} (Légendaire) dans le sac, avec ce pouvoir`);
      break;
    }
    case 'renvoyer': {
      const n = w.betes.filter(b => b.owner === p && !b.dead).length;
      w.betes = w.betes.filter(b => b.owner !== p);
      dire(n ? `${n} invocation${n > 1 ? 's' : ''} renvoyée${n > 1 ? 's' : ''}` : 'Aucune invocation');
      break;
    }
  }
}

/** Raretés proposées par le panneau (les Dofus viendront à part). */
export const RARETES_TEST: readonly Rarity[] = RARITIES;
