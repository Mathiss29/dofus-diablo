import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';
import { departs, estTransport, famille, reperesJeu, type Repere } from '../src/sim/carte';

/** Repères de la carte M et de la minicarte (retour joueur du 2026-11-15 : au Port de Madrestam, le seul repère disait
 *  « Bateau vers l'île des Wabbits », personne ne trouvait le bateau pour Moon). Garde : chaque repère mène quelque part,
 *  chaque bateau, route et portail a son repère, qui nomme toutes ses destinations. */
const lire = (f: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${f}`, import.meta.url), 'utf8'));
const AS = lire('astrub/monde.json') as WorldData;
const VIDE: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const nomQuete = (id: string) => QUETES.quetes[id]?.nom ?? id;
const MONDES = Object.entries(GAME_DATA.zones).filter(([, z]) => z.open).map(([id, z]) => {
  let plan: { reperes: Repere[] } | null = null;
  try { plan = lire(`${z.open!.world}/plan.json`); } catch { /* monde sans carte M (Havre-Sac, Bastion) */ }
  return { id, open: z.open!, plan };
}).filter(m => m.plan);

describe('repères de la carte : chaque repère mène quelque part', () => {
  it('Port de Madrestam : un seul repère « Bateaux » qui nomme Wabbits, Moon et Frigost', () => {
    const l = reperesJeu(lire('astrub/plan.json').reperes, GAME_DATA.zones.astrub.open, undefined, nomQuete);
    const ici = l.filter(r => r.t === '9_-2' && famille(r) === 'transport');
    expect(ici).toHaveLength(1);
    expect(ici[0].n).toMatch(/^Bateaux vers /);
    for (const n of ['île des Wabbits (500 kamas)', 'île de Moon', 'Frigost (après « Cap sur Frigost »)']) expect(ici[0].n).toContain(n);
    // l'autre bout de chaque bateau dit d'où il vient
    for (const t of ['24_-2', '32_11', '-79_-37']) expect(l.find(r => r.t === t && famille(r) === 'transport')?.n, t).toBe('Bateau vers le Port de Madrestam');
    // les transports officiels qui ne mènent à rien chez nous ont disparu (canon de Moon, bateau de Pandala…)
    for (const t of ['11_10', '10_-5', '12_-3']) expect(l.some(r => r.t === t && famille(r) === 'transport'), t).toBe(false);
  });

  for (const { id, open, plan } of MONDES) it(`${id} : transports, donjons, ateliers et services`, () => {
    const brut = plan!.reperes, l = reperesJeu(brut, open, undefined, nomQuete);
    // toute porte entre deux cartes du dehors (bateau, route, portail) nomme ses deux bouts
    for (const d of open.portes ?? []) if (estTransport(d)) expect(d.lieux, `${d.nom} : lieux`).toHaveLength(2);
    // un seul repère de transport par carte, qui nomme chaque destination qui en part
    const dep = departs(open);
    for (const t of new Set(dep.map(d => d.t))) {
      const rp = l.filter(r => r.t === t && famille(r) === 'transport');
      expect(rp, `repère de transport en ${t}`).toHaveLength(1);
      for (const d of dep.filter(x => x.t === t)) expect(rp[0].n, `${t} → ${d.vers}`).toContain(d.vers);
    }
    // aucun repère de transport sans vrai départ
    for (const r of l) if (famille(r) === 'transport') expect(dep.some(d => d.t === r.t), `${r.n} (${r.t}) ne mène nulle part`).toBe(true);
    // donjons : seulement les nôtres, chacun avec son repère s'il a une entrée dehors
    const donjons = [...(open.donjons ?? []), ...(open.donjonsTest ?? []), ...(open.donjonsV06 ?? [])].map(d => d.nom);
    for (const r of l) if (famille(r) === 'donjon') expect(donjons, `donjon ${r.n} (${r.t})`).toContain(r.n);
    for (const n of donjons) {
      const entree = (open.portes ?? []).find(d => d.nom === n && /^-?\d+_-?\d+$/.test(d.a[0]));
      if (entree) expect(l.some(r => famille(r) === 'donjon' && r.n === n && r.t === entree.a[0]), `repère du donjon ${n}`).toBe(true);
    }
    // ateliers : là où sont nos machines ; services : là où une porte mène quelque part
    const depuis = new Set((open.portes ?? []).map(d => d.a[0]));
    for (const r of l) {
      if (famille(r) === 'atelier') expect((open.ateliers ?? []).some(a => a.cartes.includes(r.t) && a.nom.startsWith(r.n)), `${r.n} (${r.t})`).toBe(true);
      if (famille(r) === 'service') expect(depuis.has(r.t), `${r.n} (${r.t})`).toBe(true);
    }
    // et rien d'autre ne disparaît (Zaaps, lieux, temples)
    for (const r of brut) if (famille(r) === 'zaap' || famille(r) === 'lieu') expect(l).toContain(r);
  });

  it('la minicarte et les lieux à découvrir suivent les mêmes repères (world.reperes)', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, quetes: QUETES, reprise: VIDE, sansGroupes: true });
    const r = w.reperes.find(x => x.t === '9_-2' && famille(x) === 'transport');
    expect(r?.n).toContain('île de Moon');
    expect(w.reperes.some(x => x.n === "Bateau vers l'île des Wabbits")).toBe(false);
  });
});

describe('bateau pour l\'île de Moon', () => {
  it('part du Port de Madrestam pour tous (sans prix ni quête), arrive sur la Plage de la Tortue, et revient', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE, sansGroupes: true });
    const p = w.player, wg = w.worldGrid!, po = w.portes.find(x => x.nom === "Bateau pour l'Île de Moon")!;
    expect(po, 'porte ouverte hors partie de test').toBeDefined();
    expect(po.prix).toBeUndefined();
    expect(po.quete).toBeUndefined();
    const passer = (i: number) => {
      const e = po.ends[i];
      p.x = e.x + 60; p.y = e.y; (w as unknown as { portalLock: unknown }).portalLock = null;
      for (let k = 0; k < 120 && !w.passage; k++) w.step(1 / 60, { ...NO_INPUT, dest: { x: e.x, y: e.y } });
      expect(w.passage, `passage depuis ${e.tag}`).toBeTruthy();
      for (let k = 0; k < 240 && w.passage; k++) w.step(1 / 60, NO_INPUT);
      return wg.mapAt(p.x, p.y)?.tag;
    };
    expect(passer(0)).toBe('32_11');
    expect(w.map.walkable(p.x, p.y)).toBe(true);
    expect(w.nomCarte('32_11')).toBe('Plage de la Tortue');
    expect(passer(1)).toBe('9_-2');
  });
});
