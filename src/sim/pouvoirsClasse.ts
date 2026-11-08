import type { Rng } from './math';
import type { Slot } from './items';

/** Légendaires de classe inventés (ligne « Légendaires classe : 1A 2A+2D 3C 4A … 8A 9A », Mathis 2026-11-08) :
 *  un pouvoir à nous qui CHANGE la façon dont marche un vrai sort de la classe (1A), un par emplacement.
 *  2A : un Légendaire de classe a 1 chance sur 5 de tirer un de ces pouvoirs au lieu d'un pouvoir officiel ou maison ;
 *  2D : chaque boss a ses pouvoirs préférés (chance triplée sur son butin).
 *  3C : jet aléatoire dans une fourchette (comme les caractéristiques) ; un Mythique tire toujours le jet parfait.
 *  4A : le Codex garde le jet de l'objet brisé, un meilleur jet le remplace.
 *  Sacrieur (maquette Sacrieur 14A+14B, 15A+15B+15E « les trois en légendaires ») : 9 pouvoirs ;
 *  puis 8 qui changent un sort (« Légendaires sacri : 1A-1H 2A 3A 4A ») : 17 en tout, 2 ou 3 par emplacement, tirés au hasard. */
export interface PouvoirClasseDef {
  id: string; classe: string; nom: string;
  /** Sort visé (clé de classes.json). */
  sort: string; slot: Slot;
  /** Fourchette du jet et pas d'arrondi. */
  jet: [number, number]; pas: number;
  texte: (v: number) => string;
}
const pc = (classe: string, lettre: string, nom: string, sort: string, slot: Slot, jet: [number, number], pas: number, texte: (v: number) => string): PouvoirClasseDef =>
  ({ id: `pc-${classe}-${lettre}`, classe, nom, sort, slot, jet, pas, texte });
const n = (v: number) => String(v).replace('.', ',');

export const POUVOIRS_CLASSE: PouvoirClasseDef[] = [
  // --- Iop -------------------------------------------------------------------------------------------------------------
  pc('iop', 'A', 'Bond sismique', 'bond', 'bottes', [50, 70], 1, v => `À l'atterrissage, Bond fait une onde de choc Terre sur 2 cases autour (${v} % des dégâts de Pression).`),
  pc('iop', 'B', 'Lame tournoyante', 'epee', 'arme', [65, 85], 1, v => `Épée Céleste frappe tout autour du Iop au lieu de sa cible, à ${v} % de ses dégâts.`),
  pc('iop', 'C', 'Rage sans fond', 'colere', 'ceinture', [12, 20], 1, v => `Quand la jauge de Rage se remplit, Colère de Iop est rechargée tout de suite (au plus une fois toutes les ${v} s).`),
  pc('iop', 'D', 'Fureur croissante', 'fureur', 'anneau', [10, 20], 1, v => `Chaque cumul de Fureur fait ${v} % de dégâts en plus, et Fureur cumule jusqu'à 5 fois.`),
  pc('iop', 'E', 'Vague de retour', 'deferlement', 'amulette', [40, 60], 1, v => `Déferlement revient frapper son point de départ à la fin de la charge (${v} % des dégâts).`),
  pc('iop', 'F', 'Couperet du bourreau', 'couperet', 'bouclier', [8, 14], 1, v => `Couperet achève un monstre sous ${v} % de PV (élite : moitié moins, jamais un boss). Au plus une fois toutes les 4 s.`),
  pc('iop', 'G', 'Cri du champion', 'intimidation', 'chapeau', [1.5, 3], 0.5, v => `Intimidation repousse aussi tous les monstres à ${n(v)} cases autour du Iop.`),
  pc('iop', 'H', 'Épée jumelle', 'epee_divine', 'cape', [60, 100], 5, v => `Épée Divine laisse une épée au sol 3 s : elle frappe une fois chaque monstre qui la traverse (${v} % des dégâts).`),
  // --- Crâ (sans Pas piégé, 6D refusé) ---------------------------------------------------------------------------------
  pc('cra', 'A', 'Gerbe de feu', 'explosive', 'arme', [30, 45], 1, v => `Flèche Explosive se sépare en 3 petites explosions autour du point d'impact (${v} % des dégâts chacune).`),
  pc('cra', 'B', 'Rafale cinglante', 'cinglante', 'chapeau', [40, 55], 1, v => `Flèche Cinglante tire 3 flèches en éventail, chacune à ${v} % des dégâts.`),
  pc('cra', 'C', 'Flèche rebelle', 'vagabonde', 'amulette', [1, 3], 1, v => `Flèche Vagabonde rebondit sur ${v} monstre${v > 1 ? 's' : ''} de plus (−20 % de dégâts par rebond).`),
  pc('cra', 'E', "Œil d'aigle", 'tirs_eloignes', 'cape', [1.5, 2.5], 0.5, v => `Pendant Tirs Éloignés, les flèches font +${n(v)} % de dégâts par case de distance avec la cible (jusqu'à +${n(v * 10)} %).`),
  pc('cra', 'F', 'Givre mordant', 'glacee', 'anneau', [0.8, 1.2], 0.1, v => `Un monstre touché 3 fois par Flèche Glacée en 5 s est gelé ${n(v)} s (élites moitié moins, boss jamais). Une fois par monstre toutes les 6 s.`),
  pc('cra', 'G', 'Clouage', 'recul', 'bouclier', [40, 60], 1, v => `Un monstre repoussé par Flèche de Recul contre un mur ou un autre monstre prend ${v} % de dégâts de poussée en plus et est étourdi 0,5 s.`),
  pc('cra', 'H', 'Marque du chasseur', 'abolition', 'ceinture', [10, 20], 1, v => `Flèche d'Abolition marque sa cible 4 s : tes autres coups lui font +${v} % de dégâts.`),
  // --- Osamodas --------------------------------------------------------------------------------------------------------
  pc('osamodas', 'A', 'Horde sauvage', 'cortege', 'arme', [6, 10], 1, v => `Cortège Sauvage fait venir 2 bêtes de la meute en plus pendant ${v} s.`),
  pc('osamodas', 'B', 'Coup de fouet', 'fouet', 'chapeau', [20, 40], 5, v => `Les bêtes touchées par Fouet attaquent ${v} % plus vite pendant 4 s.`),
  pc('osamodas', 'C', 'Souffle partagé', 'souffle_draconique', 'amulette', [40, 60], 1, v => `Quand l'Osamodas lance Souffle Draconique, sa Dragoune le crache aussi depuis sa place (${v} % des dégâts).`),
  pc('osamodas', 'D', 'Tofu explosif', 'tofu', 'ceinture', [20, 35], 1, v => `Le Tofu explose quand il disparaît : ${v} dégâts Air de base sur 2 cases.`),
  pc('osamodas', 'E', 'Laine épaisse', 'bouftou', 'cape', [2, 4], 0.5, v => `Le Bouftou attire sur lui les monstres proches pendant ${n(v)} s à son arrivée, puis toutes les 8 s.`),
  pc('osamodas', 'F', 'Lien des âmes', 'laisse_spirituelle', 'anneau', [1.6, 2.2], 0.1, v => `Le monstre dompté par Laisse Spirituelle reste ${n(v)} fois plus longtemps et garde ses PV.`),
  pc('osamodas', 'G', 'Bond du crapaud', 'saute_granouille', 'bottes', [10, 20], 5, v => `Saute-granouille emmène la meute : les bêtes atterrissent autour de l'Osamodas avec un bouclier de ${v} % de leurs PV.`),
  pc('osamodas', 'H', 'Rage de la meute', 'charge_bestiale', 'bouclier', [8, 14], 1, v => `Charge Bestiale soigne chaque bête de la meute de ${v} % de ses PV.`),
  // --- Sacrieur (maquette Sacrieur) ---------------------------------------------------------------------------------------
  pc('sacrieur', 'A', 'Soif de sang', 'absorption', 'anneau', [2, 4], 0.5, v => `Chaque monstre tué te rend ${n(v)} % de tes PV, sans te faire redescendre sous Souffrance 6 si tu y es.`),
  pc('sacrieur', 'B', 'Frénésie', 'absorption', 'arme', [4, 6], 0.5, v => `À Souffrance 8+, chaque coup de poing ou d'arme qui touche donne +${n(v)} % de Vitesse d'attaque (5 fois au plus, 3 s sans frapper pour retomber).`),
  pc('sacrieur', 'C', 'Coups qui saignent', 'hemorragie', 'ceinture', [30, 50], 5, v => `À Souffrance 6+, tes vols de vie font saigner la cible : ${v} % des dégâts du coup en plus, répartis sur 2 s.`),
  pc('sacrieur', 'D', 'Dernier souffle', 'absorption', 'amulette', [1, 2], 0.25, v => `À Souffrance 10, le premier coup mortel te laisse à 1 PV, invulnérable ${n(v)} s. Une fois toutes les 60 s.`),
  pc('sacrieur', 'E', 'Châtiment Forcé', 'absorption', 'bouclier', [10, 20], 1, v => `Chaque coup reçu donne +${v} Force pendant 6 s (5 fois au plus).`),
  pc('sacrieur', 'F', 'Châtiment Agile', 'absorption', 'bottes', [10, 20], 1, v => `Chaque coup reçu donne +${v} Agilité pendant 6 s (5 fois au plus).`),
  pc('sacrieur', 'G', 'Châtiment Osé', 'absorption', 'cape', [10, 20], 1, v => `Chaque coup reçu donne +${v} Chance pendant 6 s (5 fois au plus).`),
  pc('sacrieur', 'H', 'Châtiment Spirituel', 'absorption', 'chapeau', [10, 20], 1, v => `Chaque coup reçu donne +${v} Intelligence pendant 6 s (5 fois au plus).`),
  pc('sacrieur', 'I', 'Châtiment Vitalesque', 'absorption', 'bouclier', [20, 40], 5, v => `Chaque coup reçu donne +${v} Vitalité pendant 6 s (5 fois au plus).`),
  // Sacrieur, légendaires qui changent un sort (ligne « Légendaires sacri : 1A-1H 2A 3A 4A ») ------------------------------
  pc('sacrieur', 'J', 'Rivière de sang', 'hemorragie', 'arme', [70, 90], 5, v => `Hémorragie frappe tout l'arc devant le Sacrieur (2 cases) au lieu d'une seule cible, à ${v} % de ses dégâts.`),
  pc('sacrieur', 'K', 'Absorption vorace', 'absorption', 'chapeau', [1, 2], 1, v => `Absorption rebondit sur ${v} monstre${v > 1 ? 's' : ''} de plus autour de la cible, en volant aussi de la vie (−20 % de dégâts par rebond).`),
  pc('sacrieur', 'L', 'Sillage écarlate', 'ravage', 'bottes', [20, 35], 5, v => `Ravage laisse une traînée de sang 2 s : ${v} % des dégâts de Ravage à chaque monstre qui la traverse, une fois par monstre.`),
  pc('sacrieur', 'M', 'Chaîne de chair', 'attirance', 'amulette', [1, 2], 0.5, v => `Attirance attire aussi les monstres à ${n(v)} case${v > 1 ? 's' : ''} autour de la cible.`),
  pc('sacrieur', 'N', 'Épées jumelles', 'epee_vorace', 'ceinture', [55, 70], 5, v => `Épée Vorace fait venir 2 épées au lieu d'une, chacune avec ${v} % des PV et des dégâts.`),
  pc('sacrieur', 'O', 'Épines acérées', 'couronne', 'bouclier', [30, 50], 5, v => `Couronne d'Épines renvoie aussi les coups à distance, à ${v} % des dégâts renvoyés au contact.`),
  pc('sacrieur', 'P', 'Stase de sang', 'stase', 'cape', [0.8, 1.2], 0.1, v => `Stase immobilise sa cible ${n(v)} s (élites moitié moins, boss jamais). Une fois par monstre toutes les 5 s.`),
  pc('sacrieur', 'Q', 'Offrande explosive', 'mutilation', 'anneau', [50, 80], 5, v => `Les PV sacrifiés par Mutilation explosent autour du Sacrieur : dégâts Feu sur 2 cases égaux à ${v} % des PV perdus.`),
];
/** Châtiments du Sacrieur (Dofus Rétro, 14B) : caractéristique gagnée à chaque coup reçu. */
export const CHATIMENTS: Record<string, 'force' | 'agilite' | 'chance' | 'intelligence' | 'vitalite'> =
  { 'pc-sacrieur-E': 'force', 'pc-sacrieur-F': 'agilite', 'pc-sacrieur-G': 'chance', 'pc-sacrieur-H': 'intelligence', 'pc-sacrieur-I': 'vitalite' };
export const PC_PAR_ID: Record<string, PouvoirClasseDef> = Object.fromEntries(POUVOIRS_CLASSE.map(p => [p.id, p]));
export const estPouvoirClasse = (id: string) => !!PC_PAR_ID[id];

/** 2D : pouvoirs préférés de chaque boss (chance triplée sur son butin), un par classe. */
export const BOSS_PREFERES: Record<string, string[]> = {
  royal: ['pc-iop-A', 'pc-cra-G', 'pc-osamodas-E', 'pc-sacrieur-E', 'pc-sacrieur-L'],
  kardorim: ['pc-iop-F', 'pc-cra-H', 'pc-osamodas-F', 'pc-sacrieur-D', 'pc-sacrieur-O'],
  tournesol_affame: ['pc-iop-H', 'pc-cra-A', 'pc-osamodas-D', 'pc-sacrieur-A', 'pc-sacrieur-J'],
  mob_l_eponge: ['pc-iop-E', 'pc-cra-F', 'pc-osamodas-B', 'pc-sacrieur-C', 'pc-sacrieur-P'],
  kankreblath: ['pc-iop-B', 'pc-cra-C', 'pc-osamodas-C', 'pc-sacrieur-B', 'pc-sacrieur-K'],
};
/** 2A : part des pouvoirs de Légendaire qui sont des pouvoirs de classe inventés. */
export const CHANCE_POUVOIR_CLASSE = 0.2;

/** 3C : jet dans la fourchette, arrondi au pas ; parfait (Mythique) = le haut de la fourchette. */
export function jetPouvoirClasse(d: PouvoirClasseDef, rng: Rng, parfait: boolean): number {
  const [a, b] = d.jet;
  const v = parfait ? b : a + (b - a) * rng.next();
  return Math.round(Math.round(v / d.pas) * d.pas * 100) / 100;
}
/** Texte de la fourchette pour la fiche (3C). */
export const fourchette = (d: PouvoirClasseDef) => `${n(d.jet[0])} à ${n(d.jet[1])}`;

/** Pouvoir de classe de cet emplacement (un par emplacement et par classe ; le Sacrieur en a 2 ou 3,
 *  tirés au hasard avec rng), sauf s'il est déjà sur l'objet. */
export function pouvoirClasseDuSlot(classe: string, slot: Slot, exclus: Set<string> = new Set(), rng?: Rng): PouvoirClasseDef | null {
  const l = POUVOIRS_CLASSE.filter(p => p.classe === classe && p.slot === slot && !exclus.has(p.id));
  return (l.length > 1 && rng ? rng.pick(l) : l[0]) ?? null;
}
/** Chance qu'un pouvoir de Légendaire soit ce pouvoir de classe (2A), triplée sur le butin d'un boss qui le préfère (2D). */
export const chancePouvoirClasse = (p: PouvoirClasseDef, boss?: string) => Math.min(1, CHANCE_POUVOIR_CLASSE * (boss && BOSS_PREFERES[boss]?.includes(p.id) ? 3 : 1));
