import DATA from '../data/dofus.json';
import type { Stat } from './items';

/** Les Dofus (version 0.3, ligne « Dofus 0.3 : 1A 2B 3A 4C 5A+5B ») : 31 Dofus officiels (src/data/dofus.json, tools/contenu/dofus.py).
 *  Chaque Dofus est unique : le perso le possède ou non, et en porte jusqu'à 6 (une fois chacun). Stats au jet maximum.
 *  Passifs codés en 0.3 : Argenté et Cacao (quêtes « œuf à reconstituer » du Gawdien du Dofus). Règles des passifs (maquette des Dofus) :
 *  instantanés sur un événement ou en aura, jamais différés ; bouclier 100 % du niveau = 10 % des PV max ; au contact = moins d'une case. */
export interface DofusDef {
  nom: string; niveau: number; icon: number; stats: Partial<Record<Stat, number>>;
  passif?: { nom: string; texte: string };
  /** Clé du passif codé (argente, cacao…). */
  cle?: string;
  /** Passif codé dans le jeu. */
  jeu?: boolean;
  source: string;
}
export const DOFUS = (DATA as unknown as { dofus: Record<string, DofusDef> }).dofus;
/** Trophées (« 0.4 suite : 3A+3B ») : les 85 trophées officiels du niveau 50 (tools/contenu/trophees.py). Ils se portent dans les
 *  emplacements de Dofus, une fois chacun, à partir de leur niveau. Lâchés par un boss de la 0.4 (« boss ») ou fabriqués par le Façonneur. */
export interface TropheeDef { nom: string; niveau: number; icon: number; stats: Partial<Record<Stat, number>>; boss?: string }
export const TROPHEES = (DATA as unknown as { trophees: Record<string, TropheeDef> }).trophees ?? {};
/** Ce qui se porte dans un emplacement de Dofus : un Dofus ou un trophée. */
export const PORTABLE = (id: string): { nom: string; niveau: number; icon: number; stats: Partial<Record<Stat, number>> } | undefined => DOFUS[id] ?? TROPHEES[id];
/** Trophées qu'un boss peut lâcher (3A). */
export const tropheesDuBoss = (boss: string) => Object.keys(TROPHEES).filter(id => TROPHEES[id].boss === boss);
export const DOFUS_ID: Record<string, string> = Object.fromEntries(Object.entries(DOFUS).filter(([, d]) => d.cle).map(([id, d]) => [d.cle!, id]));
export const EMPLACEMENTS_DOFUS = 6;

export const PASSIFS = {
  /** Souvenir d'Argent : sous 20 % de PV, soin instantané de 20 %, recharge 120 s. */
  argente: { seuil: 0.2, soin: 0.2, recharge: 120 },
  /** Bénédiction chocolatée : touché à distance avec un ennemi au contact, bouclier de 2 % des PV max pendant 5 s, au plus 1 fois par seconde. */
  cacao: { bouclier: 0.02, duree: 5, recharge: 1, contact: 48, distance: 96 },
};
