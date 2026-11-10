import type { Monster } from './monster';

/** Île des Wabbits (« Wabbits : 2D ») : la Potion Wabbit déguise le joueur. Tant qu'il la porte, les Wabbits ordinaires de l'île
 *  ne le remarquent pas ; un coup porté réveille le groupe comme d'habitude. Les Wabbits Squelettes, les élites, les gardes
 *  du Château et du Terrier ne s'y laissent pas prendre. */
export const DEGUISEMENT = {
  types: new Set(['wabbit', 'black_wabbit', 'tiwabbit', 'black_tiwabbit', 'tiwabbit_kiafin', 'wo_wabbit', 'grand_pa_wabbit']),
};
/** Vrai si ce monstre laisse passer ce joueur déguisé. */
export function deguiseContre(m: Monster, p: object): boolean {
  return 'deguise' in p && (p.deguise as number) > 0 && !m.arene && !m.guerre && DEGUISEMENT.types.has(m.type);
}
