import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import type { QuetesData } from '../src/sim/quests';
import QUETES from '../src/data/quetes.json';
import ITEMS from '../src/data/items.json';
import type { ItemsData } from '../src/sim/items';

const lire = (z: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${z}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const Q = QUETES as unknown as QuetesData;
const monde = (zone: string) => new World({ data: GAME_DATA, zone, map: new WorldGrid(lire(zone)), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q,
  compte: { succes: [], persos: 1 }, classId: 'iop', aujourdhui: '2026-11-08' });

describe('flèche des quêtes (maquette Flèche 1A 3A 3B, 2026-11-08)', () => {
  it('de dehors, un PNJ dans la Tour de la Milice : le trajet passe par la porte de la Tour, pas vers l\'intérieur rangé ailleurs', () => {
    const w = monde('incarnam'), q = w.quetes!, p = w.player;
    q.finies.add('reponses'); q.enCours = []; q.prendre('epreuve');
    const c = q.enCours[0]; c.compte = [1]; c.aRendre = true; q.suivie = 'epreuve';
    const a = w.openestCellOf('2_-3'); p.x = a.x; p.y = a.y;
    const it = q.itineraire()!, porte = w.portes.find(po => po.ends.some(e => e.tag === 'milice_rdc'))!.ends.find(e => e.tag !== 'milice_rdc')!;
    expect(it.nom).toBe('Capitaine des Kerubims');
    expect(it.via).toBe('porte');
    expect(it.pts.at(-1)).toMatchObject({ x: porte.x, y: porte.y, genre: 'porte' });
    expect(it.cartes).toBe(4);
    // le point visé est du côté de la porte, pas de l'intérieur
    const d = (o: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(o.x - b.x, o.y - b.y);
    expect(d(it, porte)).toBeLessThan(d(p, porte));
    // dans la Tour : le Capitaine lui-même
    const n = q.pnj('capitaine')!; p.x = n.x + 40; p.y = n.y;
    const ici = q.itineraire()!;
    expect(ici.cartes).toBe(0);
    expect({ x: ici.x, y: ici.y }).toEqual({ x: n.x, y: n.y });
  });
  it('un but dans l\'autre zone : la flèche mène au portail d\'Astrub, puis au Zaap une fois découvert', () => {
    const w = monde('incarnam'), q = w.quetes!, p = w.player;
    p.level = 25; q.finies.add('reponses'); q.enCours = []; q.prendre('avis_sam'); q.suivie = 'avis_sam';
    const a = w.openestCellOf('0_-1'); p.x = a.x; p.y = a.y;
    const it = q.itineraire()!;
    expect(it.autreZone).toBe('Astrub');
    expect(it.via).toBe('portail');
    expect(w.worldGrid!.mapAt(it.pts.at(-1)!.x, it.pts.at(-1)!.y)?.tag).toBe('4_-3');
    // une quête sans lieu (niveau, sort…) n'a pas de flèche
    q.enCours = []; q.prendre('astrub'); q.suivie = 'astrub';
    expect(q.itineraire()).toBeNull();
  });
  it('à pied, le trajet ne passe pas par le vide entre deux cartes voisines', () => {
    const w = monde('incarnam'), q = w.quetes!, p = w.player;
    q.finies.add('reponses'); q.enCours = []; q.prendre('epreuve'); const c = q.enCours[0]; c.compte = [1]; c.aRendre = true;
    const a = w.openestCellOf('2_-3'); p.x = a.x; p.y = a.y;
    const wg = w.worldGrid!, it = q.itineraire()!;
    for (const o of it.pts) expect(wg.walkable(o.x, o.y)).toBe(true);
  });
  it('idée 1 : les monstres qui comptent pour un objectif en cours sont repérés (losange)', () => {
    const w = monde('incarnam'), q = w.quetes!;
    q.finies.add('reponses'); q.enCours = []; q.prendre('gloots');
    const gloot = w.monsters.find(m => m.type === 'petit_gloot')!, autre = w.monsters.find(m => m.type === 'tigrimas')!;
    expect(q.pourQuete(gloot.type, gloot.x, gloot.y)).toBe(true);
    expect(q.pourQuete(autre.type, autre.x, autre.y)).toBe(false);
    // objectif fini : plus de losange
    q.enCours[0].compte[0] = 5;
    expect(q.pourQuete(gloot.type, gloot.x, gloot.y)).toBe(false);
    // « n'importe quel monstre » d'une sous-zone : seulement dans la sous-zone
    q.enCours = []; q.prendre('transport');
    const ici = w.monsters.find(m => w.worldGrid!.mapAt(m.x, m.y)?.sub === 445)!, ailleurs = w.monsters.find(m => w.worldGrid!.mapAt(m.x, m.y)?.sub === 444)!;
    expect(q.pourQuete(ici.type, ici.x, ici.y)).toBe(true);
    expect(q.pourQuete(ailleurs.type, ailleurs.x, ailleurs.y)).toBe(false);
  });
  it('idée 2 : le Zaap conseillé est le Zaap découvert le plus proche du but', () => {
    const w = monde('incarnam'), q = w.quetes!, p = w.player;
    p.level = 25; q.finies.add('reponses'); q.enCours = []; q.prendre('avis_sam'); q.suivie = 'avis_sam';
    expect(q.zaapConseille()).toBeNull();   // aucun Zaap d'Astrub découvert
    const cps = GAME_DATA.zones.astrub.open!.checkpoints;
    p.zaaps = cps.map(c => ({ zone: 'astrub', name: c.name }));
    const best = q.zaapConseille()!;
    expect(best.zone).toBe('astrub');
    // Sam Sagaz est en [7,-12] : aucun autre Zaap d'Astrub n'est plus près
    const d = (c: { map: [number, number] }) => Math.abs(c.map[0] - 7) + Math.abs(c.map[1] + 12);
    const choisi = cps.find(c => c.name === best.name)!;
    for (const c of cps) expect(d(choisi)).toBeLessThanOrEqual(d(c));
  });
});
