import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import JOURNAL from '../src/data/journal.json';

/** Carnets lisibles (Carnets : 1A…10A, 2026-11-08) : chaque entrée se lit d'un coup d'œil.
 *  Nouveautés / Le monde / Combat : { titre ≤ 6 mots, phrase ≤ 110 caractères, details ≤ 2 phrases et 260 caractères,
 *  icone (clé de JOURNAL.icones), etiquettes courtes, image = « À la une » (3 au plus par carnet) }.
 *  Corrections / En coulisses : une ligne de texte de 110 caractères au plus. */
type Entree = { titre: string; phrase: string; details?: string; icone?: string; etiquettes?: string[]; image?: string };
const COURTES = ['Corrections', 'En coulisses'];
const existe = (chemin: string) => existsSync(new URL(`../public/${chemin}`, import.meta.url));
const phrases = (s: string) => s.replace(/«[^»]*»/g, "x").split(/[.!?…](?:\s|$)/).filter(x => x.trim()).length;

describe('journal (un carnet par journée)', () => {
  it('dates uniques, rubriques connues, captures présentes', () => {
    const dates = JOURNAL.carnets.map(c => c.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const c of JOURNAL.carnets) {
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const r of Object.keys(c.lignes)) expect(JOURNAL.rubriques).toContain(r);
      if (c.capture) expect(existe(c.capture)).toBe(true);
    }
  });

  it('icônes du journal présentes', () => {
    for (const [k, f] of Object.entries(JOURNAL.icones)) expect(existe(`assets/${f}`), k).toBe(true);
  });

  it('pas de pavé : titre court, une phrase, détails repliables', () => {
    for (const c of JOURNAL.carnets) {
      let une = 0;
      for (const [r, lignes] of Object.entries(c.lignes) as [string, (string | Entree)[]][]) {
        for (const l of lignes) {
          const ou = `${c.date} · ${r} · ${typeof l === 'string' ? l : l.titre}`;
          if (COURTES.includes(r)) {
            expect(typeof l, `${ou} : une ligne de texte`).toBe('string');
            expect((l as string).length, `${ou} : 110 caractères au plus`).toBeLessThanOrEqual(110);
            continue;
          }
          expect(typeof l, `${ou} : écrire { titre, phrase, details, icone }`).toBe('object');
          const e = l as Entree;
          expect(e.titre.split(/\s+/).length, `${ou} : titre de 6 mots au plus`).toBeLessThanOrEqual(6);
          expect(e.phrase.length, `${ou} : phrase de 110 caractères au plus`).toBeLessThanOrEqual(110);
          expect(phrases(e.phrase), `${ou} : une seule phrase`).toBe(1);
          if (e.details) {
            expect(e.details.length, `${ou} : détails de 260 caractères au plus`).toBeLessThanOrEqual(260);
            expect(phrases(e.details), `${ou} : détails en 2 phrases au plus`).toBeLessThanOrEqual(2);
          }
          expect(e.icone && e.icone in JOURNAL.icones, `${ou} : icône connue (JOURNAL.icones)`).toBe(true);
          for (const t of e.etiquettes ?? []) expect(t.length, `${ou} : étiquette courte`).toBeLessThanOrEqual(20);
          if (e.image) { une++; expect(existe(e.image), `${ou} : image`).toBe(true); }
        }
      }
      expect(une, `${c.date} : 3 entrées « À la une » au plus`).toBeLessThanOrEqual(3);
    }
  });
});
