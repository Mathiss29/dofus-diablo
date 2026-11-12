import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { coffreDe, GUERRE } from '../src/sim/guerre';
import type { SimEvent } from '../src/sim/events';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 7, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-10', ...(test ? { test: {} as never } : {}) });
const champs = GAME_DATA.zones.astrub.open!.guerre!.champs;

/** Pose le joueur à côté du champ i, increvable, et retire les monstres sauvages autour. */
function surLeChamp(w: World, i: number, d = 260) {
  const p = w.player, e = w.guerre!.epouvantail(i), f = w.map.nearestFree(e.x + d, e.y);
  p.x = f.x; p.y = f.y; p.invuln = 1e9;
  for (const m of w.monsters) if (!m.guerre) { m.dead = true; m.t = 0; }
  return p;
}
function avancer(w: World, s: number, ev: SimEvent[] = []) {
  for (let t = 0; t < s; t += 0.05) { w.player.invuln = 1e9; w.step(0.05, NO_INPUT); ev.push(...w.drainEvents()); }
  return ev;
}

describe('guerre des Cawottes (« Guerre : 1A 2C 3A+3C+3D 4C 5C 6A+6C+6D 7B 8A-8E 9A 10A-10D 11B+11D 12A-12D »)', () => {
  it('1A + 2C + 5C : un champ par îlot, 12 cawottes, 3 entrées et un épouvantail, sur des cases où l’on marche', () => {
    const wg = new WorldGrid(astrub); wg.ouvrirEssai();
    expect(champs.map(c => c.sub).sort()).toEqual([161, 162, 163, 164]);
    for (const c of champs) {
      expect(c.cawottes.length, c.nom).toBe(GUERRE.cawottes);
      expect(c.entrees.length, c.nom).toBe(3);
      for (const k of [...c.cawottes, ...c.entrees, c.epouvantail]) { const p = wg.cellToWorld(k); expect(wg.walkable(p.x, p.y), `${c.nom} ${k}`).toBe(true); }
    }
    expect(monde(false).guerre).not.toBeNull();   // 0.4 publique (2026-11-11)
    expect(monde(true).guerre).not.toBeNull();
  });

  it('7B : coffre en or dès 10 cawottes sauvées, argent dès 6, bronze dès 1', () => {
    expect([12, 10, 9, 6, 5, 1, 0].map(coffreDe)).toEqual(['or', 'or', 'argent', 'argent', 'bronze', 'bronze', null]);
  });

  it('6A + 3A + 4C : clic sur l’épouvantail, 5 vagues de Wabbits qui arrachent les cawottes en 2 s, puis le bilan', () => {
    const w = monde(true);
    surLeChamp(w, 0);
    const e = w.guerre!.epouvantail(0);
    const ev: SimEvent[] = [];
    for (let t = 0; t < 5 && !w.guerre!.attaque; t += 0.05) { w.step(0.05, { ...NO_INPUT, dest: { x: e.x, y: e.y } }); ev.push(...w.drainEvents()); }   // clic : il marche jusqu'à l'épouvantail
    expect(w.guerre!.attaque?.c.nom).toBe(champs[0].nom);
    expect(ev.some(x => x.k === 'guerreDebut')).toBe(true);
    expect(w.guerre!.recharges[0]).toBeGreaterThan(GUERRE.recharge - 1);
    // personne ne défend : les Wabbits volent tout
    avancer(w, 240, ev);
    const vagues = ev.filter(x => x.k === 'guerreVague').length, vols = ev.filter(x => x.k === 'guerreVol').length;
    expect(vagues).toBeGreaterThan(0);
    expect(vols).toBeGreaterThan(0);
    const fin = ev.find(x => x.k === 'guerreFin');
    expect(fin, 'fin de l’attaque').toBeTruthy();
    if (fin?.k === 'guerreFin') expect(fin.sauvees).toBeLessThan(GUERRE.cawottes);
    // 6A : l’épouvantail se repose 5 min
    for (let t = 0; t < 3; t += 0.05) w.step(0.05, { ...NO_INPUT, dest: { x: e.x, y: e.y } });
    expect(w.guerre!.attaque === null || w.guerre!.attaque.fini).toBe(true);
  });

  it('3C : le Kiafin tué en fuite replante la cawotte ; 7B : le coffre donne des Cawottes au joueur sur le champ', () => {
    const w = monde(true), p = surLeChamp(w, 0, 200), G = w.guerre!;
    G.lancer(0, true);
    const a = G.attaque!;
    avancer(w, 0.05);
    const m = w.spawnMonster(GUERRE.kiafin, a.cawottes[0].x, a.cawottes[0].y);
    m.guerre = true; m.arene = true; m.state = 'chase';
    a.voleurs.push({ m, cible: 0, vol: GUERRE.vol, hp: m.hp, frappeT: 0, fuite: null });
    expect(a.piloter(m, 0.05)).toBe(true);
    expect(a.cawottes[0].etat).toBe('portee');
    m.hp = 0; m.dead = true; m.t = 0.6;
    const ev = avancer(w, 0.1);
    expect(ev.some(x => x.k === 'guerreReplantee')).toBe(true);
    expect(a.cawottes[0].etat).toBe('plantee');
    // on finit l’attaque d’un coup, toutes les cawottes sauvées : coffre en or, +50 % (attaque spontanée)
    for (const v of a.voleurs) { v.m.dead = true; v.m.t = 0; }
    a.voleurs = []; a.arrivees = []; a.vague = GUERRE.vagues;
    avancer(w, 0.2, ev);
    const fin = ev.find(x => x.k === 'guerreFin');
    expect(fin && fin.k === 'guerreFin' && fin.coffre).toBe('or');
    expect(p.resources[GUERRE.monnaie]).toBe(Math.round(GUERRE.coffre.or * 1.5));
    expect(p.guerre.gagnees).toBe(1);
    expect(p.guerre.parfaits).toEqual([champs[0].nom]);
    expect(p.guerre.kiafins).toBe(1);
  });

  it('8A-8E + 9A : Tiwa Cawoteuw vend en Cawottes ressources, clés, Rappel et apparences, jamais d’équipement', () => {
    expect(QUETES.pnj.tiwa_cawoteuw.nom).toBe('Tiwa Cawoteuw');
    const b = BOUTIQUES.tiwa_cawoteuw;
    expect(b.every(a => a.monnaie === GUERRE.monnaie && a.v04)).toBe(true);
    for (const a of b) expect(a.apparat ? APPARATS.objets[a.id] : ITEMS.resources[a.id], a.id).toBeTruthy();
    expect(b.some(a => a.id === '14464') && b.some(a => a.id === '14465')).toBe(true);
    const w = monde(true), p = w.player;
    p.v04 = true;
    expect(w.acheter('tiwa_cawoteuw', '14464')).toBe(false);
    p.resources[GUERRE.monnaie] = 2200;
    expect(w.acheter('tiwa_cawoteuw', '6500')).toBe(true);
    expect(p.apparats).toContain('6500');
    expect(w.acheter('tiwa_cawoteuw', '6500')).toBe(false);
    expect(w.acheter('tiwa_cawoteuw', '14464')).toBe(true);
    expect(p.resources['14464']).toBe(1);
    expect(p.resources[GUERRE.monnaie]).toBe(50);
  });

  it('12A-12D : succès de la guerre et titre « Gardien des Cawottes », ouvert à tous depuis la 0.4', () => {
    const w = monde(true), p = w.player, q = w.quetes!;
    p.guerre.gagnees = 10; p.guerre.or = 25; p.guerre.kiafins = 100; p.guerre.parfaits = champs.map(c => c.nom);
    avancer(w, 0.1);
    for (const s of ['guerre_defenseur_10', 'guerre_gardien', 'guerre_kiafin_100', 'guerre_pas_une_de_moins']) expect(q.succes.has(s), s).toBe(true);
    expect(q.succes.has('guerre_defenseur_50')).toBe(false);
    expect(QUETES.succes.guerre_gardien.recompense?.titre).toBe('Gardien des Cawottes');
  });
});
