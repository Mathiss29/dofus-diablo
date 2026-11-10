import { describe, expect, it } from 'vitest';
import SORTS from '../src/data/sorts.json';
import CLASSES from '../src/data/classes.json';
import { ETIQUETTES_SORTS, ROLES_SORTS, TEXTES_SORTS, avecMotsCles } from '../src/render/sortsTextes';

/** Garde-fou des textes maison des sorts (maquette « Menu sorts » 11A, 2026-11-10) : un texte pour chacun des sorts
 *  officiels des classes (9B) et pour chaque sort jouable, écrit pour un jeu en temps réel. */
const INTERDITS = /(?<!\p{L})(?:tours?|lanceur|tacle|esquive|ligne de vue)(?!\p{L})/iu;
const phrases = (s: string) => s.replace(/«[^»]*»/g, 'x').split(/[.!?…](?:\s|$)/).filter(x => x.trim()).length;
type Sp = { id: number; name: string };

describe('textes des sorts', () => {
  it('chaque sort officiel et chaque sort jouable a son texte', () => {
    for (const [cl, paires] of Object.entries(SORTS as unknown as Record<string, Sp[][]>)) {
      const t = TEXTES_SORTS[cl];
      expect(t, cl).toBeTruthy();
      for (const p of paires) for (const s of p) expect(t[String(s.id)], `${cl} · ${s.name}`).toBeTruthy();
      const cls = (CLASSES as unknown as Record<string, { spells: Record<string, { dofusId?: number }> }>)[cl];
      for (const [k, d] of Object.entries(cls.spells)) expect(t[String(d.dofusId ?? k)] ?? t[k], `${cl} · ${k}`).toBeTruthy();
    }
  });

  it('lisibles et pensés temps réel : accroche courte, deux phrases au plus, jamais de tour', () => {
    const roles = ROLES_SORTS.map(r => r[0]) as string[];
    for (const [cl, l] of Object.entries(TEXTES_SORTS)) for (const [id, x] of Object.entries(l)) {
      const ou = `${cl} · ${id} · ${x.accroche}`;
      expect(roles, ou).toContain(x.role);
      for (const e of x.etiquettes) expect(ETIQUETTES_SORTS, ou).toContain(e);
      expect(x.accroche.length, `${ou} : accroche de 50 caractères au plus`).toBeLessThanOrEqual(50);
      expect(phrases(x.texte), `${ou} : deux phrases au plus`).toBeLessThanOrEqual(2);
      expect(x.texte.length, `${ou} : 230 caractères au plus`).toBeLessThanOrEqual(230);
      for (const s of [x.accroche, x.texte, x.ambiance ?? '']) expect(s, `${ou} : mot du tour par tour`).not.toMatch(INTERDITS);
      if (x.ambiance) expect(x.ambiance.length, ou).toBeLessThanOrEqual(90);
    }
  });

  it('mots-clés soulignés une fois, texte échappé', () => {
    const h = avecMotsCles('Retire 2 PM, puis 2 PM, et pose un bouclier <b>');
    expect(h.match(/<k /g)?.length).toBe(2);
    expect(h).toContain('&lt;b&gt;');
  });
});
