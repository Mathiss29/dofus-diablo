// Rangement du menu des Succès (maquette « Succès : 1A … 9A », 2026-11-15) : on regroupe à l'affichage seulement.
// Chaque succès reste un vrai succès (points, récompense, sauvegarde) ; ici on décide seulement comment le montrer :
//   - un donjon et ses 4 défis = une carte avec 5 médailles (3A) ;
//   - une série de paliers (métier 10→200, niveaux, confection, Dofus, archimonstres…) = une carte avec frise (2A) ;
//   - les zones à découvrir d'une région = une carte avec pastilles (5A) ;
//   - Garde-robe, Apparats, Dofus, Archimonstres, Ménagerie partent dans une catégorie Collection (4A).
// Pas de Phaser ni de DOM : testé dans tests/succes-rangement.test.ts.
import type { SuccesDef, SuccesObjectif } from '../sim/quests';

/** Sous-catégories rangées dans la catégorie Collection (4A, pas une catégorie de Dofus 3 : règle innovation). */
export const COLLECTION = new Set(['Garde-robe', 'Apparats', 'Dofus', 'Archimonstres', 'Ménagerie']);
/** Sous-catégories montrées en grille de cases (4A « en grilles ») plutôt qu'en lignes. */
export const EN_GRILLE = new Set(['Garde-robe', 'Apparats']);

export const categorieAffichee = (s: SuccesDef): string => COLLECTION.has(s.sousCategorie) ? 'Collection' : s.categorie;
/** Métiers de récolte de Dofus 3 ; les autres métiers sont d'artisanat (une sous-catégorie par métier faisait 14 intertitres d'une carte). */
const RECOLTE = new Set(['Paysan', 'Bûcheron', 'Mineur', 'Pêcheur', 'Alchimiste', 'Chasseur']);
const sousAffichee = (s: SuccesDef): string => s.sousCategorie === 'Apparats' ? 'Apparats de classe'
  : s.categorie === 'Métiers' && s.sousCategorie !== 'Général' ? (RECOLTE.has(s.sousCategorie) ? 'Récolte' : 'Artisanat') : s.sousCategorie;

/** Ordre des sous-catégories dans l'arbre (1A) : le perso, puis la collection, les régions dans l'ordre du voyage, les tranches de donjons. */
const ORDRE_SOUS = ['Niveaux', 'Classes', 'Garde-robe', 'Apparats de classe', 'Dofus', 'Archimonstres', 'Ménagerie', 'Incarnam', 'Astrub', 'Amakna', 'Récolte', 'Artisanat',
  'Niveaux 1 à 50', 'Niveaux 51 à 100', 'Le tour du monde'];
export const ordreSous = (l: string[]): string[] => l.map((s, i) => [s, i] as const)
  .sort((a, b) => ((ORDRE_SOUS.indexOf(a[0]) + 1 || 50) - (ORDRE_SOUS.indexOf(b[0]) + 1 || 50)) || a[1] - b[1]).map(([s]) => s);

/** Donjons absents du Tour du monde (région pour le filtre 7D et le repli 8A). */
const REGION_DONJON: Record<string, string> = {
  'Akadémie des Gobs': 'Amakna', 'Nid du Kwakwa': 'Amakna', 'Château du Wa Wabbit': 'Île des Wabbits', 'Terrier du Wa Wabbit': 'Île des Wabbits',
};

export type Genre = 'seul' | 'donjon' | 'serie' | 'zones';
export interface Entree {
  /** Clé stable (dépliage, mise en avant). */
  cle: string; genre: Genre;
  /** Succès de l'entrée, dans l'ordre (paliers croissants, Vaincu puis défis). */
  ids: string[];
  nom: string; categorie: string; sous: string; icone: number;
  /** Région de l'entrée (Incarnam, Astrub, Amakna…) ou null. */
  region: string | null;
  /** Série : étiquette de chaque palier (« 10 », « 1 000 »…) ; donjon : nom de chaque médaille. */
  etiquettes: string[];
}

/** Palier d'un succès à un seul objectif chiffré : clé de la série et valeur du palier. */
export function palierDe(s: SuccesDef): { cle: string; val: number } | null {
  if (s.objectifs.length !== 1) return null;
  const o = s.objectifs[0] as SuccesObjectif & Record<string, unknown>;
  if ('classe' in o) return { cle: `classe:${o.classe}`, val: o.niveau as number };
  if ('niveau' in o) return { cle: 'niveau', val: o.niveau as number };
  if ('metier' in o) return { cle: `metier:${o.metier}`, val: o.palier as number };
  if ('compteur' in o) return { cle: `compteur:${o.compteur}`, val: o.n as number };
  if ('guerre' in o && 'n' in o) return { cle: `guerre:${o.guerre}`, val: o.n as number };
  for (const k of ['dofus', 'archis', 'invasions', 'familiers'] as const) if (k in o) return { cle: k, val: o[k] as number };
  return null;
}
const NOM_SERIE: Record<string, string> = {
  niveau: 'Niveaux du personnage', 'compteur:fabriques': 'Confectionner des objets', 'compteur:runes': 'Concasser en runes',
  dofus: 'Les Dofus', archis: "Âmes d'archimonstres", 'guerre:gagnees': 'Défenseur des cawottes', invasions: 'Invasions repoussées',
  familiers: 'Familiers de la Ménagerie', 'metier:*': 'Niveau dans un métier',
};
const nombre = (n: number) => n >= 1000 ? n.toLocaleString('fr-FR').replace(/\s/g, ' ') : String(n);

/** Nom d'une médaille de donjon : « Vaincu » ou le défi entre parenthèses (« Duo », « Blitzkrieg »…). */
const medaille = (s: SuccesDef) => s.objectifs.some(o => 'defi' in o) ? (/\(([^)]+)\)\s*$/.exec(s.nom)?.[1] ?? s.nom) : 'Vaincu';

/** Range les succès visibles en entrées (ordre des données gardé : une entrée apparaît à la place de son premier succès).
 *  regionDonjon : région d'un donjon (pages du Tour du monde). */
export function rangerSucces(liste: [string, SuccesDef][], regionDonjon: (d: string) => string | null | undefined = () => null): Entree[] {
  const out: Entree[] = [], parCle = new Map<string, Entree>();
  const regions = new Set(liste.filter(([, s]) => s.categorie === 'Exploration').map(([, s]) => s.sousCategorie));
  for (const [, s] of liste) for (const o of s.objectifs) if ('donjon' in o) { const r = regionDonjon(o.donjon); if (r) regions.add(r); }
  const regionSous = (s: SuccesDef) => regions.has(s.sousCategorie) ? s.sousCategorie : null;
  const ajouter = (cle: string, genre: Genre, id: string, _s: SuccesDef, base: Omit<Entree, 'cle' | 'genre' | 'ids' | 'etiquettes'>, etiquette = '') => {
    let e = parCle.get(cle);
    if (!e) { e = { cle, genre, ids: [], etiquettes: [], ...base }; parCle.set(cle, e); out.push(e); }
    e.ids.push(id); e.etiquettes.push(etiquette);
    return e;
  };
  const donjonsDefis = new Set<string>();
  for (const [, s] of liste) for (const o of s.objectifs) if ('defi' in o) donjonsDefis.add(o.defi[0]);
  // séries : seulement si au moins 2 paliers dans la même sous-catégorie
  const series = new Map<string, number>();
  for (const [, s] of liste) { const p = palierDe(s); if (p) { const k = `${s.categorie}|${s.sousCategorie}|${p.cle}`; series.set(k, (series.get(k) ?? 0) + 1); } }
  for (const [id, s] of liste) {
    const cat = categorieAffichee(s), sous = sousAffichee(s), o = s.objectifs[0];
    const base = { nom: s.nom, categorie: cat, sous, icone: s.icone, region: regionSous(s) };
    // 3A : un donjon et ses défis
    // le succès « Vaincu » porte le nom du donjon (« Crypte de Kardorim ») ; les défis le nomment dans leur objectif
    const od = s.categorie === 'Donjons' ? s.objectifs.find(x => 'defi' in x) : undefined;
    const dj = od && 'defi' in od ? od.defi[0] : s.categorie === 'Donjons' && donjonsDefis.has(s.nom) ? s.nom : null;
    if (dj) {
      const e = ajouter(`donjon:${dj}`, 'donjon', id, s, { ...base, nom: dj, region: regionDonjon(dj) ?? REGION_DONJON[dj] ?? null }, medaille(s));
      if (!od) e.icone = s.icone;
      continue;
    }
    // 2A : une série de paliers
    const p = palierDe(s);
    if (p && (series.get(`${s.categorie}|${s.sousCategorie}|${p.cle}`) ?? 0) > 1) {
      const nom = p.cle.startsWith('classe:') ? s.nom.replace(/ de niveau.*$/, '')
        : p.cle.startsWith('metier:') && p.cle !== 'metier:*' ? s.sousCategorie
        : p.cle.startsWith('guerre:') ? s.nom.replace(/\s*\(\d+\)\s*$/, '') : NOM_SERIE[p.cle] ?? s.sousCategorie;
      ajouter(`serie:${s.categorie}|${s.sousCategorie}|${p.cle}`, 'serie', id, s, { ...base, nom }, nombre(p.val));
      continue;
    }
    // 5A : les zones à découvrir d'une région
    if (s.categorie === 'Exploration' && s.objectifs.length === 1 && o && 'sousZone' in o) {
      ajouter(`zones:${s.sousCategorie}`, 'zones', id, s, { ...base, nom: s.sousCategorie }, s.nom);
      continue;
    }
    ajouter(`seul:${id}`, 'seul', id, s, base);
  }
  // paliers dans l'ordre croissant ; Vaincu avant les défis
  for (const e of out) if (e.genre === 'serie' || e.genre === 'donjon') {
    const v = (i: number) => e.genre === 'serie' ? palierDe(liste.find(([id]) => id === e.ids[i])![1])!.val : e.etiquettes[i] === 'Vaincu' ? -1 : i;
    const ordre = e.ids.map((_, i) => i).sort((a, b) => v(a) - v(b));
    e.ids = ordre.map(i => e.ids[i]); e.etiquettes = ordre.map(i => e.etiquettes[i]);
    if (e.ids.length === 1 && e.genre === 'serie') e.genre = 'seul';
  }
  return out;
}

/** État d'une entrée pour le tri (7A) et les filtres (7B). */
export interface EtatEntree { fait: number; total: number; aRecuperer: number; avancement: number }
export function etatEntree(e: Entree, Q: { succes: Set<string>; aRecuperer(id: string): boolean; avancement(id: string): number }): EtatEntree {
  let fait = 0, rec = 0, av = 0;
  for (const id of e.ids) { if (Q.succes.has(id)) fait++; if (Q.aRecuperer(id)) rec++; av += Q.avancement(id); }
  return { fait, total: e.ids.length, aRecuperer: rec, avancement: av / e.ids.length };
}
export type Filtre = 'tous' | 'rec' | 'cours' | 'ok' | 'neuf';
export function passeFiltre(t: EtatEntree, f: Filtre, cacherFaits: boolean): boolean {
  const fini = t.fait === t.total;
  if (cacherFaits && fini && !t.aRecuperer) return false;
  return f === 'tous' || (f === 'rec' && t.aRecuperer > 0) || (f === 'ok' && fini)
    || (f === 'cours' && !fini && t.avancement > 0) || (f === 'neuf' && t.avancement === 0);
}
/** 7A : à récupérer, puis en cours (les plus avancés d'abord), pas commencés, finis en bas. Tri stable. */
export function rangOrdre(t: EtatEntree): number {
  if (t.aRecuperer) return 0;
  if (t.fait === t.total) return 3;
  return t.avancement > 0 ? 1 + (1 - t.avancement) * 0.99 : 2;
}
