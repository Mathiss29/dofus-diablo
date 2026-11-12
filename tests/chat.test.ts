// Maquette « Tchat : » (2026-11-12) : liens d'objets, onglets qui n'apparaissent que s'ils servent, lignes répétées, complétion.
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { LIEN, ONGLETS_DEFAUT, completer, deplier, filtreDe, lienObjet, lireLien, ongletsVisibles, regrouper, type Filtre } from '../src/render/chatOutils';
import { REGLAGES_DEFAUT } from '../src/render/ambiance';
import type { Item } from '../src/sim/items';

describe('tchat', () => {
  it('un lien d\'objet fait l\'aller-retour avec ses jets et ses pouvoirs', () => {
    const id = Object.keys(ITEMS.equipment).find(k => !ITEMS.equipment[k].familier)!;
    const it: Item = { uid: 1, id, rarity: 'legendaire', stats: { vitalite: 38, force: 22 }, extra: ['force'], legendary: { id: 'relanceEclair', value: 12, sort: 'pression' } };
    const t = `regarde ${lienObjet(it)} !`;
    const m = [...t.matchAll(LIEN)];
    expect(m).toHaveLength(1);
    const o = lireLien(m[0][1], m[0][2], m[0][3], m[0][4])!;
    expect(o.nom).toBe(ITEMS.equipment[id].name);
    expect(o.rarete).toBe('legendaire');
    expect(o.stats).toEqual([['vitalite', 38], ['force', 22]]);
    expect(o.pouvoirs).toEqual([{ id: 'relanceEclair', value: 12, sort: 'pression' }]);
    // un lien tient dans ce que le serveur garde d'un message (600 caractères)
    expect(t.length).toBeLessThan(300);
    expect(lireLien('objet-inconnu', 'rare', '', '')).toBeNull();
  });
  it('le champ montre [Nom] et envoie le lien complet', () => {
    const poses = new Map([['[Coiffe]', '[[o:1|rare|vitalite:3|]]']]);
    expect(deplier('vois [Coiffe] et [Coiffe]', poses)).toBe('vois [[o:1|rare|vitalite:3|]] et [[o:1|rare|vitalite:3|]]');
  });
  it('les onglets n\'apparaissent que si leurs canaux servent (l\'onglet ouvert reste)', () => {
    const hors = new Set<Filtre>(['infos', 'butin']);
    expect(ongletsVisibles(ONGLETS_DEFAUT, hors, 0)).toEqual([0, 3]);
    expect(ongletsVisibles(ONGLETS_DEFAUT, new Set<Filtre>([...hors, 'tout', 'groupe']), 0)).toEqual([0, 1, 3]);
    expect(ongletsVisibles(ONGLETS_DEFAUT, hors, 2)).toEqual([0, 2, 3]);
  });
  it('le butin du journal va dans son propre filtre', () => {
    expect(filtreDe({ canal: 'infos', sorte: 'butin', de: '', texte: 'x' })).toBe('butin');
    expect(filtreDe({ canal: 'infos', de: '', texte: 'x' })).toBe('infos');
    expect(filtreDe({ canal: 'groupe', de: 'Lyra', texte: 'x' })).toBe('groupe');
  });
  it('les lignes identiques à la suite sont regroupées', () => {
    const l = [{ canal: 'infos' as const, de: '', texte: 'Massacre' }, { canal: 'infos' as const, de: '', texte: 'Massacre' }, { canal: 'tout' as const, de: 'A', texte: 'Massacre' }, { canal: 'infos' as const, de: '', texte: 'Massacre' }];
    expect(regrouper(l).map(x => x.n)).toEqual([2, 1, 1]);
  });
  it('Tab complète les commandes et les noms', () => {
    expect(completer('/inv', [])).toBe('/inviter ');
    expect(completer('/w Ly', ['Lyra', 'Brak'])).toBe('/w Lyra ');
    expect(completer('salut br', ['Lyra', 'Brak'])).toBe('salut Brak ');
    expect(completer('salut ', ['Lyra'])).toBeNull();
  });
  it('réglages par défaut du tchat', () => {
    expect(REGLAGES_DEFAUT.chatOnglets.map(o => o.nom)).toEqual(['Général', 'Groupe', 'Privé', 'Infos']);
    expect(REGLAGES_DEFAUT.chatEffacement).toBe('20');
  });
});
