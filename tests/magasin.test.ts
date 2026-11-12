import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { etalDuJour, MAGASIN, pieceDeLaSemaine, reserveePiece } from '../src/sim/magasin';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (jour = '2026-11-12') => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, aujourdhui: jour, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const ctx = { boutiques: BOUTIQUES, apparats: APPARATS, v03: true, v04: true };

describe('Magasin du Bastion (« Magasin : » 2A-2D 3A+3B 4C)', () => {
  it('3A : six offres tirées de la date (trois utiles en kamas, trois apparences en Pépites), deux à -30 %, le lendemain change', () => {
    const a = etalDuJour('2026-11-12', ctx), b = etalDuJour('2026-11-12', ctx), c = etalDuJour('2026-11-13', ctx);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(MAGASIN.offres);
    expect(a.filter(o => o.k === 'objet').every(o => o.monnaie === 'kamas')).toBe(true);
    expect(a.filter(o => o.k === 'apparat').every(o => o.monnaie === PEPITE && !reserveePiece(o.id))).toBe(true);
    expect(a.filter(o => o.remise).length).toBe(MAGASIN.remises);
  });
  it('3B : la pièce de la semaine est réservée, change le lundi, introuvable chez Tissebelle', () => {
    const lun = pieceDeLaSemaine('2026-11-09', ctx)!, dim = pieceDeLaSemaine('2026-11-15', ctx)!, apres = pieceDeLaSemaine('2026-11-16', ctx)!;
    expect(lun.id).toBe(dim.id);
    expect(apres.id).not.toBe(lun.id);
    expect(reserveePiece(lun.id)).toBe(true);
    const w = monde(), p = w.player; p.resources[PEPITE] = 10000;
    expect(w.acheterApparat(lun.id)).toBe(false);
    const piece = w.pieceDeLaSemaine()!;
    expect(w.acheterPiece()).toBe(true);
    expect(p.apparats).toContain(piece.id);
    expect(p.resources[PEPITE]).toBe(10000 - piece.prix);
    expect(w.acheterPiece()).toBe(false);   // déjà à toi
  });
  it('une offre de l\'étal se prend une fois par jour, le prix remisé est payé', () => {
    const w = monde(), p = w.player; p.kamas = 100000; p.resources[PEPITE] = 10000;
    const l = w.etalDuJour(), i = l.findIndex(o => o.k === 'objet');
    const k0 = p.kamas;
    expect(w.acheterEtal(i)).toBe(true);
    expect(k0 - p.kamas).toBe(l[i].prix);
    expect(w.acheterEtal(i)).toBe(false);
    const s = JSON.parse(JSON.stringify(exporterJoueur(w))), w2 = monde(); restaurerJoueur(w2, s);
    expect(w2.player.magasin?.etal).toEqual([i]);
    const w3 = monde('2026-11-13'); restaurerJoueur(w3, s); w3.player.kamas = 100000;
    expect(w3.achatsDuJour().etal).toEqual([]);   // minuit : l'étal se renouvelle
  });
  it('4C : un sac garanti par jour, Rare ou Épique, payé en Pépites', () => {
    const w = monde(), p = w.player; p.resources[PEPITE] = 200;
    const n = p.bag.length;
    expect(w.acheterSacDuJour('epique')).toBe(true);
    expect(p.bag.length).toBe(n + 1);
    expect(p.bag[p.bag.length - 1].rarity).toBe('epique');
    expect(p.resources[PEPITE]).toBe(200 - MAGASIN.sac.epique);
    expect(w.acheterSacDuJour('rare')).toBe(false);
  });
  it('2C/2D : sans assez de kamas on n\'achète rien ; Maj + clic en prend 10', () => {
    const w = monde(), p = w.player, a = BOUTIQUES.otomai[0];
    p.kamas = a.prix * 10 - 1;
    expect(w.acheter('otomai', a.id, 10)).toBe(false);
    p.kamas = a.prix * 10;
    expect(w.acheter('otomai', a.id, 10)).toBe(true);
    expect(p.resources[a.id]).toBe(10);
    expect(p.kamas).toBe(0);
  });
});
