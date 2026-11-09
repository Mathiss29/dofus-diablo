import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { anomaliesButin, monstresDeZone, poolNiveau, poolOfficiel, chanceLigne, lieuxDe, niveauHorsPartie, raretes, tableButin, tirerButin, type CtxButin, type Rang } from '../src/sim/butin';
import { Rng } from '../src/sim/math';

const pool = poolOfficiel(ITEMS, Object.values(GAME_DATA.zones).flatMap(monstresDeZone));
const ctx = (type: string, rang: Rang, o: Partial<CtxButin> = {}): CtxButin => ({ type, rang, niveau: 20, prospection: 0, items: ITEMS, familiers: [], pool,
  metierNiveau: () => 1, armeChasse: false, ...o });

describe('butin (maquette « Drops »)', () => {
  it('5A : un légendaire pour 1 500 monstres normaux, 150 élites, 50 boss (sans équipement officiel dans leur butin)', () => {
    for (const [rang, n] of [['normal', 1500], ['elite', 150], ['boss', 50]] as const) {
      const t = tableButin(ctx('inconnu', rang));
      expect(1 / t.legendaire).toBeCloseTo(n, 0);
      expect(t.raretes.mythique / (t.raretes.mythique + t.raretes.legendaire)).toBeCloseTo(1 / 20, 5);
      const r = raretes(rang); expect(Object.values(r).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
  });
  it('ce qui est affiché est ce qui tombe : tirages contre tableau (Bouftou, élite, Prospection 50)', () => {
    const c = ctx('bouftou', 'elite', { prospection: 50 }), t = tableButin(c), rng = new Rng(7), N = 40000;
    let uid = 0, leg = 0, eq = 0; const res: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const b = tirerButin(rng, c, () => uid++);
      for (const r of b.ressources) res[r.id] = (res[r.id] ?? 0) + 1;
      if (b.objets.some(o => o.rarity === 'legendaire' || o.rarity === 'mythique')) leg++;
      eq += b.objets.length;
    }
    for (const l of t.officiel.filter(l => l.etat === 'ok' && !l.equipement)) expect(res[l.d.item] / N).toBeCloseTo(l.chance, 1);
    expect(leg / N).toBeGreaterThan(t.legendaire * 0.8); expect(leg / N).toBeLessThan(t.legendaire * 1.2);
    const attendu = t.equipement.chance + t.officiel.filter(l => l.equipement && l.etat === 'ok').reduce((a, l) => a + l.chance, 0);
    expect(eq / N).toBeCloseTo(attendu, 1);
  });
  it('6B : objets de quête et d\'événement de Dofus ne tombent pas, les viandes demandent le Chasseur', () => {
    const t = tableButin(ctx('bouftou', 'normal'));
    expect(t.officiel.find(l => l.d.item === '21171')!.etat).toBe('evenement');   // Pollenectar
    expect(t.officiel.find(l => l.d.item === '17126')!.etat).toBe('metier');   // Viande Frelatée
    const rng = new Rng(3); let uid = 0;
    for (let i = 0; i < 3000; i++) for (const r of tirerButin(rng, ctx('bouftou', 'normal'), () => uid++).ressources) expect(['21171', '21618', '17126']).not.toContain(r.id);
    const chasseur = tableButin(ctx('bouftou', 'normal', { metierNiveau: () => 50, armeChasse: true }));
    expect(chasseur.officiel.find(l => l.d.item === '17126')!.etat).toBe('ok');
  });
  it('la Prospection multiplie les chances (+1 % par point)', () => {
    const d = ITEMS.drops.bouftou.find(x => x.item === '2455')!;   // Sang de Bouftou 8,84 %
    expect(chanceLigne(d, ITEMS, 100) / chanceLigne(d, ITEMS, 0)).toBeCloseTo(2, 5);
  });
  it('maquette « Taux » 2C : ressources communes et viandes ÷3 (Laine de Bouftou 53 % -> 17,7 %), rares et boss inchangés', () => {
    const laine = ITEMS.drops.bouftou.find(x => x.item === '384')!, sang = ITEMS.drops.bouftou.find(x => x.item === '2455')!;
    expect(chanceLigne(laine, ITEMS)).toBeCloseTo(0.53 / 3, 3);
    expect(chanceLigne(sang, ITEMS)).toBeCloseTo(0.0884, 4);
    expect(chanceLigne(laine, ITEMS, 0, 'boss')).toBeCloseTo(0.53, 4);
  });
  it('8C : aucune anomalie (ligne à 0 %, objet inconnu, monstre sans butin)', () => {
    expect(anomaliesButin(ITEMS, GAME_DATA)).toEqual([]);
  });
  it('niveau hors partie = celui de la sous-zone (Bouftou à Tainéla, niveau 20) ; donjons trouvés', () => {
    expect(niveauHorsPartie('bouftou', GAME_DATA)).toBe(20);
    expect(lieuxDe('royal', GAME_DATA).some(l => l.donjon && l.nom === 'Cour du Bouftou Royal')).toBe(true);
  });
});

describe('équipements du niveau 26 au 40 (version 0.3, 2A)', () => {
  it('le set du Bouftou Royal tombe comme équipement dans la 0.3, et ni tombe ni ne s\'affiche avant', () => {
    const v03 = { classe: 'iop', connus: [], aVenir: [], sortsRecharge: [], v03: true };
    expect(ITEMS.equipment['2438'].name).toBe('Boufcoiffe Royale');
    expect(ITEMS.resources['2438']).toBeUndefined();
    const avec = tableButin(ctx('royal', 'boss', { pouvoirs: v03 })), sans = tableButin(ctx('royal', 'boss'));
    expect(JSON.stringify(avec)).toContain('2438');
    expect(JSON.stringify(sans)).not.toContain('2438');
    const rng = new Rng(4); let uid = 0, vu = false;
    for (let i = 0; i < 400; i++) {
      if (tirerButin(rng, ctx('royal', 'boss', { pouvoirs: v03 }), () => uid++).objets.some(o => o.id === '2438')) vu = true;
      for (const o of tirerButin(rng, ctx('royal', 'boss', { pool: [] }), () => uid++).objets) expect(ITEMS.equipment[o.id].level).toBeLessThanOrEqual(25);
    }
    expect(vu).toBe(true);
  });
  it('équipement aléatoire : objets officiels des monstres de la zone (butin + fabrication), secours sur tout le jeu', () => {
    const inc = poolOfficiel(ITEMS, monstresDeZone(GAME_DATA.zones.incarnam)), ids = new Set(inc.map(e => e.id));
    expect(ids.has('9031')).toBe(false); expect(ids.has('2155')).toBe(false);
    expect(inc.length).toBeGreaterThan(50);
    expect(inc.every(e => !ITEMS.equipment[e.id].familier)).toBe(true);
    const rng = new Rng(5); let uid = 0;
    const c = ctx('bouftou', 'boss', { niveau: 5, pool: inc, poolSecours: pool });
    for (let i = 0; i < 500; i++) for (const o of tirerButin(rng, c, () => uid++).objets) expect(ids.has(o.id) || (ITEMS.drops.bouftou ?? []).some(d => d.item === o.id)).toBe(true);
    // zone sans monstre (Havre-Sac) : on prend les objets de tout le jeu
    expect(poolNiveau({ pool: [], poolSecours: pool, niveau: 10 }).length).toBeGreaterThan(8);
  });
});
