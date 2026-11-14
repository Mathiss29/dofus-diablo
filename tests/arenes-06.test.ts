import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 2, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const DONJONS = ['Clos des Blops', 'Épreuve de Draegnerys', 'Antre de la Reine Nyée', 'Domaine Ancestral', 'Labyrinthe du Dragon Cochon'];

describe('arènes de la 0.6 (maquette « Arènes : 1A 2D 3A 4A+4C 5B 6B+6C 7A 8A+8B 9A+9C 10A+10C 11A »)', () => {
  it('cinq donjons en partie de test : une porte du dehors mène à l’arrivée de l’arène ; cachés en partie publique', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const nom of DONJONS) {
      const dj = w.zone.open!.donjons!.find(d => d.nom === nom), po = w.portes.find(p => p.nom === nom);
      expect(dj, nom).toBeDefined(); expect(po, nom).toBeDefined();
      expect(po!.ends[1].tag).toBe(dj!.arene!.tag);
      expect(w.map.walkable(po!.ends[0].x, po!.ends[0].y), `${nom} : porte`).toBe(true);
      const A = dj!.arene!;
      for (const c of [A.arrivee, A.boss, A.sortie, A.coffre, ...A.entrees]) expect(wg.mov[c], `${nom} : case ${c}`).toBe(1);
    }
    const pub = monde(false);
    if (!pub.player.v06) {
      for (const nom of DONJONS) {
        expect(pub.zone.open!.donjons!.some(d => d.nom === nom), nom).toBe(false);
        expect(pub.portes.some(p => p.nom === nom), nom).toBe(false);
      }
    }
  });

  it('les monstres des vagues et les boss existent, avec leur planche ; les boss ont leur âme officielle', () => {
    const o = GAME_DATA.zones.astrub.open!;
    for (const d of o.donjonsV06 ?? []) {
      for (const m of [...d.vagues!.flatMap(v => v.m), ...d.bossVague!].filter(m => m !== '?')) {   // ? : Salle au trésor (monstres de la sous-zone)
        expect(GAME_DATA.monsters[m], `${d.nom} : ${m}`).toBeDefined();
        expect(LOOKS[GAME_DATA.monsters[m].look ?? m], `${d.nom} : planche de ${m}`).toBeDefined();
      }
      expect(GAME_DATA.monsters[d.bossVague![0]].boss, d.nom).toBe(true);
      expect(GAME_DATA.monsters[d.bossVague![0]].ame, d.nom).toBeTruthy();
    }
    expect((o.donjonsV06 ?? []).filter(d => !d.tresor).map(d => d.nom).sort()).toEqual([...DONJONS].sort());   // + la Salle au trésor (22B)
  });

  it('clés officielles chez Goultard, seulement quand la 0.6 est visible', () => {
    for (const nom of DONJONS) {
      const cle = Object.entries(ITEMS.resources).find(([, r]) => (r as { cle?: string }).cle === nom)?.[0];
      expect(cle, nom).toBeDefined();
      expect(BOUTIQUES.goultard.some(a => a.id === cle && a.v06), nom).toBe(true);
    }
    const id = BOUTIQUES.goultard.find(a => a.v06)!.id;
    const t = monde(true); t.player.kamas = 99999;
    expect(t.acheter('goultard', id)).toBe(true);
    const pub = monde(false); pub.player.kamas = 99999;
    if (!pub.player.v06) expect(pub.acheter('goultard', id)).toBe(false);
  });

  it('dans l’arène, les vagues partent et le Labyrinthe garde ses murs (cases bloquées entre les couloirs)', () => {
    const w = monde(true), wg = w.worldGrid!;
    w.player.level = 100; w.player.recompute();
    expect(w.allerArene('arene_dragon_cochon')).toBe(true);
    expect(w.arene?.d.nom).toBe('Labyrinthe du Dragon Cochon');
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, NO_INPUT);
    expect(w.arene!.vague).toBeGreaterThanOrEqual(1);
    const m = AS.maps.find(x => x.tag === 'arene_dragon_cochon')!, s = AS.movCartes!['arene_dragon_cochon'];
    const libres = [...s].filter(c => c === '1').length;
    expect(libres).toBeGreaterThan(600);
    expect(libres).toBeLessThan(s.length * 0.6);   // murs, piliers et noir autour du dédale
    expect(m.v06).toBe(1);
    expect(wg.mapByTag('arene_dragon_cochon')).toBeDefined();
  });
});

describe('mécaniques des arènes de la 0.6 (2D, 4C, 6B+6C, 8A+8B, 10A)', () => {
  const entrer = (tag: string) => {
    const w = monde(true); w.player.level = 100; w.player.recompute();
    expect(w.allerArene(tag)).toBe(true);
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, NO_INPUT);
    return w;
  };
  const pas = (w: World, s: number) => { for (let i = 0; i < 60 * s; i++) w.step(1 / 60, NO_INPUT); };

  it('2D : au Clos des Blops, rien ne part avant le choix ; le cercle choisit les vagues et le boss du Royal', () => {
    const w = entrer('arene_blops'), a = w.arene!;
    expect(a.choix?.map(c => c.nom)).toEqual(['Blop Coco Royal', 'Blop Indigo Royal', 'Blop Reinette Royal', 'Blop Griotte Royal', 'Les 4 Royaux']);
    pas(w, 5);
    expect(a.vague).toBe(0);
    const c = a.choix![1]; w.player.x = c.x; w.player.y = c.y;
    pas(w, 3);
    expect(a.variante).toBe(1);
    expect(a.choix).toBeNull();
    expect(a.vague).toBeGreaterThanOrEqual(1);
    expect(a.bossVague[0]).toBe('blop_indigo_royal');
    expect(a.bossCoffre).toEqual(['blop_indigo_royal']);
    expect(new Set(a.vagues.flatMap(v => v.m))).toEqual(new Set(['blop_indigo', 'gloutoblop', 'blopignon', 'tronkoblop']));
    expect(w.player.cleDonjon?.choix).toBe(1);
    // « Les 4 Royaux » : le coffre tire le butin des quatre
    a.variante = 4;
    expect(a.bossCoffre.length).toBe(4);
    expect(w.tirerCoffreDonjon(a.d)).not.toBeNull();
  });

  it('6B+6C : les toiles de la Reine Nyée ralentissent, le feu les brûle 15 s ; pendant le boss elle en tisse sous les joueurs', () => {
    const w = entrer('arene_nyee'), a = w.arene!, p = w.player;
    pas(w, 2);
    expect(a.demarre).toBe(true);
    const t = a.toiles.find(x => w.map.walkable(x.x, x.y))!;
    expect(t).toBeDefined();
    p.x = t.x; p.y = t.y; p.slowT = 0;
    w.step(1 / 60, NO_INPUT);
    expect(p.slowT).toBeGreaterThan(0);
    w.hitCircle(t.x, t.y, 40, { dmg: 1, knock: 0, element: 'feu' });
    expect(t.brule).toBe(15);
    a.boss = w.spawnMonster('reine_nyee', a.pts.boss.x, a.pts.boss.y); a.boss.arene = true;
    pas(w, 5);
    expect(a.tisse.length + a.toiles.filter(x => x.vie != null).length).toBeGreaterThan(0);
  });

  it('4C : pendant le boss, un œuf de Draegnerys touché éclot et libère un Dragœuf', () => {
    const w = entrer('arene_draegnerys'), a = w.arene!;
    pas(w, 2);
    expect(a.oeufs.length).toBe(4);
    const o = a.oeufs[0], n = a.arrivees.length;
    w.hitCircle(o.x, o.y, 30, { dmg: 1, knock: 0 });
    expect(o.eclos).toBe(false);   // pas avant le boss
    a.boss = w.spawnMonster('draegnerys', a.pts.boss.x, a.pts.boss.y); a.boss.arene = true;
    w.hitCircle(o.x, o.y, 30, { dmg: 1, knock: 0 });
    expect(o.eclos).toBe(true);
    expect(a.arrivees.length).toBe(n + 1);
    expect(a.arrivees.at(-1)!.type).toMatch(/^dragoeuf_/);
  });

  it('8A+8B : l’Abraknyde Ancestral reste sur l’estrade et fait sortir des racines qui enracinent', () => {
    const w = entrer('arene_ancestral'), a = w.arene!, p = w.player;
    pas(w, 1);
    expect(a.d.fixe).toBe(true);
    a.boss = w.spawnMonster('abraknyde_ancestral', a.pts.boss.x, a.pts.boss.y); a.boss.arene = true; a.boss.fixe = true;
    const x0 = a.boss.x, y0 = a.boss.y;
    p.invuln = 99;
    for (let i = 0; i < 60 * 6 && !a.racines.length; i++) w.step(1 / 60, NO_INPUT);
    expect(a.racines.length).toBeGreaterThan(0);
    p.slowT = 0;
    pas(w, 1.2);
    expect(p.slowK).toBeGreaterThan(0.5);
    expect(Math.hypot(a.boss.x - x0, a.boss.y - y0)).toBeLessThan(5);
  });

  it('10A : le dédale du Labyrinthe est tiré à l’entrée ; ses murs bloquent leurs cases, ceux des autres dédales non', () => {
    const vus = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
        reprise: VIDE, sansGroupes: true, test: {} as never });
      w.player.level = 100; w.player.recompute();
      expect(w.allerArene('arene_dragon_cochon')).toBe(true);
      pas(w, 1);
      const a = w.arene!, M = a.d.arene!.murs!, wg = w.worldGrid!;
      expect(M.length).toBe(8);
      expect(a.dedale).toBeGreaterThanOrEqual(0);
      vus.add(a.dedale);
      for (const c of M[a.dedale]) expect(wg.mov[c]).toBe(0);
      const autres = M.flatMap((l, k) => k === a.dedale ? [] : l).filter(c => !M[a.dedale].includes(c));
      expect(autres.some(c => wg.mov[c] === 1)).toBe(true);
      // le boss au centre reste atteignable depuis l'arrivée
      expect(wg.findPath(a.pts.arrivee, a.pts.boss, 20000).length).toBeGreaterThan(0);
    }
    expect(vus.size).toBeGreaterThan(1);
    const libres = [...AS.movCartes!['arene_dragon_cochon']].filter(c => c === '1').length;
    expect(libres).toBeGreaterThan(600);
  });
});
