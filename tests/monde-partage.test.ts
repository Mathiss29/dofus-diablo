import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { appliquerInstantane, Emetteur, lisserMiroir, LISSAGE, type Instantane } from '../src/sim/miroir';
import type { QuetesData } from '../src/sim/quests';
import QUETES from '../src/data/quetes.json';

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

  it('l’invité voit ses quêtes à lui et le dialogue qu’il a ouvert, recopiés de l’hôte', () => {
    const Q = QUETES as unknown as QuetesData;
    const opts = { data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), items: ITEMS, quetes: Q, tuto: false };
    const hote = new World({ ...opts, seed: 1, classId: 'iop' }), vue = new World({ ...opts, seed: 2, classId: 'cra' });
    const q = hote.ajouterJoueur('cra', { reprise: { ...hote.quetes!.exporter(), vaincus: ['bouftou'] } }), em = new Emetteur(q.id);
    const pnj = q.quetes!.pnjs[0];
    q.x = pnj.x + 30; q.y = pnj.y;
    for (let i = 0; i < 30; i++) hote.step(STEP, NO_INPUT, { [q.id]: { ...NO_INPUT, aim: pnj, talk: i === 0 ? pnj.id : null } });
    expect(q.quetes!.dialogue?.pnj).toBe(pnj.id);
    expect(hote.quetes!.dialogue).toBeNull();
    appliquerInstantane(vue, JSON.parse(JSON.stringify(em.instantane(hote))) as Instantane);
    expect(vue.quetes!.vaincus.has('bouftou')).toBe(true);
    expect(vue.quetes!.dialogue?.pnj).toBe(pnj.id);
  });

  it('chaque invité reçoit son sac en direct, et seulement le sien', () => {
    const hote = monde(), vue = monde(), q = hote.ajouterJoueur('cra'), r = hote.ajouterJoueur('iop'), em = new Emetteur(q.id);
    appliquerInstantane(vue, JSON.parse(JSON.stringify(em.instantane(hote))) as Instantane);
    q.resources.ble = 7; q.kamas = 1234; r.kamas = 99;
    q.bag.push({ ...structuredClone(hote.player.bag[0] ?? { id: 'x', uid: 1 }), uid: 4242 } as never);
    const s = JSON.parse(JSON.stringify(em.instantane(hote))) as Instantane;
    expect(Object.keys(s.sac ?? {}).sort()).toEqual(['bag', 'kamas', 'resources']);
    appliquerInstantane(vue, s);
    expect([vue.player.resources.ble, vue.player.kamas, vue.player.bag.some(i => i.uid === 4242)]).toEqual([7, 1234, true]);
    const autre = vue.players.find(p => p.id === r.id)!;
    expect(autre.kamas).not.toBe(99);
    expect(em.instantane(hote).sac).toBeUndefined();   // rien n'a changé : rien ne repart
  });

  it('lissage : l’invité voit un allié glisser vers sa nouvelle place, et sauter s’il est loin', () => {
    const hote = monde(), vue = monde(), q = hote.ajouterJoueur('cra'), em = new Emetteur(q.id);
    const reseau = () => JSON.parse(JSON.stringify(em.instantane(hote))) as Instantane;
    appliquerInstantane(vue, reseau(), true);
    const h = hote.player, x0 = h.x, autre = () => vue.players.find(p => p.id === h.id)!;
    expect(autre().x).toBe(x0);   // arrivé avec le premier instantané : posé d'un coup
    h.x += 40;
    appliquerInstantane(vue, reseau(), true);
    expect(autre().x).toBe(x0);   // pas encore bougé
    lisserMiroir(vue, 1 / 60);
    expect(autre().x).toBeGreaterThan(x0); expect(autre().x).toBeLessThan(x0 + 40);
    for (let i = 0; i < 60; i++) lisserMiroir(vue, 1 / 60);
    expect(autre().x).toBe(x0 + 40);
    h.x += LISSAGE.saut + 50;
    appliquerInstantane(vue, reseau(), true);
    expect(autre().x).toBe(h.x);   // grand saut (porte, téléport) : tout de suite à sa place
  });
});
