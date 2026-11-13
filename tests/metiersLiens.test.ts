import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { RENFORT, cleRenforceeDe } from '../src/sim/clesRenforcees';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const AS = new WorldGrid(lire('astrub')), HS = new WorldGrid(lire('havresac'));
const vide = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone = 'astrub') => new World({ data: GAME_DATA, zone, map: zone === 'havresac' ? HS : AS, seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, recoltes: RECOLTES, reprise: vide });

describe('« Métiers : » liens avec le Havre-Sac et les donjons (9B 9C)', () => {
  it('9C : le Bricoleur fabrique la clé renforcée d\'un donjon avec la clé, du bois et du minerai', () => {
    const cr = cleRenforceeDe(ITEMS, '8143')!;
    expect(ITEMS.resources[cr].name).toBe('Clef des Champs renforcée');
    const r = ITEMS.recipes!.find(x => x.result === cr)!;
    expect(r.metier).toBe('bricoleur');
    expect(r.ingredients[0]).toEqual(['8143', 1]);
    expect(Object.values(ITEMS.resources).filter(x => x.renforcee).length).toBeGreaterThanOrEqual(12);
  });
  it('9C : prise à l\'entrée avant la clé normale ; l\'arène a des monstres plus durs et plus de butin, gardé à la reprise', () => {
    const w = monde(), p = w.player, d = w.zone.open!.donjons!.find(x => x.nom === 'Grange du Tournesol Affamé')!;
    const po = w.entreeDonjon(d.nom)!, cr = cleRenforceeDe(ITEMS, po.cle!)!;
    p.resources[po.cle!] = 1; p.resources[cr] = 1;
    expect((w as unknown as { prendreCle: (x: typeof po) => boolean }).prendreCle(po)).toBe(true);
    expect(p.resources[cr]).toBeUndefined();
    expect(p.resources[po.cle!]).toBe(1);
    expect(p.renfortDonjon).toBe(d.nom);
    const boss = Object.keys(GAME_DATA.monsters)[0], def = GAME_DATA.monsters[boss];
    const avant = w.spawnMonster(boss, p.x, p.y).maxHp;
    (w as unknown as { lancerArene: (x: typeof d) => void }).lancerArene(d);
    expect(p.cleDonjon?.renforcee).toBe(true);
    expect(w.renforce).toBe(true);
    const m = w.spawnMonster(boss, p.x, p.y);
    expect(m.maxHp).toBe(Math.round(avant * RENFORT.pv));
    expect(m.def.dmg).toBe(Math.round(def.dmg * RENFORT.degats));
    const w2 = monde();
    restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.cleDonjon?.renforcee).toBe(true);
  });
  it('9B : un établi des artisans au Havre-Sac, pour tous les métiers', () => {
    const w = monde('havresac'), p = w.player;
    const po = w.postes.find(x => x.atelier === 'Établi des artisans')!;
    expect(po.metiers).toHaveLength(13);
    p.x = po.x; p.y = po.y;
    for (const m of ['paysan', 'mineur', 'bijoutier', 'bricoleur']) expect(w.atelierIci(m)).toBeTruthy();
    const f = w.postes.find(x => x.forge);
    if (f) expect(Math.hypot(f.x - po.x, f.y - po.y)).toBeLessThan(400);
  });
});
