import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { COFFRE } from '../src/sim/coffre';
import { rollItem } from '../src/sim/items';
import { BOUTIQUE_OGRINES } from '../src/sim/boutiqueOgrines';
import { alertePrix, annoncesMax, categorieHdv, cleHdv, donnerHdv, refusHdv, relireObjetHdv, retirerHdv, taxeHdv, typeVente, type ObjetHdv } from '../src/sim/hdv';
import { APPARATS_SOURCES } from '../src/sim/apparats';

// Hôtel de Vente (« HDV : », 2026-11-15) : ce qui se vend, taxe, annonces, gestes sur le perso (solo et serveur).
const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1, classId: 'iop', items: ITEMS });
const equipement = Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].level >= 20 && !ITEMS.equipment[k].familier && ITEMS.equipment[k].slot === 'chapeau')!;
const ame = Object.keys(ITEMS.resources).find(k => ITEMS.resources[k].ame)!;

describe('Hôtel de Vente', () => {
  it('3A-3E : tout se vend sauf la Pépite, les apparats payés en Ogrines ; lots de 1, 10, 100 ; jets impossibles refusés', () => {
    expect(refusHdv({ k: 'ressource', id: '289', n: 10 }, ITEMS)).toBeNull();
    expect(refusHdv({ k: 'ressource', id: '289', n: 5 }, ITEMS)).toBe('lot');
    expect(refusHdv({ k: 'ressource', id: '14635', n: 1 }, ITEMS)).toBe('pepite');
    expect(refusHdv({ k: 'ressource', id: ame, n: 1 }, ITEMS)).toBe('inconnu');   // une âme se vend comme âme
    expect(refusHdv({ k: 'ame', id: ame }, ITEMS)).toBeNull();
    const w = monde(), it = rollItem(equipement, ITEMS.equipment[equipement], 'mythique', w.rng, 1);
    expect(refusHdv({ k: 'objet', item: it }, ITEMS)).toBeNull();   // 3E : Légendaires, Mythiques aussi
    expect(refusHdv({ k: 'objet', item: { ...it, stats: { ...it.stats, vitalite: 5000 } } }, ITEMS)).toBe('jets');
    const ogrines = Object.values(BOUTIQUE_OGRINES.articles).flatMap(a => a.apparats ?? [])[0];
    expect(refusHdv({ k: 'apparat', id: ogrines }, ITEMS)).toBe('ogrines');
    const gagne = Object.entries(APPARATS_SOURCES.sources).find(([, s]) => s.k === 'boss')![0];
    expect(refusHdv({ k: 'apparat', id: gagne }, ITEMS)).toBeNull();
  });
  it('types de vente, catégories, clés de prix ; taxe 2 %, annonces avec l’abonnement, alerte de prix', () => {
    expect(typeVente({ k: 'ressource', id: '289', n: 1 }, ITEMS)).toBe('ressource');
    expect(categorieHdv({ k: 'ressource', id: '289', n: 1 }, ITEMS)).toBe('paysan');
    expect(typeVente({ k: 'ressource', id: '1519', n: 1 }, ITEMS)).toBe('rune');
    expect(typeVente({ k: 'ressource', id: '521', n: 1 }, ITEMS)).toBe('consommable');
    const it = rollItem(equipement, ITEMS.equipment[equipement], 'rare', monde().rng, 1);
    expect(categorieHdv({ k: 'objet', item: it }, ITEMS)).toBe('chapeau');
    expect(cleHdv({ k: 'objet', item: it })).toBe(`o:${equipement}:rare`);
    expect(taxeHdv(1000)).toBe(20); expect(taxeHdv(10)).toBe(1);
    expect(annoncesMax(0)).toBe(16); expect(annoncesMax(3)).toBe(32);
    expect(alertePrix(2, 10)).toBe('bas'); expect(alertePrix(50, 10)).toBe('haut'); expect(alertePrix(10, 10)).toBeNull(); expect(alertePrix(1, null)).toBeNull();
  });
  it('gestes : retirer du perso puis donner à un autre (sac, puis coffre du compte s’il est plein ; retour au coffre d’abord)', () => {
    const w = monde(), p = w.player, it = rollItem(equipement, ITEMS.equipment[equipement], 'rare', w.rng, w.newUid());
    p.bag.push(it); p.resources['289'] = 15; p.ames.push(ITEMS.resources[ame].ame!);
    expect(retirerHdv(p, { k: 'ressource', id: '289', n: 100 })).toBeNull();
    expect(retirerHdv(p, { k: 'ressource', id: '289', n: 10 })).toEqual({ k: 'ressource', id: '289', n: 10 });
    expect(p.resources['289']).toBe(5);
    const o = retirerHdv(p, { k: 'objet', item: { ...it } })!;
    expect(p.bag).toHaveLength(0);
    expect(retirerHdv(p, { k: 'ame', id: ame })).toEqual({ k: 'ame', id: ame });
    expect(p.ames).toHaveLength(0);
    const b = monde(), q = b.player;
    expect(donnerHdv(b, q, o)).toBe('sac');
    expect(q.bag[0].id).toBe(equipement);
    expect(donnerHdv(b, q, o, true)).toBe('coffre');   // 5B : une annonce revenue va au coffre du compte
    expect(b.coffre.onglets[0]).toHaveLength(1);
    while (q.bag.length < q.tailleSac) q.bag.push({ ...it, uid: b.newUid() });
    expect(donnerHdv(b, q, o)).toBe('coffre');         // 6A : sac plein
    expect(donnerHdv(b, q, o, false, true)).toBeNull(); // partie du serveur : pas de coffre
    expect(donnerHdv(b, q, { k: 'ame', id: ame })).toBe('sac');
    expect(q.ames).toEqual([ITEMS.resources[ame].ame]);
    b.coffre.onglets.forEach(l => { while (l.length < COFFRE.places) l.push({ ...it, uid: b.newUid() }); });
    expect(donnerHdv(b, q, o)).toBeNull();
  });
  it('« HDV : » 8 : avec l’Hôtel de Vente, « Défaire » chez Kerubim rend des runes mais plus de kamas', () => {
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1, classId: 'iop', items: ITEMS, hdv: true }), p = w.player;
    const it = rollItem(equipement, ITEMS.equipment[equipement], 'epique', w.rng, w.newUid());
    p.bag.push(it);
    const k0 = p.kamas;
    expect(w.briserObjet(it.uid)).toBe(true);
    expect(p.kamas).toBe(k0);
    const sans = monde(), q = sans.player, it2 = rollItem(equipement, ITEMS.equipment[equipement], 'epique', sans.rng, sans.newUid());
    q.bag.push(it2); sans.briserObjet(it2.uid);
    expect(q.kamas).toBeGreaterThan(0);   // sans l'HDV (hors MAJ en ligne), rien ne change
  });
  it('relit un objet reçu : mal formé refusé', () => {
    expect(relireObjetHdv({ k: 'ressource', id: '289', n: 10 })).toEqual({ k: 'ressource', id: '289', n: 10 });
    expect(relireObjetHdv({ k: 'ressource', id: '289', n: 1000 })).toBeNull();
    expect(relireObjetHdv({ k: 'objet', item: { id: 'x' } })).toBeNull();
    expect(relireObjetHdv({ k: 'ame', id: ame })).toEqual({ k: 'ame', id: ame } as ObjetHdv);
    expect(relireObjetHdv(null)).toBeNull();
  });
});
