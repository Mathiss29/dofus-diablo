/** Touches du jeu qu'on peut changer (maquette « Réglages » 3A + 3C) : chaque action a une touche par défaut, la fenêtre des
 *  touches (Options › Touches) en garde une autre dans les réglages. Les touches sont gardées par leur place sur le clavier
 *  (KeyboardEvent.code) : « A » d'un clavier AZERTY est la touche KeyQ. Le nom affiché suit le clavier (AZERTY ou QWERTY). */

export type Clavier = 'azerty' | 'qwerty';
export interface Action { id: string; nom: string; groupe: string; /** touche par défaut : code, ou caractère (lettre) traduit selon le clavier */ def: string }

/** Les actions, dans l'ordre de la fenêtre des touches. En cas de doublon, la première de la liste l'emporte. */
export const ACTIONS: Action[] = [
  ...[1, 2, 3, 4, 5, 6].map(i => ({ id: `sort${i}`, nom: `Sort ${i}`, groupe: 'Combat', def: `Digit${i}` })),
  { id: 'deplacement', nom: 'Déplacement (Bond, Saut…)', groupe: 'Combat', def: 'Space' },
  { id: 'potion', nom: 'Potion', groupe: 'Combat', def: 'E' },
  ...[1, 2, 3, 4].map(i => ({ id: `invoc${i}`, nom: `Invocation ${i} (Osamodas)`, groupe: 'Combat', def: 'AZRT'[i - 1] })),
  { id: 'inventaire', nom: 'Inventaire', groupe: 'Fenêtres', def: 'I' },
  { id: 'caracs', nom: 'Caractéristiques', groupe: 'Fenêtres', def: 'C' },
  { id: 'sorts', nom: 'Sorts', groupe: 'Fenêtres', def: 'S' },
  { id: 'metiers', nom: 'Métiers', groupe: 'Fenêtres', def: 'J' },
  { id: 'bestiaire', nom: 'Bestiaire', groupe: 'Fenêtres', def: 'B' },
  { id: 'dofus', nom: 'Dofus', groupe: 'Fenêtres', def: 'D' },
  { id: 'guide', nom: 'Guide', groupe: 'Fenêtres', def: 'G' },
  { id: 'social', nom: 'Social (groupe)', groupe: 'Fenêtres', def: 'P' },
  { id: 'chat', nom: 'Écrire dans le chat', groupe: 'Fenêtres', def: 'Enter' },
  { id: 'options', nom: 'Options', groupe: 'Fenêtres', def: 'O' },
  { id: 'carte', nom: 'Carte du monde', groupe: 'Fenêtres', def: 'M' },
  { id: 'havresac', nom: 'Havre-Sac', groupe: 'Fenêtres', def: 'H' },
  { id: 'muet', nom: 'Couper ou remettre le son', groupe: 'Divers', def: 'Ctrl+M' },
  { id: 'impact', nom: 'Effets d\'impact', groupe: 'Divers', def: 'F' },
  { id: 'fps', nom: 'Compteur d\'images (FPS)', groupe: 'Divers', def: '' },
];
const PAR_ID = new Map(ACTIONS.map(a => [a.id, a]));

// Lettres qui ne sont pas à la même place en AZERTY et en QWERTY (les autres le sont)
const AZ: Record<string, string> = { A: 'KeyQ', Q: 'KeyA', Z: 'KeyW', W: 'KeyZ', M: 'Semicolon' };
const NOM_AZ: Record<string, string> = { Digit1: '&', Digit2: 'é', Digit3: '"', Digit4: '\'', Digit5: '(', Digit6: '-', Digit7: 'è', Digit8: '_', Digit9: 'ç', Digit0: 'à',
  Minus: ')', Equal: '=', KeyQ: 'A', KeyA: 'Q', KeyW: 'Z', KeyZ: 'W', Semicolon: 'M', KeyM: ',', Comma: ';', Period: ':', Slash: '!', Backquote: '²', BracketLeft: '^', BracketRight: '$', Quote: 'ù', Backslash: '*' };
const NOM_QW: Record<string, string> = { Minus: '-', Equal: '=', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Backquote: '`', BracketLeft: '[', BracketRight: ']', Quote: '\'', Backslash: '\\' };
const NOMS: Record<string, string> = { Space: 'Espace', Tab: 'Tab', CapsLock: 'Verr. Maj', Backspace: 'Retour', ShiftLeft: 'Maj', ShiftRight: 'Maj', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Insert: 'Inser', Delete: 'Suppr', Home: 'Début', End: 'Fin', PageUp: 'Pg préc', PageDown: 'Pg suiv', IntlBackslash: '<' };

/** Clavier détecté (navigateur, puis la première touche tapée), gardé d'une partie à l'autre. */
let detecte: Clavier = (() => { try { return localStorage.getItem('diablofus.clavier') === 'qwerty' ? 'qwerty' : 'azerty'; } catch { return 'azerty'; } })();
let carte: Map<string, string> | null = null;
let choix: 'auto' | Clavier = 'auto';
function noter(c: Clavier) { if (c === detecte) return; detecte = c; try { localStorage.setItem('diablofus.clavier', c); } catch { /* pas de stockage */ } }
(typeof navigator === 'undefined' ? undefined : (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard?.getLayoutMap?.())
  ?.then(m => { carte = m; const q = m.get('KeyQ'); if (q) noter(q === 'a' ? 'azerty' : 'qwerty'); }, () => {});
/** À chaque touche : « a » sur la touche KeyQ = AZERTY. */
export function observer(e: KeyboardEvent) {
  if (e.code === 'KeyQ' && e.key.length === 1) noter(e.key.toLowerCase() === 'a' ? 'azerty' : 'qwerty');
  else if (e.code === 'KeyW' && e.key.length === 1) noter(e.key.toLowerCase() === 'z' ? 'azerty' : 'qwerty');
}
export function regler(c: 'auto' | Clavier) { choix = c; }
export function clavier(): Clavier { return choix === 'auto' ? detecte : choix; }

/** Touche par défaut d'une action (« Ctrl+KeyM »…), selon le clavier. */
export function parDefaut(id: string): string {
  const d = PAR_ID.get(id)?.def ?? '';
  return d.split('+').map(p => p.length === 1 ? (clavier() === 'azerty' && AZ[p] ? AZ[p] : `Key${p}`) : p).join('+');
}
/** Touches des actions : celles choisies dans les réglages, sinon celles par défaut ('' = aucune). */
let choisies: Record<string, string> = {};
export function appliquer(t: Record<string, string> | undefined) { choisies = { ...(t ?? {}) }; }
export function touche(id: string): string { return id in choisies ? choisies[id] : parDefaut(id); }

/** Nom d'une touche seule, tel qu'il est écrit sur le clavier du joueur. */
export function nomCode(code: string): string {
  if (choix === 'auto' && carte?.get(code) && !NOMS[code]) { const c = carte.get(code)!; return c === ' ' ? 'Espace' : c.toUpperCase(); }
  if (NOMS[code]) return NOMS[code];
  const az = clavier() === 'azerty';
  if (az && NOM_AZ[code]) return NOM_AZ[code];
  if (!az && NOM_QW[code]) return NOM_QW[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Pavé ${code.slice(6)}`;
  return code;
}
/** Nom complet (« Alt & », « Ctrl M ») d'une combinaison ; '' = aucune touche. */
export function nom(combo: string): string { return combo ? combo.split('+').map(p => p === 'Ctrl' || p === 'Alt' ? p : nomCode(p)).join(' ') : ''; }
/** Nom de la touche d'une action, pour la barre de sorts, les infobulles et le Guide. */
export function nomAction(id: string): string { return nom(touche(id)); }

/** Combinaison d'un événement clavier (Maj ignorée : elle sert à attaquer sur place). null pour une touche de modification seule. */
export function combo(e: KeyboardEvent): string | null {
  if (/^(Shift|Control|Alt|Meta|OS)/.test(e.code) || !e.code) return null;
  return `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.code}`;
}
/** Action d'un événement clavier : la combinaison exacte d'abord, puis sans Alt ni Ctrl (aperçu avec Alt, etc.). */
export function actionDe(e: KeyboardEvent): string | null {
  const c = combo(e); if (!c) return null;
  const essais = [c, c.replace('Alt+', ''), c.replace('Ctrl+', ''), e.code];
  for (const k of essais) { const a = ACTIONS.find(x => touche(x.id) === k); if (a) return a.id; }
  return null;
}
/** Actions qui partagent une touche avec une autre (affichées en rouge dans la fenêtre des touches). */
export function doublons(): Set<string> {
  const vu = new Map<string, string>(), d = new Set<string>();
  for (const a of ACTIONS) { const k = touche(a.id); if (!k) continue; const o = vu.get(k); if (o) { d.add(o); d.add(a.id); } else vu.set(k, a.id); }
  return d;
}
/** Touches que le jeu garde pour lui : Échap (menu, fermer), Entrée (revenir après une défaite), F1 (outils de test). */
export const RESERVEES = new Set(['Escape', 'Enter', 'F1', 'F11', 'F12']);
