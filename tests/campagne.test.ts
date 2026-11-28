import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';
import { CAMPAGNE_PUBLIC } from '../src/sim/pouvoirs';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, reprise: EtatQuetes = VIDE, persos = 0) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 7,
  items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise, compte: { succes: [], persos }, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const actes = QUETES.campagne!;
const ordre = actes.flatMap(a => a.chapitres);

describe('Campagne « Le Carnet des Fêlures » : contenu', () => {
  it('10 actes (2 de la 0.7), 8 à 10 chapitres par grande région (4C), 10 Sceaux dans l\'ordre, un seul fil', () => {
    expect(actes.map(a => a.id)).toEqual(['prologue', 'incarnam', 'astrub', 'amakna', 'wabbits', 'moon', 'continent', 'frigost', 'otomai', 'pandala']);
    for (const id of ['incarnam', 'astrub', 'amakna', 'continent', 'otomai', 'pandala']) {
      const n = actes.find(a => a.id === id)!.chapitres.length;
      expect(n >= 8 && n <= 10, `${id} : ${n} chapitres`).toBe(true);
    }
    const sceaux = ordre.map(id => QUETES.quetes[id].sceau).filter(Boolean);
    expect(sceaux).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // chaînage : chaque chapitre lance le suivant ; aucun n'est proposé par un PNJ
    ordre.forEach((id, i) => {
      const q = QUETES.quetes[id];
      expect(q.type).toBe('campagne');
      expect(q.suivante).toBe(ordre[i + 1]);
      expect(q.pnj && QUETES.pnj[q.pnj], `${id} : PNJ`).toBeTruthy();
    });
  });
  it('fin d\'acte : sac de rareté garantie et titre (6A + 6B), apparat à la fin (6B)', () => {
    for (const a of actes.filter(x => x.id !== 'prologue')) {
      const r = QUETES.quetes[a.chapitres[a.chapitres.length - 1]].recompense;
      expect(r.sac, a.id).toBe(a.sac);
      expect(r.titre, a.id).toBe(a.titre);
    }
    const fin = actes.find(a => a.id === 'frigost')!.chapitres;   // fin de la campagne ouverte à tous (la 0.7 vient après)
    expect(QUETES.quetes[fin[fin.length - 1]].recompense.apparats?.length).toBeGreaterThan(0);
  });
  it('textes courts, sans vocabulaire tactique (règle temps réel)', () => {
    for (const id of ordre) {
      const q = QUETES.quetes[id], tout = [q.nom, q.texte, q.merci ?? '', ...(q.etapes as { nom: string; bulle?: string }[]).flatMap(e => [e.nom, e.bulle ?? ''])].join(' ');
      expect(/\b(tour|tours|combat|combats|PA par)\b/i.test(tout), `${id} : ${tout}`).toBe(false);
      expect(q.texte.length, id).toBeLessThan(260);
    }
  });
});

describe('Campagne : moteur', () => {
  it('cachée hors partie de test tant que CAMPAGNE_PUBLIC est faux (11B)', () => {
    expect(CAMPAGNE_PUBLIC).toBe(false);
    const w = monde(false);
    w.step(1 / 60, NO_INPUT);
    expect(w.quetes!.campagneOuverte).toBe(false);
    expect(w.quetes!.enCours.some(c => c.id.startsWith('cmp_'))).toBe(false);
  });
  it('le premier chapitre démarre seul et la flèche le suit (2B) ; les principales d\'avant passent en secondaires (5C)', () => {
    const w = monde(), q = w.quetes!;
    w.step(1 / 60, NO_INPUT);
    expect(q.chapitre?.id).toBe('cmp_p1');
    expect(q.suivie).toBe('cmp_p1');
    expect(q.def('amk_1').type).toBe('secondaire');
    expect(q.aDonnerTous('fecaline')).not.toContain('cmp_p1');
  });
  it('un perso d\'avant reprend au premier chapitre pas fini ; Sceaux comptés ; le chapitre suivant est annoncé (2D)', () => {
    const fini = ordre.slice(0, ordre.indexOf('cmp_a9'));
    const w = monde(true, { ...VIDE, finies: fini }), q = w.quetes!, p = w.player;
    w.step(1 / 60, NO_INPUT);
    expect(q.chapitre?.id).toBe('cmp_a9');
    expect(q.sceaux).toBe(1);
    w.drainEvents();
    p.level = 40; p.recompute();
    q.terminer('cmp_a9');
    const ev = w.drainEvents();
    expect(ev.some(e => e.k === 'sceau' && e.n === 2)).toBe(true);
    expect(ev.some(e => e.k === 'campagneSuite' && e.id === 'cmp_a10')).toBe(true);
    expect(q.sceaux).toBe(2);
    q.terminer('cmp_a10');
    expect(w.drainEvents().some(e => e.k === 'acteFini' && e.acte === 'astrub')).toBe(true);
    expect(q.titres).toContain('Fléau des Vilinsekts');
    expect(q.chapitre?.id).toBe('cmp_m1');
  });
  it('passer l\'acte (8A) : seulement dès le 2e perso, titres sans XP ni sac', () => {
    const seul = monde(true, VIDE, 0);
    seul.step(1 / 60, NO_INPUT);
    expect(seul.quetes!.passerActe('prologue')).toBe(false);
    const w = monde(true, VIDE, 1), q = w.quetes!, p = w.player;
    w.step(1 / 60, NO_INPUT);
    const xp = p.xp, sac = p.bag.length;
    expect(q.passerActe('prologue')).toBe(true);
    expect(q.passerActe('incarnam')).toBe(true);
    expect(p.xp).toBe(xp);
    expect(p.bag.length).toBe(sac);
    expect(q.titres).toContain('Gardien des nuages');
    expect(q.sceaux).toBe(1);
    expect(q.chapitre?.id).toBe('cmp_a1');
  });
  it('le chapitre « Du lest pour la coque » ouvre le bateau de Frigost', () => {
    const w = monde(true, { ...VIDE, finies: ['cmp_f1'] });
    expect(w.quetes!.ouvert('frigost_passage')).toBe(true);
    expect(monde(true).quetes!.ouvert('frigost_passage')).toBe(false);
  });
  it('coop (9A) : l\'élite d\'une étape commune ne sort qu\'une fois pour le groupe', () => {
    const fini = ordre.slice(0, ordre.indexOf('cmp_a2'));
    const w = monde(true, { ...VIDE, finies: fini });
    w.step(1 / 60, NO_INPUT);
    expect(w.quetes!.chapitre?.id).toBe('cmp_a2');
    const n0 = w.monsters.filter(m => m.type === 'epouvanteur' && m.def.elite).length;
    expect(n0).toBe(1);
    w.ajouterJoueur('cra', { reprise: { ...VIDE, finies: fini }, compte: { succes: [], persos: 0 } });
    w.step(1 / 60, NO_INPUT);
    const invite = w.players[1].quetes!;
    expect(invite.chapitre?.id).toBe('cmp_a2');
    expect(w.monsters.filter(m => m.type === 'epouvanteur' && m.def.elite).length).toBe(1);
  });
});

describe('Campagne : fenêtre du Carnet', () => {
  it('le Carnet se dessine pour chaque acte (Sceaux, chapitres, boutons)', async () => {
    const { carnetHtml } = await import('../src/render/carnetFelures');
    const w = monde(); w.step(1 / 60, NO_INPUT);
    const h = carnetHtml(w, '<h1>Carnet</h1>', { acte: null, confirmer: null });
    expect(h).toContain(actes[0].nom);
    for (const a of actes) expect(carnetHtml(w, '', { acte: a.id, confirmer: null }).length).toBeGreaterThan(200);
  });
});

describe('Campagne : actes de la 0.7 (« 0.7 : » 12A)', () => {
  it('Otomaï et Pandala suivent Frigost, cachés tant que la 0.7 ne se voit pas', () => {
    for (const id of ['otomai', 'pandala']) {
      const a = actes.find(x => x.id === id)!;
      expect(a.v07, id).toBe(true);
      for (const c of a.chapitres) expect(QUETES.quetes[c].v07, c).toBe(true);
    }
    const f = actes.find(a => a.id === 'frigost')!.chapitres, der = f[f.length - 1];
    const etat: EtatQuetes = { ...VIDE, finies: ordre.slice(0, ordre.indexOf(der) + 1) };
    const pub = monde(false, etat);
    if (!pub.v07Ouvert && pub.quetes!.campagneOuverte) {
      expect(pub.quetes!.actes.some(a => a.v07)).toBe(false);
      expect(pub.quetes!.chapitre).toBeNull();
    }
    const t = monde(true, etat);
    t.step(1 / 60, NO_INPUT);
    expect(t.quetes!.actes.some(a => a.id === 'otomai')).toBe(true);
    expect(t.quetes!.chapitre?.id).toBe('cmp_o1');
  });
});
