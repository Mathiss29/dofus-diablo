import type { ItemsData } from './items';

/** Clés renforcées (maquette « Des métiers qui servent vraiment », ligne « Métiers : » 9C, 2026-11-13) : le Bricoleur renforce
 *  la clé d'un donjon (tools/contenu/cles_renforcees.py : ressource « cr<id de la clé> », recette avec la clé, du bois et du
 *  minerai). Prise à l'entrée à la place de la clé normale, elle durcit les monstres de l'arène et y donne plus de butin et d'XP,
 *  tant que la clé reste valable. Première pierre de la fin de jeu. */
export const RENFORT = {
  /** PV et dégâts des monstres de l'arène. */
  pv: 1.5, degats: 1.3,
  /** Butin : en part de chances de Prospection (comme les idoles) ; XP en plus. */
  butin: 0.5, xp: 0.25,
};
/** La clé renforcée de cette clé de donjon (son id), ou null. */
export function cleRenforceeDe(items: ItemsData | undefined, cle: string): string | null {
  const id = 'cr' + cle;
  return items?.resources[id]?.renforcee === cle ? id : null;
}
export const texteRenfort = () => `Monstres : PV +${Math.round((RENFORT.pv - 1) * 100)} %, dégâts +${Math.round((RENFORT.degats - 1) * 100)} % · butin +${Math.round(RENFORT.butin * 100)} %, XP +${Math.round(RENFORT.xp * 100)} %`;
