import classes from '../data/classes.json';
import monsters from '../data/monsters.json';
import zones from '../data/zones.json';
import items from '../data/items.json';
import armes from '../data/armes.json';
import quetes from '../data/quetes.json';
import boutique from '../data/boutique.json';
import recoltes from '../data/recoltes.json';
import apparat from '../data/apparat.json';
import familiers from '../data/familiers.json';
import type { RecoltesData } from './recolte';
import type { FamilierDef, ItemsData, Stat } from './items';
import type { QuetesData } from './quests';
import type { GameData, WeaponProfile } from './defs';
import { degatsMonstre } from './danger';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
// 1A (maquette « Danger ») : les dégâts des monstres suivent leur rang et leur niveau (src/data/danger.json) ; le champ dmg du json n'est plus lu
for (const d of Object.values(GAME_DATA.monsters)) d.dmg = degatsMonstre(d);
export const ITEMS = items as unknown as ItemsData;
/** Familiers officiels (src/data/familiers.json, familiers_export.py) : courbe d'XP et familiers, dont ceux d'apparat. */
export const FAMILIERS = familiers as unknown as { xp: number[]; familiers: Record<string, FamilierDef> };
// Les familiers sont des équipements (emplacement « familier ») : bonus [niveau 0, niveau 100] pour la fiche, niveau requis officiel.
for (const [id, f] of Object.entries(FAMILIERS.familiers)) {
  if (f.apparat || ITEMS.equipment[id]) continue;
  ITEMS.equipment[id] = { name: f.nom, slot: 'familier', level: f.niveau, icon: f.icon, familier: f,
    stats: Object.fromEntries((f.stats ?? []).map(([k, b, p]) => [k, [Math.max(1, Math.floor(b)), Math.floor(b + 100 * p)]])) as Partial<Record<Stat, [number, number]>> };
}
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
export interface ApparatDef { name: string; slot: 'chapeau' | 'cape' | 'familier'; icon: number; case: number }
export const APPARATS = { ...(apparat as unknown as { cell: number; cols: number; rows: number; objets: Record<string, ApparatDef> }), prix: boutique.apparat_prix as Record<string, number> };
// familiers d'apparat (5A) : leur icône est sur la planche des objets (case -1)
for (const [id, f] of Object.entries(FAMILIERS.familiers)) if (f.apparat) APPARATS.objets[id] = { name: f.nom, slot: 'familier', icon: f.icon, case: -1 };
