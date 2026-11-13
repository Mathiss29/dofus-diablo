import { existsSync, readFileSync } from 'node:fs';
import type { DecorPlace, WorldData } from '../src/sim/gridmap';

/** Lit un monde avec le décor de toutes ses régions recollé (monde chargé par régions, 0.6 3B : tools/extraction/regions_monde.py). */
export function mondeComplet(w: string): WorldData {
  const dossier = new URL(`../public/assets/mondes/${w}/`, import.meta.url);
  const data = JSON.parse(readFileSync(new URL('monde.json', dossier), 'utf8')) as WorldData;
  const D: Record<string, DecorPlace[]> = {};
  for (const r of data.regions ?? []) {
    const u = new URL(`region_${r}.json`, dossier);
    if (existsSync(u)) Object.assign(D, JSON.parse(readFileSync(u, 'utf8')));
  }
  for (const m of data.maps) m.decor ??= D[m.tag] ?? [];
  return data;
}
