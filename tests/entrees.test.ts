import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { ISO } from '../src/sim/iso';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: vide });
const porte = (w: World, nom: string) => w.portes.find(p => p.nom === nom)!;
const ici = (w: World) => w.worldGrid!.mapAt(w.player.x, w.player.y)?.tag;
/** Marche au clavier dans une direction pendant n images (sans clic). */
const marcher = (w: World, dx: number, dy: number, n: number) => {
  const d = Math.hypot(dx, dy);
  for (let i = 0; i < n && !w.passage; i++) w.step(1 / 60, { ...NO_INPUT, move: { x: dx / d, y: dy / d } });
  for (let i = 0; i < 40; i++) w.step(1 / 60, NO_INPUT);
};

describe('entrées et sorties (maquette Entrées)', () => {
  it('chaque intérieur porte le nom de sa porte (5A), annoncé en entrant', () => {
    const w = monde();
    expect(w.lieux.get('taverne')).toBe("Taverne d'Astrub");
    expect(w.lieux.get('arene_grange')).toBe('Grange du Tournesol Affamé');
    expect(w.lieux.get('grenier_kerubim')).toBe('Grenier de Kerubim');
    const t = porte(w, "Taverne d'Astrub"), p = w.player;
    p.x = t.ends[1].x; p.y = t.ends[1].y + 120;   // téléporté dedans, loin de la porte
    w.drainEvents(); w.step(1 / 60, NO_INPUT);
    expect(w.lieu).toBe("Taverne d'Astrub");
    expect(w.drainEvents().find(e => e.k === 'enterLieu')).toMatchObject({ name: "Taverne d'Astrub" });
    p.x = t.ends[0].x; p.y = t.ends[0].y + 150; w.step(1 / 60, NO_INPUT);
    expect(w.lieu).toBeNull();
  });
  it('survol : le nom de l\'endroit derrière la porte, « sortie » pour ressortir, « salle suivante » dans un donjon (3A, 8A)', () => {
    const w = monde(), t = porte(w, "Taverne d'Astrub");
    expect(w.porteSous(t.ends[0].x + 10, t.ends[0].y)).toMatchObject({ nom: "Taverne d'Astrub", sortie: false });
    const s = w.porteSous(t.ends[1].x, t.ends[1].y - 10)!;
    expect(s.sortie).toBe(true);
    expect(s.nom).toBe(w.opts.zone === 'astrub' ? w.zone.open!.subareas[String(w.worldGrid!.mapByTag(t.ends[0].tag)!.sub)].name : '');
    // donjon en arène : l'entrée y mène, sans retour par là (sortie = portail de la fin)
    const g = w.entreeDonjon('Grange du Tournesol Affamé')!;
    expect(w.porteSous(g.ends[0].x, g.ends[0].y)?.nom).toBe('Grange du Tournesol Affamé');
    expect(w.porteSous(g.ends[1].x, g.ends[1].y)).toBeNull();
    expect(w.porteSous(t.ends[0].x + 300, t.ends[0].y)).toBeNull();
  });
  it('on passe en marchant droit dans la porte, pas en la frôlant (4B)', () => {
    const t = (w: World) => porte(w, "Taverne d'Astrub").ends[0];
    // droit dessus, depuis la rue
    const a = monde(), e = t(a);
    a.player.x = e.x + 40; a.player.y = e.y + 20;
    marcher(a, e.x - a.player.x, e.y - a.player.y, 60);
    expect(ici(a)).toBe('taverne');
    // de côté, à 42 de la porte : rien. On cherche une porte de la Cité et une ligne libre qui la longe.
    const b = monde(), wg = b.worldGrid!;
    let essai: { x: number; y: number; dx: number; dy: number } | null = null, f = t(b);
    for (const po of b.portes) for (let k = 0; k < 16 && !essai && !po.cle && !po.vers && !po.verrou; k++) for (const s of [1, -1]) {
      f = po.ends[0];
      const a = k * Math.PI / 8, dx = Math.cos(a), dy = Math.sin(a), ox = f.x - dy * 42 * s, oy = f.y + dx * 42 * s;
      const de = { x: ox - dx * 80, y: oy - dy * 80 }, vers = { x: ox + dx * 80, y: oy + dy * 80 };
      if (wg.walkable(de.x, de.y) && wg.clearLine(de, vers)) { essai = { ...de, dx, dy }; break; }
    }
    // (la boucle s'arrête sur la première porte qui convient : f est alors son bout)
    expect(essai).toBeTruthy();
    b.player.x = essai!.x; b.player.y = essai!.y;
    marcher(b, essai!.dx, essai!.dy, 45);
    expect(ici(b)).toBe(f.tag);
    expect(Math.hypot(b.player.x - f.x, b.player.y - f.y)).toBeGreaterThan(60);   // il est bien passé devant
  });
  it('sortie : tout le paillasson dessiné autour de la porte réagit au survol et au clic (19A)', () => {
    const w = monde(), t = porte(w, "Taverne d'Astrub");
    expect(World.SORTIE_R).toBeGreaterThan(World.PORTE_R);
    const d = (World.PORTE_R + World.SORTIE_R) / 2;
    expect(w.porteSous(t.ends[1].x + d, t.ends[1].y)?.sortie).toBe(true);   // bord du paillasson, dedans
    expect(w.porteSous(t.ends[0].x + d, t.ends[0].y)).toBeNull();           // la porte de la rue garde sa taille
  });
  it('arrivée protégée : 1,5 s d\'invulnérabilité, les monstres attendent le premier geste (13A)', () => {
    const w = monde(), t = porte(w, "Taverne d'Astrub"), p = w.player;
    p.x = t.ends[0].x + 40; p.y = t.ends[0].y + 20;
    marcher(w, t.ends[0].x - p.x, t.ends[0].y - p.y, 60);
    expect(ici(w)).toBe('taverne');
    expect(w.calme).toBeTruthy();
    expect(p.invuln).toBeGreaterThan(1);
    // un monstre juste à côté, au repos : il ne remarque pas le joueur tant que celui-ci ne bouge pas
    const m = w.monsters.find(o => !o.dead && o.state === 'idle')!;
    w.proteger();
    m.x = p.x + 60; m.y = p.y;
    for (let i = 0; i < 30; i++) w.step(1 / 60, NO_INPUT);
    expect(m.state).toBe('idle');
    // quelques pas : le calme cesse, il attaque
    for (let i = 0; i < 40 && w.calme; i++) w.step(1 / 60, { ...NO_INPUT, move: { x: 1, y: 0 } });
    expect(w.calme).toBeNull();
    m.x = p.x + 60; m.y = p.y;
    for (let i = 0; i < 5; i++) w.step(1 / 60, NO_INPUT);
    expect(m.state).not.toBe('idle');
  });
  it('contour au survol : les portes dessinées à part sont marquées dans le décor (portes_contour.py)', () => {
    const w = monde(), wg = w.worldGrid!;
    const po = astrub.maps.flatMap(m => m.decor.filter(p => p.po)).map(p => wg.toScreen(p.x, p.y));
    for (const nom of ['Atelier des paysans', 'Atelier des alchimistes', 'Atelier des bûcherons et des sculpteurs', 'Tour du Conseil']) {
      const e = ISO.toScreen(porte(w, nom).ends[0].x, porte(w, nom).ends[0].y);
      expect(Math.min(...po.map(q => Math.hypot(q.x - e.x, q.y - (e.y - 50)))), nom).toBeLessThan(160);
    }
  });
});

describe('contour officiel des portes et paillasson (Mathis 2026-11-08)', () => {
  it('contour officiel : les portes peintes dans leur bâtiment ont leur boîte de survol Dofus 3 tout près (survols.py)', () => {
    const w = monde(), wg = w.worldGrid!;
    const at = JSON.parse(readFileSync(new URL('../public/assets/ui/survols_astrub.json', import.meta.url), 'utf8')).frames as Record<string, unknown>;
    const sv = astrub.maps.flatMap(m => m.survols ?? []);
    for (const q of sv) expect(at[q.f], q.f).toBeDefined();
    const pres = (nom: string) => { const e = ISO.toScreen(porte(w, nom).ends[0].x, porte(w, nom).ends[0].y);
      return Math.min(...sv.map(q => { const c = wg.toScreen(q.x, q.y); return Math.hypot(c.x - e.x, c.y - (e.y - 50)); })); };
    for (const nom of ["Taverne d'Astrub", "Banque d'Astrub", "Milice d'Astrub", 'Atelier des chasseurs', 'Atelier des pêcheurs', 'Atelier des mineurs et des forgerons'])
      expect(pres(nom), nom).toBeLessThan(200);
  });
  it('le paillasson façon Sanstour (dalle, soleil vert, étincelles) est dans les images de l’interface', () => {
    for (const n of ['paillasson', 'paillasson_soleil', 'paillasson_etincelle']) {
      const png = readFileSync(new URL(`../public/assets/ui/${n}.png`, import.meta.url));
      expect(png.subarray(1, 4).toString(), n).toBe('PNG');
    }
  });
});

describe('entrer et sortir simplement (Mathis 2026-11-08)', () => {
  it('juste arrivé dans un intérieur, un clic sur le paillasson fait ressortir tout de suite', () => {
    const w = monde(), po = porte(w, "Taverne d'Astrub"), dedans = po.ends[1];
    w.player.x = dedans.x; w.player.y = dedans.y;
    (w as unknown as { portalLock: unknown }).portalLock = dedans;   // comme à l'arrivée par cette porte
    for (let i = 0; i < 30; i++) w.step(1 / 60, { ...NO_INPUT, aim: { x: dedans.x, y: dedans.y } });
    expect(ici(w)).toBe('taverne');   // sans clic, on ne repart pas
    for (let i = 0; i < 60; i++) w.step(1 / 60, { ...NO_INPUT, aim: { x: dedans.x, y: dedans.y }, dest: { x: dedans.x, y: dedans.y } });
    expect(ici(w)).toBe(po.ends[0].tag);
  });
  it('passage entre deux salles (boutique et grenier de Kerubim) : tout le paillasson compte au survol', () => {
    const w = monde(), po = w.portes.find(p => p.nom === 'Grenier de Kerubim')!, e = po.ends[0];
    expect(w.porteSous(e.x + 60, e.y + 40)?.nom).toBe('Grenier de Kerubim');
  });
});
