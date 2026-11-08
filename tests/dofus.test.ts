import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { DOFUS, DOFUS_ID, PASSIFS } from '../src/sim/dofus';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';
import ICONES from '../src/data/icones_objets.json';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 4, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });

describe('Dofus (version 0.3 : Dofus 0.3 : 1A 2B 3A 4C 5A)', () => {
  it('31 Dofus officiels avec icône et source ; Argenté et Cacao ont leur passif codé', () => {
    expect(Object.keys(DOFUS)).toHaveLength(31);
    for (const d of Object.values(DOFUS)) { expect((ICONES as { icons: Record<string, unknown> }).icons[String(d.icon)], d.nom).toBeDefined(); expect(d.source).toBeTruthy(); }
    expect(DOFUS[DOFUS_ID.argente].nom).toBe('Dofus Argenté');
    expect(DOFUS[DOFUS_ID.cacao].stats.tacle).toBe(10);
  });

  it('6 emplacements, chaque Dofus une fois ; stats comptées ; sauvegardés', () => {
    const w = monde(), p = w.player;
    expect(p.gagnerDofus(DOFUS_ID.cacao)).toBe(true);
    expect(p.dofusPortes[0]).toBe(DOFUS_ID.cacao);
    expect(p.stat('tacle')).toBeGreaterThanOrEqual(10);
    expect(p.porterDofus(DOFUS_ID.cacao, 3)).toBe(false);   // déjà porté
    expect(p.porterDofus(DOFUS_ID.argente)).toBe(false);    // pas possédé
    const v = monde(); restaurerJoueur(v, exporterJoueur(w));
    expect(v.player.dofus).toEqual([DOFUS_ID.cacao]);
    expect(v.player.porteDofus('cacao')).toBe(true);
    expect(p.retirerDofus(0)).toBe(true);
    expect(p.porteDofus('cacao')).toBe(false);
  });

  it("Souvenir d'Argent : sous 20 % de PV, soin instantané de 20 %, recharge 120 s", () => {
    const w = monde(), p = w.player;
    p.gagnerDofus(DOFUS_ID.argente);
    for (const m of w.monsters) m.dead = true;
    p.hp = Math.round(p.maxHp * 0.25); p.invuln = 0;
    p.hurt(Math.round(p.maxHp * 0.1), p.x + 10, p.y, w);
    expect(p.hp).toBeGreaterThan(p.maxHp * 0.2);
    expect(w.drainEvents().some(e => e.k === 'dofusPassif' && e.dofus === 'argente')).toBe(true);
    p.hp = Math.round(p.maxHp * 0.25); p.invuln = 0;
    p.hurt(Math.round(p.maxHp * 0.1), p.x + 10, p.y, w);
    expect(p.hp).toBeLessThan(p.maxHp * 0.2);   // en recharge
    p.age += PASSIFS.argente.recharge;
    expect(p.rechargeArgente).toBe(0);
  });

  it('Bénédiction chocolatée : coup à distance avec un monstre au contact = bouclier', () => {
    const w = monde(), p = w.player;
    p.gagnerDofus(DOFUS_ID.cacao);
    for (const m of w.monsters) m.dead = true;
    p.invuln = 0; p.hurt(5, p.x + 300, p.y, w);
    expect(p.shield).toBe(0);   // personne au contact
    w.spawnMonster('bouftou', p.x + 30, p.y);
    p.invuln = 0; p.hurt(5, p.x + 300, p.y, w);
    expect(p.shield).toBe(Math.round(p.maxHp * PASSIFS.cacao.bouclier));
  });

  it("quêtes « œuf à reconstituer » : 3 élites de zones différentes puis un gardien ; le Dofus en récompense ; cachées hors 0.3", () => {
    for (const id of ['oeuf_argent', 'oeuf_cacao']) {
      const q = QUETES.quetes[id], et = q.etapes as import('../src/sim/quests').EtapeDef[];
      expect(q.v03).toBe(true);
      expect(et[1].objectifs.filter(o => o.t === 'elite')).toHaveLength(3);
      expect(et[2].objectifs[0].t).toBe('elite');
      expect(q.recompense.dofus && DOFUS[q.recompense.dofus]).toBeTruthy();
      expect(q.pnj).toBe('gawdien');
    }
    expect(QUETES.quetes.oeuf_cacao.requiert).toContain('oeuf_argent');
  });
});
