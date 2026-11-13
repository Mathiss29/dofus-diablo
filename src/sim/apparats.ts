/** D'où viennent les apparats (maquette « Apparats : » 2026-11-12) : plus aucun ne s'achète au Marché.
 *  1B : 1 à 3 apparats exclusifs par boss de donjon (1 chance sur 75 par victoire, sans garantie) ; 1C : succès de classe ;
 *  1D : fêtes du calendrier ; 1E : boss du monde et invasions (World.gagnerApparat) ; 1H : boutique Ogrines (à venir).
 *  2A : jamais de double (on tire parmi ceux qu'on n'a pas). 3A : chaque apparat a sa rareté.
 *  Données : src/data/apparats_sources.json, écrit par tools/contenu/apparats_sources.py. */
import sources from '../data/apparats_sources.json';
import type { Rarity } from './items';

export type SourceApparat =
  | { k: 'boss'; boss: string; rarete: Rarity }
  | { k: 'classe'; classe: string; niveau: number; rarete: Rarity }
  | { k: 'fete'; fete: string; rarete: Rarity }
  | { k: 'monde'; evenement: string; rarete: Rarity }
  | { k: 'enutrof' | 'tiwa' | 'avenir' | 'boutique'; rarete: Rarity };
export interface FeteDef { nom: string; /** MM-JJ, inclus */ debut: string; fin: string }

export const APPARATS_SOURCES = sources as unknown as {
  chances: { boss: number; fete: Record<'normal' | 'elite' | 'boss', number>; monde: { boss: number; invasion: number } };
  fetes: Record<string, FeteDef>;
  monde: Record<string, { nom: string }>;
  sources: Record<string, SourceApparat>;
};
const S = APPARATS_SOURCES;

/** Source d'un apparat (null : apparat inconnu, ou apparence de la collection d'équipement). */
export const sourceApparat = (id: string): SourceApparat | null => S.sources[id] ?? null;
/** Rareté d'un apparat (3A). */
export const rareteApparat = (id: string): Rarity => S.sources[id]?.rarete ?? 'rare';

/** Fête du jour (AAAA-MM-JJ), ou null. Une fête peut passer le nouvel an (Nowel : 15 décembre au 6 janvier). */
export function feteDuJour(jour: string): string | null {
  const md = jour.slice(5, 10);
  if (md.length !== 5) return null;
  for (const [k, f] of Object.entries(S.fetes))
    if (f.debut <= f.fin ? md >= f.debut && md <= f.fin : md >= f.debut || md <= f.fin) return k;
  return null;
}

const parBoss = new Map<string, string[]>(), parFete = new Map<string, string[]>(), parMonde = new Map<string, string[]>();
for (const [id, s] of Object.entries(S.sources)) {
  if (s.k === 'boss') (parBoss.get(s.boss) ?? parBoss.set(s.boss, []).get(s.boss)!).push(id);
  else if (s.k === 'fete') (parFete.get(s.fete) ?? parFete.set(s.fete, []).get(s.fete)!).push(id);
  else if (s.k === 'monde') (parMonde.get(s.evenement) ?? parMonde.set(s.evenement, []).get(s.evenement)!).push(id);
}
/** Apparats exclusifs de ce boss (1B). */
export const apparatsDuBoss = (boss: string): string[] => parBoss.get(boss) ?? [];
/** Apparats de cette fête (1D). */
export const apparatsDeFete = (fete: string): string[] => parFete.get(fete) ?? [];
/** Apparats de ce boss du monde ou de cette invasion (1E). */
export const apparatsDuMonde = (evt: string): string[] => parMonde.get(evt) ?? [];

/** 1B + 1D : l'apparat qui tombe de ce monstre, ou null. 2A : seulement parmi ceux qui manquent.
 *  `tirer` = tirage de la partie (world.rng) ; `jour` = AAAA-MM-JJ (fêtes). */
export function tirerApparat(type: string, rang: 'normal' | 'elite' | 'boss', jour: string, possedes: readonly string[],
  rng: { next(): number; pick<T>(l: readonly T[]): T }): string | null {
  const manque = (l: string[]) => l.filter(id => !possedes.includes(id));
  if (rang === 'boss') {
    const l = manque(apparatsDuBoss(type));
    if (l.length && rng.next() < 1 / S.chances.boss) return rng.pick(l);
  }
  const f = feteDuJour(jour);
  if (f) {
    const l = manque(apparatsDeFete(f));
    if (l.length && rng.next() < 1 / S.chances.fete[rang]) return rng.pick(l);
  }
  return null;
}

/** Texte « où le trouver » de la collection (4A). */
export function ouTrouver(id: string, nomMonstre: (k: string) => string, nomClasse: (k: string) => string): string {
  const s = S.sources[id];
  if (!s) return 'Collection : briser ou défaire l\'objet';
  switch (s.k) {
    case 'boss': return `Boss : ${nomMonstre(s.boss)} (rare)`;
    case 'classe': return `Succès : ${nomClasse(s.classe)} de niveau ${s.niveau}`;
    case 'fete': { const f = S.fetes[s.fete]; return `Fête : ${f.nom} (du ${jourMois(f.debut)} au ${jourMois(f.fin)})`; }
    case 'monde': return `${S.monde[s.evenement]?.nom ?? 'Boss du monde'}`;
    case 'enutrof': return 'Coffre au trésor de l\'Enutrof';
    case 'tiwa': return 'Tiwa Cawoteuw (île des Wabbits), en Cawottes';
    case 'avenir': return 'Dans une zone pas encore ouverte';
    case 'boutique': return 'Boutique Ogrines (bientôt)';
  }
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function jourMois(md: string) { const [m, j] = md.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`; }

/** 4C : apparats à trouver dans une zone (compteur de la carte M) : ceux des boss de ses donjons et des boss du monde qui y apparaissent. */
type DonjonVu = { salles: Record<string, string[][]>; bossVague?: string[] };
export function apparatsDeZone(zone: { open?: { donjons?: DonjonVu[]; donjonsTest?: DonjonVu[]; donjonsV06?: DonjonVu[]; subareas: Record<string, unknown> } } | undefined,
  bossMonde: Record<string, { sousZone: number }>): string[] {
  if (!zone) return [];
  const l = new Set<string>();
  for (const d of [...(zone.open?.donjons ?? []), ...(zone.open?.donjonsTest ?? []), ...(zone.open?.donjonsV06 ?? [])]) for (const m of [...(d.bossVague ?? []), ...Object.values(d.salles).flat(2)]) apparatsDuBoss(m).forEach(id => l.add(id));
  for (const [k, b] of Object.entries(bossMonde)) if (zone.open?.subareas[String(b.sousZone)]) apparatsDuMonde(k).forEach(id => l.add(id));
  return [...l];
}
