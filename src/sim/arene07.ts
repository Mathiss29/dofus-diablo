import type { Arene } from './arene';
import type { Element } from './defs';
import type { Monster } from './monster';
import { CASE } from './monster';

/** Mécaniques des donjons de la 0.7 (ligne « 0.7 : » 5A-5D, 27 nov. 2026).
 *  L'état vit dans l'arène (champs simples, recopiés tels quels chez l'invité) ; ces fonctions le font avancer, chez l'hôte.
 *  Aucun hasard hors de world.rng ; tout marche à plusieurs joueurs. */
export const A07 = {
  /** 5A : Koulosse en étages : une vague par étage ; on descend quand elle est vide (s de fondu au noir côté affichage). */
  etage: { fondu: 0.6 },
  /** 5B : grimoires volants autour du Maître Corbac : un sort annoncé `annonce` s sous un joueur toutes les `cadence` s chacun ;
   *  un coup à moins de `r` px le ferme ; tous fermés = boss étourdi `etourdi` s, puis ils se rouvrent au bout de `rouvre` s. */
  grimoire: { r: 70, cadence: 6, annonce: 1.1, zone: CASE * 1.4, etourdi: 4, rouvre: 12, rayon: 300, premier: 3 },
  /** 5C : le Blop Multicolore Royal change de couleur toutes les `cadence` s ; un coup d'un autre élément ne fait que `autre` des dommages. */
  blop: { cadence: 15, autre: 0.15 },
  /** 5D : Skeunk vole une charge de potion toutes les `cadence` s et fuit `fuite` s à vitesse ×`vitesse` ; le toucher pendant sa fuite
   *  rend la charge et ouvre une fenêtre de dégâts (× `fenetre` pendant `fenetreT` s). */
  skeunk: { cadence: 20, premier: 10, portee: CASE * 2.5, fuite: 6, vitesse: 1.5, fenetre: 1.5, fenetreT: 5 },
};

/** Couleurs du Blop Multicolore Royal : élément, nom, couleur (Blops Royaux de Dofus). */
export const COULEURS_BLOP: { el: Element; nom: string; couleur: string }[] = [
  { el: 'terre', nom: 'Coco', couleur: '#c8a66a' }, { el: 'eau', nom: 'Indigo', couleur: '#6f7dff' },
  { el: 'air', nom: 'Reinette', couleur: '#8fd25a' }, { el: 'feu', nom: 'Griotte', couleur: '#ff5a6a' },
];

export type Grimoire07 = { x: number; y: number; ouvert: boolean; t: number };
export type Sort07 = { x: number; y: number; t: number; cible: number; r: number };

/** État des mécaniques à la création de l'arène. */
export function preparer07(a: Arene) {
  a.etage = 0; a.grimoires = []; a.sorts07 = []; a.tGrimoires = 0; a.couleur = -1; a.tCouleur = 0;
  a.vol = null; a.tVol = A07.skeunk.premier;
}

/** 5A : la vague de cet étage est finie : on descend à l'étage suivant (tous les joueurs). Renvoie true si l'arène attend encore. */
export function etages07(a: Arene): boolean {
  const E = a.d.etages, w = a.w;
  if (!E?.length || a.etage >= E.length || a.vague < 1 || a.vague > a.total) return false;
  if (a.vague <= a.etage) return false;   // la vague de l'étage n'est pas encore partie
  if (a.restants() > 0) return true;      // on ne descend qu'une fois l'étage vidé
  const wg = w.worldGrid!, A = E[a.etage], at = (c: number) => wg.cellToWorld(c);
  a.etage++;
  a.changerPoints({ tag: A.tag, arrivee: at(A.arrivee), entrees: A.entrees.map(at), boss: at(A.boss), sortie: at(A.sortie), coffre: at(A.coffre) });
  w.players.forEach((q, i) => {
    const o = a.libreA(a.pts.arrivee.x + (i % 2 ? 40 : -40) * Math.min(1, i), a.pts.arrivee.y + Math.floor(i / 2) * 30);
    q.x = o.x; q.y = o.y; q.kx = q.ky = 0;
  });
  w.emit({ k: 'areneEtage', n: a.etage + 1, total: E.length + 1 });
  w.emit({ k: 'status', x: a.pts.arrivee.x, y: a.pts.arrivee.y - 90, text: `Étage ${a.etage + 1}`, color: '#f2d36b' });
  return false;
}

/** Monstre apparu dans l'arène : le boss reçoit sa mécanique. */
export function apparu07(a: Arene, m: Monster) {
  if (!m.def.boss || a.boss !== m) return;
  const w = a.w, b = m;
  if (a.d.grimoires) {   // 5B : grimoires en cercle autour de l'estrade
    const n = a.d.grimoires, R = A07.grimoire.rayon;
    a.grimoires = Array.from({ length: n }, (_, i) => {
      const an = -Math.PI / 2 + (i - (n - 1) / 2) * 1.3;
      const o = a.libreA(b.x + Math.cos(an) * R, b.y + Math.sin(an) * R * 0.6 + R * 0.5);
      return { x: o.x, y: o.y, ouvert: true, t: A07.grimoire.premier + i * 2 };
    });
  }
  if (a.d.couleurs) { a.couleur = w.rng.int(COULEURS_BLOP.length); a.tCouleur = A07.blop.cadence; b.seulElement = COULEURS_BLOP[a.couleur].el; annoncerCouleur(a, b); }
}

function annoncerCouleur(a: Arene, b: Monster) {
  const c = COULEURS_BLOP[a.couleur];
  a.w.emit({ k: 'status', x: b.x, y: b.y - 90, text: `${c.nom} : seul l'élément ${c.el} le blesse`, color: c.couleur });
}

/** Chaque pas de l'arène (après le départ). */
export function update07(a: Arene, dt: number) {
  const w = a.w, b = a.boss, bossLa = !!b && !b.dead && b.state !== 'spawn' && !a.fini;
  // sorts des grimoires annoncés au sol
  const G = A07.grimoire;
  for (const s of a.sorts07) {
    s.t -= dt;
    w.telegraphs.push({ kind: 'circle', x: s.x, y: s.y, r: s.r, progress: 1 - Math.max(0, s.t) / G.annonce, danger: true });
    if (s.t > 0 || !b) continue;
    const sp = b.def.spells?.find(x => x.effects.some(e => e.k === 'dmg'));
    for (const q of w.players) if (!q.dead && Math.hypot(q.x - s.x, q.y - s.y) < s.r + q.radius && sp) w.commeJoueur(q, () => w.monsterSpellHits(b, sp, q));
    w.emit({ k: 'slam', x: s.x, y: s.y, radius: s.r });
  }
  a.sorts07 = a.sorts07.filter(s => s.t > 0);
  if (!bossLa) { a.grimoires = a.fini ? [] : a.grimoires; return; }
  const vivants = w.players.filter(q => !q.dead);
  // 5B : chaque grimoire ouvert lance un sort du Corbac sous le joueur le plus proche ; fermés, ils se rouvrent ensemble
  if (a.grimoires.length) {
    if (a.grimoires.every(g => !g.ouvert)) {
      if ((a.tGrimoires -= dt) <= 0) {
        for (const g of a.grimoires) { g.ouvert = true; g.t = G.premier; }
        w.emit({ k: 'status', x: b!.x, y: b!.y - 90, text: 'Les grimoires se rouvrent', color: '#c8b4ff' });
      }
    } else for (const g of a.grimoires) {
      if (!g.ouvert || (g.t -= dt) > 0 || !vivants.length) continue;
      g.t = G.cadence;
      const q = vivants.reduce((m, c) => Math.hypot(c.x - g.x, c.y - g.y) < Math.hypot(m.x - g.x, m.y - g.y) ? c : m);
      a.sorts07.push({ x: q.x, y: q.y, t: G.annonce, cible: q.id, r: G.zone });
    }
  }
  // 5C : changement de couleur
  if (a.d.couleurs && (a.tCouleur -= dt) <= 0) {
    a.tCouleur = A07.blop.cadence;
    a.couleur = (a.couleur + 1 + w.rng.int(COULEURS_BLOP.length - 1)) % COULEURS_BLOP.length;
    b!.seulElement = COULEURS_BLOP[a.couleur].el;
    annoncerCouleur(a, b!);
    w.emit({ k: 'impact', hitstop: 0, shake: 0.006, big: false });
  }
  // 5D : Skeunk vole une potion au joueur le plus proche et file
  const K = A07.skeunk;
  if (a.d.voleur) {
    if (a.vol) {
      a.vol.t -= dt;
      if (a.vol.t <= 0) {
        const q = w.players.find(p => p.id === a.vol!.id);
        w.emit({ k: 'status', x: b!.x, y: b!.y - 80, text: 'Skeunk a bu ta potion !', color: '#ff9a7a' });
        if (q) w.emit({ k: 'status', x: q.x, y: q.y - 70, text: 'Charge de potion perdue', color: '#ff9a7a' });
        a.vol = null; a.tVol = K.cadence;
      }
    } else if (!b!.intouchable && (a.tVol -= dt) <= 0) {
      const q = vivants.filter(p => p.potions > 0 && Math.hypot(p.x - b!.x, p.y - b!.y) < K.portee * 3)
        .sort((p, c) => Math.hypot(p.x - b!.x, p.y - b!.y) - Math.hypot(c.x - b!.x, c.y - b!.y))[0];
      if (q) {
        q.potions--;
        const an = Math.atan2(b!.y - q.y, b!.x - q.x), loin = a.libreA(b!.x + Math.cos(an) * 520, b!.y + Math.sin(an) * 300);
        a.vol = { id: q.id, t: K.fuite, x: loin.x, y: loin.y };
        w.emit({ k: 'status', x: q.x, y: q.y - 70, text: 'Skeunk te vole une potion ! Rattrape-le', color: '#ffd36b' });
        w.emit({ k: 'monsterCast', id: b!.id, name: 'Vol de potion', x: b!.x, y: b!.y });
      } else a.tVol = 2;
    }
  }
}

/** Avant l'IA ordinaire : Skeunk qui fuit avec la potion. */
export function piloter07(a: Arene, m: Monster, dt: number): boolean {
  if (!a.vol || m !== a.boss || m.dead) return false;
  if (m.allerVers(a.vol.x, a.vol.y, dt, a.w, A07.skeunk.vitesse) && Math.hypot(a.vol.x - m.x, a.vol.y - m.y) > 30) return true;
  return Math.hypot(a.vol.x - m.x, a.vol.y - m.y) <= 30;   // arrivé : il attend là, en narguant
}

/** Un coup d'un joueur : ferme un grimoire (5B), rattrape Skeunk (5D). */
export function coup07(a: Arene, touche: (o: { x: number; y: number; radius: number }) => boolean) {
  const w = a.w, b = a.boss;
  if (!b || b.dead || a.fini) return;
  for (const g of a.grimoires) if (g.ouvert && touche({ x: g.x, y: g.y, radius: A07.grimoire.r })) {
    g.ouvert = false;
    w.emit({ k: 'status', x: g.x, y: g.y - 60, text: 'Grimoire fermé', color: '#c8b4ff' });
    if (a.grimoires.every(x => !x.ouvert)) {
      b.stun = Math.max(b.stun, A07.grimoire.etourdi); a.tGrimoires = A07.grimoire.rouvre; a.sorts07 = [];
      w.emit({ k: 'status', x: b.x, y: b.y - 90, text: 'Maître Corbac est étourdi !', color: '#f2d36b' });
      w.emit({ k: 'impact', hitstop: 0.06, shake: 0.012, big: true });
    }
  }
  if (a.vol && touche({ x: b.x, y: b.y, radius: b.radius })) {
    const q = w.players.find(p => p.id === a.vol!.id);
    if (q) q.potions = Math.min(q.potionsMax, q.potions + 1);
    a.vol = null; a.tVol = A07.skeunk.cadence;
    b.subis = A07.skeunk.fenetre; b.subisT = A07.skeunk.fenetreT; b.stun = Math.max(b.stun, 1);
    w.emit({ k: 'status', x: b.x, y: b.y - 90, text: 'Rattrapé ! La potion revient', color: '#f2d36b' });
  }
}

/** 5C : part des dommages qu'un coup de cet élément fait à ce monstre (1 hors du Blop Multicolore). */
export function facteurCouleur(m: Monster, el: Element): number { return m.seulElement && m.seulElement !== el ? A07.blop.autre : 1; }
