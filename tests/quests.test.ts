import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import type { QuetesData } from '../src/sim/quests';
import QUETES from '../src/data/quetes.json';
import ITEMS from '../src/data/items.json';
import type { ItemsData } from '../src/sim/items';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const Q = QUETES as unknown as QuetesData;
const newWorld = (persos = 0) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos } });
const STEP = 1 / 60;

describe('quêtes et succès', () => {
  it('les données renvoient à des PNJ, monstres, objets et quêtes qui existent', () => {
    const I = ITEMS as unknown as ItemsData;
    const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
    for (const [id, q] of Object.entries(Q.quetes)) {
      if (q.pnj) expect(Q.pnj[q.pnj], id).toBeDefined();
      if (q.rendre) expect(Q.pnj[q.rendre], id).toBeDefined();
      if (q.suivante) expect(Q.quetes[q.suivante], id).toBeDefined();
      for (const r of q.requiert ?? []) expect(Q.quetes[r], id).toBeDefined();
      for (const [o] of q.recompense.objets ?? []) expect(I.resources[o] ?? I.equipment[o], `${id} ${o}`).toBeDefined();
      const etapes = Array.isArray(q.etapes) ? q.etapes : Object.values(q.etapes).flat();
      const ici = q.pnj && Q.pnj[q.pnj]?.zone === 'astrub' ? astrub : monde;
      for (const o of etapes.flatMap(e => e.objectifs)) {
        if (o.t === 'elite') { expect(GAME_DATA.monsters[o.monstre], o.monstre).toBeDefined(); expect(ici.maps.some(m => m.tag === o.carte), o.carte).toBe(true); }
        if (o.t === 'vaincre') for (const m of o.monstres ?? []) expect(GAME_DATA.monsters[m], m).toBeDefined();
        if ((o.t === 'aller' || o.t === 'parler') && o.pnj) expect(Q.pnj[o.pnj], o.pnj).toBeDefined();
      }
    }
    const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
    const bastion = lire('bastion'), havresac = lire('havresac');
    for (const p of Object.values(Q.pnj)) expect((p.zone === 'astrub' ? astrub : p.zone === 'bastion' ? bastion : p.zone === 'havresac' ? havresac : monde).maps.some(m => m.tag === p.carte), p.carte).toBe(true);
    for (const s of Object.values(Q.succes)) for (const o of s.objectifs) if ('succes' in o) expect(Q.succes[o.succes]).toBeDefined();
  });

  it('le tutoriel (une trame par classe) apprend chaque contrôle, donne l\'arme et ouvre la quête suivante', () => {
    for (const [classe, sort1, arme] of [['iop', 'pression', '10797'], ['cra', 'recul', '1942']] as const) {
      const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos: 0 }, classId: classe });
      const q = w.quetes!, p = w.player, etape = () => q.enCours.find(c => c.id === 'reponses')?.etape;
      expect(q.suivie).toBe('reponses');
      expect(etape()).toBe(0);
      // départ au Temple Céleste, devant Ganymède ; le point de retour reste la Route des âmes
      expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('temple_1');
      // la flèche vise la porte de la salle (pas le but à travers le vide)
      const sortie1 = w.portes.find(po => po.ends[0].tag === 'temple_1')!.ends[0];
      expect(q.cible()).toEqual({ x: sortie1.x, y: sortie1.y });
      const t2 = w.openestCellOf('temple_2'); p.x = t2.x; p.y = t2.y;
      w.step(STEP, NO_INPUT);
      expect(etape(), classe).toBe(1);
      // tout le tutoriel se fait dans le Temple ; pas de monstres dès l'entrée dans la salle
      const temple = () => w.monsters.filter(x => !x.dead && w.worldGrid!.mapAt(x.x, x.y)?.sub === 446);
      expect(temple().length).toBe(0);
      const g0 = q.pnj('ganymede_temple')!;
      expect(w.worldGrid!.mapAt(g0.x, g0.y)?.tag).toBe('temple_2');
      p.x = g0.x + 20; p.y = g0.y;
      w.step(STEP, NO_INPUT);
      expect(etape(), classe).toBe(2);
      // étape « Frapper » : les esprits de feu arrivent dans les salles 2 et 3 (pas dans la salle des Dofus), loin du perso
      w.step(STEP, NO_INPUT);
      expect(new Set(temple().map(x => w.worldGrid!.mapAt(x.x, x.y)!.tag))).toEqual(new Set(['temple_2', 'temple_3']));
      expect(Math.min(...temple().map(x => Math.hypot(x.x - p.x, x.y - p.y)))).toBeGreaterThan(250);
      const m = w.monsters.find(x => w.worldGrid!.mapAt(x.x, x.y)?.sub === 446)!;
      const tuer = (n: number) => { for (let i = 0; i < n; i++) w.emit({ k: 'kill', x: m.x, y: m.y, radius: 10, monster: m.type }); };
      tuer(1); expect(etape()).toBe(3);
      expect(q.etapeDe(q.enCours[0])?.halo).toBe(0);
      expect(p.bar[0]).toBe(sort1);
      w.emit({ k: 'cast', id: sort1 }); expect(etape()).toBe(4);
      tuer(3); expect(etape()).toBe(5);
      w.emit({ k: 'rageSpent', spell: sort1 }); expect(etape()).toBe(6);
      w.emit({ k: 'cast', id: p.cls.mobility }); expect(etape()).toBe(7);
      w.emit({ k: 'potion', x: p.x, y: p.y, amount: 10 }); expect(etape()).toBe(8);
      const it = p.bag.find(i => i.id === arme)!;
      expect(it, classe).toBeDefined();
      expect(p.equip(it.uid)).toBe(true);
      w.step(STEP, NO_INPUT); expect(etape()).toBe(8);   // il reste la panoplie de l'Intrépide (équipement de départ officiel)
      const pano = ['10801', '10800', '10784', '10785', '10799', '10794', ...(classe === 'iop' ? ['10798'] : [])];   // bouclier avec l'épée
      for (const id of pano) { const o = p.bag.find(i => i.id === id)!; expect(o, id).toBeDefined(); expect(p.equip(o.uid), id).toBe(true); }
      w.step(STEP, NO_INPUT); expect(etape()).toBe(9);
      // pas de porte dans le vide : on parle à Ganymède, qui envoie le perso au village, sur le cercle de pierre de [-2,-3]
      expect(q.finies.has('reponses')).toBe(false);
      const gt = q.pnj('ganymede_temple')!;
      p.x = gt.x + 40; p.y = gt.y;
      w.step(STEP, { ...NO_INPUT, talk: 'ganymede_temple', dest: { x: gt.x, y: gt.y } });
      for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
      expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('-2_-3');
      expect(q.finies.has('reponses')).toBe(true);
      expect(p.level).toBeGreaterThanOrEqual(2);
      expect(q.enCours.map(c => c.id)).toEqual(['village']);
      expect(q.succes.has('premier_temps')).toBe(true);
      const ev = w.drainEvents().map(e => e.k);
      expect(ev).toContain('queteFin');
      expect(ev).toContain('succes');
    }
  });

  it('le Temple Céleste : 3 salles reliées, sans porte dans le vide vers la Route des âmes', () => {
    const w = newWorld(), wg = w.worldGrid!;
    const tags = (n: number) => w.portes[n].ends.map(e => e.tag);
    const ids = w.portes.map((_, i) => tags(i).join('>'));
    expect(ids).toContain('temple_1>temple_2');
    expect(ids).toContain('temple_2>temple_3');
    expect(ids.some(x => x.includes('0_-3') && x.includes('temple'))).toBe(false);
    expect(wg.freeByMap.get('temple_1')!.length).toBeGreaterThan(100);
  });

  it('tutoriel : la Précision du Crâ (sans arc) se remplit en quelques touches, les esprits reviennent vite', () => {
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos: 0 }, classId: 'cra' });
    const p = w.player;
    let n = 0;
    while (!p.rageFull && n < 50) { p.rageOnHit(500, w); n++; }
    expect(n).toBeLessThanOrEqual(10);   // de loin
    p.rage = 0; n = 0;
    while (!p.rageFull && n < 50) { p.rageOnHit(40, w); n++; }
    expect(n).toBeLessThanOrEqual(25);   // même au poing, ça finit par venir
  });

  it('le tutoriel est sauté dès le 2e perso ; les PV restent à 1 pendant le tutoriel', () => {
    expect(newWorld(1).quetes!.finies.has('reponses')).toBe(true);
    const w = newWorld(), p = w.player;
    p.invuln = 0; p.hurt(99999, p.x + 10, p.y, w);
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(1);
  });

  it('clic sur un PNJ : le perso y va, prend la quête ; une série se rend au PNJ', () => {
    const w = newWorld(1), q = w.quetes!, p = w.player;
    const cap = q.pnj('capitaine')!;
    expect(q.icone('capitaine')).toEqual({ quete: 'epreuve', rendre: false });
    p.x = cap.x + 40; p.y = cap.y;
    w.step(STEP, { ...NO_INPUT, talk: 'capitaine', dest: { x: cap.x, y: cap.y } });
    for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
    // le dialogue s'ouvre sur l'offre : texte, récompenses, Accepter / Plus tard / Au revoir
    expect(q.dialogue?.quete).toBe('epreuve');
    expect(q.dialogue!.reponses.map(r => r.a)).toEqual(['accepter', 'retour', 'fermer']);
    expect(q.enCours.some(c => c.id === 'epreuve')).toBe(false);
    w.step(STEP, { ...NO_INPUT, reponse: 0 });
    expect(q.dialogue).toBeNull();
    expect(q.enCours.some(c => c.id === 'epreuve')).toBe(true);
    // la Caporale Mynerve apparaît comme élite de quête
    const el = w.monsters.find(m => m.type === 'caporale_mynerve')!;
    expect(el).toBeDefined();
    expect(q.estEliteDeQuete(el.id)).toBe(true);
    // le Capitaine est dans la tour : la flèche vise d'abord la porte, puis l'élite une fois dehors
    expect(q.cible()).not.toEqual({ x: el.x, y: el.y });
    const px = p.x, py = p.y;
    p.x = el.x + 30; p.y = el.y;
    expect(q.cible()).toEqual({ x: el.x, y: el.y });
    p.x = px; p.y = py;
    w.killMonster(el);
    const c = q.enCours.find(x => x.id === 'epreuve')!;
    expect(c.aRendre).toBe(true);
    expect(q.icone('capitaine')).toEqual({ quete: 'epreuve', rendre: true });
    const xp = p.xp, lvl = p.level;
    w.step(STEP, { ...NO_INPUT, talk: 'capitaine', dest: { x: cap.x, y: cap.y } });
    for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
    expect(q.finies.has('epreuve')).toBe(true);
    expect(q.dialogue?.pnj).toBe('capitaine');   // remerciement dans la bulle (6B)
    expect(p.level > lvl || p.xp > xp).toBe(true);
    expect(p.resources['16518']).toBe(5);
    // la suivante de la série est maintenant proposée (niveau assez haut)
    p.level = 5;
    expect(q.aDonner('capitaine')).toBe('champs_bataille');
  });

  it('les succès de découverte de zone tombent en entrant dans la sous-zone', () => {
    const w = newWorld(1), q = w.quetes!;
    for (let i = 0; i < 3; i++) w.step(STEP, NO_INPUT);
    expect(q.succes.has('zone_route')).toBe(true);
    expect(q.points).toBeGreaterThanOrEqual(1);
  });

  it('« Mort au rat ! » démarre seule dans la Taverne et se valide sur place', () => {
    const w = newWorld(1), q = w.quetes!, p = w.player;
    p.level = 7;
    const t = w.openestCellOf('taverne'); p.x = t.x; p.y = t.y;
    w.step(STEP, NO_INPUT);
    expect(q.enCours.some(c => c.id === 'mort_au_rat')).toBe(true);
    const rat = w.monsters.find(m => m.type === 'rat_soiffe')!;
    w.killMonster(rat);
    expect(q.finies.has('mort_au_rat')).toBe(true);
  });

  it('dialogue : Plus tard revient à la liste, un coup reçu ou s\'éloigner ferme, un PNJ sans quête dit sa phrase', () => {
    const w = newWorld(1), q = w.quetes!, p = w.player;
    const parler = (id: string) => {
      const n = q.pnj(id)!; p.x = n.x + 40; p.y = n.y;
      w.step(STEP, { ...NO_INPUT, talk: id, dest: { x: n.x, y: n.y } });
      for (let i = 0; i < 3; i++) w.step(STEP, NO_INPUT);
    };
    parler('capitaine');
    w.step(STEP, { ...NO_INPUT, reponse: 1 });   // Plus tard
    expect(q.dialogue?.quete).toBeUndefined();
    expect(q.dialogue!.reponses.map(r => r.a)).toEqual(['voir', 'fermer']);
    w.step(STEP, { ...NO_INPUT, reponse: 0 });   // revoir l'offre
    expect(q.dialogue?.quete).toBe('epreuve');
    w.step(STEP, { ...NO_INPUT, reponse: -1 });  // croix
    expect(q.dialogue).toBeNull();
    parler('capitaine');
    p.invuln = 0; p.hurt(1, p.x + 10, p.y, w);
    expect(q.dialogue).toBeNull();
    parler('capitaine');
    p.x += 1000; q.update(STEP);
    expect(q.dialogue).toBeNull();
    const autre = q.pnjs.find(n => !q.aDonner(n.id) && !q.aRendre(n.id) && !q.attendParler(n.id) && Q.pnj[n.id].phrase)!;
    parler(autre.id);
    expect(q.dialogue?.texte).toBe(Q.pnj[autre.id].phrase);
    expect(q.dialogue!.reponses.at(-1)!.texte).toBe('Au revoir.');
  });

  it('aucun groupe de monstres autour des PNJ (4C)', () => {
    const w = newWorld(1), q = w.quetes!;
    for (const n of q.pnjs) for (const m of w.monsters) if (!m.def.elite) expect(Math.hypot(m.x - n.x, m.y - n.y), n.id).toBeGreaterThan(250);
  });
  it('tutoriel décoché à la création : passé, mais l\'équipement de départ est donné et porté (et coché, il se fait même au 2e perso)', () => {
    for (const [classe, arme] of [['iop', '10797'], ['cra', '1942']] as const) {
      const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos: 0 }, classId: classe, tuto: false });
      const q = w.quetes!, p = w.player;
      expect(q.finies.has('reponses')).toBe(true);
      expect(w.worldGrid!.mapAt(p.x, p.y)?.tag.startsWith('temple')).toBe(false);
      const portes = Object.values(p.equipment).map(it => it!.id);
      for (const id of ['10801', '10800', '10784', '10785', '10799', '10794', arme]) expect(portes, `${classe} ${id}`).toContain(id);
      if (classe === 'iop') expect(portes).toContain('10798');
    }
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 7, items: ITEMS as unknown as ItemsData, quetes: Q, compte: { succes: [], persos: 3 }, tuto: true });
    expect(w.quetes!.enCours.some(c => c.id === 'reponses')).toBe(true);
  });
});
