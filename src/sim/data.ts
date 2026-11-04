import classes from '../data/classes.json';
import monsters from '../data/monsters.json';
import zones from '../data/zones.json';
import type { GameData } from './defs';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
