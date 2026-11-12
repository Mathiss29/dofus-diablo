// Onglets du tchat (maquette « Tchat : » 2A), à part pour que les réglages (ambiance.ts) les connaissent sans charger les données du jeu.
/** Ce qu'un onglet peut montrer : les canaux, et l'Infos coupé en deux (journal de la partie / butin). */
export type Filtre = 'tout' | 'groupe' | 'bastion' | 'prive' | 'infos' | 'butin';
export const FILTRES: [Filtre, string][] = [['tout', 'Tout'], ['bastion', 'Bastion'], ['groupe', 'Groupe'], ['prive', 'Privé'], ['infos', 'Infos : partie, quêtes, succès'], ['butin', 'Infos : butin']];
export interface Onglet { nom: string; f: Filtre[] }
/** 2A : onglets par défaut, comme Dofus 3 (Général montre tout). */
export const ONGLETS_DEFAUT: Onglet[] = [
  { nom: 'Général', f: ['tout', 'bastion', 'groupe', 'prive', 'infos', 'butin'] },
  { nom: 'Groupe', f: ['groupe'] },
  { nom: 'Privé', f: ['prive'] },
  { nom: 'Infos', f: ['infos', 'butin'] },
];
export const MAX_ONGLETS = 5;
