import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import type { Item } from '../src/sim/items';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = () => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 3, classId: 'iop', items: ITEMS, test: {} as never });
const objet = (w: World, slot: string): Item => {
  const [id] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === slot && !d.familier && d.level <= 10)!;
  const it = { uid: w.newUid(), id, rarity: 'rare' as const, stats: {}, extra: [] }; w.player.bag.push(it); return it;
};

describe('préréglages d\'équipement (version 0.3 : 13A+13D)', () => {
  it('13A : 3 préréglages ; équipement, barre de sorts et variantes reviennent d\'un clic', () => {
    const w = arena(), p = w.player;
    p.fixerNiveau(20, null);
    for (const s of ['chapeau', 'cape', 'bottes'] as const) { const e = p.equipment[s]; if (e) p.unequip(s); }
    const a = objet(w, 'chapeau'), b = objet(w, 'chapeau'), c = objet(w, 'bottes');
    p.equip(a.uid); p.equip(c.uid);
    const barre = [...p.bar];
    expect(p.prereglages).toHaveLength(3);
    expect(p.enregistrerPrereglage(0)).toBe(true);
    // on change tout
    p.equip(b.uid); p.unequip('bottes'); p.bar = p.bar.map(() => null);
    expect(p.enregistrerPrereglage(1, 'Sans bottes')).toBe(true);
    expect(p.mettrePrereglage(0)).toBe(true);
    expect(p.equipment.chapeau?.uid).toBe(a.uid);
    expect(p.equipment.bottes?.uid).toBe(c.uid);
    expect(p.bar).toEqual(barre);
    expect(p.mettrePrereglage(1)).toBe(true);
    expect(p.equipment.chapeau?.uid).toBe(b.uid);
    expect(p.equipment.bottes).toBeUndefined();
    expect(p.bag.some(x => x.uid === c.uid)).toBe(true);
    expect(p.mettrePrereglage(2)).toBe(false);   // vide
  });

  it('13D : refusé moins de 5 s après un coup reçu', () => {
    const w = arena(), p = w.player;
    p.enregistrerPrereglage(0);
    p.hurt(5, p.x + 10, p.y, w);
    expect(p.attentePrereglage).toBeGreaterThan(4);
    expect(p.mettrePrereglage(0)).toBe(false);
    p.age += 5.1;
    expect(p.mettrePrereglage(0)).toBe(true);
  });

  it('gardés dans la sauvegarde', () => {
    const w = arena(); w.player.enregistrerPrereglage(2, 'Boss');
    const v = arena(); restaurerJoueur(v, exporterJoueur(w));
    expect(v.player.prereglages[2]?.nom).toBe('Boss');
    expect(v.player.prereglages[0]).toBeNull();
  });
});
