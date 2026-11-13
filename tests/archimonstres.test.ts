import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { ARCHI, World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';
import { NO_INPUT } from '../src/sim/input';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, seed = 2) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });
const M = GAME_DATA.monsters;

describe('archimonstres d\'Astrub (version 0.3 : 15B)', () => {
  it('les archimonstres officiels : dessin et sons de leur monstre, plus forts, butin officiel', () => {
    const l = Object.entries(M).filter(([, d]) => d.archiDe);
    expect(l.length).toBeGreaterThanOrEqual(28);
    for (const [k, d] of l) {
      const b = M[d.archiDe!];
      expect(b, k).toBeDefined();
      expect(LOOKS[k]?.atlas, k).toBe(LOOKS[b.look].atlas);
      expect(d.hp).toBeGreaterThan(b.hp);
      expect(d.xp!).toBeGreaterThan(b.xp ?? 0);
      expect(ITEMS.drops[k]?.length, k).toBeGreaterThan(0);
    }
    expect(M.archi_tofu_malade.name).toBe('Tofurapin le Pétri');
  });

  it('parfois un archimonstre prend la place d\'un monstre de groupe (aussi hors partie de test depuis la sortie de la 0.3)', () => {
    const avant = ARCHI.chance;
    try {
      ARCHI.chance = 1;
      const w = monde(), v = monde(false);
      expect(w.monsters.some(m => m.def.archiDe)).toBe(true);
      expect(v.monsters.some(m => m.def.archiDe)).toBe(true);
      // un seul de chaque sorte en vie à la fois
      const n: Record<string, number> = {};
      for (const m of w.monsters) if (m.def.archiDe && !m.dead) n[m.type] = (n[m.type] ?? 0) + 1;
      expect(Math.max(...Object.values(n))).toBe(1);
    } finally { ARCHI.chance = avant; }
  });

  it('Petite pierre d\'âme chez Otomaï (0.3) ; un archimonstre vaincu avec elle est capturé', () => {
    const w = monde(), p = w.player;
    p.kamas = 1000;
    expect(w.acheter('otomai', ARCHI.pierre)).toBe(true);
    expect(monde(false).acheter('otomai', ARCHI.pierre)).toBe(false);
    const m = w.spawnMonster('archi_bouftou', p.x + 40, p.y);
    w.killMonster(m);
    expect(p.resources[ARCHI.pierre]).toBeUndefined();
    expect(p.resources[ARCHI.pleine]).toBeUndefined();
    expect(p.resources['33834']).toBe(1);   // « Archis : » 6A : son âme officielle, « Âme capturée : Boufdégou le Refoulant »
    expect(p.ames).toEqual(['archi_bouftou']);
    expect(w.drainEvents().find(e => e.k === 'capture')).toMatchObject({ monster: 'archi_bouftou', neuf: true, ame: '33834' });
    // sans pierre : pas de capture
    w.killMonster(w.spawnMonster('archi_boufton', p.x + 40, p.y));
    expect(p.ames).toHaveLength(1);
    const v = monde(); restaurerJoueur(v, exporterJoueur(w));
    expect(v.player.ames).toEqual(['archi_bouftou']);
  });

  it('« Archis : » 6A : une âme officielle par archimonstre (« Âme capturée : <nom> »), jamais mangée par un familier', () => {
    const l = Object.entries(M).filter(([, d]) => d.archiDe);
    expect(l.length).toBe(140);
    for (const [k, d] of l) {
      const r = ITEMS.resources[d.ame!];
      expect(r, k).toBeDefined();
      expect(r.ame).toBe(k);
      expect(r.name).toBe(`Âme capturée : ${d.name}`);
    }
  });

  it('« Archis : » 5E : en groupe, chaque joueur proche qui a une pierre capture sa propre âme', () => {
    const w = monde(), p = w.player, q = w.ajouterJoueur('cra');
    q.v03 = true; q.x = p.x + 30; q.y = p.y;
    p.resources[ARCHI.pierre] = 1; q.resources[ARCHI.pierre] = 2;
    w.killMonster(w.spawnMonster('archi_bouftou', p.x + 40, p.y));
    expect(p.ames).toEqual(['archi_bouftou']); expect(q.ames).toEqual(['archi_bouftou']);
    expect(p.resources['33834']).toBe(1); expect(q.resources['33834']).toBe(1); expect(q.resources[ARCHI.pierre]).toBe(1);
  });

  it('« Archis : » 4B : un archimonstre lâche toujours au moins un objet Rare ; 5B : les élites lâchent parfois une pierre', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const w = monde(true, seed), p = w.player;
      w.killMonster(w.spawnMonster('archi_bouftou', p.x + 40, p.y));
      expect(w.drops.some(d => d.item && d.item.rarity !== 'commun'), `graine ${seed}`).toBe(true);
    }
    const avant = ARCHI.pierreElite;
    try {
      ARCHI.pierreElite = 1;
      const w = monde(), p = w.player, el = Object.keys(M).find(k => M[k].elite && !M[k].archiDe && !M[k].boss)!;
      w.killMonster(w.spawnMonster(el, p.x + 40, p.y));
      expect(p.resources[ARCHI.pierre]).toBe(1);
    } finally { ARCHI.pierreElite = avant; }
  });

  it('« Archis : » 8C : succès aux paliers 10, 25, 50 et 110 âmes, avec un titre officiel', () => {
    const w = monde(), p = w.player, Q = w.quetes!;
    for (const n of [10, 25, 50, 110]) expect(QUETES.succes[`archis_${n}`].recompense?.titre).toBeTruthy();
    p.ames = Object.keys(M).filter(k => M[k].archiDe).slice(0, 10);
    expect(Q.progres(QUETES.succes.archis_25.objectifs[0])).toEqual([10, 25]);
    w.step(1 / 60, NO_INPUT);
    expect(Q.succes.has('archis_10')).toBe(true);
    expect(Q.succes.has('archis_25')).toBe(false);
  });
});
