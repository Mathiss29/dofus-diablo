import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { Emetteur } from '../src/sim/miroir';

/** Monde partagé (étape 4) : en monde ouvert, chaque joueur a ses portes, son point de retour et ses fenêtres à lui. */
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 4, items: ITEMS, classId: 'iop' });
const STEP = 1 / 60;

describe('monde partagé : un état par joueur', () => {
  it('un invité passe seul le portail vers Astrub : l’événement est pour lui, le premier joueur ne bouge pas', () => {
    const w = monde(), h = w.player, q = w.ajouterJoueur('cra'), po = w.portes.find(p => p.vers)!;
    const hx = h.x, hy = h.y;
    q.x = po.ends[0].x + 40; q.y = po.ends[0].y;
    let a: ReturnType<World['evenementsDe']> = [];
    const ecran: string[] = [];
    for (let i = 0; i < 120 && !a.some(e => e.k === 'changeZone'); i++) {
      w.step(STEP, NO_INPUT, { [q.id]: { ...NO_INPUT, aim: po.ends[0], dest: { x: po.ends[0].x, y: po.ends[0].y }, versPortail: i === 0 ? po.nom : null } });
      ecran.push(...w.drainEvents().map(e => e.k));
      a = [...a, ...w.evenementsDe(q)];
    }
    expect(a.some(e => e.k === 'changeZone')).toBe(true);
    expect(ecran).not.toContain('changeZone');
    expect(ecran).not.toContain('portalStart');
    expect(w.passage).toBeNull();
    expect([h.x, h.y]).toEqual([hx, hy]);
    expect(w.evenementsDe(h)).toEqual([]);   // le premier joueur lit les siens par drainEvents
  });

  it('chacun son point de retour : un Zaap atteint par l’invité ne change pas celui du premier', () => {
    const w = monde(), q = w.ajouterJoueur('cra');
    const avant = w.pointDeRetour;
    w.commeJoueur(q, () => w.setPointDeRetour('Ailleurs', q.x, q.y));
    expect(w.pointDeRetour).toEqual(avant);
    expect(w.commeJoueur(q, () => w.pointDeRetour.name)).toBe('Ailleurs');
  });

  it('l’invité reçoit ses propres bandeaux, pas les fenêtres', () => {
    const w = monde(), q = w.ajouterJoueur('cra'), em = new Emetteur(q.id);
    w.commeJoueur(q, () => { w.emit({ k: 'enterArea', name: 'Champs', level: 1 }); w.emit({ k: 'coffreOuvert' }); });
    expect(w.drainEvents()).toEqual([]);
    for (const e of w.evenementsDe(q)) em.noterPerso(e);
    expect((em.instantane(w).ev ?? []).map(e => (e as { k: string }).k)).toEqual(['enterArea']);
  });
});
