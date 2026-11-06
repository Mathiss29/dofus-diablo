import { beforeEach, describe, expect, it } from 'vitest';
import { enterrer, exporter, importer, lireCimetiere, lirePersos, lireSecours, prendreSecours, restaurerSecours, sauverPerso, supprimerPerso, type Perso } from '../src/render/persos';

// localStorage du navigateur, en mémoire
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, String(v)), removeItem: k => void mem.delete(k),
  clear: () => mem.clear(), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
const perso = (nom: string, cree: number, hardcore = false): Perso => ({ nom, classe: 'iop', sexe: 'm', hardcore, cree, maj: cree, temps: 60, lieu: 'Champs', zones: [] });

describe('sauvegarde exportable, copies de secours, cimetière', () => {
  beforeEach(() => mem.clear());

  it('exporter puis importer remet les personnages', () => {
    sauverPerso(0, perso('Xener', 1));
    const f = JSON.stringify(exporter());
    mem.clear();
    expect(importer(f)).toBeNull();
    expect(lirePersos()[0]?.nom).toBe('Xener');
  });

  it('refuse un fichier qui n\'est pas une sauvegarde', () => {
    expect(importer('{"a":1}')).toMatch(/pas une sauvegarde/);
    expect(importer('pas du json')).toMatch(/pas une sauvegarde/);
  });

  it('garde 3 copies de secours au plus, et restaure', () => {
    for (let i = 0; i < 5; i++) { sauverPerso(0, perso(`Perso${'abcde'[i]}`, i)); prendreSecours(true); }
    expect(lireSecours()).toHaveLength(3);
    expect(lireSecours()[0].resume).toContain('Persoe');
    expect(restaurerSecours(2)).toBeNull();
    expect(lirePersos()[0]?.nom).toBe('Persoc');
  });

  it('un héros Hardcore enterré ne revient pas par une vieille sauvegarde', () => {
    sauverPerso(0, perso('Mortel', 7, true));
    const vieux = JSON.stringify(exporter());
    enterrer({ cree: 7, nom: 'Mortel', classe: 'iop', sexe: 'm', niveau: 4, temps: 60, lieu: 'Forêt', tueur: 'Milimilou', date: 1 });
    supprimerPerso(0);
    expect(importer(vieux)).toBeNull();
    expect(lirePersos()[0]).toBeNull();
    expect(lireCimetiere()[0].tueur).toBe('Milimilou');
  });
});
