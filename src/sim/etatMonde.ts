// État propre à un joueur dans le monde ouvert (multi, étape 4 : le monde partagé) : où il va, ce qu'il récolte ou fabrique,
// son point de retour, la porte qu'il passe, son Havre-Sac… Chaque Player a le sien ; World y accède par world.player
// (le joueur qui agit pendant son pas), si bien que le code du monde ouvert reste écrit pour « le » joueur.
import type { SubAreaDef } from './defs';
import type { RetourHavreSac, SimEvent } from './events';
import type { PorteEnd } from './world';

export interface EtatMonde {
  versRecolte: number | null;
  approche: { x: number; y: number } | null;
  enRecolte: { id: number; t: number; hp: number } | null;
  /** « Métiers : » 6D : clic maintenu sur une ressource : le perso enchaîne les suivantes de son métier. */
  recolteTenue?: boolean;
  versPoste: number | null;
  approcheP: { x: number; y: number } | null;
  enFabrication: { recette: number; n: number; t: number; hp: number; rare?: string | null } | null;
  checkpoint: { x: number; y: number };
  checkpointName: string;
  area: SubAreaDef | null;
  lieu: string | null;
  calme: { t: number; x: number; y: number } | null;
  portalLock: PorteEnd | null;
  passage: { to: PorteEnd; nom: string; t: number; vers?: { zone: string; arrivee: [string, number] } } | null;
  incantation: { t: number; hp: number } | null;
  retour: RetourHavreSac | null;
  versZaap: string | null;
  versPortail: string | null;
  zaapDepart: { t: number; e: SimEvent } | null;
  avant: { x: number; y: number };
  archeVue: boolean;
}

export const etatMondeNeuf = (): EtatMonde => ({
  versRecolte: null, approche: null, enRecolte: null, versPoste: null, approcheP: null, enFabrication: null,
  checkpoint: { x: 0, y: 0 }, checkpointName: '', area: null, lieu: null, calme: null, portalLock: null, passage: null,
  incantation: null, retour: null, versZaap: null, versPortail: null, zaapDepart: null, avant: { x: 0, y: 0 }, archeVue: false,
});
