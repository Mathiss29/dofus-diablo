import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World, type WorldOptions } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';
import THEMES from '../src/data/havresac_themes.json';
import { poidsCouches } from '../src/render/sonView';

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
    expect(ids(monde('bastion'))).toEqual(['bouillotte', 'crieur', 'forgemage', 'garde_bonta', 'garde_brakmar', 'garde_frigost', 'garde_pandala', 'garde_zaap1', 'garde_zaap2', 'gawdien', 'responsable', 'tissebelle']);
    expect(ids(monde('bastion', { zonesVues: ['incarnam', 'astrub'] }))).toEqual(['assistante_otomai', 'bouillotte', 'crieur', 'forgemage', 'garde_bonta', 'garde_brakmar', 'garde_frigost', 'garde_pandala', 'garde_zaap1', 'garde_zaap2', 'gawdien', 'goultard', 'kerubim', 'otomai', 'responsable', 'tissebelle']);
    // Magasin 8A : plus de guichet de Kerubim au Havre-Sac (on défait seulement au Bastion)
    expect(ids(monde('havresac', { zonesVues: ['astrub'] }))).toEqual([]);
    // chacun sur sa case, tous à part
    const w = monde('bastion', { zonesVues: ['astrub'] }), l = w.quetes!.pnjs;
    for (const a of l) for (const b of l) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(60);
    // première visite d'Astrub : l'annonce
    const a = monde('astrub', { zonesVues: ['incarnam'] });
    expect(a.drainEvents().find(e => e.k === 'emmenage')).toMatchObject({ noms: ['Kerubim Crépin', 'Otomaï', 'Goultard', 'Assistante d\'Otomaï'] });
    expect(a.player.zonesVues).toEqual(['incarnam', 'astrub']);
  });
  it('chaque service ouvre la bonne boutique (4A) : clés chez Goultard, potions chez Otomaï, plats chez Mère Bouillotte', () => {
    expect(BOUTIQUES.goultard.map(a => a.id)).toContain('8143');
    expect(BOUTIQUES.otomai.filter(a => !a.v03).map(a => a.id)).toEqual(['548', '1634', '1463']);   // + Petite pierre d'âme en 0.3 (tests/archimonstres.test.ts)
    expect(BOUTIQUES.bouillotte.length).toBe(2);
    expect(BOUTIQUES.emp).toBeUndefined();
    for (const [zone, id] of [['bastion', 'kerubim']]) {
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
  it('une grande carte en archipel (8×8, îles des nations en grand), arrivée marchable, PNJ sur la place', () => {
    expect(BA.maps.map(m => m.tag)).toEqual(['bastion', 'marche', 'arene']);   // l'archipel, la salle du Marché couvert et l'arène des âmes
    expect(BA.maps[0].n).toEqual([8, 8]);
    const w = monde('bastion');
    expect(w.dansBastion && w.dansRefuge && !w.dansHavreSac).toBe(true);
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
    expect(w.checkpointName).toBe('Bastion des Douze');
    // chaque PNJ est posé près de sa case (pas renvoyé loin faute de place)
    const B = GAME_DATA.zones.bastion.open!.bastion!, wg = w.worldGrid!;
    for (const p of monde('bastion', { zonesVues: ['astrub'] }).quetes!.pnjs) {
      const c = wg.cellToWorld(wg.cellOf(QUETES.pnj[p.id].carte, B.pnj![p.id]));
      expect(Math.hypot(c.x - p.x, c.y - p.y), p.id).toBeLessThan(60);
    }
  });
  it('Marché couvert (Magasin : 1A, 13A-13F) : les marchands vendent dedans, Kerubim attend à la porte, on entre et on ressort', () => {
    const w = monde('bastion', { zonesVues: ['astrub'] }), wg = w.worldGrid!;
    for (const id of ['otomai', 'bouillotte', 'goultard', 'tissebelle']) expect(QUETES.pnj[id].carte, id).toBe('marche');
    const ici = (id: string) => wg.mapAt(w.quetes!.pnjs.find(p => p.id === id)!.x, w.quetes!.pnjs.find(p => p.id === id)!.y)?.tag;
    expect(['otomai', 'bouillotte', 'goultard', 'tissebelle'].map(ici)).toEqual(['marche', 'marche', 'marche', 'marche']);
    expect(ici('kerubim')).toBe('bastion');
    const po = w.portes.find(p => p.nom === 'Marché couvert')!;
    expect(po.ends.map(e => e.tag)).toEqual(['bastion', 'marche']);
    // Kerubim est juste à côté de la porte du dehors
    const k = w.quetes!.pnjs.find(p => p.id === 'kerubim')!;
    expect(Math.hypot(k.x - po.ends[0].x, k.y - po.ends[0].y)).toBeLessThan(250);
    // dedans, l'endroit porte le nom de la porte
    expect(w.lieux.get('marche')).toBe('Marché couvert');
    w.player.x = po.ends[1].x; w.player.y = po.ends[1].y + 120; w.drainEvents(); w.step(1 / 60, NO_INPUT);
    expect(w.lieu).toBe('Marché couvert');
    expect(w.porteSous(po.ends[1].x, po.ends[1].y - 10)?.sortie).toBe(true);
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
    // survol et clic (maquette « Zaap : » 1A) : le dessin du Zaap du Bastion est le point visé
    expect(b.zaapRefuge()).toMatchObject({ name: 'Zaap du Bastion', x: a.x, y: a.y });
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
  it('la ville vit (Ville 5F) : des habitants officiels flânent sur l\'île, le Héraut crie les nouvelles', () => {
    const w = monde('bastion'), P = w.passants!;
    expect(P.liste.map(p => p.def.nom)).toContain('Paysan Bontarien');
    expect(P.liste.length).toBe(7);
    const depart = P.liste.map(p => [p.x, p.y]);
    const ev = pas(w, 60 * 20);
    // ils marchent (et restent sur des cases marchables), sans toucher à la partie
    expect(P.liste.filter((p, i) => Math.hypot(p.x - depart[i][0], p.y - depart[i][1]) > 100).length).toBeGreaterThan(3);
    for (const p of P.liste) expect(w.walkable(p.x, p.y), p.def.nom).toBe(true);
    // le crieur (le joueur est sur la place) : une bulle toutes les 14 s, à tour de rôle
    const cris = ev.filter(e => e.k === 'bulle' && e.pnj === 'crieur');
    expect(cris.length).toBeGreaterThanOrEqual(1);
    expect(QUETES.pnj.crieur.cris).toContain((cris[0] as { texte: string }).texte);
    // ailleurs, pas d'habitants
    expect(monde('havresac').passants).toBeNull();
  });
  it('musique du Bastion : la couche de chaque nation monte près de son île, Astrub au centre', () => {
    const iles = [{ n: 'bonta', x: 0, y: -1000 }, { n: 'brakmar', x: 1500, y: 0 }];
    expect(poidsCouches(iles, { x: 0, y: 0 })).toEqual({ bonta: 0, brakmar: 0, astrub: 1 });
    const pres = poidsCouches(iles, { x: 0, y: -900 });
    expect(pres.bonta).toBe(1); expect(pres.astrub).toBe(0);
    const B = GAME_DATA.zones.bastion.open!.bastion!;
    expect(Object.keys(B.iles!).sort()).toEqual(['bonta', 'brakmar', 'frigost', 'pandala']);
  });
});
