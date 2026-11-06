import { describe, expect, it } from 'vitest';
import { ambiance, etape, REGLAGES_DEFAUT } from '../src/render/ambiance';

const a = (h: number, inside = false, r = REGLAGES_DEFAUT) => ambiance(r, new Date(2026, 10, 6, h, 0, 0), inside);

describe('Ambiance jour / nuit (heure du PC)', () => {
  it('midi : couleurs officielles, lumières normales', () => {
    expect(a(12).tint).toBe(0xffffff);
    expect(a(12).lumieres).toBeCloseTo(1);
    expect(a(12).nom).toBe('jour');
  });
  it('23 h : nuit bleue, lumières plus fortes, persos moins teintés que les cartes', () => {
    const n = a(23);
    expect(n.nom).toBe('nuit');
    expect(n.tint & 0xff).toBeGreaterThan((n.tint >> 16) & 0xff);   // plus de bleu que de rouge
    expect(n.lumieres).toBeGreaterThan(2);
    expect((n.tintPerso >> 16) & 0xff).toBeGreaterThan((n.tint >> 16) & 0xff);
  });
  it('fondu continu entre les étapes', () => {
    const t = [18, 18.5, 19, 19.5, 20, 20.5, 21].map(h => etape(h).l);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });
  it('intérieur : lumière fixe, même la nuit', () => {
    expect(a(23, true).tint).toBe(0xffffff);
    expect(a(23, true).nom).toBe('intérieur');
  });
  it('heure forcée dans les réglages', () => {
    expect(a(12, false, { ...REGLAGES_DEFAUT, heure: 'nuit' }).nom).toBe('nuit');
    expect(a(23, false, { ...REGLAGES_DEFAUT, heure: 'jour' }).tint).toBe(0xffffff);
  });
});
