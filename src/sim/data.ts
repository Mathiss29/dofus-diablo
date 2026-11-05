import classes from '../data/classes.json';
import monsters from '../data/monsters.json';
import zones from '../data/zones.json';
import items from '../data/items.json';
import armes from '../data/armes.json';
import type { ItemsData } from './items';
import type { GameData, WeaponProfile } from './defs';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
export const ITEMS = items as unknown as ItemsData;
/** Auto-attaque par type d'arme (src/data/armes.json). */
export const WEAPONS = Object.fromEntries(Object.entries(armes).filter(([k]) => !k.startsWith('_'))) as unknown as Record<string, WeaponProfile>;
