import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { restaurerJoueur } from '../src/sim/sauvegarde';
import { brancherOrdres } from '../src/render/ordres';
import type { Ordre } from '../src/sim/ordres';

// « En ligne : » 4B : chez l'invité, un geste de fenêtre est joué dans le miroir ET envoyé une fois à celui qui fait la partie.
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1, classId: 'iop', items: ITEMS });

describe('ordres envoyés par le miroir', () => {
  it('un geste du perso part une fois et se joue aussi dans le miroir ; rien hors du miroir branché', () => {
    const w = monde(), autre = monde(), recus: Ordre[] = [];
    restaurerJoueur(w, { level: 10 } as never); restaurerJoueur(autre, { level: 10 } as never);
    const off = brancherOrdres(w, o => recus.push(o));
    expect(w.player.spendPoint('vitalite')).toBe(true);
    expect(recus).toEqual([{ c: 'p', f: 'spendPoint', a: ['vitalite'] }]);
    expect(w.player.base.vitalite).toBe(1);
    autre.player.spendPoint('vitalite');
    expect(recus.length).toBe(1);
    w.reinitialiserCaracs();   // appelle player.reinitialiserPoints : un seul ordre, celui du monde
    expect(recus.map(o => o.f)).toEqual(['spendPoint', 'reinitialiserCaracs']);
    off();
    w.player.spendPoint('force');
    expect(recus.length).toBe(2);
  });
});
