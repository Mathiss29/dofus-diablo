import type { EtatJoueur } from '../sim/sauvegarde';
import { COFFRE, relireCoffre, type Coffre } from '../sim/coffre';
import type { Apparence } from './squelette';
import type { Session, StatsPerso } from './carnet';

/** Un personnage sauvegardé (choix 16B : 3 emplacements, sauvegarde automatique dans le navigateur). */
export interface Perso {
  nom: string;
  classe: string;
  sexe: 'm' | 'f';
  /** Tête et couleurs choisies à la création (maquette Apparence) ; absent = tête 1 et couleurs officielles. */
  apparence?: Apparence;
  /** Mode Hardcore (choix 10D) : la mort efface le personnage. */
  hardcore: boolean;
  /** Choix « Tutoriel » à la création : faux = commence directement en Incarnam, avec l'équipement de départ. */
  tuto?: boolean;
  cree: number;
  /** Dernière partie (horodatage) et temps de jeu total, en secondes. */
  maj: number;
  temps: number;
  /** Sous-zone où il s'est arrêté (affichage), et sous-zones déjà vues (bandeau de zone 2C). */
  lieu: string;
  zones: string[];
  etat?: EtatJoueur;
  /** Résumé (Accueil 4A) et dernière partie (4C), notés par l'affichage. */
  stats?: StatsPerso;
  session?: Session;
}

/** 3 emplacements, plus ceux achetés au Marché (Magasin 6C), gardés avec le coffre du compte (normal ou Hardcore). */
export const EMPLACEMENTS = 3;
/** Le plus d'emplacements possible (le serveur des comptes en garde autant). */
export const EMPLACEMENTS_MAX = EMPLACEMENTS + COFFRE.emplacementsMax;
export const nbEmplacements = () => EMPLACEMENTS + Math.max(lireCoffre('normal').emplacementsEnPlus ?? 0, lireCoffre('hardcore').emplacementsEnPlus ?? 0);
const CLE = 'diablofus.persos';
const CLE_DERNIER = 'diablofus.dernier';

// --- Persos en ligne (maquette « Vrai multi : » 4A) : quand le joueur est connecté et a choisi « En ligne », les mêmes
// fonctions lisent et écrivent une copie locale des persos du compte, que compte.ts envoie au serveur.
let enLigne = false;
let surEcriture: ((quoi: 'persos' | SorteCoffre) => void) | null = null;
/** Choisit les persos du navigateur ou ceux du compte (compte.ts). */
export function sourceEnLigne(oui: boolean, ecoute?: (quoi: 'persos' | SorteCoffre) => void) { enLigne = oui; if (ecoute) surEcriture = ecoute; }
export const persosEnLigne = () => enLigne;
const cle = () => (enLigne ? `${CLE}.enligne` : CLE);
const cleDernier = () => (enLigne ? `${CLE_DERNIER}.enligne` : CLE_DERNIER);
const lireListe = (k: string): (Perso | null)[] => {
  let l: (Perso | null)[] = [];
  try { l = JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { /* stockage indisponible ou abîmé */ }
  if (!Array.isArray(l)) l = [];
  return Array.from({ length: nbEmplacements() }, (_, i) => (l[i] && typeof l[i] === 'object' ? assainir(l[i]!) : null));
};
const nombre = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
/** Sécurité : une sauvegarde importée (fichier .diablofus reçu de quelqu'un) peut contenir n'importe quoi. Les champs
 *  affichés dans les pages HTML de l'accueil reprennent ici leur type attendu (nombre, 'm' | 'f', texte). */
function assainir(p: Perso): Perso {
  p.nom = String(p.nom ?? ''); p.classe = String(p.classe ?? ''); p.sexe = p.sexe === 'f' ? 'f' : 'm';
  p.temps = nombre(p.temps); p.maj = nombre(p.maj); p.cree = nombre(p.cree); p.lieu = String(p.lieu ?? '');
  if (p.etat && typeof p.etat === 'object') p.etat.level = nombre(p.etat.level, 1);
  else delete p.etat;
  return p;
}
const assainirStele = (s: Stele): Stele => ({
  cree: nombre(s.cree), nom: String(s.nom ?? ''), classe: String(s.classe ?? ''), sexe: s.sexe === 'f' ? 'f' : 'm',
  niveau: nombre(s.niveau, 1), temps: nombre(s.temps), lieu: String(s.lieu ?? ''), tueur: String(s.tueur ?? ''), date: nombre(s.date),
});
export function lirePersos(): (Perso | null)[] { return lireListe(cle()); }
/** Les persos du navigateur, même en mode « En ligne » (import unique). */
export const lirePersosLocaux = () => lireListe(CLE);
/** Copie locale des persos du compte, remplacée par ce que renvoie le serveur. */
export function remplacerPersosEnLigne(l: (Perso | null)[]) {
  try { localStorage.setItem(`${CLE}.enligne`, JSON.stringify(l)); } catch { /* rien */ }
}
function ecrire(l: (Perso | null)[]) {
  try { localStorage.setItem(cle(), JSON.stringify(l)); } catch { /* navigateur sans stockage : la partie ne sera pas gardée */ }
  if (enLigne) surEcriture?.('persos');
}
export function sauverPerso(i: number, p: Perso) { const l = lirePersos(); l[i] = p; ecrire(l); dernier(i); }
export function supprimerPerso(i: number) {
  if (!enLigne) prendreSecours(true);
  const l = lirePersos(); l[i] = null; ecrire(l);
  if (dernier() === i) try { localStorage.removeItem(cleDernier()); } catch { /* rien */ }
}
/** Emplacement de la dernière partie (bouton « Continuer »), ou le modifie. */
export function dernier(i?: number): number | null {
  try {
    if (i != null) localStorage.setItem(cleDernier(), String(i));
    const n = Number(localStorage.getItem(cleDernier()));
    return localStorage.getItem(cleDernier()) != null && lirePersos()[n] ? n : null;
  } catch { return null; }
}
/** Nom valide : 3 à 16 lettres (accents, tiret et espace permis au milieu). */
export function nomValide(nom: string): boolean { return /^[\p{L}][\p{L}' -]{1,14}[\p{L}]$/u.test(nom.trim()); }
export function dureeTexte(s: number): string {
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// --- Cimetière des héros (choix Accueil 11A) : un héros Hardcore mort y laisse une stèle ---------------------------
export interface Stele { cree: number; nom: string; classe: string; sexe: 'm' | 'f'; niveau: number; temps: number; lieu: string; tueur: string; date: number }
const CLE_CIMETIERE = 'diablofus.cimetiere';
export function lireCimetiere(): Stele[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_CIMETIERE) ?? '[]');
    return Array.isArray(l) ? l.filter(s => s && typeof s === 'object').map(assainirStele) : [];
  } catch { return []; }
}
export function enterrer(s: Stele) {
  try { localStorage.setItem(CLE_CIMETIERE, JSON.stringify([s, ...lireCimetiere()].slice(0, 30))); } catch { /* rien */ }
}

// --- Sauvegarde exportable (10A) et copies de secours (10B) ----------------------------------------------------
/** Tout ce que le navigateur garde du joueur : persos, dernier emplacement, succès du compte, cimetière, sous-zones vues. */
const CLES = [CLE, CLE_DERNIER, 'diablofus.compte', CLE_CIMETIERE, 'diablofus.zones', 'diablofus.bestiaire'];
export interface Fichier { format: 'diablofus'; version: 1; date: number; donnees: Record<string, string> }

export function exporter(): Fichier {
  const donnees: Record<string, string> = {};
  try { for (const k of CLES) { const s = localStorage.getItem(k); if (s != null) donnees[k] = s; } } catch { /* rien */ }
  return { format: 'diablofus', version: 1, date: Date.now(), donnees };
}
/** Lit un fichier .diablofus ; renvoie un message d'erreur, ou null si tout est remis. Une copie de secours est prise avant. */
export function importer(texte: string): string | null {
  let f: Fichier;
  try { f = JSON.parse(texte); } catch { return 'Ce fichier n\'est pas une sauvegarde Diablofus.'; }
  if (!f || f.format !== 'diablofus' || typeof f.donnees !== 'object' || f.donnees == null) return 'Ce fichier n\'est pas une sauvegarde Diablofus.';
  try { const l = JSON.parse(f.donnees[CLE] ?? '[]'); if (!Array.isArray(l)) throw 0; } catch { return 'Sauvegarde abîmée : personnages illisibles.'; }
  prendreSecours(true);
  const morts = lireCimetiere();
  try {
    for (const k of CLES) { const s = f.donnees[k]; if (typeof s === 'string') localStorage.setItem(k, s); else localStorage.removeItem(k); }
    // un héros Hardcore mort ne revient pas par une vieille sauvegarde : le cimetière se cumule et ses morts restent morts
    const tous = [...morts, ...lireCimetiere().filter(m => !morts.some(n => n.cree === m.cree))];
    localStorage.setItem(CLE_CIMETIERE, JSON.stringify(tous.slice(0, 30)));
    ecrire(lirePersos().map(p => (p && tous.some(m => m.cree === p.cree) ? null : p)));
  } catch { return 'Le navigateur refuse d\'enregistrer la sauvegarde.'; }
  return null;
}

/** Copies de secours : les 3 dernières, prises au lancement d'une partie (au plus une toutes les 10 minutes),
 *  avant un import et avant une suppression. */
export interface Secours { date: number; resume: string; fichier: Fichier }
const CLE_SECOURS = 'diablofus.secours';
export const NB_SECOURS = 3;
export function lireSecours(): Secours[] {
  try { const l = JSON.parse(localStorage.getItem(CLE_SECOURS) ?? '[]'); return Array.isArray(l) ? l : []; } catch { return []; }
}
export function resumer(f: Fichier): string {
  let l: (Perso | null)[] = [];
  try { l = JSON.parse(f.donnees[CLE] ?? '[]'); } catch { /* rien */ }
  const p = l.filter((x): x is Perso => !!x && typeof x === 'object');
  return p.length ? p.map(x => `${x.nom} niv. ${x.etat?.level ?? 1}`).join(' · ') : 'Aucun personnage';
}
export function prendreSecours(force = false) {
  const l = lireSecours(), f = exporter();
  if (!f.donnees[CLE]) return;
  if (!force && l[0] && f.date - l[0].date < 10 * 60e3) return;
  if (l[0] && JSON.stringify(l[0].fichier.donnees) === JSON.stringify(f.donnees)) return;   // rien n'a changé
  try { localStorage.setItem(CLE_SECOURS, JSON.stringify([{ date: f.date, resume: resumer(f), fichier: f }, ...l].slice(0, NB_SECOURS))); } catch { /* stockage plein */ }
}
export function restaurerSecours(i: number): string | null {
  const s = lireSecours()[i];
  return s ? importer(JSON.stringify(s.fichier)) : 'Copie introuvable.';
}

/** Coffre partagé (0.3, 12A+12D) : un pour les persos normaux, un pour les Hardcore, un pour la partie de test. */
export type SorteCoffre = 'normal' | 'hardcore' | 'test';
const CLE_COFFRE: Record<SorteCoffre, string> = { normal: 'diablofus.coffre', hardcore: 'diablofus.coffre.hardcore', test: 'diablofus.coffre.test' };
/** En ligne, le coffre est celui du compte (copie locale envoyée au serveur), jamais celui du navigateur. */
const cleCoffre = (sorte: SorteCoffre) => (enLigne && sorte !== 'test' ? `${CLE_COFFRE[sorte]}.enligne` : CLE_COFFRE[sorte]);
export function lireCoffre(sorte: SorteCoffre): Coffre {
  try { return relireCoffre(JSON.parse(localStorage.getItem(cleCoffre(sorte)) ?? 'null')); } catch { return relireCoffre(null); }
}
export function lireCoffreBrut(sorte: 'normal' | 'hardcore'): unknown {
  try { return JSON.parse(localStorage.getItem(`${CLE_COFFRE[sorte]}.enligne`) ?? 'null'); } catch { return null; }
}
export function remplacerCoffreEnLigne(sorte: 'normal' | 'hardcore', c: unknown) {
  try { if (c == null) localStorage.removeItem(`${CLE_COFFRE[sorte]}.enligne`); else localStorage.setItem(`${CLE_COFFRE[sorte]}.enligne`, JSON.stringify(c)); } catch { /* rien */ }
}
export function sauverCoffre(sorte: SorteCoffre, c: Coffre) {
  try { localStorage.setItem(cleCoffre(sorte), JSON.stringify(c)); } catch { /* pas de stockage : le coffre vit le temps de la partie */ }
  if (enLigne && sorte !== 'test') surEcriture?.(sorte);
}
