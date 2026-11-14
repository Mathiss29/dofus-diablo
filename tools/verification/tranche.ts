// tranche.ts : partie complète d'une tranche de niveaux jouée par un robot, sans navigateur (0.6, « Avant la sortie : partie 60 → 90 »).
//   npx vite-node tools/verification/tranche.ts -- [classe=iop] [de=60] [a=90] [graine=1] [rarete=rare] [heures=8]
// Le perso commence au niveau `de` avec une tenue du niveau (rareté `rarete`, refaite tous les 5 niveaux, comme un joueur qui garde ses
// meilleures trouvailles). Il chasse dans la sous-zone de la tranche la plus proche de son niveau (sans dépasser niveau + 5), lance ses
// sorts quand ils sont prêts, boit sous 40 % de vie. Chaque donjon de la tranche est fait une fois dès qu'il a son niveau.
// À la fin : temps passé par niveau, monstres tués, morts, butin (objets par rareté, niveau des objets), donjons (temps, morts, fini ?).
// Le robot n'esquive rien : un donjon raté est refait invincible, pour vérifier qu'il se finit. Ses morts comptent surtout pour comparer
// les zones entre elles (BASE=1 : même robot sur Amakna, la tranche d'avant).
// Options : DONJON=Draeg (ce donjon seul, puis fin), INVINCIBLE=1 (donjons invincibles), TRACE=1 (dégâts reçus par sort de monstre),
// DEBUG=1 (état de l'arène toutes les 30 s).
import { readFileSync } from 'node:fs';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../../src/sim/data';
import { WorldGrid, type WorldData } from '../../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../../src/sim/input';
import type { EtatQuetes } from '../../src/sim/quests';
import { World } from '../../src/sim/world';
import { appliquerTest } from '../../src/sim/outilsTest';
import type { Rarity } from '../../src/sim/items';
import type { Monster } from '../../src/sim/monster';

const arg = (i: number, d: string) => process.argv.filter(a => a !== '--').slice(2)[i] ?? d;
const CLASSE = arg(0, 'iop'), DE = +arg(1, '60'), A = +arg(2, '90'), GRAINE = +arg(3, '1'), RARETE = arg(4, 'rare') as Rarity, HEURES = +arg(5, '8');
const DT = 1 / 30;
const AS = JSON.parse(readFileSync(new URL('../../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: GRAINE, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, classId: CLASSE, test: {} as never, aujourdhui: '2026-11-14' });
const p = w.player, wg = w.worldGrid!, open = w.zone.open!;
// dégâts reçus par sort de monstre (TRACE=1), et PA/PM retirés
const parSort: Record<string, { pv: number; pa: number; n: number }> = {};
if (process.env.TRACE) {
  const orig = w.monsterSpellHits.bind(w);
  w.monsterSpellHits = (m, s, c, mult) => {
    const hp = p.hp, pa = p.pa, pm = p.pm; orig(m, s, c, mult);
    if (c !== p) return;
    const k = `${m.type}:${s.name}`, r = parSort[k] ??= { pv: 0, pa: 0, n: 0 };
    r.n++; r.pv += Math.max(0, hp - p.hp); r.pa += Math.max(0, pa - p.pa) + Math.max(0, pm - p.pm);
  };
}
appliquerTest(w, { k: 'niveau', n: DE, auto: true });
appliquerTest(w, { k: 'tenue', rarete: RARETE });
p.resources['14460'] = 0;   // pas d'importance : les clés sont données à l'entrée du donjon

// sous-zones de chasse de la tranche (cartes du dehors, avec monstres)
const cartesDe = new Map<number, string[]>();
const BASE = !!process.env.BASE;   // BASE=1 : comparaison avec la tranche d'avant (Amakna, cartes de la 0.4)
for (const m of AS.maps) if ((BASE ? m.essai && !m.v06 : m.v06) && !m.inside) { const l = cartesDe.get(m.sub) ?? []; l.push(m.tag); cartesDe.set(m.sub, l); }
const ZONES = Object.entries(open.subareas).filter(([k, s]) => (BASE || s.v06) && s.monsters.length && cartesDe.has(+k)).map(([k, s]) => ({ sub: +k, nom: s.name, niv: s.level }))
  .sort((a, b) => a.niv - b.niv);
const DONJONS = BASE ? [] : (open.donjonsV06 ?? []).filter(d => d.arene && !d.tresor);
const nivDonjon = (d: typeof DONJONS[number]) => open.subareas[String(AS.maps.find(m => m.tag === d.arene!.tag)?.sub)]?.level ?? 999;
const faits = new Set<string>();
if (process.env.DONJON) for (const d of DONJONS) if (!d.nom.includes(process.env.DONJON)) faits.add(d.nom);   // DONJON=Draeg : ce donjon seul

// statistiques
const parNiveau: { niv: number; t: number; tues: number; morts: number }[] = [];
let tues = 0, morts = 0, tNiv = 0, tuesNiv = 0, mortsNiv = 0, dernierUid = 0, kamas0 = p.kamas;
const tueurs: Record<string, number> = {}, butin: Record<string, number> = {}, ecartNiv: number[] = [];
const donjons: { nom: string; niv: number; t: number; morts: number; fini: boolean; perso: number }[] = [];
const temps = { chasse: 0, donjon: 0, trajets: 0 };

function noterEvenements() {
  for (const e of w.drainEvents()) {
    if (e.k === 'kill') tues++, tuesNiv++;
    if (e.k === 'playerDeath' && !w.arene) {
      morts++, mortsNiv++;
      // le monstre le plus proche au moment de la mort (souvent celui qui l'a tué)
      let t = '', d = 600; for (const m of w.monsters) if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) < d) { d = Math.hypot(m.x - p.x, m.y - p.y); t = m.type; }
      if (t) tueurs[t] = (tueurs[t] ?? 0) + 1;
    }
  }
  for (const d of w.drops) if (d.uid > dernierUid) {
    dernierUid = d.uid;
    if (d.item) { butin[d.item.rarity] = (butin[d.item.rarity] ?? 0) + 1; const it = ITEMS.equipment[d.item.id]; if (it) ecartNiv.push(it.level - p.level); }
  }
}
function prets(): string[] { return p.bar.filter((s): s is string => !!s && s !== p.cls.mobility && p.hasResource(s as never) && !((p.cd as Record<string, number>)[s] > 0)); }
/** Entrée du robot : la cible la plus proche (éveillée d'abord), ses sorts, une potion si besoin. */
function entree(cibles: Monster[]): PlayerInput {
  if (p.dead) return NO_INPUT;
  let c: Monster | null = null, d = Infinity;
  for (const m of cibles) {
    if (m.intouchable || m.mannequin) continue; const dm = Math.hypot(m.x - p.x, m.y - p.y) * (m.state === 'idle' ? 1.5 : 1); if (dm < d) { d = dm; c = m; } }
  const e: PlayerInput = { ...NO_INPUT, aim: c ? { x: c.x, y: c.y } : { x: p.x, y: p.y } };
  if (p.hp < p.maxHp * 0.4) e.potion = true;
  if (!c) return e;
  e.target = c.id; e.holdAttack = true;
  const s = prets(); if (s.length && d < 380 && w.rng.next() < 0.25) { e.pressed = s[Math.floor(w.rng.next() * s.length)] as never; e.castOn = c.id; e.approach = true; }
  return e;
}
function pas(i: PlayerInput) { w.step(DT, i); tNiv += DT; noterEvenements(); }
function niveauPris(avant: number) {
  while (p.level > avant) {
    parNiveau.push({ niv: avant, t: tNiv, tues: tuesNiv, morts: mortsNiv }); tNiv = tuesNiv = mortsNiv = 0; avant++;
    if (avant % 5 === 0) appliquerTest(w, { k: 'tenue', rarete: RARETE });
    console.log(`niveau ${avant} · ${(w.time / 60).toFixed(0)} min de jeu · ${tues} tués · ${morts} morts`);
  }
}
function faireDonjon(d: typeof DONJONS[number], invincible = false) {
  if (invincible) appliquerTest(w, { k: 'reglage', cle: 'invincible', on: true });
  const t0 = w.time, m0 = morts, niv = p.level;
  p.cleDonjon = null;
  if (!w.allerArene(d.arene!.tag)) return;
  for (let i = 0; i < 30 * 5 && !w.arene; i++) pas(NO_INPUT);
  let fini = false;
  while (w.time - t0 < 1200) {
    const a = w.arene;
    if (!a) break;
    // choix du Clos des Blops : le premier cercle
    if (a.choix?.length) { p.x = a.choix[0].x; p.y = a.choix[0].y; }
    const avant = p.level;
    pas(entree(w.monsters.filter(m => !m.dead && m.state !== 'spawn' && !m.mannequin)));
    niveauPris(avant);
    if (a.fini) { fini = true; break; }
    if (p.dead) { morts++; mortsNiv++; for (let i = 0; i < 30 * 4; i++) pas(NO_INPUT); if (p.dead) { w.respawnPlayer(); break; } }
    if (morts - m0 >= 5) break;
    if (process.env.DEBUG && Math.floor(w.time) % 30 === 0 && Math.floor(w.time - DT) % 30 !== 0) console.log('    ', Math.round(w.time - t0), 's vague', a.vague, '/', a.total, 'vivants', w.monsters.filter(m => !m.dead).length, 'boss', a.boss ? a.boss.type + ' ' + Math.round(a.boss.hp) + '/' + a.boss.maxHp + (a.boss.intouchable ? ' intouchable' : '') : '-', 'proches', w.monsters.filter(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < 1500).map(m => m.type).join(','), 'pv', Math.round(p.hp), '/', p.maxHp, 'pos', Math.round(p.x), Math.round(p.y), 'cible', w.monsters.filter(m => !m.dead).slice(0, 2).map(m => m.type + '@' + Math.round(m.x) + ',' + Math.round(m.y) + ':' + m.state).join(' '));
  }
  temps.donjon += w.time - t0;
  donjons.push({ nom: d.nom + (invincible ? ' (invincible)' : ''), niv: nivDonjon(d), t: Math.round(w.time - t0), morts: morts - m0, fini, perso: niv });
  console.log(`  donjon ${d.nom}${invincible ? ' (invincible)' : ''} : ${fini ? 'fini' : 'PAS FINI'} en ${Math.round(w.time - t0)} s, ${morts - m0} morts`);
  if (w.arene) w.quitterArene(d);
  for (let i = 0; i < 30 * 3; i++) pas(NO_INPUT);
  if (invincible) appliquerTest(w, { k: 'reglage', cle: 'invincible', on: false });
  // le robot ne sait pas esquiver : un donjon raté est refait invincible, pour vérifier qu'il se finit (vagues, boss, coffre)
  else if (!fini) faireDonjon(d, true);
}

let zone = ZONES[0], carte = '', tCarte = 0;
const aller = (tag: string) => { appliquerTest(w, { k: 'aller', tag, nom: tag }); carte = tag; tCarte = 0; temps.trajets += 8; w.time; };
console.log(`${CLASSE} ${DE} → ${A}, tenue ${RARETE} ; ${ZONES.length} sous-zones, ${DONJONS.length} donjons`);
while (p.level < A && w.time < HEURES * 3600) {
  const dj = DONJONS.find(d => !faits.has(d.nom) && p.level >= nivDonjon(d));
  if (dj) { faits.add(dj.nom); faireDonjon(dj, !!process.env.INVINCIBLE); if (process.env.DONJON) break; continue; }
  const bonne = [...ZONES].reverse().find(z => z.niv <= p.level + 5) ?? ZONES[0];
  if (bonne !== zone || !carte) { zone = bonne; console.log(`  chasse : ${zone.nom} (niv ${zone.niv})`); carte = ''; }
  const sub = zone.sub;
  const cibles = w.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - p.x, m.y - p.y) < 900 && wg.mapAt(m.x, m.y)?.sub === sub);
  if (!carte || (!cibles.length && tCarte > 3) || tCarte > 120) { const l = cartesDe.get(sub)!; aller(l[Math.floor(w.rng.next() * l.length)]); }
  const avant = p.level;
  pas(entree(cibles)); tCarte += DT; temps.chasse += DT;
  if (p.dead) for (let i = 0; i < 30 * 20 && p.dead; i++) pas(NO_INPUT), w.respawnPlayer();
  niveauPris(avant);
}
const h = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.round(s % 3600 / 60)).padStart(2, '0')}`;
const total = w.time + temps.trajets;
console.log('\n=== Bilan ===');
console.log(`${CLASSE} : niveau ${DE} → ${p.level} en ${h(total)} (chasse ${h(temps.chasse)}, donjons ${h(temps.donjon)}, trajets estimés ${h(temps.trajets)})`);
console.log(`${tues} monstres tués, ${morts} morts, ${p.kamas - kamas0} kamas`);
console.log('objets par rareté :', JSON.stringify(butin));
if (ecartNiv.length) console.log(`niveau des objets - niveau du perso : moyenne ${(ecartNiv.reduce((a, b) => a + b, 0) / ecartNiv.length).toFixed(1)}, ${ecartNiv.filter(x => x < -20).length} à plus de 20 niveaux sous le perso`);
console.log('par niveau (min, tués, morts) :', parNiveau.map(x => `${x.niv}:${(x.t / 60).toFixed(1)}/${x.tues}/${x.morts}`).join(' '));
console.log('donjons :', JSON.stringify(donjons));
if (process.env.TRACE) console.log('sorts :', JSON.stringify(Object.entries(parSort).sort((a, b) => b[1].pv - a[1].pv).slice(0, 15).map(([k, v]) => [k, Math.round(v.pv), v.n, Math.round(v.pa)])));
console.log('morts près de :', JSON.stringify(Object.entries(tueurs).sort((a, b) => b[1] - a[1]).slice(0, 12)));
