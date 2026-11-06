import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const nouveau = (classId = 'iop', seed = 1) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed, classId, items: ITEMS });

describe('sauvegarde du personnage', () => {
  it('un aller-retour garde niveau, points, sac, équipement, barre et position', () => {
    const a = nouveau('cra');
    const p = a.player;
    p.level = 7; p.xp = 123; p.points = 12; p.kamas = 456; p.base = { agilite: 10 };
    const hunt = p.bag[0];
    expect(p.equip(hunt.uid)).toBe(true);
    const m = a.worldGrid!.mapByCoords(-1, -4)!, q = a.worldGrid!.cellToWorld(a.worldGrid!.freeByMap.get(m.tag)![30]);
    p.x = q.x; p.y = q.y;
    const json = JSON.parse(JSON.stringify(exporterJoueur(a)));

    const b = nouveau('cra', 99);
    restaurerJoueur(b, json);
    const r = b.player;
    expect([r.level, r.xp, r.points, r.kamas, r.base.agilite]).toEqual([7, 123, 12, 456, 10]);
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
});
