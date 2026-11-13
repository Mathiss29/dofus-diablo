/** Boutique Ogrines et abonnements (ligne « Apparats : » 9A+9B+9C+9E+9G 13A 14A+14B+14C 15A 16A+16D 17, Mathis 2026-11-12).
 *  Catalogue : src/data/boutique_ogrines.json (tools/contenu/boutique_ogrines.py). Les Ogrines sont sur le compte Discord,
 *  tenues par le serveur (serveur/ogrines.mjs, qui lit ce module dans partie/sim.mjs) : jamais vendues contre de l'argent.
 *  Les bonus d'abonnement (17) passent par Player.abo, réglé par l'affichage à partir du compte. */
import data from '../data/boutique_ogrines.json';
import { feteDuJour } from './apparats';
import { hache } from './contrats';

export type CatArticle = 'chapeau' | 'cape' | 'familier' | 'costume' | 'style' | 'service' | 'meuble';
export interface ArticleOgrines { cat: CatArticle; prix: number; /** 11B (0.6) : lot des meubles rares de ce thème du Havre-Sac */ meubles?: number; apparats?: string[]; fete?: string; nom?: string; style?: string; service?: string }
export type Palier = 'aventurier' | 'heros' | 'legende';
export const PALIERS: Palier[] = ['aventurier', 'heros', 'legende'];
export const BOUTIQUE_OGRINES = data as unknown as {
  services: Record<string, { nom: string; texte: string; prix: number }>;
  semaine: { avant: number; promo: number };
  abonnement: { jours: number; essai: { jours: number; palier: Palier }; paliers: Record<Palier, { nom: string; prix: number; couleur: string }>; apparatsDuMois: string[] };
  articles: Record<string, ArticleOgrines>;
};
const A = BOUTIQUE_OGRINES.articles;

/** Lundi de la semaine de ce jour (AAAA-MM-JJ). */
function lundi(jour: string) {
  const [y, m, d] = jour.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7);
  return t.toISOString().slice(0, 10);
}
/** 14C : un article de fête ne se vend que pendant sa fête ; les autres toujours (14A). */
export const enVente = (id: string, jour: string) => !!A[id] && (!A[id].fete || feteDuJour(jour) === A[id].fete);
/** 14B : mises en avant de la semaine (apparats et costumes en vente) ; la première est en promotion. */
export function vitrine(jour: string): { avant: string[]; promo: string } {
  const sem = lundi(jour), l = Object.keys(A).filter(id => !A[id].fete && ['chapeau', 'cape', 'familier', 'costume'].includes(A[id].cat));
  const tri = l.map(id => [hache(`${sem}:${id}`), id] as const).sort((a, b) => a[0] - b[0]).slice(0, BOUTIQUE_OGRINES.semaine.avant).map(x => x[1]);
  return { avant: tri, promo: tri[0] };
}
/** Prix de l'article ce jour-là (promotion comprise), ou null s'il n'est pas en vente. */
export function prixOgrines(id: string, jour: string): number | null {
  if (!enVente(id, jour)) return null;
  const p = A[id].prix;
  return vitrine(jour).promo === id ? Math.round(p * (1 - BOUTIQUE_OGRINES.semaine.promo) / 10) * 10 : p;
}
/** Nom affiché d'un service. */
export const nomService = (k: string) => BOUTIQUE_OGRINES.services[k]?.nom ?? k;

// --- Abonnements (16A + 16D, 17) ------------------------------------------------------------------------------------
/** 0 sans abonnement, 1 Aventurier, 2 Héros, 3 Légende. */
export const rangAbo = (p: Palier | null | undefined) => p ? PALIERS.indexOf(p) + 1 : 0;
/** 17B : l'apparat exclusif du mois (« AAAA-MM »), pour Héros et Légende. */
export const apparatDuMois = (mois: string) => { const l = BOUTIQUE_OGRINES.abonnement.apparatsDuMois, [y, m] = mois.split('-').map(Number); return l[(y * 12 + m - 1) % l.length]; };
/** Chiffres des avantages, par palier (Aventurier / Héros / Légende). */
export const AVANTAGES = {
  xp: [0.1, 0.2, 0.3],                 // 17E : XP des monstres et des quêtes
  prospection: [10, 20, 30],           // 17F
  legendaire: [1, 1, 1.25],            // 17F : Légende, chance de légendaire ×1,25
  kamas: [0.15, 0.3, 0.5],             // 17G : kamas ramassés
  pepites: [0.1, 0.2, 0.3],            // 17G : Pépites des contrats
  familierXp: [1.5, 2, 3],             // 17H
  familierRayon: [2, 2, 2],            // 17H : il ramasse deux fois plus loin
  benedictions: [1, 2, 3],             // 17C : bénédictions de 30 min offertes par jour
  contrats: [1, 1, 1],                 // 17C : +1 contrat du jour
  metierXp: [0.25, 0.5, 1],            // 17K
  recolte: [0.85, 0.75, 0.6],          // 17K : durée de la récolte
  cles: [0, 1, 1],                     // 17J : Héros et Légende, 1 clé de donjon offerte par jour
  coffreDonjon: [0, 0, 1],             // 17J : Légende, un coffre de plus à la fin d'un donjon
} as const;
export type Avantage = keyof typeof AVANTAGES;
/** Valeur d'un avantage pour ce palier (0, ou 1 pour un multiplicateur, sans abonnement). */
export function avantage(p: Palier | null | undefined, k: Avantage): number {
  const r = rangAbo(p);
  if (!r) return k === 'legendaire' || k === 'familierXp' || k === 'familierRayon' || k === 'recolte' ? 1 : 0;
  return AVANTAGES[k][r - 1];
}
/** Texte des avantages d'un palier (fenêtre de la boutique). */
export function texteAvantages(p: Palier): string[] {
  const r = rangAbo(p), v = (k: Avantage) => AVANTAGES[k][r - 1], pc = (x: number) => `${Math.round(x * 100)} %`;
  return [
    ['Ornement de nom « Aventurier »', 'et l\'auréole « Héros »', 'et l\'effet de Zaap « Légende »'][r - 1],
    r >= 2 ? 'Un apparat exclusif chaque mois, gardé pour toujours' : '',
    `+${pc(v('xp'))} d'XP des monstres et des quêtes`,
    `+${v('prospection')} Prospection${v('legendaire') > 1 ? ', chance de légendaire ×1,25' : ''}`,
    `+${pc(v('kamas'))} de kamas ramassés, +${pc(v('pepites'))} de Pépites des contrats`,
    `Familier : XP ×${String(v('familierXp')).replace('.', ',')}, ramasse deux fois plus loin`,
    `${v('benedictions')} bénédiction${v('benedictions') > 1 ? 's' : ''} de 30 min offerte${v('benedictions') > 1 ? 's' : ''} par jour, défaire en un clic partout, +1 contrat du jour`,
    r >= 2 ? `1 clé de donjon offerte par jour${r >= 3 ? ', un coffre de plus à la fin de chaque donjon' : ''}` : '',
    `+${pc(v('metierXp'))} d'XP de métier, récolte ${pc(1 - v('recolte'))} plus rapide`,
  ].filter(Boolean);
}
