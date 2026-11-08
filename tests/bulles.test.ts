import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { effetsActifs } from '../src/sim/effets';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const monde = (classId: string) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 3, classId }); w.waveDelay = 1e9; return w; };
const press = (w: World, pressed: PlayerInput['pressed']) => w.step(STEP, { ...NO_INPUT, aim: { x: w.player.x + 80, y: w.player.y }, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };

describe('Bulles d\'effets actifs (maquette « Bulles : »)', () => {
  it('Cortège Sauvage : une bulle verte avec son icône, sa durée qui baisse puis disparaît', () => {
    const w = monde('osamodas'), p = w.player;
    p.level = 200; p.recompute(); p.learnSpells(null);
    p.pa = p.paMax; p.cd = {};
    p.bar[0] = 'cortege';
    press(w, 'cortege'); idle(w, 1);
    const e = effetsActifs(p).find(x => x.id === 'cortege');
    expect(e).toBeTruthy();
    expect(e!.sorte).toBe('sort');
    expect(e!.sort).toBe(p.cls.spells.cortege.icon);
    expect(e!.t).toBeLessThan(e!.tMax);
    expect(e!.lignes.join(' ')).toContain('Invocations');
    idle(w, e!.tMax);
    expect(effetsActifs(p).find(x => x.id === 'cortege')).toBeUndefined();
  });

  it('malus des monstres en rouge (2B) : ralenti, dommages subis, Pacifiste', () => {
    const p = monde('iop').player;
    p.slow(3, 0.3); p.subis = 1.2; p.subisT = p.subisT0 = 4; p.pacifiste = p.pacifisteT0 = 2;
    const ids = effetsActifs(p).filter(e => e.sorte === 'monstre').map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining(['ralenti', 'subis', 'pacifiste']));
  });

  it('charges de Fureur : le nombre de charges est dans la bulle', () => {
    const p = monde('iop').player;
    p.stacks.fureur = { n: 2, t: 3 };
    const e = effetsActifs(p).find(x => x.id === 'stack_fureur');
    expect(e?.charges).toBe(2);
  });
});
