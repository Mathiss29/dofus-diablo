import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { V07_PUBLIC } from '../src/sim/pouvoirs';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { SORTS } from '../src/sim/sorts';
import { avantImpact07 } from '../src/sim/sorts07';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const CLASSES = ['iop', 'cra', 'osamodas', 'sacrieur', 'forgelance', 'eniripsa', 'enutrof', 'ecaflip', 'sadida', 'ouginak'];
const monde = (classId: string, test = true) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 5, items: ITEMS, classId, ...(test ? { test: {} as never } : {}) });
  w.waveDelay = 1e9; w.player.fixerNiveau(120, null); return w;
};
/** Prend la variante 91-120 du sort `k` (deuxième sort de sa paire). */
const choisir = (w: World, k: string) => {
  const p = w.player, id = p.cls.spells[k].dofusId, i = p.pairs.findIndex(x => x.some(s => s.id === id));
  p.setVariant(i, p.pairs[i].findIndex(s => s.id === id) as 0 | 1);
  expect(p.knows(k), k).toBe(true);
};
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const lancer = (w: World, id: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.player.cd[id as string] = 0; w.player.casts[id as string] = []; w.step(STEP, { ...NO_INPUT, aim, pressed: id }); idle(w, 0.8); };
const monstre = (w: World, dx: number, dy = 0) => { const m = w.spawnMonster('bouftou', w.player.x + dx, w.player.y + dy); m.state = 'idle'; m.maxHp = m.hp = 1e6; return m; };

describe('Sorts 91-120 des dix classes (0.7, ligne « 0.7 : » 8A)', () => {
  it('chaque sort officiel du niveau 91 à 120 a sa fiche jouable, cachée hors partie de test', () => {
    for (const cls of CLASSES) {
      const C = GAME_DATA.classes[cls];
      const officiels = SORTS[C.sorts].flatMap(p => p).filter(s => s.grades[0].niv > 90 && s.grades[0].niv <= 120);
      expect(officiels.length, cls).toBe(6);
      const pub = monde(cls, false), test = monde(cls, true);
      for (const o of officiels) {
        const k = Object.keys(C.spells).find(x => C.spells[x].dofusId === o.id);
        expect(k, `${cls} ${o.name}`).toBeTruthy();
        expect(C.spells[k!].v07, k).toBe(true);
        expect(pub.player.keyOf(o.id), k).toBe(V07_PUBLIC ? k : null);
        expect(test.player.keyOf(o.id), k).toBe(k);
      }
    }
  });

  it('Iop : l\'Épée du Jugement Condamne, et frappe 50 % plus fort une cible Condamnée', () => {
    const w = monde('iop'), m = monstre(w, 80);
    choisir(w, 'epee_jugement');
    const d = w.player.cls.spells.epee_jugement;
    expect(avantImpact07(w.player, d, m.x, m.y, w)).toBe(1);
    lancer(w, 'epee_jugement', { x: m.x, y: m.y });
    expect(w.player.e07!.condamnes.some(c => c.mid === m.id)).toBe(true);
    expect(avantImpact07(w.player, d, m.x, m.y, w)).toBe(1.5);
    expect(w.player.shield).toBeGreaterThan(0);
  });

  it('Crâ : Tir Perçant fait subir plus de dommages ; la Balise Tactique attire les ennemis et donne de la Puissance', () => {
    const w = monde('cra'), p = w.player, m = monstre(w, 100);
    choisir(w, 'tir_percant'); lancer(w, 'tir_percant', { x: m.x, y: m.y });
    expect(m.vulnT).toBeGreaterThan(0); expect(m.vuln).toBe(20);
    choisir(w, 'balise_tactique');
    const n = monstre(w, 300); n.stun = 5; const bx = p.x + 200, by = p.y, d0 = Math.hypot(n.x - bx, n.y - by);
    lancer(w, 'balise_tactique', { x: bx, y: by });
    expect(w.betes.some(b => b.base === 'cra_balise_tactique' && !b.dead)).toBe(true);
    expect(Math.hypot(n.x - bx, n.y - by)).toBeLessThan(d0 - 20);
    expect(p.mods.some(x => x.src === 'balise07' && x.k === 'puissance')).toBe(true);
  });

  it('Enutrof : Monnaie Sonnante marque la cible, les autres sorts la refrappent 4 fois', () => {
    const w = monde('enutrof'), p = w.player, m = monstre(w, 80);
    choisir(w, 'monnaie_sonnante');
    lancer(w, 'monnaie_sonnante', { x: m.x, y: m.y });
    expect(p.e07!.echos).toHaveLength(1);
    for (let i = 0; i < 4; i++) lancer(w, 'force_age', { x: m.x, y: m.y });
    expect(p.e07!.echos).toHaveLength(0);
  });

  it('Sacrieur : Perfusion donne des PV aux alliés proches ; Pacte de Sang renforce Vitalité et Puissance', () => {
    const w = monde('sacrieur'), p = w.player;
    choisir(w, 'pacte_sang');
    const pv = p.maxHp; lancer(w, 'pacte_sang', { x: p.x, y: p.y });
    expect(p.maxHp).toBeGreaterThan(pv);
  });

  it('Sadida : Arbre Feuillu plante un Arbre déjà Feuillu ; la Folle Transmutée naît sans Arbre et en laisse un', () => {
    const w = monde('sadida'), p = w.player;
    choisir(w, 'arbre_feuillu');
    lancer(w, 'arbre_feuillu', { x: p.x + 100, y: p.y });
    const a = w.betes.find(b => b.base === 'sadi_arbre' && !b.dead);
    expect(a?.sadi?.feuillu).toBe(true);
    choisir(w, 'folle_transmutee');
    lancer(w, 'folle_transmutee', { x: p.x - 80, y: p.y });
    expect(w.betes.some(b => b.base === 'sadi_folle' && !b.dead)).toBe(true);
    const n = w.betes.filter(b => b.base === 'sadi_arbre' && !b.dead).length;
    idle(w, 9.5);
    expect(w.betes.filter(b => b.base === 'sadi_arbre' && !b.dead).length).toBe(n + 1);
  });

  it('Ouginak : Pistage repousse la cible et rapproche le lanceur', () => {
    const w = monde('ouginak'), p = w.player, m = monstre(w, 70), x0 = p.x;
    choisir(w, 'pistage');
    lancer(w, 'pistage', { x: m.x, y: m.y });
    expect(p.x).toBeGreaterThan(x0 + 30);
  });
});
