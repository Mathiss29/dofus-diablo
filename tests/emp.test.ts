import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE, recycleValue, rollItem } from '../src/sim/items';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (seed = 1) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const objet = (w: World, id: string, rarete: 'commun' | 'rare' | 'epique' | 'legendaire' = 'commun') => {
  const it = rollItem(id, ITEMS.equipment[id], rarete, w.rng, w.newUid()); w.player.bag.push(it); return it;
};

describe('Emp, le Méryde du Recyclage (0.2b)', () => {
  it('se tient à côté du Zaap d\'Astrub, seulement dans Astrub', () => {
    const w = monde(), e = w.quetes!.pnjs.find(p => p.id === 'emp');
    expect(e?.tag).toBe('5_-18');
    const inc = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
    const wi = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(inc), seed: 1, items: ITEMS, quetes: QUETES });
    expect(wi.quetes!.pnjs.some(p => p.id === 'emp')).toBe(false);
  });
  it('dialogue officiel : services, discussion en trois temps, adieu', () => {
    const w = monde(), Q = w.quetes!, e = Q.pnjs.find(p => p.id === 'emp')!;
    w.player.x = e.x + 40; w.player.y = e.y;
    Q.cliquer('emp');
    for (let i = 0; i < 30 && !Q.dialogue; i++) w.step(1 / 60, NO_INPUT);
    expect(Q.dialogue?.texte).toMatch(/offrande/);
    expect(Q.dialogue!.reponses.map(r => r.a)).toEqual(['service', 'service', 'suite', 'fermer']);
    Q.repondre(2); expect(Q.dialogue?.texte).toMatch(/disciple/);
    Q.repondre(0); expect(Q.dialogue?.texte).toMatch(/poubelles/);
    Q.repondre(0); expect(Q.dialogue?.texte).toMatch(/gaspillage/);
    expect(Q.dialogue!.reponses.at(-1)!.texte).toMatch(/saluts quotidiens/);
    Q.repondre(0);   // « Recycler » : le dialogue se ferme et l'affichage ouvre la fenêtre
    expect(Q.dialogue).toBeNull();
    expect(w.drainEvents().find(e => e.k === 'service')).toMatchObject({ service: 'recycler', pnj: 'emp' });
  });
  it('recycle contre des Pépites selon le niveau et la rareté, cadenas et lots', () => {
    const w = monde(), p = w.player;
    const id = Object.keys(ITEMS.equipment).find(k => ITEMS.equipment[k].level >= 20)!;
    const c = objet(w, id), e = objet(w, id, 'epique'), l = objet(w, id, 'legendaire');
    expect(recycleValue(ITEMS.equipment[id], e)).toBeGreaterThan(recycleValue(ITEMS.equipment[id], c) * 4);
    w.cadenas(c.uid);
    expect(w.recycle(c.uid)).toBe(false);
    expect(w.apercuLot('epique').n).toBe(1);
    expect(w.recycleLot('epique')).toBe(1);   // l'Épique part, le Commun sous cadenas et le Légendaire restent
    expect(p.bag.map(b => b.uid).sort()).toEqual([c.uid, l.uid].sort());
    expect(p.resources[PEPITE]).toBe(recycleValue(ITEMS.equipment[id], e));
  });
  it('boutique en Pépites, puis la clé ouvre la Grange (et elle est prise)', () => {
    const w = monde(), p = w.player;
    expect(w.acheter('emp', '8143')).toBe(false);   // pas de Pépites
    p.resources[PEPITE] = 160;
    expect(w.acheter('emp', '8143')).toBe(true);
    expect(p.resources[PEPITE]).toBe(10);
    const po = w.portes.find(x => x.nom === 'Grange du Tournesol Affamé' && x.cle)!;
    const essai = () => {
      p.x = po.ends[0].x + 40; p.y = po.ends[0].y;
      for (let i = 0; i < 90; i++) w.step(1 / 60, { ...NO_INPUT, dest: { x: po.ends[0].x, y: po.ends[0].y } });
      return w.worldGrid!.mapAt(p.x, p.y)?.tag;
    };
    expect(essai()).toBe('grange_0');
    expect(p.resources['8143']).toBeUndefined();
    // sans clé, on reste dehors
    p.x = po.ends[0].x + 300; p.y = po.ends[0].y;
    for (let i = 0; i < 30; i++) w.step(1 / 60, NO_INPUT);
    w.drainEvents();
    expect(essai()).toBe('7_-24');
    expect(w.drainEvents().some(e => e.k === 'cleManquante')).toBe(true);
  });
  it('la Potion de Rappel ramène au dernier Zaap', () => {
    const w = monde(), p = w.player, r = w.pointDeRetour;
    p.resources['548'] = 1;
    const ailleurs = w.worldGrid!.cellToWorld(w.worldGrid!.freeByMap.get('7_-24')![0]);
    p.x = ailleurs.x; p.y = ailleurs.y;
    expect(w.rappel('548')).toBe(true);
    expect([p.x, p.y]).toEqual([r.x, r.y]);
    expect(p.resources['548']).toBeUndefined();
  });
});
