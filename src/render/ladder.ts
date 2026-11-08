// Classement des aventuriers (maquette « Ladder : », 2026-11-08 ; serveur : serveur/classement.mjs).
// 1A : page Ladder de l'accueil (lisible sans être connecté) ; 1B : fenêtre du jeu (touche L) centrée sur le perso joué ;
// 1C : diablofus.com/#ladder/Nom ouvre la fiche d'un perso. Onglets Niveau (+ Hardcore, Tombés), Métiers, Exploration,
// Donjons (records des parties tenues par le serveur), Les premiers. Filtres : classe, nom, amis, autour de moi (6A-6D).
// L'affichage lit seulement : le serveur recalcule tout une fois par minute (8A).
import { API, Compte } from './compte';
import { ITEMS } from '../sim/data';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../sim/items';
import { chrono } from '../sim/quests';
import { iconHtml } from './icons';
import { v } from './assetUrl';
import CLASSES from '../data/classes_dofus.json';
import DOFUS from '../data/dofus.json';

export interface LigneLadder {
  id: string; c: number; nom: string; classe: string; sexe: 'm' | 'f'; hc: boolean; niveau: number; xp: number; temps: number; lieu: string;
  zones: number; zaaps: number; dofus: number; metiers: Record<string, [number, number]>;
}
interface RecordDonjon { id: string; temps: number; equipe: { nom: string; classe: string }[]; quand: number }
interface Tombe { nom: string; classe: string; sexe: 'm' | 'f'; niveau: number; temps: number; lieu: string; tueur: string; quand: number }
interface Premier { cle: string; id: string; nom: string; classe: string; detail: string; quand: number }
export interface DonneesLadder {
  maj: number; total: number; persos: Record<string, LigneLadder>;
  listes: { niveau: string[]; hardcore: string[]; exploration: string[]; metiers: Record<string, string[]> };
  donjons: Record<string, { solo: RecordDonjon[]; groupe: RecordDonjon[] }>;
  tombes: Tombe[]; premiers: Premier[]; enLigne: string[];
}
interface Fiche extends LigneLadder {
  equipement: Record<string, { id: string; rarity: Rarity | string }>; dofusPortes: string[]; enLigne: boolean;
  rangs: { niveau: number | null; hardcore: number | null; exploration: number | null; metiers: Record<string, number>; donjons: Record<string, number> };
}
interface Moi { compte: number; miens: string[]; amis: number[]; cache: boolean }

// ——— données (lues au plus toutes les 30 s) ———
let donnees: DonneesLadder | null = null, lu = 0, erreur = false;
let enCours: Promise<DonneesLadder | null> | null = null;
let moi: Moi | null = null;
export async function chargerLadder(force = false): Promise<DonneesLadder | null> {
  if (!force && donnees && Date.now() - lu < 30_000) return donnees;
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      const r = await fetch(`${API}/classement`);
      if (!r.ok) throw new Error(String(r.status));
      donnees = await r.json() as DonneesLadder; lu = Date.now(); erreur = false;
    } catch { erreur = true; }
    if (Compte.jeton && Compte.etat === 'connecte') {
      try { const r = await Compte.appeler('/classement/moi'); if (r.ok) moi = await r.json() as Moi; } catch { /* hors ligne */ }
    } else moi = null;
    enCours = null;
    return donnees;
  })();
  return enCours;
}
export const ladderCharge = () => donnees;
/** Identifiant du perso d'un emplacement du compte connecté (« compte-emplacement »), '' si inconnu. */
export const idDuPerso = (slot: number) => moi?.miens[slot] ?? '';
/** Vie privée (5A) : « Me cacher du classement », dans Social › Amis. */
export const cacheDuClassement = () => moi?.cache ?? false;
export async function cacherDuClassement(cache: boolean) {
  try { await Compte.appeler('/classement/moi', { method: 'PUT', body: JSON.stringify({ cache }) }); if (moi) moi.cache = cache; await chargerLadder(true); } catch { /* hors ligne */ }
}
async function chargerFiche(id: string): Promise<Fiche | null> {
  try { const r = await fetch(`${API}/classement/fiche/${encodeURIComponent(id)}`); return r.ok ? await r.json() as Fiche : null; } catch { return null; }
}

// ——— présentation ———
const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!);
const CL = CLASSES as { id: number; cle: string; nom: string }[];
const nomClasse = (c: string) => CL.find(x => x.cle === c)?.nom ?? c;
/** Tête officielle de la classe (Head_N0 / N1). */
const tete = (classe: string, sexe: 'm' | 'f') => { const c = CL.find(x => x.cle === classe); return v(`assets/accueil/h_${c?.id ?? 8}${sexe === 'f' ? 1 : 0}.png`); };
const icClasse = (c: string) => `assets/accueil/c_${c}.png`;
const nombre = (n: number) => Math.round(n).toLocaleString('fr-FR');
const duree = (s: number) => { const h = Math.floor(s / 3600); return h ? `${h} h` : `${Math.max(1, Math.round(s / 60))} min`; };
const jour = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const nomMetier = (k: string) => (ITEMS as unknown as { metiers?: Record<string, { name: string }> }).metiers?.[k]?.name ?? k;
const DOF = (DOFUS as unknown as { dofus: Record<string, { nom: string; icon: number }> }).dofus;
const nomEquip = (id: string) => ITEMS.equipment[id]?.name ?? id;

export type OngletLadder = 'niveau' | 'metiers' | 'exploration' | 'donjons' | 'premiers';
const ONGLETS: [OngletLadder, string, string][] = [
  ['niveau', 'Niveau', 'assets/ui/menu/characteristic.png'], ['metiers', 'Métiers', 'assets/ui/menu/job.png'], ['exploration', 'Exploration', 'assets/ui/menu/map.png'],
  ['donjons', 'Donjons', 'assets/ui/menu/breach.png'], ['premiers', 'Les premiers', 'assets/ui/menu/ladder.png'],
];
const EN_CLAIR: Record<OngletLadder, [string, string]> = {
  niveau: ['Niveau', 'Niveau du perso, puis l\'expérience totale pour départager. Les Hardcore ont aussi leur classement, et ceux qui sont tombés restent dans le mémorial.'],
  metiers: ['Métiers', 'Un classement par métier : niveau, puis expérience du métier.'],
  exploration: ['Exploration', 'Sous-zones découvertes, puis Zaaps activés.'],
  donjons: ['Donjons', 'Meilleur temps de chaque perso, en solo et en groupe. Seules les parties tenues par le serveur comptent (en groupe, ou « Partie sur le serveur »).'],
  premiers: ['Les premiers', 'Le premier à atteindre un palier y est gravé pour toujours, même s\'il est dépassé ensuite.'],
};
const NOM_PREMIER = (p: Premier) => p.cle.startsWith('niveau_') ? `Niveau ${p.cle.slice(7)}` : p.cle === 'dofus' ? 'Premier Dofus'
  : p.cle.startsWith('metier_') ? `${nomMetier(p.detail)} niveau 100` : p.cle.startsWith('donjon_') ? `Premier à finir ${p.detail}` : p.cle;

/** Une ligne affichée : rang dans la liste complète, perso, valeur. */
interface Rang { rang: number; p: LigneLadder | null; valeur: string; sous?: string; tombe?: Tombe; equipe?: string }

/** État de la vue (onglet, filtres, fiche ouverte), partagé par la page et la fenêtre. */
export class VueLadder {
  onglet: OngletLadder = 'niveau';
  /** Niveau : tous / hardcore / tombes ; Donjons : solo / groupe. */
  sous = 'tous';
  metier = '';
  donjon = '';
  classes = new Set<string>();
  recherche = '';
  filtre: 'tous' | 'amis' | 'autour' = 'tous';
  fiche: Fiche | null = null;
  ficheId = '';
  /** Perso joué (fenêtre du jeu) : « Autour de moi » se centre sur lui. */
  monId = '';
  /** Fenêtre du jeu : 50 lignes au plus, sans le grand bandeau. */
  constructor(readonly compact = false) { if (compact) this.filtre = 'autour'; }

  private moiDans(ids: string[]) {
    if (this.monId && ids.includes(this.monId)) return this.monId;
    return moi?.miens.find(i => ids.includes(i)) ?? '';
  }
  /** Lignes de l'onglet, filtres appliqués (le rang reste celui de la liste complète). */
  lignes(d: DonneesLadder): Rang[] {
    const P = d.persos;
    let L: Rang[] = [];
    if (this.onglet === 'niveau') {
      if (this.sous === 'tombes') return d.tombes.filter(t => (!this.classes.size || this.classes.has(t.classe)) && (!this.recherche || t.nom.toLowerCase().includes(this.recherche.toLowerCase())))
        .map((t, i) => ({ rang: i + 1, p: null, tombe: t, valeur: `${t.niveau}`, sous: `${t.tueur} · ${t.lieu}` }));
      const ids = this.sous === 'hardcore' ? d.listes.hardcore : d.listes.niveau;
      L = ids.map((id, i) => ({ rang: i + 1, p: P[id], valeur: `${P[id].niveau}`, sous: `${nombre(P[id].xp)} XP` }));
    } else if (this.onglet === 'metiers') {
      const m = this.metier || Object.keys(d.listes.metiers)[0] || '';
      this.metier = m;
      L = (d.listes.metiers[m] ?? []).map((id, i) => ({ rang: i + 1, p: P[id], valeur: `${P[id].metiers[m]?.[0] ?? 1}`, sous: `${nombre(P[id].metiers[m]?.[1] ?? 0)} XP` }));
    } else if (this.onglet === 'exploration') {
      L = d.listes.exploration.map((id, i) => ({ rang: i + 1, p: P[id], valeur: `${P[id].zones}`, sous: `${P[id].zaaps} Zaap${P[id].zaaps > 1 ? 's' : ''}` }));
    } else if (this.onglet === 'donjons') {
      const k = this.donjon && d.donjons[this.donjon] ? this.donjon : Object.keys(d.donjons)[0] ?? '';
      this.donjon = k;
      const l = d.donjons[k]?.[this.sous === 'groupe' ? 'groupe' : 'solo'] ?? [];
      L = l.filter(r => P[r.id]).map((r, i) => ({ rang: i + 1, p: P[r.id], valeur: chrono(r.temps), sous: jour(r.quand), equipe: r.equipe.length > 1 ? r.equipe.map(e => e.nom).join(', ') : '' }));
    } else return [];
    const tous = L;
    if (this.classes.size) L = L.filter(r => r.p && this.classes.has(r.p.classe));
    if (this.recherche) { const q = this.recherche.toLowerCase(); L = L.filter(r => r.p?.nom.toLowerCase().includes(q)); }
    if (this.filtre === 'amis') { const A = new Set([...(moi?.amis ?? []), moi?.compte ?? -1]); L = L.filter(r => r.p && A.has(r.p.c)); }
    if (this.filtre === 'autour') {
      const id = this.moiDans(tous.map(r => r.p?.id ?? ''));
      const i = L.findIndex(r => r.p?.id === id);
      if (i >= 0) L = L.slice(Math.max(0, i - 3), i + 4);
      else L = L.slice(0, 7);
    }
    return L.slice(0, this.compact ? 50 : 500);
  }
  /** « Plus que X XP pour passer devant » (6D), dans l'onglet Niveau. */
  devant(d: DonneesLadder): string {
    if (this.onglet !== 'niveau' || this.sous === 'tombes') return '';
    const ids = this.sous === 'hardcore' ? d.listes.hardcore : d.listes.niveau, id = this.moiDans(ids), i = ids.indexOf(id);
    if (i <= 0) return i === 0 ? 'Tu es en tête de ce classement.' : '';
    const a = d.persos[ids[i - 1]], m = d.persos[id];
    if (a.niveau !== m.niveau) return `${esc(a.nom)} est niveau ${a.niveau} : encore ${a.niveau - m.niveau} niveau${a.niveau - m.niveau > 1 ? 'x' : ''} pour passer ${i}e.`;
    return `Plus que ${nombre(a.xp - m.xp + 1)} XP pour passer ${i === 1 ? '1er' : `${i}e`}.`;
  }

  // ——— HTML ———
  /** Contenu complet (page ou fenêtre). */
  html(): string {
    const d = donnees;
    if (this.fiche) return this.htmlFiche(this.fiche);
    if (!d) return `<div class="lad-vide">${erreur ? 'Le classement ne répond pas pour l\'instant. Réessaie dans un moment.' : 'Chargement du classement…'}</div>`;
    const ong = `<div class="lad-ong">${ONGLETS.map(([k, n, ic]) => `<button type="button" class="${k === this.onglet ? 'on' : ''}" data-lad-onglet="${k}"><img src="${ic}" alt="">${n}</button>`).join('')}</div>`;
    let sous = '';
    if (this.onglet === 'niveau') sous = [['tous', 'Tout le monde'], ['hardcore', 'Hardcore'], ['tombes', 'Tombés en Hardcore']].map(([k, n]) => `<button type="button" class="${this.sous === k ? 'on' : ''}" data-lad-sous="${k}">${n}</button>`).join('');
    if (this.onglet === 'metiers') sous = Object.keys(d.listes.metiers).map(k => `<button type="button" class="${this.metier === k || (!this.metier && k === Object.keys(d.listes.metiers)[0]) ? 'on' : ''}" data-lad-metier="${k}"><img src="assets/ui/metier_${k}.png" alt="">${esc(nomMetier(k))}</button>`).join('') || '<span class="lad-note">Personne n\'a encore progressé dans un métier.</span>';
    if (this.onglet === 'donjons') sous = Object.keys(d.donjons).map(k => `<button type="button" class="${this.donjon === k || (!this.donjon && k === Object.keys(d.donjons)[0]) ? 'on' : ''}" data-lad-donjon="${esc(k)}">${esc(k)}</button>`).join('')
      + (Object.keys(d.donjons).length ? `<span class="lad-sep"></span>${[['solo', 'Solo'], ['groupe', 'Groupe']].map(([k, n]) => `<button type="button" class="${(this.sous === 'groupe' ? 'groupe' : 'solo') === k ? 'on' : ''}" data-lad-sous="${k}">${n}</button>`).join('')}` : '<span class="lad-note">Aucun record pour l\'instant : finis un donjon en groupe ou en « Partie sur le serveur ».</span>');
    const corps = this.onglet === 'premiers' ? this.htmlPremiers(d) : this.htmlTableau(d);
    const filtres = this.onglet === 'premiers' ? '' : `<div class="lad-fil">
        <input type="search" placeholder="Nom de personnage" value="${esc(this.recherche)}" data-lad-recherche autocomplete="off">
        <div class="lad-cls">${CL.filter(c => Object.values(d.persos).some(p => p.classe === c.cle) || d.tombes.some(t => t.classe === c.cle)).map(c => `<button type="button" title="${esc(c.nom)}" class="${this.classes.has(c.cle) ? 'on' : ''}" data-lad-classe="${c.cle}"><img src="${icClasse(c.cle)}" alt="${esc(c.nom)}"></button>`).join('')}</div>
        ${moi ? `<button type="button" class="lad-chip ${this.filtre === 'amis' ? 'on' : ''}" data-lad-filtre="amis">Mes amis</button><button type="button" class="lad-chip ${this.filtre === 'autour' ? 'on' : ''}" data-lad-filtre="autour">Autour de moi</button>` : ''}
      </div>`;
    const [t, txt] = EN_CLAIR[this.onglet];
    const maj = new Date(d.maj).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    if (this.compact) return `${ong}<div class="lad-sous">${sous}</div>${filtres}${corps}<p class="lad-note">${this.devant(d) || `${nombre(d.total)} personnages classés · mis à jour à ${maj}`}</p>`;
    const banniere = { niveau: '2026-11-08', metiers: '2026-11-06', exploration: '2026-11-07', donjons: '2026-11-05', premiers: '2026-11-08' }[this.onglet];
    return `<div class="lad-hero" style="background-image:url(${v(`assets/journal/${banniere}.webp`)})">
        <div class="lad-maj"><b>Classement du serveur</b><br>Mis à jour chaque minute<br>${maj} · heure de Paris</div>
        <div class="lad-tx"><span class="lad-eb">LADDER · LES DOUZE ENFERS</span><h1>${ONGLETS.find(o => o[0] === this.onglet)![1]}<em>.</em></h1>
        <p>Niveaux, métiers, exploration et donjons du Monde des Douze.</p></div></div>
      ${ong}
      <div class="lad-corps"><div class="lad-main">
        <div class="lad-sous">${sous}</div>
        <div class="lad-titre"><h2>${this.onglet === 'niveau' && this.sous === 'tombes' ? 'Tombés en Hardcore' : t}</h2><span>${nombre(d.total)} personnages classés</span></div>
        ${filtres}${corps}${this.devant(d) ? `<p class="lad-note">${this.devant(d)}</p>` : ''}
      </div><aside class="lad-cote"><span class="lad-eb">LE CLASSEMENT EN CLAIR</span><h3>${t}</h3><p>${txt}</p>
        <p class="lad-note">Un perso n'apparaît que s'il est sauvé « En ligne ». Pour te cacher : Social (P) › Amis › Vie privée.</p>
        <span class="lad-eb">LES PREMIERS</span>${this.htmlPremiers(d, 4)}</aside></div>`;
  }
  private htmlTableau(d: DonneesLadder): string {
    const L = this.lignes(d), la = new Set(d.enLigne), mien = new Set(moi?.miens ?? []);
    const tete2 = this.onglet === 'donjons' ? 'Temps' : this.onglet === 'exploration' ? 'Sous-zones' : this.onglet === 'metiers' ? 'Niveau' : 'Niveau';
    if (!L.length) return `<div class="lad-vide">${this.filtre === 'amis' ? 'Aucun ami dans ce classement.' : this.filtre === 'autour' && !this.moiDans(Object.keys(d.persos)) ? 'Aucun de tes persos n\'est dans ce classement : joue un perso « En ligne ».' : 'Personne ici pour l\'instant.'}</div>`;
    const ligne = (r: Rang) => {
      if (r.tombe) {
        const t = r.tombe;
        return `<tr class="mort"><td class="rg">✝</td><td><div class="who"><img src="${tete(t.classe, t.sexe)}" alt=""><span><b>${esc(t.nom)}</b><small>${esc(nomClasse(t.classe))} · tombé le ${jour(t.quand)} · ${duree(t.temps)} de jeu</small></span></div></td>
          <td class="c3">${esc(r.sous ?? '')}</td><td class="n"><span class="lv">${r.valeur}</span></td></tr>`;
      }
      const p = r.p!;
      return `<tr class="${mien.has(p.id) ? 'moi' : ''}" data-lad-fiche="${p.id}"><td class="rg r${r.rang}">${r.rang}</td>
        <td><div class="who"><img src="${tete(p.classe, p.sexe)}" alt=""><span><b>${esc(p.nom)}${la.has(p.id) ? '<i class="dot" title="En ligne"></i>' : ''}${p.hc ? '<i class="hc">HC</i>' : ''}</b><small>${r.equipe ? `avec ${esc(r.equipe)}` : `${esc(p.lieu || '—')} · ${duree(p.temps)} de jeu`}</small></span></div></td>
        <td class="c3">${esc(nomClasse(p.classe))}</td><td class="n"><span class="lv">${r.valeur}</span><small>${esc(r.sous ?? '')}</small></td></tr>`;
    };
    return `<table class="lad-t"><thead><tr><th>Rang</th><th>Personnage</th><th class="c3">${this.onglet === 'niveau' && this.sous === 'tombes' ? 'Tué par' : 'Classe'}</th><th class="n">${tete2}</th></tr></thead><tbody>${L.map(ligne).join('')}</tbody></table>`;
  }
  private htmlPremiers(d: DonneesLadder, max = 0): string {
    const L = max ? d.premiers.slice(-max).reverse() : d.premiers;
    if (!L.length) return '<p class="lad-note">Personne encore… à toi de jouer !</p>';
    return `<div class="lad-prem">${L.map(p => `<div ${d.persos[p.id] ? `data-lad-fiche="${p.id}"` : ''}><b>${esc(NOM_PREMIER(p))}</b><span>${esc(p.nom)} · ${esc(nomClasse(p.classe))} · ${jour(p.quand)}</span></div>`).join('')}</div>`;
  }
  private htmlFiche(f: Fiche): string {
    const slots = Object.entries(f.equipement).map(([s, it]) => {
      const def = ITEMS.equipment[it.id], col = RARITY_COLORS[it.rarity as Rarity] ?? '#5fd0c9';
      return `<div class="lad-slot" title="${esc(`${nomEquip(it.id)} · ${RARITY_NAMES[it.rarity as Rarity] ?? it.rarity}`)}" style="border-color:${col};box-shadow:inset 0 0 10px ${col}55">${def ? iconHtml(def.icon) : ''}<span class="lad-sr">${esc(s)}</span></div>`;
    }).join('') + f.dofusPortes.filter(k => DOF[k]).map(k => `<div class="lad-slot" title="${esc(DOF[k].nom)}" style="border-color:#5fd0c9;box-shadow:inset 0 0 10px #5fd0c955">${iconHtml(DOF[k].icon)}</div>`).join('');
    const R = f.rangs, places: string[] = [];
    if (R.niveau) places.push(`${R.niveau === 1 ? '1er' : `${R.niveau}e`} Niveau`);
    if (R.hardcore) places.push(`${R.hardcore === 1 ? '1er' : `${R.hardcore}e`} Hardcore`);
    if (R.exploration) places.push(`${R.exploration === 1 ? '1er' : `${R.exploration}e`} Exploration`);
    for (const [m, n] of Object.entries(R.metiers)) places.push(`${n === 1 ? '1er' : `${n}e`} ${nomMetier(m)}`);
    for (const [k, n] of Object.entries(R.donjons)) { const [dj, mode] = k.split('|'); places.push(`${n === 1 ? '1er' : `${n}e`} ${dj} (${mode})`); }
    const metiers = Object.entries(f.metiers).sort((a, b) => b[1][0] - a[1][0]).map(([m, [lv]]) => `<span><img src="assets/ui/metier_${m}.png" alt="">${esc(nomMetier(m))} ${lv}</span>`).join('');
    const lien = `${location.origin}${location.pathname}#ladder/${encodeURIComponent(f.nom)}`;
    return `<div class="lad-fiche">
      <button type="button" class="lad-retour" data-lad-retour>← Retour au classement</button>
      <div class="lad-ftop"><img src="${tete(f.classe, f.sexe)}" alt=""><div><h2>${esc(f.nom)}${f.enLigne ? '<i class="dot" title="En ligne"></i>' : ''}${f.hc ? '<i class="hc">HC</i>' : ''}</h2>
        <p>${esc(nomClasse(f.classe))} niveau ${f.niveau} · ${nombre(f.xp)} XP</p><p class="lad-note">${esc(places.join(' · ') || 'Pas encore classé')}</p></div></div>
      <div class="lad-slots">${slots || '<span class="lad-note">Rien d\'équipé.</span>'}</div>
      <div class="lad-kv"><span>Lieu <b>${esc(f.lieu || '—')}</b></span><span>Temps de jeu <b>${duree(f.temps)}</b></span><span>Sous-zones vues <b>${f.zones}</b></span><span>Zaaps <b>${f.zaaps}</b></span><span>Dofus obtenus <b>${f.dofus}</b></span></div>
      ${metiers ? `<div class="lad-met">${metiers}</div>` : ''}
      <div class="lad-lien"><input type="text" readonly value="${esc(lien)}" data-lad-lien><button type="button" data-lad-copier>Copier le lien</button></div>
    </div>`;
  }

  /** Branche les clics ; refaire() redessine la vue. */
  brancher(root: HTMLElement, refaire: () => void) {
    const on = (sel: string, f: (e: HTMLElement) => void) => root.querySelectorAll<HTMLElement>(sel).forEach(e => e.addEventListener('click', ev => { ev.stopPropagation(); f(e); }));
    on('[data-lad-onglet]', e => { this.onglet = e.dataset.ladOnglet as OngletLadder; this.sous = this.onglet === 'donjons' ? 'solo' : 'tous'; refaire(); });
    on('[data-lad-sous]', e => { this.sous = e.dataset.ladSous!; refaire(); });
    on('[data-lad-metier]', e => { this.metier = e.dataset.ladMetier!; refaire(); });
    on('[data-lad-donjon]', e => { this.donjon = e.dataset.ladDonjon!; refaire(); });
    on('[data-lad-classe]', e => { const c = e.dataset.ladClasse!; if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); refaire(); });
    on('[data-lad-filtre]', e => { const f = e.dataset.ladFiltre as 'amis' | 'autour'; this.filtre = this.filtre === f ? 'tous' : f; refaire(); });
    on('[data-lad-fiche]', e => void this.ouvrirFiche(e.dataset.ladFiche!, refaire));
    on('[data-lad-retour]', () => { this.fiche = null; this.ficheId = ''; refaire(); });
    on('[data-lad-copier]', e => {
      const i = root.querySelector<HTMLInputElement>('[data-lad-lien]'); if (!i) return;
      void navigator.clipboard?.writeText(i.value).then(() => { e.textContent = 'Copié !'; }, () => { i.select(); });
    });
    const champ = root.querySelector<HTMLInputElement>('[data-lad-recherche]');
    if (champ) {
      for (const ev of ['keydown', 'keyup', 'keypress'] as const) champ.addEventListener(ev, e => e.stopPropagation());   // le jeu ne reçoit pas ces touches
      champ.addEventListener('input', () => {
        this.recherche = champ.value.trim();
        const pos = champ.selectionStart;
        refaire();
        const n = document.querySelector<HTMLInputElement>('[data-lad-recherche]');
        if (n) { n.focus(); n.setSelectionRange(pos, pos); }
      });
    }
  }
  async ouvrirFiche(id: string, refaire: () => void) {
    this.ficheId = id;
    const f = await chargerFiche(id);
    if (this.ficheId !== id) return;
    this.fiche = f;
    refaire();
  }
  /** 1C : #ladder/Nom ouvre la fiche du perso de ce nom. */
  async ouvrirParNom(nom: string, refaire: () => void) {
    const d = await chargerLadder();
    const p = d && Object.values(d.persos).find(x => x.nom.toLowerCase() === nom.toLowerCase());
    if (p) await this.ouvrirFiche(p.id, refaire);
    else { this.recherche = nom; refaire(); }
  }
}

/** Adresse #ladder ou #ladder/Nom : vrai si c'est une adresse du classement, avec le nom éventuel. */
export function adresseLadder(h = location.hash): { nom: string } | null {
  const m = /^#ladder(?:\/(.+))?$/i.exec(h);
  if (!m) return null;
  try { return { nom: m[1] ? decodeURIComponent(m[1]) : '' }; } catch { return { nom: '' }; }
}

/** Styles de la page (dans l'accueil, unités --u de l'accueil) et de la fenêtre du jeu (.dw .win.ladder). */
export const LADDER_CSS = `
.lad{--or:#e8c66a;--lime:#b9e54b;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif}
.lad button{all:unset;cursor:pointer;box-sizing:border-box}
.lad .lad-vide{padding:24px;text-align:center;color:#a99d86}
.lad .lad-note{color:#a99d86;font-size:12px;margin:8px 0 0}
.lad .lad-eb{font-size:11px;letter-spacing:.16em;font-weight:700;color:var(--lime)}
.lad .lad-ong{display:flex;overflow-x:auto;border-bottom:1px solid #2c2a1f;background:#1b1a13}
.lad .lad-ong button{flex:1 0 auto;padding:12px 16px;font-weight:700;font-size:14px;color:#c9c1a8;display:flex;gap:8px;align-items:center;justify-content:center;border-bottom:3px solid transparent;white-space:nowrap}
.lad .lad-ong button img{width:24px;height:24px;object-fit:contain}
.lad .lad-ong button.on{color:#fff;border-bottom-color:var(--lime);background:#24231a}
.lad .lad-ong button:hover{background:#222118}
.lad .lad-sous{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:12px 0}
.lad .lad-sous button{font-size:13px;font-weight:700;padding:6px 12px;border-radius:5px;background:#24221a;color:#d6cfb8;display:flex;gap:6px;align-items:center}
.lad .lad-sous button img{width:18px;height:18px;object-fit:contain}
.lad .lad-sous button.on{background:var(--lime);color:#1d2a06}
.lad .lad-sep{width:1px;height:20px;background:#3a3729;margin:0 4px}
.lad .lad-fil{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px}
.lad .lad-fil input{flex:1 1 180px;min-width:0;background:#1a1912;border:1px solid #3a3729;border-radius:6px;padding:8px 10px;color:#f2ead6;font:inherit;font-size:13px}
.lad .lad-cls{display:flex;gap:4px}
.lad .lad-cls button{width:30px;height:30px;border-radius:6px;background:#24221a;border:1px solid #3a3729;display:grid;place-items:center;opacity:.6}
.lad .lad-cls button.on{opacity:1;border-color:var(--lime)}
.lad .lad-cls img{width:24px;height:24px;object-fit:contain}
.lad .lad-chip{font-size:12px;font-weight:700;padding:6px 10px;border-radius:14px;border:1px solid #3a3729;color:#d6cfb8}
.lad .lad-chip.on{border-color:var(--lime);color:var(--lime)}
.lad .lad-t{width:100%;border-collapse:collapse;font-size:13px}
.lad .lad-t th{text-align:left;font-weight:700;color:#8d836e;font-size:12px;padding:6px 8px;border-bottom:1px solid #2c2a1f}
.lad .lad-t td{padding:7px 8px;border-bottom:1px solid #23211a;vertical-align:middle}
.lad .lad-t tr[data-lad-fiche]{cursor:pointer}
.lad .lad-t tr[data-lad-fiche]:hover td{background:#222118}
.lad .lad-t .n{text-align:right}
.lad .lad-t tr.moi td{background:#2a2614}
.lad .lad-t tr.moi td:first-child{box-shadow:inset 3px 0 0 var(--lime)}
.lad .lad-t tr.mort td{color:#c9a99a}
.lad .rg{font-family:Rowdies,serif;color:var(--lime);font-size:16px;width:40px}
.lad .rg.r1{color:#f3d36b}.lad .rg.r2{color:#d0d6dc}.lad .rg.r3{color:#d79b62}
.lad .who{display:flex;gap:10px;align-items:center;min-width:0}
.lad .who img{width:34px;height:34px;object-fit:contain;flex:none}
.lad .who b{display:block;font-weight:700;color:#f6f0dc}
.lad .who small,.lad .lad-t .n small{display:block;color:#8d836e;font-size:11px}
.lad .lv{font-family:Rowdies,serif;font-size:17px;color:#f6f0dc}
.lad .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#6fdc5a;box-shadow:0 0 6px #6fdc5a;margin-left:6px;vertical-align:1px}
.lad .hc{font-style:normal;font-size:10px;font-weight:800;color:#ff9f8a;border:1px solid #a3402e;border-radius:3px;padding:0 4px;margin-left:6px;vertical-align:2px}
.lad .lad-prem{display:flex;flex-direction:column;gap:6px}
.lad .lad-prem div{background:#1d1c14;border:1px solid #2e2b1f;border-radius:6px;padding:7px 9px;line-height:1.35;font-size:12px}
.lad .lad-prem div[data-lad-fiche]{cursor:pointer}
.lad .lad-prem b{display:block;color:var(--or)}
.lad .lad-prem span{color:#bdb59c}
.lad .lad-fiche{display:flex;flex-direction:column;gap:12px;font-size:13px}
#acc .lad .lad-fiche{max-width:820px;margin:24px auto 0;background:#1b1a13;border:1px solid #2c2a1f;border-radius:10px;padding:20px 24px}
.lad .lad-retour{color:var(--lime);font-weight:700}
.lad .lad-ftop{display:flex;gap:14px;align-items:center}
.lad .lad-ftop img{width:72px;height:72px;object-fit:contain}
.lad .lad-ftop h2{margin:0;font-family:Rowdies,serif;font-weight:400;font-size:24px;color:#fbf3d4}
.lad .lad-ftop p{margin:2px 0 0}
.lad .lad-slots{display:flex;gap:6px;flex-wrap:wrap}
.lad .lad-slot{width:46px;height:46px;border-radius:6px;background:#1d1c14;border:1px solid;position:relative;padding:4px;box-sizing:border-box}
.lad .lad-slot .ic{width:100%;height:100%}
.lad .lad-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.lad .lad-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 14px;color:#a99d86}
.lad .lad-kv b{color:#f2ead6}
.lad .lad-met{display:flex;gap:6px;flex-wrap:wrap}
.lad .lad-met span{display:flex;gap:5px;align-items:center;background:#1d1c14;border:1px solid #2e2b1f;border-radius:14px;padding:3px 10px 3px 4px;font-size:12px}
.lad .lad-met img{width:20px;height:20px;object-fit:contain}
.lad .lad-lien{display:flex;gap:6px}
.lad .lad-lien input{flex:1;min-width:0;background:#1a1912;border:1px solid #3a3729;border-radius:6px;padding:6px 8px;color:#bdb59c;font:inherit;font-size:12px}
.lad .lad-lien button{background:var(--lime);color:#1d2a06;font-weight:700;border-radius:6px;padding:6px 12px;font-size:12px}
/* page de l'accueil */
#acc .ladp{position:absolute;left:calc(6.6*var(--u));right:0;top:0;bottom:0;overflow:auto;background:#151410;user-select:text}
#acc .ladp .lad{max-width:1200px;margin:0 auto;padding:16px 24px 40px}
.lad .lad-hero{position:relative;height:260px;border-radius:10px;overflow:hidden;background:center 40%/cover no-repeat;display:flex;align-items:flex-end}
.lad .lad-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#151410f7 10%,#151410c0 45%,#15141030 80%),linear-gradient(0deg,#151410 0%,transparent 45%)}
.lad .lad-tx{position:relative;padding:22px 28px;display:flex;flex-direction:column;gap:4px}
.lad .lad-tx h1{margin:0;font-family:"Lilita One",Rowdies,serif;font-weight:400;font-size:64px;line-height:1;color:#fbf3d4}
.lad .lad-tx h1 em{font-style:normal;color:var(--lime)}
.lad .lad-tx p{margin:0;font-weight:700;color:#e6dec6}
.lad .lad-maj{position:absolute;right:18px;top:16px;background:#151410d9;border-left:2px solid var(--lime);padding:8px 12px;font-size:12px;color:#cfc5ad;line-height:1.45;z-index:1}
.lad .lad-maj b{color:#fff}
.lad .lad-corps{display:grid;grid-template-columns:1fr 260px;gap:28px;margin-top:8px}
.lad .lad-titre{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #2c2a1f;padding-bottom:8px;margin-bottom:8px}
.lad .lad-titre h2{margin:0;font-family:"Lilita One",Rowdies,serif;font-weight:400;font-size:28px}
.lad .lad-titre span{color:#bdb59c;font-size:13px;font-weight:700}
.lad .lad-cote{border-left:2px solid #2c2a1f;padding-left:16px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:#cfc5ad;align-self:start;margin-top:12px}
.lad .lad-cote h3{margin:0;font-family:"Lilita One",Rowdies,serif;font-weight:400;font-size:20px;color:#fff}
.lad .lad-cote p{margin:0;line-height:1.5}
@media (max-width:900px){.lad .lad-corps{grid-template-columns:1fr}.lad .lad-cote{border-left:0;padding-left:0}.lad .lad-tx h1{font-size:44px}.lad .lad-maj{display:none}}
/* fenêtre du jeu */
.dw .win.ladder{width:520px}
.dw .win.ladder .lad{padding:6px 12px 12px;max-height:min(70vh,640px);overflow:auto}
.dw .win.ladder .lad-ong button{padding:8px 6px;font-size:12px;gap:5px}
.dw .win.ladder .lad-ong button img{width:18px;height:18px}
.dw .win.ladder .c3{display:none}
`;
