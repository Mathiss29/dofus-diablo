import type { SimEvent } from '../sim/events';
import { RARITIES, type Rarity } from '../sim/items';

/** Ce que l'affichage note de la partie, à partir des événements (il ne modifie rien) : Bestiaire du compte
 *  (choix Accueil 1A), résumé du personnage (4A) et « La dernière fois… » (4C). */

export interface Trouvaille { nom: string; rarete: Rarity }
export interface StatsPerso { vaincus: number; kamas: number; quetes: number; morts: number; meilleur?: Trouvaille }
/** La dernière partie : commencée à l'entrée en jeu, montrée sur l'accueil. */
export interface Session { debut: number; niveau0: number; niveau: number; vaincus: number; quetes: number; elites: string[]; meilleur?: Trouvaille }

export const statsVides = (): StatsPerso => ({ vaincus: 0, kamas: 0, quetes: 0, morts: 0 });
export const nouvelleSession = (niveau: number): Session => ({ debut: Date.now(), niveau0: niveau, niveau, vaincus: 0, quetes: 0, elites: [] });
const mieux = (a: Trouvaille | undefined, b: Trouvaille) => !a || RARITIES.indexOf(b.rarete) > RARITIES.indexOf(a.rarete) ? b : a;

interface Monstres { [id: string]: { name: string; elite?: boolean; boss?: boolean } }
interface Noms { [id: string]: { name: string } }

/** Note un événement. bestiaire : compteur de monstres vaincus du compte. */
export function noter(e: SimEvent, st: StatsPerso, se: Session, bestiaire: Record<string, number>, M: Monstres, objets: Noms) {
  switch (e.k) {
    case 'kill': {
      st.vaincus++; se.vaincus++; bestiaire[e.monster] = (bestiaire[e.monster] ?? 0) + 1;
      const d = M[e.monster];
      if ((d?.elite || d?.boss) && !se.elites.includes(d.name)) se.elites.push(d.name);
      break;
    }
    case 'loot': {
      const t = { nom: objets[e.item.id]?.name ?? 'Objet', rarete: e.item.rarity };
      st.meilleur = mieux(st.meilleur, t); se.meilleur = mieux(se.meilleur, t);
      break;
    }
    case 'lootKamas': st.kamas += e.n; break;
    case 'queteFin': if (!e.sautee) { st.quetes++; se.quetes++; } break;
    case 'levelUp': se.niveau = e.level; break;
    case 'playerDeath': st.morts++; break;
  }
}

// --- Bestiaire du compte, gardé dans le navigateur ------------------------------------------------------------
export const CLE_BESTIAIRE = 'diablofus.bestiaire';
export function lireBestiaire(): Record<string, number> {
  try {
    const b = JSON.parse(localStorage.getItem(CLE_BESTIAIRE) ?? '{}');
    if (!b || typeof b !== 'object' || Array.isArray(b)) return {};
    // sécurité : une sauvegarde importée peut glisser autre chose que des nombres, affichés ensuite dans l'accueil
    return Object.fromEntries(Object.entries(b).filter(([, n]) => typeof n === 'number' && Number.isFinite(n))) as Record<string, number>;
  } catch { return {}; }
}
export function sauverBestiaire(b: Record<string, number>) {
  try { localStorage.setItem(CLE_BESTIAIRE, JSON.stringify(b)); } catch { /* rien */ }
}
/** Paliers du Bestiaire (1A) : croisé = fiche, 10 = sorts, 25 = résistances, 50 = butin. */
export const PALIERS = { sorts: 10, res: 25 };   // butin : visible dès le premier vaincu (maquette « Drops » 3A)
