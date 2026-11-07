import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { anomaliesButin, chanceLigne, lieuxDe, niveauHorsPartie, raretes, tableButin, tirerButin, type CtxButin, type Rang } from '../src/sim/butin';
import { Rng } from '../src/sim/math';

const pool = Object.entries(ITEMS.equipment).filter(([, d]) => !d.familier).map(([id, d]) => ({ id, level: d.level }));
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
  it('8C : aucune anomalie (ligne à 0 %, objet inconnu, monstre sans butin)', () => {
    expect(anomaliesButin(ITEMS, GAME_DATA)).toEqual([]);
  });
  it('niveau hors partie = celui de la sous-zone (Bouftou à Tainéla, niveau 20) ; donjons trouvés', () => {
    expect(niveauHorsPartie('bouftou', GAME_DATA)).toBe(20);
    expect(lieuxDe('royal', GAME_DATA).some(l => l.donjon && l.nom === 'Cour du Bouftou Royal')).toBe(true);
  });
});
