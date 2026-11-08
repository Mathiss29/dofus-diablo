import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE, rollItem } from '../src/sim/items';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const objet = (w: World, id: string, rarete: 'commun' | 'rare' = 'commun') => {
  const it = rollItem(id, ITEMS.equipment[id], rarete, w.rng, w.newUid()); w.player.bag.push(it); return it;
};
const id = (slot: string) => Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].slot === slot)!;

describe('Équipement en trop : collection d\'apparences (1C)', () => {
  it('les coiffes, capes et boucliers du jeu sont dans la collection, jamais vendus par Tissebelle', () => {
    const col = Object.entries(APPARATS.objets).filter(([, d]) => d.collection);
    expect(col.length).toBeGreaterThan(80);
    expect(new Set(col.map(([, d]) => d.slot))).toEqual(new Set(['chapeau', 'cape', 'bouclier']));
    const w = monde(); w.player.resources[PEPITE] = 9999;
    expect(w.acheterApparat(col[0][0])).toBe(false);
  });

  it('briser ou recycler le premier exemplaire débloque son apparence, une seule fois ; elle se porte et se garde', () => {
    const w = monde(), p = w.player, bouclier = id('bouclier'), cape = id('cape'), anneau = id('anneau');
    const a = objet(w, bouclier), b = objet(w, bouclier), c = objet(w, cape), d = objet(w, anneau);
    expect(w.porterApparat('bouclier', bouclier)).toBe(false);
    w.drainEvents();
    expect(w.briserObjet(a.uid)).toBe(true);
    expect(p.apparats).toEqual([bouclier]);
    expect(w.drainEvents().filter(e => e.k === 'apparence')).toHaveLength(1);
    w.recycle(b.uid);
    expect(w.drainEvents().some(e => e.k === 'apparence')).toBe(false);   // déjà dans la collection
    w.briserChoix([c.uid, d.uid]);
    expect(p.apparats).toEqual([bouclier, cape]);   // l'anneau ne se voit pas
    expect(w.porterApparat('bouclier', bouclier)).toBe(true);
    expect(w.porterApparat('chapeau', cape)).toBe(false);
    const w2 = monde(); restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.apparats).toEqual([bouclier, cape]);
    expect(w2.player.apparat.bouclier).toBe(bouclier);
  });

  it('un succès par panoplie dont toutes les pièces visibles sont collectionnées', () => {
    const w = monde(), [sid, s] = Object.entries(QUETES.succes).find(([k]) => k.startsWith('garde_robe_'))!;
    expect(s.categorie).toBe('Collection');
    for (const o of s.objectifs) { const it = objet(w, (o as { apparence: string }).apparence); w.briserObjet(it.uid); }
    for (let i = 0; i < 3; i++) w.step(0.05, NO_INPUT);
    expect(w.quetes!.succes.has(sid)).toBe(true);
  });
});

describe('Équipement en trop : Communs brisés au ramassage (5B)', () => {
  it('réglage coché : le Commun ramassé part en runes (et en collection), le Rare va au sac ; gardé dans la sauvegarde', () => {
    const w = monde(), p = w.player, cape = id('cape');
    const poser = (rarete: 'commun' | 'rare') => w.drops.push({ uid: w.newUid(), x: p.x, y: p.y, t: 1, item: rollItem(cape, ITEMS.equipment[cape], rarete, w.rng, w.newUid()) });
    poser('commun');
    w.step(0.05, NO_INPUT);
    expect(p.bag).toHaveLength(1);   // réglage décoché : dans le sac
    p.bag = []; p.autoBrisage = true; w.drainEvents();
    poser('commun');
    w.step(0.05, NO_INPUT);
    expect(p.bag).toHaveLength(0);
    const ev = w.drainEvents();
    expect(ev.find(e => e.k === 'brisage')).toMatchObject({ auto: cape });
    expect(p.apparats).toContain(cape);
    const rare = rollItem(cape, ITEMS.equipment[cape], 'rare', w.rng, w.newUid());
    w.drops.push({ uid: w.newUid(), x: p.x, y: p.y, t: 1, item: rare }); p.pickupId = w.drops[w.drops.length - 1].uid;
    w.step(0.05, NO_INPUT);
    expect(p.bag).toEqual([rare]);
    const w2 = monde(); restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.autoBrisage).toBe(true);
  });
});
