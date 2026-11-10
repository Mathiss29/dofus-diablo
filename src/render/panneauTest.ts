import { Coop } from './coop';
import { RUNES } from '../sim/forgemagie';
import { GAME_DATA, ITEMS, QUETES } from '../sim/data';
import { DOFUS, PORTABLE } from '../sim/dofus';
import { ALMANAX, jourAlmanax } from '../sim/almanax';
import { ARCHI } from '../sim/world';
import type { EtatJoueur } from '../sim/sauvegarde';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../sim/items';
import { REGLAGES_TEST, RARETES_TEST, type CommandeTest, type GesteQuete, type RangTest, type ReglagesTest } from '../sim/outilsTest';
import type { World } from '../sim/world';
import { iconHtml } from './icons';
import { LOOKS } from './looks';
import { anomaliesButin, lieuxDe, niveauHorsPartie, rangDe, tableButin, tirerButin, type Rang } from '../sim/butin';
import { Rng } from '../sim/math';
import { groupesBestiaire, nomObjet, pct, unSur } from './butinVue';
import { EditeurPlacement } from './placementVue';
import { ERREURS, brancherErreurs, ecouterErreurs, viderErreurs } from './erreursTest';
import { decoderEtat, encoderEtat } from './codeEtat';
import type { Heure } from './ambiance';
import { LEGENDARY } from '../sim/items';
import { POUVOIRS, textePouvoir } from '../sim/pouvoirs';
import { POUVOIRS_CLASSE } from '../sim/pouvoirsClasse';
import type { Element } from '../sim/defs';

/** Une ligne du tableau de butin de l'outil de test (maquette « Drops » 1C, 8A+8B+8C). */
interface LigneDev { m: string; nom: string; rang: Rang; niv: number; zone: string; item: string; objet: string; eq: boolean; off: number; reel: number; cond: string }
type TriDev = 'nom' | 'niv' | 'objet' | 'off' | 'reel';

/** Partie de test (maquette « Test : », 1B 2B) : on y entre par diablofus.com/#test. Le perso de test a son emplacement à lui
 *  dans le navigateur, jamais mélangé avec les 3 vrais persos ; rien n'y compte pour le compte (succès, carnet, bestiaire : 10A). */
export const modeTest = () => location.hash === '#test';

export interface EtatTest {
  classe: string;
  sexe: 'm' | 'f';
  /** Perso de test (absent : tout neuf). */
  etat?: EtatJoueur;
  zone?: string;
  reglages: ReglagesTest;
  /** Ordres à faire dès l'arrivée (états tout prêts, changement de zone choisi dans le panneau). */
  apres?: CommandeTest[];
  /** Sous-zones déjà vues (bandeau de zone). */
  zones?: string[];
  /** Outil test 5A : jour de l'Almanax choisi (AAAA-MM-JJ) ; absent : le vrai jour du PC. */
  jour?: string;
}
const CLE = 'diablofus.test';
export function lireTest(): EtatTest {
  try {
    const t = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    if (t && typeof t === 'object' && GAME_DATA.classes[t.classe]) return { ...t, reglages: { ...REGLAGES_TEST, ...t.reglages } };
  } catch { /* stockage indisponible ou abîmé */ }
  return { classe: 'iop', sexe: 'm', reglages: { ...REGLAGES_TEST } };
}
export function sauverTest(t: EtatTest) {
  try { localStorage.setItem(CLE, JSON.stringify(t)); } catch { /* pas de stockage : le perso de test repartira de zéro */ }
}

/** États tout prêts (9A) : classe, niveau, zone, tenue et carte d'arrivée. */
export interface EtatPret { nom: string; classe: string; niveau: number; zone: string; tenue: Rarity; carte?: [string, string]; apres?: CommandeTest[] }
export const ETATS_PRETS: EtatPret[] = [
  { nom: 'Iop 12 · Incarnam · tenue Commune', classe: 'iop', niveau: 12, zone: 'incarnam', tenue: 'commun' },
  { nom: 'Crâ 20 · Crypte de Kardorim · tenue Épique', classe: 'cra', niveau: 20, zone: 'incarnam', tenue: 'epique', carte: ['arene_crypte', 'Crypte de Kardorim'] },
  { nom: 'Crâ 35 · Astrub · tenue Rare', classe: 'cra', niveau: 35, zone: 'astrub', tenue: 'rare' },
  { nom: 'Iop 30 · Cour du Bouftou Royal · tenue Légendaire', classe: 'iop', niveau: 30, zone: 'astrub', tenue: 'legendaire', carte: ['arene_cour', 'Cour du Bouftou Royal'] },
  // Outil test 9A, 9B
  { nom: 'Iop 20 · Astrub · œuf d\'argent prise', classe: 'iop', niveau: 20, zone: 'astrub', tenue: 'rare', apres: [{ k: 'quete', id: 'oeuf_argent', geste: 'etape', etape: 1 }] },
  { nom: 'Crâ 40 · Astrub · Argenté et Cacao portés', classe: 'cra', niveau: 40, zone: 'astrub', tenue: 'epique', apres: [{ k: 'dofus', id: 'codes', porter: true }] },
];
/** Les états tout prêts, plus un pour chaque classe qui n'en a pas encore (Osamodas, puis le Sacrieur dès son arrivée : 7A, 8A). */
export function etatsPrets(): EtatPret[] {
  const l = [...ETATS_PRETS];
  for (const [k, c] of Object.entries(GAME_DATA.classes)) if (!l.some(e => e.classe === k)) l.push({ nom: `${c.name} 30 · Astrub · tenue Rare`, classe: k, niveau: 30, zone: 'astrub', tenue: 'rare' });
  return l;
}
/** Le vrai jour du PC (AAAA-MM-JJ). */
export const jourDuPC = () => new Date().toLocaleDateString('sv-SE');

/** Un lieu où aller (Aller à, recherche) : carte de la zone, case Dofus en option. */
interface Lieu { zone: string; tag: string; nom: string; case?: number; d: string; groupe: string }

/** Ce que le panneau demande à la scène (qui seule relance la partie ou parle à la simulation). */
export interface ActionsTest {
  envoyer(c: CommandeTest): void;
  /** 4B : même perso, autre classe. */
  classe(id: string): void;
  /** Autre zone : la partie repart là-bas (puis fait ces ordres : aller sur une carte, vers une quête…). */
  zone(id: string, apres?: CommandeTest[]): void;
  pret(i: number): void;
  /** Le prochain clic en jeu pose ces monstres (7A, 7D). */
  poser(p: Pose | null): void;
  nouveau(): void;
  /** Forgemagie (maquette « Forgemagie » 10C) : ouvre la fenêtre du forgemage, où qu'on soit. */
  forge(): void;
  /** Panneau test 8A, 8B : le perso de test tel qu'il est maintenant (null : pas de partie de test), et en recharger un. */
  instantane(): EtatTest | null;
  charger(t: EtatTest): void;
}

/** Un de « Mes états » (8A) : le perso de test gardé sous un nom. */
interface EtatGarde { nom: string; date: string; t: EtatTest }
/** Un favori de la barre rapide (3B). */
type Favori = { nom: string } & ({ k: 'pret'; pret: string } | { k: 'etat'; etat: string } | { k: 'lieu'; lieu: Lieu } | { k: 'carte'; tag: string; carte: string; zone: string } | { k: 'monstre'; type: string });
/** Réglages du panneau gardés dans le navigateur : place, taille, onglet, calques, favoris. */
interface UiTest {
  onglet?: Onglet; x?: number; y?: number; w?: number; h?: number;
  calques?: { aggro: boolean; ia: boolean; perf: boolean; coords: boolean };
  favoris?: Favori[];
}
const CLE_UI = 'diablofus.test.ui', CLE_ETATS = 'diablofus.test.etats';
const lire = <T,>(cle: string, defaut: T): T => { try { const v = JSON.parse(localStorage.getItem(cle) ?? 'null'); return v ?? defaut; } catch { return defaut; } };
const ecrire = (cle: string, v: unknown) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* pas de stockage */ } };
/** Un coup donné (DPS par sort, 6A) ou reçu, et le journal des coups (6B). */
interface Coup { t: number; n: number; sort: string; crit: boolean; el?: Element }
interface LigneJournal { t: number; txt: string; n: number; crit: boolean; recu: boolean }
/** Vitesses du temps (5B, 5C). */
export const VITESSES = [0.25, 0.5, 1, 2, 4] as const;
/** Sorts « hors classe » du DPS par sort. */
const SOURCES: Record<string, string> = { attaque: 'Attaque de base', arme: 'Coup d\'arme', poussee: 'Dommages de poussée', saignement: 'Saignement', renvoi: 'Renvoi de dommages', familier: 'Morsure du familier', invocations: 'Invocations', '': 'Autres (pouvoirs, effets)' };

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
type Pose = { type: string; n: number; rang: RangTest; mannequin: boolean; frappe?: number; res?: Partial<Record<Element, number>> };
type Onglet = 'perso' | 'progression' | 'aller' | 'objets' | 'monstres' | 'combat' | 'butin' | 'placement' | 'multi' | 'debug';
/** Panneau test 1A, 2A, 2B : onglets en colonne ; Combat, Multi et Debug à part (l'ancien onglet Aides est dans Debug). */
const ONGLETS: [Onglet, string][] = [['perso', 'Perso'], ['progression', 'Progression'], ['aller', 'Aller à'], ['objets', 'Objets'], ['monstres', 'Monstres'],
  ['combat', 'Combat'], ['butin', 'Butin'], ['placement', 'Placement'], ['multi', 'Multi'], ['debug', 'Debug']];

const CSS = `
#ptest-barre{position:fixed;bottom:118px;left:50%;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);
 background:#0d0c0ae0;border:1px solid #4a473c;border-radius:4px;padding:3px;box-shadow:0 2px 8px #000a;font:12px Lexend,sans-serif;color:#e8e2d4}
#ptest-barre .lab{position:relative;background:#f0a83a;color:#1b1206;font:12px Rowdies,Lexend,sans-serif;letter-spacing:.1em;padding:4px 9px;border-radius:3px;white-space:nowrap}
#ptest-barre .lab small{font:500 10.5px Lexend,sans-serif;letter-spacing:0;margin-left:6px;opacity:.75}
#ptest-barre .lab i{position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;border-radius:99px;background:#e0302a;color:#fff;font:600 10px/16px Lexend,sans-serif;font-style:normal;text-align:center;letter-spacing:0;padding:0 3px;box-sizing:border-box;cursor:pointer}
#ptest-barre button{all:unset;cursor:pointer;padding:3px 8px;border:1px solid #3d3b33;border-radius:3px;background:#1d1c18;white-space:nowrap;font-size:11.5px}
#ptest-barre button:hover{border-color:#b9e54b}
#ptest-barre button.on{border-color:#b9e54b;background:#4c6e17;color:#fff}
#ptest-barre button.fav{color:#ffd34a}
#ptest-barre button:focus-visible{outline:1px solid #b9e54b}
#ptest-perf{position:fixed;top:132px;left:12px;z-index:11;pointer-events:none;background:#000b;border:1px solid #3d3b33;border-radius:3px;padding:5px 8px;font:500 11.5px/1.45 Lexend,sans-serif;color:#dfe9c8;font-variant-numeric:tabular-nums;white-space:pre}
#ptest-perf[hidden]{display:none}
#ptest{position:fixed;top:56px;right:12px;bottom:190px;width:min(460px,calc(100vw - 24px));min-width:320px;min-height:260px;max-width:calc(100vw - 8px);max-height:calc(100vh - 8px);z-index:11;
 display:grid;grid-template-rows:38px auto minmax(0,1fr);grid-template-columns:84px minmax(0,1fr);box-sizing:border-box;resize:both;overflow:hidden;
 background:#24221dee url(assets/ui/d3/block_background_second.jpg) center/cover;border:1px solid #0b0a07;border-radius:4px;box-shadow:0 12px 40px #000c;
 font:13px Lexend,Verdana,sans-serif;color:#e8e2d4}
#ptest[hidden]{display:none}
#ptest .tt{grid-column:1/3;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;background:linear-gradient(#4d4535,#332e23 70%,#2a261d);border-bottom:1px solid #0b0a07;border-radius:4px 4px 0 0;cursor:move;user-select:none}
#ptest .tt b{font:16px Rowdies,Lexend,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
#ptest .tt span{font-size:11px;color:#c9c4ab;white-space:nowrap}
#ptest .ong{grid-row:2/4;display:flex;flex-direction:column;border-right:1px solid #0b0a07;background:#0004;overflow:auto;padding:4px 0}
#ptest .ong button{all:unset;cursor:pointer;color:#c9c4ab;font-size:11px;padding:8px 4px 8px 7px;border-left:2px solid transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ptest .ong button:hover{color:#fff}
#ptest .ong button.on{color:#b9e54b;border-left-color:#b9e54b;background:#2c3a1680}
#ptest .ong button:focus-visible{outline:1px solid #b9e54b}
#ptest .corps{overflow:auto;padding:10px 12px 14px;display:grid;grid-template-columns:minmax(0,1fr);gap:9px;align-content:start;grid-auto-rows:max-content;min-width:0}
#ptest .liste button .star{all:unset;flex:none;color:#6d6a5c;font-size:14px;line-height:1;padding:0 2px;cursor:pointer}
#ptest .liste button .star:hover,#ptest .liste button .star.on{color:#ffd34a}
#ptest .journal{display:grid;gap:1px;font-size:11.5px;max-height:190px;overflow:auto;background:#0004;border:1px solid #2e2c26;border-radius:3px;padding:4px 6px;font-variant-numeric:tabular-nums}
#ptest .journal div{display:grid;grid-template-columns:1fr auto auto;gap:8px}
#ptest .journal .r{color:#ff9a8a}
#ptest .journal .c{color:#ffd34a}
#ptest .tabdps{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}
#ptest .tabdps th,#ptest .tabdps td{padding:2px 4px;border-bottom:1px solid #3a3830;text-align:right;white-space:nowrap}
#ptest .tabdps th:first-child,#ptest .tabdps td:first-child{text-align:left;white-space:normal}
#ptest .tabdps th{color:#c9c4ab;font-weight:500}
#ptest .tabdps .barre{display:block;height:3px;background:#b9e54b;border-radius:2px;margin-top:2px}
#ptest textarea{box-sizing:border-box;width:100%;min-height:54px;background:#1a1915;border:1px solid #3d3b33;color:#e8e2d4;border-radius:3px;font:11px Lexend,monospace;padding:5px;resize:vertical}
#ptest .err{font-size:11.5px;background:#3a1a14;border:1px solid #6b2a22;border-radius:3px;padding:4px 6px;color:#ffb3a8;overflow-wrap:anywhere}
#ptest h4{margin:6px 0 0;font:11px Lexend,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#c9c4ab}
#ptest .l{display:flex;align-items:center;justify-content:space-between;gap:8px}
#ptest input[type=text],#ptest input[type=number],#ptest select{box-sizing:border-box;background:#1a1915;border:1px solid #3d3b33;box-shadow:inset 0 1px 3px #000a;color:#e8e2d4;padding:6px 8px;border-radius:3px;font:13px Lexend,sans-serif}
#ptest input[type=text]{width:100%}
#ptest input[type=number]{width:76px}
#ptest input[type=range]{flex:1;accent-color:#b9e54b}
#ptest select option{background:#2a2823}
#ptest .b{all:unset;cursor:pointer;text-align:center;border:6px solid transparent;border-image:url(assets/ui/d3/btn_green_normal.png) 8 fill/6px;color:#1e2a05;text-shadow:0 1px 0 #e8ff7a;padding:1px 8px;font:12px Rowdies,Lexend,sans-serif;text-transform:uppercase}
#ptest .b:hover{border-image-source:url(assets/ui/d3/btn_green_over.png)}
#ptest .b.g{border-image:none;background:#3a3830;border:1px solid #57554c;color:#e8e2d4;text-shadow:none;padding:5px 8px;border-radius:3px;font:12px Lexend,sans-serif;text-transform:none}
#ptest .b.g:hover{border-color:#b9e54b}
#ptest .b.on{background:#4c6e17;border-color:#b9e54b}
#ptest .b:disabled{opacity:.4;cursor:default}
#ptest .liste{display:grid;gap:3px;grid-template-columns:minmax(0,1fr)}
#ptest .liste button{all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px 7px;background:#1d1c18;border:1px solid #2e2c26;border-radius:3px}
#ptest .liste button:hover{border-color:#b9e54b}
#ptest .liste button.on{border-color:#b9e54b;background:#2c3a16}
#ptest .liste .ic{width:26px;height:26px;flex:none}
#ptest .liste .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ptest .liste .d{color:#9a9580;font-size:11px;white-space:nowrap}
#ptest .rar{display:flex;flex-wrap:wrap;gap:4px}
#ptest .rar button{all:unset;cursor:pointer;padding:3px 7px;border:1px solid #3d3b33;border-radius:99px;font-size:11.5px}
#ptest .rar button.on{border-color:currentColor;background:#0006}
#ptest .inter{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}
#ptest .inter input{width:18px;height:18px;accent-color:#b9e54b;cursor:pointer}
#ptest .note{font-size:11.5px;color:#9a9580;line-height:1.45}
#ptest .dps{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center}
#ptest .dps div{background:#0005;border:1px solid #2e2c26;border-radius:3px;padding:6px 2px}
#ptest .dps b{display:block;font:16px Rowdies,Lexend,sans-serif;color:#ffd34a;font-variant-numeric:tabular-nums}
#ptest .dps span{font-size:10.5px;color:#9a9580}
#ptest.large{width:min(860px,calc(100vw - 24px))}
#ptest .bt{border-collapse:collapse;width:100%;font-size:12px}
#ptest .bt th,#ptest .bt td{padding:3px 5px;border-bottom:1px solid #3a3830;text-align:left;white-space:nowrap}
#ptest .bt th{position:sticky;top:0;background:#2a2823;color:#c9c4ab;font-weight:500;cursor:pointer;user-select:none}
#ptest .bt th.on{color:#b9e54b}
#ptest .bt td.n,#ptest .bt th.n{text-align:right;font-variant-numeric:tabular-nums}
#ptest .bt td .ic{width:20px;height:20px;display:inline-block;vertical-align:middle;margin-right:4px}
#ptest .bt tr.cond td{color:#e0896a}
#ptest .btab{height:min(46vh,480px);overflow:auto;border:1px solid #2e2c26}
#ptest .chips{display:flex;flex-wrap:wrap;gap:4px}
#ptest .sim{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:12px;background:#0004;border:1px solid #2e2c26;border-radius:3px;padding:6px 8px;max-height:30vh;overflow:auto}
#ptest .sim b{font-variant-numeric:tabular-nums;text-align:right}
#ptest .ano{background:#3a1a14;border:1px solid #e0605a;border-radius:3px;padding:6px 8px;color:#ffb3a8;font-size:12px}
#ptest .cherche{padding:7px 12px 0}
#ptest .cases{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
#ptest .cases i.c{aspect-ratio:1;border:1px solid #57554c;border-radius:50%;background:#0006;display:grid;place-items:center;font-style:normal;color:#6d6a5c;overflow:hidden}
#ptest .cases i.c.p{border-color:#b9e54b;background:#2c3a16}
#ptest .cases i.c .ic{width:80%;height:80%}
#ptest .etapes{display:grid;gap:3px}
#ptest .etiq{font-size:10.5px;padding:0 6px;border-radius:99px;border:1px solid #57554c;color:#c9c4ab;white-space:nowrap}
#ptest .etiq.v{border-color:#b9e54b;color:#b9e54b}
#ptest .etiq.o{border-color:#f0a83a;color:#f0a83a}
#ptest .alm{display:flex;align-items:center;gap:6px}
#ptest .alm input[type=date]{flex:1;box-sizing:border-box;background:#1a1915;border:1px solid #3d3b33;color:#e8e2d4;padding:5px 8px;border-radius:3px;font:13px Lexend,sans-serif;color-scheme:dark}
#ptest .pose{background:#3a2a10;border:1px solid #f0a83a;border-radius:3px;padding:6px 8px;color:#ffd9a0;font-size:12px}
`;

/** Panneau de la partie de test (3A) : touche F1, sur le côté droit, aux couleurs des fenêtres de Dofus 3. */
export class PanneauTest {
  private el: HTMLDivElement;
  /** Barre rapide (3A, 3B), avec l'étiquette PARTIE DE TEST et la pastille des erreurs (10B). */
  private barre: HTMLDivElement;
  /** Compteur de fluidité et case sous la souris (4D, 4E). */
  private perf: HTMLDivElement;
  private ui: UiTest = lire<UiTest>(CLE_UI, {});
  /** Calques (4B-4E), lus par la scène. */
  readonly calques = { aggro: false, ia: false, perf: false, coords: false, ...this.ui.calques };
  /** Temps (5A-5C), lu par la scène : pause, image demandée, vitesse. */
  pause = false;
  pasDemande = false;
  vitesse: number = 1;
  /** Heure forcée de l'ambiance (9B), seulement dans la partie de test. */
  heure: Heure = 'auto';
  /** Combat (6A-6D) : fenêtre du DPS, journal des coups, résistances et apparence du mannequin. */
  private fenetre = 10;
  private journal: LigneJournal[] = [];
  private resMannequin: 0 | 25 | 50 | -1 = 0;
  private poutch = true;
  /** Butin (2C) : le tableau ne se calcule qu'à la demande. */
  private butinCalcule = false;
  /** Objets (7A) : recherche d'un pouvoir. */
  private recherchePouvoir = '';
  /** Perso (8B) : message après un code collé. */
  private msgCode = '';
  private finErreurs: () => void;
  private onglet: Onglet = 'perso';
  private auto = true;
  private niveau = 1;
  private rarete: Rarity = 'legendaire';
  private rechercheObjet = '';
  private rechercheMonstre = '';
  private monstre = 'bouftou';
  private nombre = 1;
  private rang: RangTest = 'normal';
  /** Monstres en attente d'être posés au prochain clic. */
  pose: Pose | null = null;
  /** Mannequin qui frappe (8B) : coups par seconde. */
  private frappe = 0;
  /** Dégâts reçus et soins (8C) sur les 10 dernières secondes. */
  private recus: { t: number; n: number }[] = [];
  private soins: { t: number; n: number }[] = [];
  private dernierRecu = 0;
  /** Recherche en haut du panneau (10A). */
  private recherche = '';
  /** Onglet Monstres : seulement les archimonstres (4A). */
  private archis = false;
  /** Onglet Progression : quête choisie, recherche de Dofus. */
  private quete = 'oeuf_argent';
  /** Coups donnés aux monstres (DPS, 7D) : temps de la partie et dégâts. */
  private coups: Coup[] = [];
  private dernierCoup = 0;
  private majT = 0;
  /** Onglet Butin (1C, 8A) : recherche, filtres, tri ; simulateur (8B). */
  private rechercheButin = '';
  private zoneButin = '';
  private typeButin: '' | 'eq' | 'res' | 'cond' = '';
  private triButin: TriDev = 'nom';
  private triDesc = false;
  private simMonstre = 'bouftou';
  private simN = 1000;
  private simRes = '';
  /** Onglet Placement (maquette « Monstres » 2A) : points des groupes de monstres, carte par carte. */
  readonly editeur: EditeurPlacement;
  private carteVue: string | null = null;

  constructor(private world: World, private actions: ActionsTest, private zoneId: string) {
    if (!document.getElementById('ptest-css')) { const st = document.createElement('style'); st.id = 'ptest-css'; st.textContent = CSS; document.head.appendChild(st); }
    for (const id of ['ptest', 'ptest-barre', 'ptest-perf']) document.getElementById(id)?.remove();
    brancherErreurs();
    if (this.ui.onglet && ONGLETS.some(([k]) => k === this.ui.onglet)) this.onglet = this.ui.onglet;
    this.barre = document.createElement('div'); this.barre.id = 'ptest-barre';
    this.perf = document.createElement('div'); this.perf.id = 'ptest-perf'; this.perf.hidden = true;
    this.el = document.createElement('div'); this.el.id = 'ptest'; this.el.hidden = true;
    // Phaser écoute aussi mousedown sur toute la page : sans ça, un clic dans le panneau ouvrait le menu du HUD caché dessous
    for (const el of [this.el, this.barre]) for (const t of ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'contextmenu'] as const) el.addEventListener(t, e => e.stopPropagation());
    // on tape dans le panneau : les touches ne vont pas au jeu (S ouvrirait les sorts...)
    this.el.addEventListener('keydown', e => { if (e.key !== 'F1') e.stopPropagation(); });
    this.el.addEventListener('keyup', e => e.stopPropagation());
    // 3B : l'étoile d'une ligne met ce bouton dans la barre rapide (capture : la ligne elle-même ne réagit pas)
    this.el.addEventListener('click', e => {
      const st = (e.target as HTMLElement).closest<HTMLElement>('.star');
      if (!st) return;
      e.stopPropagation(); e.preventDefault();
      this.basculerFavori(JSON.parse(st.dataset.fav!) as Favori);
    }, true);
    this.placer();
    this.lierDeplacement();
    document.body.append(this.barre, this.perf, this.el);
    this.dessinerBarre();
    this.finErreurs = ecouterErreurs(() => { this.dessinerBarre(); if (this.ouvert && this.onglet === 'debug') this.dessiner(); });
    this.niveau = world.player.level;
    this.editeur = new EditeurPlacement(world, c => actions.envoyer(c), () => { if (this.ouvert && this.onglet === 'placement') this.dessiner(); });
    this.finCoop = Coop.ecouter(() => { const b = this.el.querySelector('.coop'); if (b && this.ouvert) { b.innerHTML = this.coop(); this.lier(); } });
  }
  private finCoop: () => void;
  get ongletPlacement() { return this.onglet === 'placement'; }
  /** Édition du placement en cours : un clic en jeu pose ou retire un point au lieu de faire marcher. */
  get editionPlacement() { return this.ouvert && this.onglet === 'placement' && this.editeur.pose && !!this.world.zone.open; }
  get ouvert() { return !this.el.hidden; }
  basculer() { this.el.hidden = !this.el.hidden; if (!this.el.hidden) { this.niveau = this.world.player.level; this.dessiner(); } }
  private lignesDev: LigneDev[] | null = null;
  destroy() { this.el.remove(); this.barre.remove(); this.perf.remove(); this.editeur.destroy(); this.finCoop(); this.finErreurs(); }

  // --- Place et taille (1B) ------------------------------------------------------------------------------------------
  private placer() {
    const u = this.ui, st = this.el.style;
    if (u.w && u.h) { st.width = `${Math.min(u.w, innerWidth - 8)}px`; st.height = `${Math.min(u.h, innerHeight - 8)}px`; st.bottom = 'auto'; }
    if (u.x != null && u.y != null) {
      st.left = `${Math.max(0, Math.min(u.x, innerWidth - 120))}px`; st.top = `${Math.max(0, Math.min(u.y, innerHeight - 60))}px`; st.right = 'auto';
      if (!u.h) st.bottom = 'auto';
    }
  }
  private sauverUi() { ecrire(CLE_UI, { ...this.ui, calques: this.calques }); }
  /** Le titre attrape le panneau ; le coin en bas à droite change sa taille (resize CSS) ; les deux sont gardés. */
  private lierDeplacement() {
    let d: { dx: number; dy: number } | null = null;
    this.el.addEventListener('pointerdown', e => {
      if (!(e.target as HTMLElement).closest('.tt') || (e.target as HTMLElement).closest('button')) return;
      const r = this.el.getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      this.el.setPointerCapture(e.pointerId);
    });
    this.el.addEventListener('pointermove', e => {
      if (!d) return;
      const x = Math.max(0, Math.min(e.clientX - d.dx, innerWidth - 120)), y = Math.max(0, Math.min(e.clientY - d.dy, innerHeight - 40));
      const r = this.el.getBoundingClientRect(), st = this.el.style;
      st.left = `${x}px`; st.top = `${y}px`; st.right = 'auto'; st.bottom = 'auto'; st.height = `${r.height}px`;
    });
    this.el.addEventListener('pointerup', () => {
      if (!d) return;
      d = null; const r = this.el.getBoundingClientRect();
      this.ui.x = Math.round(r.left); this.ui.y = Math.round(r.top); this.ui.h = Math.round(r.height); this.ui.w = Math.round(r.width); this.sauverUi();
    });
    // fin d'un redimensionnement (poignée du coin) : la taille est gardée
    new ResizeObserver(() => {
      if (this.el.hidden) return;
      const r = this.el.getBoundingClientRect();
      if (Math.abs((this.ui.w ?? 0) - r.width) < 2 && Math.abs((this.ui.h ?? 0) - r.height) < 2) return;
      if (this.ui.w == null && this.ui.x == null && this.onglet === 'butin') return;   // l'onglet Butin élargit tout seul : rien à garder
      this.ui.w = Math.round(r.width); this.ui.h = Math.round(r.height);
      if (this.ui.x == null) { this.ui.x = Math.round(r.left); this.ui.y = Math.round(r.top); }
      this.sauverUi();
    }).observe(this.el);
  }

  // --- Barre rapide (3A) et favoris (3B) --------------------------------------------------------------------------------
  private dessinerBarre() {
    const t = this.world.test, n = ERREURS.reduce((a, e) => a + e.n, 0), fav = this.ui.favoris ?? [];
    const v = this.vitesse === 1 ? '×1' : `×${String(this.vitesse).replace('.', ',')}`;
    this.barre.innerHTML = `<span class="lab" title="Partie de test : F1 ouvre les outils">PARTIE DE TEST<small>F1</small>${n ? `<i data-berr title="Erreurs du jeu : voir l'onglet Debug">${n > 99 ? '99+' : n}</i>` : ''}</span>
      <button type="button" data-binv class="${t?.invincible ? 'on' : ''}" title="Les PV ne baissent pas">Invincible</button>
      <button type="button" data-brec class="${t?.recharges ? 'on' : ''}" title="Sorts relançables tout de suite, PA et PM pleins">Recharges</button>
      <button type="button" data-bsoin title="PV, recharges, PA et PM pleins">Soigner</button>
      <button type="button" data-btuer title="Tous les monstres autour du perso tombent (pas les mannequins)">Tuer la carte</button>
      <button type="button" data-bpause class="${this.pause ? 'on' : ''}" title="F2 : pause ; F3 : image suivante">${this.pause ? '▶ Reprendre' : '⏸ Pause'}</button>
      ${this.pause ? '<button type="button" data-bpas title="F3 : une image">+1 image</button>' : ''}
      <button type="button" data-bvit class="${this.vitesse !== 1 ? 'on' : ''}" title="Vitesse du jeu : ×0,25 à ×4">${v}</button>
      ${fav.map((f, i) => `<button type="button" class="fav" data-bfav="${i}" title="Favori (clic droit : retirer)">★ ${esc(f.nom)}</button>`).join('')}`;
    const q = (sel: string, f: () => void) => { const b = this.barre.querySelector<HTMLElement>(sel); if (b) b.onclick = f; };
    q('[data-binv]', () => this.reglage('invincible', !this.world.test?.invincible));
    q('[data-brec]', () => this.reglage('recharges', !this.world.test?.recharges));
    q('[data-bsoin]', () => this.actions.envoyer({ k: 'soigner' }));
    q('[data-btuer]', () => this.actions.envoyer({ k: 'tuer' }));
    q('[data-bpause]', () => this.basculerPause());
    q('[data-bpas]', () => this.avancerImage());
    q('[data-bvit]', () => { const i = VITESSES.indexOf(this.vitesse as typeof VITESSES[number]); this.changerVitesse(VITESSES[(i + 1) % VITESSES.length]); });
    q('[data-berr]', () => { this.onglet = 'debug'; if (!this.ouvert) this.basculer(); else this.dessiner(); });
    this.barre.querySelectorAll<HTMLElement>('[data-bfav]').forEach(b => {
      const f = fav[+b.dataset.bfav!];
      b.onclick = () => this.lancerFavori(f);
      b.oncontextmenu = e => { e.preventDefault(); this.basculerFavori(f); };
    });
  }
  private reglage(cle: keyof ReglagesTest, on: boolean) {
    this.actions.envoyer({ k: 'reglage', cle, on });
    if (this.world.test) this.world.test[cle] = on;   // affichage tout de suite ; la simulation l'applique au prochain pas
    this.dessinerBarre(); if (this.ouvert) this.dessiner();
  }
  basculerPause() { this.pause = !this.pause; this.pasDemande = false; this.dessinerBarre(); if (this.ouvert && this.onglet === 'debug') this.dessiner(); }
  avancerImage() { if (this.pause) this.pasDemande = true; }
  changerVitesse(v: number) { this.vitesse = v; this.dessinerBarre(); if (this.ouvert && this.onglet === 'debug') this.dessiner(); }
  private cleFav = (f: Favori) => JSON.stringify({ ...f, nom: undefined });
  private estFavori(f: Favori) { const k = this.cleFav(f); return (this.ui.favoris ?? []).some(g => this.cleFav(g) === k); }
  private basculerFavori(f: Favori) {
    const k = this.cleFav(f), l = this.ui.favoris ?? [];
    this.ui.favoris = l.some(g => this.cleFav(g) === k) ? l.filter(g => this.cleFav(g) !== k) : [...l, f].slice(-8);
    this.sauverUi(); this.dessinerBarre();
    if (this.ouvert) { const c = this.el.querySelector('.corps'); const top = c?.scrollTop ?? 0; this.dessiner(); const c2 = this.el.querySelector('.corps'); if (c2) c2.scrollTop = top; }
  }
  /** Étoile d'un bouton de liste (3B). */
  private star(f: Favori) { const on = this.estFavori(f); return `<span class="star ${on ? 'on' : ''}" role="button" aria-label="${on ? 'Retirer de' : 'Ajouter à'} la barre rapide" title="${on ? 'Retirer de' : 'Ajouter à'} la barre rapide" data-fav="${esc(JSON.stringify(f))}">${on ? '★' : '☆'}</span>`; }
  private lancerFavori(f: Favori) {
    if (f.k === 'pret') { const i = etatsPrets().findIndex(e => e.nom === f.pret); if (i >= 0) this.actions.pret(i); }
    else if (f.k === 'etat') { const e = this.etats().find(x => x.nom === f.etat); if (e) this.actions.charger(e.t); }
    else if (f.k === 'lieu') this.allerLieu(f.lieu);
    else if (f.k === 'carte') { const c: CommandeTest = { k: 'aller', tag: f.tag, nom: f.carte }; if (f.zone === this.zoneId) this.actions.envoyer(c); else this.actions.zone(f.zone, [c]); }
    else { this.monstre = f.type; this.pose = { type: f.type, n: this.nombre, rang: this.rang, mannequin: false }; this.actions.poser(this.pose); if (this.ouvert) this.dessiner(); }
  }

  // --- Mes états (8A) et code d'état (8B) -------------------------------------------------------------------------------
  private etats(): EtatGarde[] { return lire<EtatGarde[]>(CLE_ETATS, []); }
  private garderEtat(nom: string) {
    const t = this.actions.instantane(); if (!t || !nom.trim()) return;
    const l = this.etats().filter(e => e.nom !== nom.trim());
    l.unshift({ nom: nom.trim().slice(0, 40), date: new Date().toLocaleDateString('fr-FR'), t });
    ecrire(CLE_ETATS, l.slice(0, 10)); this.dessiner();
  }
  private oublierEtat(nom: string) { ecrire(CLE_ETATS, this.etats().filter(e => e.nom !== nom)); this.dessiner(); }
  private async copierCode() {
    const t = this.actions.instantane(); if (!t) return;
    const code = await encoderEtat(t), ta = this.el.querySelector<HTMLTextAreaElement>('#pt-code');
    if (ta) { ta.value = code; ta.select(); }
    try { await navigator.clipboard.writeText(code); this.msgCode = `Code copié (${code.length} caractères) : colle-le à un testeur ou dans Discord.`; }
    catch { this.msgCode = 'Code prêt dans la case : Ctrl+C pour le copier.'; }
    const m = this.el.querySelector('#pt-codemsg'); if (m) m.textContent = this.msgCode;
  }
  private async chargerCode(code: string) {
    const t = await decoderEtat<EtatTest>(code);
    if (!t || !t.classe || !GAME_DATA.classes[t.classe]) { this.msgCode = 'Ce n\'est pas un code d\'état (il commence par DF1.).'; const m = this.el.querySelector('#pt-codemsg'); if (m) m.textContent = this.msgCode; return; }
    this.msgCode = ''; this.actions.charger({ ...t, reglages: { ...REGLAGES_TEST, ...t.reglages } });
  }

  // --- Rapport de bug (10A) ------------------------------------------------------------------------------------------
  private rapport(): string {
    const w = this.world, p = w.player, wg = w.worldGrid, ici = wg ? wg.caseLocale(wg.cellAtWorld(p.x, p.y)) : null;
    const reg = Object.entries(w.test ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'aucun';
    const tenue = Object.entries(p.equipment).filter(([, it]) => it).map(([, it]) => `${ITEMS.equipment[it!.id]?.name ?? it!.id} (${RARITY_NAMES[it!.rarity]})`).join(', ') || 'rien';
    const err = ERREURS.slice(-8).map(e => `  ${e.t} ${e.msg}${e.n > 1 ? ` (×${e.n})` : ''}`).join('\n') || '  aucune';
    return [`**Bug Diablofus (partie de test)**`, `Version : ${location.host}${location.pathname} · ${new Date().toLocaleString('fr-FR')}`,
      `Navigateur : ${navigator.userAgent.match(/(Firefox|Edg|OPR|Chrome|Safari)\/[\d.]+/)?.[0] ?? navigator.userAgent.slice(0, 60)} · écran ${innerWidth}×${innerHeight}`,
      `Lieu : ${w.zone.name}${ici ? ` · carte [${ici.x},${ici.y}] (${ici.tag}) case ${ici.c}` : ''}${w.area ? ` · ${w.area.name}` : ''}`,
      `Perso : ${p.cls.name} niveau ${p.level} · PV ${Math.round(p.hp)}/${p.maxHp} · ${p.dofusPortes.filter(Boolean).length} Dofus portés`,
      `Tenue : ${tenue}`, `Réglages de test : ${reg}`, `Dernières erreurs :`, err, `Ce qui s'est passé : `].join('\n');
  }
  private async copierRapport() {
    const r = this.rapport(), ta = this.el.querySelector<HTMLTextAreaElement>('#pt-rapport');
    if (ta) { ta.value = r; ta.hidden = false; ta.select(); }
    let ok = true; try { await navigator.clipboard.writeText(r); } catch { ok = false; }
    const m = this.el.querySelector('#pt-rapmsg'); if (m) m.textContent = ok ? 'Rapport copié : colle-le dans le forum des bugs sur Discord, puis décris ce qui s\'est passé.' : 'Rapport prêt dans la case : Ctrl+C pour le copier.';
  }

  // --- Coups et compteurs ------------------------------------------------------------------------------------------------
  private nomSort(id: string) { return this.world.player.cls.spells[id]?.name ?? SOURCES[id] ?? id; }
  /** Un coup donné à un monstre (événement « hit » de la simulation) : DPS, DPS par sort (6A), journal (6B). */
  noterCoup(e: { amount: number; crit: boolean; sort?: string; element?: Element; id?: number }) {
    const t = this.world.time, sort = e.sort ?? '';
    this.coups.push({ t, n: e.amount, sort, crit: e.crit, el: e.element }); this.dernierCoup = e.amount;
    const m = e.id != null ? this.world.monsters.find(x => x.id === e.id) : null;
    this.ajouterJournal({ t, txt: `${this.nomSort(sort)} → ${m?.def.name ?? 'monstre'}`, n: e.amount, crit: e.crit, recu: false });
  }
  /** Un coup reçu par le perso (8C) : le monstre le plus proche est sans doute celui qui frappe. */
  noterRecu(e: { amount: number; element?: Element; x: number; y: number }) {
    const t = this.world.time; this.recus.push({ t, n: e.amount }); this.dernierRecu = e.amount;
    let qui = 'un monstre', d = Infinity;
    for (const m of this.world.monsters) { if (m.dead) continue; const k = Math.hypot(m.x - e.x, m.y - e.y); if (k < d) { d = k; qui = m.def.name; } }
    this.ajouterJournal({ t, txt: `${qui} → toi${e.element && e.element !== 'neutre' ? ` (${e.element})` : ''}`, n: e.amount, crit: false, recu: true });
  }
  private ajouterJournal(l: LigneJournal) { this.journal.push(l); if (this.journal.length > 50) this.journal.shift(); }
  /** Compteur de fluidité (4D) et case sous la souris (4E), à chaque image. */
  majPerf(txt: string | null) { this.perf.hidden = !txt; if (txt && this.perf.textContent !== txt) this.perf.textContent = txt; }
  noterSoin(n: number) { this.soins.push({ t: this.world.time, n }); }
  /** Quatre fois par seconde : compteur de DPS. */
  maj(now: number, force = false) {
    const t0 = this.world.time - 60;   // une minute gardée : DPS sur 10 s, 30 s ou 1 min (6A)
    for (const l of [this.coups, this.recus, this.soins]) while (l.length && l[0].t < t0) l.shift();
    // Placement : la fiche suit la carte où l'on marche
    if (this.ouvert && this.onglet === 'placement') { const c = this.editeur.carte(); if (c !== this.carteVue) { this.carteVue = c; this.dessiner(); } }
    if (!this.ouvert || this.onglet !== 'combat' || (!force && now - this.majT < 250)) return;
    this.majT = now;
    const t1 = this.world.time - this.fenetre, coups = this.coups.filter(c => c.t >= t1), recus = this.recus.filter(c => c.t >= t1), soins = this.soins.filter(c => c.t >= t1);
    const total = coups.reduce((a, c) => a + c.n, 0), d = coups.length ? Math.max(1, this.world.time - coups[0].t) : 1;
    const box = this.el.querySelector('.dps');
    const f = `${this.fenetre === 60 ? '1 min' : `${this.fenetre} s`}`;
    if (box) box.innerHTML = `<div><b>${Math.round(total / d)}</b><span>DPS</span></div><div><b>${total.toLocaleString('fr-FR')}</b><span>dégâts sur ${f}</span></div><div><b>${this.dernierCoup}</b><span>dernier coup</span></div>`;
    const somme = (l: { n: number }[]) => l.reduce((a, c) => a + c.n, 0), rc = this.el.querySelector('.recu');
    if (rc) rc.innerHTML = `<div><b>${somme(recus)}</b><span>reçus sur ${f}</span></div><div><b>${somme(soins)}</b><span>soins sur ${f}</span></div><div><b>${this.dernierRecu}</b><span>dernier coup reçu</span></div>`;
    // 6A : sort par sort
    const ps = this.el.querySelector('#pt-parsort');
    if (ps) {
      const par = new Map<string, { n: number; k: number; c: number; el?: Element }>();
      for (const c of coups) { const x = par.get(c.sort) ?? { n: 0, k: 0, c: 0, el: c.el }; x.n += c.n; x.k++; if (c.crit) x.c++; par.set(c.sort, x); }
      const l = [...par.entries()].sort((a, b) => b[1].n - a[1].n), max = l[0]?.[1].n ?? 1;
      ps.innerHTML = l.length ? `<table class="tabdps"><thead><tr><th>Sort</th><th>Dégâts</th><th>Part</th><th>Coups</th><th>Crit.</th></tr></thead><tbody>${l.map(([k, x]) =>
        `<tr><td>${esc(this.nomSort(k))}${x.el && x.el !== 'neutre' ? ` <span class="note">${x.el}</span>` : ''}<span class="barre" style="width:${Math.round(x.n / max * 100)}%"></span></td><td>${x.n.toLocaleString('fr-FR')}</td><td>${Math.round(x.n / Math.max(1, total) * 100)} %</td><td>${x.k}</td><td>${Math.round(x.c / x.k * 100)} %</td></tr>`).join('')}</tbody></table>`
        : '<p class="note">Frappe un mannequin ou des monstres : chaque sort apparaît ici.</p>';
    }
    const jr = this.el.querySelector('#pt-journal');
    if (jr) jr.innerHTML = this.journal.length ? this.journal.slice().reverse().map(j => `<div class="${j.recu ? 'r' : ''}"><span>${esc(j.txt)}</span><b>${j.n}</b><span class="c">${j.crit ? 'crit.' : ''}</span></div>`).join('') : '<span class="note">Aucun coup pour l\'instant.</span>';
  }
  /** La partie a changé (ordre du panneau, quête) : l'onglet Progression et la recherche se remettent à jour. */
  rafraichir() {
    if (!this.ouvert || (this.onglet !== 'progression' && !this.recherche)) return;
    if (!this.recherche) { this.dessiner(); return; }
    const c = this.el.querySelector('.corps'); if (c) c.innerHTML = this.contenu(); this.lier();
  }
  /** Le clic qui posait les monstres a été fait. */
  posee() { this.pose = null; this.actions.poser(null); if (this.ouvert) this.dessiner(); }

  private dessiner() {
    this.el.classList.toggle('large', this.onglet === 'butin' && this.ui.w == null);
    this.el.innerHTML = `<div class="tt"><b>Outils de test</b><span>glisser pour déplacer · F1 pour fermer</span></div>
      <div class="ong" role="tablist" aria-orientation="vertical">${ONGLETS.map(([k, n]) => `<button type="button" role="tab" data-o="${k}" class="${this.onglet === k ? 'on' : ''}" aria-selected="${this.onglet === k}" title="${n}">${n}</button>`).join('')}</div>
      <div class="cherche"><input type="text" id="pt-cherche" placeholder="Chercher partout : cacao, gawdien, bonta, archi…" value="${esc(this.recherche)}" autocomplete="off"></div>
      <div class="corps">${this.contenu()}</div>`;
    this.el.querySelectorAll<HTMLElement>('[data-o]').forEach(b => b.onclick = () => { this.onglet = b.dataset.o as Onglet; this.ui.onglet = this.onglet; this.sauverUi(); this.recherche = ''; this.dessiner(); });
    const ch = this.el.querySelector<HTMLInputElement>('#pt-cherche');
    if (ch) ch.oninput = () => { this.recherche = ch.value; const c = this.el.querySelector('.corps'); if (c) c.innerHTML = this.contenu(); this.lier(); };
    this.lier();
  }
  private contenu() { return this.recherche.trim().length >= 2 ? this.resultats() : this[this.onglet](); }
  /** Branche les boutons du corps du panneau (après chaque dessin du corps). */
  private lier() {
    const p = this.world.player;
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(s);
    const tous = (s: string, f: (b: HTMLElement) => void) => this.el.querySelectorAll<HTMLElement>(s).forEach(b => { b.onclick = () => f(b); });
    // Perso
    const rg = q<HTMLInputElement>('#pt-niv'), nb = q<HTMLInputElement>('#pt-nivn');
    if (rg && nb) {
      rg.oninput = () => { nb.value = rg.value; this.niveau = +rg.value; };
      nb.oninput = () => { this.niveau = Math.max(1, Math.min(200, Math.round(+nb.value || 1))); rg.value = String(this.niveau); };
    }
    const au = q<HTMLInputElement>('#pt-auto'); if (au) au.onchange = () => { this.auto = au.checked; };
    tous('[data-niv]', () => this.actions.envoyer({ k: 'niveau', n: this.niveau, auto: this.auto }));
    tous('[data-classe]', b => { if (GAME_DATA.classes[b.dataset.classe!] !== p.cls) this.actions.classe(b.dataset.classe!); });
    tous('[data-pret]', b => this.actions.pret(+b.dataset.pret!));
    tous('[data-nouveau]', () => this.actions.nouveau());
    // Aller à
    tous('[data-carte]', b => this.actions.envoyer({ k: 'aller', tag: b.dataset.carte!, nom: b.dataset.nom ?? '' }));
    tous('[data-zone]', b => this.actions.zone(b.dataset.zone!));
    tous('[data-lieu]', b => this.allerLieu(this.lieux()[+b.dataset.lieu!]));
    // Progression (2A-2D, 3A-3E, 5A-5B, 4B-4C)
    tous('[data-dofus]', b => this.actions.envoyer({ k: 'dofus', id: b.dataset.dofus!, porter: true }));
    tous('[data-dremplir]', () => this.actions.envoyer({ k: 'dofusRemplir' }));
    tous('[data-dvider]', () => this.actions.envoyer({ k: 'dofusVider' }));
    tous('[data-qsel]', b => { this.quete = b.dataset.qsel!; this.onglet = 'progression'; this.recherche = ''; this.dessiner(); });
    tous('[data-qetape]', b => this.actions.envoyer({ k: 'quete', id: this.quete, geste: 'etape', etape: +b.dataset.qetape! }));
    tous('[data-qgeste]', b => this.gesteQuete(b.dataset.qgeste as GesteQuete));
    tous('[data-jour]', b => this.changerJour(b.dataset.jour === '+' ? 1 : b.dataset.jour === '-' ? -1 : 0));
    const dj = q<HTMLInputElement>('#pt-jour'); if (dj) dj.onchange = () => { if (/^\d{4}-\d{2}-\d{2}$/.test(dj.value)) this.envoyerJour(dj.value); };
    tous('[data-offrande]', () => this.actions.envoyer({ k: 'offrande' }));
    tous('[data-archis]', () => { this.archis = true; this.onglet = 'monstres'; this.recherche = ''; this.dessiner(); });
    tous('[data-marchis]', b => { this.archis = b.dataset.marchis === '1'; this.dessiner(); });
    tous('[data-frappe]', b => { this.frappe = +b.dataset.frappe!; this.dessiner(); });
    tous('[data-renvoyer]', () => this.actions.envoyer({ k: 'renvoyer' }));
    tous('[data-ong]', b => { this.onglet = b.dataset.ong as Onglet; this.recherche = ''; this.dessiner(); });
    // Objets
    const ro = q<HTMLInputElement>('#pt-obj');
    if (ro) ro.oninput = () => { this.rechercheObjet = ro.value; const l = q('#pt-objl'); if (l) l.innerHTML = this.listeObjets(); this.lierObjets(); };
    this.lierObjets();
    tous('[data-rar]', b => { this.rarete = b.dataset.rar as Rarity; this.dessiner(); });
    tous('[data-tenue]', () => this.actions.envoyer({ k: 'tenue', rarete: this.rarete }));
    tous('[data-forge]', () => this.actions.forge());
    tous('[data-kamas]', b => this.actions.envoyer({ k: 'kamas', n: +b.dataset.kamas! }));
    tous('[data-res]', b => { const [id, n] = b.dataset.res!.split(':'); for (const i of id.split(',')) this.actions.envoyer({ k: 'objet', id: i, rarete: 'commun', n: +n }); });
    // Monstres
    const rm = q<HTMLInputElement>('#pt-mon');
    if (rm) rm.oninput = () => { this.rechercheMonstre = rm.value; const l = q('#pt-monl'); if (l) l.innerHTML = this.listeMonstres(); this.lierMonstres(); };
    this.lierMonstres();
    // le monstre choisi est visible dans sa liste (avant : la liste montrait les 8 premiers, Bouftou caché plus bas)
    const ch = q<HTMLElement>('#pt-monl button.on'), lm = q<HTMLElement>('#pt-monl');
    if (ch && lm) lm.scrollTop = ch.offsetTop - lm.clientHeight / 2 + ch.offsetHeight / 2;
    tous('[data-nb]', b => { this.nombre = +b.dataset.nb!; this.dessiner(); });
    tous('[data-rang]', b => { this.rang = b.dataset.rang as RangTest; this.dessiner(); });
    tous('[data-poser]', b => {
      const m = b.dataset.poser === 'm', type = m && this.poutch && GAME_DATA.monsters.poutch_ingball ? 'poutch_ingball' : this.monstre;
      const els: Element[] = ['terre', 'feu', 'eau', 'air', 'neutre'], rm = this.resMannequin;
      const res = !m ? undefined : rm === -1 ? { ...GAME_DATA.monsters[this.monstre]?.res } : Object.fromEntries(els.map(e => [e, rm]));
      this.pose = { type, n: m ? 1 : this.nombre, rang: m ? 'normal' : this.rang, mannequin: m, ...(m && this.frappe ? { frappe: this.frappe } : {}), ...(res ? { res } : {}) };
      this.actions.poser(this.pose); this.dessiner();
    });
    // Combat (6A-6D)
    tous('[data-fen]', b => { this.fenetre = +b.dataset.fen!; this.dessiner(); });
    tous('[data-resm]', b => { this.resMannequin = +b.dataset.resm! as 0 | 25 | 50 | -1; this.dessiner(); });
    tous('[data-poutch]', b => { this.poutch = b.dataset.poutch === '1'; this.dessiner(); });
    tous('[data-jvider]', () => { this.journal = []; this.coups = []; this.recus = []; this.soins = []; this.dessiner(); });
    // Objets (7A, 7C)
    tous('[data-vider]', () => this.actions.envoyer({ k: 'viderSac' }));
    tous('[data-pouvoir]', b => this.actions.envoyer({ k: 'pouvoir', id: b.dataset.pouvoir! }));
    const rp = q<HTMLInputElement>('#pt-pouv');
    if (rp) rp.oninput = () => { this.recherchePouvoir = rp.value; const l = q('#pt-pouvl'); if (l) l.innerHTML = this.listePouvoirs(); tous('[data-pouvoir]', b => this.actions.envoyer({ k: 'pouvoir', id: b.dataset.pouvoir! })); };
    // Mes états (8A, 8B)
    const ne = q<HTMLInputElement>('#pt-nometat');
    tous('[data-garder]', () => { if (ne) this.garderEtat(ne.value || `${p.cls.name} ${p.level}`); });
    if (ne) ne.onkeydown = e => { if (e.key === 'Enter') this.garderEtat(ne.value || `${p.cls.name} ${p.level}`); };
    tous('[data-etat]', b => { const e = this.etats().find(x => x.nom === b.dataset.etat); if (e) this.actions.charger(e.t); });
    this.el.querySelectorAll<HTMLElement>('[data-oublier]').forEach(b => b.onclick = e => { e.stopPropagation(); this.oublierEtat(b.dataset.oublier!); });
    tous('[data-codecopier]', () => { void this.copierCode(); });
    tous('[data-codecharger]', () => { const ta = q<HTMLTextAreaElement>('#pt-code'); if (ta) void this.chargerCode(ta.value); });
    // Aller à (9A) : arène à la vague voulue
    tous('[data-vague]', b => { const [tag, v] = b.dataset.vague!.split('|'); this.actions.envoyer({ k: 'aller', tag, nom: b.dataset.nom ?? '', vague: +v }); });
    // Debug (4, 5, 9B, 9C, 10)
    this.el.querySelectorAll<HTMLInputElement>('[data-cal]').forEach(i => i.onchange = () => { this.calques[i.dataset.cal as keyof PanneauTest['calques']] = i.checked; this.sauverUi(); });
    tous('[data-dpause]', () => this.basculerPause());
    tous('[data-dpas]', () => this.avancerImage());
    tous('[data-vit]', b => this.changerVitesse(+b.dataset.vit!));
    tous('[data-heure]', b => { this.heure = b.dataset.heure as Heure; this.dessiner(); });
    tous('[data-repeupler]', () => this.actions.envoyer({ k: 'repeupler' }));
    tous('[data-bsoin2]', () => this.actions.envoyer({ k: 'soigner' }));
    tous('[data-rapport]', () => { void this.copierRapport(); });
    tous('[data-errvider]', () => viderErreurs());
    // Butin (2C)
    tous('[data-calculer]', () => { this.butinCalcule = true; this.lignesDev = null; this.dessiner(); });
    tous('[data-annuler]', () => this.posee());
    tous('[data-retirer]', () => this.actions.envoyer({ k: 'retirer' }));
    tous('[data-allies-retirer]', () => this.actions.envoyer({ k: 'alliesRetirer' }));
    tous('[data-allie]', b => this.actions.envoyer({ k: 'allie', classe: b.dataset.allie! }));
    // Coop (maquette « Multi : » 11A) : salon à code sur le serveur
    tous('[data-coop-creer]', () => Coop.creer());
    tous('[data-coop-serveur]', () => Coop.creer(true));
    tous('[data-coop-monde]', () => Coop.creer(true, null, true));
    tous('[data-coop-quitter]', () => Coop.quitter());
    const cc = q<HTMLInputElement>('#pt-coop');
    const rejoindre = () => { if (cc) Coop.rejoindre(cc.value); };
    if (cc) cc.onkeydown = e => { if (e.key === 'Enter') rejoindre(); };
    tous('[data-coop-rejoindre]', rejoindre);
    // Butin (1C, 8A+8B+8C)
    const rb = q<HTMLInputElement>('#pt-but');
    if (rb) rb.oninput = () => { this.rechercheButin = rb.value; const t = q('#pt-butt'); if (t) t.innerHTML = this.tableDev(); this.lierTri(); };
    this.lierTri();
    tous('[data-bz]', b => { this.zoneButin = b.dataset.bz!; this.dessiner(); });
    tous('[data-bt]', b => { this.typeButin = b.dataset.bt as '' | 'eq' | 'res' | 'cond'; this.dessiner(); });
    const sm = q<HTMLSelectElement>('#pt-simm'); if (sm) sm.onchange = () => { this.simMonstre = sm.value; };
    tous('[data-simn]', b => { this.simN = +b.dataset.simn!; this.dessiner(); });
    tous('[data-sim]', () => { this.simuler(); this.dessiner(); });
    // Aides et course / murs
    this.el.querySelectorAll<HTMLInputElement>('[data-reg]').forEach(i => i.onchange = () => this.reglage(i.dataset.reg as keyof ReglagesTest, i.checked));
    if (this.onglet === 'placement') this.editeur.lier(this.el);
    this.el.querySelectorAll('select').forEach(s => s.addEventListener('keydown', e => e.stopPropagation()));
    this.maj(this.majT, true);
  }
  private lierObjets() {
    this.el.querySelectorAll<HTMLElement>('[data-objet]').forEach(b => b.onclick = () => {
      const id = b.dataset.objet!, eq = !!ITEMS.equipment[id];
      this.actions.envoyer({ k: 'objet', id, rarete: this.rarete, n: eq ? 1 : 10 });
    });
  }
  private lierMonstres() {
    this.el.querySelectorAll<HTMLElement>('[data-mon]').forEach(b => b.onclick = () => { this.monstre = b.dataset.mon!; if (this.recherche) { this.recherche = ''; this.onglet = 'monstres'; } this.dessiner(); });
  }
  private inter(cle: keyof ReglagesTest, nom: string, aide: string) {
    const on = !!this.world.test?.[cle];
    return `<label class="inter"><span>${nom}<br><span class="note">${aide}</span></span><input type="checkbox" data-reg="${cle}" ${on ? 'checked' : ''}></label>`;
  }

  private perso() {
    const p = this.world.player;
    // la ligne des classes passe à la ligne (avant : la 6e classe sortait du cadre)
    return `<h4>Classe</h4><div class="chips">${Object.entries(GAME_DATA.classes).map(([k, c]) =>
      `<button type="button" class="b g ${p.cls === c ? 'on' : ''}" data-classe="${k}">${esc(c.name)}</button>`).join('')}</div>
      <p class="note">Changer de classe garde le niveau, le sac, l'équipement et la position ; les sorts sont ceux de la nouvelle classe.</p>
      <div class="l"><span>Niveau</span><input type="number" id="pt-nivn" min="1" max="200" value="${this.niveau}"></div>
      <div class="l"><input type="range" id="pt-niv" min="1" max="200" value="${this.niveau}"></div>
      <label class="inter"><span>Points répartis tout seuls<br><span class="note">Tous dans la caractéristique de l'élément principal ; à replacer dans C si besoin.</span></span><input type="checkbox" id="pt-auto" ${this.auto ? 'checked' : ''}></label>
      <button type="button" class="b" data-niv>Passer au niveau ${this.niveau}</button>
      <h4>États tout prêts</h4>
      <div class="liste">${etatsPrets().map((e, i) => `<button type="button" data-pret="${i}">${this.star({ nom: e.nom.split(' · ').slice(0, 2).join(' '), k: 'pret', pret: e.nom })}<span class="n">${esc(e.nom)}</span><span class="d">▶</span></button>`).join('')}</div>
      <p class="note">Un état tout prêt remplace le perso de test (sac, niveau, quêtes). L'étoile le met dans la barre rapide.</p>
      <h4>Mes états</h4>
      <div class="l"><input type="text" id="pt-nometat" maxlength="40" placeholder="${esc(`${p.cls.name} ${p.level}`)} Rage, avant le boss…" autocomplete="off"><button type="button" class="b" data-garder>Garder</button></div>
      ${this.etats().length ? `<div class="liste">${this.etats().map(e => `<button type="button" data-etat="${esc(e.nom)}">${this.star({ nom: e.nom, k: 'etat', etat: e.nom })}<span class="n">${esc(e.nom)}</span><span class="d">${esc(GAME_DATA.classes[e.t.classe]?.name ?? e.t.classe)} · ${e.date}</span><span class="d" data-oublier="${esc(e.nom)}" role="button" title="Oublier cet état">✕</span></button>`).join('')}</div>`
        : '<p class="note">Garde le perso tel qu\'il est (classe, niveau, tenue, Dofus, quêtes, lieu) pour y revenir en un clic. 10 places.</p>'}
      <h4>Code d'état</h4>
      <textarea id="pt-code" placeholder="Colle ici un code DF1.… reçu d'un testeur" spellcheck="false"></textarea>
      <div class="l" style="justify-content:flex-start;gap:4px"><button type="button" class="b g" data-codecopier>Copier mon état</button><button type="button" class="b g" data-codecharger>Charger le code</button></div>
      <p class="note" id="pt-codemsg">${esc(this.msgCode) || 'Le code contient tout le perso de test : envoie-le pour montrer un bug dans le même état.'}</p>
      <button type="button" class="b g" data-nouveau>Nouveau perso de test (niveau 1)</button>`;
  }

  private aller() {
    const w = this.world, wg = w.worldGrid, open = w.zone.open;
    let ici = '';
    if (wg && open) {
      const bouton = (tag: string, nom: string, d: string) => `<button type="button" data-carte="${tag}" data-nom="${esc(nom)}">${this.star({ nom, k: 'carte', tag, carte: nom, zone: this.zoneId })}<span class="n">${esc(nom)}</span><span class="d">${d}</span></button>`;
      const zaaps = open.checkpoints.map(c => { const m = wg.mapByCoords(c.map[0], c.map[1]); return m ? bouton(m.tag, c.name, `Zaap [${c.map.join(',')}]`) : ''; }).join('');
      // 9A : chaque donjon, à la salle ou à la vague voulue (arène : vague N, ou directement le boss)
      const puce = (attr: string, nom: string, txt: string) => `<button type="button" class="b g" ${attr} data-nom="${esc(nom)}">${txt}</button>`;
      const donjons = (open.donjons ?? []).map(d => {
        const cl = w.couloirs(d), t = cl ? cl.salles[0] : d.arene?.tag ?? Object.keys(d.salles)[0];   // en couloirs : la salle 1
        if (!t || !wg.mapByTag(t)) return '';
        const n = d.vagues?.length ?? 0;
        const etapes = cl ? [...cl.salles.map((s, i) => puce(`data-carte="${s}"`, `${d.nom}, salle ${i + 1}`, `Salle ${i + 1}`)), d.arene && wg.mapByTag(d.arene.tag) ? puce(`data-carte="${d.arene.tag}"`, d.nom, 'Cour du boss') : ''].join('')
          : d.arene && n ? [...Array.from({ length: n }, (_, i) => puce(`data-vague="${d.arene!.tag}|${i + 1}"`, d.nom, `Vague ${i + 1}`)), puce(`data-vague="${d.arene.tag}|${n + 1}"`, d.nom, 'Boss')].join('') : '';
        return `${bouton(t, d.nom, cl ? 'donjon en couloirs' : 'donjon')}${etapes ? `<div class="chips" style="margin:0 0 4px 22px">${etapes}</div>` : ''}`;
      }).join('');
      const noms = new Set((open.donjons ?? []).map(d => d.nom));
      const sous = Object.entries(open.subareas).filter(([, s]) => !noms.has(s.name)).sort((a, b) => a[1].level - b[1].level).map(([id, s]) => {
        const maps = wg.world.maps.filter(m => String(m.sub) === id && (wg.freeByMap.get(m.tag)?.length ?? 0) > 20);
        const dehors = maps.filter(m => !m.inside), l = dehors.length ? dehors : maps;
        if (!l.length) return '';
        // la carte la plus au milieu de la sous-zone
        const cx = l.reduce((a, m) => a + m.x, 0) / l.length, cy = l.reduce((a, m) => a + m.y, 0) / l.length;
        const m = l.reduce((a, b) => Math.hypot(b.x - cx, b.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? b : a);
        return bouton(m.tag, s.name, `niv. ${s.level} · [${m.x},${m.y}]`);
      }).join('');
      ici = `<h4>${esc(w.zone.name)} : Zaaps</h4><div class="liste">${zaaps}</div>
        <h4>Sous-zones</h4><div class="liste">${sous}</div>
        ${donjons ? `<h4>Donjons (sans clé)</h4><div class="liste">${donjons}</div>` : ''}`;
    }
    const autres = Object.entries(GAME_DATA.zones).filter(([k]) => k !== this.zoneId).map(([k, z]) =>
      `<button type="button" data-zone="${k}"><span class="n">${esc(z.name)}</span><span class="d">${z.open ? `monde ouvert · niv. ${z.level}` : `vagues · niv. ${z.level}`}</span></button>`).join('');
    const lieux = this.lieux(), groupe = (g: string, titre: string) => {
      const l = lieux.map((x, i) => [x, i] as const).filter(([x]) => x.groupe === g);
      return l.length ? `<h4>${titre}</h4><div class="liste" style="max-height:200px;overflow:auto">${l.map(([x, i]) => this.boutonLieu(x, i)).join('')}</div>` : '';
    };
    return `${ici}${groupe('pnj', 'PNJ')}${groupe('atelier', 'Ateliers')}${groupe('bastion', 'Bastion des Douze')}${groupe('portail', 'Portails entre zones')}
      <h4>Autres zones</h4><div class="liste">${autres}</div>
      <h4>Déplacement</h4>
      ${this.inter('course', 'Course ×3', 'Le perso court trois fois plus vite.')}
      ${this.inter('murs', 'Traverser les murs', 'Le clic va tout droit, à travers le décor et l\'eau.')}`;
  }

  private listeObjets() {
    const r = sansAccent(this.rechercheObjet.trim()), mots = r.split(/\s+/), va = (nom: string) => { const n = sansAccent(nom); return mots.every(m => n.includes(m)); };
    if (r.length < 2) return '<p class="note">Tape au moins 2 lettres : équipements et ressources officiels.</p>';
    const eq = Object.entries(ITEMS.equipment).filter(([, d]) => va(d.name)).sort((a, b) => a[1].level - b[1].level)
      .map(([id, d]) => ({ id, nom: d.name, icon: d.icon, d: `niv. ${d.level} · ${d.slot}` }));
    const res = Object.entries(ITEMS.resources).filter(([, d]) => va(d.name))
      .map(([id, d]) => ({ id, nom: d.name, icon: d.icon, d: 'ressource ×10' }));
    const l = [...eq, ...res].slice(0, 40);
    if (!l.length) return '<p class="note">Aucun objet de ce nom.</p>';
    return l.map(o => `<button type="button" data-objet="${o.id}">${iconHtml(o.icon)}<span class="n">${esc(o.nom)}</span><span class="d">${o.d}</span></button>`).join('');
  }
  private objets() {
    const cles = Object.entries(ITEMS.resources).filter(([, d]) => d.cle).map(([id]) => id).join(',');
    const rappel = Object.entries(ITEMS.resources).filter(([, d]) => d.rappel).map(([id]) => id).join(',');
    const pepite = Object.entries(ITEMS.resources).filter(([, d]) => d.pepite).map(([id]) => id).join(',');
    // forgemagie (10C) : la plus petite rune de chaque caractéristique, et les autres paliers
    const parStat = new Map<string, string[]>();
    for (const id of Object.keys(RUNES)) parStat.set(RUNES[id].stat, [...(parStat.get(RUNES[id].stat) ?? []), id]);
    const tri = [...parStat.values()].map(l => l.sort((a, b) => RUNES[a].val - RUNES[b].val));
    const petites = tri.map(l => l[0]).join(','), grosses = tri.flatMap(l => l.slice(1)).join(',');
    return `<h4>Rareté des équipements</h4>
      <div class="rar">${RARETES_TEST.map(r => `<button type="button" data-rar="${r}" class="${this.rarete === r ? 'on' : ''}" style="color:${RARITY_COLORS[r]}">${RARITY_NAMES[r]}</button>`).join('')}</div>
      <button type="button" class="b" data-tenue>Tenue complète du niveau (${RARITY_NAMES[this.rarete]})</button>
      <p class="note">Le meilleur objet de chaque emplacement jusqu'au niveau du perso (les objets s'arrêtent au niveau 25 pour l'instant).</p>
      <h4>Chercher un objet</h4>
      <input type="text" id="pt-obj" placeholder="coiffe bouftou, clef, rappel..." value="${esc(this.rechercheObjet)}" autocomplete="off">
      <div class="liste" id="pt-objl">${this.listeObjets()}</div>
      <h4>Pouvoir légendaire au choix</h4>
      <input type="text" id="pt-pouv" placeholder="épée, flèche, bond, gourde, ${esc(this.world.player.cls.name.toLowerCase())}…" value="${esc(this.recherchePouvoir)}" autocomplete="off">
      <div class="liste" id="pt-pouvl" style="max-height:220px;overflow:auto">${this.listePouvoirs()}</div>
      <p class="note">Un objet Légendaire de l'emplacement du pouvoir arrive dans le sac, avec ce pouvoir-là (meilleur jet pour les pouvoirs de classe).</p>
      <h4>Monnaies et consommables</h4>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b g" data-kamas="100000">+100 000 kamas</button>
        <button type="button" class="b g" data-res="${pepite}:500">+500 Pépites</button>
        <button type="button" class="b g" data-res="${cles}:3">Clés de donjon ×3</button>
        <button type="button" class="b g" data-res="${rappel}:10">Potions de Rappel ×10</button>
        <button type="button" class="b g" data-vider>Vider le sac</button>
      </div>
      <h4>Forgemagie</h4>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b" data-forge>Ouvrir la forgemagie</button>
        <button type="button" class="b g" data-res="${petites}:30">Petites runes ×30</button>
        <button type="button" class="b g" data-res="${grosses}:5">Runes Pa et Ra ×5</button>
        <button type="button" class="b g" data-res="7508:3">Runes de Signature ×3</button>
      </div>
      <span class="note">La fenêtre de Malek (Bastion des Douze), ouverte d'ici : pose des runes, passe une commande (prête en 3 secondes en test), brise au Concasseur.</span>`;
  }

  /** 7A : pouvoirs de la classe jouée d'abord (officiels puis inventés), puis ceux de toutes les classes, puis les pouvoirs maison. */
  private listePouvoirs() {
    const cl = this.world.player.cls.sorts, r = sansAccent(this.recherchePouvoir.trim()), mots = r.split(/\s+/).filter(Boolean);
    const va = (t: string) => { const x = sansAccent(t); return mots.every(m => x.includes(m)); };
    const L: { id: string; nom: string; d: string; ordre: number }[] = [];
    for (const [c, l] of Object.entries(POUVOIRS)) for (const o of l) L.push({ id: o.id, nom: `${o.sort} : ${textePouvoir(o)}`, d: `${c} · ${o.slot}`, ordre: c === cl ? 0 : 2 });
    for (const o of POUVOIRS_CLASSE) L.push({ id: o.id, nom: `${o.nom} : ${o.texte(o.jet[1])}`, d: `${o.classe} · ${o.slot}`, ordre: o.classe === cl ? 1 : 3 });
    for (const [id, o] of Object.entries(LEGENDARY)) L.push({ id, nom: `${o.name} : ${o.text(o.max)}`, d: 'toutes classes', ordre: 4 });
    const l = L.filter(x => va(`${x.nom} ${x.d}`)).sort((a, b) => a.ordre - b.ordre).slice(0, 60);
    return l.length ? l.map(x => `<button type="button" data-pouvoir="${x.id}" title="${esc(x.nom)}"><span class="n">${esc(x.nom)}</span><span class="d">${esc(x.d)}</span></button>`).join('') : '<p class="note">Aucun pouvoir de ce nom.</p>';
  }
  private static monstres() {
    return Object.entries(GAME_DATA.monsters).filter(([, d]) => LOOKS[d.look]);
  }
  private listeMonstres() {
    const r = sansAccent(this.rechercheMonstre.trim());
    const l = PanneauTest.monstres().filter(([, d]) => (!this.archis || d.archiDe) && (!r || sansAccent(d.name).includes(r)))
      .sort((a, b) => (a[1].level ?? 0) - (b[1].level ?? 0));   // toute la liste : le monstre choisi y est toujours
    if (!l.length) return '<p class="note">Aucun monstre de ce nom.</p>';
    return l.map(([k, d]) => `<button type="button" data-mon="${k}" class="${this.monstre === k ? 'on' : ''}">${this.star({ nom: d.name, k: 'monstre', type: k })}<span class="n">${esc(d.name)}</span><span class="d">${d.boss ? 'boss · ' : d.elite ? 'élite · ' : ''}niv. ${d.level ?? '?'}</span></button>`).join('');
  }
  private monstres() {
    const d = GAME_DATA.monsters[this.monstre], nom = d ? esc(d.name) : '?';
    const pose = this.poseHtml(nom);
    const ch = (v: string, n: string, on: boolean) => `<button type="button" class="b g ${on ? 'on' : ''}" data-marchis="${v}">${n}</button>`;
    return `${pose}<div class="l" style="justify-content:flex-start">${ch('0', 'Tous', !this.archis)}${ch('1', 'Archimonstres', this.archis)}</div>
      <input type="text" id="pt-mon" placeholder="bouftou, kardorim, chafer..." value="${esc(this.rechercheMonstre)}" autocomplete="off">
      <div class="l"><span>Choisi : <b>${nom}</b>${d ? ` <span class="note">niv. ${d.level ?? '?'}${d.boss ? ' · boss' : d.elite ? ' · élite' : ''}</span>` : ''}</span></div>
      <div class="liste" id="pt-monl" style="max-height:220px;overflow:auto;position:relative">${this.listeMonstres()}</div>
      <div class="l"><span>Nombre</span><span style="display:flex;gap:4px">${[1, 3, 6, 10].map(n => `<button type="button" class="b g ${this.nombre === n ? 'on' : ''}" data-nb="${n}">${n}</button>`).join('')}</span></div>
      <div class="l"><span>Rang</span><span style="display:flex;gap:4px">${([['normal', 'Normal'], ['elite', 'Élite'], ['boss', 'Boss']] as const).map(([k, n]) => `<button type="button" class="b g ${this.rang === k ? 'on' : ''}" data-rang="${k}">${n}</button>`).join('')}</span></div>
      <p class="note">Élite : PV et XP ×3, attaques annoncées au sol. Boss : PV et XP ×10. L'étoile d'un monstre le met dans la barre rapide.</p>
      <button type="button" class="b" data-poser="n">Poser ${this.nombre} × ${nom}</button>
      <button type="button" class="b g" data-retirer>Retirer les monstres posés</button>
      <p class="note">Le mannequin, les compteurs de DPS et le journal des coups sont dans l'onglet Combat.</p>`;
  }
  private poseHtml(nom: string) {
    return this.pose ? `<div class="pose">Clique au sol pour poser ${this.pose.mannequin ? 'le mannequin' : `${this.pose.n} × ${nom}`}. <button type="button" class="b g" data-annuler>Annuler</button></div>` : '';
  }
  /** Panneau test 6A-6D : mannequin (Poutch Ingball, résistances), DPS sort par sort, journal des coups. */
  private combat() {
    const d = GAME_DATA.monsters[this.monstre], nom = d ? esc(d.name) : '?';
    const pou = !!GAME_DATA.monsters.poutch_ingball && this.poutch, qui = pou ? 'Poutch Ingball' : nom;
    const puce = (attr: string, v: string | number, txt: string, on: boolean) => `<button type="button" class="b g ${on ? 'on' : ''}" ${attr}="${v}">${txt}</button>`;
    return `${this.poseHtml(qui)}<h4>Mannequin</h4>
      <div class="l"><span>Apparence</span><span class="chips">${puce('data-poutch', '1', 'Poutch Ingball', pou)}${puce('data-poutch', '0', nom, !pou)}</span></div>
      <div class="l"><span>Résistances</span><span class="chips">${puce('data-resm', 0, '0 %', this.resMannequin === 0)}${puce('data-resm', 25, '25 %', this.resMannequin === 25)}${puce('data-resm', 50, '50 %', this.resMannequin === 50)}${puce('data-resm', -1, `comme ${nom}`, this.resMannequin === -1)}</span></div>
      <div class="l"><span>Le mannequin frappe</span><span style="display:flex;gap:4px">${[[0, 'Non'], [1, '1/s'], [3, '3/s'], [10, '10/s']].map(([n, t]) => `<button type="button" class="b g ${this.frappe === n ? 'on' : ''}" data-frappe="${n}">${t}</button>`).join('')}</span></div>
      <button type="button" class="b" data-poser="m">Poser le mannequin (${qui}, increvable et immobile${this.frappe ? `, ${this.frappe} coup${this.frappe > 1 ? 's' : ''}/s` : ''})</button>
      <p class="note">Résistances dans les 5 éléments (plafond officiel 50 %), ou celles du monstre choisi dans l'onglet Monstres. Le mannequin qui frappe tape quand tu es à moins de 5 cases.</p>
      <h4>Compteurs</h4>
      <div class="l"><span>Sur</span><span class="chips">${puce('data-fen', 10, '10 s', this.fenetre === 10)}${puce('data-fen', 30, '30 s', this.fenetre === 30)}${puce('data-fen', 60, '1 min', this.fenetre === 60)}</span></div>
      <div class="dps"></div>
      <div class="dps recu"></div>
      <h4>Sort par sort</h4>
      <div id="pt-parsort"></div>
      <h4>Journal des coups</h4>
      <div class="journal" id="pt-journal"></div>
      <div class="l" style="justify-content:flex-start;gap:4px"><button type="button" class="b g" data-jvider>Remettre les compteurs à zéro</button><button type="button" class="b g" data-retirer>Retirer les monstres posés</button></div>`;
  }
  /** Panneau test 2A : alliés de test et salons de coop. */
  private multi() {
    return `<h4>Alliés (essai du multi)</h4>
      <div class="l" style="justify-content:flex-start;flex-wrap:wrap;gap:4px">${Object.entries(GAME_DATA.classes).map(([k, d]) => `<button type="button" class="b g" data-allie="${k}">+ ${esc(d.name)}</button>`).join('')}</div>
      <p class="note">Un 2e joueur à ton niveau, conduit par le jeu : il te suit et frappe les monstres réveillés. 3 alliés au plus.</p>
      <button type="button" class="b g" data-allies-retirer>Retirer les alliés</button>
      <h4>Jouer à plusieurs (essai)</h4>
      <div class="coop">${this.coop()}</div>`;
  }
  /** Coop (maquette « Multi : » 3A, 11A) : créer un salon, ou rejoindre celui d'un ami avec son code. */
  private coop() {
    const c = Coop;
    if (c.etat === 'connexion') return '<p class="note">Connexion au serveur…</p>';
    if (c.etat === 'salon' && c.hote) return `<div class="l"><span>Code du salon</span><b style="font-size:20px;letter-spacing:3px;user-select:all">${esc(c.code ?? '')}</b></div>
      <p class="note">${c.nbJoueurs} joueur${c.nbJoueurs > 1 ? 's' : ''} sur 4. Ton ami ouvre sa partie de test (diablofus.com/#test), F1 › Multi, et tape ce code : son perso arrive à côté de toi. La partie tourne chez toi.</p>
      <button type="button" class="b g" data-coop-quitter>Fermer le salon</button>`;
    if (c.etat === 'salon' && c.serveur) return `<div class="l"><span>Code du salon</span><b style="font-size:20px;letter-spacing:3px;user-select:all">${esc(c.code ?? '')}</b></div>
      <p class="note">La partie tourne sur le serveur, dans l'arène de la Crypte de Kardorim. Tes amis tapent ce code (2 à 4 joueurs) ; chacun peut partir sans couper les autres. Rien n'est gardé ici pour l'instant.</p>
      <button type="button" class="b g" data-coop-quitter>Quitter le salon</button>`;
    if (c.etat === 'salon') return `<p class="note">Salon <b>${esc(c.code ?? '')}</b> : tu joues dans la partie de l'hôte, avec ton perso. Rien n'est gardé ici, tu retrouves ta partie en quittant.</p>
      <button type="button" class="b g" data-coop-quitter>Quitter le salon</button>`;
    return `${c.erreur ? `<p class="note" style="color:#ff9a5a">${esc(c.erreur)}</p>` : ''}
      <div class="l" style="justify-content:flex-start;gap:4px"><button type="button" class="b" data-coop-creer>Créer un salon</button><button type="button" class="b g" data-coop-serveur>Partie sur le serveur</button><button type="button" class="b g" data-coop-monde title="Incarnam tenu par le serveur : chacun sa place et ses quêtes">Incarnam partagé</button></div>
      <div class="l"><input type="text" id="pt-coop" maxlength="5" placeholder="Code d'un ami" autocomplete="off" style="text-transform:uppercase;width:140px"><button type="button" class="b g" data-coop-rejoindre>Rejoindre</button></div>
      <p class="note">Premier essai de la coop : 2 à 4 joueurs, les monstres et le butin sont chez l'hôte. Bon terrain : une arène de donjon (Crypte de Kardorim).</p>`;
  }
  /** Toutes les lignes de butin du jeu, avec la chance réelle pour le perso de test (sa Prospection, son Chasseur). */
  private lignes(): LigneDev[] {
    const w = this.world, out: LigneDev[] = [];
    for (const [m, d] of Object.entries(GAME_DATA.monsters)) {
      const niv = niveauHorsPartie(m, GAME_DATA), rang = rangDe(d), lieu = lieuxDe(m, GAME_DATA)[0];
      const t = tableButin(w.contexteButin(m, rang, niv));
      for (const l of t.officiel) out.push({ m, nom: d.name, rang, niv, zone: lieu ? `${GAME_DATA.zones[lieu.zone]?.name ?? lieu.zone}${lieu.donjon ? ' · donjon' : ''}` : '?', item: l.d.item,
        objet: nomObjet(l.d.item), eq: l.equipement, off: l.d.chance / 100, reel: l.etat === 'ok' ? l.chance : 0,
        cond: l.etat === 'evenement' ? 'événement' : l.etat === 'quete' ? 'quête de Dofus' : l.d.metier ? `Chasseur ${l.d.metier.min}${l.etat === 'metier' ? ' (manque)' : ''}` : '' });
    }
    return out;
  }
  private tableDev() {
    const r = sansAccent(this.rechercheButin.trim()), mots = r.split(/\s+/).filter(Boolean);
    const l = (this.lignesDev ??= this.lignes()).filter(x => {
      if (this.zoneButin === 'donjon' ? !x.zone.endsWith('donjon') : this.zoneButin && !x.zone.startsWith(this.zoneButin)) return false;
      if (this.typeButin === 'eq' && !x.eq) return false;
      if (this.typeButin === 'res' && x.eq) return false;
      if (this.typeButin === 'cond' && !x.cond.match(/événement|quête/)) return false;
      const t = sansAccent(`${x.nom} ${x.objet}`);
      return mots.every(m => t.includes(m));
    });
    const k = this.triButin, sg = this.triDesc ? -1 : 1;
    l.sort((a, b) => sg * (typeof a[k] === 'number' ? (a[k] as number) - (b[k] as number) : String(a[k]).localeCompare(String(b[k]))) || a.nom.localeCompare(b.nom) || b.off - a.off);
    const th = (c: TriDev, n: string, num = false) => `<th data-tri="${c}" class="${num ? 'n ' : ''}${k === c ? 'on' : ''}">${n}${k === c ? (this.triDesc ? ' ▼' : ' ▲') : ''}</th>`;
    const rows = l.slice(0, 600).map(x => `<tr class="${x.cond.match(/événement|quête/) ? 'cond' : ''}"><td>${esc(x.nom)}${x.rang !== 'normal' ? ` <span class="d">${x.rang === 'boss' ? 'boss' : 'élite'}</span>` : ''}</td><td class="n">${x.niv}</td><td>${iconHtml((ITEMS.resources[x.item] ?? ITEMS.equipment[x.item])?.icon ?? 0)}${esc(x.objet)}</td>
      <td>${x.eq ? 'équip.' : 'ress.'}</td><td class="n">${pct(x.off)}</td><td class="n">${x.reel ? pct(x.reel) : '—'}</td><td class="n">${x.reel ? unSur(x.reel) : ''}</td><td>${esc(x.cond)}</td></tr>`).join('');
    return `<table class="bt"><thead><tr>${th('nom', 'Monstre')}${th('niv', 'Niv.', true)}${th('objet', 'Objet')}<th>Type</th>${th('off', 'Dofus', true)}${th('reel', 'Pour toi', true)}<th class="n">Soit</th><th>Condition</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">Aucune ligne.</td></tr>'}</tbody></table>${l.length > 600 ? `<p class="note">${l.length - 600} lignes de plus : affine la recherche.</p>` : ''}`;
  }
  private lierTri() {
    this.el.querySelectorAll<HTMLElement>('[data-tri]').forEach(b => b.onclick = () => {
      const c = b.dataset.tri as TriDev; if (this.triButin === c) this.triDesc = !this.triDesc; else { this.triButin = c; this.triDesc = c === 'off' || c === 'reel'; }
      const t = this.el.querySelector('#pt-butt'); if (t) t.innerHTML = this.tableDev(); this.lierTri();
    });
  }
  /** 8B : tue N fois le monstre choisi avec le vrai calcul du butin (src/sim/butin.ts), à part de la partie (graine fixe). */
  private simuler() {
    const d = GAME_DATA.monsters[this.simMonstre]; if (!d) return;
    const ctx = this.world.contexteButin(this.simMonstre, rangDe(d), niveauHorsPartie(this.simMonstre, GAME_DATA)), rng = new Rng(1234);
    const res: Record<string, number> = {}, rar: Record<string, number> = {}; let kamas = 0, uid = 1;
    for (let i = 0; i < this.simN; i++) {
      const b = tirerButin(rng, ctx, () => uid++);
      for (const r of b.ressources) res[r.id] = (res[r.id] ?? 0) + 1;
      for (const o of b.objets) rar[o.rarity] = (rar[o.rarity] ?? 0) + 1;
      kamas += b.kamas;
    }
    const lr = Object.entries(res).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span>${esc(nomObjet(id))}</span><b>${n.toLocaleString('fr-FR')}</b>`).join('');
    const lo = RARETES_TEST.concat().reverse().filter(r => rar[r]).map(r => `<span style="color:${RARITY_COLORS[r]}">Équipements ${RARITY_NAMES[r]}</span><b>${rar[r]}</b>`).join('');
    this.simRes = `<span><b style="text-align:left">${this.simN.toLocaleString('fr-FR')} × ${esc(d.name)}</b> (Prospection ${ctx.prospection}, niv. ${ctx.niveau})</span><b></b>${lr}${lo || '<span>Aucun équipement</span><b>0</b>'}<span>Kamas</span><b>${kamas.toLocaleString('fr-FR')}</b>`;
  }
  private butin() {
    const ano = anomaliesButin(ITEMS, GAME_DATA), zones = [...new Set(groupesBestiaire().map(g => g.zone))];
    const chip = (attr: string, v: string, n: string, on: boolean) => `<button type="button" class="b g ${on ? 'on' : ''}" ${attr}="${v}">${n}</button>`;
    const mons = Object.entries(GAME_DATA.monsters).filter(([k]) => ITEMS.drops[k]?.length).sort((a, b) => a[1].name.localeCompare(b[1].name));
    return `${ano.length ? `<div class="ano">${ano.length} anomalie${ano.length > 1 ? 's' : ''} : ${ano.slice(0, 6).map(a => `${a.k} ${a.monstre}${a.item ? ` (${a.item})` : ''}`).join(', ')}</div>` : ''}
      <input type="text" id="pt-but" placeholder="bouftou, laine, sang…" value="${esc(this.rechercheButin)}" autocomplete="off">
      <div class="chips">${chip('data-bz', '', 'Toutes zones', !this.zoneButin)}${zones.map(z => chip('data-bz', z, z, this.zoneButin === z)).join('')}${chip('data-bz', 'donjon', 'Donjons', this.zoneButin === 'donjon')}</div>
      <div class="chips">${chip('data-bt', '', 'Tout', !this.typeButin)}${chip('data-bt', 'eq', 'Équipements', this.typeButin === 'eq')}${chip('data-bt', 'res', 'Ressources', this.typeButin === 'res')}${chip('data-bt', 'cond', 'Quête ou événement', this.typeButin === 'cond')}</div>
      ${this.butinCalcule ? `<div class="btab" id="pt-butt">${this.tableDev()}</div>` : `<div class="l"><span class="note">Le tableau de tout le butin du jeu se calcule à la demande (quelques secondes : le jeu se fige pendant ce temps).</span><button type="button" class="b" data-calculer>Calculer</button></div>`}
      ${this.butinCalcule ? '<button type="button" class="b g" data-calculer>Recalculer (après un changement de Prospection ou de Chasseur)</button>' : ''}
      <p class="note">« Dofus » : chance officielle. « Pour toi » : avec la Prospection et le Chasseur du perso de test, et src/data/butin.json. En orange : ne tombe pas (quête de Dofus, ou seulement pendant un événement).</p>
      <h4>Simuler</h4>
      <div class="l"><select id="pt-simm">${mons.map(([k, d]) => `<option value="${k}" ${k === this.simMonstre ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <span style="display:flex;gap:4px">${[100, 1000, 10000].map(n => chip('data-simn', String(n), n.toLocaleString('fr-FR'), this.simN === n)).join('')}</span><button type="button" class="b" data-sim>Tuer</button></div>
      ${this.simRes ? `<div class="sim">${this.simRes}</div>` : '<p class="note">Tire le butin avec le vrai calcul du jeu, sans rien donner au perso.</p>'}`;
  }
  private placement() {
    if (!this.world.zone.open) return '<p class="note">Le placement des groupes se fait dans les zones en monde ouvert (Incarnam, Astrub).</p>';
    return this.editeur.html();
  }
  // --- Progression (maquette « Outil test » 2, 3, 4, 5) ------------------------------------------------------------
  private progression() {
    const p = this.world.player, Q = this.world.quetes;
    const cases = p.dofusPortes.map(id => { const d = id ? PORTABLE(id) : null; return `<i class="c ${d ? 'p' : ''}" title="${d ? esc(d.nom) : 'case libre'}">${d ? iconHtml(d.icon) : '+'}</i>`; }).join('');
    const dofus = Object.entries(DOFUS).sort((a, b) => a[1].niveau - b[1].niveau).map(([id, d]) => this.boutonDofus(id, d)).join('');
    // quêtes : celles des Dofus d'abord, puis par niveau
    const quetes = Object.entries(QUETES.quetes).sort((a, b) => Number(b[1].serie === 'Les Dofus') - Number(a[1].serie === 'Les Dofus') || a[1].niveau - b[1].niveau)
      .map(([id, q]) => `<button type="button" data-qsel="${id}" class="${this.quete === id ? 'on' : ''}"><span class="n">${esc(q.nom)}</span>${this.etatQuete(id)}</button>`).join('');
    const qd = QUETES.quetes[this.quete], en = Q?.enCours.find(c => c.id === this.quete);
    const etapes = Q && qd ? Q.etapes(this.quete) : [];
    const detail = !qd ? '' : !Q ? '<p class="note">Les quêtes se testent en monde ouvert (Incarnam, Astrub, Bastion).</p>' : `
      <div class="l"><b>${esc(qd.nom)}</b>${this.etatQuete(this.quete)}</div>
      <div class="etapes">${etapes.map((e, i) => `<button type="button" class="b g ${en && en.etape === i && !en.aRendre ? 'on' : ''}" data-qetape="${i}" style="text-align:left">Étape ${i + 1} : ${esc(e.nom ?? '')}</button>`).join('')}</div>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b g" data-qgeste="prendre">Prendre</button>
        <button type="button" class="b" data-qgeste="finir">Finir</button>
        <button type="button" class="b g" data-qgeste="zero">Remettre à zéro</button>
        <button type="button" class="b g" data-qgeste="aller">Y aller</button>
      </div>
      <p class="note">Une étape : la quête est prise si besoin et ses élites apparaissent. Finir donne la récompense (le Dofus). Y aller : au PNJ ou à l'élite de l'étape, la zone change si besoin.</p>`;
    // Almanax
    const jour = this.world.opts.aujourdhui ?? jourDuPC(), j = jourAlmanax(jour), actif = p.almanaxJour === jour;
    const nomRes = (id: string) => ITEMS.resources[id]?.name ?? id;
    const alm = `<div class="alm"><button type="button" class="b g" data-jour="-" aria-label="Jour précédent">◂</button><input type="date" id="pt-jour" value="${jour}"><button type="button" class="b g" data-jour="+" aria-label="Jour suivant">▸</button><button type="button" class="b g" data-jour="0">Aujourd'hui</button></div>
      ${j ? `<div class="l"><span>${esc(j.bonus)}</span>${actif ? '<span class="etiq v">bonus actif</span>' : ''}</div>
      <p class="note">${esc(j.texte)}</p>
      <div class="l"><span>Offrande : ${esc(nomRes(j.offrande))} ×${j.n}</span><button type="button" class="b g" data-offrande>Dans le sac</button></div>` : '<p class="note">Pas d\'Almanax ce jour-là.</p>'}
      <p class="note">Le Représentant des Temples prend l'offrande de ce jour-là et donne ${ALMANAX.pepites} Pépites + le bonus.</p>`;
    const nbArchis = Object.values(GAME_DATA.monsters).filter(d => d.archiDe).length;
    return `<h4>Dofus portés</h4><div class="cases">${cases}</div>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b" data-dofus="codes">Tous les Dofus codés</button>
        <button type="button" class="b g" data-dremplir>Remplir les 6</button>
        <button type="button" class="b g" data-dvider>Tout retirer</button>
      </div>
      <div class="liste" style="max-height:190px;overflow:auto">${dofus}</div>
      <p class="note">Clic : le Dofus est obtenu et porté s'il reste une case. « stats seules » : son passif n'est pas encore codé.</p>
      <h4>Quêtes</h4>
      <div class="liste" style="max-height:170px;overflow:auto">${quetes}</div>
      ${detail}
      <h4>Almanax</h4>${alm}
      <h4>Archimonstres</h4>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b g" data-res="${ARCHI.pierre}:10">Pierres d'âme ×10</button>
        <button type="button" class="b g" data-archis>Poser un archimonstre</button>
      </div>
      ${this.inter('archis', 'Archimonstres ×100', 'Dans les groupes, 1 chance sur 1,5 au lieu de 1 sur 150.')}
      <p class="note">${p.ames.length} archimonstre${p.ames.length > 1 ? 's' : ''} capturé${p.ames.length > 1 ? 's' : ''} sur ${nbArchis}.</p>`;
  }
  private boutonDofus(id: string, d: (typeof DOFUS)[string]) {
    const p = this.world.player, porte = p.dofusPortes.includes(id), a = p.dofus.includes(id);
    return `<button type="button" data-dofus="${id}">${iconHtml(d.icon)}<span class="n">${esc(d.nom)}</span><span class="etiq ${d.jeu ? 'v' : ''}">${d.jeu ? 'passif codé' : 'stats seules'}</span><span class="d">${porte ? 'porté' : a ? 'obtenu' : `niv. ${d.niveau}`}</span></button>`;
  }
  private etatQuete(id: string) {
    const Q = this.world.quetes; if (!Q) return '';
    const c = Q.enCours.find(x => x.id === id);
    return Q.finies.has(id) ? '<span class="etiq v">finie</span>' : c ? `<span class="etiq o">${c.aRendre ? 'à rendre' : `étape ${c.etape + 1}/${Q.etapes(id).length}`}</span>` : '<span class="etiq">à prendre</span>';
  }
  /** 3A-3E. « Y aller » : au PNJ qui attend (zone changée si besoin), sinon au but de l'étape (élite, carte). */
  private gesteQuete(g: GesteQuete) {
    const id = this.quete, envoyer = (c: CommandeTest) => this.actions.envoyer(c);
    if (g !== 'aller') { envoyer({ k: 'quete', id, geste: g }); return; }
    const Q = this.world.quetes, q = QUETES.quetes[id]; if (!q) return;
    const c = Q?.enCours.find(x => x.id === id);
    const pnjEtape = c && !c.aRendre && Q ? Q.etapes(id)[c.etape]?.objectifs.map((o, i) => 'pnj' in o && o.pnj && c.compte[i] < 1 ? o.pnj : null).find(Boolean) : null;
    const qui = !c ? q.pnj : c.aRendre ? q.rendre ?? q.pnj : pnjEtape;
    const zonePnj = (k: string) => QUETES.pnj[k]?.zone ?? 'incarnam';
    if (!c && qui && QUETES.pnj[qui]) { const d = QUETES.pnj[qui]; this.allerLieu({ zone: zonePnj(qui), tag: d.carte, case: d.case, nom: d.nom, d: '', groupe: 'pnj' }); return; }
    // zone du but : celle du PNJ, sinon (élites) celle d'un PNJ de la quête hors du Bastion
    const pnjs = [q.pnj, q.rendre, ...Q?.etapes(id).flatMap(e => [e.pnj, ...e.objectifs.map(o => 'pnj' in o ? o.pnj : undefined)]) ?? []].filter((k): k is string => !!k && !!QUETES.pnj[k]);
    const zone = qui ? zonePnj(qui) : pnjs.map(zonePnj).find(z => z !== 'bastion') ?? 'astrub';
    const cmd: CommandeTest = { k: 'quete', id, geste: 'aller' };
    if (zone === this.zoneId) envoyer(cmd); else this.actions.zone(zone, [cmd]);
  }
  private changerJour(dt: number) {
    if (!dt) { this.envoyerJour(jourDuPC()); return; }
    const d = new Date(`${this.world.opts.aujourdhui ?? jourDuPC()}T12:00:00`); d.setDate(d.getDate() + dt);
    this.envoyerJour(d.toLocaleDateString('sv-SE'));
  }
  /** 5A : la partie de test fait comme si on était ce jour-là (gardé pour la prochaine fois). */
  private envoyerJour(date: string) {
    this.actions.envoyer({ k: 'jour', date });   // la simulation change de jour au prochain pas, puis le panneau se redessine (événement « test »)
  }

  // --- Lieux (6A-6D) et recherche (10A) ----------------------------------------------------------------------------
  private lieuxCache: Lieu[] | null = null;
  /** PNJ, ateliers, îles du Bastion et portails de toutes les zones. */
  private lieux(): Lieu[] {
    if (this.lieuxCache) return this.lieuxCache;
    const out: Lieu[] = [], Z = GAME_DATA.zones, nomZ = (z: string) => Z[z]?.name ?? z;
    for (const d of Object.values(QUETES.pnj).sort((a, b) => a.nom.localeCompare(b.nom))) {
      const z = d.zone ?? 'incarnam'; if (!Z[z]?.open) continue;
      out.push({ zone: z, tag: d.carte, case: d.case, nom: d.nom, d: nomZ(z), groupe: 'pnj' });
    }
    for (const [z, zd] of Object.entries(Z)) for (const a of zd.open?.ateliers ?? []) {
      const po = a.postes?.[0], tag = po?.[0] ?? a.cartes[a.cartes.length - 1];
      if (tag) out.push({ zone: z, tag, case: po?.[1], nom: a.nom, d: nomZ(z), groupe: 'atelier' });
    }
    const B = Z.bastion?.open?.bastion;
    if (B) {
      out.push({ zone: 'bastion', tag: 'bastion', case: B.arrivee, nom: 'Arrivée du Bastion', d: 'Bastion', groupe: 'bastion' });
      out.push({ zone: 'bastion', tag: 'bastion', case: B.zaap, nom: 'Zaap du Bastion', d: 'Bastion', groupe: 'bastion' });
      const NOMS: Record<string, string> = { bonta: 'Île de Bonta', brakmar: 'Île de Brâkmar', pandala: 'Île de Pandala', frigost: 'Île de Frigost' };
      for (const [k, c] of Object.entries(B.iles ?? {})) out.push({ zone: 'bastion', tag: 'bastion', case: c, nom: NOMS[k] ?? k, d: 'Bastion', groupe: 'bastion' });
    }
    for (const [z, zd] of Object.entries(Z)) for (const d of zd.open?.portes ?? []) if (d.zone) out.push({ zone: z, tag: d.a[0], case: d.a[1], nom: d.nom, d: `${nomZ(z)} → ${nomZ(d.zone)}`, groupe: 'portail' });
    return this.lieuxCache = out;
  }
  private boutonLieu(x: Lieu, i: number) {
    return `<button type="button" data-lieu="${i}">${this.star({ nom: x.nom, k: 'lieu', lieu: x })}<span class="n">${esc(x.nom)}</span><span class="d">${esc(x.d)}${x.zone !== this.zoneId ? ' ↗' : ''}</span></button>`;
  }
  private allerLieu(x: Lieu | undefined) {
    if (!x) return;
    const c: CommandeTest = { k: 'aller', tag: x.tag, nom: x.nom, ...(x.case != null ? { case: x.case } : {}) };
    if (x.zone === this.zoneId) this.actions.envoyer(c); else this.actions.zone(x.zone, [c]);
  }
  /** 10A : tout ce qui porte ce nom, quel que soit l'onglet. */
  private resultats() {
    const r = sansAccent(this.recherche.trim()), mots = r.split(/\s+/), va = (n: string) => { const t = sansAccent(n); return mots.every(m => t.includes(m)); };
    const bloc = (titre: string, l: string[]) => l.length ? `<h4>${titre}</h4><div class="liste">${l.slice(0, 8).join('')}</div>` : '';
    const ong = ONGLETS.filter(([, n]) => va(n)).map(([k, n]) => `<button type="button" data-ong="${k}"><span class="n">Onglet ${esc(n)}</span><span class="d">▶</span></button>`);
    const dofus = Object.entries(DOFUS).filter(([, d]) => va(d.nom)).map(([id, d]) => this.boutonDofus(id, d));
    const quetes = Object.entries(QUETES.quetes).filter(([, q]) => va(`${q.nom} ${q.serie ?? ''}`)).map(([id, q]) => `<button type="button" data-qsel="${id}"><span class="n">${esc(q.nom)}</span>${this.etatQuete(id)}</button>`);
    const lieux = this.lieux().map((x, i) => [x, i] as const).filter(([x]) => va(`${x.nom} ${x.d}`)).map(([x, i]) => this.boutonLieu(x, i));
    const mons = PanneauTest.monstres().filter(([, d]) => va(d.name)).sort((a, b) => (a[1].level ?? 0) - (b[1].level ?? 0))
      .map(([k, d]) => `<button type="button" data-mon="${k}"><span class="n">${esc(d.name)}</span><span class="d">${d.archiDe ? 'archimonstre · ' : d.boss ? 'boss · ' : ''}niv. ${d.level ?? '?'}</span></button>`);
    const objets = [...Object.entries(ITEMS.equipment), ...Object.entries(ITEMS.resources)].filter(([, d]) => va(d.name))
      .map(([id, d]) => `<button type="button" data-objet="${id}">${iconHtml(d.icon)}<span class="n">${esc(d.name)}</span><span class="d">${ITEMS.equipment[id] ? `niv. ${ITEMS.equipment[id].level}` : 'ressource ×10'}</span></button>`);
    const tout = bloc('Onglets', ong) + bloc('Dofus', dofus) + bloc('Quêtes', quetes) + bloc('Lieux et PNJ', lieux) + bloc('Monstres', mons) + bloc('Objets', objets);
    return tout || '<p class="note">Rien de ce nom.</p>';
  }

  /** Panneau test 2B : calques (4), temps (5), heure et monde (9B, 9C), règles (ancien onglet Aides), rapport de bug et erreurs (10). */
  private debug() {
    const c = this.calques, cal = (k: keyof PanneauTest['calques'], nom: string, aide: string) =>
      `<label class="inter"><span>${nom}<br><span class="note">${aide}</span></span><input type="checkbox" data-cal="${k}" ${c[k] ? 'checked' : ''}></label>`;
    const puce = (attr: string, v: string | number, txt: string, on: boolean) => `<button type="button" class="b g ${on ? 'on' : ''}" ${attr}="${v}">${txt}</button>`;
    const err = ERREURS.slice().reverse().map(e => `<div class="err"><b>${e.t}</b> ${esc(e.msg)}${e.n > 1 ? ` <b>×${e.n}</b>` : ''}</div>`).join('');
    return `<h4>Calques</h4>
      ${cal('aggro', 'Hitbox et rayon de réveil', 'Cercle rouge : un joueur qui y entre réveille le groupe. Vert : la hitbox des monstres ; bleu : la tienne.')}
      ${cal('ia', 'État de l\'IA', 'Au-dessus de chaque monstre : endormi, au calme, poursuite, prépare, attaque, retour, et sa cible.')}
      ${cal('perf', 'Compteur de fluidité', 'FPS, temps de calcul par image, monstres actifs et endormis, projectiles.')}
      ${cal('coords', 'Carte et case sous la souris', 'Coordonnées, tag et numéro de case (0-559). Ctrl + clic droit : copier.')}
      <h4>Temps</h4>
      <div class="l" style="justify-content:flex-start;gap:4px">${puce('data-dpause', 1, this.pause ? '▶ Reprendre' : '⏸ Pause', this.pause)}<button type="button" class="b g" data-dpas ${this.pause ? '' : 'disabled'}>+1 image</button></div>
      <div class="l"><span>Vitesse</span><span class="chips">${VITESSES.map(v => puce('data-vit', v, `×${String(v).replace('.', ',')}`, this.vitesse === v)).join('')}</span></div>
      <p class="note">F2 : pause, F3 : image suivante. Le ralenti et l'accéléré changent tout le jeu (monstres, sorts, recharges, animations).</p>
      <h4>Monde</h4>
      <div class="l"><span>Heure</span><span class="chips">${(['auto', 'jour', 'soir', 'nuit'] as Heure[]).map(h => puce('data-heure', h, h === 'auto' ? 'Heure du PC' : h[0].toUpperCase() + h.slice(1), this.heure === h)).join('')}</span></div>
      <div class="l" style="justify-content:flex-start;gap:4px"><button type="button" class="b g" data-repeupler>Repeupler la carte</button><button type="button" class="b g" data-bsoin2>Soigner</button></div>
      <p class="note">Repeupler : les groupes vaincus reviennent tout de suite, même sous tes yeux. L'heure forcée ne vaut que pour la partie de test.</p>
      <h4>Règles</h4>
      ${this.inter('invincible', 'Invincible', 'Les coups s\'affichent, les PV ne baissent pas.')}
      ${this.inter('recharges', 'Recharges à zéro', 'Sorts relançables tout de suite, PA et PM toujours pleins.')}
      ${this.inter('archis', 'Archimonstres ×100', 'Dans les groupes, 1 chance sur 1,5 au lieu de 1 sur 150.')}
      ${this.inter('invocations', 'Invocations sans limite', 'Pour voir beaucoup de bêtes à la fois (Osamodas).')}
      <button type="button" class="b g" data-renvoyer>Renvoyer toutes les invocations</button>
      <h4>Signaler un bug</h4>
      <button type="button" class="b" data-rapport>Copier un rapport de bug</button>
      <textarea id="pt-rapport" hidden spellcheck="false"></textarea>
      <p class="note" id="pt-rapmsg">Version, lieu, carte et case, perso, tenue, réglages et dernières erreurs, prêts à coller dans le forum des bugs.</p>
      <h4>Erreurs du jeu${ERREURS.length ? ` (${ERREURS.length})` : ''}</h4>
      ${err ? `${err}<button type="button" class="b g" data-errvider>Effacer la liste</button>` : '<p class="note">Aucune erreur depuis le lancement. S\'il y en a une, une pastille rouge apparaît sur l\'étiquette PARTIE DE TEST.</p>'}
      <p class="note">Rien de la partie de test ne compte pour ton compte : pas de succès, pas de bestiaire, pas de carnet. Le perso de test est gardé à part de tes 3 persos.</p>`;
  }
}
