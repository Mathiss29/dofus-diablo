import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { castKind, soutienSeul } from '../src/sim/monster';
import { World } from '../src/sim/world';

/** Bug de Mathis (2026-11-08) : les Chafers Éclaireurs (archers) tiraient sans jamais faire de dégâts.
 *  Leur Flèche de Feu touche « aussi les alliés » dans les données, et le jeu la prenait pour un sort de soutien. */
const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;

function duel(id: string, secondes: number) {
  const map = new GridMap({ ...carte, mov: '1'.repeat(carte.mov.length), decor: [] });
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map, seed: 5 });
  w.monsters.length = 0;
  const p = w.player, c = map.cellToWorld(300);
  p.x = c.x; p.y = c.y; p.hp = p.maxHp = 1e6;
  const m = w.spawnMonster(id, p.x + 200, p.y); m.state = 'chase';
  let proche = Infinity;
  for (let i = 0; i < 60 * secondes; i++) {
    p.x = c.x; p.y = c.y; w.step(1 / 60, NO_INPUT); w.drainEvents();
    proche = Math.min(proche, Math.hypot(m.x - p.x, m.y - p.y));
  }
  return { perdu: p.maxHp - p.hp, proche };
}

describe('sorts à distance des monstres', () => {
  it('le Chafer Éclaireur blesse le joueur de loin avec sa Flèche de Feu', () => {
    const { perdu, proche } = duel('chafer_eclaireur', 10);
    expect(perdu).toBeGreaterThan(0);
    expect(proche).toBeGreaterThan(100);   // il garde ses distances au lieu de venir au contact
  });

  it('aucun sort qui fait des dommages n\'est pris pour un sort de soutien', () => {
    for (const d of Object.values(GAME_DATA.monsters)) for (const s of d.spells ?? []) {
      if (s.effects.some(e => e.k === 'dmg')) expect(soutienSeul(s), `${d.name} : ${s.name}`).toBe(false);
    }
  });

  it('tous les monstres à sorts à distance (zone visée) blessent un joueur immobile', () => {
    const ids = Object.entries(GAME_DATA.monsters).filter(([, d]) => !d.boss
      && (d.spells ?? []).some(s => castKind(s) === 'target' && s.effects.some(e => e.k === 'dmg'))).map(([id]) => id);
    expect(ids).toContain('chafer_eclaireur');
    for (const id of ids) expect(duel(id, 12).perdu, id).toBeGreaterThan(0);
  });
});
