import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import JOURNAL from '../src/data/journal.json';

describe('journal (un carnet par journée)', () => {
  it('dates uniques, rubriques connues, captures présentes', () => {
    const dates = JOURNAL.carnets.map(c => c.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const c of JOURNAL.carnets) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const r of Object.keys(c.lignes)) expect(JOURNAL.rubriques).toContain(r);
      if (c.capture) expect(existsSync(new URL(`../public/${c.capture}`, import.meta.url))).toBe(true);
    }
  });
});
