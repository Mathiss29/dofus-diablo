import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { rollItem, type Item } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { EN_JEU, POUVOIRS, POUVOIR_PAR_ID, classeDuPouvoir } from '../src/sim/pouvoirs';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = (classId = 'iop', test = true) =>
  new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId, ...(test ? { test: {} as never } : {}) });
const objet = (o: Partial<Item>): Item => ({ uid: 999, id: 'test', rarity: 'legendaire', stats: {}, extra: [], ...o });
const pouvoir = (cl: string, sort: string, effet?: string) =>
  POUVOIRS[cl].find(p => p.sort === sort && (!effet || p.effet === effet))!;
const chapeau = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === 'chapeau' && d.level <= 20)!;

describe('pouvoirs légendaires officiels (version 0.3 : 3B 4A+4C ; Légendaires : 1A 2B 3A 5A 6A)', () => {
  it('2B : 40 pouvoirs officiels par classe, 5 par emplacement sur 8', () => {
    for (const cl of ['iop', 'cra', 'osamodas']) {
      expect(POUVOIRS[cl]).toHaveLength(40);
      const par: Record<string, number> = {};
      for (const p of POUVOIRS[cl]) { par[p.slot] = (par[p.slot] ?? 0) + 1; expect(p.dofusId).toBeGreaterThan(0); }
      expect(Object.values(par)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    }
  });

  it('4A : un Légendaire tiré ne vise que des sorts du jeu, surtout ceux que le perso connaît ; 4C : parfois un sort à venir', () => {
    const w = arena(), p = w.player, rng = new Rng(3), ctx = p.ctxPouvoirs;
    expect(ctx.v03).toBe(true);
    let officiels = 0, maison = 0, aVenir = 0, autre = 0;
    for (let i = 0; i < 2000; i++) {
      const it = rollItem(chapeau[0], chapeau[1], 'legendaire', rng, i, ctx), l = it.legendary!;
      const o = POUVOIR_PAR_ID[l.id];
      if (!o) { maison++; continue; }
      expect(o.slot).toBe('chapeau');
      expect(EN_JEU[classeDuPouvoir(o.id)]).toContain(o.dofusId);
      if (classeDuPouvoir(o.id) !== 'iop') autre++;
      else if (ctx.connus.includes(o.dofusId)) officiels++;
      else { aVenir++; expect(ctx.aVenir.map(a => a.dofusId)).toContain(o.dofusId); }
    }
    expect(officiels).toBeGreaterThan(0);
    expect(maison).toBeGreaterThan(0);
    expect(autre).toBeGreaterThan(80); expect(autre).toBeLessThan(320);   // ~1 sur 10
    expect(aVenir).toBeLessThan(320);
  });

  it('1A : un Mythique porte deux pouvoirs différents', () => {
    const w = arena(), rng = new Rng(5);
    for (let i = 0; i < 300; i++) {
      const it = rollItem(chapeau[0], chapeau[1], 'mythique', rng, i, w.player.ctxPouvoirs);
      expect(it.legendary2).toBeDefined();
      expect(it.legendary2!.id).not.toBe(it.legendary!.id);
    }
  });

  it('hors partie de test aussi (0.3 sortie) : les pouvoirs officiels sortent', () => {
    const w = arena('iop', false), rng = new Rng(9);
    expect(w.player.ctxPouvoirs.v03).toBe(true);
    let officiels = 0;
    for (let i = 0; i < 300; i++) if (POUVOIR_PAR_ID[rollItem(chapeau[0], chapeau[1], 'legendaire', rng, i, w.player.ctxPouvoirs).legendary!.id]) officiels++;
    expect(officiels).toBeGreaterThan(0);
  });

  it('6A : coût en PA, portée de case, charges, dégâts de base et critique changent le sort visé', () => {
    const w = arena('iop'), p = w.player;
    p.fixerNiveau(60, null);
    const pa = p.paCost('colere'), po = p.grade('fureur')!.po[1];
    p.equipment.ceinture = objet({ legendary: { id: pouvoir('iop', 'Colère de Iop').id, value: 0 } });
    p.equipment.bottes = objet({ uid: 998, legendary: { id: pouvoir('iop', 'Fureur').id, value: 0 } });
    p.recompute();
    expect(p.paCost('colere')).toBe(pa - 1);
    expect(p.grade('fureur')!.po[1]).toBe(po + 2);

    const c = arena('cra'), q = c.player;
    q.fixerNiveau(60, null);
    const ch = q.chargesMax('cinglante'), dmg = q.grade('glacee')!.dmg!;
    q.equipment.chapeau = objet({ legendary: { id: pouvoir('cra', 'Flèche Cinglante').id, value: 0 }, legendary2: { id: pouvoir('cra', 'Flèche Glacée').id, value: 0 } });
    q.equipment.anneau1 = objet({ uid: 997, legendary: { id: pouvoir('cra', 'Flèche Explosive').id, value: 0 } });
    q.recompute();
    expect(q.chargesMax('cinglante')).toBe(ch + 1);
    expect(q.grade('glacee')!.dmg).toEqual([dmg[0] + 4, dmg[1] + 4]);
    expect(q.critSort('explosive')).toBeCloseTo(0.3);
  });

  it('5A : le même pouvoir sur les deux anneaux ne compte qu\'une fois', () => {
    const w = arena('iop'), p = w.player;
    p.fixerNiveau(150, null);
    const id = pouvoir('iop', 'Concentration').id, po = p.grade('concentration')!.po[1];
    p.equipment.anneau1 = objet({ legendary: { id, value: 0 } });
    p.equipment.anneau2 = objet({ uid: 998, legendary: { id, value: 0 } });
    p.recompute();
    expect(p.grade('concentration')!.po[1]).toBe(po + 2);
  });

  it('un pouvoir d\'une autre classe ou d\'un sort pas encore appris ne fait rien et le dit', () => {
    const w = arena('iop'), p = w.player;
    const cra = pouvoir('cra', 'Flèche Cinglante');
    p.equipment.chapeau = objet({ legendary: { id: cra.id, value: 0 } });
    p.recompute();
    expect(p.pouvoirsPortes).toHaveLength(0);
    expect(p.etatPouvoir(cra.id)).toEqual({ actif: false, raison: 'pouvoir de Crâ' });
    const futur = pouvoir('iop', 'Concentration');
    expect(p.etatPouvoir(futur.id)).toMatchObject({ actif: false });
  });

  it('portée modifiable officielle : la stat Portée ne s\'applique qu\'aux sorts qui l\'acceptent, sauf pouvoir', () => {
    const w = arena('iop'), p = w.player;
    p.base.portee = 3; p.recompute();
    expect(p.porteeModifiable('pression')).toBe(false);   // Pression : portée non modifiable dans Dofus
    expect(p.porteeStat('pression')).toBe(0);
    const c = arena('cra').player;
    expect(c.porteeModifiable('cinglante')).toBe(true);
    // hors partie de test aussi (0.3 sortie)
    expect(arena('iop', false).player.porteeModifiable('pression')).toBe(false);
  });
  it('6A : ligne de vue officielle (Pression), « ligne de vue désactivée » la retire ; « lancer en ligne désactivé » = +1 case de zone', () => {
    const w = arena('iop'), p = w.player;
    p.fixerNiveau(100, null);
    expect(p.demandeVue('pression')).toBe(true);
    expect(p.zoneBonus('deferlement')).toBe(0);
    p.equipment.chapeau = objet({ legendary: { id: pouvoir('iop', 'Pression').id, value: 0 } });
    p.equipment.bottes = objet({ uid: 998, legendary: { id: pouvoir('iop', 'Déferlement').id, value: 0 } });
    p.recompute();
    expect(p.demandeVue('pression')).toBe(false);
    expect(p.zoneBonus('deferlement')).toBe(24);
  });
});
