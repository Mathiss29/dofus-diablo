/** Nouveaux usages des Pépites (ligne « Apparats : » 5B) : tenues enregistrées, auréoles, effets de Zaap, ornements de nom.
 *  Réglages dans src/data/style.json. Pur style : rien ne change les caractéristiques. */
import data from '../data/style.json';

export interface StyleDef { id: string; nom: string; texte?: string; c?: string; c2?: string; prix: number; avant?: string; apres?: string; couleur?: string;
  /** Vendu à la boutique Ogrines (9E), pas en Pépites. */ ogrines?: number; /** Offert pendant l'abonnement de ce palier ou mieux (17A). */ abo?: string }
export type SorteStyle = 'aureoles' | 'zaaps' | 'ornements';
export const STYLE = data as unknown as { tenues: { offertes: number; prix: number[] } } & Record<SorteStyle, StyleDef[]>;
export const SORTES_STYLE: SorteStyle[] = ['aureoles', 'zaaps', 'ornements'];
/** Ce que le perso porte : une auréole, un effet de Zaap, un ornement de nom (ids de style.json). */
export type StyleChoisi = Partial<Record<SorteStyle, string>>;
/** Tenue enregistrée (garde-robe) : apparats posés et couleurs du perso. */
export interface Tenue { nom: string; apparat: Partial<Record<'chapeau' | 'cape' | 'bouclier' | 'familier', string>>; couleurs?: number[] }
export const styleDef = (sorte: SorteStyle, id: string | undefined) => id ? STYLE[sorte].find(s => s.id === id) : undefined;
/** Places de tenue du perso : celles offertes, plus celles achetées. */
export const placesTenues = (achetees: number) => STYLE.tenues.offertes + Math.max(0, Math.min(achetees, STYLE.tenues.prix.length));
/** Prix de la place suivante, ou null au maximum. */
export const prixPlaceTenue = (achetees: number) => STYLE.tenues.prix[achetees] ?? null;
/** Nom décoré par l'ornement porté. */
export const nomOrne = (nom: string, id: string | undefined) => { const o = styleDef('ornements', id); return o ? `${o.avant ?? ''}${nom}${o.apres ?? ''}` : nom; };
