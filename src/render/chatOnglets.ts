// Onglets du tchat (maquette « Tchat : » 2A, puis canaux du 2026-11-15), à part pour que les réglages (ambiance.ts) les connaissent
// sans charger les données du jeu.
/** Ce qu'un onglet peut montrer : les canaux des joueurs, les messages du serveur, le journal de la partie (Combat) et les Événements. */
export type Filtre = 'tout' | 'groupe' | 'bastion' | 'prive' | 'serveur' | 'infos' | 'butin' | 'evenements';
export const FILTRES: [Filtre, string][] = [['tout', 'Tout'], ['bastion', 'Bastion'], ['groupe', 'Groupe'], ['prive', 'Privé'], ['serveur', 'Messages du serveur'],
  ['infos', 'Combat : partie, quêtes, succès'], ['butin', 'Combat : butin'], ['evenements', 'Événements']];
export interface Onglet { nom: string; f: Filtre[] }
/** Canaux 1B : Général = seulement les joueurs (et le serveur en gris, 5A), Groupe, Combat, Événements, Privé. */
export const ONGLETS_DEFAUT: Onglet[] = [
  { nom: 'Général', f: ['tout', 'bastion', 'groupe', 'prive', 'serveur'] },
  { nom: 'Groupe', f: ['groupe'] },
  { nom: 'Combat', f: ['infos', 'butin'] },
  { nom: 'Événements', f: ['evenements'] },
  { nom: 'Privé', f: ['prive'] },
];
export const MAX_ONGLETS = 6;
/** Onglets par défaut d'avant les canaux (PR #309) : Général montrait tout. */
const ANCIENS: Onglet[] = [
  { nom: 'Général', f: ['tout', 'bastion', 'groupe', 'prive', 'infos', 'butin'] },
  { nom: 'Groupe', f: ['groupe'] }, { nom: 'Privé', f: ['prive'] }, { nom: 'Infos', f: ['infos', 'butin'] },
];
export const VERSION_ONGLETS = 2;
const memes = (a: Onglet[], b: Onglet[]) => a.length === b.length && a.every((o, i) => o.nom === b[i].nom && o.f.length === b[i].f.length && o.f.every(f => b[i].f.includes(f)));
/** Canaux 8A : les onglets jamais touchés passent aux nouveaux ; ceux qu'on a réglés restent, et ce qui montrait les infos
 *  montre aussi les messages du serveur et les Événements (qui en faisaient partie). */
export function migrerOnglets(o: Onglet[] | undefined): Onglet[] {
  if (!o?.length || memes(o, ANCIENS)) return ONGLETS_DEFAUT.map(x => ({ nom: x.nom, f: [...x.f] }));
  return o.map(x => ({ nom: x.nom, f: x.f.includes('infos') ? [...new Set<Filtre>([...x.f, 'serveur', 'evenements'])] : [...x.f] }));
}
