import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE } from '../src/sim/items';
import { BOSS_MONDE, VIVANT, bonusWeekEnd, bossDuCreneau, candidatsInvasion, heureDe, invasionDe, rendezVous } from '../src/sim/mondeVivant';
import type { EtatQuetes } from '../src/sim/quests';
import type { SimEvent } from '../src/sim/events';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
/** Heure de Paris « murale » (comme si Paris était à l'heure UTC). */
const paris = (j: number, h: number, m = 0) => Date.UTC(2026, 10, j, h, m) / 1000;
function monde(s: { t: number }) {
  return new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 11, items: ITEMS, quetes: QUETES,
    boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-13', horloge: () => s.t });
}
function avancer(w: World, sec: number, s: { t: number }, ev: SimEvent[] = []) {
  for (let t = 0; t < sec; t += 0.05) { w.player.invuln = 1e9; s.t += 0.05; w.step(0.05, NO_INPUT); ev.push(...w.drainEvents()); }
  return ev;
}
/** Le perso à côté de (x, y), et plus aucun monstre sauvage autour. */
function aCote(w: World, x: number, y: number, d = 300) {
  const p = w.player, f = w.map.nearestFree(x + d, y);
  p.x = f.x; p.y = f.y; p.invuln = 1e9;
  return p;
}
const tuer = (w: World, filtre: (m: World['monsters'][number]) => boolean) => { for (const m of w.monsters) if (!m.dead && filtre(m)) { m.intouchable = false; m.hp = 0; w.killMonster(m); } };

describe('0.5 « monde vivant » : les rendez-vous (2A 2D 2E 1C)', () => {
  it('un boss toutes les 3 h ; le Maître Vampire seulement à 21 h et à minuit ; les autres tournent chaque jour', () => {
    const P = VIVANT.boss.periode;
    expect(P).toBe(3 * 3600);
    for (let j = 10; j < 17; j++) {
      const jour: string[] = [];
      for (let h = 0; h < 24; h += 3) {
        const c = paris(j, h) / P, cle = bossDuCreneau(c);
        expect(BOSS_MONDE[cle], cle).toBeTruthy();
        expect(cle === 'maitre_vampire', `${j} ${h} h`).toBe(h === 0 || h === 21);
        jour.push(cle);
      }
      expect(new Set(jour).size).toBe(4);   // les quatre boss chaque jour
    }
    expect(bossDuCreneau(paris(12, 6) / P)).not.toBe(bossDuCreneau(paris(13, 6) / P));   // la rotation avance d'un cran par jour
  });

  it('en cours pendant 30 min, puis le prochain ; heure de Paris', () => {
    const rv = rendezVous(paris(13, 9, 10));
    expect(rv.enCours?.debut).toBe(paris(13, 9));
    expect(rendezVous(paris(13, 9, 40)).enCours).toBeNull();
    expect(rv.suivant.debut).toBe(paris(13, 12));
    expect(heureDe(rv.suivant.debut)).toBe(12);
  });

  it('6B : toujours une invasion, une sous-zone d’Amakna ou d’Astrub par heure, jamais deux fois de suite', () => {
    const c = candidatsInvasion(GAME_DATA);
    expect(c.length).toBeGreaterThan(20);
    let avant = -1;
    for (let h = 0; h < 48; h++) {
      const i = invasionDe(paris(13, 0) + h * 3600 + 120, c)!;
      expect(c).toContain(i.sub);
      expect(i.sub).not.toBe(avant);
      expect(i.fin - i.debut).toBe(3600);
      avant = i.sub;
    }
  });

  it('9B : un bonus officiel le samedi et le dimanche, à tour de rôle', () => {
    expect(bonusWeekEnd(paris(13, 20))).toBeNull();   // vendredi
    const sam = bonusWeekEnd(paris(14, 10)), dim = bonusWeekEnd(paris(15, 23)), sam2 = bonusWeekEnd(paris(21, 10));
    expect(sam).not.toBeNull();
    expect(dim).toEqual(sam);
    expect(sam2!.id).not.toBe(sam!.id);
    expect(bonusWeekEnd(paris(16, 0))).toBeNull();   // lundi
  });
});

describe('0.5 : boss du monde (1A 1D 3A 3C 3D 4A-4D)', () => {
  /** Le créneau de 6 h ou 9 h qui tombe sur le boss voulu. */
  function creneau(cle: string) {
    for (let j = 10; j < 20; j++) for (let h = 3; h < 21; h += 3) if (bossDuCreneau(paris(j, h) / VIVANT.boss.periode) === cle) return paris(j, h);
    throw new Error(cle);
  }

  it('annoncé 10 min avant, posé quand on approche, au niveau de sa zone, avec les PV d’un boss du monde', () => {
    const debut = creneau('chef_de_guerre_bouftou'), s = { t: debut - 11 * 60 }, w = monde(s);
    let ev = avancer(w, 70, s);
    expect(ev.some(e => e.k === 'bossMondeAnnonce' && e.cle === 'chef_de_guerre_bouftou')).toBe(true);
    s.t = debut + 5;
    ev = avancer(w, 0.2, s);
    expect(ev.some(e => e.k === 'bossMondeArrive')).toBe(true);
    const b = w.vivant!.boss!;
    expect(b.pose).toBe(false);   // personne autour
    aCote(w, b.centre.x, b.centre.y);
    avancer(w, 0.2, s);
    const m = w.monsters.find(x => x.bossMonde === 'chef_de_guerre_bouftou')!;
    expect(m).toBeTruthy();
    expect(m.def.boss).toBe(true);
    expect(m.def.level).toBe(30);
    expect(m.maxHp).toBe(VIVANT.boss.pv.base + VIVANT.boss.pv.parNiveau * 30);
    expect(m.def.signature).toBeTruthy();   // son vrai sort officiel en grand
  });

  it('paliers à 66 % et 33 % : sa garde arrive et il est intouchable ; secousse annoncée au sol', () => {
    const debut = creneau('chef_crocodaille'), s = { t: debut + 5 }, w = monde(s);
    avancer(w, 0.1, s);
    const b = w.vivant!.boss!;
    aCote(w, b.centre.x, b.centre.y, 150);
    avancer(w, 0.2, s);
    const m = w.monsters.find(x => x.bossMonde)!;
    m.hp = m.maxHp * 0.6;
    const ev = avancer(w, 0.2, s);
    expect(ev.some(e => e.k === 'bossMondePalier' && e.n === 1)).toBe(true);
    expect(m.intouchable).toBe(true);
    expect(b.renforts.length).toBeGreaterThanOrEqual(VIVANT.boss.renforts);
    tuer(w, x => b.renforts.includes(x));
    avancer(w, 0.2, s);
    expect(m.intouchable).toBe(false);
    // la secousse finit par venir, annoncée au sol
    const ev2 = avancer(w, VIVANT.boss.seisme.relance[0] + VIVANT.boss.seisme.telegraphe + 1, s);
    expect(ev2.some(e => e.k === 'slam' && e.radius === VIVANT.boss.seisme.rayon)).toBe(true);
  });

  it('3D : 5 minutes après le premier coup, il repart sans rien laisser', () => {
    const debut = creneau('chef_de_guerre_bouftou'), s = { t: debut + 5 }, w = monde(s);
    avancer(w, 0.1, s);
    const b = w.vivant!.boss!;
    aCote(w, b.centre.x, b.centre.y, 1200);
    avancer(w, 0.2, s);
    const m = w.monsters.find(x => x.bossMonde)!;
    m.hp -= 10;
    const ev = avancer(w, VIVANT.boss.minuterie + 1, s);
    expect(ev.some(e => e.k === 'bossMondeCombat')).toBe(true);
    expect(ev.some(e => e.k === 'bossMondeFin' && e.fin === 'enfui')).toBe(true);
    expect(w.monsters.some(x => x.bossMonde && !x.dead)).toBe(false);
    expect(w.player.vivant.boss).toEqual([]);
  });

  it('4A-4D : vaincu = coffre (un Rare au moins), Pépites, titre la première fois ; une seule fois par apparition', () => {
    const debut = creneau('chef_de_guerre_bouftou'), s = { t: debut + 5 }, w = monde(s), p = w.player;
    avancer(w, 0.1, s);
    const b = w.vivant!.boss!;
    aCote(w, b.centre.x, b.centre.y, 200);
    avancer(w, 0.2, s);
    const pep = p.resources[PEPITE] ?? 0;
    w.drops = [];
    tuer(w, x => !!x.bossMonde);
    const ev = avancer(w, 0.2, s);
    const v = ev.find(e => e.k === 'bossMondeVaincu');
    expect(v && v.k === 'bossMondeVaincu' && v.premier).toBe(true);
    expect(p.resources[PEPITE]).toBe(pep + VIVANT.boss.recompense.pepites);
    expect(w.drops.some(d => d.item && ['rare', 'epique', 'legendaire', 'mythique'].includes(d.item.rarity))).toBe(true);
    expect(p.vivant.boss).toEqual(['chef_de_guerre_bouftou']);
    expect(p.vivant.apparitions).toContain(b.creneau);
    expect(w.quetes!.succes.has('boss_monde_chef_de_guerre_bouftou')).toBe(true);
    expect(QUETES.succes.boss_monde_chef_de_guerre_bouftou.recompense?.titre).toBe('Maître de guerre');
    expect(w.vivant!.boss!.fin).toBe('vaincu');
  });

  it('la nuit, le Maître Vampire attend au Cimetière', () => {
    const s = { t: paris(13, 21, 2) }, w = monde(s);
    avancer(w, 0.1, s);
    expect(w.vivant!.boss?.cle).toBe('maitre_vampire');
    expect(w.worldGrid!.mapAt(w.vivant!.boss!.centre.x, w.vivant!.boss!.centre.y)?.sub).toBe(BOSS_MONDE.maitre_vampire.sousZone);
  });
});

describe('0.5 : invasions (5B 6B 7A 7B)', () => {
  it('la sous-zone envahie a des groupes plus gros et plus durs ; jauge, Éclats Obscurs, Pépites et coffre', () => {
    const s = { t: paris(13, 10, 5) }, w = monde(s), p = w.player;
    avancer(w, 0.1, s);
    const inv = w.vivant!.invasion!;
    expect(inv).toBeTruthy();
    const c = w.vivant!.centreSousZone(inv.sub);
    aCote(w, c.x, c.y, 0);
    avancer(w, 0.5, s);
    const envahis = w.monsters.filter(m => m.envahi && !m.dead);
    expect(envahis.length).toBeGreaterThan(0);
    const m = envahis[0];
    expect(m.maxHp).toBe(Math.round(GAME_DATA.monsters[m.type].hp * VIVANT.invasion.pv));
    // on remplit la jauge en tuant des envahisseurs (nouvelles vagues posées à la main)
    const pep = p.resources[PEPITE] ?? 0;
    let n = 0;
    while (!inv.pleine && n++ < 400) {
      const e = w.spawnMonster(m.type, p.x + 40, p.y, w.vivant!.defEnvahi(m.type)); e.envahi = true; e.homeX = c.x; e.homeY = c.y;
      e.hp = 0; w.killMonster(e);
    }
    expect(inv.pleine).toBe(true);
    expect(p.resources[PEPITE]).toBe(pep + VIVANT.invasion.pepites);
    expect(p.vivant.invasions).toBe(1);
    expect(p.resources[VIVANT.invasion.eclat]).toBeGreaterThanOrEqual(inv.max);
    expect(inv.coffre).not.toBeNull();
    // 7B : le coffre s'ouvre avec des Éclats
    const avant = p.resources[VIVANT.invasion.eclat];
    w.drops = [];
    expect(w.vivant!.ouvrirCoffreInvasion(p)).toBe(true);
    expect(p.resources[VIVANT.invasion.eclat]).toBe(avant - VIVANT.invasion.coffre.prix);
    expect(w.drops.some(d => d.item && d.item.rarity !== 'commun')).toBe(true);
    // à l'heure suivante, les éclats se dissipent
    s.t = paris(13, 11, 1);
    avancer(w, 0.1, s);
    expect(p.resources[VIVANT.invasion.eclat] ?? 0).toBe(0);
    expect(w.vivant!.invasion!.heure).toBe(inv.heure + 1);
  });
});

describe('0.5 : petits événements (8A 8B) et week-end (9B)', () => {
  it('8B : un coffre gardé par une élite, puis deux vagues ; vaincus, il s’ouvre (un Rare au moins)', () => {
    const s = { t: paris(13, 10, 5) }, w = monde(s), p = w.player;
    avancer(w, 0.1, s);
    expect(w.commeJoueur(p, () => w.vivant!.lancerEvenement(p, 'coffre'))).toBe(true);
    const e = w.vivant!.evenements[0];
    expect(e.monstres[0].def.elite).toBe(true);
    w.drops = [];
    for (let k = 0; k < 6 && !e.fin; k++) { tuer(w, m => m.evenement === e.id); avancer(w, 2.5, s); }
    expect(e.fin).toBe('reussi');
    expect(w.drops.some(d => d.item && d.item.rarity !== 'commun')).toBe(true);
    expect(p.vivant.evenements).toBe(1);
  });

  it('8A : un habitant à défendre ; les monstres foncent sur lui ; laissé seul, il s’enfuit', () => {
    const s = { t: paris(13, 10, 5) }, w = monde(s), p = w.player;
    avancer(w, 0.1, s);
    expect(w.commeJoueur(p, () => w.vivant!.lancerEvenement(p, 'defense'))).toBe(true);
    const e = w.vivant!.evenements[0];
    expect(e.habitant).toBeTruthy();
    // le perso s'éloigne un peu (sans abandonner) : personne ne défend
    const f = w.map.nearestFree(e.x - 700, e.y); p.x = f.x; p.y = f.y;
    const ev = avancer(w, VIVANT.evenements.defense.duree, s);
    expect(e.pv).toBeLessThan(100);
    expect(ev.some(x => x.k === 'evenementDebut')).toBe(true);
  });

  it('9B : +50 % d’XP le week-end où il tombe', () => {
    let sam = paris(14, 10);
    for (let k = 0; k < 4 && bonusWeekEnd(sam)?.cle !== 'xp'; k++) sam += 7 * 86400;
    expect(bonusWeekEnd(sam)?.cle).toBe('xp');
    const xp = (t: number) => {
      const s = { t }, w = monde(s), p = w.player;
      const m = w.spawnMonster('bouftou', p.x + 40, p.y); m.hp = 0;
      const x0 = p.xp; w.killMonster(m);
      return p.xp - x0;
    };
    expect(xp(sam)).toBeCloseTo(xp(sam - 2 * 86400) * 1.5, -1);
  });
});
