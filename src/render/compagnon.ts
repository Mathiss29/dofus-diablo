// Écran du bas de l'AYN Thor (« Écran du bas : » 1A 2A+2B 3A-3D 4A-4C 5A+5B 6A+6B 7A 8A 9B, 2026-11-16) : la page
// diablofus.com/#compagnon, ouverte dans Chrome sur l'écran du bas pendant que le jeu tourne en haut, montre la carte, le sac,
// le perso et les quêtes, et reçoit les fenêtres du jeu. Les deux pages se parlent par le lien direct (BroadcastChannel) et,
// en secours, par le stockage partagé (événement storage). Sans le jeu, la page lit la sauvegarde (lecture seule, 9B).
// Ce fichier : le canal et le côté jeu (muet tant qu'aucun écran du bas ne s'est annoncé). La page : compagnonPage.ts.
import { diagGpu, type DiagGpu } from './diagGpu';
import type { CarteBas, EtatBas, QuetesBas, SacBas } from './compagnonEtat';
import { CSS_JEU, MiroirJeu, stylesDuJeu, type EvtBas, type FenetreBas } from './miroir';
import type { AccueilBas } from './accueilThor';

export type OngletBas = 'carte' | 'sac' | 'perso' | 'quetes' | 'tchat';
/** Une ligne du tchat ou du journal (« Interfaces Thor : » 4C+4D) : html déjà mis en forme par chat.ts ; journal = ligne du jeu (butin, combat…). */
export interface LigneTchat { h: string; j: boolean; c?: string }
export type ActionCompagnon = 'potion' | 'inv' | 'sorts' | 'car' | 'carte' | 'quetes' | 'job' | 'succes' | 'fermer' | 'recharger';
/** Ordres de l'écran du bas vers le jeu. */
export type OrdreBas =
  | { k: 'equiper'; uid: number } | { k: 'retirer'; slot: string } | { k: 'cadenas'; uid: number } | { k: 'defaire'; uid: number }
  | { k: 'fiche'; uid: number; porte: boolean } | { k: 'fleche'; x: number; y: number } | { k: 'zaap'; i: number } | { k: 'evt'; e: EvtBas } | { k: 'interagir' } | { k: 'dire'; texte: string }
  | { k: 'raccourci'; id: string } | { k: 'allie'; id: number } | { k: 'volume'; musique?: number; effets?: number; muet?: boolean };
export type MsgCompagnon =
  | { k: 'bonjour'; neuf?: boolean } | { k: 'ping'; n: number; t: number } | { k: 'pong'; n: number; t: number }
  | { k: 'etat'; e: EtatBas | null } | { k: 'carte'; c: CarteBas | null } | { k: 'sac'; s: SacBas | null } | { k: 'quetes'; q: QuetesBas | null }
  | { k: 'fiche'; uid: number; html: string } | { k: 'fenetre'; f: FenetreBas | null } | { k: 'styles'; css: string } | { k: 'onglet'; o: OngletBas | 'suivant' }
  | { k: 'tchat'; l: LigneTchat[]; enLigne: boolean } | { k: 'annonce'; t: string; c?: string; uid?: number } | { k: 'bilan'; titre: string; lignes: string[] } | { k: 'diag'; d: DiagGpu } | { k: 'action'; a: ActionCompagnon } | { k: 'ordre'; o: OrdreBas } | { k: 'accueil'; a: AccueilBas | null };
export type Lien = 'direct' | 'stockage';
type De = 'jeu' | 'ecran';
interface Enveloppe { de: De; id: string; m: MsgCompagnon }

const CANAL = 'diablofus-compagnon', CLE = 'diablofus.compagnon.';
/** Messages lourds : seulement par le lien direct quand il existe (le stockage partagé est petit et lent). */
const LOURDS = new Set(['styles', 'fenetre', 'sac', 'quetes', 'fiche', 'carte', 'tchat']);

/** Les deux voies directes entre le jeu et l'écran du bas. Chaque message part sur les deux, il n'est traité qu'une fois. */
export class Canal {
  private bc: BroadcastChannel | null = null;
  private vus = new Set<string>();
  private n = 0;
  /** Dernier message reçu par chaque voie (performance.now()), 0 = jamais. */
  recu: Record<Lien, number> = { direct: 0, stockage: 0 };
  ecoute: ((m: MsgCompagnon, par: Lien) => void) | null = null;
  constructor(private moi: De) {
    try { this.bc = new BroadcastChannel(CANAL); this.bc.onmessage = e => this.recevoir(e.data as Enveloppe, 'direct'); } catch { /* navigateur sans BroadcastChannel */ }
    addEventListener('storage', e => {
      if (e.key !== CLE + (moi === 'jeu' ? 'ecran' : 'jeu') || !e.newValue) return;
      try { this.recevoir(JSON.parse(e.newValue) as Enveloppe, 'stockage'); } catch { /* message abîmé */ }
    });
  }
  get direct() { return !!this.bc; }
  private recevoir(env: Enveloppe, par: Lien) {
    if (!env?.m || env.de === this.moi) return;
    this.recu[par] = performance.now();
    if (this.vus.has(env.id)) return;
    this.vus.add(env.id);
    if (this.vus.size > 200) this.vus = new Set([...this.vus].slice(-100));
    this.ecoute?.(env.m, par);
  }
  envoyer(m: MsgCompagnon) {
    const env: Enveloppe = { de: this.moi, id: `${this.moi}${Date.now().toString(36)}${(this.n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`, m };
    try { this.bc?.postMessage(env); } catch { /* fermé */ }
    if (this.bc && LOURDS.has(m.k)) return;
    try { localStorage.setItem(CLE + this.moi, JSON.stringify(env)); } catch { /* stockage indisponible ou plein */ }
  }
}

// ---------- Côté jeu (écran du haut) : muet tant qu'aucun écran du bas ne s'est annoncé ----------
export interface BrancheCompagnon {
  /** null : pas en jeu (vitrine de l'accueil). */
  etat(): EtatBas | null;
  carte(): CarteBas | null;
  sac(): SacBas | null;
  quetes(): QuetesBas | null;
  tchat(): { l: LigneTchat[]; enLigne: boolean } | null;
  fiche(uid: number, porte: boolean): string;
  /** Fenêtre du jeu à montrer en bas (null : aucune, ou une qui reste en haut). */
  fenetre(): { el: HTMLElement; mode: string } | null;
  action(a: ActionCompagnon): void;
  ordre(o: OrdreBas): void;
  annonce(t: string): void;
}
let canalJeu: Canal | null = null, branche: BrancheCompagnon | null = null, miroir: MiroirJeu | null = null;
let actifJusque = 0, envoiT = 0, diagT = 0, lentT = 0, toutRenvoyer = true, nbStyles = -1;
const derniers: Record<string, string> = {};

/** L'écran du bas est là (il s'est annoncé il y a moins de 6 s). */
export const compagnonRelie = () => !!canalJeu && performance.now() < actifJusque;
/** Change l'onglet de l'écran du bas (Select, I, M…). */
export function ongletBas(o: OngletBas | 'suivant') { if (compagnonRelie()) canalJeu!.envoyer({ k: 'onglet', o }); }
/** 8A : petit texte (toast, ligne de butin) montré en bas plutôt qu'en haut ; faux si l'écran du bas n'est pas là. */
export function annonceBas(t: string, c?: string, uid?: number): boolean { if (!compagnonRelie()) return false; canalJeu!.envoyer({ k: 'annonce', t, c, uid }); return true; }
/** « Idées Thor : » 3C : bilan de fin de donjon, montré en bas. */
export function bilanBas(titre: string, lignes: string[]) { if (compagnonRelie()) canalJeu!.envoyer({ k: 'bilan', titre, lignes }); }

/** Appelé à chaque lancement de la scène de jeu : la page n'a qu'un canal, la scène du moment répond. */
export function brancherCompagnon(b: BrancheCompagnon) {
  branche = b; toutRenvoyer = true;
  ouvrirCanal();
}
/** « Accueil Thor : » 6A : l'accueil dit à l'écran du bas ce qu'il montre (fiche de la classe en création) ; null = plus à l'accueil. */
export function accueilBas(a: AccueilBas | null) {
  ouvrirCanal();
  if (compagnonRelie() || a === null) canalJeu!.envoyer({ k: 'accueil', a });
}
function ouvrirCanal() {
  if (canalJeu) return;
  const c = canalJeu = new Canal('jeu');
  miroir = new MiroirJeu(f => c.envoyer({ k: 'fenetre', f }));
  const st = document.createElement('style'); st.textContent = CSS_JEU; document.head.appendChild(st);
  c.ecoute = (m, par) => {
    const t = performance.now();
    if (m.k === 'bonjour') {
      if (t > actifJusque) { branche?.annonce(`Écran du bas relié (${par === 'direct' ? 'lien direct' : 'par le stockage'})`); toutRenvoyer = true; }
      if (m.neuf) toutRenvoyer = true;
      actifJusque = t + 6000; envoiT = 0;
      c.envoyer({ k: 'bonjour' });
    } else if (m.k === 'ping') {
      c.envoyer({ k: 'pong', n: m.n, t: m.t });
      branche?.annonce('Coucou de l\'écran du bas !');
    } else if (m.k === 'action') branche?.action(m.a);
    else if (m.k === 'ordre') {
      if (m.o.k === 'evt') miroir?.rejouer(m.o.e);
      else if (m.o.k === 'fiche') c.envoyer({ k: 'fiche', uid: m.o.uid, html: branche?.fiche(m.o.uid, m.o.porte) ?? '' });
      else { branche?.ordre(m.o); lentT = 0; }   // le sac change : renvoyé à l'image suivante
    }
  };
}

/** Envoie le sac ou les quêtes si leur contenu a changé depuis le dernier envoi (ou si tout doit repartir). */
function siChange(k: string, v: unknown, m: MsgCompagnon) {
  const j = JSON.stringify(v);
  if (!toutRenvoyer && derniers[k] === j) return;
  derniers[k] = j;
  canalJeu!.envoyer(m);
}

/** À chaque image : perso et carte 4 fois par seconde, sac et quêtes quand ils changent, la fenêtre ouverte en copie. */
export function tickCompagnon() {
  const t = performance.now();
  if (!canalJeu) return;
  if (t > actifJusque) { if (miroir?.suivie) miroir.lacher(); return; }
  const b = branche, c = canalJeu;
  // fenêtre du jeu : cachée en haut, copiée en bas (2A+2B) ; l'écran du bas qui revient la reçoit de nouveau
  const f = b?.fenetre() ?? null;
  if (toutRenvoyer && miroir?.suivie) miroir.lacher();
  miroir?.suivre(f?.el ?? null, f?.mode);
  if (t - envoiT < 250) return;
  envoiT = t;
  c.envoyer({ k: 'etat', e: b?.etat() ?? null });
  c.envoyer({ k: 'carte', c: b?.carte() ?? null });
  if (toutRenvoyer || t - lentT > 1000) {
    lentT = t;
    const n = document.querySelectorAll('style').length;
    if (toutRenvoyer || n !== nbStyles) { nbStyles = n; c.envoyer({ k: 'styles', css: stylesDuJeu() }); }
    const sac = b?.sac() ?? null, qu = b?.quetes() ?? null, tc = b?.tchat() ?? null;
    siChange('sac', sac, { k: 'sac', s: sac });
    siChange('quetes', qu, { k: 'quetes', q: qu });
    if (tc) siChange('tchat', tc, { k: 'tchat', ...tc });
    toutRenvoyer = false;
  }
  if (t - diagT > 2000) { diagT = t; c.envoyer({ k: 'diag', d: diagGpu() }); }
}
