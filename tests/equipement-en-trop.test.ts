import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { rollItem } from '../src/sim/items';
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
  });

  it('défaire le premier exemplaire débloque son apparence, une seule fois ; elle se porte et se garde', () => {
    const w = monde(), p = w.player, bouclier = id('bouclier'), cape = id('cape'), anneau = id('anneau');
    const a = objet(w, bouclier), b = objet(w, bouclier), c = objet(w, cape), d = objet(w, anneau);
    expect(w.porterApparat('bouclier', bouclier)).toBe(false);
    w.drainEvents();
    expect(w.briserObjet(a.uid)).toBe(true);
    expect(p.apparats).toEqual([bouclier]);
    expect(w.drainEvents().filter(e => e.k === 'apparence')).toHaveLength(1);
    w.briserObjet(b.uid);
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
    expect([s.categorie, s.sousCategorie]).toEqual(['Général', 'Garde-robe']);
    for (const o of s.objectifs) { const it = objet(w, (o as { apparence: string }).apparence); w.briserObjet(it.uid); }
    for (let i = 0; i < 3; i++) w.step(0.05, NO_INPUT);
    expect(w.quetes!.succes.has(sid)).toBe(true);
  });
});

describe('Défaire au ramassage (Magasin 10A, 10C, 10D)', () => {
  // une cape sans panoplie (sinon cadenas automatique), et une cape portée qui vaut mieux qu'un Commun
  const capeSeule = () => Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].slot === 'cape' && ITEMS.equipment[k].set == null && ITEMS.equipment[k].level <= 10)!;
  const poser = (w: World, cape: string, rarete: 'commun' | 'rare' | 'legendaire') => {
    const it = rollItem(cape, ITEMS.equipment[cape], rarete, w.rng, w.newUid());
    w.drops.push({ uid: w.newUid(), x: w.player.x, y: w.player.y, t: 1, item: it }); w.player.pickupId = w.drops[w.drops.length - 1].uid;
    w.step(0.05, NO_INPUT); return it;
  };
  it('réglage « Communs » : le Commun part en runes, kamas et collection ; le Rare va au sac ; gardé dans la sauvegarde', () => {
    const w = monde(), p = w.player, cape = capeSeule();
    p.level = 30;
    const portee = rollItem(cape, ITEMS.equipment[cape], 'legendaire', w.rng, w.newUid()); portee.stats = { vitalite: 500 }; p.equipment.cape = portee;
    poser(w, cape, 'commun');
    expect(p.bag).toHaveLength(1);   // réglage « Jamais » : dans le sac
    p.bag = []; p.autoDefaire = 'commun'; w.drainEvents();
    const k0 = p.kamas;
    poser(w, cape, 'commun');
    expect(p.bag).toHaveLength(0);
    expect(p.kamas).toBeGreaterThan(k0);
    expect(w.drainEvents().find(e => e.k === 'brisage')).toMatchObject({ auto: cape });
    expect(p.apparats).toContain(cape);
    const rare = poser(w, cape, 'rare');
    expect(p.bag).toEqual([rare]);
    p.autoDefaire = 'rare'; p.bag = [];
    poser(w, cape, 'rare');
    expect(p.bag).toHaveLength(0);
    const w2 = monde(); restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.autoDefaire).toBe('rare');
  });
  it('jamais un objet meilleur que celui porté (flèche verte), et cadenas tout seul sur les Légendaires et les panoplies', () => {
    const w = monde(), p = w.player, cape = capeSeule();
    p.level = 30; p.autoDefaire = 'rare';
    const it = poser(w, cape, 'commun');   // rien de porté : il vaut mieux, il reste
    expect(p.bag).toEqual([it]);
    const leg = poser(w, cape, 'legendaire');
    expect(leg.cadenas).toBe(true);
    const pano = Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].set != null && !ITEMS.equipment[k].familier)!;
    const ip = rollItem(pano, ITEMS.equipment[pano], 'commun', w.rng, w.newUid());
    w.drops.push({ uid: w.newUid(), x: p.x, y: p.y, t: 1, item: ip }); p.pickupId = w.drops[w.drops.length - 1].uid;
    w.step(0.05, NO_INPUT);
    expect(ip.cadenas).toBe(true);
    expect(p.bag).toContain(ip);
  });
  it('anciennes sauvegardes : « Briser les Communs » coché devient « Défaire les Communs »', () => {
    const w = monde(), s = exporterJoueur(w) as unknown as Record<string, unknown>;
    delete s.autoDefaire; s.autoBrisage = true;
    const w2 = monde(); restaurerJoueur(w2, s as never);
    expect(w2.player.autoDefaire).toBe('commun');
  });
});
