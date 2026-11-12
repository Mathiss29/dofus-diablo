import type { World } from '../sim/world';
import { v } from './assetUrl';
import { ISO } from '../sim/iso';
import { GAME_DATA, ITEMS, RECOLTES } from '../sim/data';
import { ICON_CSS, iconHtml } from './icons';
import { QUEST_ICON } from './questView';
import { MANIFESTE, Son } from './son';
import { ambiance, chargerReglages } from './ambiance';
import { aDecouvrir, cleLieu, famille, MAX_DRAPEAUX, NOTE_MAX, nomLieu, secret, type Drapeau, type Famille, type Repere } from '../sim/carte';
import carteData from '../data/carte.json';
import { bossAnnonce } from '../sim/mondeVivant';

/** Carte du monde (touche M), maquette « Carte : » et « Carte suite : » du 2026-11-10 (tout d'un bloc, 12A).
 *  Repère commun : la case [x, y] du Monde des Douze couvre [x, x+1] × [y, y+1] en « unités de carte » ; carte.webp d'un monde
 *  la place en (ox + x·cw, oy + y·ch) pixels (plan.json, tools/extraction/plan_carte.py), la carte peinte officielle en
 *  (origine + x·mapWidth)·k (src/data/carte.json, tools/extraction/carte_peinte.py).
 *  - 1A+1C : la carte peinte officielle dessous (mer continue), notre rendu par-dessus qui s'efface en dézoomant ;
 *  - 2A+2C : plein écran, boutons de zoom, « Me recentrer » (Espace) ;  3A+3B+3C : survol d'une sous-zone, noms et niveaux, danger ;
 *  - 4A-4D : filtres retenus par perso, tous les repères officiels, regroupés en dézoomant, recherche ;  6A+6D : brouillard, % exploré ;
 *  - 7A : Amakna grisé hors partie de test ;  8A+8B : onglets des mondes et vue du Monde des Douze ;  9A+9D : drapeaux, coordonnées ;
 *  - 10A+10C+10D : groupe, état des donjons, flèche du perso ;  13A : plan des intérieurs ;  14A-14C : drapeaux partagés, signal, notes ;
 *  - 15A : tombe ;  16A : Mes récoltes ;  17A : lieux à découvrir ;  18A : teinte jour/nuit ;  19A+19B : place réservée (boss, Enfers).
 *  L'affichage ne modifie pas la partie : drapeaux et signal partent dans l'entrée du joueur (onGeste). */

interface CarteRepere { ox: number; oy: number; cw: number; ch: number; w?: number; h?: number }
interface Salle { tag: string; img: string; u: [number, number]; du: [number, number] }
interface PlanMonde { monde: string; carte: CarteRepere; maps: [number, number, number, number][]; reperes: Repere[]; plans?: Record<string, Salle[]> }
interface Peinte { nom: string; img: string; w: number; h: number; k: number; ox: number; oy: number; mw: number; mh: number }
interface Region { lab: string; ver: string; niv?: string; cases: [number, number][] }
const CD = carteData as unknown as { peintes: Record<string, Peinte>; mondes: Record<string, { peinte: number; nom: string }>; regions: Region[] };

/** « Montrer sur la carte » (Métiers UI 8B, 11B) : où trouver une ressource (cartes entières et points précis). */
export interface MarqueCarte { titre: string; icone: number; tags: string[]; points: { x: number; y: number }[]; /** Image à la place de l'icône d'objet (succès). */ img?: string }
/** Geste de la carte vers la partie (entrée du joueur). */
export interface GesteCarte { drapeaux?: Drapeau[]; signal?: { x: number; y: number } }

type Filtre = Famille | 'quetes' | 'recoltes' | 'groupe' | 'drapeaux' | 'danger' | 'archis' | 'vivant';
const FILTRES: [Filtre, string][] = [['zaap', 'Zaaps'], ['transport', 'Transports'], ['atelier', 'Ateliers'], ['service', 'Services'], ['donjon', 'Donjons'],
  ['lieu', 'Lieux'], ['quetes', 'Quêtes'], ['recoltes', 'Mes récoltes'], ['groupe', 'Groupe'], ['drapeaux', 'Drapeaux'], ['archis', 'Archimonstres à capturer'], ['vivant', 'Boss du monde et invasion'], ['danger', 'Teinte de danger']];
const PAR_DEFAUT: Record<Filtre, boolean> = { zaap: true, transport: true, atelier: true, service: true, donjon: true, lieu: true, quetes: true, recoltes: false, groupe: true, drapeaux: true, danger: false, archis: true, vivant: true };
/** Couleurs des joueurs du groupe (10A, 14A). */
export const COULEURS_GROUPE = ['#ff5a4a', '#4fc3f7', '#9ad15a', '#ffb74d', '#f06292'];
const DEHORS = /^-?\d+_-?\d+$/;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const sansAccent = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VER_COUL: Record<string, string> = { '0.4': '#f2d36b', '0.6': '#9ad15a', '0.7': '#4fc3f7', '0.8': '#c58cff', '0.9': '#ff9a4a', '0.10': '#ff5a6a' };

const CSS = `
.dw.cm{pointer-events:auto;z-index:11;background:#000a}
.dw .win.carte{width:calc(100vw - 24px);height:calc(100vh - 24px);display:flex;flex-direction:column}
.cm .ttl .ong{display:flex;gap:4px;margin-left:18px}
.cm .ttl .ong span{font:600 12px Lexend,sans-serif;padding:3px 10px;border-radius:3px;background:#0006;color:#bdb6a2;cursor:pointer;border:1px solid #fff2}
.cm .ttl .ong span.on{background:#f2d36b22;color:#ffe9a8;border-color:#f2d36b88}
.cm .ttl .xp{margin-left:auto;margin-right:40px;font:12px Lexend,sans-serif;color:#cfc8b6}
.cm .ttl .xp b{color:#ffe9a8}
.cm .corps{flex:1;display:flex;min-height:0}
.cm .vue{position:relative;flex:1;overflow:hidden;cursor:grab;background:#1d3a48;border-radius:0 0 3px 0}
.cm .vue.drag{cursor:grabbing}
.cm .cplan{position:absolute;left:0;top:0;transform-origin:0 0}
.cm .cplan>img,.cm .cplan>canvas{position:absolute;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none}
.cm .nuit{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply}
.cm .mk{position:absolute;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap}
.cm .mk.cache{display:none}
.cm .mk.bm,.cm .mk.iv,.cm .mk.ev{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:bold 16px Lexend,sans-serif;color:#fff;border:2px solid #14130f;animation:cmPulse 1.2s ease-in-out infinite}
.cm .mk.bm{background:#c8352a;box-shadow:0 0 12px #ff5a4a}
.cm .mk.iv{background:#7a4fd0;box-shadow:0 0 12px #b07bff}
.cm .mk.ev{background:#d97a1c;box-shadow:0 0 10px #f08a2c;width:22px;height:22px;font-size:13px}
@keyframes cmPulse{50%{transform:translate(-50%,-50%) scale(1.15)}}
.cm .mk.qt img{width:30px;height:30px;filter:drop-shadow(0 0 6px #ffd76a)}
.cm .mk.tr{width:6px;height:6px;border-radius:50%;background:#ffd76a;box-shadow:0 0 0 1.5px #3a2208,0 0 6px #ffd76a}
.cm .sz{font:bold 12px Lexend,sans-serif;color:#f4efe0;text-shadow:0 0 3px #000,0 1px 2px #000;opacity:.92;text-align:center}
.cm .sz small{display:block;font-weight:400;font-size:10px;color:#e2d9b8}
.cm .rg{font:bold 15px Rowdies,Lexend,sans-serif;color:#fff6dc;text-shadow:0 0 4px #000,0 2px 3px #000;text-align:center}
.cm .rg small{display:block;font:600 11px Lexend,sans-serif}
.cm .bt{font:bold 16px Rowdies,Lexend,sans-serif;color:#d8d2c0;text-shadow:0 0 4px #000;text-align:center}
.cm .bt small{display:block;font:12px Lexend,sans-serif;color:#f2d36b}
.cm .pt{width:14px;height:14px;border-radius:50%;background:#c58cff;border:2px solid #fff;box-shadow:0 0 8px #c58cff}
.cm .moi{width:0;height:0}
.cm .moi i{position:absolute;left:-11px;top:-11px;width:22px;height:22px;border-radius:50%;background:#ff5a4a;border:2px solid #fff;box-shadow:0 0 0 3px #ff5a4a55,0 0 12px #ff5a4a;box-sizing:border-box}
.cm .moi b{position:absolute;left:-7px;top:-20px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #fff;transform-origin:7px 20px;filter:drop-shadow(0 0 2px #000)}
.cm .gp{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #000}
.cm .gp span{position:absolute;left:50%;top:-18px;transform:translateX(-50%);font:bold 11px Lexend,sans-serif;color:#fff;text-shadow:0 0 3px #000}
.cm .rp{pointer-events:auto;cursor:help;width:26px;height:26px;filter:drop-shadow(0 1px 2px #000)}
.cm .rp img{width:26px;height:26px;display:block}
.cm .rp.eteint img{filter:grayscale(1) brightness(.6);opacity:.65}
.cm .rp.inconnu img{filter:grayscale(1) brightness(.35) contrast(.8);opacity:.7}
.cm .rp.inconnu::after{content:'?';position:absolute;left:0;right:0;top:3px;text-align:center;font:bold 15px Lexend,sans-serif;color:#ffe9a8;text-shadow:0 0 3px #000}
.cm .rp:hover{filter:drop-shadow(0 0 4px #ffe9a8) brightness(1.15)}
.cm .rp .n{position:absolute;right:-12px;bottom:-6px;background:#000c;border:1px solid #f2d36b99;color:#ffe9a8;font:bold 10px Lexend,sans-serif;padding:0 3px;border-radius:6px}
.cm .rp.rc{width:22px;height:22px}
.cm .rp.rc .ic{width:22px;height:22px}
.cm .gd{width:26px;height:26px;pointer-events:auto;cursor:help;filter:drop-shadow(0 1px 2px #000) drop-shadow(0 0 4px #f2d36b)}
.cm .gd .ic{width:26px;height:26px}
.cm .ar{width:24px;height:24px;pointer-events:auto;cursor:help;filter:drop-shadow(0 1px 2px #000) drop-shadow(0 0 5px #ffc844)}.cm .ar .ic{width:24px;height:24px}
.cm .vd{pointer-events:auto;cursor:help;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:2px solid #f2d36b;background:#000a;box-shadow:0 0 0 4px #f2d36b55,0 0 14px #f2d36b;animation:cmvd 1.2s ease-in-out infinite alternate}
.cm .vd .ic{width:22px;height:22px}
.cm .ou{width:22px;height:22px;border-radius:50%;border:2px solid #b9e54b;background:#000a;display:grid;place-items:center;box-shadow:0 0 0 3px #b9e54b44,0 0 12px #b9e54b;animation:cmvd 1.1s ease-in-out infinite alternate}
.cm .ou .ic{width:16px;height:16px}
.cm .dr{pointer-events:auto;cursor:pointer;width:0;height:0}
.cm .dr svg{position:absolute;left:-3px;top:-30px;width:24px;height:32px;filter:drop-shadow(0 1px 2px #000)}
.cm .dr span{position:absolute;left:16px;top:-30px;font:600 11px Lexend,sans-serif;color:#fff;background:#000a;padding:1px 5px;border-radius:3px}
.cm .dr.suivi svg{filter:drop-shadow(0 0 6px #ffe9a8)}
.cm .tb{font-size:22px;filter:drop-shadow(0 0 4px #000);pointer-events:auto;cursor:help}
.cm .sg{width:40px;height:40px;border-radius:50%;border:3px solid #ffe9a8;animation:cmsg .9s ease-out infinite}
@keyframes cmsg{from{transform:translate(-50%,-50%) scale(.3);opacity:1}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
.cm .ttlou{position:absolute;left:12px;top:10px;background:#000c;padding:6px 12px;border-radius:3px;border:1px solid #b9e54b88;font:bold 13px Lexend,sans-serif;color:#d6f57a;display:flex;gap:8px;align-items:center;pointer-events:none}
.cm .ttlou .ic{width:24px;height:24px}
@keyframes cmvd{to{box-shadow:0 0 0 9px #f2d36b22,0 0 20px #f2d36b}}
.cm .zb{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:6px}
.cm .zb span{width:34px;height:34px;display:grid;place-items:center;background:#000c;border:1px solid #f2d36b88;border-radius:4px;color:#ffe9a8;font:bold 18px Lexend,sans-serif;cursor:pointer}
.cm .zb span:hover{background:#2a2410}
.cm .zb span.mot{width:auto;padding:0 8px;font-size:11px}
.cm .co{position:absolute;right:12px;bottom:10px;background:#000b;padding:4px 10px;border-radius:3px;font:12px Lexend,sans-serif;color:#cfc8b6;pointer-events:none}
.cm .bulle{position:absolute;pointer-events:none;background:#0d0c0aee;border:1px solid #f2d36b88;border-radius:4px;padding:8px 12px;font:12px Lexend,sans-serif;color:#d8d2c0;max-width:300px;box-shadow:0 4px 18px #000a;z-index:2}
.cm .bulle h4{margin:0 0 2px;font:bold 14px Lexend,sans-serif;color:#ffe9a8}
.cm .bulle .l{margin-top:4px}
.cm .bulle .l b{color:#f4efe0;font-weight:600}
.cm .bulle .el{color:#f2d36b}
.cm .bulle .ok{color:#9ad15a}
.cm .panneau{width:230px;flex:none;background:#14130fe8;border-left:1px solid #fff1;overflow-y:auto;padding:10px;font:12px Lexend,sans-serif;color:#cfc8b6}
.cm .panneau h5{margin:10px 0 6px;font:bold 12px Lexend,sans-serif;color:#ffe9a8;text-transform:uppercase;letter-spacing:.04em}
.cm .panneau input[type=text]{width:100%;box-sizing:border-box;background:#000a;border:1px solid #f2d36b66;color:#f4efe0;padding:6px 8px;border-radius:3px;font:12px Lexend,sans-serif}
.cm .panneau label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}
.cm .panneau label.off{opacity:.45;cursor:default}
.cm .panneau label img{width:18px;height:18px}
.cm .res div{padding:4px 6px;border-radius:3px;cursor:pointer;display:flex;justify-content:space-between;gap:6px}
.cm .res div:hover{background:#f2d36b22}
.cm .res small{color:#8d8776}
.cm .panneau .aide{color:#8d8776;font-size:11px;line-height:1.5;margin-top:10px}
.cm .edit{position:absolute;background:#0d0c0af2;border:1px solid #f2d36b88;border-radius:4px;padding:8px;display:flex;flex-direction:column;gap:6px;z-index:3;width:210px}
.cm .edit input{background:#000a;border:1px solid #f2d36b66;color:#f4efe0;padding:5px 7px;border-radius:3px;font:12px Lexend,sans-serif}
.cm .edit div{display:flex;gap:6px}
.cm .edit span{flex:1;text-align:center;padding:4px;background:#2a2410;border:1px solid #f2d36b66;border-radius:3px;cursor:pointer;color:#ffe9a8;font:600 11px Lexend,sans-serif}
.cm .salles{position:absolute;inset:0;overflow:auto;background:radial-gradient(ellipse at center,#26221a,#0c0b09)}
.cm .salles .sl{position:absolute;border:2px solid #5a5440;border-radius:4px;background:#000 center/contain no-repeat;box-shadow:0 2px 10px #000}
.cm .salles .sl.ici{border-color:#ff5a4a;box-shadow:0 0 0 3px #ff5a4a55,0 0 18px #ff5a4a}
.cm .salles .sl span{position:absolute;left:4px;top:3px;font:600 11px Lexend,sans-serif;color:#fff;text-shadow:0 0 3px #000}
.cm .salles .sl em{position:absolute;right:4px;bottom:3px;font:bold 11px Lexend,sans-serif;font-style:normal;padding:1px 6px;border-radius:3px}
.cm .salles .sl em.so{background:#9ad15a;color:#14230a}
.cm .salles .sl em.bo{background:#c8352b;color:#fff}
.cm .salles svg{position:absolute;left:0;top:0;pointer-events:none}
.cm .salles .moi{position:absolute}
.dw.cm.sur{pointer-events:none;background:none}
.cm.sur .win.carte,.cm.sur .win.carte::before,.cm.sur .win.carte::after{background:none!important;border:none!important;border-image:none!important;box-shadow:none!important}
.cm.sur .win.carte::before,.cm.sur .win.carte::after,.cm.sur .nuit{display:none}
.cm.sur .ttl,.cm.sur .panneau,.cm.sur .zb,.cm.sur .co{display:none}
.cm.sur .vue{background:none;opacity:.62}
.cm.sur .win,.cm.sur .win *{pointer-events:none!important}
`;

/** Une marque regroupable (4C) : repère ou récolte. */
interface Marque { el: HTMLElement; x: number; y: number; f: Filtre; n?: HTMLElement }

export class CarteMonde {
  private root: HTMLDivElement | null = null;
  private vue!: HTMLDivElement;
  private plan!: HTMLDivElement;
  private moi: HTMLDivElement | null = null;
  private zoom = 1;
  private zoomMin = 0.2;
  private pos = { x: 0, y: 0 };
  private plans = new Map<string, PlanMonde | null>();
  /** Monde montré (onglet 8A) : nom du monde, ou '_douze' (8B). */
  private onglet = '';
  private P: PlanMonde | null = null;
  private marques: Marque[] = [];
  private dynamiques: HTMLElement[] = [];
  private notre: HTMLImageElement | null = null;
  private filtres: Record<Filtre, boolean>;
  private survol = -1;
  private surCanvas: HTMLCanvasElement | null = null;
  private zoomGroupe = -1;
  private sur = false;
  private ecoute: ((e: KeyboardEvent) => void) | null = null;
  private dernierDyn = '';
  /** Drapeau suivi par la flèche du HUD (9A) : index dans les drapeaux du joueur. */
  suivi: number | null = null;
  /** Drapeaux et signal vers la partie. */
  onGeste: (g: GesteCarte) => void = () => {};

  /** dir(monde) = dossier des fichiers du monde ; cle = perso (filtres retenus, 4A). */
  constructor(private world: World, private dir: (monde: string) => string, private icones: string, private cle: string) {
    const st = document.createElement('style'); st.textContent = CSS + ICON_CSS; document.head.appendChild(st);
    let f: Partial<Record<Filtre, boolean>> = {};
    try { f = JSON.parse(localStorage.getItem(`diablofus.carte.${cle}`) ?? '{}') as Partial<Record<Filtre, boolean>>; } catch { /* pas de stockage */ }
    this.filtres = { ...PAR_DEFAUT, ...f };
    this.charger(this.monde);
  }
  get ouverte() { return !!this.root && !this.sur; }
  get surimpression() { return !!this.root && this.sur; }
  get dispo() { return !!this.world.worldGrid?.world.carte && !!this.world.zone.open; }
  private get monde() { return this.world.zone.open?.world ?? ''; }
  private get zoneId() { return this.world.opts.zone ?? ''; }
  basculer() { if (this.root && !this.sur) this.fermer(); else { this.fermer(true); this.ouvrir(); } }
  /** 11B : carte transparente par-dessus le jeu (Tab). */
  basculerSurimpression() { if (this.root && this.sur) this.fermer(true); else if (!this.root) this.ouvrir(undefined, false, true); }
  /** Ouvre la carte avec les endroits où trouver une ressource (Métiers UI). */
  montrer(m: MarqueCarte) { this.fermer(true); this.ouvrir(m); }
  /** Idée 3 (2026-11-08) : clic sur l'objectif du suivi, la carte s'ouvre centrée sur le but de la quête. */
  montrerQuete() { this.fermer(true); this.ouvrir(undefined, true); }
  fermer(silence = false) {
    if (!this.root) return;
    if (!silence && !this.sur) Son.jouer(MANIFESTE.ui.fermer, 'interface', { vol: 0.8 });
    this.root.remove(); this.root = null; this.moi = null; this.surCanvas = null;
    if (this.ecoute) { window.removeEventListener('keydown', this.ecoute, true); this.ecoute = null; }
  }
  destroy() { this.fermer(true); }

  private charger(monde: string): Promise<PlanMonde | null> {
    if (this.plans.has(monde)) return Promise.resolve(this.plans.get(monde)!);
    return fetch(v(`${this.dir(monde)}/plan.json`)).then(r => (r.ok ? r.json() as Promise<PlanMonde> : null)).catch(() => null)
      .then(p => { this.plans.set(monde, p); return p; });
  }

  // --- repères -------------------------------------------------------------------------------------------------
  /** Pixels du plan (carte.webp du monde montré) d'un point en unités de carte. */
  private u2p(ux: number, uy: number) { const c = this.P!.carte; return { x: c.ox + ux * c.cw, y: c.oy + uy * c.ch }; }
  private p2u(px: number, py: number) { const c = this.P!.carte; return { x: (px - c.ox) / c.cw, y: (py - c.oy) / c.ch }; }
  /** Point du jeu (monde où l'on est) en pixels du plan. */
  private duJeu(wx: number, wy: number) {
    const wg = this.world.worldGrid!, c = wg.world.carte!, s = ISO.toScreen(wx, wy), m = wg.fromScreen(s.x, s.y);
    return { x: (m.x - c.x) * c.k, y: (m.y - c.y) * c.k };
  }
  /** Unités de carte -> point du jeu (monde où l'on est) : signal posé depuis la carte, flèche d'un drapeau. */
  versJeu(ux: number, uy: number) {
    const P = this.plans.get(this.monde), wg = this.world.worldGrid, c = wg?.world.carte;
    if (!P || !wg || !c) return null;
    const px = P.carte.ox + ux * P.carte.cw, py = P.carte.oy + uy * P.carte.ch, s = wg.toScreen(px / c.k + c.x, py / c.k + c.y);
    return ISO.toWorld(s.x, s.y);
  }
  /** Point du jeu -> unités de carte (monde où l'on est). */
  versUnites(wx: number, wy: number) {
    const P = this.plans.get(this.monde); if (!P || !this.world.worldGrid?.world.carte) return null;
    const p = this.duJeu(wx, wy), c = P.carte; return { x: (p.x - c.ox) / c.cw, y: (p.y - c.oy) / c.ch };
  }
  private estIci() { return this.onglet === this.monde; }
  private zoneDe(monde: string) { return Object.entries(GAME_DATA.zones).find(([, z]) => z.open?.world === monde)?.[0] ?? monde; }

  ouvrir(ou?: MarqueCarte, surQuete = false, sur = false) {
    if (!this.dispo) return;
    this.sur = sur;
    const root = document.createElement('div'); root.className = `dw cm${sur ? ' sur' : ''}`; this.root = root;
    const ongs = Object.entries(CD.mondes).map(([m, d]) => `<span data-o="${m}">${esc(d.nom)}</span>`).join('') + '<span data-o="_douze">Monde des Douze</span>';
    root.innerHTML = `<div class="win carte"><div class="ttl"><b>Carte du monde</b><div class="ong">${ongs}</div><span class="xp"></span><span class="x" title="Fermer (Échap)"></span></div>
      <div class="corps"><div class="vue"><div class="cplan"></div><div class="nuit"></div>
      <div class="zb"><span data-z="+" title="Zoomer">+</span><span data-z="-" title="Dézoomer">−</span><span data-z="moi" class="mot" title="Me recentrer (Espace)">Moi</span><span data-z="tout" class="mot" title="Tout le monde">Tout</span></div>
      <div class="co"></div></div>
      <div class="panneau"><input type="text" placeholder="Chercher un lieu, un monstre, une ressource, un PNJ…" spellcheck="false"><div class="res"></div>
      <h5>Afficher</h5>${FILTRES.map(([f, n]) => `<label class="ck"><input type="checkbox" data-f="${f}" ${this.filtres[f] ? 'checked' : ''}>${n}</label>`).join('')}
      <label class="ck off" title="Fin de jeu"><input type="checkbox" disabled>Entrées des Enfers · bientôt</label>
      <div class="aide">Clic droit : poser un drapeau (5 au plus, clic dessus pour une note ou le suivre)<br>Alt + clic : signal au groupe<br>Molette ou + / − : zoom · Espace : me recentrer</div></div></div></div>`;
    root.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === root) this.fermer(); });
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.querySelector('.x')!.addEventListener('click', () => this.fermer());
    document.body.appendChild(root);
    this.vue = root.querySelector('.vue') as HTMLDivElement;
    this.plan = root.querySelector('.cplan') as HTMLDivElement;
    root.querySelectorAll<HTMLElement>('.ong span').forEach(s => s.addEventListener('click', () => { Son.jouer(MANIFESTE.ui.onglet, 'interface'); this.montrerMonde(s.dataset.o!); }));
    root.querySelectorAll<HTMLInputElement>('input[data-f]').forEach(c => c.addEventListener('change', () => {
      this.filtres[c.dataset.f as Filtre] = c.checked;
      try { localStorage.setItem(`diablofus.carte.${this.cle}`, JSON.stringify(this.filtres)); } catch { /* pas de stockage */ }
      this.montrerMonde(this.onglet, true);
    }));
    root.querySelectorAll<HTMLElement>('.zb span').forEach(b => b.addEventListener('click', () => {
      const z = b.dataset.z;
      if (z === '+' || z === '-') { const r = this.vue.getBoundingClientRect(); this.zoomer(r.width / 2, r.height / 2, z === '+' ? 1.4 : 1 / 1.4); }
      else if (z === 'moi') this.recentrer(); else this.toutVoir();
    }));
    const champ = root.querySelector('.panneau input[type=text]') as HTMLInputElement;
    champ.addEventListener('input', () => this.chercher(champ.value));
    // Espace : me recentrer (2C), sans lancer le déplacement du perso
    this.ecoute = e => {
      if (!this.root || this.sur || e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); this.recentrer(); }
    };
    window.addEventListener('keydown', this.ecoute, true);
    this.ecouterVue();
    if (!sur) Son.jouer(MANIFESTE.ui.ouvrir, 'interface', { vol: 0.8 });
    // 13A : dans un intérieur à plusieurs salles, le plan des salles d'abord
    const ici = this.world.worldGrid?.mapAt(this.world.player.x, this.world.player.y)?.tag;
    this.charger(this.monde).then(P => {
      if (this.root !== root) return;
      const g = ici ? Object.entries(P?.plans ?? {}).find(([, l]) => l.some(s => s.tag === ici)) : undefined;
      if (g && !ou && !sur) this.montrerSalles(g[0], g[1]);
      else this.montrerMonde(this.monde, false, ou, surQuete);
    });
  }

  private ecouterVue() {
    const vue = this.vue;
    let drag: { x: number; y: number; bouge: boolean } | null = null;
    vue.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.edit, .zb, .dr')) return;
      this.fermerEdit();
      const r = vue.getBoundingClientRect(), u = this.P ? this.p2u((e.clientX - r.left - this.pos.x) / this.zoom, (e.clientY - r.top - this.pos.y) / this.zoom) : null;
      if (u && e.button === 2 && this.estIci()) { this.poserDrapeau(u.x, u.y); return; }
      if (u && e.button === 0 && e.altKey && this.estIci()) { const q = this.versJeu(u.x, u.y); if (q) this.onGeste({ signal: q }); return; }
      drag = { x: e.clientX - this.pos.x, y: e.clientY - this.pos.y, bouge: false }; vue.classList.add('drag'); vue.setPointerCapture(e.pointerId);
    });
    vue.addEventListener('pointermove', e => {
      if (drag) { this.pos = { x: e.clientX - drag.x, y: e.clientY - drag.y }; drag.bouge = true; this.appliquer(); return; }
      this.survoler(e);
    });
    vue.addEventListener('pointerup', () => { drag = null; vue.classList.remove('drag'); });
    vue.addEventListener('pointerleave', () => { this.survol = -1; this.root?.querySelector('.bulle')?.remove(); if (this.surCanvas) this.surCanvas.style.display = 'none'; });
    vue.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const rr = vue.getBoundingClientRect();
      this.zoomer(e.clientX - rr.left, e.clientY - rr.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
  }
  private zoomer(mx: number, my: number, f: number) {
    const z = Math.min(3, Math.max(this.zoomMin, this.zoom * f));
    this.pos = { x: mx - (mx - this.pos.x) * z / this.zoom, y: my - (my - this.pos.y) * z / this.zoom }; this.zoom = z;
    this.appliquer();
  }
  private centrer(px: number, py: number, zoom = this.zoom) {
    const r = this.vue.getBoundingClientRect(); this.zoom = Math.min(3, Math.max(this.zoomMin, zoom));
    this.pos = { x: r.width / 2 - px * this.zoom, y: r.height / 2 - py * this.zoom }; this.appliquer();
  }
  private recentrer() {
    if (!this.estIci()) { this.montrerMonde(this.monde); return; }
    const p = this.duJeu(this.world.player.x, this.world.player.y); this.centrer(p.x, p.y, Math.max(this.zoom, 0.6));
  }
  /** Tout le monde montré dans la vue (2C). */
  private toutVoir() {
    const b = this.bornes(); if (!b) return;
    const r = this.vue.getBoundingClientRect(), z = Math.min(r.width / (b.x1 - b.x0), r.height / (b.y1 - b.y0));
    this.centrer((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, z);
  }
  /** Étendue utile en pixels du plan : la carte peinte dans la vue du Monde des Douze, nos cartes sinon. */
  private bornes() {
    if (!this.P) return null;
    if (this.onglet === '_douze') { const pe = this.peinte(); return pe ? { x0: pe.l, y0: pe.t, x1: pe.l + pe.w, y1: pe.t + pe.h } : null; }
    const xs = this.P.maps.map(m => m[0]), ys = this.P.maps.map(m => m[1]), a = this.u2p(Math.min(...xs), Math.min(...ys)), b = this.u2p(Math.max(...xs) + 1, Math.max(...ys) + 1);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }
  /** Place de la carte peinte officielle (1C) en pixels du plan. */
  private peinte() {
    const d = CD.mondes[this.onglet === '_douze' ? 'astrub' : this.onglet], pe = d && CD.peintes[String(d.peinte)];
    if (!pe || !this.P) return null;
    const c = this.P.carte, sx = c.cw / (pe.k * pe.mw), sy = c.ch / (pe.k * pe.mh);
    return { img: pe.img, l: c.ox - c.cw * pe.ox / pe.mw, t: c.oy - c.ch * pe.oy / pe.mh, w: pe.w * sx, h: pe.h * sy };
  }

  // --- un monde (onglets 8A, vue du Monde des Douze 8B) ---------------------------------------------------------
  private montrerMonde(onglet: string, garderVue = false, ou?: MarqueCarte, surQuete = false) {
    const root = this.root; if (!root) return;
    const monde = onglet === '_douze' ? 'astrub' : onglet;
    this.charger(monde).then(P => { if (this.root === root) this.dessinerMonde(onglet, P, garderVue, ou, surQuete); });
  }

  private dessinerMonde(onglet: string, P: PlanMonde | null, garderVue: boolean, ou?: MarqueCarte, surQuete = false) {
    const root = this.root!, avant = this.onglet;
    this.onglet = onglet; this.P = P; this.marques = []; this.dynamiques = []; this.zoomGroupe = -1; this.survol = -1; this.dernierDyn = '';
    root.querySelector('.salles')?.remove();
    root.querySelectorAll<HTMLElement>('.ong span').forEach(s => s.classList.toggle('on', s.dataset.o === onglet));
    root.querySelector('.ttlou')?.remove();
    this.plan.innerHTML = ''; this.moi = null;
    if (!P) { this.plan.innerHTML = '<div class="mk bt" style="left:300px;top:200px">Carte indisponible</div>'; return; }
    const douze = onglet === '_douze', monde = douze ? 'astrub' : onglet, zone = this.zoneDe(monde), ici = this.estIci();
    const w = this.world, p = w.player, test = w.essaiOuvert, subs = GAME_DATA.zones[zone]?.open?.subareas ?? {};
    // 1C : carte peinte officielle dessous, notre rendu par-dessus (bords fondus, 1A)
    const pe = this.peinte();
    if (pe && !this.sur) { const im = this.image(v(`assets/${pe.img}`), pe.l, pe.t, pe.w, pe.h); im.style.filter = douze ? '' : 'saturate(.85) brightness(.92)'; }
    const c = P.carte;
    this.notre = c.w ? this.image(v(`${this.dir(monde)}/carte_fondu.webp`), 0, 0, c.w, c.h!) : null;
    // voiles : brouillard (6A), Amakna « Bientôt » (7A), danger (3C), régions de la feuille de route (8B)
    const xs = P.maps.map(m => m[0]), ys = P.maps.map(m => m[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), nx = Math.max(...xs) - x0 + 1, ny = Math.max(...ys) - y0 + 1;
    const vus = p.exploreSet(zone);
    const voile = this.toile(x0, y0, nx, ny, 1);
    const g = voile.getContext('2d')!;
    for (const [x, y, sub, essai] of douze || this.sur ? [] : P.maps) {
      const cache = !!essai && !test;
      if (cache) g.fillStyle = 'rgba(40,38,34,.72)';
      else if (!vus.has(`${x}_${y}`)) g.fillStyle = 'rgba(8,10,14,.8)';
      else if (this.filtres.danger && !douze) {
        const d = (subs[String(sub)]?.level ?? p.level) - p.level;
        g.fillStyle = d <= 2 ? 'rgba(90,200,80,.28)' : d <= 10 ? 'rgba(240,200,60,.3)' : 'rgba(230,60,40,.34)';
      } else continue;
      g.fillRect(x - x0, y - y0, 1, 1);
    }
    if (douze) this.dessinerRegions(test);
    // survol (3A) : contour de la sous-zone, sur sa propre toile
    this.surCanvas = document.createElement('canvas'); this.surCanvas.style.display = 'none'; this.plan.appendChild(this.surCanvas);
    // noms des sous-zones (3B) et de la région en essai (7A)
    const parSz = new Map<number, { x: number; y: number; n: number; essai: boolean }>();
    for (const [x, y, sub, essai] of P.maps) { const a = parSz.get(sub) ?? { x: 0, y: 0, n: 0, essai: !!essai }; a.x += x + 0.5; a.y += y + 0.5; a.n++; parSz.set(sub, a); }
    if (!douze) for (const [sub, a] of parSz) {
      const d = subs[String(sub)]; if (!d || (a.essai && !test)) continue;
      const q = this.u2p(a.x / a.n, a.y / a.n), el = this.marque('mk sz', q.x, q.y);
      el.innerHTML = `${esc(d.name)}<small>niv. ${d.level}</small>`;
    }
    // « Archis : » 8B : une âme sur chaque sous-zone où il reste un archimonstre à capturer
    if (this.filtres.archis && !douze) {
      const M = GAME_DATA.monsters, ames = new Set(p.ames);
      for (const [sub, a] of parSz) {
        const d = subs[String(sub)]; if (!d || (a.essai && !test)) continue;
        const reste = Object.entries(M).filter(([k, x]) => x.archiDe && d.monsters.includes(x.archiDe) && !ames.has(k)).map(([, x]) => x);
        if (!reste.length) continue;
        const q = this.u2p(a.x / a.n, a.y / a.n + 0.45), el = this.marque('mk ar', q.x, q.y);
        el.innerHTML = iconHtml(ITEMS.resources[reste[0].ame ?? '10418']?.icon ?? 85003);
        el.title = `Archimonstre${reste.length > 1 ? 's' : ''} à capturer : ${reste.map(x => x.name).join(', ')}`;
        this.marques.push({ el, x: q.x, y: q.y, f: 'archis' });
      }
    }
    if (!test && !douze) {
      const es = P.maps.filter(m => m[3]);
      if (es.length) { const q = this.u2p(es.reduce((s, m) => s + m[0] + 0.5, 0) / es.length, es.reduce((s, m) => s + m[1] + 0.5, 0) / es.length); this.marque('mk bt', q.x, q.y).innerHTML = 'Amakna<small>Bientôt · 0.4</small>'; }
    }
    // repères officiels (4A, 4B, 5A) et lieux à découvrir (17A)
    const essaiTag = new Set(P.maps.filter(m => m[3]).map(m => `${m[0]}_${m[1]}`)), parCarte = new Map<string, Repere[]>();
    for (const r of douze ? [] : P.reperes) {
      const f = famille(r); if (!f || !this.filtres[f] || (essaiTag.has(r.t) && !test)) continue;
      const trouve = p.lieuxVus.includes(cleLieu(zone, r));
      if (secret(r) && !trouve) continue;
      const l = parCarte.get(r.t) ?? []; l.push(r); parCarte.set(r.t, l);
    }
    const open = GAME_DATA.zones[zone]?.open, Q = ici ? w.quetes : null;
    for (const [tag, l] of parCarte) {
      const [tx, ty] = tag.split('_').map(Number);
      l.forEach((r, i) => {
        const q = this.u2p(tx + 0.5 + (i - (l.length - 1) / 2) * 0.22, ty + 0.5), f = famille(r)!;
        const cp = r.n === 'Zaap' ? open?.checkpoints.find(k => `${k.map[0]}_${k.map[1]}` === tag) : null;
        const eteint = !!cp && !p.zaaps.some(z => z.zone === zone && z.name === cp.name);
        const inconnu = aDecouvrir(r) && !p.lieuxVus.includes(cleLieu(zone, r));
        const el = this.marque(`mk rp${eteint ? ' eteint' : ''}${inconnu ? ' inconnu' : ''}`, q.x, q.y);
        el.innerHTML = `<img src="${v(`${this.icones}/${r.g}.webp`)}" alt="">`;
        el.title = eteint ? 'Zaap à découvrir' : inconnu ? 'Lieu à découvrir (passe sur sa carte)' : cp ? `Zaap · ${open?.subareas[String(cp.sub)]?.name ?? cp.name}` : f === 'donjon' && Q ? this.etatDonjon(r.n) : nomLieu(r);
        this.marques.push({ el, x: q.x, y: q.y, f });
      });
    }
    // Mes récoltes (16A) : ressources que mes métiers savent récolter
    if (this.filtres.recoltes && !douze) {
      const vu = new Set<string>();
      for (const e of (RECOLTES as unknown as Record<string, [string, number, string][]>)[zone] ?? []) {
        const [tag, , id] = e, d = RECOLTES.ressources[id];
        if (!d || p.metierLevel(d.metier) < d.niveau || vu.has(`${tag}|${id}`) || (essaiTag.has(tag) && !test) || !DEHORS.test(tag)) continue;
        vu.add(`${tag}|${id}`);
        const [tx, ty] = tag.split('_').map(Number), q = this.u2p(tx + 0.3 + (vu.size % 3) * 0.2, ty + 0.7);
        const el = this.marque('mk rp rc', q.x, q.y); el.innerHTML = iconHtml(d.icone); el.title = `${d.nom} · ${d.metier} niv. ${d.niveau}`;
        this.marques.push({ el, x: q.x, y: q.y, f: 'recoltes' });
      }
    }
    if (ici) this.marquesDuJeu(ou, surQuete);
    // la vue : gardée en changeant un filtre, sinon centrée (joueur, but, ressource, ou tout le monde)
    this.zoomMin = 0.05;
    const b = this.bornes()!, r = this.vue.getBoundingClientRect();
    this.zoomMin = Math.min(0.6, Math.min(r.width / (b.x1 - b.x0), r.height / (b.y1 - b.y0)) * 0.9);
    if (garderVue && avant === onglet) this.appliquer();
    else if (douze || !ici) this.toutVoir();
    else {
      const cible = this.centreVoulu ?? this.duJeu(p.x, p.y); this.centreVoulu = null;
      this.centrer(cible.x, cible.y, this.sur ? 0.45 : 0.8);
    }
    this.majTitre(zone, P);
    this.majNuit();
    this.update();
  }
  private centreVoulu: { x: number; y: number } | null = null;

  /** Ce qui n'existe que dans le monde où l'on est : portails, gardiens, quête, ressource demandée. */
  private marquesDuJeu(ou?: MarqueCarte, surQuete = false) {
    const w = this.world, wg = w.worldGrid!, Q = w.quetes;
    for (const po of w.portes) if (po.vers) { const c = this.duJeu(po.ends[0].x, po.ends[0].y); this.marque('mk pt', c.x, c.y).title = po.nom; }
    // gardiens des donjons (maquette Gardiens 9A)
    for (const n of Q?.pnjs ?? []) {
      const g = n.def.gardien; if (!g || !this.filtres.donjon) continue;
      const cle = w.entreeDonjon(g.donjon)?.cle ?? '8545', c = this.duJeu(n.x, n.y);
      const d = this.marque('mk gd', c.x, c.y + 20); d.innerHTML = iconHtml(ITEMS.resources[cle]?.icon ?? 0); d.title = `${n.def.nom} · ${this.etatDonjon(g.donjon)}`;
    }
    // quête suivie (Tour 8A) et trajet en pointillés (Flèche 5A)
    const it = Q?.itineraire(), qs = Q?.suivie && Q.def(Q.suivie);
    let surBut: { x: number; y: number } | null = null;
    if (it && qs && it.pts.length && this.filtres.quetes) {
      const der = it.pts[it.pts.length - 1];
      let prev = this.duJeu(w.player.x, w.player.y);
      for (const o of it.pts) {
        const c = this.duJeu(o.x, o.y), L = Math.hypot(c.x - prev.x, c.y - prev.y), n = Math.min(400, Math.floor(L / 14));
        for (let i = 1; i < n; i++) this.marque('mk tr', prev.x + (c.x - prev.x) * i / n, prev.y + (c.y - prev.y) * i / n);
        prev = c;
      }
      const c = this.duJeu(der.x, der.y), d = this.marque('mk qt', c.x, c.y); surBut = c;
      d.innerHTML = `<img src="${v(`assets/ui/quetes/${QUEST_ICON[qs.type][1]}.png`)}" alt="">`;
      d.title = `${qs.nom} · ${it.nom}`;
    }
    const ve = Q?.marqueVendeur && Q.pnj(Q.marqueVendeur);
    if (ve) { const c = this.duJeu(ve.x, ve.y), d = this.marque('mk vd', c.x, c.y); d.innerHTML = iconHtml(ITEMS.resources['8143']?.icon ?? 0); d.title = `${ve.def.nom} · clés de donjon`; }
    if (surQuete && surBut) this.centreVoulu = surBut;
    if (ou) {
      const pts = [...new Set(ou.tags)].filter(t => wg.mapByTag(t)).map(t => { const [x, y] = t.split('_').map(Number); return DEHORS.test(t) ? this.u2p(x + 0.5, y + 0.5) : this.duJeu(...centreCarte(w, t)); })
        .concat(ou.points.map(q => this.duJeu(q.x, q.y)));
      const ic = ou.img ? `<img class="ic" src="${ou.img}" alt="">` : iconHtml(ou.icone);
      for (const q of pts) { const d = this.marque('mk ou', q.x, q.y); d.innerHTML = ic; d.title = ou.titre; }
      if (pts.length) this.centreVoulu = { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, y: pts.reduce((s, q) => s + q.y, 0) / pts.length };
      const t = document.createElement('div'); t.className = 'ttlou'; t.innerHTML = `${ic}Où trouver : ${esc(ou.titre)} (${pts.length} endroit${pts.length > 1 ? 's' : ''})`;
      this.vue.appendChild(t);
    }
    // 0.5 « monde vivant » (2D) : boss du monde (là, ou annoncé), invasion de l'heure et son coffre, petits événements
    const vv = w.vueVivant;
    if (vv && this.filtres.vivant) {
      const bm = bossAnnonce(w);
      if (bm) {
        const ici = vv.boss && !vv.boss.fin ? this.duJeu(vv.boss.x, vv.boss.y) : wg.mapByTag(bm.carte) ? this.duJeu(...centreCarte(w, bm.carte)) : null;
        if (ici) { const d = this.marque('mk bm', ici.x, ici.y, '☠'); d.title = `${bm.nom} · ${vv.boss && !vv.boss.fin ? 'il est là' : 'annoncé'}`; }
      }
      const inv = vv.invasion;
      if (inv && w.vivant) {
        const c = inv.coffre ?? w.vivant.centreSousZone(inv.sub), q = this.duJeu(c.x, c.y);
        const d = this.marque('mk iv', q.x, q.y, inv.coffre ? '✦' : '⚔'); d.title = inv.coffre ? `Coffre d'invasion · ${inv.nom}` : `Invasion · ${inv.nom} (${inv.jauge} / ${inv.max})`;
      }
      for (const e of vv.evenements) if (!e.fin) { const q = this.duJeu(e.x, e.y), d = this.marque('mk ev', q.x, q.y, '!'); d.title = e.sorte === 'defense' ? `Défends ${e.nom}` : 'Coffre gardé'; }
    }
    // tombe de la dernière mort (15A)
    const tb = w.player.tombe;
    if (tb && tb.zone === this.zoneId) { const c = this.duJeu(tb.x, tb.y), d = this.marque('mk tb', c.x, c.y); d.textContent = '🪦'; d.title = 'Ta dernière chute : repasse ici'; }
    this.moi = this.marque('mk moi', 0, 0); this.moi.innerHTML = '<b></b><i></i>';
  }

  /** 10C : clé, victoire et meilleur temps d'un donjon. */
  private etatDonjon(nom: string) {
    const w = this.world, b = w.quetes?.donjons[nom], cle = w.entreeDonjon(nom)?.cle;
    const morceaux = [nom];
    if (cle) morceaux.push((w.player.resources[cle] ?? 0) > 0 ? 'clé ✓' : 'sans clé');
    if (b?.v) morceaux.push(`fini ✓ ×${b.v}`);
    if (b?.t) morceaux.push(`record ${Math.floor(b.t / 60)}:${String(Math.round(b.t % 60)).padStart(2, '0')}`);
    return morceaux.join(' · ');
  }

  /** 8B : régions de la feuille de route sur la carte peinte (jouable en couleur, la suite voilée et étiquetée). */
  private dessinerRegions(test: boolean) {
    const pe = CD.peintes['1'], x0 = Math.floor(-pe.ox / pe.mw), y0 = Math.floor(-pe.oy / pe.mh);
    const nx = Math.ceil(pe.w / pe.k / pe.mw) + 1, ny = Math.ceil(pe.h / pe.k / pe.mh) + 1;
    const t = this.toile(x0, y0, nx, ny, 1), g = t.getContext('2d')!;
    g.fillStyle = 'rgba(10,12,18,.5)'; g.fillRect(0, 0, nx, ny);
    for (const r of CD.regions) {
      const jouable = r.ver === 'jouable' || (r.ver === '0.4' && test);
      for (const [x, y] of r.cases) {
        g.clearRect(x - x0, y - y0, 1, 1);
        if (!jouable) { g.fillStyle = `${VER_COUL[r.ver] ?? '#888888'}44`; g.fillRect(x - x0, y - y0, 1, 1); g.fillStyle = 'rgba(10,12,18,.35)'; g.fillRect(x - x0, y - y0, 1, 1); }
      }
    }
    // une étiquette par grande région (« Frigost : les sommets » et « Frigost : Champs de glace » → Frigost, versions 0.6 → 0.10)
    const groupes = new Map<string, Region[]>();
    for (const r of CD.regions) { const base = r.lab.split(/ : | \(/)[0].trim(); (groupes.get(base) ?? groupes.set(base, []).get(base)!).push(r); }
    const num = (v2: string) => v2.split('.').map(Number).reduce((a, b2) => a * 100 + b2, 0);
    for (const [base, l] of groupes) {
      const cases = l.flatMap(r => r.cases), cx = cases.reduce((s2, c) => s2 + c[0] + 0.5, 0) / cases.length, cy = cases.reduce((s2, c) => s2 + c[1] + 0.5, 0) / cases.length, q = this.u2p(cx, cy);
      const jouable = l.some(r => r.ver === 'jouable' || (r.ver === '0.4' && test));
      const vers = [...new Set(l.map(r => r.ver).filter(x => x !== 'jouable' && !(x === '0.4' && test)))].sort((a, b2) => num(a) - num(b2));
      const nivs = l.flatMap(r => (r.niv ?? '').match(/\d+/g) ?? []).map(Number);
      const ver = vers.length ? `Version${vers.length > 1 ? 's' : ''} ${vers[0]}${vers.length > 1 ? ` → ${vers[vers.length - 1]}` : ''}` : '';
      const el = this.marque('mk rg', q.x, q.y);
      el.innerHTML = `${esc(base)}<small style="color:${vers.length ? VER_COUL[vers[0]] ?? '#ccc' : '#9ad15a'}">${[jouable ? 'Jouable' : '', ver, nivs.length ? `niv. ${Math.min(...nivs)} → ${Math.max(...nivs)}` : ''].filter(Boolean).join(' · ')}</small>`;
    }
  }

  // --- plan des intérieurs (13A) --------------------------------------------------------------------------------
  private montrerSalles(groupe: string, salles: Salle[]) {
    const root = this.root!, w = this.world, wg = w.worldGrid!, ici = wg.mapAt(w.player.x, w.player.y)?.tag;
    this.onglet = ''; root.querySelectorAll<HTMLElement>('.ong span').forEach(s => s.classList.remove('on'));
    const tags = new Set(salles.map(s => s.tag)), liens = new Map<string, Set<string>>(), sorties = new Set<string>();
    for (const po of w.zone.open?.portes ?? []) {
      const a = po.a[0], b = po.b[0];
      if (tags.has(a) && tags.has(b)) { (liens.get(a) ?? liens.set(a, new Set()).get(a)!).add(b); (liens.get(b) ?? liens.set(b, new Set()).get(b)!).add(a); }
      else if (tags.has(a) && DEHORS.test(b)) sorties.add(a); else if (tags.has(b) && DEHORS.test(a)) sorties.add(b);
    }
    // ordre : en partant d'une sortie, de proche en proche ; rangées en serpentin
    const ordre: string[] = [], file = [[...sorties].sort((x, y) => x.localeCompare(y, 'fr', { numeric: true }))[0] ?? salles[0].tag];
    while (file.length || ordre.length < salles.length) {
      const t = file.shift() ?? salles.find(s => !ordre.includes(s.tag))!.tag;
      if (ordre.includes(t)) continue; ordre.push(t);
      for (const n of liens.get(t) ?? []) if (!ordre.includes(n)) file.push(n);
    }
    const CW = 230, CH = 170, pad = 30, cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(ordre.length * 1.7)), Math.floor((this.vue.clientWidth - pad * 2 + 40) / (CW + 40))));
    const place = new Map<string, { x: number; y: number }>();
    ordre.forEach((t, i) => { const r = Math.floor(i / cols), k = i % cols, kk = r % 2 ? cols - 1 - k : k; place.set(t, { x: pad + kk * (CW + 40), y: pad + 34 + r * (CH + 40) }); });
    const div = document.createElement('div'); div.className = 'salles';
    const W = pad * 2 + cols * (CW + 40), H = pad * 2 + 34 + Math.ceil(ordre.length / cols) * (CH + 40);
    let svg = `<svg width="${W}" height="${H}">`;
    for (const [a, l] of liens) for (const b of l) if (a < b) { const p = place.get(a)!, q = place.get(b)!; svg += `<line x1="${p.x + CW / 2}" y1="${p.y + CH / 2}" x2="${q.x + CW / 2}" y2="${q.y + CH / 2}" stroke="#f2d36b88" stroke-width="3" stroke-dasharray="6 6"/>`; }
    svg += '</svg>';
    const nom = w.lieu ?? w.lieux?.get(ici ?? '') ?? groupe;
    div.innerHTML = `<div class="mk sz" style="position:absolute;left:${pad}px;top:8px;transform:none;font-size:15px">${esc(String(nom))} · plan des salles</div>${svg}` + ordre.map((t, i) => {
      const s = salles.find(x => x.tag === t)!, p = place.get(t)!, k = Math.min(CW / s.du[0], CH / s.du[1]);
      const lw = s.du[0] * k, lh = s.du[1] * k;
      return `<div class="sl${t === ici ? ' ici' : ''}" data-t="${t}" style="left:${p.x + (CW - lw) / 2}px;top:${p.y + (CH - lh) / 2}px;width:${lw}px;height:${lh}px;background-image:url('${v(`${this.dir(this.monde)}/${s.img}`)}')"><span>Salle ${i + 1}</span>${sorties.has(t) ? '<em class="so">Sortie</em>' : t.startsWith('arene_') ? '<em class="bo">Boss</em>' : ''}</div>`;
    }).join('');
    this.vue.appendChild(div);
    // le perso dans sa salle
    const s = salles.find(x => x.tag === ici), el = s && div.querySelector<HTMLElement>(`.sl[data-t="${ici}"]`);
    if (s && el) {
      const P = this.plans.get(this.monde)!, pp = this.duJeu(w.player.x, w.player.y), u = { x: (pp.x - P.carte.ox) / P.carte.cw, y: (pp.y - P.carte.oy) / P.carte.ch };
      const m = document.createElement('div'); m.className = 'moi'; m.innerHTML = '<i></i>';
      m.style.left = `${el.offsetLeft + (u.x - s.u[0]) / s.du[0] * el.offsetWidth}px`; m.style.top = `${el.offsetTop + (u.y - s.u[1]) / s.du[1] * el.offsetHeight}px`;
      div.appendChild(m);
    }
    const xp = root.querySelector('.ttl .xp')!; xp.innerHTML = `${salles.length} salles · clic sur un onglet pour la carte du monde`;
  }

  // --- survol (3A, 9D) ------------------------------------------------------------------------------------------
  private survoler(e: PointerEvent) {
    const P = this.P; if (!P || !this.root || this.sur) return;
    const r = this.vue.getBoundingClientRect(), u = this.p2u((e.clientX - r.left - this.pos.x) / this.zoom, (e.clientY - r.top - this.pos.y) / this.zoom);
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    this.root.querySelector('.co')!.textContent = `[${tx}, ${ty}]`;
    if (this.onglet === '_douze') return;
    const m = P.maps.find(k => k[0] === tx && k[1] === ty), sub = m ? m[2] : -1;
    let b = this.root.querySelector<HTMLDivElement>('.bulle');
    if (sub < 0) { b?.remove(); this.survol = -1; if (this.surCanvas) this.surCanvas.style.display = 'none'; return; }
    if (!b) { b = document.createElement('div'); b.className = 'bulle'; this.vue.appendChild(b); }
    const bx = e.clientX - r.left + 18, by = e.clientY - r.top + 14;
    b.style.left = `${Math.min(bx, r.width - 310)}px`; b.style.top = `${Math.min(by, r.height - 200)}px`;
    if (sub === this.survol) return;
    this.survol = sub;
    const zone = this.zoneDe(this.onglet), d = GAME_DATA.zones[zone]?.open?.subareas[String(sub)], w = this.world, test = w.essaiOuvert;
    if (!d) { b.remove(); return; }
    const cases = P.maps.filter(k => k[2] === sub), vus = w.player.exploreSet(zone), essai = cases.some(k => k[3]) && !test;
    const pc = Math.round(100 * cases.filter(k => vus.has(`${k[0]}_${k[1]}`)).length / cases.length);
    const M = GAME_DATA.monsters, nomM = (id: string) => M[id]?.name ?? id;
    const archis = Object.entries(M).filter(([, x]) => x.archiDe && d.monsters.includes(x.archiDe)).map(([id]) => id);
    const tags = new Set(cases.map(k => `${k[0]}_${k[1]}`));
    const res = [...new Set(((RECOLTES as unknown as Record<string, [string, number, string][]>)[zone] ?? []).filter(e2 => tags.has(e2[0])).map(e2 => RECOLTES.ressources[e2[2]]?.nom).filter(Boolean))];
    const donjons = P.reperes.filter(x => x.c === 6 && tags.has(x.t)).map(x => x.n);
    b.innerHTML = `<h4>${esc(d.name)}</h4><div>Niveau ${d.level}${d.region ? ` · ${esc(d.region)}` : ''}${essai ? ' · <span class="el">Bientôt (0.4)</span>' : ''}</div>
      ${d.monsters.length ? `<div class="l"><b>Monstres</b> : ${d.monsters.map(nomM).map(esc).join(', ')}</div>` : ''}
      ${d.elite ? `<div class="l el">Élite : ${esc(nomM(d.elite))}</div>` : ''}
      ${archis.length ? `<div class="l el">Archimonstre${archis.length > 1 ? 's' : ''} (${archis.filter(a => w.player.ames.includes(a)).length} / ${archis.length} capturés) : ${archis.slice(0, 4).map(a => esc(nomM(a)) + (w.player.ames.includes(a) ? ' ✔' : '')).join(', ')}${archis.length > 4 ? '…' : ''}</div>` : ''}
      ${res.length ? `<div class="l"><b>Ressources</b> : ${res.slice(0, 8).map(x => esc(x!)).join(', ')}${res.length > 8 ? '…' : ''}</div>` : ''}
      ${donjons.map(n => `<div class="l"><b>Donjon</b> : ${esc(this.estIci() ? this.etatDonjon(n) : n)}</div>`).join('')}
      <div class="l ${pc === 100 ? 'ok' : ''}">Exploré : ${pc} %</div>`;
    // contour lumineux de la sous-zone
    const t = this.surCanvas!, xs = cases.map(k => k[0]), ys = cases.map(k => k[1]), x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1;
    const nx = Math.max(...xs) - x0 + 2, ny = Math.max(...ys) - y0 + 2, S = Math.max(12, Math.min(48, Math.floor(1600 / Math.max(nx, ny))));
    t.width = nx * S; t.height = ny * S; const q = this.u2p(x0, y0), c = P.carte;
    Object.assign(t.style, { display: 'block', left: `${q.x}px`, top: `${q.y}px`, width: `${nx * c.cw}px`, height: `${ny * c.ch}px` });
    const g = t.getContext('2d')!; g.clearRect(0, 0, t.width, t.height);
    g.fillStyle = 'rgba(255,233,168,.14)';
    for (const k of cases) g.fillRect((k[0] - x0) * S, (k[1] - y0) * S, S, S);
    g.strokeStyle = '#ffe9a8'; g.lineWidth = S / 9; g.shadowColor = '#ffd76a'; g.shadowBlur = S / 3; g.beginPath();
    for (const k of cases) {
      const X = (k[0] - x0) * S, Y = (k[1] - y0) * S, a = (dx: number, dy: number) => tags.has(`${k[0] + dx}_${k[1] + dy}`);
      if (!a(0, -1)) { g.moveTo(X, Y); g.lineTo(X + S, Y); }
      if (!a(0, 1)) { g.moveTo(X, Y + S); g.lineTo(X + S, Y + S); }
      if (!a(-1, 0)) { g.moveTo(X, Y); g.lineTo(X, Y + S); }
      if (!a(1, 0)) { g.moveTo(X + S, Y); g.lineTo(X + S, Y + S); }
    }
    g.stroke();
  }

  // --- recherche (4D) -------------------------------------------------------------------------------------------
  private chercher(texte: string) {
    const box = this.root?.querySelector('.res'); if (!box) return;
    const q = sansAccent(texte.trim());
    if (q.length < 2 || !this.P) { box.innerHTML = ''; return; }
    const P = this.P, zone = this.zoneDe(this.onglet === '_douze' ? 'astrub' : this.onglet), subs = GAME_DATA.zones[zone]?.open?.subareas ?? {}, test = this.world.essaiOuvert;
    const essai = new Set(P.maps.filter(m => m[3] && !test).map(m => m[2]));
    const res: { nom: string; genre: string; u: [number, number][] }[] = [];
    const centreSub = (sub: number) => { const l = P.maps.filter(m => m[2] === sub); return [l.reduce((s, m) => s + m[0] + 0.5, 0) / l.length, l.reduce((s, m) => s + m[1] + 0.5, 0) / l.length] as [number, number]; };
    for (const [id, d] of Object.entries(subs)) if (!essai.has(+id) && sansAccent(d.name).includes(q) && P.maps.some(m => m[2] === +id)) res.push({ nom: d.name, genre: `niv. ${d.level}`, u: [centreSub(+id)] });
    for (const r of P.reperes) {
      if (!famille(r) || (secret(r) && !this.world.player.lieuxVus.includes(cleLieu(zone, r))) || !sansAccent(r.n).includes(q)) continue;
      const [x, y] = r.t.split('_').map(Number); res.push({ nom: nomLieu(r), genre: 'lieu', u: [[x + 0.5, y + 0.5]] });
    }
    const monstres = new Map<string, number[]>();
    for (const [id, d] of Object.entries(subs)) if (!essai.has(+id)) for (const m of d.monsters) if (sansAccent(GAME_DATA.monsters[m]?.name ?? '').includes(q)) (monstres.get(m) ?? monstres.set(m, []).get(m)!).push(+id);
    for (const [m, l] of monstres) res.push({ nom: GAME_DATA.monsters[m].name, genre: 'monstre', u: l.filter(s => P.maps.some(x => x[2] === s)).map(centreSub) });
    const ress = new Map<string, [number, number][]>();
    for (const e of (RECOLTES as unknown as Record<string, [string, number, string][]>)[zone] ?? []) {
      const d = RECOLTES.ressources[e[2]]; if (!d || !sansAccent(d.nom).includes(q) || !DEHORS.test(e[0])) continue;
      const [x, y] = e[0].split('_').map(Number), m = P.maps.find(k => k[0] === x && k[1] === y); if (!m || (m[3] && !test)) continue;
      const l = ress.get(d.nom) ?? ress.set(d.nom, []).get(d.nom)!; if (!l.some(c => c[0] === x + 0.5 && c[1] === y + 0.5)) l.push([x + 0.5, y + 0.5]);
    }
    for (const [n, l] of ress) res.push({ nom: n, genre: `ressource · ${l.length}`, u: l });
    if (this.estIci()) for (const n of this.world.quetes?.pnjs ?? []) if (sansAccent(n.def.nom).includes(q)) { const u = this.versUnites(n.x, n.y); if (u) res.push({ nom: n.def.nom, genre: 'PNJ', u: [[u.x, u.y]] }); }
    const vus = res.filter(r => r.u.length).slice(0, 14);
    box.innerHTML = vus.length ? vus.map((r, i) => `<div data-i="${i}"><span>${esc(r.nom)}</span><small>${esc(r.genre)}</small></div>`).join('') : '<small>Rien trouvé</small>';
    box.querySelectorAll<HTMLElement>('[data-i]').forEach(el => el.addEventListener('click', () => {
      const r = vus[+el.dataset.i!];
      this.plan.querySelectorAll('.mk.ou.cherche').forEach(x => x.remove());
      for (const [x, y] of r.u) { const p = this.u2p(x, y), d = this.marque('mk ou cherche', p.x, p.y); d.title = r.nom; }
      const cx = r.u.reduce((s, c) => s + c[0], 0) / r.u.length, cy = r.u.reduce((s, c) => s + c[1], 0) / r.u.length, p = this.u2p(cx, cy);
      this.centrer(p.x, p.y, Math.max(this.zoom, 0.5));
    }));
  }

  // --- drapeaux (9A, 14C) ---------------------------------------------------------------------------------------
  private poserDrapeau(ux: number, uy: number) {
    const p = this.world.player, zone = this.zoneId, l = p.drapeaux.slice();
    const pr = l.findIndex(d => d.zone === zone && Math.hypot((d.x - ux) * this.P!.carte.cw, (d.y - uy) * this.P!.carte.ch) * this.zoom < 16);
    if (pr >= 0) { l.splice(pr, 1); if (this.suivi === pr) this.suivi = null; else if (this.suivi != null && this.suivi > pr) this.suivi--; }
    else {
      if (l.length >= MAX_DRAPEAUX) { l.shift(); if (this.suivi != null) this.suivi = this.suivi > 0 ? this.suivi - 1 : null; }
      l.push({ zone, x: Math.round(ux * 100) / 100, y: Math.round(uy * 100) / 100 });
    }
    Son.jouer(MANIFESTE.ui.bouton, 'interface', { vol: 0.7 });
    this.onGeste({ drapeaux: l });
    p.drapeaux = l;   // tout de suite à l'écran ; la partie confirme à la prochaine image
    this.dernierDyn = '';
  }
  private fermerEdit() { this.root?.querySelector('.edit')?.remove(); }
  private editerDrapeau(i: number, el: HTMLElement) {
    this.fermerEdit();
    const d = this.world.player.drapeaux[i]; if (!d) return;
    const r = this.vue.getBoundingClientRect(), e = el.getBoundingClientRect(), box = document.createElement('div'); box.className = 'edit';
    box.style.left = `${Math.min(e.left - r.left + 20, r.width - 230)}px`; box.style.top = `${Math.max(8, e.top - r.top - 30)}px`;
    box.innerHTML = `<input type="text" maxlength="${NOTE_MAX}" placeholder="Note (${NOTE_MAX} lettres)" value="${esc(d.note ?? '')}"><div><span data-a="suivre">${this.suivi === i ? 'Ne plus suivre' : 'Suivre'}</span><span data-a="retirer">Retirer</span></div>`;
    this.vue.appendChild(box);
    const inp = box.querySelector('input')!; inp.focus();
    const garder = () => { const l = this.world.player.drapeaux.slice(); if (!l[i]) return; l[i] = { ...l[i], ...(inp.value.trim() ? { note: inp.value.trim().slice(0, NOTE_MAX) } : {}) }; if (!inp.value.trim()) delete l[i].note; this.onGeste({ drapeaux: l }); this.world.player.drapeaux = l; this.dernierDyn = ''; };
    inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { garder(); this.fermerEdit(); } if (ev.key === 'Escape') this.fermerEdit(); });
    inp.addEventListener('change', garder);
    box.querySelector('[data-a=suivre]')!.addEventListener('click', () => { this.suivi = this.suivi === i ? null : i; this.fermerEdit(); this.dernierDyn = ''; });
    box.querySelector('[data-a=retirer]')!.addEventListener('click', () => { this.fermerEdit(); this.poserDrapeau(d.x, d.y); });
  }

  // --- dessin ---------------------------------------------------------------------------------------------------
  private image(src: string, l: number, t: number, w: number, h: number) {
    const im = document.createElement('img'); im.src = src; im.alt = '';
    Object.assign(im.style, { left: `${l}px`, top: `${t}px`, width: `${w}px`, height: `${h}px` }); this.plan.appendChild(im); return im;
  }
  /** Toile d'un pixel par case [x0, y0] → [x0 + nx, y0 + ny], étirée et adoucie (bords fondus du brouillard). */
  private toile(x0: number, y0: number, nx: number, ny: number, k: number) {
    const t = document.createElement('canvas'); t.width = nx * k; t.height = ny * k;
    const c = this.P!.carte, q = this.u2p(x0, y0);
    Object.assign(t.style, { left: `${q.x}px`, top: `${q.y}px`, width: `${nx * c.cw}px`, height: `${ny * c.ch}px` });
    this.plan.appendChild(t); return t;
  }
  private marque(cls: string, x: number, y: number, texte = '') {
    const d = document.createElement('div'); d.className = cls; d.textContent = texte;
    d.style.left = `${x}px`; d.style.top = `${y}px`; d.style.scale = String(1 / this.zoom); this.plan.appendChild(d);
    return d;
  }
  private appliquer() {
    if (!this.plan) return;
    this.plan.style.transform = `translate(${this.pos.x}px,${this.pos.y}px) scale(${this.zoom})`;
    // les marques gardent leur taille quel que soit le zoom
    const s = String(1 / this.zoom);
    this.plan.querySelectorAll<HTMLElement>('.mk').forEach(m => { m.style.scale = s; });
    // 1C : notre rendu s'efface en dézoomant, la carte peinte reste
    if (this.notre) this.notre.style.opacity = String(this.onglet === '_douze' ? Math.min(1, Math.max(0, (this.zoom - 0.3) / 0.25)) : Math.min(1, Math.max(0, (this.zoom - 0.14) / 0.16)));
    // noms des sous-zones : seulement assez près
    this.plan.querySelectorAll<HTMLElement>('.mk.sz').forEach(m => { m.style.display = this.zoom < 0.22 ? 'none' : ''; });
    this.regrouper();
  }
  /** 4C : repères proches regroupés en dézoomant (« ×10 »). */
  private regrouper() {
    const z = Math.round(this.zoom * 50); if (z === this.zoomGroupe) return; this.zoomGroupe = z;
    const cases = new Map<string, Marque[]>(), seuil = 0.55, pas = 34 / this.zoom;
    for (const m of this.marques) {
      m.n?.remove(); m.n = undefined;
      if (this.zoom >= seuil) { m.el.classList.remove('cache'); continue; }
      const k = `${m.f === 'recoltes' ? 'r' : 'p'}${Math.floor(m.x / pas)}_${Math.floor(m.y / pas)}`;
      (cases.get(k) ?? cases.set(k, []).get(k)!).push(m);
    }
    for (const l of cases.values()) l.forEach((m, i) => {
      m.el.classList.toggle('cache', i > 0);
      if (i === 0 && l.length > 1) { const n = document.createElement('span'); n.className = 'n'; n.textContent = `×${l.length}`; m.el.appendChild(n); m.n = n; }
    });
  }
  private majTitre(zone: string, P: PlanMonde) {
    const el = this.root?.querySelector('.ttl .xp'); if (!el) return;
    if (this.onglet === '_douze') { el.innerHTML = 'Le Monde des Douze · <b>en couleur</b> : jouable aujourd\'hui'; return; }
    const p = this.world.player, vus = p.exploreSet(zone), test = this.world.essaiOuvert;
    const l = P.maps.filter(m => !m[3] || test), n = l.filter(m => vus.has(`${m[0]}_${m[1]}`)).length;
    const lieux = P.reperes.filter(r => aDecouvrir(r) && !(P.maps.find(m => `${m[0]}_${m[1]}` === r.t)?.[3] && !test));
    const trouves = lieux.filter(r => p.lieuxVus.includes(cleLieu(zone, r))).length;
    el.innerHTML = `Exploré <b>${l.length ? Math.round(100 * n / l.length) : 0} %</b> · Lieux découverts <b>${trouves} / ${lieux.length}</b>`;
  }
  /** 18A : la carte prend la teinte de l'heure (comme le jeu). */
  private majNuit() {
    const n = this.root?.querySelector<HTMLElement>('.nuit'); if (!n) return;
    const a = ambiance(chargerReglages(), new Date(), false), c = a.tint;
    n.style.background = `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`; n.style.opacity = this.onglet === '_douze' ? '0' : '0.55';
  }

  /** Appelé à chaque image tant que la carte est ouverte : le perso, le groupe, les drapeaux, les signaux. */
  update() {
    if (!this.root || !this.P || !this.estIci() || !this.plan) return;
    const w = this.world, p = w.player, zone = this.zoneId;
    if (this.moi) {
      const q = this.duJeu(p.x, p.y), s = ISO.toScreen(Math.cos(p.facing), Math.sin(p.facing));
      this.moi.style.left = `${q.x}px`; this.moi.style.top = `${q.y}px`;
      (this.moi.firstElementChild as HTMLElement).style.transform = `rotate(${Math.atan2(s.y, s.x) + Math.PI / 2}rad)`;
      if (this.sur) { const r = this.vue.getBoundingClientRect(); this.pos = { x: r.width / 2 - q.x * this.zoom, y: r.height / 2 - q.y * this.zoom }; this.plan.style.transform = `translate(${this.pos.x}px,${this.pos.y}px) scale(${this.zoom})`; }
    }
    // groupe (10A), drapeaux de chacun (9A, 14A), signaux (14B) : refaits quand ils changent
    const autres = w.players.filter(o => o !== p);
    const cle = JSON.stringify([this.suivi, w.players.map(o => [Math.round(o.x / 40), Math.round(o.y / 40), o.drapeaux, o.signal?.t ?? 0]), this.filtres.groupe, this.filtres.drapeaux]);
    if (cle === this.dernierDyn) return;
    this.dernierDyn = cle;
    for (const el of this.dynamiques) el.remove();
    this.dynamiques = [];
    w.players.forEach((o, i) => {
      const coul = COULEURS_GROUPE[i % COULEURS_GROUPE.length];
      if (o !== p && this.filtres.groupe) { const q = this.duJeu(o.x, o.y), d = this.marque('mk gp', q.x, q.y); d.style.background = coul; d.innerHTML = `<span>${esc(o.nom || `Joueur ${i + 1}`)}</span>`; this.dynamiques.push(d); }
      if (this.filtres.drapeaux) o.drapeaux.forEach((d, j) => {
        if (d.zone !== zone) return;
        const q = this.u2p(d.x, d.y), el = this.marque(`mk dr${o === p && this.suivi === j ? ' suivi' : ''}`, q.x, q.y);
        el.innerHTML = `<svg viewBox="0 0 24 32"><rect x="2" y="2" width="2.5" height="30" fill="#3a2a14"/><path d="M4 3 L22 8 L4 14 Z" fill="${o === p ? '#f2d36b' : coul}" stroke="#000" stroke-width="1"/></svg>${d.note ? `<span>${esc(d.note)}</span>` : ''}`;
        el.title = `${o === p ? 'Ton drapeau' : `Drapeau de ${o.nom || 'ton allié'}`}${d.note ? ` · ${d.note}` : ''} · [${Math.floor(d.x)}, ${Math.floor(d.y)}]`;
        if (o === p) el.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (ev.button === 0) this.editerDrapeau(j, el); else if (ev.button === 2) this.poserDrapeau(d.x, d.y); });
        else el.style.pointerEvents = 'none';
        this.dynamiques.push(el);
      });
      if (o.signal && o.signal.zone === zone && w.time - o.signal.t < 4) { const q = this.duJeu(o.signal.x, o.signal.y), el = this.marque('mk sg', q.x, q.y); el.style.borderColor = coul; this.dynamiques.push(el); }
    });
    void autres;
  }
}

/** Centre d'une carte (intérieur) en point du jeu. */
function centreCarte(w: World, tag: string): [number, number] {
  const wg = w.worldGrid!, m = wg.cellCenter(wg.cellOf(tag, 280)), s = wg.toScreen(m.x, m.y), q = ISO.toWorld(s.x, s.y);
  return [q.x, q.y];
}
