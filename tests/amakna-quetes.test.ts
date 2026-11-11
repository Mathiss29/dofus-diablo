import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, reprise: vide, aujourdhui: '2026-11-10', ...(test ? { test: {} as never } : {}) });
const AMAKNA = QUETES.pnj.garde_chateau2.contrats as number[];

describe('quêtes d’Amakna (« 0.4 suite : 11A + 11B »)', () => {
  it('11A : le Bailli donne le fil rouge Village → Château → Bworks → Craqueleur Légendaire, ouvert à tous depuis la 0.4', () => {
    const w = monde(true), Q = w.quetes!; w.player.level = 30;
    expect(Q.aDonner('bailli')).toBe('amk_1');
    const fil = ['amk_1', 'amk_2', 'amk_3', 'amk_4'].map(id => Q.def(id));
    expect(fil.map(q => q.suivante)).toEqual(['amk_2', 'amk_3', 'amk_4', undefined]);
    const donjons = ['amk_3', 'amk_4'].flatMap(id => Q.etapes(id).flatMap(e => e.objectifs)).filter(o => o.t === 'donjon').map(o => o.t === 'donjon' ? o.donjon : '');
    for (const d of donjons) expect(w.zone.open!.donjons!.some(x => x.nom === d), d).toBe(true);
    expect(monde(false).quetes!.pnj('bailli')).toBeDefined();   // 0.4 publique (2026-11-11)
  });
  it('11A : la défense du Château fait venir des Bworks (la carte n’a pas de monstres à elle)', () => {
    const w = monde(true), Q = w.quetes!, p = w.player; p.level = 35;
    Q.reprendre({ ...vide, finies: ['amk_1'], enCours: [{ id: 'amk_2', etape: 0, compte: [0] } as never] });
    const q = w.worldGrid!.cellToWorld(w.worldGrid!.freeByMap.get('4_-6')![200]); p.x = q.x; p.y = q.y;
    for (let i = 0; i < 60; i++) w.step(1 / 30, NO_INPUT);
    const venus = w.monsters.filter(m => !m.dead && w.worldGrid!.mapAt(m.x, m.y)?.tag === '4_-6').map(m => m.type);
    expect(venus.length).toBeGreaterThan(0);
    expect(venus.every(t => t.startsWith('bwork'))).toBe(true);
  });
  it('11B : la Milice d’Amakna a son tableau de contrats d’Amakna, celle d’Astrub garde les siens', () => {
    const w = monde(true), Q = w.quetes!; w.player.level = 35;
    const amk = Q.contrats('garde_chateau2'), ast = Q.contrats('geolier');
    expect(amk).toHaveLength(4); expect(ast).toHaveLength(4);
    for (const id of amk) { expect(AMAKNA).toContain(+id.split(':')[3]); expect(Q.def(id).rendre).toBe('garde_chateau2'); }
    for (const id of ast) { expect(AMAKNA).not.toContain(+id.split(':')[3]); expect(Q.def(id).rendre).toBe('geolier'); }
    // titres officiels pour chaque sous-zone d'Amakna à monstres
    for (const s of AMAKNA) if (w.zone.open!.subareas[s]?.monsters.length) expect(QUETES.contrats!.titres[s]?.length, String(s)).toBeGreaterThan(0);
    // le tableau d'Amakna est gardé avec le perso
    const e = Q.exporter();
    expect(e.tableaux?.garde_chateau2?.ids).toHaveLength(3);
    // 0.4 publique : la garde du Château a aussi son tableau hors partie de test
    const pub = monde(false); pub.player.level = 35;
    expect(pub.quetes!.contrats('garde_chateau2')).toHaveLength(4);
  });
});
