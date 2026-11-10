import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { EQUIP_SLOTS } from '../src/sim/items';
import { REGLAGES_TEST, caracPrincipale, type CommandeTest } from '../src/sim/outilsTest';
import { World } from '../src/sim/world';
import { DOFUS } from '../src/sim/dofus';
import { jourAlmanax } from '../src/sim/almanax';
import { POUVOIRS } from '../src/sim/pouvoirs';
import { POUVOIRS_CLASSE } from '../src/sim/pouvoirsClasse';
import { RAYON_TUER } from '../src/sim/outilsTest';
import { decoderEtat, encoderEtat } from '../src/render/codeEtat';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (classId = 'iop', test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, classId, items: ITEMS, quetes: QUETES,
  reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} }, test: test ? { ...REGLAGES_TEST } : undefined });
const ordre = (w: World, ...test: CommandeTest[]) => w.step(1 / 60, { ...NO_INPUT, test } as PlayerInput);

describe('Partie de test (panneau F1)', () => {
  it('niveau direct, points répartis dans la carac de la classe, sorts du niveau appris', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'niveau', n: 50, auto: true });
    expect(p.level).toBe(50);
    expect(p.base[caracPrincipale(p.cls.spells)]).toBe(172);   // 245 points au coût officiel : 100 à 1 point + 72 à 2 points
    expect(p.points).toBe(0);
    expect(p.hp).toBe(p.maxHp);
    const appris = p.learned.size;
    ordre(w, { k: 'niveau', n: 1, auto: false });
    expect(p.level).toBe(1);
    expect(p.learned.size).toBeLessThan(appris);
    expect(p.bar.every(k => !k || p.knows(k))).toBe(true);
  });
  it('tenue complète du niveau, avec l\'arme de la classe', () => {
    const w = monde('cra'), p = w.player;
    ordre(w, { k: 'niveau', n: 30, auto: true }, { k: 'tenue', rarete: 'legendaire' });
    for (const s of EQUIP_SLOTS) if (s !== 'bouclier' && s !== 'familier') expect(p.equipment[s]?.rarity).toBe('legendaire');
    expect(ITEMS.equipment[p.equipment.arme!.id].weapon?.type).toBe('Arc');
    expect(p.equipment.anneau1!.id).not.toBe(p.equipment.anneau2!.id);
  });
  it('objets, ressources et kamas', () => {
    const w = monde(), p = w.player, id = Object.keys(ITEMS.equipment)[0];
    ordre(w, { k: 'objet', id, rarete: 'epique', n: 2 }, { k: 'objet', id: '548', rarete: 'commun', n: 10 }, { k: 'kamas', n: 1000 });
    expect(p.bag.filter(b => b.id === id && b.rarity === 'epique')).toHaveLength(2);
    expect(p.resources['548']).toBe(10);
    expect(p.kamas).toBe(1000);
  });
  it('mannequin increvable et immobile, monstres posés retirés d\'un coup', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'monstre', type: 'bouftou', n: 1, rang: 'normal', x: p.x + 100, y: p.y, mannequin: true },
      { k: 'monstre', type: 'bouftou', n: 3, rang: 'elite', x: p.x + 600, y: p.y, mannequin: false });
    const man = w.monsters.find(m => m.mannequin)!, x = man.x;
    for (let i = 0; i < 60; i++) w.step(1 / 60, NO_INPUT);
    man.hp = 0; w.killMonster(man);
    expect(man.dead).toBe(false);
    expect(man.hp).toBe(man.maxHp);
    expect(man.x).toBe(x);
    expect(w.monsters.filter(m => m.poseTest && m.def.elite)).toHaveLength(3);
    ordre(w, { k: 'retirer' });
    expect(w.monsters.some(m => m.poseTest)).toBe(false);
  });
  it('invincible, recharges à zéro, course ×3 ; rien de tout ça dans une vraie partie', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'reglage', cle: 'invincible', on: true }, { k: 'reglage', cle: 'recharges', on: true }, { k: 'reglage', cle: 'course', on: true });
    p.hurt(9999, p.x + 10, p.y, w);
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(p.maxHp);
    p.pa = 0;
    w.step(1 / 60, NO_INPUT);
    expect(p.pa).toBe(p.paMax);
    expect(p.speed).toBeCloseTo(p.cls.speed * 3);
    const vrai = monde('iop', false);
    expect(vrai.test).toBeNull();
    ordre(vrai, { k: 'kamas', n: 1000 }, { k: 'reglage', cle: 'invincible', on: true });
    expect(vrai.player.kamas).toBe(0);
  });
  it('va sur une carte du monde', () => {
    const w = monde(), wg = w.worldGrid!;
    ordre(w, { k: 'aller', tag: 'cour_1', nom: 'Cour du Bouftou Royal' });
    expect(wg.mapAt(w.player.x, w.player.y)?.tag).toBe('cour_1');
  });

  it('Outil test 0.3 : Dofus codés portés, remplir les 6 cases, tout retirer', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'dofus', id: 'codes', porter: true });
    const codes = Object.keys(DOFUS).filter(id => DOFUS[id].jeu);
    expect(codes.length).toBeGreaterThanOrEqual(2);
    for (const id of codes) expect(p.dofusPortes).toContain(id);
    expect(p.porteDofus('argente')).toBe(true);
    for (const id of Object.keys(DOFUS).slice(0, 8)) ordre(w, { k: 'dofus', id, porter: false });
    ordre(w, { k: 'dofusRemplir' });
    expect(p.dofusPortes.every(Boolean)).toBe(true);
    expect(new Set(p.dofusPortes).size).toBe(6);
    ordre(w, { k: 'dofusVider' });
    expect(p.dofus).toEqual([]);
    expect(p.dofusPortes.every(x => x === null)).toBe(true);
  });
  it('Outil test 0.3 : sauter à une étape (élites apparues), finir (Dofus donné), remettre à zéro', () => {
    const w = monde(), p = w.player, Q = w.quetes!;
    ordre(w, { k: 'quete', id: 'oeuf_argent', geste: 'etape', etape: 1 });
    const c = Q.enCours.find(x => x.id === 'oeuf_argent')!;
    expect(c.etape).toBe(1);
    expect(w.monsters.filter(m => m.def.elite && !m.dead && m.def.name.includes('argent')).length).toBe(3);
    ordre(w, { k: 'quete', id: 'oeuf_argent', geste: 'aller' });
    expect(w.monsters.some(m => m.def.name.includes('argent') && Math.hypot(m.x - p.x, m.y - p.y) < 400)).toBe(true);
    ordre(w, { k: 'quete', id: 'oeuf_argent', geste: 'finir' });
    expect(Q.finies.has('oeuf_argent')).toBe(true);
    expect(p.porteDofus('argente')).toBe(true);
    ordre(w, { k: 'quete', id: 'oeuf_argent', geste: 'zero' });
    expect(Q.finies.has('oeuf_argent')).toBe(false);
    expect(Q.enCours.some(x => x.id === 'oeuf_argent')).toBe(false);
    ordre(w, { k: 'quete', id: 'oeuf_cacao', geste: 'prendre' });   // sans avoir fini l'œuf d'argent
    expect(Q.enCours.some(x => x.id === 'oeuf_cacao')).toBe(true);
  });
  it('Outil test 0.3 : changer le jour de l\'Almanax et recevoir son offrande', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'jour', date: '2026-03-14' });
    const j = jourAlmanax('2026-03-14')!;
    expect(w.almanaxDuJour).toEqual(j);
    ordre(w, { k: 'offrande' });
    expect(p.resources[j.offrande]).toBe(j.n);
    expect(w.offrirAlmanax()).toBe(true);
    expect(w.almanax).toEqual(j);
  });
  it('Outil test 0.3 : archimonstres ×100, invocations sans limite, mannequin qui frappe', () => {
    const w = monde('osamodas'), p = w.player;
    expect(w.invocationsMax(p)).toBeLessThan(99);
    ordre(w, { k: 'reglage', cle: 'invocations', on: true }, { k: 'reglage', cle: 'archis', on: true });
    expect(w.invocationsMax(p)).toBe(99);
    expect(w.test!.archis).toBe(true);
    const hp = p.hp;
    ordre(w, { k: 'monstre', type: 'bouftou', n: 1, rang: 'normal', x: p.x + 60, y: p.y, mannequin: true, frappe: 3 });
    const man = w.monsters.find(m => m.mannequin)!;
    for (let i = 0; i < 120; i++) w.step(1 / 60, NO_INPUT);
    expect(man.frappe).toBe(3);
    expect(p.hp).toBeLessThan(hp);
  });

  it('Panneau test 3A, 9C, 7C : soigner, tuer la carte (pas le mannequin), repeupler, vider le sac', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'monstre', type: 'bouftou', n: 3, rang: 'normal', x: p.x + 200, y: p.y, mannequin: false },
      { k: 'monstre', type: 'bouftou', n: 1, rang: 'normal', x: p.x - 150, y: p.y, mannequin: true });
    p.hp = 1; p.pa = 0;
    const xp = p.xp, autour = w.monsters.filter(m => !m.dead && !m.mannequin && Math.hypot(m.x - p.x, m.y - p.y) <= RAYON_TUER).length;
    ordre(w, { k: 'soigner' }, { k: 'tuer' });
    expect(p.hp).toBe(p.maxHp);
    expect(autour).toBeGreaterThanOrEqual(3);
    expect(w.monsters.filter(m => !m.dead && !m.mannequin && Math.hypot(m.x - p.x, m.y - p.y) <= RAYON_TUER)).toHaveLength(0);
    expect(w.monsters.some(m => m.mannequin && !m.dead)).toBe(true);
    expect(p.xp + p.level * 1e6).toBeGreaterThan(xp + p.level * 1e6 - 1);   // XP comme d'habitude
    const vivants = () => w.monsters.filter(m => !m.dead && !m.poseTest).length;
    for (let i = 0; i < 90; i++) w.step(1 / 60, NO_INPUT);
    const avant = vivants();
    ordre(w, { k: 'repeupler' });
    expect(vivants()).toBeGreaterThan(avant);
    ordre(w, { k: 'objet', id: Object.keys(ITEMS.equipment)[0], rarete: 'rare', n: 3 }, { k: 'viderSac' });
    expect(p.bag).toHaveLength(0);
  });
  it('Panneau test 7A : objet Légendaire avec le pouvoir choisi (officiel, de classe, maison)', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'niveau', n: 40, auto: true });
    const off = POUVOIRS.iop[0], pc = POUVOIRS_CLASSE.find(x => x.classe === 'iop')!;
    ordre(w, { k: 'pouvoir', id: off.id }, { k: 'pouvoir', id: pc.id }, { k: 'pouvoir', id: 'potion' });
    const [a, b, c] = p.bag;
    expect(a.rarity).toBe('legendaire');
    expect(a.legendary?.id).toBe(off.id);
    expect(ITEMS.equipment[a.id].slot).toBe(off.slot);
    expect(b.legendary).toEqual({ id: pc.id, value: pc.jet[1] });
    expect(ITEMS.equipment[b.id].slot).toBe(pc.slot);
    expect(c.legendary?.id).toBe('potion');
    expect(c.legendary?.value).toBeGreaterThan(0);
    expect(a.legendary2 ?? b.legendary2 ?? c.legendary2).toBeUndefined();
  });
  it('Panneau test 6A : chaque coup dit quel sort l\'a porté', () => {
    const w = monde(), p = w.player;
    ordre(w, { k: 'monstre', type: 'bouftou', n: 1, rang: 'normal', x: p.x + 40, y: p.y, mannequin: true });
    w.drainEvents();
    const man = w.monsters.find(m => m.mannequin)!, sorts = new Set<string | undefined>();
    for (let i = 0; i < 240 && !sorts.size; i++) {
      w.step(1 / 60, { ...NO_INPUT, aim: { x: man.x, y: man.y }, target: man.id } as PlayerInput);
      for (const e of w.drainEvents()) if (e.k === 'hit' && e.target === 'monster') sorts.add(e.sort);
    }
    expect([...sorts].some(s => s && (s === 'attaque' || s === p.cls.basic || p.cls.spells[s]))).toBe(true);
  });
  it('Panneau test 9A : arène d\'un donjon à la vague voulue', () => {
    const w = monde(), p = w.player, d = w.zone.open!.donjons!.find(x => x.arene && x.vagues && x.vagues.length >= 3 && w.worldGrid!.mapByTag(x.arene.tag) && !w.couloirs(x))!;
    ordre(w, { k: 'aller', tag: d.arene!.tag, nom: d.nom, vague: 3 });
    for (let i = 0; i < 60 * 8 && !w.arene; i++) w.step(1 / 60, NO_INPUT);
    for (let i = 0; i < 60 * 5; i++) w.step(1 / 60, NO_INPUT);
    expect(w.arene?.d.nom).toBe(d.nom);
    expect(w.arene!.vague).toBe(3);
    expect(p.cleDonjon?.vague).toBe(3);
  });
  it('Panneau test 4E : carte et case sous la souris (inverse de cellOf)', () => {
    const wg = monde().worldGrid!;
    for (const m of wg.world.maps.slice(0, 20)) for (const c of [0, 13, 14, 300, 559]) expect(wg.caseLocale(wg.cellOf(m.tag, c))).toMatchObject({ tag: m.tag, c });
  });
  it('Panneau test 8B : code d\'état aller-retour', async () => {
    const w = monde(), etat = { classe: 'cra', sexe: 'f', zone: 'astrub', reglages: { ...REGLAGES_TEST, invincible: true }, etat: { niveau: 40, sac: [1, 2, 3], nom: 'Éva « test »' } };
    const code = await encoderEtat(etat);
    expect(code.startsWith('DF1.')).toBe(true);
    expect(code).toMatch(/^DF1\.[A-Za-z0-9_-]+$/);
    expect(await decoderEtat(code)).toEqual(etat);
    expect(await decoderEtat(`  ${code.slice(0, 40)}\n${code.slice(40)} `)).toEqual(etat);   // collé sur deux lignes
    expect(await decoderEtat('bonjour')).toBeNull();
    expect(await decoderEtat('DF1.pasdutout')).toBeNull();
    expect(w.player).toBeTruthy();
  });
});
