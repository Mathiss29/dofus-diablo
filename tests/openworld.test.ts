import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { MAP_COLS, MAP_ROWS, WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const STEP = 1 / 60;
const newWorld = (seed = 42) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed });
const zone = GAME_DATA.zones.incarnam.open!;

describe('monde d\'Incarnam (cartes Dofus collées)', () => {
  const wg = new WorldGrid(monde);
  it('la grande grille couvre toutes les cartes', () => {
    const xs = monde.maps.map(m => m.x), ys = monde.maps.map(m => m.y);
    expect(wg.cols).toBe((Math.max(...xs) - Math.min(...xs) + 1) * MAP_COLS);
    expect(wg.rows).toBe((Math.max(...ys) - Math.min(...ys) + 1) * MAP_ROWS);
    expect(monde.mov).toHaveLength(wg.cols * wg.rows);
  });
  it('chaque case marchable appartient à une carte, et chaque carte a des cases marchables', () => {
    for (const c of wg.free.slice(0, 2000)) expect(wg.mapOfCell(c)).toBeDefined();
    for (const m of monde.maps) expect(wg.freeByMap.get(m.tag)!.length).toBeGreaterThan(m.inside ? 20 : 50);
  });
  it('Incarnam entier : Route des âmes, Champs, Pâturages, Lac, Forêt et Cimetière, chacun avec ses monstres officiels', () => {
    expect(monde.maps.filter(m => !m.inside).length).toBe(50);
    for (const sub of ['450', '444', '445', '442', '443', '449']) {
      expect(monde.maps.some(m => String(m.sub) === sub), sub).toBe(true);
      for (const t of zone.subareas[sub].monsters) expect(GAME_DATA.monsters[t]?.dofusId, t).toBeDefined();
    }
  });
  it('retrouve la carte sous un point du monde', () => {
    const m = wg.mapByCoords(-2, -5)!, c = wg.freeByMap.get(m.tag)![10], p = wg.cellToWorld(c);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe('-2_-5');
  });
  it('on passe d\'une carte à sa voisine à pied : cases marchables de part et d\'autre du bord', () => {
    // Route des âmes [0,-3] -> [1,-3] : la colonne 13 de l'une touche la colonne 0 de l'autre
    const a = wg.mapByCoords(0, -3)!, b = wg.mapByCoords(1, -3)!;
    const edgeA = wg.freeByMap.get(a.tag)!.filter(c => c % MAP_COLS === MAP_COLS - 1);
    const edgeB = wg.freeByMap.get(b.tag)!.filter(c => c % MAP_COLS === 0);
    expect(edgeA.some(c => edgeB.includes(c + 1))).toBe(true);
  });
});

describe('monde ouvert', () => {
  it('pose des groupes de monstres officiels de chaque sous-zone, qui attendent', () => {
    const w = newWorld();
    expect(w.monsters.length).toBeGreaterThan(40);
    const wg = w.worldGrid!;
    for (const m of w.monsters) {
      const sub = zone.subareas[String(wg.mapAt(m.homeX, m.homeY)!.sub)];
      expect(sub.monsters).toContain(m.type);
    }
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(w.monsters.every(m => m.state === 'idle')).toBe(true);
  });
  it('part de la Route des âmes et le HUD connaît la sous-zone', () => {
    const w = newWorld();
    w.step(STEP, NO_INPUT);
    expect(w.area?.name).toBe('Route des âmes');
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
  });
  it('un monstre approché alerte tout son groupe, qui rentre chez lui si on fuit', () => {
    const w = newWorld(3), m = w.monsters[0];
    const mates = w.monsters.filter(o => o.group === m.group);
    w.player.x = m.x + 60; w.player.y = m.y;
    for (let i = 0; i < 70; i++) w.step(STEP, NO_INPUT);
    expect(mates.some(o => o.state !== 'idle')).toBe(true);
    expect(mates.every(o => o.state !== 'idle' || o.dead)).toBe(true);
    // le joueur se téléporte loin : laisse dépassée -> retour, PV rendus
    w.player.x += 5000; m.hp = 1;
    for (let i = 0; i < 60 * 10; i++) w.step(STEP, NO_INPUT);
    expect(m.state).toBe('idle');
    expect(m.hp).toBe(m.maxHp);
  });
  it('un groupe vaincu réapparaît quand le joueur est loin, et rend une potion', () => {
    const w = newWorld(5), g = w.monsters[0].group, ev: string[] = [];
    w.player.potions = 0;
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);   // fin de l'apparition
    for (const m of w.monsters.filter(o => o.group === g)) w.hitCircle(m.x, m.y, 1, { dmg: 999, knock: 0 });
    for (let i = 0; i < 60; i++) { w.step(STEP, NO_INPUT); ev.push(...w.drainEvents().map(e => e.k)); }
    expect(ev).toContain('groupCleared');
    expect(w.player.potions).toBe(1);
    expect(w.monsters.some(m => m.group === g)).toBe(false);
    w.player.x += 5000;
    for (let i = 0; i < 60 * (zone.respawn + 1); i++) w.step(STEP, NO_INPUT);
    expect(w.monsters.some(m => m.group === g)).toBe(true);
  });
  it('après une mort, Entrée ramène au départ avec tous ses PV', () => {
    const w = newWorld();
    const start = { x: w.player.x, y: w.player.y };
    w.player.x += 300; w.player.hurt(9999, w.player.x, w.player.y, w);
    expect(w.over).toBe(true);
    w.respawnPlayer();
    expect(w.over).toBe(false);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect([w.player.x, w.player.y]).toEqual([start.x, start.y]);
  });
});

describe('intérieurs (maisons, Mine, Taverne)', () => {
  it('chaque porte mène de l\'autre côté, et la porte d\'arrivée ne renvoie pas aussitôt', () => {
    const w = newWorld(), wg = w.worldGrid!, p = w.player;
    expect(w.portes.length).toBeGreaterThanOrEqual(19);
    for (const po of w.portes) for (let i = 0; i < 2; i++) {
      const from = po.ends[i], to = po.ends[1 - i];
      // une case marchable dans le rayon de la porte (on peut l'atteindre à pied)
      const c = wg.freeByMap.get(from.tag)!.map(c => wg.cellToWorld(c)).find(q => Math.hypot(q.x - from.x, q.y - from.y) <= World.PORTE_R);
      expect(c, `${po.nom} ${from.tag}`).toBeDefined();
      p.x = c!.x; p.y = c!.y; p.hp = p.maxHp;
      w.step(STEP, NO_INPUT);
      expect(wg.mapAt(p.x, p.y)?.tag, `${from.tag} -> ${to.tag}`).toBe(to.tag);
      const there = { x: p.x, y: p.y };
      w.step(STEP, NO_INPUT);
      expect(wg.mapAt(p.x, p.y)?.tag).toBe(to.tag);
      expect(Math.hypot(p.x - there.x, p.y - there.y)).toBeLessThan(20);
      w.drainEvents();
      // on s'éloigne (coin du monde sans porte) : la porte se réarme
      const loin = wg.cellToWorld(wg.freeByMap.get('-3_-6')![0]);
      p.x = loin.x; p.y = loin.y; w.step(STEP, NO_INPUT);
    }
  });
  it('la Mine a ses Aminites, les maisons restent vides', () => {
    const w = newWorld(), wg = w.worldGrid!;
    const inside = w.monsters.map(m => wg.mapAt(m.homeX, m.homeY)!).filter(m => m.inside);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.every(m => m.sub === 778)).toBe(true);
    expect(w.monsters.filter(m => wg.mapAt(m.homeX, m.homeY)!.sub === 778).every(m => m.type === 'aminite')).toBe(true);
  });
});
