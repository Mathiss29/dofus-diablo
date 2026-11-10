import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { monstresDeZone, panoDuBoss, poolOfficiel, tirerButin, type CtxButin } from '../src/sim/butin';
import { NIVEAU_OBJETS_03, V04_PUBLIC } from '../src/sim/pouvoirs';
import { Rng } from '../src/sim/math';
import { World } from '../src/sim/world';
import { readFileSync } from 'node:fs';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;

const nomPano = (id: string) => ITEMS.sets[String(ITEMS.equipment[id].set)]?.name;

describe('butin de la 0.4 (« 0.4 suite : 1A+1C »)', () => {
  it('1A : les équipements officiels du niveau 41 au 60 sont dans le jeu, avec leurs panoplies', () => {
    const eq = Object.values(ITEMS.equipment).filter(e => e.level > 40 && e.level <= 60);
    expect(eq.length).toBeGreaterThan(450);
    expect(eq.filter(e => e.set).every(e => ITEMS.sets[String(e.set)])).toBe(true);
  });
  it('1A : hors partie de test, rien au-dessus du niveau 40 tant que la 0.4 n’est pas publique', () => {
    if (V04_PUBLIC) return;
    const w = new World({ data: GAME_DATA, items: ITEMS, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 3, sansGroupes: true });
    const p = w.player; p.level = 60;
    const c = w.contexteButin('kwakwa', 'boss', 60), rng = new Rng(5);
    let uid = 0;
    for (let i = 0; i < 300; i++) for (const o of tirerButin(rng, c, () => uid++).objets) expect(ITEMS.equipment[o.id].level).toBeLessThanOrEqual(NIVEAU_OBJETS_03);
  });
  it('1C : un boss lâche souvent les pièces de ses panoplies', () => {
    expect(panoDuBoss(ITEMS, 'kwakwa').map(e => nomPano(e.id))).toContain('Panoplie du Kwakwa');
    expect(new Set(panoDuBoss(ITEMS, 'royal').map(e => nomPano(e.id)))).toContain('Panoplie du Bouftou Royal');
    expect(new Set(panoDuBoss(ITEMS, 'scarabosse_dore').map(e => nomPano(e.id)))).not.toContain('Panoplie de l\'Abraknyde');
    const pool = poolOfficiel(ITEMS, Object.values(GAME_DATA.zones).flatMap(monstresDeZone)), panoBoss = panoDuBoss(ITEMS, 'kwakwa');
    const ctx: CtxButin = { type: 'kwakwa', rang: 'boss', niveau: 50, prospection: 0, items: ITEMS, familiers: [], pool, panoBoss, metierNiveau: () => 1, armeChasse: false };
    const rng = new Rng(9), ids = new Set(panoBoss.map(e => e.id));
    let uid = 0, dans = 0, tous = 0;
    for (let i = 0; i < 2000; i++) for (const o of tirerButin(rng, ctx, () => uid++).objets) { tous++; if (ids.has(o.id)) dans++; }
    expect(dans / tous).toBeGreaterThan(0.4);
  });
});
