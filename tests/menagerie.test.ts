import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, FAMILIERS, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { rollItem } from '../src/sim/items';
import { FAMILIERS_SOURCES, ouTrouverFamilier, sourceFamilier } from '../src/sim/menagerie';
import { relireCoffre } from '../src/sim/coffre';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, familierXp: FAMILIERS.xp, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('Obtention des familiers (« Familiers : » 1A-1D 2D 3A 4A 4C 5A 5C 5D 6A-6C 7A 8A)', () => {
  it('58 familiers obtenables : familles, boss, invasion, Animalerie, succès ; les autres attendent leur zone', () => {
    const bonus = Object.keys(FAMILIERS.familiers).filter(id => !FAMILIERS.familiers[id].apparat);
    const succesDe = (id: string) => Object.entries(QUETES.succes).find(([, s]) => s.recompense?.objet === id)?.[0];
    const ok = bonus.filter(id => { const s = sourceFamilier(id, succesDe(id)); return s && s.k !== 'avenir'; });
    expect(ok.length).toBe(58);
    for (const [id, ms] of Object.entries(FAMILIERS_SOURCES.familles)) {
      expect(ITEMS.equipment[id]?.familier?.monstres).toEqual(ms);
      for (const m of ms) expect(GAME_DATA.monsters[m], m).toBeTruthy();
    }
    // chaque Pioute a sa couleur de Piou ; les boss du monde de la 0.5 ont le leur
    expect(ITEMS.equipment['7708'].familier!.monstres).toEqual(['piou_bleu', 'archi_piou_bleu']);
    expect(ITEMS.equipment['9623'].familier!.monstres).toContain('chef_crocodaille');
    expect(ouTrouverFamilier(sourceFamilier('9785'), k => k, k => k)).toContain('Enfers');
  });

  it('2D + 5C : tirage pur ; un familier déjà dans la Ménagerie ne tombe plus', () => {
    const w = monde();
    expect(w.contexteButin('piou_bleu', 'normal', 11).familiers).toEqual(['7708']);
    w.noterFamilier(rollItem('7708', ITEMS.equipment['7708'], 'commun', w.rng, 1));
    expect(w.contexteButin('piou_bleu', 'normal', 11).familiers).toEqual([]);
  });

  it('3A + 6A + 6B : il tombe au sol, toujours visible ; ramassé, il entre dans la Ménagerie et son apparence se débloque', () => {
    const w = monde(), p = w.player;
    p.lootFilter = 2;
    const it = rollItem('1748', ITEMS.equipment['1748'], 'commun', w.rng, 999);
    w.drops.push({ uid: 999, x: p.x, y: p.y, t: 1, item: it });
    expect(w.shown(w.drops[0])).toBe(true);
    w.step(1 / 60, NO_INPUT);
    expect(p.bag.some(o => o.id === '1748')).toBe(true);
    expect(w.menagerie()).toContain('1748');
    expect(p.apparats).toContain('1748');
    expect(APPARATS.objets['1748']?.slot).toBe('familier');
    expect(w.porterApparat('familier', '1748')).toBe(true);
    expect(w.drainEvents().some(e => e.k === 'menagerie')).toBe(true);
  });

  it('1B + 4A : l\'Animalerie vend les familiers domestiques en kamas (150 000 à 400 000)', () => {
    const w = monde(), p = w.player, id = '1728', prix = FAMILIERS_SOURCES.animalerie[id];
    expect(Object.values(FAMILIERS_SOURCES.animalerie).every(n => n >= 150000 && n <= 400000)).toBe(true);
    expect(w.acheterFamilier(id)).toBe(false);
    p.kamas = prix * 2;
    expect(w.acheterFamilier(id)).toBe(true);
    expect(p.kamas).toBe(prix);
    expect(w.acheterFamilier(id)).toBe(true);   // un double, pour le manger ou le donner
    expect(p.bag.filter(o => o.id === id).length).toBe(2);
    expect(w.acheterFamilier('7708')).toBe(false);   // pas vendu
  });

  it('4C : un familier offert au niveau 10, une seule fois', () => {
    const w = monde(), p = w.player;
    expect(w.prendreFamilierDeDepart('1728')).toBe(false);
    p.level = 10;
    expect(w.prendreFamilierDeDepart('7708')).toBe(false);   // pas dans le choix
    expect(w.prendreFamilierDeDepart('2074')).toBe(true);
    expect(w.prendreFamilierDeDepart('1728')).toBe(false);
    const w2 = monde(); restaurerJoueur(w2, JSON.parse(JSON.stringify(exporterJoueur(w))));
    expect(w2.player.familierOffert).toBe(true);
    expect(w2.player.menagerie).toContain('2074');
  });

  it('5A : un double donné à manger fait gagner 10 niveaux', () => {
    const w = monde(), p = w.player, d = ITEMS.equipment['1728'];
    p.equipment.familier = rollItem('1728', d, 'commun', w.rng, 50);
    const double = rollItem('1728', d, 'commun', w.rng, 51); p.bag.push(double);
    expect(w.nourrirFamilier({ uid: 51 })).toBe(true);
    expect(p.equipment.familier.niv).toBe(11);
  });

  it('5D : en groupe, on donne un familier à un ami proche', () => {
    const w = monde(), p = w.player, q = w.ajouterJoueur('cra');
    q.x = p.x + 40; q.y = p.y;
    p.bag.push(rollItem('1728', ITEMS.equipment['1728'], 'commun', w.rng, 77));
    expect(w.donnerFamilier(77, q.id)).toBe(true);
    expect(p.bag.some(o => o.uid === 77)).toBe(false);
    expect(q.bag.some(o => o.uid === 77)).toBe(true);
    expect(q.menagerie).toContain('1728');
  });

  it('7A : Ménagerie du compte, un autre perso sort le familier à son plus haut niveau', () => {
    const w = monde(), it = rollItem('1748', ITEMS.equipment['1748'], 'commun', w.rng, 5);
    it.niv = 30; w.noterFamilier(it);
    const coffre = relireCoffre(JSON.parse(JSON.stringify(w.coffre)));
    expect(coffre.familiers).toEqual({ '1748': 30 });
    const w2 = new World({ ...w.opts, coffre, seed: 2 }), p2 = w2.player;
    expect(w2.menagerie()).toContain('1748');
    expect(w2.contexteButin('wabbit', 'normal', 44).familiers).not.toContain('1748');
    expect(w2.sortirDeLaMenagerie('1748')).toBe(true);
    expect(p2.bag.find(o => o.id === '1748')?.niv).toBe(30);
    expect(w2.sortirDeLaMenagerie('1748')).toBe(false);   // déjà sur ce perso
  });

  it('6C + 1D : succès de la Ménagerie à 5, 15, 30 et 50 familiers (Molosk, Nomoon, Chachyène en récompense)', () => {
    const s = ['menagerie_5', 'menagerie_15', 'menagerie_30', 'menagerie_50'].map(k => QUETES.succes[k]);
    expect(s.every(Boolean)).toBe(true);
    expect(s.map(x => x.recompense?.objet)).toEqual([undefined, '19531', '6716', '15110']);
    expect(s[0].recompense?.titre).toBeTruthy();
  });
});
