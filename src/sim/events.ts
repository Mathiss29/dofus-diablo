import type { Element, SpellDef } from './defs';
import type { Item, Rarity } from './items';

/** Ce que la simulation signale à l'affichage (effets, sons, interface).
 *  La simulation ne dessine rien : elle pousse des événements, l'affichage les consomme. */
export type SimEvent =
  /** Impact d'un coup du joueur : fx = forme de l'effet, size = portée / longueur / rayon, boosted = renforcé par la Rage. */
  | { k: 'spell'; fx: SpellDef['fx']; id: string; x: number; y: number; facing: number; size: number; arc: number; element: Element; big: boolean; boosted: boolean }
  /** Une flèche part (l'affichage lit world.projectiles pour la dessiner en vol). */
  | { k: 'shoot'; id: string; x: number; y: number; facing: number; element: Element; boosted: boolean }
  | { k: 'slam'; x: number; y: number; radius: number }
  /** Un monstre commence un de ses sorts officiels (nom affiché au-dessus de lui). */
  | { k: 'monsterCast'; id: number; name: string; x: number; y: number }
  /** Retrait ou bonus de PA / PM / Puissance (texte flottant façon Dofus). */
  | { k: 'status'; x: number; y: number; text: string; color: string }
  | { k: 'hit'; target: 'monster' | 'player'; id?: number; x: number; y: number; z: number; amount: number; crit: boolean; element?: Element }
  /** XP gagnée en tuant un monstre (choix 1A : chiffre au-dessus de lui). */
  | { k: 'xp'; x: number; y: number; z: number; n: number }
  | { k: 'kill'; x: number; y: number; radius: number; monster: string }
  | { k: 'impact'; hitstop: number; shake: number; big: boolean }
  | { k: 'playerHurt' }
  | { k: 'wave'; n: number; boss: string | null; archi: string | null }
  | { k: 'bossDown'; monster: string }
  | { k: 'playerDeath'; wave: number }
  | { k: 'potion'; x: number; y: number; amount: number }
  | { k: 'levelUp'; level: number }
  | { k: 'noResource'; res: 'pa' | 'pm' }
  /** Jauge de classe pleine, puis dépensée par un sort renforcé. */
  | { k: 'rageFull' }
  | { k: 'rageSpent'; spell: string }
  /** Monde ouvert : le joueur entre dans une autre sous-zone. */
  | { k: 'enterArea'; name: string; level: number }
  | { k: 'groupCleared' }
  | { k: 'respawn' }
  /** Butin : un objet tombe (rareté pour l'effet), puis il est ramassé. */
  | { k: 'itemDrop'; x: number; y: number; rarity: Rarity }
  | { k: 'loot'; item: Item }
  | { k: 'lootResource'; id: string; n: number }
  | { k: 'lootKamas'; n: number }
  /** Sac plein : l'objet reste au sol. */
  | { k: 'bagFull' }
  /** Nouveau point de retour (Zaap). */
  | { k: 'checkpoint'; name: string };

/** Zones au sol affichées avant un coup (rouge = danger, or = sort du joueur). */
export type Telegraph =
  | { kind: 'circle'; x: number; y: number; r: number; progress: number; danger: boolean }
  | { kind: 'rect'; x: number; y: number; facing: number; len: number; w: number; progress: number; danger: boolean };
