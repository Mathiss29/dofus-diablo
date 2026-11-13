import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { coefChanceQuiMonte, raretes } from '../src/sim/butin';
import { World } from '../src/sim/world';
import { NO_INPUT } from '../src/sim/input';
import { idolesGroupe } from '../src/sim/idolesCombat';
import { poserAffixes } from '../src/sim/elites';
import { poserAutel } from '../src/sim/autels';
import { defCoffreFuyard } from '../src/sim/coffreFuyard';
import { majRenommee, regions, renommee } from '../src/sim/renommee';
import { PEPITE } from '../src/sim/items';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, seed = 3) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, recoltes: RECOLTES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });

describe('0.6 : courbe d\'XP, découverte, chance de boss qui monte', () => {
  it('cachée hors partie de test', () => {
    expect(monde().player.v06).toBe(true);
    expect(monde(false).player.v06).toBe(false);
  });

  it('24A : 2 % de Légendaire au 1er boss, puis +1 % par boss raté', () => {
    const base = raretes('boss'), leg = (c: number) => { const r = raretes('boss', 0, c); return r.legendaire + r.mythique; };
    expect(base.legendaire + base.mythique).toBeGreaterThan(0);
    expect(coefChanceQuiMonte(0)).toBe(1);
    expect(coefChanceQuiMonte(1)).toBeCloseTo(1.5);
    expect(leg(coefChanceQuiMonte(2)) / leg(1)).toBeCloseTo(2, 1);
  });

  it('24A : le compteur monte sans Légendaire, retombe à zéro quand il tombe, et se garde', () => {
    const w = monde(), p = w.player;
    const n = (w as unknown as { noterBossLeg(b: string, x: { objets: { rarity: string }[] }, e: boolean): void });
    n.noterBossLeg('bouftou_royal', { objets: [{ rarity: 'rare' }] }, true);
    n.noterBossLeg('bouftou_royal', { objets: [] }, true);
    expect(p.bossSansLeg.bouftou_royal).toBe(2);
    expect(w.contexteButin('bouftou_royal', 'boss', 30).legendaire).toBeCloseTo(2);
    const s = exporterJoueur(w), w2 = monde();
    restaurerJoueur(w2, s);
    expect(w2.player.bossSansLeg.bouftou_royal).toBe(2);
    n.noterBossLeg('bouftou_royal', { objets: [{ rarity: 'legendaire' }] }, false);
    expect(p.bossSansLeg.bouftou_royal).toBeUndefined();
  });

  it('6D : +50 % d\'XP sur une carte jamais chassée, une seule fois', () => {
    const w = monde(), p = w.player;
    const g = (w as unknown as { groups: { map: string; members: unknown[] }[] }).groups.find(x => x.members.length && /^-?\d+_-?\d+$/.test(x.map));
    expect(g).toBeDefined();
    const d = (w as unknown as { decouverte(q: typeof p, c: string, f: boolean): number });
    expect(d.decouverte(p, g!.map, false)).toBe(1.5);
    expect(d.decouverte(p, g!.map, true)).toBe(1.5);
    expect(d.decouverte(p, g!.map, false)).toBe(1);
    expect(w.drainEvents().some(e => e.k === 'decouverte')).toBe(true);
    const v = monde(false);
    expect((v as unknown as typeof d).decouverte(v.player, g!.map, false)).toBe(1);
  });
});

describe('0.6 : idoles (17-18)', () => {
  it('39 idoles, 9 familles, les 3 d\'ARPG ; recettes de récolte', async () => {
    const { IDOLES_DEFS, REGLES_IDOLES, recetteIdole } = await import('../src/sim/idoles');
    const { RECOLTES } = await import('../src/sim/data');
    expect(Object.keys(IDOLES_DEFS).length).toBe(39);
    expect(Object.keys(REGLES_IDOLES.familles).length).toBe(9);
    for (const id of ['zaihort', 'leukide', 'nahuatl']) expect(IDOLES_DEFS[id]).toBeDefined();
    for (const [id, I] of Object.entries(IDOLES_DEFS)) {
      expect(REGLES_IDOLES.familles[I.famille], id).toBeDefined();
      expect(recetteIdole(id, RECOLTES).length, id).toBe(3);
    }
  });

  it('une par famille, 6 au plus, seulement celles fabriquées ; score et bonus', async () => {
    const { basculerIdole, bonusIdoles, etatIdolesVide, scoreIdoles } = await import('../src/sim/idoles');
    const e = etatIdolesVide();
    expect(basculerIdole(e, 'hebdo')).toMatch(/Bricoleur/);
    e.possedees.push('hebdo', 'muta', 'dynamo', 'tynril', 'farle', 'nocturne', 'dokoko', 'bihilete');
    expect(basculerIdole(e, 'hebdo')).toBeNull();
    expect(basculerIdole(e, 'muta')).toBeNull();
    expect(e.actives).toEqual(['muta']);
    for (const id of ['dynamo', 'tynril', 'farle', 'nocturne', 'dokoko']) expect(basculerIdole(e, id)).toBeNull();
    expect(basculerIdole(e, 'bihilete')).toMatch(/6 idoles/);
    expect(scoreIdoles(e.actives)).toBe(25 + 10 + 10 + 15 + 15 + 15);
    expect(bonusIdoles(e.actives, false)).toBeCloseTo(0.45);
    expect(bonusIdoles(e.actives, true)).toBeCloseTo(0.3);
  });

  it('les monstres apparaissent plus forts ; XP et butin en plus ; gardées avec le perso', () => {
    const w = monde(), p = w.player;
    const sans = w.spawnMonster('bouftou', p.x + 60, p.y);
    p.idoles.possedees.push('walet', 'hurzz', 'dinam');
    for (const id of ['walet', 'hurzz', 'dinam']) expect(w.basculerIdole(id)).toBeNull();
    const avec = w.spawnMonster('bouftou', p.x + 80, p.y);
    expect(avec.maxHp).toBeGreaterThan(sans.maxHp * 1.5);
    expect(avec.def.dmg).toBeGreaterThan(sans.def.dmg * 1.5);
    expect(w.bonusIdoles).toBeCloseTo((40 + 40 + 30) * 0.005);
    expect(w.contexteButin('bouftou', 'normal', 10).prospection).toBeGreaterThan(p.prospection + 50);
    const w2 = monde();
    restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.idoles.actives).toEqual(['walet', 'hurzz', 'dinam']);
    const v = monde(false);
    v.player.idoles.possedees.push('walet'); v.basculerIdole('walet');
    expect(v.fxIdoles).toBeNull();   // hors partie de test : rien ne change
  });

  it('fabriquée chez le Bricoleur avec ses ingrédients et le niveau', () => {
    const w = monde(), p = w.player;
    (w as unknown as { atelierIci(m: string): unknown }).atelierIci = () => ({});
    expect(w.fabriquerIdole('hebdo')).toMatch(/Bricoleur niveau/);
    p.metiers.bricoleur = { level: 30, xp: 0 } as never;
    expect(w.fabriquerIdole('hebdo')).toMatch(/Ingrédients/);
    for (const [x, q] of w.recetteIdole('hebdo')) p.resources[x] = q;
    expect(w.fabriquerIdole('hebdo')).toBeNull();
    expect(p.idoles.possedees).toContain('hebdo');
    expect(Object.keys(p.resources).length).toBe(0);
    expect(w.fabriquerIdole('hebdo')).toMatch(/Déjà/);
  });

  const avecIdoles = (ids: string[]) => {
    const w = monde(), p = w.player;
    p.idoles.possedees.push(...ids);
    for (const id of ids) expect(w.basculerIdole(id)).toBeNull();
    w.step(1 / 60, { ...NO_INPUT, aim: { x: p.x, y: p.y } });
    return w;
  };

  it('effets en combat : Sakai revient à la vie, Tynril donne un bouclier, Payo et Djim', () => {
    const t = avecIdoles(['tynril']), b = t.spawnMonster('bouftou', t.player.x + 300, t.player.y);
    expect(b.bouclier).toBe(Math.round(b.maxHp * 0.15));
    const w = avecIdoles(['sakai', 'payo', 'djim']), p = w.player;
    const m = w.spawnMonster('bouftou', p.x + 300, p.y);
    m.hp = 0; w.killMonster(m);
    expect(m.dead).toBe(false);
    expect(m.hp).toBe(Math.round(m.maxHp * 0.3));
    m.hp = 0; w.killMonster(m);
    expect(m.dead).toBe(true);
    const g = ['bouftou', 'bouftou', 'bouftou'].map((t, i) => w.spawnMonster(t, p.x + 400 + i * 60, p.y));
    const pv = g[0].maxHp;
    idolesGroupe(w, g, w.fxIdoles!);
    expect(g.filter(x => x.champion).length).toBe(1);
    expect(Math.max(...g.map(x => x.maxHp))).toBeGreaterThanOrEqual(pv * 3);
  });

  it('effets sur le perso : soins, critiques, charges, boucliers', () => {
    const sans = monde().player;
    const w = avecIdoles(['bihilete', 'jewai', 'minor', 'pluvior']), p = w.player;
    expect(p.critChance).toBe(0);
    expect(p.pmMax).toBe(Math.max(1, sans.pmMax - 1));
    p.hp = 1; expect(p.soigner(1000)).toBeLessThan(sans.maxHp);
    p.hp = 1; const n = p.soigner(100); sans.hp = 1;
    expect(n).toBeCloseTo(sans.soigner(100) / 2, -1);
    p.shield = 100; w.step(1 / 60, { ...NO_INPUT, aim: { x: p.x, y: p.y } });
    expect(p.shield).toBe(50);
  });

  it('éclairs de Zaihort et usure de Jiva pendant un combat', () => {
    const w = avecIdoles(['zaihort', 'jiva']), p = w.player;
    const m = w.spawnMonster('bouftou', p.x + 500, p.y);
    m.state = 'chase'; m.t = 0; (m as unknown as { atkCd: number }).atkCd = 999;
    const hp = p.hp;
    let vu = false;
    for (let i = 0; i < 60 * 5.2; i++) { m.state = 'chase'; m.x = p.x + 500; m.y = p.y; w.step(1 / 60, { ...NO_INPUT, aim: { x: p.x, y: p.y } }); vu ||= w.zonesIdoles.length > 0; }
    expect(vu).toBe(true);
    expect(p.hp).toBeLessThan(hp);
  });
});

describe('0.6 : élites à affixes (23A+23B)', () => {
  const ELITE = Object.keys(GAME_DATA.monsters).find(k => GAME_DATA.monsters[k].elite && !GAME_DATA.monsters[k].boss)!;
  it('2 affixes, 3 avec 30 points d\'idoles ; rien hors partie de test ni sur un monstre normal', () => {
    const w = monde(), p = w.player;
    expect(ELITE).toBeDefined();
    const e = w.spawnMonster(ELITE, p.x + 300, p.y);
    expect(e.affixes.length).toBe(2);
    expect(new Set(e.affixes).size).toBe(2);
    expect(w.spawnMonster('bouftou', p.x + 300, p.y).affixes).toEqual([]);
    expect(monde(false).spawnMonster(ELITE, p.x, p.y).affixes).toEqual([]);
    p.idoles.possedees.push('walet'); w.basculerIdole('walet');
    expect(w.spawnMonster(ELITE, p.x + 300, p.y).affixes.length).toBe(3);
  });
  it('Glacial laisse des flaques qui ralentissent ; Bouclier protège', () => {
    const w = monde(), p = w.player;
    const e = w.spawnMonster(ELITE, p.x + 40, p.y);
    e.affixes = ['glacial']; e.state = 'chase';
    for (let i = 0; i < 60 * 3.2; i++) { e.state = 'chase'; e.x = p.x + 20; e.y = p.y; w.step(1 / 60, { ...NO_INPUT, aim: { x: p.x, y: p.y } }); }
    expect(w.zonesIdoles.some(z => z.lent)).toBe(true);
    const b = w.spawnMonster(ELITE, p.x + 300, p.y);
    b.bouclier = 0; poserAffixes(b, ['bouclier']);
    expect(b.bouclier).toBe(Math.round(b.maxHp * 0.3));
  });
});

describe('0.6 : autels de combat (21) et Coffre Malveillant (22A)', () => {
  const pas = (w: World, n: number) => { for (let i = 0; i < n; i++) w.step(1 / 60, { ...NO_INPUT, aim: { x: w.player.x, y: w.player.y } }); };
  it('toucher un autel donne son effet 30 s : Frénésie, Protection', () => {
    const w = monde(), p = w.player, v0 = p.stat('vitesse');
    poserAutel(w, p.x, p.y, 'x', false, 'frenesie');
    pas(w, 2);
    expect(w.autels.length).toBe(0);
    expect(p.autel?.effet).toBe('frenesie');
    expect(p.stat('vitesse')).toBe(v0 + 60);
    pas(w, 60 * 31);
    expect(p.autel).toBeNull();
    const a = monde(), b = monde(), pa = a.player, pb = b.player;
    poserAutel(b, pb.x, pb.y, 'x', false, 'protection'); pas(b, 1);
    pa.invuln = pb.invuln = 0; pa.hurt(200, pa.x + 50, pa.y, a); pb.hurt(200, pb.x + 50, pb.y, b);
    expect(pb.maxHp - pb.hp).toBeLessThan((pa.maxHp - pa.hp) * 0.6);
  });
  it('le Coffre Malveillant fuit le joueur puis s\'enfuit au bout de 15 s', () => {
    const w = monde(), p = w.player, d = GAME_DATA.monsters.coffre_malveillant;
    const c = w.spawnMonster('coffre_malveillant', p.x + 200, p.y, defCoffreFuyard(d, 70));
    c.fuyard = true;
    expect(c.maxHp).toBe(Math.round(d.hp * 70 / 50));
    pas(w, 60);
    expect(c.fuiteT).toBeGreaterThan(0);
    pas(w, 60 * 16);
    expect(c.dead).toBe(true);
    expect(w.monsters.includes(c)).toBe(false);
  });
});

describe('0.6 : renommée de région (19) et sanctuaires des Douze (20)', () => {
  it('régions déjà faites : Astrub et Amakna ont leur renommée et leurs sanctuaires', () => {
    const w = monde(), R = regions(w);
    expect(R.get('Astrub')?.cartes.size).toBeGreaterThan(50);
    expect(R.get('Amakna')?.sanctuaires.length).toBe(6);
    expect(renommee(w, w.player, 'Amakna').palier).toBe(0);
  });
  it('un sanctuaire trouvé donne +2 pour toujours ; explorer une région donne ses paliers', () => {
    const w = monde(), p = w.player, s = regions(w).get('Astrub')!.sanctuaires[0], v0 = p.stat(s.carac);
    p.x = s.x; p.y = s.y;
    w.step(1 / 60, { ...NO_INPUT, aim: { x: p.x, y: p.y } });
    expect(p.sanctuaires).toContain(s.id);
    expect(p.stat(s.carac)).toBe(v0 + 2);
    const z = w.opts.zone!, I = regions(w).get('Astrub')!;
    p.explore[z] = [...I.cartes]; p.chasse[z] = [...I.cartes];
    const pep = p.resources[PEPITE] ?? 0, pts = p.points, pot = p.potionsMax;
    majRenommee(w, p);
    expect(p.renommee.Astrub).toBeGreaterThanOrEqual(3);
    expect(p.resources[PEPITE]).toBe(pep + 30);
    expect(p.points).toBe(pts + 5);
    expect(p.potionsMax).toBe(pot + 1);
    const w2 = monde(); restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.sanctuaires).toEqual(p.sanctuaires);
    expect(w2.player.renommee.Astrub).toBe(p.renommee.Astrub);
  });
});
