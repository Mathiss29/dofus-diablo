import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const astrub = lire('astrub'), incarnam = lire('incarnam');
const zone = GAME_DATA.zones.astrub.open!;

/** Clique sur le portail de zone de ce monde (son dessin : le perso y marche) et avance jusqu'à l'événement changeZone.
 *  clic = false : on marche seulement jusqu'à sa case, sans cliquer sur le dessin. */
function passerPortail(w: World, clic = true) {
  const po = w.portes.find(p => p.vers)!;
  w.player.x = po.ends[0].x + 40; w.player.y = po.ends[0].y;
  for (let i = 0; i < 120; i++) {
    w.step(1 / 60, { ...NO_INPUT, dest: { x: po.ends[0].x, y: po.ends[0].y }, versPortail: clic && i === 0 ? po.nom : null });
    const e = w.drainEvents().find(e => e.k === 'changeZone');
    if (e && e.k === 'changeZone') return e;
  }
  return null;
}

describe('Astrub (0.2a)', () => {
  it('359 cartes du dehors + les 642 d\'Amakna, les 58 de l\'île des Wabbits et les 169 de Cania sud et de Moon (0.4, sur la grille du continent), chacune avec des cases marchables', () => {
    const wg = new WorldGrid(astrub);
    expect(astrub.maps.filter(m => !m.inside).length).toBe(359 + 642 + 58 + 5 + 169 + 838);
    // 0.6 (cachée) : les 838 cartes du dehors des 5 régions, fermées hors partie de test (tools/extraction/regions06)
    expect(astrub.maps.filter(m => m.v06 && !m.inside).length).toBe(838);
    expect(astrub.maps.filter(m => m.v06 && m.inside).length).toBe(6);   // les 5 arènes des donjons de la 0.6 et la Salle au trésor (tools/extraction/arenes06)
    expect(astrub.maps.filter(m => m.v06).every(m => wg.freeByMap.get(m.tag)!.length === 0)).toBe(true);
    // Amakna (0.4 cachée) : dessiné, mais fermé hors partie de test ; île des Wabbits : 58 cartes + 5 petites cartes de ses passerelles
    // + les 8 salles du Château d'Amakna (0.4 suite : 6A, intérieurs aussi en essai) et, pour les donjons en couloirs (5B),
    // 36 vraies salles et leurs couloirs (36 couloirs + 38 petites cartes sans image sous le creux des couloirs ; 4 de plus sous la Grange d'Astrub)
    expect(astrub.maps.filter(m => m.essai && !m.inside).length).toBe(642 + 58 + 5 + 169);
    expect(astrub.maps.filter(m => m.essai && m.inside).length).toBe(8 + 36 + 36 + 38 + 4 + 1);   // + la salle au masque du Village Kanniboul (« Kanniboul : » une seule salle)
    expect(astrub.maps.filter(m => m.essai).every(m => wg.freeByMap.get(m.tag)!.length === 0)).toBe(true);
    wg.ouvrirEssai(); wg.ouvrirV06();
    expect(astrub.origin).toEqual([-88, -93]);
    // (les couloirs des donjons en couloirs ne s'ouvrent qu'en partie de test : tests/couloirs.test.ts)
    for (const m of astrub.maps) if (!m.dessus) expect(wg.freeByMap.get(m.tag)!.length, m.tag).toBeGreaterThan(20);
  });
  it('chaque monstre des sous-zones a ses données officielles et sa planche', () => {
    for (const [id, s] of Object.entries(zone.subareas)) {
      expect(astrub.maps.some(m => String(m.sub) === id), id).toBe(true);
      for (const t of [...s.monsters, ...(s.elite ? [s.elite] : [])]) {
        expect(GAME_DATA.monsters[t]?.dofusId, t).toBeDefined();
        expect(LOOKS[GAME_DATA.monsters[t].look], t).toBeDefined();
      }
    }
  });
  it('arènes de la 0.4 (partie de test) : chaque monstre des vagues a sa planche, chaque arène sa carte et son nom', () => {
    for (const d of zone.donjonsTest ?? []) {
      const m = astrub.maps.find(x => x.tag === d.arene!.tag);
      expect(m, d.nom).toBeDefined();
      expect(zone.subareas[String(m!.sub)]?.name, d.nom).toBe(d.nom);
      for (const t of [...(d.vagues ?? []).flatMap(v => v.m), ...(d.bossVague ?? [])]) expect(LOOKS[GAME_DATA.monsters[t]?.look ?? ''], `${d.nom} : ${t}`).toBeDefined();
    }
  });
  it('carte du monde et points d\'intérêt officiels (Zaap, banque, donjons…)', () => {
    expect(astrub.carte).toBeDefined();
    const noms = astrub.reperes!.map(r => r.n);
    for (const n of ['Zaap', 'Banque', 'Portail vers Incarnam', 'Grange du Tournesol Affamé']) expect(noms).toContain(n);
  });
  it('portails dessinés : le bassin d\'Incarnam et l\'arche de la tour d\'Astrub se cliquent, passer à côté ne fait rien', () => {
    for (const [nom, monde] of [['incarnam', incarnam], ['astrub', astrub]] as const) {
      const w = new World({ data: GAME_DATA, zone: nom, map: new WorldGrid(monde), seed: 1 }), po = w.portes.find(p => p.vers)!;
      expect(po.dessin, nom).toBeDefined();
      // le dessin est loin de la case où l'on s'arrête (dans le vide, en haut de l'escalier), mais sur la même carte
      expect(w.worldGrid!.mapAt(po.dessin!.x, po.dessin!.y)?.tag).toBe(po.ends[0].tag);
      expect(passerPortail(w, false), nom).toBeNull();
    }
  });
  it('portail Incarnam [4,-3] -> Astrub [6,-19], et retour', () => {
    const w1 = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1 });
    const aller = passerPortail(w1);
    expect(aller).toMatchObject({ zone: 'astrub', arrivee: ['6_-19', 397] });
    const w2 = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, arrivee: aller!.arrivee });
    expect(w2.worldGrid!.mapAt(w2.player.x, w2.player.y)?.tag).toBe('6_-19');
    // on arrive à côté du portail, pas dessus : il ne renvoie pas tout de suite à Incarnam
    for (let i = 0; i < 60; i++) w2.step(1 / 60, NO_INPUT);
    expect(w2.drainEvents().some(e => e.k === 'changeZone')).toBe(false);
    const retour = passerPortail(w2);
    expect(retour).toMatchObject({ zone: 'incarnam', arrivee: ['4_-3', 300] });
  });
  it('Amakna (0.4) : sous-zones et monstres ouverts à tous (0.4 publique)', () => {
    const pub = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1 });
    expect(Object.values(pub.zone.open!.subareas).filter(s => s.essai).length).toBeGreaterThan(20);
    expect(pub.worldGrid!.freeByMap.get('2_0')!.length).toBeGreaterThan(20);
    const test = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, test: {} as never });
    expect(Object.values(test.zone.open!.subareas).filter(s => s.essai).length).toBeGreaterThan(20);
    expect(test.worldGrid!.freeByMap.get('2_0')!.length).toBeGreaterThan(20);
  });
  it('quatre donjons en arène : une grande salle de 3 x 3 cartes, monstres officiels, 3 vagues + le boss, entrée à clé', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1 }), wg = w.worldGrid!;
    for (const d of zone.donjons!) {
      const a = d.arene!, m = wg.mapByTag(a.tag)!;
      expect(m.n).toEqual([3, 3]);
      expect(m.inside).toBe(1);
      for (const c of [a.arrivee, a.boss, a.sortie, a.coffre, ...a.entrees]) expect(wg.mapOfCell(c)?.tag, `${a.tag} ${c}`).toBe(a.tag);
      for (const c of [a.arrivee, a.boss, a.sortie, ...a.entrees]) expect(wg.mov[c], `${a.tag} case ${c}`).toBe(1);
      expect(d.vagues).toHaveLength(3);
      for (const t of [...d.vagues!.flatMap(v => v.m), ...d.bossVague!]) if (t !== '?') expect(LOOKS[GAME_DATA.monsters[t]?.look], t).toBeDefined();
      expect(GAME_DATA.monsters[d.bossVague![0]].boss).toBe(true);
      expect(w.entreeDonjon(d.nom)?.cle).toBeTruthy();
      const fin = w.entreeDonjon(d.nom)!.ends[1].tag;   // Grange en couloirs depuis la 0.4 : l'antichambre grange_0
      expect(fin === a.tag || (!!w.couloirs(d) && fin.startsWith(a.tag.replace('arene_', ''))), fin).toBe(true);
    }
  });
});
