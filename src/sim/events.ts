/** Ce que la simulation signale à l'affichage (effets, sons, interface).
 *  La simulation ne dessine rien : elle pousse des événements, l'affichage les consomme. */
export type SimEvent =
  | { k: 'swing'; x: number; y: number; facing: number; radius: number; arc: number; finisher: boolean }
  | { k: 'epee'; x: number; y: number; facing: number; length: number }
  | { k: 'bondLand'; x: number; y: number; radius: number }
  | { k: 'colere'; x: number; y: number; radius: number }
  | { k: 'slam'; x: number; y: number; radius: number }
  | { k: 'hit'; target: 'monster' | 'player'; x: number; y: number; z: number; amount: number; crit: boolean }
  | { k: 'kill'; x: number; y: number; radius: number; monster: string }
  | { k: 'impact'; hitstop: number; shake: number; big: boolean }
  | { k: 'playerHurt' }
  | { k: 'wave'; n: number; boss: string | null; archi: string | null }
  | { k: 'bossDown'; monster: string }
  | { k: 'playerDeath'; wave: number }
  | { k: 'potion'; x: number; y: number; amount: number }
  | { k: 'levelUp'; level: number }
  | { k: 'noResource'; res: 'pa' | 'pm' };

/** Zones au sol affichées avant un coup (rouge = danger, or = sort du joueur). */
export type Telegraph =
  | { kind: 'circle'; x: number; y: number; r: number; progress: number; danger: boolean }
  | { kind: 'rect'; x: number; y: number; facing: number; len: number; w: number; progress: number; danger: boolean };
