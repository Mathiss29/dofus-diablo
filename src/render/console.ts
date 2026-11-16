// Mode console (maquette « Interfaces Thor : » 1C+1D 5A 9A, 2026-11-16) : sur un petit écran tenu à la manette (AYN Thor…),
// barre de sorts mini qui se cache hors combat, textes plus grands, réglage « Thor » appliqué au premier lancement.
// Options › Manette › Mode console : auto (petit écran tactile ou manette branchée), oui, non. Le PC ne change pas.
import { manetteActive } from './manette';

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
  return tactile || manetteBranchee() || manetteActive();
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
export const REGLAGE_THOR = { fps: 60, particules: false, lumieres: 0.8, vent: true, eau: true, qualite: 'perso' as const };
