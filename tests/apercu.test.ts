import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { apercuSort, porteeSort } from '../src/sim/apercu';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const monde = (classId = 'iop') => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 3, classId });
  w.monsters.length = 0;
  return w;
};
const monstre = (w: World, x: number, y: number) => { const m = w.spawnMonster('epouvanteur', x, y); m.state = 'chase'; return m; };

describe('aperçu des sorts (maquette Aperçu)', () => {
  it('Ferveur : cercle autour du perso, seuls les monstres dedans sont cerclés', () => {
    const w = monde(), p = w.player;
    const pres = monstre(w, p.x + 50, p.y), loin = monstre(w, p.x + 400, p.y);
    const a = apercuSort(w, 'ferveur', { x: p.x + 100, y: p.y })!;
    expect(a.zone?.kind).toBe('circle');
    expect(a.cibles).toContain(pres.id);
    expect(a.cibles).not.toContain(loin.id);
  });

  it('flèche : touche le premier monstre sur sa route, pas celui caché derrière', () => {
    const w = monde('cra'), p = w.player;
    const devant = monstre(w, p.x + 100, p.y), derriere = monstre(w, p.x + 160, p.y);
    const a = apercuSort(w, 'recul', { x: p.x + 300, y: p.y })!;
    expect(a.zone?.kind).toBe('shot');
    expect(a.cibles).toEqual([devant.id]);
    expect(a.cibles).not.toContain(derriere.id);
    expect(a.portee).toBeGreaterThan(100);
  });

  it('Bond : la zone est au point d\'arrivée, à la portée maximale si l\'on vise plus loin', () => {
    const w = monde(), p = w.player;
    const a = apercuSort(w, 'bond', { x: p.x + 5000, y: p.y })!;
    expect(a.zone?.kind).toBe('circle');
    if (a.zone?.kind === 'circle') expect(Math.hypot(a.zone.x - p.x, a.zone.y - p.y)).toBeLessThanOrEqual(a.portee + 1);
  });

  it('option 5B : sur un monstre hors de portée, le perso s\'approche puis lance', () => {
    const w = monde('cra'), p = w.player;
    const reach = porteeSort(w, 'recul'), m = monstre(w, p.x + reach + 150, p.y);
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'recul', castOn: m.id, approach: true });
    expect(p.castChase?.id).toBe('recul');
    expect(p.skill).toBeNull();
    for (let i = 0; i < 240 && p.castChase; i++) w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(p.castChase).toBeNull();
    expect(p.skill?.id).toBe('recul');
  });

  it('sans l\'option, le sort part tout de suite (5A)', () => {
    const w = monde('cra'), p = w.player;
    const m = monstre(w, p.x + porteeSort(w, 'recul') + 150, p.y);
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'recul', castOn: m.id });
    expect(p.castChase).toBeNull();
    expect(p.skill?.id).toBe('recul');
  });

  it('Bond : ne fait pas de dommages, augmente les dommages subis autour de l\'arrivée', () => {
    const w = monde(), p = w.player;
    const m = monstre(w, p.x + 150, p.y);
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x - 40, y: m.y }, pressed: 'bond' });
    for (let i = 0; i < 40; i++) w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(m.hp).toBe(m.maxHp);
    expect(m.vulnT).toBeGreaterThan(0);
    expect(m.vuln).toBe(10);
  });

  it('Pression (sort ciblé) : frappe le monstre visé à distance, sans le pousser', () => {
    const w = monde(), p = w.player;
    const m = monstre(w, p.x + 150, p.y), x0 = m.x;
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'pression', castOn: m.id });
    for (let i = 0; i < 40; i++) w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(m.hp).toBeLessThan(m.maxHp);
    expect(Math.abs(m.x - x0)).toBeLessThan(20);
  });

  it('Intimidation repousse dans l\'axe du lanceur', () => {
    const w = monde(), p = w.player;
    p.level = 5; p.recompute(); p.learnSpells(null);
    const m = monstre(w, p.x + 70, p.y);
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'intimidation', castOn: m.id });
    const x0 = m.x;
    let maxX = x0;
    for (let i = 0; i < 40; i++) { w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y } }); maxX = Math.max(maxX, m.x); }
    expect(maxX).toBeGreaterThan(x0 + 30 / m.def.mass);
  });
});
