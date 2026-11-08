import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { appliquerInstantane, COOP, Emetteur, entreeInvite, type Instantane } from '../src/sim/miroir';
import type { Player } from '../src/sim/player';
import type { QuetesData } from '../src/sim/quests';
import QUETES from '../src/data/quetes.json';

/** Chasse aux plantages sans navigateur (Mathis, 2026-11-08 : « ok pour 1 ») : la partie tourne seule avec quatre joueurs
 *  qui cliquent, lancent des sorts, boivent, parlent aux PNJ et meurent au hasard, pendant des milliers d'images.
 *  Toute exception, toute position ou vie qui n'est plus un nombre, ou une partie qui n'avance plus fait échouer le test. */
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const Q = QUETES as unknown as QuetesData;
const STEP = 1 / 60;
const CLASSES = Object.keys(GAME_DATA.classes);
const reseau = (s: Instantane) => JSON.parse(JSON.stringify(s)) as Instantane;

/** Hasard du robot (pas celui de la partie : la sim garde le sien). */
function hasard(graine: number) {
  let s = graine >>> 0 || 1;
  const f = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  return { f, n: (k: number) => Math.floor(f() * k), un: <T>(l: readonly T[]) => l[Math.floor(f() * l.length)] };
}

/** Une entrée au hasard : aller quelque part, viser un monstre, lancer un sort, boire, parler à un PNJ, répondre. */
function entree(w: World, p: Player, h: ReturnType<typeof hasard>): PlayerInput {
  const m = w.monsters.filter(x => !x.dead), cible = m.length && h.f() < 0.6 ? h.un(m) : null;
  const aim = cible ? { x: cible.x, y: cible.y } : { x: p.x + (h.f() - 0.5) * 600, y: p.y + (h.f() - 0.5) * 600 };
  const e: PlayerInput = { ...NO_INPUT, aim, holdAttack: h.f() < 0.5 };
  const r = h.f();
  if (r < 0.08) e.dest = { x: p.x + (h.f() - 0.5) * 900, y: p.y + (h.f() - 0.5) * 900 };
  else if (r < 0.16 && cible) e.target = cible.id;
  else if (r < 0.3) e.pressed = h.un([...p.bar.filter((s): s is string => !!s), 'attaque', p.cls.mobility]);
  else if (r < 0.32) e.potion = true;
  else if (r < 0.34 && p.quetes?.pnjs.length) e.talk = h.un(p.quetes.pnjs).id;
  else if (r < 0.36 && p.quetes?.dialogue) e.reponse = h.n(4) - 1;
  else if (r < 0.4) e.move = { x: h.f() - 0.5, y: h.f() - 0.5 };
  return e;
}

/** La partie est saine : des nombres partout, des définitions derrière chaque entité. */
function sain(w: World, ou: string) {
  for (const e of [...w.players, ...w.monsters, ...w.betes]) {
    expect(Number.isFinite(e.x) && Number.isFinite(e.y), `${ou} : position de ${e.id}`).toBe(true);
    expect(Number.isFinite(e.hp), `${ou} : vie de ${e.id}`).toBe(true);
  }
  for (const m of w.monsters) expect(m.def, `${ou} : ${m.type}`).toBeTruthy();
}

/** Fait jouer n secondes : le premier joueur est celui de l'écran, les autres passent par `autres` comme en coop. */
function jouer(w: World, h: ReturnType<typeof hasard>, n: number, ou: string, miroir?: { w: World; em: Emetteur }) {
  const t0 = w.time;
  for (let i = 0; i < n * 60; i++) {
    const autres: Record<number, PlayerInput> = {};
    for (const q of w.players.slice(1)) autres[q.id] = h.f() < 0.5 ? entreeInvite(entree(w, q, h)) : entree(w, q, h);
    w.step(STEP, entree(w, w.player, h), autres);
    // dans l'arène, celui de l'écran ne meurt pas (une mort l'abandonne) ; en monde ouvert, on revient au point de retour
    if (w.arene) w.player.hp = Math.max(w.player.hp, w.player.maxHp / 2);
    else for (const q of w.players) if (q.dead && h.f() < 0.02) w.commeJoueur(q, () => w.respawnPlayer());
    const evs = w.drainEvents();
    if (miroir) {
      for (const e of evs) miroir.em.noter(e);
      if (i % COOP.tous === 0) { appliquerInstantane(miroir.w, reseau(miroir.em.instantane(w))); sain(miroir.w, `${ou} (invité)`); }
    }
    if (i % 60 === 0) sain(w, ou);
  }
  expect(w.time, `${ou} : la partie n'avance plus`).toBeGreaterThan(t0);
}

describe('chasse aux plantages (sans navigateur)', () => {
  it('arène de la Crypte, quatre joueurs de classes différentes, avec un invité qui recopie', () => {
    for (const [k, ch] of CLASSES.entries()) {
      const h = hasard(11 + k), w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 5 + k, items: ITEMS, classId: ch });
      w.player.level = 60; w.player.recompute(); w.player.learnSpells(null);
      w.allerArene('arene_crypte');
      const invites = [1, 2, 3].map(d => { const q = w.ajouterJoueur(CLASSES[(k + d) % CLASSES.length]); q.level = 40; q.recompute(); w.commeJoueur(q, () => q.learnSpells(null)); return q; });
      const vue = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 9, items: ITEMS, classId: invites[0].cls === w.player.cls ? ch : CLASSES[(k + 1) % CLASSES.length] });
      const em = new Emetteur(invites[0].id);
      jouer(w, h, 20, `arène ${ch}`, { w: vue, em });
      // un invité part en pleine partie, les autres continuent
      w.retirerJoueur(invites[2]);
      jouer(w, h, 8, `arène ${ch} après un départ`, { w: vue, em });
    }
  });

  it('monde ouvert d’Incarnam : quatre joueurs, chacun avec ses quêtes', () => {
    const h = hasard(3), w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 2, items: ITEMS, quetes: Q, classId: 'iop', tuto: false });
    const reprise = w.quetes!.exporter();
    for (const c of ['cra', 'osamodas', 'sacrieur']) w.ajouterJoueur(c, { reprise });
    expect(w.players.every(p => p.quetes)).toBe(true);
    expect(new Set(w.players.map(p => p.quetes)).size).toBe(4);
    jouer(w, h, 40, 'Incarnam');
  });

  it('un monstre vaincu compte pour les joueurs proches, pas pour celui qui est loin', () => {
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 2, items: ITEMS, quetes: Q, classId: 'iop', tuto: false });
    const reprise = w.quetes!.exporter(), a = w.ajouterJoueur('cra', { reprise }), b = w.ajouterJoueur('cra', { reprise });
    b.x += World.SOMMEIL * 2;
    w.commeJoueur(a, () => w.emit({ k: 'kill', x: a.x, y: a.y, radius: 10, monster: 'bouftou' }));
    expect([w.player, a, b].map(p => p.quetes!.vaincus.has('bouftou'))).toEqual([true, true, false]);
  });
});
