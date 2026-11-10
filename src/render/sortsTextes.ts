import textes from '../data/sorts_textes.json';

/** Textes des sorts écrits par nous (maquette « Menu sorts : 1A+1C 2A 3A 4A 5B 6A+6B 7A 8A 9B 10A+10B+10D 11A », 2026-11-10) :
 *  une accroche, une ou deux phrases de jeu en secondes, cases et PV (jamais de tour), une ligne d'ambiance facultative.
 *  Les 308 sorts officiels des 7 classes (9B), rangés par id Dofus ; les sorts sans id (Saut à la Lance, Estoc) par leur clé.
 *  Garde-fou : tests/sorts-textes.test.ts (11A). */
export type RoleSort = 'base' | 'zone' | 'ctrl' | 'soutien' | 'invoc' | 'dep' | 'gros';
export interface TexteSort { role: RoleSort; etiquettes: string[]; accroche: string; texte: string; ambiance?: string }
export const TEXTES_SORTS = textes as unknown as Record<string, Record<string, TexteSort>>;

/** Rubriques de la liste des sorts (1A), dans l'ordre d'affichage. */
export const ROLES_SORTS: [RoleSort, string][] = [
  ['base', 'Coups de base'], ['zone', 'Zone'], ['ctrl', 'Contrôle'], ['soutien', 'Défense et soutien'],
  ['invoc', 'Invocations'], ['dep', 'Déplacement'], ['gros', 'Gros coups'],
];
/** Étiquettes permises (5B : filtres de la liste). */
export const ETIQUETTES_SORTS = ['Mêlée', 'Distance', 'Zone', 'Ligne', 'Autour de toi', 'Ralentit', 'Repousse', 'Attire', 'Contrôle',
  'Affaiblit', 'Renforce', 'Bouclier', 'Soin', 'Vol de vie', 'Érosion', 'Cumul', 'Se charge', 'Invocation', 'Anti-invocations',
  'Déplacement', 'Allié', 'Lance', 'Meilleur élément'];

/** Texte d'un sort de la classe : par id Dofus, sinon par clé du sort jouable. */
export function texteSort(classe: string, id: number | string | undefined | null): TexteSort | null {
  if (id == null) return null;
  return TEXTES_SORTS[classe]?.[String(id)] ?? null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Mots-clés (4A) : soulignés dans le texte, définition au survol. */
const MOTS: [RegExp, string][] = [
  [/Érosion|PV max rongés|rongés?|ronge(?:nt)?/, 'Érosion : les PV max retirés ne reviennent pas avec les soins.'],
  [/boucliers?/, 'Bouclier : absorbe les dommages avant les PV (en violet sur la barre de vie).'],
  [/vol(?:e|ent)? de (?:la )?vie|vole(?:nt)? (?:la moitié|\d+ %)/, 'Vol de vie : une partie des dommages faits te revient en PV.'],
  [/\bPM\b/, 'PM : les points de mouvement. Ils paient les sauts ; en retirer à un monstre le ralentit.'],
  [/\bPA\b/, 'PA : la réserve qui paie les sorts, elle se remplit toute seule. En retirer à un monstre retarde ses attaques.'],
  [/invocations?/, 'Invocation : créature appelée par un joueur ou un monstre (Tofu, Bouftou, Épée Vorace…).'],
  [/Souffrance/, 'Souffrance : la jauge du Sacrieur (0 à 10), elle monte quand il perd des PV.'],
  [/Désarmé|désarmé/, 'Désarmé : ta Lance est plantée ailleurs ; certains sorts partent alors de la Lance.'],
  [/dommages de poussée/, 'Dommages de poussée : la cible repoussée prend des dommages en plus si elle heurte un obstacle.'],
  [/Puissance/, 'Puissance : augmente les dommages de tous les éléments.'],
  [/Critique/, 'Critique : chance qu\'un coup fasse bien plus mal.'],
  [/Portée/, 'Portée : jusqu\'où partent tes sorts à distance, en cases.'],
  [/Encouragés?|Encouragement/, 'Encouragement : un seul à la fois par allié.'],
  [/Moquerie/, 'Moquerie : un seul malus de Moquerie à la fois par ennemi.'],
  [/coffre au trésor/, 'Coffre au trésor : le compagnon de l\'Enutrof, il ramasse les pièces et le butin.'],
];
const TOUS = new RegExp(MOTS.map(([r]) => `(${r.source})`).join('|'), 'g');
/** Texte échappé, mots-clés entourés de <k data-def="…">. Chaque mot-clé n'est souligné qu'une fois par texte. */
export function avecMotsCles(t: string): string {
  const vus = new Set<number>();
  return esc(t).replace(TOUS, (m, ...g) => {
    const i = g.findIndex((x, j) => j < MOTS.length && x !== undefined);
    if (i < 0 || vus.has(i)) return m;
    vus.add(i);
    return `<k tabindex="0" data-def="${esc(MOTS[i][1])}">${m}</k>`;
  });
}
