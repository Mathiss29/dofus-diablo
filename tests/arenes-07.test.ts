import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { A07, COULEURS_BLOP, apparu07, facteurCouleur } from '../src/sim/arene07';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const DONJONS = ['Caverne du Koulosse', 'Bibliothèque du Maître Corbac', 'Goulet du Rasboul', 'Bambusaie de Damadrya', 'Repaire de Skeunk',
  'Antre du Blop Multicolore Royal', 'Serre du Royalmouth'];
const pas = (w: World, s: number) => { for (let i = 0; i < 60 * s; i++) w.step(1 / 60, NO_INPUT); };
const entrer = (tag: string) => {
  const w = monde(true); w.player.level = 120; w.player.recompute();
  expect(w.allerArene(tag)).toBe(true);
  pas(w, 2);
  return w;
};

describe('donjons de la 0.7 (ligne « 0.7 : » 4A-4G)', () => {
  it('sept donjons en partie de test : une porte du dehors mène à l’arrivée ; cachés en partie publique', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const nom of DONJONS) {
      const dj = w.zone.open!.donjons!.find(d => d.nom === nom), po = w.portes.find(p => p.nom === nom);
      expect(dj, nom).toBeDefined(); expect(po, nom).toBeDefined();
      expect(po!.ends[1].tag).toBe(dj!.arene!.tag);
      expect(w.map.walkable(po!.ends[0].x, po!.ends[0].y), `${nom} : porte`).toBe(true);
      for (const A of [dj!.arene!, ...(dj!.etages ?? [])])
        for (const c of [A.arrivee, A.boss, A.sortie, A.coffre, ...A.entrees]) expect(wg.mov[c], `${nom} ${A.tag} : case ${c}`).toBe(1);
    }
    const pub = monde(false);
    if (!pub.player.v07) for (const nom of DONJONS) {
      expect(pub.zone.open!.donjons!.some(d => d.nom === nom), nom).toBe(false);
      expect(pub.portes.some(p => p.nom === nom), nom).toBe(false);
    }
  });

  it('monstres des vagues et boss existent avec leur planche ; les boss ont leur âme ; clés chez Goultard (0.7 visible)', () => {
    const o = GAME_DATA.zones.astrub.open!;
    expect((o.donjonsV07 ?? []).map(d => d.nom).sort()).toEqual([...DONJONS].sort());
    for (const d of o.donjonsV07 ?? []) {
      for (const m of [...d.vagues!.flatMap(v => v.m), ...d.bossVague!]) {
        expect(GAME_DATA.monsters[m], `${d.nom} : ${m}`).toBeDefined();
        expect(LOOKS[GAME_DATA.monsters[m].look ?? m], `${d.nom} : planche de ${m}`).toBeDefined();
      }
      expect(GAME_DATA.monsters[d.bossVague![0]].boss, d.nom).toBe(true);
      expect(GAME_DATA.monsters[d.bossVague![0]].ame, d.nom).toBeTruthy();
      const cle = Object.entries(ITEMS.resources).find(([, r]) => (r as { cle?: string }).cle === d.nom)?.[0];
      expect(BOUTIQUES.goultard.some(a => a.id === cle && a.v07), d.nom).toBe(true);
    }
    const id = BOUTIQUES.goultard.find(a => a.v07)!.id;
    const pub = monde(false); pub.player.kamas = 99999;
    if (!pub.player.v07) expect(pub.acheter('goultard', id)).toBe(false);
    const t = monde(true); t.player.kamas = 99999;
    expect(t.acheter('goultard', id)).toBe(true);
  });
});

describe('mécaniques des boss de la 0.7 (5A-5D)', () => {
  it('5A : Koulosse en trois étages, on descend quand l’étage est vidé ; le boss est au fond', () => {
    const w = entrer('arene_koulosse_1'), a = w.arene!;
    expect(a.d.etages?.length).toBe(2);
    pas(w, 3);
    expect(a.vague).toBe(1);
    for (let s = 0; s < 40; s++) { w.player.hp = w.player.maxHp; pas(w, 1); }
    expect(a.vague).toBe(1);   // pas de vague suivante tant que l'étage n'est pas vidé (ni au bout du délai)
    const vider = () => { for (const m of w.monsters) if (m.arene && !m.dead) w.killMonster(m); a.arrivees = []; };
    vider(); pas(w, 1);
    expect(a.etage).toBe(1);
    expect(a.tagC).toBe('arene_koulosse_2');
    expect(w.worldGrid!.mapAt(w.player.x, w.player.y)?.tag).toBe('arene_koulosse_2');
    expect(a.vague).toBe(2);
    vider(); w.player.hp = w.player.maxHp; pas(w, 1);
    expect(a.tagC).toBe('arene_koulosse_3');
    expect(a.vague).toBe(3);
    expect(w.arene).toBe(a);   // l'arène tient d'un étage à l'autre
  });

  it('5B : fermer les trois grimoires du Corbac l’étourdit 4 s', () => {
    const w = entrer('arene_corbac'), a = w.arene!;
    a.boss = w.spawnMonster('maitre_corbac', a.pts.boss.x, a.pts.boss.y); a.boss.arene = true;
    apparu07(a, a.boss);
    expect(a.grimoires.length).toBe(3);
    pas(w, 5);
    expect(a.sorts07.length + a.grimoires.filter(g => g.t > A07.grimoire.premier).length).toBeGreaterThan(0);
    for (const g of a.grimoires) w.hitCircle(g.x, g.y, 30, { dmg: 1, knock: 0 });
    expect(a.grimoires.every(g => !g.ouvert)).toBe(true);
    expect(a.boss.stun).toBeGreaterThanOrEqual(A07.grimoire.etourdi - 0.1);
  });

  it('5C : le Blop Multicolore Royal ne craint que l’élément de sa couleur, qui change toutes les 15 s', () => {
    const w = entrer('arene_blop_multicolore'), a = w.arene!;
    const b = a.boss = w.spawnMonster('blop_multicolore_royal', a.pts.boss.x, a.pts.boss.y); b.arene = true; b.state = 'chase';
    apparu07(a, b);
    const c0 = a.couleur, el = COULEURS_BLOP[c0].el;
    expect(b.seulElement).toBe(el);
    expect(facteurCouleur(b, el)).toBe(1);
    expect(facteurCouleur(b, el === 'feu' ? 'eau' : 'feu')).toBe(A07.blop.autre);
    for (let s = 0; s < 18; s++) { w.player.hp = w.player.maxHp; pas(w, 1); }
    expect(a.couleur).not.toBe(c0);
  });

  it('5D : Skeunk vole une charge de potion et fuit ; le toucher la rend et ouvre une fenêtre de dégâts', () => {
    const w = entrer('arene_skeunk'), a = w.arene!, p = w.player;
    const b = a.boss = w.spawnMonster('skeunk', a.pts.boss.x, a.pts.boss.y); b.arene = true; b.state = 'chase';
    p.x = b.x + 40; p.y = b.y + 20; p.potions = 3;
    a.tVol = 0.1; pas(w, 0.3);
    expect(a.vol?.id).toBe(p.id);
    expect(p.potions).toBe(2);
    w.hitCircle(b.x, b.y, 60, { dmg: 1, knock: 0 });
    expect(a.vol).toBeNull();
    expect(p.potions).toBe(3);
    expect(b.subis).toBe(A07.skeunk.fenetre);
  });
});
