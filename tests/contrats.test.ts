import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { semaine } from '../src/sim/contrats';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE } from '../src/sim/items';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const grille = new WorldGrid(astrub);
const monde = (jour = '2026-11-08', reprise: EtatQuetes = vide) => new World({ data: GAME_DATA, zone: 'astrub', map: grille, seed: 3, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, reprise, aujourdhui: jour });
/** Va voir le PNJ et laisse le dialogue s'ouvrir (rendu de la quête). */
function rendre(w: World, pnj: string) {
  const Q = w.quetes!, n = Q.pnj(pnj)!, p = w.player;
  p.x = n.x + 30; p.y = n.y; Q.cliquer(pnj);
  for (let i = 0; i < 30 && !Q.dialogue; i++) w.step(1 / 60, NO_INPUT);
}
/** Un point d'une carte de cette sous-zone. */
const dans = (w: World, sub: number) => { const m = astrub.maps.find(x => x.sub === sub && (grille.freeByMap.get(x.tag)?.length ?? 0) > 40)!; return w.openestCellOf(m.tag); };

describe('Contrats du jour et Avis de recherche (Quêtes roadmap 1C, 3A+3C, 4A, 5A+5B)', () => {
  it('semaine ISO', () => {
    expect(semaine('2026-11-08')).toBe('2026-S45');
    expect(semaine('2026-11-09')).toBe('2026-S46');
    expect(semaine('2026-01-01')).toBe('2026-S01');
  });
  it('le Gardien des Geôles tient le tableau : 3 contrats du jour + 1 de semaine, les mêmes pour tout le monde ce jour-là', () => {
    const w = monde(), Q = w.quetes!; w.player.level = 22;
    expect(Q.pnj('geolier')?.tag).toBe('5_-19');
    const l = Q.contrats();
    expect(l).toHaveLength(4);
    expect(l.filter(id => Q.def(id).serie === 'Contrat de la semaine')).toHaveLength(1);
    for (const id of l) { const q = Q.def(id); expect(q.rendre).toBe('geolier'); expect(q.recompense.sac).toBeTruthy(); expect(q.recompense.pepites).toBeGreaterThan(0); }
    const w2 = monde(); w2.player.level = 22;
    expect(w2.quetes!.contrats()).toEqual(l);
    const w3 = monde('2026-11-09'); w3.player.level = 22;
    expect(w3.quetes!.contrats()).not.toEqual(l);
    // le tableau s'ouvre depuis le dialogue
    rendre(w, 'geolier');
    const i = Q.dialogue!.reponses.findIndex(r => r.a === 'contrats');
    expect(i).toBeGreaterThanOrEqual(0);
    Q.repondre(i);
    expect(Q.dialogue!.reponses.filter(r => r.a === 'voir')).toHaveLength(4);
  });
  it('un contrat fini et rendu : XP, kamas, sac Rare garanti, Pépites ; plus proposé aujourd\'hui, mais gardé à la sauvegarde', () => {
    // le premier jour de la semaine qui propose un contrat « vaincre » seulement (le tirage dépend des sous-zones de la zone)
    const vaincre = (w: World) => w.quetes!.contrats().find(x => w.quetes!.def(x).etapes[0 as never] && (w.quetes!.def(x).etapes as { objectifs: { t: string }[] }[])[0].objectifs.every(o => o.t === 'vaincre'));
    let jour = '', w!: World;
    for (let d = 8; d <= 14 && !jour; d++) { w = monde(`2026-11-${d}`); w.player.level = 22; if (vaincre(w)) jour = `2026-11-${d}`; }
    const Q = w.quetes!, p = w.player, id = vaincre(w)!;
    expect(id).toBeTruthy();
    Q.prendre(id);
    const o = (Q.def(id).etapes as { objectifs: { n: number; sousZone: number; monstres?: string[] }[] }[])[0].objectifs[0];
    const z = dans(w, o.sousZone), monstre = o.monstres?.[0] ?? w.zone.open!.subareas[String(o.sousZone)].monsters[0];
    for (let i = 0; i < o.n; i++) w.emit({ k: 'kill', x: z.x, y: z.y, radius: 1, monster: monstre });
    w.step(1 / 60, NO_INPUT);
    expect(Q.aRendre('geolier')).toBe(id);
    const sac = p.bag.length, kamas = p.kamas;
    rendre(w, 'geolier');
    expect(Q.finies.has(id)).toBe(true);
    expect(p.bag.length).toBe(sac + 1);
    expect(p.bag.at(-1)!.rarity).toBe('rare');
    expect(p.kamas).toBeGreaterThan(kamas);
    expect(p.resources[PEPITE]).toBe(Q.def(id).recompense.pepites);
    expect(Q.contratsLibres()).not.toContain(id);
    const e = Q.exporter();
    expect(e.finies).toContain(id);
    expect(monde(jour, e).quetes!.contratsLibres()).toHaveLength(3);
    expect(monde(`2026-11-${+jour.slice(-2) + 2}`, e).quetes!.finies.has(id)).toBe(false);   // les contrats des jours passés s'effacent
  });
  it('Avis de recherche : l\'élite officiel apparaît, la prime se rend aux Geôles, l\'avis revient la semaine suivante', () => {
    const w = monde(), Q = w.quetes!, p = w.player; p.level = 20;
    expect(Q.aDonnerTous('geolier')).toEqual(expect.arrayContaining(['avis_fouduglen', 'avis_sam']));
    expect(Q.aDonnerTous('geolier')).not.toContain('avis_frakacia');
    Q.prendre('avis_fouduglen');
    const m = w.monsters.find(x => !x.dead && x.type === 'fouduglen_l_ecureuil' && Q.estEliteDeQuete(x.id))!;
    expect(m).toBeTruthy();
    Q.eliteVaincu(m.id); w.step(1 / 60, NO_INPUT);
    rendre(w, 'geolier');
    expect(Q.finies.has('avis_fouduglen')).toBe(true);
    expect(p.bag.at(-1)!.rarity).toBe('epique');
    expect(Q.aDonnerTous('geolier')).not.toContain('avis_fouduglen');
    const e = Q.exporter();
    expect(monde('2026-11-15', e).quetes!.aDonnerTous('geolier')).not.toContain('avis_fouduglen');   // dimanche : même semaine
    const w2 = monde('2026-11-16', e); w2.player.level = 20;
    expect(w2.quetes!.aDonnerTous('geolier')).toContain('avis_fouduglen');
    w2.quetes!.prendre('avis_fouduglen');
    expect(w2.quetes!.enCours.some(c => c.id === 'avis_fouduglen')).toBe(true);
  });
  it('fil court « Les Vilinsekts » : Cindy Cah au niveau 30, planque, lieutenants, Cache de Kankreblath', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    expect(Q.pnj('cindy')?.tag).toBe('5_-17');
    p.level = 20; expect(Q.aDonnerTous('cindy')).toEqual([]);
    p.level = 30; expect(Q.aDonnerTous('cindy')).toEqual(['vil_1']);
    Q.prendre('vil_1');
    const z = w.openestCellOf('planque_6_-21'); p.x = z.x; p.y = z.y; w.step(1 / 60, NO_INPUT);
    expect(Q.enCours.find(c => c.id === 'vil_1')!.etape).toBe(1);
    for (let i = 0; i < 10; i++) w.emit({ k: 'kill', x: z.x, y: z.y, radius: 1, monster: 'cafarcher' });
    w.step(1 / 60, NO_INPUT);
    expect(Q.finies.has('vil_1')).toBe(true);
    expect(Q.enCours.some(c => c.id === 'vil_2')).toBe(true);
    expect(w.monsters.filter(m => !m.dead && Q.estEliteDeQuete(m.id))).toHaveLength(3);
    expect(Q.def('vil_3').etapes).toBeTruthy();
  });
});

describe('Nouveaux objectifs, défis de donjon et Chasse au Dopeul (Quêtes roadmap 3B, 6A+6D, 7B)', () => {
  /** Une quête d'essai avec un seul objectif, prise tout de suite. */
  function essai(w: World, o: object) {
    const Q = w.quetes!;
    (Q.data.quetes as Record<string, unknown>)['essai_obj'] = { nom: 'Essai', type: 'secondaire', niveau: 1, texte: '', recompense: {}, etapes: [{ nom: 'Essai', objectifs: [o] }] };
    Q.prendre('essai_obj');
    return Q.enCours.find(c => c.id === 'essai_obj')!;
  }
  it('défense : 60 s tenues sur la carte avec des vagues ; quitter la carte remet le compte à zéro', () => {
    const w = monde(), p = w.player; p.level = 30;
    const c = essai(w, { t: 'defense', carte: '5_-25', s: 60, texte: 'Tenir' });
    const z = w.openestCellOf('5_-25'), n0 = w.monsters.filter(m => !m.dead).length;
    p.x = z.x; p.y = z.y;
    for (let i = 0; i < 60 * 20; i++) { w.step(1 / 60, NO_INPUT); p.hp = p.maxHp; }
    expect(c.compte[0]).toBeGreaterThanOrEqual(19);
    expect(w.monsters.filter(m => !m.dead).length).toBeGreaterThan(n0);
    const ailleurs = w.openestCellOf('5_-19'); p.x = ailleurs.x; p.y = ailleurs.y; for (let i = 0; i < 200; i++) w.step(1 / 60, NO_INPUT);
    expect(c.compte[0]).toBe(0);
    p.x = z.x; p.y = z.y;
    for (let i = 0; i < 60 * 62; i++) { w.step(1 / 60, NO_INPUT); p.hp = p.maxHp; p.x = z.x; p.y = z.y; }
    expect(w.quetes!.finies.has('essai_obj')).toBe(true);
    delete (w.quetes!.data.quetes as Record<string, unknown>)['essai_obj'];
  });
  it('contre la montre : la carte vidée à temps valide l\'objectif', () => {
    const w = monde(), p = w.player; p.level = 30;
    essai(w, { t: 'chrono', carte: '5_-25', s: 90, texte: 'Vider' });
    const z = w.openestCellOf('5_-25'); p.x = z.x; p.y = z.y;
    for (let i = 0; i < 30; i++) w.step(1 / 60, NO_INPUT);
    const wg = w.worldGrid!;
    for (const m of w.monsters) if (!m.dead && wg.mapAt(m.x, m.y)?.tag === '5_-25') { m.hp = 0; m.dead = true; }
    w.step(1 / 60, NO_INPUT);
    expect(w.quetes!.finies.has('essai_obj')).toBe(true);
    delete (w.quetes!.data.quetes as Record<string, unknown>)['essai_obj'];
  });
  it('défi du jour : proposé par le gardien, réussi sans potion, raté avec une potion', () => {
    const w = monde(), Q = w.quetes!, p = w.player; p.level = 30;
    const id = Q.defiLibre('Cour du Bouftou Royal')!;
    expect(id).toBe('defi:2026-11-08:Cour du Bouftou Royal');
    expect(Q.def(id).rendre).toBe(Q.gardienDe('Cour du Bouftou Royal'));
    rendre(w, Q.gardienDe('Cour du Bouftou Royal')!);
    expect(Q.dialogue!.reponses.some(r => r.a === 'voir' && r.quete === id)).toBe(true);
    Q.dialogue = null;
    Q.prendre(id);
    p.resources['1568'] = 1; w.entrerDonjon('Cour du Bouftou Royal');
    for (let i = 0; i < 30; i++) w.step(1 / 60, NO_INPUT);
    const o = (Q.def(id).etapes as { objectifs: { regle: string }[] }[])[0].objectifs[0];
    if (o.regle === 'sansPotion') Q.observer({ k: 'potion', x: p.x, y: p.y, amount: 1 });
    else for (let i = 0; i < 60 * 600; i += 60) w.time += 1;
    w.emit({ k: 'kill', x: p.x, y: p.y, radius: 1, monster: w.bossDuDonjon('Cour du Bouftou Royal')! });
    w.step(1 / 60, NO_INPUT);
    expect(Q.enCours.find(c => c.id === id)?.compte[0]).toBe(0);
  });
  it('Chasse au Dopeul : le Dopeul de ta classe, une fois par jour', () => {
    const w = monde(), Q = w.quetes!, p = w.player; p.level = 12;
    expect(Q.pnj('temples')?.tag).toBe('4_-18');
    expect(Q.aDonnerTous('temples')).toEqual(['dopeul']);
    Q.prendre('dopeul');
    const m = w.monsters.find(x => !x.dead && x.type === 'dopeul_iop' && Q.estEliteDeQuete(x.id))!;
    expect(m).toBeTruthy();
    Q.eliteVaincu(m.id); w.step(1 / 60, NO_INPUT);
    rendre(w, 'temples');
    expect(Q.finies.has('dopeul')).toBe(true);
    expect(Q.aDonnerTous('temples')).toEqual([]);
    const w2 = monde('2026-11-09', Q.exporter()); w2.player.level = 12;
    expect(w2.quetes!.aDonnerTous('temples')).toEqual(['dopeul']);
  });
});

describe('Quêtes officielles d\'Astrub écrites en ARPG (Quêtes roadmap 2C)', () => {
  it('6 quêtes, chacune avec son PNJ officiel posé dans Astrub et rendue à lui', () => {
    const w = monde(), Q = w.quetes!; w.player.level = 40;
    const ids = ['aigris', 'piques', 'crime', 'trempette', 'bucherons', 'profanateurs'];
    for (const id of ids) {
      const q = Q.def(id);
      expect(Q.pnj(q.pnj!), id).toBeTruthy();
      expect(q.rendre).toBe(q.pnj);
      expect(Q.aDonnerTous(q.pnj!)).toContain(id);
    }
  });
  it('Crime et châtiment : trois objets de quête, trois sous-zones', () => {
    const w = monde(), Q = w.quetes!, p = w.player; p.level = 20;
    Q.prendre('crime');
    for (const [sub, m] of [[95, 'piou_bleu'], [30, 'bouftou'], [96, 'martoa']] as const) {
      const z = dans(w, sub);
      for (let i = 0; i < 80 && (Q.enCours.find(c => c.id === 'crime')?.aRendre === false); i++) w.emit({ k: 'kill', x: z.x, y: z.y, radius: 1, monster: m });
    }
    w.step(1 / 60, NO_INPUT);
    expect(Q.aRendre('jim')).toBe('crime');
    rendre(w, 'jim');
    expect(Q.finies.has('crime')).toBe(true);
    expect(Q.objets['Bourse rebondie']).toBeUndefined();
  });
});
