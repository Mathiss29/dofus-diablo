import type { QueteDef, QuetesData } from './quests';

/** Quête principale « Le Carnet des Fêlures » (maquette Campagne, ligne du 2026-11-15) : des actes, un par région, faits de
 *  chapitres (des quêtes de type « campagne » chaînées par `suivante`). Fil rouge 3A : chaque boss de région garde un éclat
 *  des Enfers ; le vaincre reprend un des Sceaux des Douze. Contenu : src/data/campagne.json (tools/contenu/campagne.py). */
export interface ActeDef {
  id: string; nom: string; region: string;
  /** Niveaux conseillés (7A : rien n'est fermé, l'acte est seulement « conseillé plus tard » en dessous). */
  niveaux: [number, number];
  /** PNJ qui guide l'acte (bulle et portrait du Carnet). */
  guide: string;
  resume: string;
  /** Ids des chapitres, dans l'ordre. */
  chapitres: string[];
  /** Fin d'acte (6A + 6B) : rareté du sac et titre, posés sur le dernier chapitre. */
  sac?: string; titre?: string;
}
export interface CampagneData { actes: ActeDef[]; quetes: Record<string, QueteDef> }
/** Nombre de Sceaux des Douze (3A). */
export const SCEAUX = 12;

/** Les quêtes du jeu avec les chapitres de la campagne (ils ne démarrent que pour un perso qui voit la campagne). */
export function avecCampagne(q: QuetesData, c: CampagneData): QuetesData {
  return { ...q, quetes: { ...q.quetes, ...c.quetes }, campagne: c.actes };
}
