import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { coutPoint, coutTotal, pointsAchetables, soinRecu, vitesseAgilite } from '../src/sim/caracs';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const nouveau = (classId = 'iop', seed = 1) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed, classId, items: ITEMS });

describe('caractéristiques (maquette Caracs, 2026-11-08)', () => {
  it('coûts officiels de Dofus 3 : Vitalité 1, Sagesse 3, éléments par paliers de 100', () => {
    expect(coutPoint('vitalite', 500)).toBe(1);
    expect(coutPoint('sagesse', 0)).toBe(3);
    expect([0, 99, 100, 199, 200, 300, 900].map(b => coutPoint('force', b))).toEqual([1, 1, 2, 2, 3, 4, 4]);
    expect(coutTotal('force', 150)).toBe(100 + 50 * 2);
    // niveau 200 : 995 points tout en Force -> 398 Force
    expect(pointsAchetables('force', 0, 995)).toBe(398);
    expect(pointsAchetables('sagesse', 0, 10)).toBe(3);
  });
  it('placer, ++ (plusieurs points) et réinitialiser', () => {
    const w = nouveau(), p = w.player;
    p.fixerNiveau(41, null);
    expect(p.points).toBe(200);
    expect(p.spendPoint('sagesse', 1)).toBe(true);
    expect(p.points).toBe(197);
    expect(p.spendPoint('force', 999)).toBe(true);   // 100 à 1 point + 48 à 2 points = 196
    expect(p.base.force).toBe(148);
    expect(p.points).toBe(1);
    expect(p.spendPoint('force')).toBe(false);
    expect(w.reinitialiserCaracs()).toBe(true);
    expect(p.points).toBe(200);
    expect(p.base).toEqual({});
  });
  it('Chance donne de la Prospection, Intelligence et Soins renforcent les soins, Agilité fait courir plus vite', () => {
    const w = nouveau(), p = w.player;
    p.fixerNiveau(30, null);
    const pros = p.prospection, v = p.speed;
    p.spendPoint('chance', 25);
    expect(p.prospection).toBe(pros + 2);
    p.reinitialiserPoints();
    p.spendPoint('agilite', 100);
    expect(p.speed).toBeCloseTo(v * 1.05);
    expect(vitesseAgilite(1000)).toBe(0.1);
    expect(soinRecu(100, 50, 7)).toBe(157);
    p.reinitialiserPoints();
    p.spendPoint('intelligence', 100);
    p.hp = 1;
    expect(p.soigner(20)).toBe(40);
  });
  it('une ancienne sauvegarde (tout coûtait 1) rend ses points', () => {
    const a = nouveau();
    a.player.level = 11; a.player.points = 0; a.player.base = { sagesse: 50 };
    const b = nouveau('iop', 2);
    restaurerJoueur(b, JSON.parse(JSON.stringify(exporterJoueur(a))));
    expect(b.player.base).toEqual({});
    expect(b.player.points).toBe(50);
  });
});
