import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { icons as ICON_FRAMES } from '../src/data/icones_objets.json';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { BOISSONS, CONSO, ELIXIRS, PARCHEMINS, RARES_RECOLTE, REPAS, sorteConso } from '../src/sim/consommables';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { effetsActifs } from '../src/sim/effets';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const monde = () => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 4, classId: 'iop', items: ITEMS, recoltes: RECOLTES });

describe('« Métiers : » consommables qui comptent (4A 4B 4C 5A)', () => {
  it('chaque consommable est un objet officiel du sac, avec son icône et une recette', () => {
    const ids = [...Object.keys(REPAS), ...Object.keys(ELIXIRS), ...Object.keys(BOISSONS), ...Object.keys(PARCHEMINS), ...Object.values(RARES_RECOLTE)];
    for (const id of ids) {
      const r = ITEMS.resources[id];
      expect(r, id).toBeDefined();
      expect(ICON_FRAMES[String(r.icon) as keyof typeof ICON_FRAMES], `${id} ${r.name}`).toBeDefined();
      if (!Object.values(RARES_RECOLTE).includes(id)) expect(ITEMS.recipes!.some(x => x.result === id), `${id} ${r.name}`).toBe(true);
    }
    for (const plante of Object.keys(RARES_RECOLTE)) expect(RECOLTES.ressources[plante]?.metier).toBe('alchimiste');
    expect(Object.values(PARCHEMINS).sort()).toEqual(['agilite', 'chance', 'force', 'intelligence', 'sagesse', 'vitalite']);
  });
  it('4B + 4C : un repas et un élixir de 30 min, cumulables ; un nouveau repas remplace l\'ancien ; sauvegardés', () => {
    const w = monde(), p = w.player, f0 = p.stat('force');
    p.resources['521'] = 1; p.resources['17171'] = 1; p.resources['16404'] = 1;   // Michette, Roulade de Carne, Raide Dite
    expect(w.utiliser('521')).toBe(true);
    expect(p.stat('force')).toBe(f0 + REPAS['521'].n);
    expect(w.utiliser('16404')).toBe(true);
    expect(p.stat('critique')).toBeGreaterThanOrEqual(ELIXIRS['16404'].n);
    expect(w.utiliser('17171')).toBe(true);
    expect(p.stat('force')).toBe(f0 + REPAS['17171'].n);
    expect(p.resources['521']).toBeUndefined();
    expect(effetsActifs(p).map(e => e.id)).toEqual(expect.arrayContaining(['repas', 'elixir']));
    const b = monde();
    restaurerJoueur(b, JSON.parse(JSON.stringify(exporterJoueur(w))));
    expect(b.player.repas?.id).toBe('17171');
    expect(b.player.stat('force')).toBe(f0 + REPAS['17171'].n);
    for (let i = 0; i < CONSO.duree + 5; i++) { w.step(1, NO_INPUT); p.hp = p.maxHp; }
    expect(p.repas).toBeNull(); expect(p.elixir).toBeNull();
    expect(p.stat('force')).toBe(f0);
  });
  it('4A : boisson de résistance 5 s, sur sa touche, avec une recharge ; la potion E soigne plus avec l\'Alchimiste', () => {
    const w = monde(), p = w.player;
    p.resources['21674'] = 3;   // Boisson givrée : Eau
    const r0 = p.stat('resEau');
    expect(w.utiliser('21674')).toBe(true);
    expect(p.stat('resEau')).toBe(r0 + CONSO.boisson.bonus);
    expect(p.ceinture).toBe('21674');
    w.step(1 / 60, { ...NO_INPUT, boisson: true });
    expect(p.resources['21674']).toBe(2);   // en recharge : rien de bu
    for (let i = 0; i < 6 * 60; i++) { w.step(1 / 60, NO_INPUT); p.hp = p.maxHp; }
    expect(p.stat('resEau')).toBe(r0);
    for (let i = 0; i < CONSO.boisson.recharge * 60; i++) { w.step(1 / 60, NO_INPUT); p.hp = p.maxHp; }
    w.step(1 / 60, { ...NO_INPUT, boisson: true });
    expect(p.dead).toBe(false);
    expect(p.resources['21674']).toBe(1);
    // potion : soin plus fort au niveau 200 d'Alchimiste
    const soin = (niveau: number) => { const v = monde(), q = v.player; q.metiers.alchimiste = { level: niveau, xp: 0 }; q.hp = 1; q.drinkPotion(v); return q.hp - 1; };
    expect(soin(200)).toBeGreaterThan(soin(1) * 1.4);
  });
  it('5A : un parchemin = +1 point pour toujours, 100 au plus par caractéristique', () => {
    const w = monde(), p = w.player, s0 = p.stat('sagesse');
    p.resources['803'] = 2;
    expect(w.utiliser('803')).toBe(true);
    expect(p.stat('sagesse')).toBe(s0 + 1);
    p.parchemins.sagesse = CONSO.parcheminMax;
    expect(w.utiliser('803')).toBe(false);
    expect(p.resources['803']).toBe(1);
    expect(sorteConso('803')).toBe('parchemin');
  });
});
