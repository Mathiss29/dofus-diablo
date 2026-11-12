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
import familiersSources from '../data/familiers_sources.json';
import butin from '../data/butin.json';
import carte from '../data/carte.json';
import apparatsSources from '../data/apparats_sources.json';
import themes from '../data/havresac_themes.json';
import teintures from '../data/teintures.json';
import type { Teintures, ThemesHavreSac } from './havresac';
import type { RecoltesData } from './recolte';
import type { FamilierDef, ItemsData, Stat } from './items';
import type { QuetesData } from './quests';
import type { GameData, WeaponProfile } from './defs';
import { degatsMonstre } from './danger';
import { setPotions } from './forgemagie';

export const GAME_DATA = { classes, monsters, zones } as unknown as GameData;
// 1A (maquette « Danger ») : les dégâts des monstres suivent leur rang et leur niveau (src/data/danger.json) ; le champ dmg du json n'est plus lu
for (const d of Object.values(GAME_DATA.monsters)) d.dmg = degatsMonstre(d);
export const ITEMS = items as unknown as ItemsData;
setPotions(ITEMS.resources);   // Forgemagie v2 6A : potions de forgemagie officielles
// objets de maître du jeu (Annobusé de Maître Jarbo…) : officiels mais jamais obtenables, hors du butin (butin.json, horsJeu)
for (const id of Object.keys(butin.horsJeu)) if (ITEMS.equipment[id]) ITEMS.equipment[id].horsJeu = true;
/** Familiers officiels (src/data/familiers.json, familiers_export.py) : courbe d'XP et familiers, dont ceux d'apparat. */
export const FAMILIERS = familiers as unknown as { xp: number[]; familiers: Record<string, FamilierDef> };
// « Familiers : » 1A + 1C : monstres de la famille (et boss) qui lâchent chaque familier (src/data/familiers_sources.json)
{ const fam = (familiersSources as unknown as { familles: Record<string, string[]> }).familles;
  for (const [id, f] of Object.entries(FAMILIERS.familiers)) if (!f.apparat) { if (fam[id]) f.monstres = fam[id]; else delete f.monstres; } }
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
// succès Cartographe (carte du monde 6D, src/data/carte.json écrit par tools/extraction/carte_peinte.py)
Object.assign(QUETES.succes, (carte as unknown as Pick<QuetesData, 'succes'>).succes);
// « Apparats : » 1C : succès de classe qui donnent les apparats de la classe (src/data/apparats_sources.json) ; ceux des classes pas encore en jeu attendent
// « Familiers : » 6C : succès de la Ménagerie (5, 15, 30, 50 familiers)
Object.assign(QUETES.succes, (familiersSources as unknown as Pick<QuetesData, 'succes'>).succes);
for (const [k, s] of Object.entries((apparatsSources as unknown as { succes: Record<string, QuetesData['succes'][string] & { classe?: string }> }).succes)) if (!s.classe) QUETES.succes[k] = s;
/** Boutiques des PNJ (src/data/boutique.json) : articles et prix en Pépites. */
export const BOUTIQUES = Object.fromEntries(Object.entries(boutique).filter(([k]) => !k.startsWith('_'))) as unknown as Record<string, { id: string; prix: number; v03?: boolean; v04?: boolean; monnaie?: string; apparat?: boolean; apres?: string }[]>;
/** Métiers de récolte (src/data/recoltes.json, écrit par tools/contenu/recoltes.py). */
export const RECOLTES = recoltes as unknown as RecoltesData;
/** Objets d'apparat officiels (src/data/apparat.json, apparat_export.py) : nom, emplacement, case de l'icône sur ui/apparat.webp.
 *  Plus aucun ne s'achète au Marché : leurs sources sont dans src/data/apparats_sources.json (src/sim/apparats.ts). */
export interface ApparatDef { name: string; slot: 'chapeau' | 'cape' | 'bouclier' | 'familier'; icon: number; case: number;
  /** Collection d'apparences (maquette « Équipement en trop » 1C) : coiffe, cape ou bouclier du jeu, débloqué en brisant ou
   *  recyclant son premier exemplaire ; jamais vendu par Tissebelle. */
  collection?: boolean }
export const APPARATS = { ...(apparat as unknown as { cell: number; cols: number; rows: number; objets: Record<string, ApparatDef> }) };
// familiers d'apparat (5A) : leur icône est sur la planche des objets (case -1)
for (const [id, f] of Object.entries(FAMILIERS.familiers)) if (f.apparat) APPARATS.objets[id] = { name: f.nom, slot: 'familier', icon: f.icon, case: -1 };
// « Familiers : » 6B : l'apparence de chaque familier obtenu se débloque (collection, icône sur la planche des objets)
for (const [id, f] of Object.entries(FAMILIERS.familiers)) if (!f.apparat && !APPARATS.objets[id]) APPARATS.objets[id] = { name: f.nom, slot: 'familier', icon: f.icon, case: -1, collection: true };
// collection d'apparences (1C) : les coiffes, capes et boucliers du jeu, icône sur la planche des objets (case -1)
for (const [id, d] of Object.entries(ITEMS.equipment))
  if ((d.slot === 'chapeau' || d.slot === 'cape' || d.slot === 'bouclier') && !APPARATS.objets[id]) APPARATS.objets[id] = { name: d.name, slot: d.slot, icon: d.icon, case: -1, collection: true };

/** Thèmes du Havre-Sac et teintures (Magasin 6B, 6E). */
export const THEMES_HAVRESAC = themes as unknown as ThemesHavreSac;
export const TEINTURES = teintures as unknown as Teintures;
