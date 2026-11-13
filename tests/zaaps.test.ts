import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World, type WorldOptions } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const MONDES: Record<string, WorldData> = { astrub: lire('astrub'), incarnam: lire('incarnam') };
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone: string, o: Partial<WorldOptions> = {}) => new World({ data: GAME_DATA, zone, map: new WorldGrid(MONDES[zone]), seed: 1,
  items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE, ...o });
const pas = (w: World, n: number, input: PlayerInput = NO_INPUT) => { const ev: SimEvent[] = []; for (let i = 0; i < n; i++) { w.step(1 / 60, input); ev.push(...w.drainEvents()); } return ev; };
const devant = (w: World, nom: string) => { const q = w.devantZaap(nom)!; w.player.x = q.x; w.player.y = q.y; };

describe('Zaaps du monde (maquette « Zaap : » 1A 2A 3A 4A 5A+5D 6A 7A 8A 9A)', () => {
  it('2A : les 5 Zaaps officiels (repères de Dofus 3), chacun avec une case devant son arche, sur sa carte', () => {
    const noms = (z: string) => GAME_DATA.zones[z].open!.checkpoints.map(c => `${c.name} [${c.map}]`);
    expect(noms('incarnam')).toEqual(['Route des âmes [-1,-3]', 'Pâturages [2,-5]', 'Cimetière [3,0]']);
    expect(noms('astrub').slice(0, 2)).toEqual(["Zaap d'Astrub [5,-18]", 'Zaap de Tainéla [1,-32]']);
    // 0.4 suite 7A : les 7 Zaaps d'Amakna (+ celui de l'île des Wabbits, 10A, et ceux de Cania sud et de Moon, 9A+9B), seulement en partie de test tant que la 0.4 est cachée
    expect(noms('astrub').slice(2).sort()).toEqual(['Zaap Bord de la forêt maléfique [-1,13]', 'Zaap Château d\'Amakna [3,-5]', 'Zaap Coin des Bouftous [5,7]',
      'Zaap Montagne des Craqueleurs [-5,-8]', 'Zaap Plaine des Scarafeuilles [-1,24]', 'Zaap Port de Madrestam [7,-4]', 'Zaap Village d\'Amakna [-2,0]', 'Zaap Île de la Cawotte [25,-4]',
      'Zaap Plaine des Porkass [-5,-23]', 'Zaap Village des Dopeuls [-34,-8]', 'Zaap Plage de la Tortue [35,12]',
      // 0.6 (partie de test) : Bourgade de Frigost, Plaines Rocheuses, Routes Rocailleuses
      'Zaap La Bourgade [-78,-41]', 'Zaap Plaines Rocheuses [-17,-47]', 'Zaap Routes Rocailleuses [-20,-20]'].sort());
    expect(monde('astrub').zone.open!.checkpoints).toHaveLength(13);   // 0.4 publique : les Zaaps d'Amakna pour tous
    for (const z of ['incarnam', 'astrub']) {
      const w = monde(z, { test: {} as never }), wg = w.worldGrid!;
      for (const c of w.zone.open!.checkpoints) {
        const q = w.devantZaap(c.name), a = w.zaapsIci().find(o => o.name === c.name)!;
        expect(q, c.name).not.toBeNull();
        expect(w.map.walkable(q!.x, q!.y)).toBe(true);
        expect(wg.mapAt(q!.x, q!.y)?.tag, c.name).toBe(c.map.join('_'));
        expect(Math.hypot(q!.x - a.x, q!.y - a.y), c.name).toBeLessThan(World.ZAAP_PORTEE);
      }
    }
  });
  it('1A : cliquer sur un Zaap y fait aller le perso, la fenêtre s\'ouvre en arrivant (une fois)', () => {
    const w = monde('astrub'), q = w.devantZaap("Zaap d'Astrub")!;
    w.player.x = q.x + 150; w.player.y = q.y + 150;
    const ev = [...pas(w, 1, { ...NO_INPUT, versZaap: "Zaap d'Astrub", dest: q }), ...pas(w, 240)];
    expect(ev.filter(e => e.k === 'arche')).toHaveLength(1);
    // un autre clic au sol annule
    const w2 = monde('astrub');
    w2.player.x = q.x + 150; w2.player.y = q.y + 150;
    pas(w2, 1, { ...NO_INPUT, versZaap: "Zaap d'Astrub", dest: q });
    const ev2 = [...pas(w2, 1, { ...NO_INPUT, dest: { x: q.x + 400, y: q.y + 400 } }), ...pas(w2, 200)];
    expect(ev2.filter(e => e.k === 'arche')).toHaveLength(0);
  });
  it('3A : un Zaap découvert est annoncé une seule fois ; on arrive devant son arche, qui devient le point de retour', () => {
    const w = monde('astrub');
    devant(w, 'Zaap de Tainéla');
    const ev = pas(w, 3);
    expect(ev.filter(e => e.k === 'zaapDecouvert')).toEqual([{ k: 'zaapDecouvert', name: 'Zaap de Tainéla' }]);
    expect(pas(w, 3).filter(e => e.k === 'zaapDecouvert')).toHaveLength(0);
    expect(w.checkpointName).toBe('Zaap de Tainéla');
    expect(w.pointDeRetour).toMatchObject(w.devantZaap('Zaap de Tainéla')!);
  });
  it('4A 7A 9A : voyage gratuit d\'un Zaap à l\'autre, après le tourbillon, arrivée devant le Zaap', () => {
    const w = monde('astrub');
    w.player.zaaps = [{ zone: 'astrub', name: "Zaap d'Astrub" }, { zone: 'astrub', name: 'Zaap de Tainéla' }, { zone: 'incarnam', name: 'Pâturages' }];
    const kamas = w.player.kamas;
    expect(w.voyagerZaap(1)).toBe(false);   // loin de tout Zaap
    devant(w, "Zaap d'Astrub"); pas(w, 1);
    expect(w.voyagerZaap(0)).toBe(false);   // on y est déjà
    expect(w.voyagerZaap(2)).toBe(true);
    const ev = pas(w, Math.ceil(World.ZAAP_DEPART * 60) + 2);
    expect(ev[0]).toMatchObject({ k: 'zaapDepart' });
    expect(ev.find(e => e.k === 'changeZone')).toMatchObject({ zone: 'incarnam', zaap: 'Pâturages' });
    expect(w.player.kamas).toBe(kamas);
    const b = monde('incarnam', { zaap: 'Pâturages' });
    expect(b.zaapProche()?.name).toBe('Pâturages');
    expect(b.checkpointName).toBe('Pâturages');
  });
  it('5A : le Bastion des Douze depuis un Zaap du monde, en gardant d\'où l\'on vient', () => {
    const w = monde('astrub');
    devant(w, "Zaap d'Astrub"); pas(w, 1);
    expect(w.voyagerZaap(World.ZAAP_BASTION)).toBe(true);
    const cz = pas(w, 30).find(e => e.k === 'changeZone');
    expect(cz).toMatchObject({ zone: 'bastion', retour: { zone: 'astrub', point: { name: "Zaap d'Astrub" } } });
  });
  it('le Zaap du Bastion a le tourbillon officiel du Zaap (particule Vortex dans son atlas), sur son arche', () => {
    const lireJ = (f: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/bastion/${f}`, import.meta.url), 'utf8'));
    const P = lireJ('particules.json').bastion as { n: string; tx: number; x: number; y: number }[], A = lireJ('particules_atlas.json');
    const v = P.find(d => d.n === 'Vortex');
    expect(v).toBeDefined();
    expect(A.frames[String(v!.tx)]).toBeDefined();
    const BA = lire('bastion'), wg = new WorldGrid(BA), c = wg.cellOf('bastion', GAME_DATA.zones.bastion.open!.bastion!.zaap);
    const m = (wg as unknown as { cellCenter(c: number): { x: number; y: number } }).cellCenter(c);
    expect(Math.hypot(v!.x - m.x, v!.y - m.y)).toBeLessThan(60);
  });
});
