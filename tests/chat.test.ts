// Maquette « Tchat : » (2026-11-12) : liens d'objets, onglets qui n'apparaissent que s'ils servent, lignes répétées, complétion.
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { LIEN, ONGLETS_DEFAUT, completer, deplier, filtreDe, lienObjet, lireLien, migrerOnglets, ongletsVisibles, regrouper, type Filtre } from '../src/render/chatOutils';
import { SuiviCombat, recapMort } from '../src/render/chatCombat';
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
    // en solo : Combat seul (7A, l'onglet ouvert reste)
    expect(ongletsVisibles(ONGLETS_DEFAUT, hors, 2)).toEqual([2]);
    expect(ongletsVisibles(ONGLETS_DEFAUT, new Set<Filtre>([...hors, 'evenements']), 2)).toEqual([2, 3]);
    expect(ongletsVisibles(ONGLETS_DEFAUT, new Set<Filtre>([...hors, 'tout', 'groupe']), 0)).toEqual([0, 1, 2]);
  });
  it('le butin du journal va dans son propre filtre', () => {
    expect(filtreDe({ canal: 'infos', sorte: 'butin', de: '', texte: 'x' })).toBe('butin');
    expect(filtreDe({ canal: 'infos', sorte: 'jeu', de: '', texte: 'x' })).toBe('infos');
    expect(filtreDe({ canal: 'infos', sorte: 'combat', de: '', texte: 'x' })).toBe('infos');
    expect(filtreDe({ canal: 'infos', sorte: 'evenement', de: '', texte: 'x' })).toBe('evenements');
    expect(filtreDe({ canal: 'infos', de: '', texte: 'x' })).toBe('serveur');
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
    expect(REGLAGES_DEFAUT.chatOnglets.map(o => o.nom)).toEqual(['Général', 'Groupe', 'Combat', 'Événements', 'Privé']);
    // Canaux 1B : Général ne montre que les joueurs (et le serveur en gris, 5A)
    expect(REGLAGES_DEFAUT.chatOnglets[0].f).not.toContain('infos');
    expect(REGLAGES_DEFAUT.chatOnglets[0].f).not.toContain('evenements');
    expect(REGLAGES_DEFAUT.chatEffacement).toBe('20');
  });
  it('canaux 8A : onglets jamais réglés remplacés, onglets réglés gardés', () => {
    const anciens = [
      { nom: 'Général', f: ['tout', 'bastion', 'groupe', 'prive', 'infos', 'butin'] as Filtre[] },
      { nom: 'Groupe', f: ['groupe'] as Filtre[] }, { nom: 'Privé', f: ['prive'] as Filtre[] }, { nom: 'Infos', f: ['infos', 'butin'] as Filtre[] },
    ];
    expect(migrerOnglets(anciens).map(o => o.nom)).toEqual(ONGLETS_DEFAUT.map(o => o.nom));
    expect(migrerOnglets(undefined)).toEqual(ONGLETS_DEFAUT);
    const perso = migrerOnglets([{ nom: 'Tout', f: ['tout', 'infos'] }, { nom: 'Moi', f: ['prive'] }]);
    expect(perso.map(o => o.nom)).toEqual(['Tout', 'Moi']);
    expect(perso[0].f).toEqual(['tout', 'infos', 'serveur', 'evenements']);
    expect(perso[1].f).toEqual(['prive']);
  });
  it('canaux 3B : un résumé par combat, pas une ligne par coup', () => {
    const s = new SuiviCombat();
    s.coupDonne(10, 1, 400, () => 'bouftou');
    s.coupDonne(12, 2, 600, () => 'bouftou_royal');
    s.xp(12.5, 120);
    for (let t = 15; t < 28; t += 3) s.coupDonne(t, 2, 0, () => 'bouftou_royal');   // le combat continue (moins de 4 s de calme)
    s.coupDonne(28, 2, 9000, () => 'bouftou_royal');
    s.xp(28, 3000);
    expect(s.massacre(14)).toBe('Massacre de 14 monstres · 18 s · 10 000 dégâts · +3 120 XP');
    expect(s.boss('bouftou_royal', 'Bouftou Royal')).toBe('Bouftou Royal vaincu en 16 s · 9 600 dégâts');
    expect(s.boss('bouftou_royal', 'Bouftou Royal')).toBe('Bouftou Royal vaincu !');
    // après un calme, un nouveau combat repart de zéro
    s.coupDonne(60, 3, 50, () => 'larve');
    expect(s.massacre(5)).toBe('Massacre de 5 monstres · 1 s · 50 dégâts');
  });
  it('canaux 3C : récap de mort avec les derniers coups et un conseil', () => {
    const s = new SuiviCombat();
    s.coupRecu({ t: 1, n: 999, el: 'feu', de: 'vieux' });
    for (const [t, n, el, sort] of [[20, 412, 'terre', 'Flèche Empoisonnée'], [20.8, 688, 'feu', 'Coup de Massue'], [21.5, 405, 'terre', 'Flèche Empoisonnée'], [22.1, 96, 'terre', '']] as const)
      s.coupRecu({ t, n, el, de: el === 'feu' ? 'bwork_mage' : 'bwork_archer', ...(sort ? { sort } : {}) });
    const l = s.mort(22.1);
    expect(l).toHaveLength(4);   // le vieux coup (t = 1) ne compte pas
    const r = recapMort(l, t => (t === 'bwork_archer' ? 'Bwork Archer' : 'Bwork Mage'), 4);
    expect(r.tueur).toBe('Bwork Archer');
    expect(r.html).toContain('Flèche Empoisonnée (Bwork Archer)');
    expect(r.html).toContain('−1 601 PV');
    expect(r.html).toContain('résistance Terre est à 4 %');
    expect(s.mort(30)).toEqual([]);
  });
});
