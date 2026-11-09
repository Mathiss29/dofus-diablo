import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../src/render/looks';
import { apparenceValide, PALETTES, ZONES, type AnimsData, type FichePerso } from '../src/render/squelette';
import EMPREINTES from '../src/data/fichiers-lourds.json';

const D = 'public/assets/sprites/squelette';
const lire = <T>(f: string): T => JSON.parse(readFileSync(`${D}/${f}`, 'utf8')) as T;
const FICHES = lire<Record<string, FichePerso>>('persos.json');
const E = EMPREINTES as Record<string, string>;

describe('apparence des persos (têtes, couleurs, dessin en direct)', () => {
  it('Iop et Crâ, homme et femme : têtes officielles de création et 6 couleurs', () => {
    expect(Object.keys(FICHES).sort()).toEqual(['cra_f', 'cra_m', 'eniripsa_f', 'eniripsa_m', 'forgelance_f', 'forgelance_m', 'iop_f', 'iop_m', 'osamodas_f', 'osamodas_m', 'sacrieur_f', 'sacrieur_m']);
    expect(FICHES.iop_m.tetes.length).toBe(15);
    expect(FICHES.cra_f.tetes.length).toBe(17);
    for (const f of Object.values(FICHES)) expect(f.couleurs.length).toBe(ZONES.length);
    expect(FICHES.iop_m.tetes[0]).toBe(2124);   // tête des anciennes planches
  });

  it('une apparence abîmée ou absente redevient la tête 1 et les couleurs officielles', () => {
    const f = FICHES.iop_m;
    expect(apparenceValide(f, null)).toEqual({ tete: 0, couleurs: f.couleurs });
    expect(apparenceValide(f, { tete: 99, couleurs: [1, -5, 0x1000000] })).toEqual({ tete: 0, couleurs: [1, ...f.couleurs.slice(1)] });
    expect(apparenceValide(f, { tete: 3, couleurs: [0, 0, 0, 0, 0, 0] }).tete).toBe(3);
    for (const p of PALETTES) expect(p.c.length).toBe(ZONES.length - 1);
  });

  it('chaque fichier existe et a son empreinte (dessins de corps, têtes, vignettes, effets)', () => {
    for (const [cle, f] of Object.entries(FICHES)) {
      const tex = [...f.os, `skin_${f.corps}.webp`, ...f.tetes.map(t => `skin_${t}.webp`), `tetes_${cle}.webp`];
      for (const t of tex) expect(E[`sprites/squelette/${t}`], t).toBeTruthy();
      for (const s of [f.corps, ...f.tetes]) expect(lire<{ tex: string }>(`skin_${s}.json`).tex).toBe(`skin_${s}.webp`);
    }
  });

  it('les animations du jeu (repos, course, armes, sorts) sont dans le squelette', () => {
    for (const cls of ['iop', 'cra']) {
      const A = lire<AnimsData>(FICHES[`${cls}_m`].anims);
      for (const [etat, sl] of Object.entries(LOOKS[cls].map)) expect(A.anims[`${sl.anim}_1`]?.length, `${cls} ${etat}`).toBeGreaterThan(0);
      for (const o of [0, 1, 2, 5, 6]) expect(A.anims[`AnimCourse_${o}`]?.length).toBeGreaterThan(0);
      // chaque morceau dessiné renvoie à un nœud ou un graphique connu
      for (const imgs of Object.values(A.anims)) for (const img of imgs) for (const t of img) {
        expect(t.length).toBe(13);
        if (t[0] >= 0) expect(A.graphiques[t[0]].length).toBeGreaterThan(0);
        if (t[1] >= 0) expect(t[1]).toBeLessThan(A.noeuds.length);
      }
    }
  });
});
