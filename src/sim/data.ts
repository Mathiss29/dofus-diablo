import classes from '../data/classes.json';
import monsters from '../data/monsters.json';
import zones from '../data/zones.json';
import items from '../data/items.json';
import type { ItemsData } from './items';
import type { GameData } from './defs';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
export const ITEMS = items as unknown as ItemsData;
