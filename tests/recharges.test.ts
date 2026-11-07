import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { rollItem, type Item } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const arena = (classId = 'iop') => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId });
const press = (w: World, pressed: PlayerInput['pressed']) => w.step(STEP, { ...NO_INPUT, aim: { x: w.player.x + 100, y: w.player.y }, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.step(STEP, NO_INPUT); };
const objet = (o: Partial<Item>): Item => ({ uid: 999, id: 'test', rarity: 'legendaire', stats: {}, extra: [], ...o });

describe('recharges des sorts (maquette Recharges : 1A 2A 3A 4A 5A 6A 7A+7B 8A 9A+9B+9C+9D 10A)', () => {
  it('3A : « 2 lancers par tour » = 2 charges visibles, chacune revient 3 s après usage', () => {
    const w = arena(), p = w.player;
    expect(p.charges('couperet')).toMatchObject({ n: 2, max: 2 });
    press(w, 'couperet'); idle(w, 0.6); p.pa = p.paMax;
    press(w, 'couperet'); idle(w, 0.6); p.pa = p.paMax;
    const c = p.charges('couperet');
    expect(c.n).toBe(0);
    expect(c.prochaine).toBeGreaterThan(1.5);
    expect(p.canStart('couperet')).toBe(false);
    idle(w, c.prochaine + 0.05);
    expect(p.charges('couperet').n).toBe(1);
    expect(p.canStart('couperet')).toBe(true);
    // un sort de base (4 lancers par tour) garde ses charges ; sa pastille ne s'affiche que s'il en manque
    expect(p.chargesMax('pression')).toBe(4);
  });

  it('5A : Épée Divine est le gros coup du Iop (8 s, dommages ×2), Flèche de Barrage celui du Crâ', () => {
    const w = arena(), p = w.player;
    expect(p.chargesMax('epee_divine')).toBe(0);
    expect(p.recharge('epee_divine')).toBe(8);
    press(w, 'epee_divine');
    expect(p.cdMax.epee_divine).toBe(8);
    idle(w, 7.5); p.pa = p.paMax;
    expect(p.canStart('epee_divine')).toBe(false);
    w.drainEvents();
    idle(w, 0.6);
    expect(p.canStart('epee_divine')).toBe(true);
    expect(w.drainEvents().some(e => e.k === 'rechargePrete' && e.id === 'epee_divine')).toBe(true);   // 9C
    expect(arena('cra').player.recharge('barrage')).toBe(8);
  });

  it('2A + 4A : relance officielle × 3 s, et un sort à 1 lancer par tour attend 3 s', () => {
    const w = arena('cra'), p = w.player;
    expect(p.recharge('pas_chasse')).toBe(9);
    expect(p.recharge('tirs_eloignes')).toBe(6);
    const iop = arena().player;
    iop.level = 90; iop.recompute(); iop.learnSpells(null);
    expect(iop.recharge('fureur')).toBe(3);
  });

  it('7A + 7B : Relance éclair retire des secondes à un sort, la réduction des recharges plafonne à 25 %', () => {
    const w = arena(), p = w.player;
    p.equipment.amulette = objet({ stats: { reductionRecharges: 40 }, legendary: { id: 'relance', value: 2, sort: 'epee_divine' } });
    p.recompute();
    expect(p.reductionRecharges).toBe(0.25);
    expect(p.recharge('epee_divine')).toBeCloseTo((8 - 2) * 0.75);
    expect(p.retourCharge).toBeCloseTo(2.25);
    expect(p.recharge('colere')).toBeCloseTo(9 * 0.75);
  });

  it('7A : le pouvoir légendaire vise un sort à vraie recharge de la classe', () => {
    const p = arena().player;
    expect(p.sortsRecharge).toEqual(expect.arrayContaining(['epee_divine', 'colere']));
    expect(p.sortsRecharge).not.toContain('pression');
    const [id, def] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === 'amulette' && !d.familier)!;
    const rng = new Rng(3);
    let vu = false;
    for (let i = 0; i < 200 && !vu; i++) {
      const it = rollItem(id, def, 'legendaire', rng, i, p.sortsRecharge);
      if (it.legendary?.id === 'relance') { vu = true; expect(p.sortsRecharge).toContain(it.legendary.sort); expect(it.legendary.value).toBeGreaterThanOrEqual(0.5); }
    }
    expect(vu).toBe(true);
    // sans sort à recharge, jamais de Relance éclair
    for (let i = 0; i < 100; i++) expect(rollItem(id, def, 'legendaire', rng, i).legendary?.id).not.toBe('relance');
  });
});
