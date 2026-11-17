// Mode console (maquette « Interfaces Thor : » 1C+1D 5A 9A, 2026-11-16) : sur un petit écran tenu à la manette (AYN Thor…),
// barre de sorts mini qui se cache hors combat, textes plus grands, réglage « Thor » appliqué au premier lancement.
// Options › Manette › Mode console : auto (petit écran tactile ou manette branchée), oui, non. Le PC ne change pas.
import { appliNative, manetteActive } from './manette';

export type ReglageConsole = 'auto' | 'oui' | 'non';
let reglage: ReglageConsole = 'auto';
let actif: boolean | null = null;

export function reglerModeConsole(r: ReglageConsole | undefined) { reglage = r ?? 'auto'; suivreModeConsole(); }

function manetteBranchee(): boolean {
  try { return [...(navigator.getGamepads?.() ?? [])].some(g => g?.connected); } catch { return false; }
}
/** Petit écran (≤ 720 px CSS de haut) tenu à la main : tactile sans souris, ou manette branchée. */
export function petitEcranConsole(): boolean {
  if (typeof window === 'undefined' || window.innerHeight > 720) return false;
  const tactile = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  return tactile || manetteBranchee() || manetteActive() || !!appliNative();   // « Confort 2 : » 1A : l'appli Thor
}
export function modeConsole(): boolean {
  if (reglage !== 'auto') return reglage === 'oui';
  return petitEcranConsole();
}
/** Pose la classe `console` sur <html> (5A : textes plus grands des fenêtres) ; appelé à chaque image par la scène. */
export function suivreModeConsole(): boolean {
  const m = modeConsole();
  if (m !== actif && typeof document !== 'undefined') { actif = m; document.documentElement.classList.toggle('console', m); }
  return m;
}

/** 9A : réglage « Thor » tout fait (60 images/s, particules coupées, ombres et lueurs allégées), appliqué une fois. */
export const REGLAGE_THOR = { fps: 60, particules: false, lumieres: 0.8, vent: true, eau: true, qualite: 'perso' as const, resolution: 'normale' as const };
/** Version 2 du réglage « Thor » (2026-11-17) : résolution Normale (854×480 au lieu de 1708×960, 4 fois moins de pixels à dessiner,
 *  moins de mémoire), aussi pour ceux qui avaient déjà la version 1. */
export const REGLAGE_THOR_V2 = { resolution: 'normale' as const };

/** « Confort 2 : » 5A : l'interface a sa propre échelle en mode console (celle du PC ne bouge pas). */
export function echelleInterface(r: { echelle: number; echelleConsole?: number }): number {
  return modeConsole() ? Math.max(0.6, Math.min(1.5, r.echelleConsole ?? 1)) : Math.max(0.8, Math.min(1.5, r.echelle || 1));
}

// « Confort 2 : » 2A : l'écran reste allumé pendant une partie (Wake Lock ; l'appli Android le fait aussi de son côté).
type Verrou = { release(): Promise<void>; addEventListener(t: 'release', f: () => void): void };
let verrou: Verrou | null = null, voulu = false, branche = false;
async function majVerrou() {
  const wl = typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<Verrou> } }).wakeLock : undefined;
  if (!wl) return;
  if (voulu && !verrou && document.visibilityState === 'visible') {
    try { const v = await wl.request('screen'); if (!voulu) { void v.release(); return; } verrou = v; v.addEventListener('release', () => { if (verrou === v) verrou = null; }); } catch { /* refusé (économie d'énergie) */ }
  } else if (!voulu && verrou) { const v = verrou; verrou = null; void v.release().catch(() => {}); }
}
export function garderEcranAllume(on: boolean) {
  if (typeof document === 'undefined') return;
  if (!branche) { branche = true; document.addEventListener('visibilitychange', () => void majVerrou()); }
  if (on === voulu) return;
  voulu = on; void majVerrou();
}

// « Confort 2 : » 8A : reprise exacte. Partie cachée en mode console (Thor fermée, appli quittée) : on note le perso ;
// si Chrome ou Android a rechargé la page entre-temps, on relance ce perso tout de suite au lieu de montrer l'accueil.
const CLE_REPRISE = 'diablofus.reprise';
export function noterReprise(slot: number | null) {
  try { if (slot == null) localStorage.removeItem(CLE_REPRISE); else localStorage.setItem(CLE_REPRISE, JSON.stringify({ slot, t: Date.now() })); } catch { /* stockage plein ou bloqué */ }
}
/** Le perso à relancer. Le mot reste jusqu'à ce que la partie ait tourné un moment (une mise à jour qui recharge la page
 *  au lancement ne le perd pas), mais au troisième essai sans succès on l'oublie : un plantage ne bloque jamais sur la partie. */
export function repriseEnAttente(): number | null {
  try {
    const j = JSON.parse(localStorage.getItem(CLE_REPRISE) || 'null') as { slot?: unknown; t?: unknown; n?: unknown } | null;
    if (!j || typeof j.slot !== 'number' || typeof j.t !== 'number' || Date.now() - j.t > 12 * 3600_000 || Number(j.n ?? 0) >= 2) { localStorage.removeItem(CLE_REPRISE); return null; }
    localStorage.setItem(CLE_REPRISE, JSON.stringify({ ...j, n: Number(j.n ?? 0) + 1 }));
    return j.slot;
  } catch { return null; }
}
