import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { rollItem } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { verifierSauvegarde, VERIF, type PersoVerifie } from '../src/sim/verifSauvegarde';

// « En ligne : » 2C : le serveur compare la sauvegarde du solo à la précédente ; douteuse, le perso sort du Ladder.
import type { Item } from '../src/sim/items';
const perso = (level: number, temps: number, kamas = 0, bag: Item[] = []): PersoVerifie => ({ temps, etat: { level, kamas, bag, equipment: {} } });
const chapeau = Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].level >= 20 && ITEMS.equipment[k].slot === 'chapeau')!;

describe('vérification des sauvegardes du solo', () => {
  it('un joueur normal passe, même rapide au début', () => {
    expect(verifierSauvegarde(null, perso(1, 0), ITEMS)).toBeNull();
    expect(verifierSauvegarde(perso(1, 0), perso(18, 300, 4000), ITEMS)).toBeNull();      // le début va vite
    expect(verifierSauvegarde(perso(40, 7200), perso(45, 9000, 300_000), ITEMS)).toBeNull();
    // Mycs (2026-11-16) : plusieurs niveaux d'un coup en zone haute, entre deux envois de 30 s
    expect(verifierSauvegarde(perso(60, 20_000), perso(64, 20_030), ITEMS)).toBeNull();
    // la copie du PC un peu en retard sur celle d'une partie du serveur : le temps recule, ce n'est pas de la triche
    expect(verifierSauvegarde(perso(91, 37_613), perso(91, 37_500), ITEMS)).toBeNull();
  });
  it('niveau qui saute, kamas tombés du ciel, niveau impossible', () => {
    expect(verifierSauvegarde(perso(20, 0), perso(200, 60), ITEMS)).toBe('niveau');
    expect(verifierSauvegarde(perso(30, 100), perso(45, 160), ITEMS)).toBe('niveau');   // niveau 45 en 2 min 40 de jeu en tout
    expect(verifierSauvegarde(perso(30, 0, 0), perso(30, 60, 5e7), ITEMS)).toBe('kamas');
    expect(verifierSauvegarde(perso(30, 0, 0), perso(30, 60, 5e7), ITEMS, 5e7)).toBeNull();   // ventes de l'HDV encaissées
    expect(verifierSauvegarde(null, perso(250, 0), ITEMS)).toBe('niveau');
    expect(verifierSauvegarde(null, perso(10, 0, VERIF.kamasMax * 2), ITEMS)).toBe('kamas');
  });
  it('objet aux jets impossibles', () => {
    const it = rollItem(chapeau, ITEMS.equipment[chapeau], 'rare', new Rng(1), 1);
    expect(verifierSauvegarde(null, perso(30, 0, 0, [it]), ITEMS)).toBeNull();
    expect(verifierSauvegarde(null, perso(30, 0, 0, [{ ...it, stats: { ...it.stats, vitalite: 99999 } }]), ITEMS)).toBe('objets');
  });
});
