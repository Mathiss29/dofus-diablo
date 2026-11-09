import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { QUETES } from '../src/sim/data';
import { rollItem } from '../src/sim/items';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const nouveau = (classId = 'iop', seed = 1) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed, classId, items: ITEMS });

describe('sauvegarde du personnage', () => {
  it('un aller-retour garde niveau, points, sac, équipement, barre et position', () => {
    const a = nouveau('cra');
    const p = a.player;
    p.level = 7; p.xp = 123; p.points = 20; p.kamas = 456; p.base = { agilite: 10 };
    a.donnerObjet('1942');
    const hunt = p.bag[0];
    expect(p.equip(hunt.uid)).toBe(true);
    const m = a.worldGrid!.mapByCoords(-1, -4)!, q = a.worldGrid!.cellToWorld(a.worldGrid!.freeByMap.get(m.tag)![30]);
    p.x = q.x; p.y = q.y;
    const json = JSON.parse(JSON.stringify(exporterJoueur(a)));

    const b = nouveau('cra', 99);
    restaurerJoueur(b, json);
    const r = b.player;
    expect([r.level, r.xp, r.points, r.kamas, r.base.agilite]).toEqual([7, 123, 20, 456, 10]);
    expect(Object.values(r.equipment).map(i => i!.id)).toEqual([hunt.id]);
    expect(r.bag).toHaveLength(0);
    expect(r.bar).toEqual(p.bar);
    expect([r.x, r.y]).toEqual([q.x, q.y]);
    expect(r.maxHp).toBe(p.maxHp);
    expect(r.hp).toBe(r.maxHp);
  });
  it('une position hors des cases marchables renvoie au point de retour', () => {
    const a = nouveau(), e = exporterJoueur(a);
    e.x = -99999; e.y = -99999;
    const b = nouveau();
    restaurerJoueur(b, e);
    expect([b.player.x, b.player.y]).toEqual([b.pointDeRetour.x, b.pointDeRetour.y]);
  });
  it('les quêtes reprennent où on les a laissées (le tutoriel ne recommence pas)', () => {
    const mk = (reprise?: ReturnType<typeof exporterJoueur>['quetes']) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 3, items: ITEMS, quetes: QUETES, reprise });
    const a = mk(), q = a.quetes!;
    const tuto = q.enCours[0]?.id;
    expect(tuto).toBeDefined();
    q.finies.add(tuto!); q.enCours = []; q.decouvertes.add(450);
    const e = JSON.parse(JSON.stringify(exporterJoueur(a)));
    const b = mk(e.quetes);
    expect(b.quetes!.enCours).toHaveLength(0);
    expect(b.quetes!.finies.has(tuto!)).toBe(true);
    expect(b.quetes!.decouvertes.has(450)).toBe(true);
  });
  it('objets de maître du jeu (Annobusé de Maître Jarbo) : jamais dans le butin, retirés des sauvegardes', () => {
    expect(ITEMS.equipment['9031'].horsJeu).toBe(true);
    const a = nouveau(), p = a.player;
    expect((a as unknown as { equipByLevel: { id: string }[] }).equipByLevel.some(e => e.id === '9031' || e.id === '2155')).toBe(false);
    p.bag.push(rollItem('9031', ITEMS.equipment['9031'], 'epique', a.rng, a.newUid()), rollItem('70', ITEMS.equipment['70'], 'commun', a.rng, a.newUid()));
    p.equipment.amulette = rollItem('2155', ITEMS.equipment['2155'], 'commun', a.rng, a.newUid());
    const b = nouveau(); restaurerJoueur(b, JSON.parse(JSON.stringify(exporterJoueur(a))));
    expect(b.player.bag.map(i => i.id)).toEqual(['70']);
    expect(b.player.equipment.amulette).toBeUndefined();
  });
});
