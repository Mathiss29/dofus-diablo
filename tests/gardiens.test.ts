import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const lire = (z: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${z}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const astrub = lire('astrub'), incarnam = lire('incarnam');
const vide = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone = 'astrub') => new World({ data: GAME_DATA, zone, map: new WorldGrid(zone === 'astrub' ? astrub : incarnam), seed: 3, items: ITEMS,
  quetes: QUETES, boutiques: BOUTIQUES, reprise: vide });
const DONJONS: [string, string, string][] = [['mawy', 'Grange du Tournesol Affamé', '8143'], ['igloute', 'Château Ensablé', '8437'], ['rotabla', 'Cour du Bouftou Royal', '1568']];

describe('gardiens des donjons (maquette Gardiens)', () => {
  it('chaque donjon d\'Astrub a son gardien officiel, à quelques pas de la porte', () => {
    const w = monde(), Q = w.quetes!;
    for (const [id, donjon] of DONJONS) {
      const g = Q.pnj(id)!, po = w.entreeDonjon(donjon)!;
      expect(Q.gardienDe(donjon)).toBe(id);
      expect(g.tag).toBe(po.ends[0].tag);
      const d = Math.hypot(g.x - po.ends[0].x, g.y - po.ends[0].y);
      expect(d, id).toBeGreaterThan(100); expect(d, id).toBeLessThan(210);
    }
  });
  it('« Entrer » prend la clé et mène dans la première salle ; infos et butin du boss', () => {
    for (const [id, donjon, cle] of DONJONS) {
      const w = monde(), Q = w.quetes!, p = w.player, g = Q.pnj(id)!;
      p.resources[cle] = 2; p.x = g.x + 30; p.y = g.y;
      Q.cliquer(id);
      for (let i = 0; i < 30 && !Q.dialogue; i++) w.step(1 / 60, NO_INPUT);
      const d = Q.dialogue!;
      expect(d.donjon).toMatchObject({ nom: donjon, cle, cles: 2, victoires: 0 });
      expect(d.donjon!.boss).toBeTruthy();
      expect(d.donjon!.butin.length).toBeGreaterThan(0);
      expect(d.reponses.map(r => r.a)).toEqual(['entrer', 'suite', 'fermer']);
      Q.repondre(1);   // sa réponse inédite, puis « Entrer » revient
      expect(Q.dialogue!.reponses[0].a).toBe('entrer');
      Q.repondre(0);
      for (let i = 0; i < 90; i++) w.step(1 / 60, NO_INPUT);
      expect(w.worldGrid!.mapAt(p.x, p.y)?.tag, id).toBe(w.entreeDonjon(donjon)!.ends[1].tag);
      expect(p.resources[cle]).toBe(1);
    }
  });
  it('se souvient de ta victoire et de ta mort (8A), et salue quand on passe devant (9A)', () => {
    const w = monde(), Q = w.quetes!, p = w.player, g = Q.pnj('rotabla')!;
    p.x = g.x + 200; p.y = g.y;
    w.step(1 / 60, NO_INPUT);
    expect(Q.bulle?.pnj).toBe('rotabla');
    // victoire sur le Bouftou Royal dans la Cour
    p.resources['1568'] = 1; w.entrerDonjon('Cour du Bouftou Royal');
    for (let i = 0; i < 90; i++) w.step(1 / 60, NO_INPUT);
    w.emit({ k: 'kill', x: p.x, y: p.y, radius: 1, monster: w.bossDuDonjon('Cour du Bouftou Royal')! });
    expect(Q.donjons['Cour du Bouftou Royal']).toMatchObject({ v: 1, m: 0, dernier: 'v' });
    w.emit({ k: 'playerDeath', wave: 0 });
    expect(Q.donjons['Cour du Bouftou Royal']).toMatchObject({ v: 1, m: 1, dernier: 'm' });
    p.x = g.x + 30; p.y = g.y; Q.parlerA('rotabla');
    expect(Q.dialogue!.texte).toMatch(/Piétiné/);
    expect(Q.dialogue!.donjon!.victoires).toBe(1);
    Q.repondre(-1); Q.parlerA('rotabla');
    expect(Q.dialogue!.texte).toBe(QUETES.pnj.rotabla.phrase);
    expect(Q.exporter().donjons?.['Cour du Bouftou Royal']?.v).toBe(1);
  });
  it('Klasmor garde la Crypte de Kardorim, sans clé', () => {
    const w = monde('incarnam'), Q = w.quetes!, p = w.player, po = w.entreeDonjon('Crypte de Kardorim')!;
    expect(Q.gardienDe('Crypte de Kardorim')).toBe('klasmor');
    p.x = po.ends[0].x + 40; p.y = po.ends[0].y;
    for (let i = 0; i < 90 && !Q.dialogue; i++) w.step(1 / 60, { ...NO_INPUT, dest: { x: po.ends[0].x, y: po.ends[0].y } });
    expect(Q.dialogue?.pnj).toBe('klasmor');
    expect(Q.dialogue!.reponses[0]).toMatchObject({ a: 'entrer' });
    Q.repondre(0);
    for (let i = 0; i < 90; i++) w.step(1 / 60, NO_INPUT);
    expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('crypte_1');
  });
});
