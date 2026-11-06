import classes from '../data/classes.json';
import monsters from '../data/monsters.json';
import zones from '../data/zones.json';
import items from '../data/items.json';
import armes from '../data/armes.json';
import quetes from '../data/quetes.json';
import boutique from '../data/boutique.json';
import recoltes from '../data/recoltes.json';
import apparat from '../data/apparat.json';
import type { RecoltesData } from './recolte';
import type { ItemsData } from './items';
import type { QuetesData } from './quests';
import type { GameData, WeaponProfile } from './defs';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
export const ITEMS = items as unknown as ItemsData;
/** Auto-attaque par type d'arme (src/data/armes.json). */
export const WEAPONS = Object.fromEntries(Object.entries(armes).filter(([k]) => !k.startsWith('_'))) as unknown as Record<string, WeaponProfile>;
/** Quêtes, PNJ et succès (src/data/quetes.json, écrit par tools/contenu/quetes.py). */
export const QUETES = quetes as unknown as QuetesData;
/** Boutiques des PNJ (src/data/boutique.json) : articles et prix en Pépites. */
export const BOUTIQUES = Object.fromEntries(Object.entries(boutique).filter(([k]) => !k.startsWith('_') && k !== 'apparat_prix')) as unknown as Record<string, { id: string; prix: number }[]>;
/** Métiers de récolte (src/data/recoltes.json, écrit par tools/contenu/recoltes.py). */
export const RECOLTES = recoltes as unknown as RecoltesData;
/** Objets d'apparat officiels (src/data/apparat.json, apparat_export.py) : nom, emplacement, case de l'icône sur ui/apparat.webp ;
 *  prix chez Emp par emplacement (boutique.json, apparat_prix). */
export interface ApparatDef { name: string; slot: 'chapeau' | 'cape'; icon: number; case: number }
export const APPARATS = { ...(apparat as unknown as { cell: number; cols: number; rows: number; objets: Record<string, ApparatDef> }), prix: boutique.apparat_prix as Record<string, number> };
