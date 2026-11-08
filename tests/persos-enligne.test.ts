import { beforeEach, describe, expect, it } from 'vitest';

/** Faux stockage du navigateur (les tests tournent sous Node). */
const memoire = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: k => memoire.get(k) ?? null, setItem: (k, v) => void memoire.set(k, String(v)), removeItem: k => void memoire.delete(k),
  clear: () => memoire.clear(), key: () => null, length: 0,
};
const { dernier, lireCoffre, lirePersos, lirePersosLocaux, remplacerPersosEnLigne, sauverCoffre, sauverPerso, sourceEnLigne, supprimerPerso } = await import('../src/render/persos');

const perso = (nom: string) => ({ nom, classe: 'iop', sexe: 'm' as const, hardcore: false, cree: 1, maj: 1, temps: 0, lieu: 'Incarnam', zones: [] });

describe('persos en ligne (maquette « Vrai multi : » 4A)', () => {
  beforeEach(() => { memoire.clear(); sourceEnLigne(false); });
  it('les persos du navigateur et ceux du compte ne se mélangent pas', () => {
    sauverPerso(0, perso('Local'));
    const ecrits: string[] = [];
    sourceEnLigne(true, q => ecrits.push(q));
    expect(lirePersos()).toEqual([null, null, null]);
    remplacerPersosEnLigne([null, perso('Compte'), null]);
    expect(lirePersos()[1]?.nom).toBe('Compte');
    sauverPerso(2, perso('Nouveau'));
    expect(ecrits).toEqual(['persos']);
    expect(dernier()).toBe(2);
    expect(lirePersosLocaux().map(p => p?.nom ?? null)).toEqual(['Local', null, null]);
    supprimerPerso(2);
    expect(lirePersos()[2]).toBeNull();
    sourceEnLigne(false);
    expect(lirePersos()[0]?.nom).toBe('Local');
    expect(dernier()).toBe(0);
  });
  it('le coffre en ligne est celui du compte, celui de la partie de test reste local', () => {
    const c = lireCoffre('normal');
    sauverCoffre('normal', c);
    const ecrits: string[] = [];
    sourceEnLigne(true, q => ecrits.push(q));
    sauverCoffre('normal', c); sauverCoffre('test', c);
    expect(ecrits).toEqual(['normal']);
    expect([...memoire.keys()].filter(k => k.startsWith('diablofus.coffre')).sort()).toEqual(['diablofus.coffre', 'diablofus.coffre.enligne', 'diablofus.coffre.test']);
  });
});
