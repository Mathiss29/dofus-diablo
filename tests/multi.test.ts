import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

/** Multi, étape 0 (maquette « Multi : » 1A) : la simulation accepte plusieurs joueurs, sans rien changer en solo. */
const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const arene = (seed = 7) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed });
/** Attend la première vague. */
const vague = (w: World) => { for (let i = 0; i < 240 && !w.monsters.length; i++) w.step(STEP, NO_INPUT); };
const poser = (w: World, q: { x: number; y: number }, x: number, y: number) => { const f = w.map.nearestFree(x, y); q.x = f.x; q.y = f.y; };

describe('plusieurs joueurs dans la même simulation', () => {
  it('en solo : un seul joueur, le même qu’avant', () => {
    const w = arene();
    expect(w.players).toHaveLength(1);
    expect(w.player).toBe(w.players[0]);
  });

  it('ajouterJoueur pose un deuxième perso à côté, sans changer le joueur de l’écran', () => {
    const w = arene(), h = w.player, q = w.ajouterJoueur('cra');
    expect(w.players).toEqual([h, q]);
    expect(q.id).not.toBe(h.id);
    expect(Math.hypot(q.x - h.x, q.y - h.y)).toBeLessThan(200);
    expect(w.walkable(q.x, q.y)).toBe(true);
    expect(w.player).toBe(h);
    expect(() => w.ajouterJoueur('inconnue')).toThrow();
  });

  it('un monstre vise le joueur vivant le plus proche', () => {
    const w = arene(), h = w.player, q = w.ajouterJoueur('iop');
    vague(w);
    const m = w.monsters[0];
    poser(w, h, m.x + 600, m.y);
    poser(w, q, m.x + 60, m.y);
    expect(w.cibleDe(m)).toBe(q);
    q.dead = true;
    expect(w.cibleDe(m)).toBe(h);
  });

  it('chaque joueur agit avec ses propres entrées', () => {
    const w = arene(), h = w.player, q = w.ajouterJoueur('iop');
    const hx = h.x, qx = q.x;
    for (let i = 0; i < 30; i++) w.step(STEP, NO_INPUT, { [q.id]: { ...NO_INPUT, move: { x: 1, y: 0 }, aim: { x: q.x + 100, y: q.y } } });
    expect(h.x).toBe(hx);
    expect(q.x).toBeGreaterThan(qx);
  });

  it('un monstre tué par le 2e joueur donne l’XP aux deux, +10 % par allié proche', () => {
    const w = arene(), h = w.player, q = w.ajouterJoueur('iop');
    vague(w);
    const m = w.monsters[0];
    for (const o of w.monsters) if (o !== m) { o.x += 5000; o.y += 5000; }   // les autres loin, hors de la mêlée
    poser(w, q, m.x - 40, m.y);
    poser(w, h, m.x - 140, m.y);
    m.hp = 1; m.state = 'chase';
    for (let i = 0; i < 180 && !m.dead; i++) w.step(STEP, NO_INPUT, { [q.id]: { ...NO_INPUT, aim: { x: m.x, y: m.y }, target: m.id, holdAttack: true } });
    expect(m.dead).toBe(true);
    const xp = Math.round((m.def.xp ?? Math.round(m.def.hp / 5)) * 1.1);
    expect(q.xp).toBe(Math.round(xp * (1 + q.stat('sagesse') / 100)));
    expect(h.xp).toBe(Math.round(xp * (1 + h.stat('sagesse') / 100)));
  });

  it('les coups des monstres touchent le 2e joueur, pas le joueur de l’écran resté loin', () => {
    const w = arene(), h = w.player, q = w.ajouterJoueur('iop');
    vague(w);
    const m = w.monsters[0];
    for (const o of w.monsters) if (o !== m) { o.x += 5000; o.y += 5000; }
    poser(w, h, m.x + 900, m.y);
    poser(w, q, m.x - 50, m.y);
    m.state = 'chase';
    const hp0 = h.hp, qp0 = q.hp;
    for (let i = 0; i < 300; i++) w.step(STEP, NO_INPUT);
    expect(q.hp).toBeLessThan(qp0);
    expect(h.hp).toBe(hp0);
  });
});
