import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { MAP_COLS, MAP_ROWS, WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const STEP = 1 / 60;
const newWorld = (seed = 42) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed, groupesPartout: true });
const zone = GAME_DATA.zones.incarnam.open!;

describe('monde d\'Incarnam (cartes Dofus collées)', () => {
  const wg = new WorldGrid(monde);
  it('la grande grille couvre toutes les cartes', () => {
    const xs = monde.maps.map(m => m.x + (m.n?.[0] ?? 1) - 1).concat(monde.maps.map(m => m.x));
    const ys = monde.maps.map(m => m.y + (m.n?.[1] ?? 1) - 1).concat(monde.maps.map(m => m.y));
    expect(wg.cols).toBe((Math.max(...xs) - Math.min(...xs) + 1) * MAP_COLS);
    expect(wg.rows).toBe((Math.max(...ys) - Math.min(...ys) + 1) * MAP_ROWS);
    expect(monde.mov).toHaveLength(wg.cols * wg.rows);
  });
  it('chaque case marchable appartient à une carte, et chaque carte a des cases marchables', () => {
    for (const c of wg.free.slice(0, 2000)) expect(wg.mapOfCell(c)).toBeDefined();
    for (const m of monde.maps) expect(wg.freeByMap.get(m.tag)!.length).toBeGreaterThan(m.inside ? 20 : 50);
  });
  it('Incarnam entier : Route des âmes, Champs, Pâturages, Lac, Forêt et Cimetière, chacun avec ses monstres officiels', () => {
    expect(monde.maps.filter(m => !m.inside).length).toBe(50);
    for (const sub of ['450', '444', '445', '442', '443', '449']) {
      expect(monde.maps.some(m => String(m.sub) === sub), sub).toBe(true);
      for (const t of zone.subareas[sub].monsters) expect(GAME_DATA.monsters[t]?.dofusId, t).toBeDefined();
    }
  });
  it('retrouve la carte sous un point du monde', () => {
    const m = wg.mapByCoords(-2, -5)!, c = wg.freeByMap.get(m.tag)![10], p = wg.cellToWorld(c);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe('-2_-5');
  });
  it('on passe d\'une carte à sa voisine à pied : cases marchables de part et d\'autre du bord', () => {
    // Route des âmes [0,-3] -> [1,-3] : la colonne 13 de l'une touche la colonne 0 de l'autre
    const a = wg.mapByCoords(0, -3)!, b = wg.mapByCoords(1, -3)!;
    const edgeA = wg.freeByMap.get(a.tag)!.filter(c => c % MAP_COLS === MAP_COLS - 1);
    const edgeB = wg.freeByMap.get(b.tag)!.filter(c => c % MAP_COLS === 0);
    expect(edgeA.some(c => edgeB.includes(c + 1))).toBe(true);
  });
});

describe('monde ouvert', () => {
  it('pose des groupes de monstres officiels de chaque sous-zone, qui attendent', () => {
    const w = newWorld();
    expect(w.monsters.length).toBeGreaterThan(40);
    const wg = w.worldGrid!;
    for (const m of w.monsters) {
      const sub = zone.subareas[String(wg.mapAt(m.homeX, m.homeY)!.sub)];
      expect(sub.monsters).toContain(m.type);
    }
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(w.monsters.every(m => m.state === 'idle')).toBe(true);
  });
  it('part de la Route des âmes et le HUD connaît la sous-zone', () => {
    const w = newWorld();
    w.step(STEP, NO_INPUT);
    expect(w.area?.name).toBe('Route des âmes');
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
  });
  it('un monstre approché alerte tout son groupe, qui rentre chez lui si on fuit', () => {
    const w = newWorld(3), m = w.monsters[0];
    const mates = w.monsters.filter(o => o.group === m.group);
    w.player.x = m.x + 60; w.player.y = m.y;
    for (let i = 0; i < 70; i++) w.step(STEP, NO_INPUT);
    expect(mates.some(o => o.state !== 'idle')).toBe(true);
    expect(mates.every(o => o.state !== 'idle' || o.dead)).toBe(true);
    // le joueur se téléporte loin : perdu de vue -> retour ; maquette « Aggro » 2B : il garde ses blessures
    w.player.x += 5000; m.hp = 1;
    for (let i = 0; i < 60 * 10; i++) w.step(STEP, NO_INPUT);
    expect(m.state).toBe('idle');
    expect(m.hp).toBeLessThan(m.maxHp * 0.3);
  });
  it('un groupe vaincu réapparaît quand le joueur est loin, et rend une potion', () => {
    const w = newWorld(5), g = w.monsters[0].group, ev: string[] = [];
    w.player.potions = 0;
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);   // fin de l'apparition
    for (const m of w.monsters.filter(o => o.group === g)) w.hitCircle(m.x, m.y, 1, { dmg: 999, knock: 0 });
    for (let i = 0; i < 60; i++) { w.step(STEP, NO_INPUT); ev.push(...w.drainEvents().map(e => e.k)); }
    expect(ev).toContain('groupCleared');
    expect(w.player.potions).toBe(1);
    expect(w.monsters.some(m => m.group === g)).toBe(false);
    w.player.x += 5000;
    for (let i = 0; i < 60 * (zone.respawn + 1); i++) w.step(STEP, NO_INPUT);
    expect(w.monsters.some(m => m.group === g)).toBe(true);
  });
  it('après une mort, Entrée ramène au départ avec tous ses PV', () => {
    const w = newWorld();
    const start = { x: w.player.x, y: w.player.y };
    w.player.x += 300; w.player.hurt(9999, w.player.x, w.player.y, w);
    expect(w.over).toBe(true);
    w.respawnPlayer();
    expect(w.over).toBe(false);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect([w.player.x, w.player.y]).toEqual([start.x, start.y]);
  });
});

/** Laisse passer le fondu de sortie d'une porte (World.PASSAGE), sans toucher au clavier. */
function finirPassage(w: World) { for (let i = 0; i < 60 && w.passage; i++) w.step(STEP, NO_INPUT); }

describe('intérieurs (maisons, Mine, Taverne)', () => {
  it('chaque porte mène de l\'autre côté, et la porte d\'arrivée ne renvoie pas aussitôt', () => {
    const w = newWorld(), wg = w.worldGrid!, p = w.player;
    expect(w.portes.length).toBeGreaterThanOrEqual(19);
    for (const po of w.portes) for (let i = 0; i < 2; i++) {
      const from = po.ends[i], to = po.ends[1 - i];
      if (i === 1 && po.sens) continue;   // donjon : on ne revient pas en arrière
      if (po.verrou) for (const m of w.monsters) if (wg.mapAt(m.homeX, m.homeY)?.tag === from.tag) m.dead = true;
      // une case marchable dans le rayon de la porte (on peut l'atteindre à pied)
      const c = wg.freeByMap.get(from.tag)!.map(c => wg.cellToWorld(c)).find(q => Math.hypot(q.x - from.x, q.y - from.y) <= World.PORTE_R);
      expect(c, `${po.nom} ${from.tag}`).toBeDefined();
      p.x = c!.x; p.y = c!.y; p.hp = p.maxHp;
      w.step(STEP, NO_INPUT);
      expect(wg.mapAt(p.x, p.y)?.tag, 'en passant devant, on n\'entre pas').toBe(from.tag);
      w.step(STEP, { ...NO_INPUT, dest: { x: from.x, y: from.y }, versPortail: po.dessin ? po.nom : null });   // clic sur la porte (ou le dessin du portail)
      expect(w.passage, 'le perso attend le fondu devant la porte').not.toBeNull();
      expect(wg.mapAt(p.x, p.y)?.tag).toBe(from.tag);
      finirPassage(w);
      expect(wg.mapAt(p.x, p.y)?.tag, `${from.tag} -> ${to.tag}`).toBe(to.tag);
      const there = { x: p.x, y: p.y };
      w.step(STEP, NO_INPUT);
      expect(wg.mapAt(p.x, p.y)?.tag).toBe(to.tag);
      expect(Math.hypot(p.x - there.x, p.y - there.y)).toBeLessThan(20);
      w.drainEvents();
      // on s'éloigne (coin du monde sans porte) : la porte se réarme
      const loin = wg.cellToWorld(wg.freeByMap.get('-3_-6')![0]);
      p.x = loin.x; p.y = loin.y; w.step(STEP, NO_INPUT);
    }
  });
  it('la Mine a ses Aminites, le Temple ses esprits de feu du tutoriel, les maisons restent vides', () => {
    const w = newWorld(), wg = w.worldGrid!;
    const inside = w.monsters.map(m => wg.mapAt(m.homeX, m.homeY)!).filter(m => m.inside);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.filter(m => m.sub !== 447).every(m => m.sub === 778 || m.sub === 446)).toBe(true);
    expect(w.monsters.filter(m => wg.mapAt(m.homeX, m.homeY)!.sub === 778).every(m => m.type === 'aminite')).toBe(true);
  });
});

describe('Crypte de Kardorim (une seule arène, maquette « Donjons en vagues »)', () => {
  const vivants = (w: World) => w.monsters.filter(m => !m.dead && m.arene);
  const tuerTout = (w: World) => { for (const m of vivants(w)) if (!m.def.boss) w.killMonster(m); };
  it('plus de monstres dans les anciennes salles ; la porte du cimetière mène droit à l\'arène, protégé à l\'arrivée', () => {
    const w = newWorld(), wg = w.worldGrid!, p = w.player;
    expect(w.monsters.some(m => wg.mapAt(m.homeX, m.homeY)?.tag.startsWith('crypte_'))).toBe(false);
    const po = w.entreeDonjon('Crypte de Kardorim')!;
    expect(po.ends[1].tag).toBe('arene_crypte');
    expect(po.sens).toBe(true);
    expect(w.entrerDonjon('Crypte de Kardorim')).toBe(true);
    finirPassage(w);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe('arene_crypte');
    expect(p.invuln).toBeGreaterThan(1);
    expect(w.arene?.nom).toBe('Crypte de Kardorim');
    expect(w.drainEvents().some(e => e.k === 'areneDebut')).toBe(true);
  });
  it('3 vagues par les entrées (cercle rouge avant), puis Kardorim intouchable à ses paliers, puis portail et coffre', () => {
    const w = newWorld(), p = w.player;
    w.allerArene('arene_crypte');
    const a = w.arene!;
    // 15A : la vague 1 attend le premier geste, au plus 3 s
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(a.vague).toBe(0);
    for (let i = 0; i < 150; i++) w.step(STEP, NO_INPUT);
    expect(a.vague).toBe(1);
    expect(w.telegraphs.some(t => t.kind === 'circle' && t.danger)).toBe(true);
    const ev: string[] = [];
    for (let t = 0; t < 60 * 60 && !a.boss; t++) {
      p.hp = p.maxHp; p.dead = false;
      w.step(STEP, NO_INPUT); tuerTout(w);
      for (const e of w.drainEvents()) if (e.k === 'areneVague') ev.push(e.boss ?? e.nom ?? String(e.n));
    }
    expect(ev.length).toBe(4);
    expect(ev.at(-1)).toBe('kardorim');
    const k = a.boss!;
    expect(k.type).toBe('kardorim');
    // 8C : à 66 %, il appelle une vague et devient intouchable tant qu'elle vit
    k.hp = k.maxHp * 0.6;
    for (let i = 0; i < 5; i++) w.step(STEP, NO_INPUT);
    expect(k.intouchable).toBe(true);
    const hp = k.hp;
    w.hitCircle(k.x, k.y, 50, { dmg: 500, knock: 0 });
    expect(k.hp).toBe(hp);
    for (let t = 0; t < 4 * 60; t++) { p.hp = p.maxHp; w.step(STEP, NO_INPUT); for (const m of vivants(w)) if (m !== k && m.summoner !== k) w.killMonster(m); }
    expect(k.intouchable).toBe(false);
    w.killMonster(k);
    for (let i = 0; i < 3; i++) w.step(STEP, NO_INPUT);
    expect(a.fini).toBe(true);
    expect(p.cleDonjon).toBeNull();
    // 13A : le coffre à côté du portail, puis le portail ramène devant le gardien
    w.drainEvents();
    p.x = a.pts.coffre.x; p.y = a.pts.coffre.y; w.step(STEP, NO_INPUT);
    expect(a.coffreOuvert).toBe(true);
    // Coffres 2A : le butin jaillit quand il éclate en pièces d'or, pas avant
    expect(w.drainEvents().some(e => e.k === 'status' && e.text === 'Coffre du donjon')).toBe(false);
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(w.drainEvents().some(e => e.k === 'status' && e.text === 'Coffre du donjon')).toBe(true);
    p.x = a.pts.sortie.x; p.y = a.pts.sortie.y; w.step(STEP, NO_INPUT); finirPassage(w);
    expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe(w.entreeDonjon('Crypte de Kardorim')!.ends[0].tag);
  });
  it('14A : mort à la vague 3, on y revient sans clé pendant 10 min, monstres de la vague remis à neuf', () => {
    const w = newWorld(), p = w.player;
    w.allerArene('arene_crypte');
    for (let t = 0; t < 60 * 60 && w.arene!.vague < 3; t++) { p.hp = p.maxHp; w.step(STEP, NO_INPUT); tuerTout(w); }
    expect(w.arene!.vague).toBe(3);
    p.hp = 0; p.dead = true; w.respawnPlayer();
    expect(w.arene).toBeNull();
    expect(vivants(w).length).toBe(0);
    expect(p.cleDonjon).toMatchObject({ nom: 'Crypte de Kardorim', vague: 3 });
    w.allerArene('arene_crypte');
    for (let i = 0; i < 200; i++) w.step(STEP, NO_INPUT);
    expect(w.arene!.vague).toBe(3);
    for (let i = 0; i < 601 * 60; i += 60) w.step(1, NO_INPUT);
    expect(p.cleDonjon).toBeNull();
  });
  it('rechargé (Ctrl+F5) dans l\'arène : les vagues reprennent à la vague atteinte ; sans clé valable, retour devant le gardien', () => {
    const w = newWorld(), p = w.player;
    w.allerArene('arene_crypte');
    for (let t = 0; t < 60 * 60 && w.arene!.vague < 2; t++) { p.hp = p.maxHp; w.step(STEP, NO_INPUT); tuerTout(w); }
    const e = JSON.parse(JSON.stringify(exporterJoueur(w)));
    const w2 = newWorld(); restaurerJoueur(w2, e);
    expect(w2.worldGrid!.mapAt(w2.player.x, w2.player.y)?.tag).toBe('arene_crypte');
    expect(w2.arene?.nom).toBe('Crypte de Kardorim');
    for (let i = 0; i < 200; i++) w2.step(STEP, NO_INPUT);
    expect(w2.arene!.vague).toBe(2);
    expect(vivants(w2).length + w2.arene!.arrivees.length).toBeGreaterThan(0);
    // clé expirée (ou boss déjà tombé) : on ressort devant le gardien
    const e3 = { ...e, cleDonjon: null };
    const w3 = newWorld(); restaurerJoueur(w3, e3);
    expect(w3.arene).toBeNull();
    expect(w3.worldGrid!.mapAt(w3.player.x, w3.player.y)?.tag).toBe(w3.entreeDonjon('Crypte de Kardorim')!.ends[0].tag);
  });
  it('Kardorim invoque un seul Kardorib à la fois, qui disparaît avec lui', () => {
    const w = newWorld(), p = w.player;
    w.allerArene('arene_crypte');
    const k = w.spawnMonster('kardorim', p.x + 200, p.y);
    const ribs = () => w.monsters.filter(m => m.type === 'kardorib' && !m.dead);
    let max = 0;
    for (let t = 0; t < 40 * 60; t++) {
      p.x = k.x + 120; p.y = k.y; p.hp = p.maxHp; p.dead = false;
      w.step(STEP, NO_INPUT); max = Math.max(max, ribs().length);
      for (const m of w.monsters) if (m.arene && m !== k && !m.dead && m.type !== 'kardorib') { m.dead = true; m.t = 0; }
    }
    expect(max).toBe(1);
    expect(ribs()[0]?.summoner).toBe(k);
    w.killMonster(k);
    expect(ribs().length).toBe(0);
  });
});
