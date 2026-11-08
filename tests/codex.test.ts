import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { PEPITE, type Item } from '../src/sim/items';
import { prixImpression } from '../src/sim/codex';
import { POUVOIRS } from '../src/sim/pouvoirs';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = (test = true) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId: 'iop', items: ITEMS,
  ...(test ? { test: {} as never } : {}) });
const de = (slot: string) => Object.entries(ITEMS.equipment).find(([, d]) => d.slot === slot && !d.familier && d.level <= 20 && Object.keys(d.stats).length)!;
const objet = (w: World, slot: string, o: Partial<Item>): Item => { const [id, d] = de(slot); return { uid: w.newUid(), id, rarity: 'rare', stats: Object.fromEntries(Object.entries(d.stats).map(([k, v]) => [k, v[1]])), extra: [], ...o }; };
const bond = POUVOIRS.iop.find(p => p.slot === 'chapeau')!;   // un pouvoir de chapeau

describe('Codex des pouvoirs (version 0.3 : 5A+5B+5D 6A+6B 7A+7B)', () => {
  it('5A : briser un Légendaire chez Malek enregistre son pouvoir officiel et son pouvoir maison, une seule fois', () => {
    const w = arena(), p = w.player;
    const leg = objet(w, 'chapeau', { rarity: 'mythique', legendary: { id: bond.id, value: 0 }, legendary2: { id: 'rage', value: 20 } });
    p.bag.push(leg, objet(w, 'chapeau', { rarity: 'legendaire', legendary: { id: bond.id, value: 0 } }));
    expect(w.briserObjet(leg.uid)).toBe(true);
    expect(p.codex.map(c => c.id).sort()).toEqual([bond.id, 'rage'].sort());
    w.briserObjet(p.bag[0].uid);
    expect(p.codex).toHaveLength(2);
  });

  it('un pouvoir d\'une autre classe n\'entre pas dans le Codex ; rien hors 0.3', () => {
    const w = arena(), p = w.player, cra = POUVOIRS.cra[0];
    const it = objet(w, 'chapeau', { rarity: 'legendaire', legendary: { id: cra.id, value: 0 } });
    p.bag.push(it); w.briserObjet(it.uid);
    expect(p.codex).toHaveLength(0);
    const v = arena(false), q = v.player, l = objet(v, 'chapeau', { rarity: 'legendaire', legendary: { id: 'rage', value: 20 } });
    q.bag.push(l); v.briserObjet(l.uid);
    expect(q.codex).toHaveLength(0);
  });

  it('5B + 6A/6B : imprimer sur un objet Rare du même emplacement le rend Légendaire, contre des kamas et ses runes, ou des Pépites', () => {
    const w = arena(), p = w.player;
    p.codex = [{ id: bond.id }, { id: 'potion' }];
    const cha = objet(w, 'chapeau', {}), bot = objet(w, 'bottes', { rarity: 'epique' });
    p.bag.push(cha, bot);
    const px = prixImpression(ITEMS.equipment[cha.id], cha);
    // sans de quoi payer : refusé
    p.kamas = 0;
    expect(w.imprimerCodex(cha.uid, bond.id, 'kamas')).toBe(false);
    p.kamas = px.kamas + 5; if (px.rune) p.resources[px.rune] = px.runes;
    expect(w.imprimerCodex(bot.uid, bond.id, 'kamas')).toBe(false);   // pouvoir de chapeau sur des bottes
    expect(w.imprimerCodex(cha.uid, bond.id, 'kamas')).toBe(true);
    expect(cha.rarity).toBe('legendaire');
    expect(cha.legendary).toEqual({ id: bond.id, value: 0 });
    expect(p.kamas).toBe(5);
    if (px.rune) expect(p.resources[px.rune]).toBe(0);
    expect(w.imprimerCodex(cha.uid, 'potion', 'kamas')).toBe(false);   // déjà Légendaire (5C non retenu)
    // pouvoir maison : tout emplacement, payé en Pépites
    const pb = prixImpression(ITEMS.equipment[bot.id], bot);
    p.resources[PEPITE] = pb.pepites;
    expect(w.imprimerCodex(bot.uid, 'potion', 'pepites')).toBe(true);
    expect(bot.legendary?.id).toBe('potion');
    expect(bot.legendary!.value).toBeGreaterThan(0);
    expect(p.resources[PEPITE]).toBe(0);
  });

  it('le Codex est gardé dans la sauvegarde', () => {
    const w = arena(); w.player.codex = [{ id: bond.id }, { id: 'relance', sort: 'bond' }];
    const s = exporterJoueur(w), v = arena(); restaurerJoueur(v, s);
    expect(v.player.codex).toEqual([{ id: bond.id }, { id: 'relance', sort: 'bond' }]);
  });
});
