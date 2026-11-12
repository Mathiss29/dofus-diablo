/** Thèmes du Havre-Sac (maquette « Magasin : » 6B) et teintures (6E) : achetés en Pépites au Marché, pour tout le compte
 *  (gardés avec le coffre du compte). Chaque thème est un monde à lui (src/data/havresac_themes.json) : la zone « havresac »
 *  prend le monde et les cases du thème choisi. */
import type { ZoneDef } from './defs';
import type { Coffre } from './coffre';

export interface ThemeHavreSac { id: number; nom: string; carte: number; monde?: string; arrivee?: number; arche?: number; poutch?: number; coffre?: number; absent?: boolean }
export interface ThemesHavreSac { prix: number; defaut: number; themes: ThemeHavreSac[] }
export interface Teinture { id: string; nom: string; /** cheveux puis 4 zones de tenue (0xRRGGBB) */ c: number[] }
export interface Teintures { prix: number; teintures: Teinture[] }

/** Thèmes que l'on peut avoir (Spectacle n'a pas de carte dans les fichiers du jeu). */
export const themesEnJeu = (T: ThemesHavreSac) => T.themes.filter(t => !t.absent && t.monde && t.arrivee != null && t.arche != null);
/** Thèmes possédés par le compte (le thème offert en premier). */
export const themesPossedes = (T: ThemesHavreSac, c: Coffre) => [T.defaut, ...(c.themes ?? []).filter(id => id !== T.defaut)];
/** Thème posé dans le Havre-Sac : le choix du compte s'il le possède, sinon le thème offert. */
export function themeChoisi(T: ThemesHavreSac, c: Coffre): ThemeHavreSac {
  const l = themesEnJeu(T), d = l.find(t => t.id === T.defaut)!;
  return (c.theme != null && themesPossedes(T, c).includes(c.theme) && l.find(t => t.id === c.theme)) || d;
}
/** La zone du Havre-Sac habillée du thème : son monde, l'arrivée, l'arche, le Poutch et le coffre du thème. Les autres zones restent telles quelles. */
export function zoneAvecTheme(z: ZoneDef, t: ThemeHavreSac | null | undefined): ZoneDef {
  const o = z.open, h = o?.havreSac;
  if (!o || !h || !t?.monde || t.arrivee == null || t.arche == null) return z;
  return { ...z, open: { ...o, world: t.monde, havreSac: { ...h, arrivee: t.arrivee, arche: t.arche, poutch: t.poutch ?? h.poutch, theme: t.id },
    coffres: (o.coffres ?? []).map(c => ({ ...c, case: t.coffre ?? c.case })) } };
}
