import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { distances, distanceSort, PARANGON, peutPrendre } from '../src/sim/parangon';

const officiels = JSON.parse(readFileSync(new URL('../tools/parangon/sorts_officiels.json', import.meta.url), 'utf8')) as Record<
  string,
  { id: number; niveau: number }[]
>;
const MOTS_DE_TOUR = /\btours?\b|par tour|combat tactique/i;

describe.each(Object.keys(PARANGON))('Parangon %s', (classe) => {
  const a = PARANGON[classe];
  const d = distances(a);

  it('a environ 400 nœuds, tous reliés au départ', () => {
    expect(a.noeuds.length).toBeGreaterThan(380);
    expect(a.noeuds.length).toBeLessThan(500);
    expect(d.every((x) => x >= 0)).toBe(true);
    a.noeuds.forEach((n, i) => expect(n.id).toBe(i));
  });

  it('a un nœud par sort officiel, à une distance qui suit son niveau', () => {
    const sorts = a.noeuds.filter((n) => n.type === 'sort');
    expect(sorts.map((n) => n.sort!.id).sort()).toEqual(officiels[classe].map((s) => s.id).sort());
    for (const n of sorts) expect(d[n.id]).toBe(distanceSort(n.sort!.niveau));
    expect(distanceSort(1)).toBe(6);
    expect(distanceSort(190)).toBe(40);
  });

  it('ne met de prix que sur les clés de voûte', () => {
    for (const n of a.noeuds) expect(Boolean(n.prix)).toBe(n.type === 'cle');
    expect(a.noeuds.filter((n) => n.type === 'cle')).toHaveLength(4);
  });

  it("ne parle jamais de tours : c'est du temps réel", () => {
    for (const n of a.noeuds) expect(`${n.texte ?? ''} ${n.prix ?? ''}`).not.toMatch(MOTS_DE_TOUR);
  });

  it('autorise une seule clé de voûte à la fois', () => {
    const [c1, c2] = a.noeuds.filter((n) => n.type === 'cle');
    const pris = new Set(a.noeuds.filter((n) => n.type !== 'cle').map((n) => n.id));
    expect(peutPrendre(a, pris, c1.id)).toBe(true);
    pris.add(c1.id);
    expect(peutPrendre(a, pris, c2.id)).toBe(false);
  });
});
