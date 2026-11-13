import type { Stat } from './items';

/** Récolte et progression des artisans (maquette « Des métiers qui servent vraiment », ligne « Métiers : » 6A+6B+6D, 7A+7B, 2026-11-13). */
export const ARTISANS = {
  /** 6A : une ressource dorée donne un coup de pouce de 20 s selon le métier. */
  coupDePouce: 20,
  /** 6B : une ressource dorée de ce niveau ou plus est gardée : un élite de la sous-zone surgit au premier clic (PV ×pv). */
  gardeNiveau: 20, gardePv: 3,
  /** 6D : clic maintenu, le perso enchaîne les ressources de son métier dans ce rayon (px monde, 6 cases). */
  rayonChaine: 6 * 64,
  /** 7A + 7B : un palier tous les 20 niveaux de métier (10 au niveau 200). */
  palier: 20,
};
/** 6A : ce que donne la dorée, par métier (Bûcheron = dégâts, Paysan = soin, Mineur = résistance, Pêcheur = vitesse, Alchimiste = critique). */
export const POUCE: Record<string, { texte: string; mods?: [Stat, number][]; soin?: number; course?: number }> = {
  bucheron: { texte: '+30 Puissance', mods: [['puissance', 30]] },
  paysan: { texte: '+30 Soins et 10 % de PV rendus', mods: [['soins', 30]], soin: 0.1 },
  mineur: { texte: '+10 % de résistance à tout', mods: [['resTerre', 10], ['resFeu', 10], ['resEau', 10], ['resAir', 10], ['resNeutre', 10]] },
  pecheur: { texte: '+15 % de vitesse de course', course: 0.15 },
  alchimiste: { texte: '+10 % Critique', mods: [['critique', 10]] },
};
/** Paliers d'un métier (7A + 7B). */
export const paliers = (niveau: number) => Math.min(10, Math.floor(Math.max(0, niveau) / ARTISANS.palier));
/** 7A : bonus permanent par palier des métiers de récolte (fractions : 0.01 = +1 %). */
export const BONUS_RECOLTE: Record<string, { par: number; texte: string }> = {
  mineur: { par: 0.01, texte: 'de runes en défaisant un objet' },
  bucheron: { par: 0.01, texte: 'de points de vie' },
  paysan: { par: 0.02, texte: 'de soins reçus' },
  pecheur: { par: 0.01, texte: 'de vitesse de déplacement' },
  alchimiste: { par: 0.02, texte: "d'effet des potions" },
  chasseur: { par: 0.01, texte: 'de butin des monstres' },
};
/** 7B : métiers de fabrication -> emplacements dont ils renforcent les objets portés (+1 % de stats par palier). */
export const BONUS_FAB: Record<string, string[]> = {
  bijoutier: ['amulette', 'anneau1', 'anneau2'], cordonnier: ['bottes', 'ceinture'], tailleur: ['chapeau', 'cape'],
  forgeron: ['arme'], sculpteur: ['arme'], faconneur: ['bouclier'],
};
export const PAR_PALIER_FAB = 0.01;
