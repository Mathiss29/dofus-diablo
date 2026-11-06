import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import type { QuetesData } from '../src/sim/quests';
import QUETES from '../src/data/quetes.json';
import ITEMS from '../src/data/items.json';
import type { ItemsData } from '../src/sim/items';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const Q = QUETES as unknown as QuetesData;
const newWorld = (persos = 0) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos } });
const STEP = 1 / 60;

describe('quêtes et succès', () => {
  it('les données renvoient à des PNJ, monstres, objets et quêtes qui existent', () => {
    const I = ITEMS as unknown as ItemsData;
    for (const [id, q] of Object.entries(Q.quetes)) {
      if (q.pnj) expect(Q.pnj[q.pnj], id).toBeDefined();
      if (q.rendre) expect(Q.pnj[q.rendre], id).toBeDefined();
      if (q.suivante) expect(Q.quetes[q.suivante], id).toBeDefined();
      for (const r of q.requiert ?? []) expect(Q.quetes[r], id).toBeDefined();
      for (const [o] of q.recompense.objets ?? []) expect(I.resources[o] ?? I.equipment[o], `${id} ${o}`).toBeDefined();
      const etapes = Array.isArray(q.etapes) ? q.etapes : Object.values(q.etapes).flat();
      for (const o of etapes.flatMap(e => e.objectifs)) {
        if (o.t === 'elite') { expect(GAME_DATA.monsters[o.monstre], o.monstre).toBeDefined(); expect(monde.maps.some(m => m.tag === o.carte), o.carte).toBe(true); }
        if (o.t === 'vaincre') for (const m of o.monstres ?? []) expect(GAME_DATA.monsters[m], m).toBeDefined();
        if ((o.t === 'aller' || o.t === 'parler') && o.pnj) expect(Q.pnj[o.pnj], o.pnj).toBeDefined();
      }
    }
    for (const p of Object.values(Q.pnj)) expect(monde.maps.some(m => m.tag === p.carte), p.carte).toBe(true);
    for (const s of Object.values(Q.succes)) for (const o of s.objectifs) if ('succes' in o) expect(Q.succes[o.succes]).toBeDefined();
  });

  it('le tutoriel démarre seul, avance avec les sorts lancés, et ouvre la quête principale suivante', () => {
    const w = newWorld(), q = w.quetes!;
    expect(q.enCours.map(c => c.id)).toEqual(['reponses']);
    expect(q.suivie).toBe('reponses');
    const p = w.player;
    const sort = Object.keys(p.cls.spells).find(s => s !== p.cls.mobility && p.knows(s))!;
    w.emit({ k: 'cast', id: sort });
    w.emit({ k: 'cast', id: p.cls.mobility });
    expect(q.enCours[0].etape).toBe(1);
    expect(q.etapesFinies.has('reponses:0')).toBe(true);
    // 5 monstres de la Route des âmes
    const m = w.monsters.find(x => w.worldGrid!.mapAt(x.x, x.y)?.sub === 450)!;
    for (let i = 0; i < 5; i++) w.emit({ k: 'kill', x: m.x, y: m.y, radius: 10, monster: m.type });
    expect(q.finies.has('reponses')).toBe(true);
    expect(q.enCours.map(c => c.id)).toEqual(['village']);
    expect(q.succes.has('premier_temps')).toBe(true);
    const ev = w.drainEvents().map(e => e.k);
    expect(ev).toContain('queteFin');
    expect(ev).toContain('succes');
  });

  it('le tutoriel est sauté dès le 2e perso ; les PV restent à 1 pendant le tutoriel', () => {
    expect(newWorld(1).quetes!.finies.has('reponses')).toBe(true);
    const w = newWorld(), p = w.player;
    p.invuln = 0; p.hurt(99999, p.x + 10, p.y, w);
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(1);
  });

  it('clic sur un PNJ : le perso y va, prend la quête ; une série se rend au PNJ', () => {
    const w = newWorld(1), q = w.quetes!, p = w.player;
    const cap = q.pnj('capitaine')!;
    expect(q.icone('capitaine')).toEqual({ quete: 'epreuve', rendre: false });
    p.x = cap.x + 40; p.y = cap.y;
    w.step(STEP, { ...NO_INPUT, talk: 'capitaine', dest: { x: cap.x, y: cap.y } });
    for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
    expect(q.enCours.some(c => c.id === 'epreuve')).toBe(true);
    // la Caporale Mynerve apparaît comme élite de quête
    const el = w.monsters.find(m => m.type === 'caporale_mynerve')!;
    expect(el).toBeDefined();
    expect(q.estEliteDeQuete(el.id)).toBe(true);
    expect(q.cible()).toEqual({ x: el.x, y: el.y });
    w.killMonster(el);
    const c = q.enCours.find(x => x.id === 'epreuve')!;
    expect(c.aRendre).toBe(true);
    expect(q.icone('capitaine')).toEqual({ quete: 'epreuve', rendre: true });
    const xp = p.xp, lvl = p.level;
    w.step(STEP, { ...NO_INPUT, talk: 'capitaine', dest: { x: cap.x, y: cap.y } });
    for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
    expect(q.finies.has('epreuve')).toBe(true);
    expect(p.level > lvl || p.xp > xp).toBe(true);
    expect(p.resources['16518']).toBe(5);
    // la suivante de la série est maintenant proposée (niveau assez haut)
    p.level = 5;
    expect(q.aDonner('capitaine')).toBe('champs_bataille');
  });

  it('les succès de découverte de zone tombent en entrant dans la sous-zone', () => {
    const w = newWorld(1), q = w.quetes!;
    for (let i = 0; i < 3; i++) w.step(STEP, NO_INPUT);
    expect(q.succes.has('zone_route')).toBe(true);
    expect(q.points).toBeGreaterThanOrEqual(1);
  });

  it('« Mort au rat ! » démarre seule dans la Taverne et se valide sur place', () => {
    const w = newWorld(1), q = w.quetes!, p = w.player;
    p.level = 7;
    const t = w.openestCellOf('taverne'); p.x = t.x; p.y = t.y;
    w.step(STEP, NO_INPUT);
    expect(q.enCours.some(c => c.id === 'mort_au_rat')).toBe(true);
    const rat = w.monsters.find(m => m.type === 'rat_soiffe')!;
    w.killMonster(rat);
    expect(q.finies.has('mort_au_rat')).toBe(true);
  });
});
