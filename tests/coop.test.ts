import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { appliquerInstantane, COOP, Emetteur, entreeInvite, type Instantane } from '../src/sim/miroir';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

/** Coop (maquette « Multi : » 3A, 11A) : l'hôte fait tourner l'arène, l'invité recopie des instantanés dans un monde miroir. */
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const STEP = 1 / 60;
const monde = (seed: number, classId = 'iop') => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed, items: ITEMS, classId });
/** Le réseau ne transporte que du JSON. */
const reseau = (s: Instantane) => JSON.parse(JSON.stringify(s)) as Instantane;

/** Hôte dans l'arène de la Crypte, invité Crâ niveau 20 ajouté, miroir prêt. */
function partie() {
  const hote = monde(3), invite = monde(9, 'cra');
  invite.player.level = 20; invite.player.recompute();
  hote.allerArene('arene_crypte');
  const q = hote.ajouterJoueur('cra');
  hote.commeJoueur(q, () => restaurerJoueur(hote, { ...exporterJoueur(invite), zone: '__coop' }));
  const em = new Emetteur(q.id);
  const tic = (n: number, entree = NO_INPUT) => {
    let paquets = 0;
    for (let i = 0; i < n; i++) {
      hote.step(STEP, NO_INPUT, { [q.id]: entree });
      for (const e of hote.drainEvents()) em.noter(e);
      if (i % COOP.tous === 0) { appliquerInstantane(invite, reseau(em.instantane(hote))); paquets++; }
    }
    appliquerInstantane(invite, reseau(em.instantane(hote)));
    return paquets;
  };
  return { hote, invite, q, em, tic };
}

describe('coop : instantanés de l’hôte et monde miroir de l’invité', () => {
  it('le perso de l’invité garde sa classe et son niveau chez l’hôte', () => {
    const { q, invite } = partie();
    expect(q.cls).toBe(GAME_DATA.classes.cra);
    expect(q.level).toBe(20);
    expect(q.maxHp).toBe(invite.player.maxHp);
  });

  it('le miroir montre la même arène : joueurs, monstres, vague, temps', () => {
    const { hote, invite, q, tic } = partie();
    tic(60 * 8);
    expect(hote.arene?.vague).toBeGreaterThan(0);
    expect(invite.player.id).toBe(q.id);
    expect(invite.players.map(p => p.id).sort()).toEqual(hote.players.map(p => p.id).sort());
    expect(invite.player).toMatchObject({ hp: q.hp, anim: q.anim });
    expect(invite.player.x).toBeCloseTo(q.x, 1);
    expect(invite.players.find(p => p.id === hote.player.id)!.cls).toBe(hote.player.cls);
    const proches = hote.monsters.filter(m => Math.abs(m.x - q.x) + Math.abs(m.y - q.y) <= COOP.vue);
    expect(proches.filter(m => m.arene).length).toBeGreaterThan(0);
    expect(invite.monsters.map(m => [m.id, m.type, m.hp])).toEqual(proches.map(m => [m.id, m.type, m.hp]));
    expect(invite.monsters.find(m => m.arene)!.def).toBe(GAME_DATA.monsters[invite.monsters.find(m => m.arene)!.type]);
    expect(invite.arene).toMatchObject({ vague: hote.arene!.vague, demarre: hote.arene!.demarre, nom: hote.arene!.nom });
    expect(Math.abs(invite.time - hote.time)).toBeLessThan(0.05);
  });

  it('les entrées de l’invité font bouger son perso chez l’hôte, puis dans son miroir', () => {
    const { invite, q, tic } = partie();
    const x0 = q.x;
    tic(40, entreeInvite({ move: { x: 3, y: 0 }, aim: { x: q.x + 300, y: q.y }, test: [{ k: 'alliesRetirer' }] } as never));
    expect(q.x).toBeGreaterThan(x0 + 20);
    expect(invite.player.x).toBeCloseTo(q.x, 1);
  });

  it('après le premier envoi, seuls les changements partent (petits paquets)', () => {
    const { hote, em, tic } = partie();
    tic(60 * 4);
    const plein = JSON.stringify({ ...em.instantane(hote), plein: true }).length;
    em.toutRenvoyer();
    const tout = JSON.stringify(em.instantane(hote)).length, suite = JSON.stringify(em.instantane(hote)).length;
    expect(tout).toBeGreaterThan(plein / 4);
    expect(suite).toBeLessThan(tout / 5);
    expect(tout).toBeLessThan(60_000);
  });

  it('les entrées d’un invité ne gardent que le combat', () => {
    const e = entreeInvite({ move: { x: 0, y: 0 }, aim: { x: 1, y: 2 }, pressed: 'attaque', talk: 'emp', zaap: 1, havreSac: true, test: [] } as never);
    expect(e).not.toHaveProperty('talk');
    expect(e).not.toHaveProperty('zaap');
    expect(e).not.toHaveProperty('havreSac');
    expect(e.pressed).toBe('attaque');
    expect(entreeInvite(null).move).toEqual({ x: 0, y: 0 });
  });
});
