// Vétéran d'Idlus (Mathis 2026-11-25, maquette « Relais vers Diablofus » 3A) : titre, ornement et auréole selon le palier
// du code d'Idlus (serveur/idlus.mjs), jamais en vente chez Tissebelle.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { STYLE, TITRES_IDLUS } from '../src/sim/style';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, aujourdhui: '2026-11-25', reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('Vétéran d\'Idlus', () => {
  it('chaque palier ajoute sa récompense, sans doublon', () => {
    const w = monde(), q = w.players[0].quetes!;
    expect(w.recevoirIdlus(1, false)).toBe(1);
    expect(q.titres).toContain(TITRES_IDLUS.veteran);
    expect(w.aLeStyle('ornements', 'idlus')).toBe(false);
    expect(w.recevoirIdlus(3, true)).toBe(3);
    expect(w.aLeStyle('ornements', 'idlus')).toBe(true);
    expect(w.aLeStyle('aureoles', 'idlus')).toBe(true);
    expect(q.titres).toContain(TITRES_IDLUS.adieu);
    expect(w.recevoirIdlus(3, true)).toBe(0);
  });
  it('jamais en vente en Pépites', () => {
    const w = monde(); w.player.resources[PEPITE] = 100_000;
    expect(STYLE.aureoles.find(d => d.id === 'idlus')?.idlus).toBe(true);
    expect(w.acheterStyle('aureoles', 'idlus')).toBe(false);
    expect(w.acheterStyle('ornements', 'idlus')).toBe(false);
  });
});
