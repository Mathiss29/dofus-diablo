import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { CASE, castKind } from '../src/sim/monster';
import { DANGER, degatsMonstre } from '../src/sim/danger';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const M = GAME_DATA.monsters;
const pv = (lvl: number) => DANGER.degats.pvRef.base + DANGER.degats.pvRef.parNiveau * (lvl - 1);
/** Arène vide, un seul monstre à dist px du joueur, prêt à attaquer. */
function duel(type: string, dist: number) {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7 }), p = w.player;
  w.monsters.length = 0;
  const m = w.spawnMonster(type, p.x + dist, p.y);
  m.state = 'chase'; m.atkCd = 0; m.sigCd = 0;
  return { w, p, m };
}

describe('Danger des monstres (maquette 1A 2A 3A 4A 5A 7A 8A)', () => {
  it('1A : les dégâts suivent le rang et le niveau, plus de 14 fixes à Astrub', () => {
    for (const [k, d] of Object.entries(M)) {
      if (k === 'poutch_ingball') continue;
      const part = d.dmg / pv(d.level ?? 1), base = DANGER.degats.part[d.boss ? 'boss' : d.elite ? 'elite' : 'normal'];
      expect(part, k).toBeGreaterThanOrEqual(base * DANGER.degats.min - 0.01);
      expect(part, k).toBeLessThanOrEqual(base * DANGER.degats.max + 0.01);
      expect(d.dmg).toBe(degatsMonstre(d));
    }
    expect(M.kankreblath.dmg).toBeGreaterThan(M.piou_bleu.dmg * 3);
    expect(M.bouftou.dmg).toBeGreaterThan(18);
  });
  it('8A : effets officiels repris des données (Cuirasse Laineuse, Rinçage, Hyperleukocytine)', () => {
    const eff = (m: string, n: string) => M[m].spells!.find(s => s.name === n)!.effects;
    expect(eff('royal', 'Cuirasse Laineuse')).toContainEqual({ k: 'subis', n: 70, dur: 0 });
    expect(eff('mob_l_eponge', 'Rinçage')).toContainEqual({ k: 'desenvoute', n: 2 });
    expect(eff('frakacia_leukocytine', 'Hyperleukocytine').map(e => e.k)).toEqual(['desenvoute', 'etat']);
    expect(castKind(M.mob_l_eponge.spells!.find(s => s.name === 'Dégraissage')!)).toBe('ligne');
  });
  it('4A : Mob l\'Éponge annonce son Dégraissage en ligne, qui retire bien plus qu\'un coup normal', () => {
    const { w, p, m } = duel('mob_l_eponge', CASE * 4);
    let rect = false, avant = p.hp;
    for (let i = 0; i < 4 * 60 && p.hp === avant; i++) {
      p.x = m.x + CASE * 4; p.y = m.y;
      w.step(STEP, NO_INPUT);
      if (m.sig && w.telegraphs.some(t => t.kind === 'rect')) rect = true;
    }
    expect(rect).toBe(true);
    expect(avant - p.hp).toBeGreaterThanOrEqual(Math.round(M.mob_l_eponge.dmg * 1.8));
  });
  it('4A : on esquive la signature en sortant de la zone annoncée', () => {
    const { w, p, m } = duel('kankreblath', CASE * 2);
    for (let i = 0; i < 2 * 60 && !m.sig; i++) w.step(STEP, NO_INPUT);
    expect(m.sig).toBe(true);
    p.x = m.x; p.y = m.y + CASE * 9; const avant = p.hp;   // hors du cercle de Kankroulahoup
    for (let i = 0; i < 1.5 * 60 && m.sig && m.state === 'windup'; i++) w.step(STEP, NO_INPUT);
    expect(p.hp).toBe(avant);
  });
  it('5A : sous la moitié de ses PV, le boss devient Furieux (une fois) ; 3A : gros coup signalé', () => {
    const { w, p, m } = duel('royal', CASE * 3);
    m.hp = m.maxHp * 0.4;
    w.step(STEP, NO_INPUT);
    const ev = w.drainEvents();
    expect(m.furieux).toBe(true);
    expect(ev.filter(e => e.k === 'furieux').length).toBe(1);
    expect(ev.some(e => e.k === 'bossIntro')).toBe(true);
    w.drainEvents();
    p.hurt(Math.round(p.maxHp * 0.3), m.x, m.y, w);
    expect(w.drainEvents().some(e => e.k === 'grosCoup')).toBe(true);
  });
});
