import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARENE_AMES, cleFile, semaineDe } from '../src/sim/areneAmes';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const BA = JSON.parse(readFileSync(new URL('../public/assets/mondes/bastion/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const LUNDI = Date.UTC(2026, 10, 16, 12);
const monde = (horloge = () => LUNDI) => new World({ data: GAME_DATA, zone: 'bastion', map: new WorldGrid(BA), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE, horloge });
const M = GAME_DATA.monsters;
const pas = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(1 / 60, NO_INPUT); };
/** Met le joueur devant la Gardienne, au Marché couvert. */
function auMarche(w: World) {
  const g = QUETES.pnj.gardienne_arene, wg = w.worldGrid!, c = wg.cellToWorld(wg.cellOf('marche', g.case!));
  w.player.x = c.x; w.player.y = c.y + 40;
}
const tuerVague = (w: World) => { for (const m of [...w.combatAmes!.vivants]) w.killMonster(m); };

describe('Arène des âmes (« Arène : » du 15 novembre 2026)', () => {
  it('1A 2A : la Gardienne et le Gardien de l\'arène sont au Marché couvert, avec le service d\'invocation', () => {
    for (const k of ['gardienne_arene', 'gardien_arene']) {
      const d = QUETES.pnj[k];
      expect(d.zone).toBe('bastion');
      expect(d.services?.some((s: { service?: string }) => s.service === 'arene')).toBe(true);
    }
    expect(QUETES.pnj.gardienne_arene.dofusId).toBe(1436);
    expect(QUETES.pnj.gardien_arene.dofusId).toBe(1435);
  });

  it('3A-5A 9A : on invoque depuis le Marché, le groupe passe dans l\'arène, une vague par âme, puis retour devant la Gardienne', () => {
    const w = monde(), p = w.player, ames = w.toutesAmes();
    const boss = ames.find(a => a.boss)!, archi = ames.find(a => !a.boss)!;
    expect(ames.length).toBeGreaterThan(20);
    p.resources[boss.id] = 1; p.resources[archi.id] = 1;
    expect(w.invoquerAmes([boss.id])).toBe(false);   // sur la place : refusé
    auMarche(w);
    expect(w.pretPourArene()).toBe(true);
    expect(w.invoquerAmes(Array(ARENE_AMES.max + 1).fill(boss.id))).toBe(false);
    expect(w.invoquerAmes([boss.id, archi.id])).toBe(true);
    expect(p.resources[boss.id]).toBeUndefined();
    pas(w, 5);
    expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('arene');
    const c = w.combatAmes!;
    expect(c.i).toBe(0);
    expect(c.vivants.map(m => m.type)).toEqual([boss.type]);
    tuerVague(w); pas(w, ARENE_AMES.pause + 0.5);
    expect(c.i).toBe(1);
    expect(c.vivants.filter(m => m.type === archi.type).length).toBe(1);
    expect(c.vivants.length).toBeGreaterThanOrEqual(4);   // 5A : l'archi et 3 à 5 monstres de sa famille
    expect(c.vivants.every(m => m.arene && m.relache)).toBe(true);
    tuerVague(w); pas(w, ARENE_AMES.pause + 0.5);
    expect(c.victoire).toBe(true);
    expect(p.areneAmes.n).toBe(2);
    expect(p.areneAmes.v[boss.type]).toBe(1);
    expect(p.areneAmes.rec[cleFile([boss.type, archi.type])]).toBeGreaterThan(0);
    expect(p.areneAmes.sem).toBe(semaineDe(LUNDI));
    pas(w, ARENE_AMES.retour + 3);
    expect(w.combatAmes).toBeNull();
    expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('marche');
  });

  it('9B : « Encore ! » relance la même file si le lanceur a encore les âmes', () => {
    const w = monde(), p = w.player, boss = w.toutesAmes().find(a => a.boss)!;
    auMarche(w);
    p.resources[boss.id] = 2;
    w.invoquerAmes([boss.id]); pas(w, 5);
    tuerVague(w); pas(w, ARENE_AMES.pause + 0.5);
    expect(w.combatAmes!.encorePossible(p)).toBe(true);
    expect(w.encoreAmes()).toBe(true);
    expect(p.resources[boss.id]).toBeUndefined();
    pas(w, 2);
    expect(w.combatAmes!.vivants.length).toBe(1);
    tuerVague(w); pas(w, ARENE_AMES.pause + 0.5);
    expect(w.encoreAmes()).toBe(false);
  });

  it('9A : mort de tout le groupe = échec, retour au Marché', () => {
    const w = monde(), p = w.player, boss = w.toutesAmes().find(a => a.boss)!;
    auMarche(w); p.resources[boss.id] = 1;
    w.invoquerAmes([boss.id]); pas(w, 5);
    const ev: string[] = [];
    p.hp = 0; p.dead = true;
    w.step(1 / 60, NO_INPUT);
    ev.push(...w.drainEvents().map(e => e.k));
    expect(ev).toContain('areneAmesFin');
    pas(w, 1);
    expect(w.combatAmes).toBeNull();
  });

  it('12A 14A : défi tiré au hasard, raté au premier écart ; une âme corrompue a 2 affixes', () => {
    const w = monde(), p = w.player, boss = w.toutesAmes().find(a => a.boss)!;
    auMarche(w); p.resources[boss.id] = 1;
    w.invoquerAmes([boss.id]);
    const c = w.combatAmes!;
    expect(Object.keys(ARENE_AMES.defis)).toContain(c.defi);
    expect(c.texteDefi()).not.toContain('{s}');
    (c.file[0] as { corrompue: boolean }).corrompue = true;
    pas(w, 5);
    const m = c.vivants[0];
    expect(m.corrompu).toBe(true);
    if (c.defi === 'intact') { p.hp = 1; pas(w, 0.1); expect(c.rate).toBe(true); }
  });

  it('16A : une âme de boss offerte chaque semaine, la même pour tous, une seule fois', () => {
    let t = LUNDI;
    const w = monde(() => t), p = w.player;
    auMarche(w);
    const a = w.ameDeLaSemaine()!;
    expect(a.boss).toBe(true);
    expect(monde(() => t).ameDeLaSemaine()!.id).toBe(a.id);
    expect(w.prendreAmeDeLaSemaine()).toBe(true);
    expect(p.resources[a.id]).toBe(1);
    expect(w.prendreAmeDeLaSemaine()).toBe(false);
    t += 7 * 86400e3;
    expect(w.ameDeLaSemaineDispo()).toBe(true);
  });

  it('15B : titres de l\'arène aux paliers 25 / 100 / 250', () => {
    for (const n of ARENE_AMES.titres) {
      const s = Object.values(QUETES.succes).find(x => (x.objectifs as { arene?: number }[]).some(o => o.arene === n));
      expect(s?.recompense?.titre).toBeTruthy();
    }
    expect(M).toBeTruthy();
  });
});
