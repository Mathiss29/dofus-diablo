import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World, type WorldOptions } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';
import THEMES from '../src/data/havresac_themes.json';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const HS = lire('havresac'), AS = lire('astrub'), BA = lire('bastion');
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone: string, o: Partial<WorldOptions> = {}) => new World({ data: GAME_DATA, zone, map: new WorldGrid(zone === 'havresac' ? HS : zone === 'bastion' ? BA : AS), seed: 1,
  items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE, ...o });
const pas = (w: World, n: number, input = NO_INPUT) => { const ev: SimEvent[] = []; for (let i = 0; i < n; i++) { w.step(1 / 60, input); ev.push(...w.drainEvents()); } return ev; };
/** Choix dans la fenêtre du Zaap, puis le temps du tourbillon (Zaap 9A). */
const voyage = (w: World, zaap: number) => [...pas(w, 1, { ...NO_INPUT, zaap }), ...pas(w, Math.ceil(World.ZAAP_DEPART * 60) + 2)];

describe('Havre-Sac (maquette Hub : 1A 2A+2C 3A 4A 7A 8A 9A)', () => {
  it('une seule pièce, la carte officielle du thème Mercenaire, arrivée sur une case marchable', () => {
    expect(HS.maps).toHaveLength(1);
    expect(HS.maps[0].id).toBe(162791452);
    // 5A : le thème en jeu fait partie des thèmes officiels à débloquer
    const t = THEMES.themes.find(x => x.id === GAME_DATA.zones.havresac.open!.havreSac!.theme);
    expect(t).toMatchObject({ nom: 'Mercenaire', carte: 162791452 });
    expect(THEMES.themes.length).toBeGreaterThanOrEqual(45);
    const w = monde('havresac');
    expect(w.dansHavreSac).toBe(true);
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
  });
  it('les PNJ de service vivent au Bastion (Ville 5A) ; Kerubim, Otomaï et Goultard emménagent après la première visite d\'Astrub (3A)', () => {
    const ids = (w: World) => w.quetes!.pnjs.map(p => p.id).sort();
    expect(ids(monde('bastion'))).toEqual(['bouillotte', 'forgemage', 'tissebelle']);
    expect(ids(monde('bastion', { zonesVues: ['incarnam', 'astrub'] }))).toEqual(['bouillotte', 'forgemage', 'goultard', 'kerubim', 'otomai', 'tissebelle']);
    // Ville 6B : Kerubim garde un guichet de recyclage au Havre-Sac
    expect(ids(monde('havresac'))).toEqual([]);
    expect(ids(monde('havresac', { zonesVues: ['astrub'] }))).toEqual(['kerubim_guichet']);
    // chacun sur sa case, tous à part
    const w = monde('bastion', { zonesVues: ['astrub'] }), l = w.quetes!.pnjs;
    for (const a of l) for (const b of l) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(60);
    // première visite d'Astrub : l'annonce
    const a = monde('astrub', { zonesVues: ['incarnam'] });
    expect(a.drainEvents().find(e => e.k === 'emmenage')).toMatchObject({ noms: ['Kerubim Crépin', 'Otomaï', 'Goultard'] });
    expect(a.player.zonesVues).toEqual(['incarnam', 'astrub']);
  });
  it('chaque service ouvre la bonne boutique (4A) : clés chez Goultard, potions chez Otomaï, plats chez Mère Bouillotte', () => {
    expect(BOUTIQUES.goultard.map(a => a.id)).toContain('8143');
    expect(BOUTIQUES.otomai.map(a => a.id)).toEqual(['548']);
    expect(BOUTIQUES.bouillotte.length).toBe(2);
    expect(BOUTIQUES.emp).toBeUndefined();
    for (const [zone, id] of [['bastion', 'kerubim'], ['havresac', 'kerubim_guichet']]) {
      const w = monde(zone, { zonesVues: ['astrub'] }), Q = w.quetes!, k = Q.pnjs.find(p => p.id === id)!;
      w.player.x = k.x + 40; w.player.y = k.y;
      Q.cliquer(id); pas(w, 30);
      expect(Q.dialogue?.reponses[0]).toMatchObject({ a: 'service', service: 'recycler' });
      Q.repondre(0);
      expect(w.drainEvents().find(e => e.k === 'service')).toMatchObject({ service: 'recycler', pnj: id });
    }
  });
  it('touche H : 1,5 s d\'incantation puis entrée ; bouger la coupe (2A)', () => {
    const w = monde('astrub'), p = w.player;
    pas(w, 1, { ...NO_INPUT, havreSac: true });
    expect(w.incantation).not.toBeNull();
    pas(w, 30, { ...NO_INPUT, dest: { x: p.x + 200, y: p.y } });
    expect(w.incantation).toBeNull();
    const x = p.x, y = p.y;
    pas(w, 1, { ...NO_INPUT, havreSac: true });
    const ev = pas(w, 100);
    const cz = ev.find(e => e.k === 'changeZone');
    expect(cz).toMatchObject({ zone: 'havresac', retour: { zone: 'astrub', x, y, point: { name: "Zaap d'Astrub" } } });
  });
  it('un coup reçu coupe l\'incantation ; pas d\'incantation poursuivi par des monstres', () => {
    const w = monde('astrub'), p = w.player;
    pas(w, 1, { ...NO_INPUT, havreSac: true });
    p.hp -= 5;
    const ev = pas(w, 100);
    expect(ev.some(e => e.k === 'incantationStop')).toBe(true);
    expect(ev.some(e => e.k === 'changeZone')).toBe(false);
    const m = w.spawnMonster(Object.keys(GAME_DATA.monsters)[0], p.x + 100, p.y); m.state = 'chase';
    expect(w.havreSac()).toBe(false);
  });
  it('H dans le Havre-Sac : retour exactement là où l\'on était, avec le point de retour d\'avant', () => {
    const a = monde('astrub'), wg = a.worldGrid!, q = wg.cellToWorld(wg.freeByMap.get('7_-24')![30]);
    const retour = { zone: 'astrub', x: q.x, y: q.y, point: { name: 'Zaap de Tainéla', ...wg.cellToWorld(wg.freeByMap.get('1_-32')![40]) } };
    const h = monde('havresac', { retour });
    const cz = pas(h, 1, { ...NO_INPUT, havreSac: true }).find(e => e.k === 'changeZone');
    expect(cz).toMatchObject({ zone: 'astrub', position: { x: q.x, y: q.y }, point: retour.point });
    if (cz?.k !== 'changeZone') return;
    const b = monde('astrub', { position: cz.position, point: cz.point });
    expect([b.player.x, b.player.y]).toEqual([q.x, q.y]);
    expect(b.pointDeRetour).toEqual(retour.point);
  });
  it('les Zaaps touchés rejoignent le Zaap du Havre-Sac (2C), qui y mène', () => {
    const a = monde('astrub'), wg = a.worldGrid!, z = wg.cellToWorld(wg.freeByMap.get('1_-32')![40]);
    a.player.x = z.x; a.player.y = z.y; pas(a, 2);
    expect(a.player.zaaps.map(o => o.name)).toContain('Zaap de Tainéla');
    const h = monde('havresac');
    h.player.zaaps = a.player.zaaps;
    const i = h.player.zaaps.findIndex(o => o.name === 'Zaap de Tainéla');
    const cz = voyage(h, i).find(e => e.k === 'changeZone');
    expect(cz).toMatchObject({ zone: 'astrub', zaap: 'Zaap de Tainéla' });
    const b = monde('astrub', { zaap: 'Zaap de Tainéla' });
    expect(wg.mapAt(b.player.x, b.player.y)?.tag).toBe('1_-32');
    expect(b.checkpointName).toBe('Zaap de Tainéla');
  });
  it('cliquer sur l\'arche ouvre la liste des Zaaps', () => {
    const h = monde('havresac'), wg = h.worldGrid!, a = wg.cellToWorld(wg.cellOf('0_0', GAME_DATA.zones.havresac.open!.havreSac!.arche));
    const ev = pas(h, 240, { ...NO_INPUT, dest: a });
    expect(ev.filter(e => e.k === 'arche')).toHaveLength(1);
  });
  it('le Poutch Ingball encaisse sans tomber (7A)', () => {
    const h = monde('havresac'), m = h.monsters.find(o => o.id === h.poutch)!;
    expect(m.type).toBe('poutch_ingball');
    m.hp = 0; h.killMonster(m);
    expect(m.dead).toBe(false);
    expect(m.hp).toBe(m.maxHp);
  });
  it('sauvegarde : Zaaps découverts, zones visitées, et d\'où l\'on vient quand on est dans le Havre-Sac', () => {
    const retour = { zone: 'astrub', x: 1, y: 2, point: { name: "Zaap d'Astrub", x: 3, y: 4 } };
    const h = monde('havresac', { retour, zonesVues: ['incarnam', 'astrub'] });
    h.player.zaaps = [{ zone: 'astrub', name: "Zaap d'Astrub" }];
    const e = exporterJoueur(h);
    expect(e).toMatchObject({ zone: 'havresac', havreSac: retour, zaaps: [{ name: "Zaap d'Astrub" }], zonesVues: ['incarnam', 'astrub', 'havresac'] });
    const h2 = monde('havresac');
    restaurerJoueur(h2, e);
    expect(h2.retour).toEqual(retour);
    expect(h2.player.zaaps).toEqual(e.zaaps);
  });

});

describe('Bastion des Douze (maquette Ville : 1A 2A 3C 7A+7B 10B)', () => {
  it('une grande carte en archipel (6×6), arrivée marchable, PNJ sur la place', () => {
    expect(BA.maps).toHaveLength(1);
    expect(BA.maps[0].n).toEqual([6, 6]);
    const w = monde('bastion');
    expect(w.dansBastion && w.dansRefuge && !w.dansHavreSac).toBe(true);
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
    expect(w.checkpointName).toBe('Bastion des Douze');
    // chaque PNJ est posé près de sa case (pas renvoyé loin faute de place)
    const B = GAME_DATA.zones.bastion.open!.bastion!, wg = w.worldGrid!;
    for (const p of monde('bastion', { zonesVues: ['astrub'] }).quetes!.pnjs) {
      const c = wg.cellToWorld(wg.cellOf('bastion', B.pnj![p.id]));
      expect(Math.hypot(c.x - p.x, c.y - p.y), p.id).toBeLessThan(60);
    }
  });
  it('le Zaap du Havre-Sac mène au Bastion (7B) en gardant d\'où l\'on vient ; son Zaap y ramène (7A)', () => {
    const retour = { zone: 'astrub', x: 1, y: 2, point: { name: "Zaap d'Astrub", x: 3, y: 4 } };
    const h = monde('havresac', { retour });
    const cz = voyage(h, World.ZAAP_BASTION).find(e => e.k === 'changeZone');
    expect(cz).toMatchObject({ zone: 'bastion', retour });
    const b = monde('bastion', { retour });
    expect(b.retour).toEqual(retour);
    expect(b.sortirHavreSac(World.ZAAP_BASTION)).toBe(false);   // déjà au Bastion
    const cz2 = voyage(b, -1).find(e => e.k === 'changeZone');
    expect(cz2).toMatchObject({ zone: 'astrub', position: { x: 1, y: 2 }, point: retour.point });
    // sauvegarde : d'où l'on vient est gardé au Bastion aussi
    const b2 = monde('bastion');
    restaurerJoueur(b2, exporterJoueur(b));
    expect(b2.retour).toEqual(retour);
  });
  it('cliquer sur le Zaap du Bastion ouvre la liste des Zaaps ; Rappel inutile sur place', () => {
    const b = monde('bastion'), wg = b.worldGrid!, a = wg.cellToWorld(wg.cellOf('bastion', GAME_DATA.zones.bastion.open!.bastion!.zaap));
    const ev = pas(b, 300, { ...NO_INPUT, dest: a });
    expect(ev.filter(e => e.k === 'arche')).toHaveLength(1);
    b.player.resources['548'] = 1;
    expect(b.rappel('548')).toBe(false);
    expect(b.player.resources['548']).toBe(1);
  });
  it('Potion de Rappel depuis le Havre-Sac : au Bastion, avec le retour d\'avant', () => {
    const retour = { zone: 'astrub', x: 1, y: 2, point: { name: "Zaap d'Astrub", x: 3, y: 4 } };
    const h = monde('havresac', { retour }); h.player.resources['548'] = 1; h.drainEvents();
    expect(h.rappel('548')).toBe(true);
    expect(h.drainEvents().find(e => e.k === 'changeZone')).toMatchObject({ zone: 'bastion', retour });
  });
});
