import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { EQUIP_SLOTS } from '../src/sim/items';
import { REGLAGES_TEST, caracPrincipale, type CommandeTest } from '../src/sim/outilsTest';
import { World } from '../src/sim/world';

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
});
