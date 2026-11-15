// Fenêtre de l'Hôtel de Vente (ligne « HDV : 1D 2A+2B+2C+2D … », Mathis 2026-11-15) : onglets Achat, Vente, Historique,
// ouverte de partout par la colonne de menus (1D). Règles : src/sim/hdv.ts ; serveur : serveur/hdv.mjs.
// En solo, le serveur accepte ou refuse et le jeu fait le geste puis sauve ; dans une partie du serveur (monde du groupe),
// le serveur fait le geste lui-même et l'instantané suivant le montre.
import type { World } from '../sim/world';
import { APPARATS, ITEMS } from '../sim/data';
import { RARITY_COLORS, RARITY_NAMES, STAT_NAMES, type Item, type Rarity, type Stat } from '../sim/items';
import { CATEGORIES_RESSOURCES, HDV, TYPES_VENTE, alertePrix, categorieHdv, cleHdv, donnerHdv, nomHdv, quantiteHdv, refusHdv, relireObjetHdv, retirerHdv, taxeHdv, typeVente, type ObjetHdv, type TypeVente } from '../sim/hdv';
import { sourceApparat } from '../sim/apparats';
import { COFFRE } from '../sim/coffre';
import { Compte } from './compte';
import { EnLigne } from './presence';
import { iconHtml } from './icons';

export interface ContexteHdv {
  world: World;
  /** Emplacement du perso en ligne (-1 : partie sans perso du compte). */
  slot: number;
  /** Dans une partie du serveur : le serveur fait les gestes. */
  miroir: () => boolean;
  /** Sauve le perso tout de suite (navigateur puis compte). */
  sauver: () => Promise<void>;
  refaire: () => void;
}
interface Annonce { id: number; cle: string; type: TypeVente; cat: string; niveau: number; rarete: string; nom: string; objet: ObjetHdv; n: number; prix: number; vendeur: string; expire: number; moi?: boolean }
interface LigneHisto { cle: string; nom: string; n: number; prix: number; quand: number }
interface Favori { cle: string; nom: string; seuil: number | null; min: number | null; alerte: boolean }
interface Moi { annonces: Annonce[]; max: number; colis: number; kamas: number; ventes: LigneHisto[]; achats: LigneHisto[]; favoris: Favori[]; quota: number }

const ERREURS: Record<string, string> = {
  perso: 'Ce perso n\'est pas sur ton compte en ligne.', objet: 'Objet illisible.', prix: 'Prix invalide.', annonces: 'Tu as déjà toutes tes annonces.',
  absent: 'Tu n\'as plus cet objet.', signature: 'Seul le butin vu par le serveur se vend : joue en groupe (ou sur le serveur) pour le vendre.',
  quota: 'Limite du jour atteinte pour les ressources gagnées en solo.', kamas: 'Pas assez de kamas.', place: 'Ton sac est plein.',
  vendu: 'Déjà vendu.', soi: 'C\'est ton annonce.', prixChange: 'Le prix a changé : regarde-le à nouveau.', lot: 'Lot de 1, 10 ou 100.',
  pepite: 'Les Pépites ne se vendent pas.', ogrines: 'Les apparats payés en Ogrines ne se vendent pas.', jets: 'Jets impossibles : objet refusé.',
  inconnu: 'Objet inconnu.', annonce: 'Annonce introuvable.', serveur: 'Le serveur ne répond pas.', connexion: 'Reconnecte-toi.',
};
const K = (n: number) => `${(n < 100 ? Math.round(n * 10) / 10 : Math.round(n)).toLocaleString('fr-FR')} K`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SLOTS: [string, string][] = [['chapeau', 'Coiffe'], ['cape', 'Cape'], ['amulette', 'Amulette'], ['anneau', 'Anneau'], ['ceinture', 'Ceinture'], ['bottes', 'Bottes'], ['arme', 'Arme'], ['bouclier', 'Bouclier']];
const CONSOS: [string, string][] = [['repas', 'Repas'], ['elixirs', 'Élixirs'], ['boissons', 'Boissons'], ['parchemins', 'Parchemins']];
const SOURCES_APPARATS: [string, string][] = [['boss', 'Boss de donjon'], ['classe', 'Succès de classe'], ['fete', 'Fêtes'], ['monde', 'Boss du monde'], ['enutrof', 'Autres']];
const categories = (t: TypeVente): [string, string][] => t === 'equipement' ? SLOTS : t === 'ressource' ? CATEGORIES_RESSOURCES.map(c => [c.k, c.nom]) : t === 'consommable' ? CONSOS : t === 'apparat' ? SOURCES_APPARATS : [];

/** Nom de la catégorie d'un objet (« · Paysan »), vide si son type n'en a pas. */
const nomCat = (o: ObjetHdv) => { const n = categories(typeVente(o, ITEMS)).find(([k]) => k === categorieHdv(o, ITEMS))?.[1]; return n ? ` · ${n}` : ''; };
/** Icône d'un objet de l'HDV. */
function icone(o: ObjetHdv): string {
  if (o.k === 'objet') { const d = ITEMS.equipment[o.item.id]; return iconHtml(d?.familier?.icon ?? d?.icon ?? 0); }
  if (o.k === 'ressource' || o.k === 'ame') return iconHtml(ITEMS.resources[o.id]?.icon ?? 0);
  const a = APPARATS.objets[o.id]; return a && a.case < 0 ? iconHtml(a.icon) : `<img src="assets/ui/hdv/apparat.png" alt="">`;
}
/** Monstre → id de sa ressource « Âme capturée ». */
const AME_DE = new Map(Object.entries(ITEMS.resources).flatMap(([id, r]) => (r.ame ? [[r.ame, id] as [string, string]] : [])));
const nomDe = (o: ObjetHdv) => nomHdv(o, ITEMS, Object.fromEntries(Object.entries(APPARATS.objets).map(([k, a]) => [k, { name: a.name }])));
/** Les lignes d'un équipement (fiche courte). */
function lignes(it: Item): string {
  return (Object.entries(it.stats) as [Stat, number][]).slice(0, 6).map(([k, v]) => `<span class="${it.extra.includes(k) ? 'x' : ''} ${v < 0 ? 'm' : ''}">${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k] ?? k}</span>`).join('')
    + (it.legendary ? '<span class="l">+ pouvoir légendaire</span>' : '') + (it.niv ? `<span>niveau ${it.niv}</span>` : '');
}

export class VueHdv {
  onglet: 'achat' | 'vente' | 'historique' = 'achat';
  private type: TypeVente = 'ressource';
  private cats = new Set<string>();
  private raretes = new Set<string>();
  private min = ''; private max = ''; private q = '';
  private offres: Annonce[] = []; private moyennes: Record<string, number | null> = {}; private suite = false; private page = 0;
  private charge = false; private chargement = false;
  private confirme = -1;
  private courbe: { cle: string; nom: string; moyenne: number | null; courbe: { jour: string; moyenne: number; n: number }[] } | null = null;
  private moi: Moi | null = null;
  private msg = ''; private msgBon = false;
  private choix = '';   // vente : 'o:uid' | 'r:id' | 'a:id'
  private lot = 1; private prix = ''; private rechVente = '';
  private moyenneVente: number | null = null; private moyenneDe = '';

  constructor(private ctx: () => ContexteHdv) {}

  private get W() { return this.ctx().world; }
  private dire(t: string, bon = false) { this.msg = t; this.msgBon = bon; }
  private async api<T>(chemin: string, corps?: Record<string, unknown>): Promise<T & { erreur?: string }> {
    try {
      const r = await Compte.appeler(chemin, corps ? { method: 'POST', body: JSON.stringify(corps) } : {});
      return await r.json() as T & { erreur?: string };
    } catch { return { erreur: 'serveur' } as T & { erreur?: string }; }
  }
  private erreur(e: string, plus?: { reste?: number }) { this.dire(e === 'quota' && plus?.reste != null ? `${ERREURS.quota} Il te reste ${plus.reste} unités aujourd'hui.` : ERREURS[e] ?? 'L\'Hôtel de Vente a refusé.'); }

  /** Offres selon les filtres. */
  async chercher(page = 0) {
    this.chargement = true; this.page = page; this.ctx().refaire();
    const sp = new URLSearchParams({ type: this.type, page: String(page) });
    if (this.cats.size) sp.set('cat', [...this.cats].join(','));
    if (this.raretes.size && this.type === 'equipement') sp.set('rarete', [...this.raretes].join(','));
    if (this.q.trim()) sp.set('q', this.q.trim());
    if (this.min) sp.set('min', this.min); if (this.max) sp.set('max', this.max);
    const r = await this.api<{ offres: Annonce[]; moyennes: Record<string, number | null>; suite: boolean }>(`/hdv/offres?${sp}`);
    this.chargement = false; this.charge = true;
    if (r.erreur) this.erreur(r.erreur); else { this.offres = r.offres; this.moyennes = r.moyennes; this.suite = r.suite; }
    this.ctx().refaire();
  }
  async lireMoi() {
    const c = this.ctx();
    const r = await this.api<Moi>(`/hdv/moi?emplacement=${c.slot}`);
    if (!r.erreur) this.moi = r;
    this.ctx().refaire();
  }
  async voirCourbe(cle: string, nom: string) {
    const r = await this.api<{ moyenne: number | null; courbe: { jour: string; moyenne: number; n: number }[] }>(`/hdv/prix?cle=${encodeURIComponent(cle)}`);
    if (!r.erreur) this.courbe = { cle, nom, moyenne: r.moyenne, courbe: r.courbe };
    this.ctx().refaire();
  }

  /** 6B + 5B : kamas des ventes et objets revenus (au lancement, toutes les 2 minutes, à l'ouverture). Rend vrai s'il y avait quelque chose. */
  async encaisser(): Promise<boolean> {
    const c = this.ctx();
    if (!Compte.enLigne || c.slot < 0) return false;
    const r = await this.api<{ kamas: number; objets: unknown[]; textes: string[]; applique: boolean }>('/hdv/encaisser', { emplacement: c.slot });
    if (r.erreur || (!r.textes?.length)) return false;
    const w = c.world, p = w.players[0];
    if (!r.applique) {
      p.kamas += r.kamas;
      for (const x of r.objets) {
        const o = relireObjetHdv(x);
        if (o && !donnerHdv(w, p, o, true) && o.k === 'objet') p.bag.push({ ...o.item, uid: w.newUid() });   // tout est plein : au sac malgré tout
      }
      await c.sauver();
    }
    for (const t of r.textes) EnLigne.journal(`Hôtel de Vente : ${t}`, 'evenement');
    if (r.kamas) EnLigne.journal(`Hôtel de Vente : +${K(r.kamas)} pour tes ventes`, 'evenement');
    return true;
  }

  private async acheter(a: Annonce) {
    const c = this.ctx(), w = c.world, p = w.players[0];
    if (p.kamas < a.prix) return this.dire(ERREURS.kamas), c.refaire();
    if (a.objet.k === 'ame' && p.ames.includes(ITEMS.resources[a.objet.id]?.ame ?? '')) return this.dire('Tu as déjà cette âme dans ton carnet.'), c.refaire();
    if (a.objet.k === 'objet' && p.bag.length >= p.tailleSac && (c.miroir() || !w.coffre.onglets.some(l => l.length < COFFRE.places))) return this.dire('Ton sac et ton coffre sont pleins.'), c.refaire();
    if (!c.miroir()) await c.sauver();   // le serveur compare aux kamas sauvés
    const r = await this.api<{ objet: unknown; prix: number; applique: boolean }>('/hdv/acheter', { emplacement: c.slot, id: a.id, prix: a.prix });
    this.confirme = -1;
    if (r.erreur) { this.erreur(r.erreur); if (r.erreur === 'vendu') this.offres = this.offres.filter(x => x.id !== a.id); return c.refaire(); }
    if (!r.applique) {
      const o = relireObjetHdv(r.objet);
      p.kamas -= r.prix;
      const ou = o ? donnerHdv(w, p, o) : null;
      await c.sauver();
      this.dire(`${a.nom}${a.n > 1 ? ` ×${a.n}` : ''} acheté ${K(a.prix)}${ou === 'coffre' ? ' : rangé dans le coffre du compte (sac plein)' : ''}.`, true);
    } else this.dire(`${a.nom}${a.n > 1 ? ` ×${a.n}` : ''} acheté ${K(a.prix)}.`, true);
    this.offres = this.offres.filter(x => x.id !== a.id);
    c.refaire();
  }
  private async favori(cle: string, nom: string, seuil: number | null, retirer = false) {
    await this.api('/hdv/favori', { cle, nom, seuil, retirer });
    await this.lireMoi();
  }

  // --- Vente ---------------------------------------------------------------------------------------------------------
  /** Ce que le perso peut mettre en vente (sac, ressources, apparats gagnés). */
  private vendables(): { cle: string; o: ObjetHdv; nom: string; n: number; refus: string | null; signe: boolean }[] {
    const p = this.W.players[0], L: { cle: string; o: ObjetHdv; nom: string; n: number; refus: string | null; signe: boolean }[] = [];
    for (const it of p.bag) { const o: ObjetHdv = { k: 'objet', item: it }; L.push({ cle: `o:${it.uid}`, o, nom: nomDe(o), n: 1, refus: refusHdv(o, ITEMS), signe: !!it.srv }); }
    for (const [id, n] of Object.entries(p.resources)) {
      if (n <= 0 || !ITEMS.resources[id]) continue;
      const o: ObjetHdv = { k: 'ressource', id, n: 1 }, refus = refusHdv(o, ITEMS);
      if (refus === 'pepite') continue;
      L.push({ cle: `r:${id}`, o, nom: nomDe(o), n, refus, signe: true });
    }
    // « Arène : » 17A : les âmes du carnet (ressource officielle « Âme capturée » de chaque archimonstre ou boss)
    for (const t of p.ames) {
      const id = AME_DE.get(t);
      if (!id) continue;
      const o: ObjetHdv = { k: 'ame', id };
      L.push({ cle: `m:${id}`, o, nom: nomDe(o), n: 1, refus: null, signe: true });
    }
    for (const id of p.apparats) {
      const o: ObjetHdv = { k: 'apparat', id };
      if (!sourceApparat(id)) continue;   // apparences de la collection d'équipement, familiers de la Ménagerie
      L.push({ cle: `a:${id}`, o, nom: nomDe(o), n: 1, refus: refusHdv(o, ITEMS), signe: true });
    }
    const q = this.rechVente.trim().toLowerCase();
    return L.filter(x => !q || x.nom.toLowerCase().includes(q)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  private async vendre(o: ObjetHdv, prix: number) {
    const c = this.ctx(), w = c.world, p = w.players[0], taxe = taxeHdv(prix);
    if (p.kamas < taxe) return this.dire(ERREURS.kamas), c.refaire();
    const r = await this.api<{ id: number; taxe: number; applique: boolean; reste?: number }>('/hdv/vendre', { emplacement: c.slot, objet: o, prix });
    if (r.erreur) return this.erreur(r.erreur, r), c.refaire();
    if (!r.applique) { retirerHdv(p, o); p.kamas -= r.taxe; await c.sauver(); }
    this.dire(`${nomDe(o)}${quantiteHdv(o) > 1 ? ` ×${quantiteHdv(o)}` : ''} en vente à ${K(prix)} (taxe ${K(r.taxe)}).`, true);
    this.choix = ''; this.prix = '';
    await this.lireMoi();
  }
  private async retirer(a: Annonce) {
    const c = this.ctx(), w = c.world, p = w.players[0];
    const r = await this.api<{ objet?: unknown; applique?: boolean; colis?: boolean }>('/hdv/retirer', { emplacement: c.slot, id: a.id });
    if (r.erreur) return this.erreur(r.erreur), c.refaire();
    if (r.objet && !r.applique) { const o = relireObjetHdv(r.objet); if (o && !donnerHdv(w, p, o) && o.k === 'objet') p.bag.push({ ...o.item, uid: w.newUid() }); await c.sauver(); }
    this.dire(r.colis ? `${a.nom} : sac plein, il t'attend à ta prochaine connexion.` : `${a.nom} : annonce retirée (la taxe est perdue).`, true);
    await this.lireMoi();
  }

  // --- Affichage -----------------------------------------------------------------------------------------------------
  html(): string {
    const c = this.ctx(), p = c.world.players[0];
    if (!Compte.enLigne || c.slot < 0) return `<div class="hdv"><div class="hdv-vide"><img src="assets/ui/hdv/equipement.png" alt=""><b>L'Hôtel de Vente demande ton compte Discord</b>
      <span>Connecte-toi à l'accueil et joue un perso en mode « En ligne » : tu pourras acheter et vendre de partout, avec tous les joueurs.</span></div></div>`;
    const ong = (k: VueHdv['onglet'], t: string) => `<button class="${this.onglet === k ? 'on' : ''}" data-hong="${k}">${t}</button>`;
    let corps = '';
    if (this.onglet === 'achat') corps = this.htmlAchat();
    else if (this.onglet === 'vente') corps = this.htmlVente();
    else corps = this.htmlHisto();
    return `<div class="hdv"><div class="hdv-haut"><nav>${ong('achat', 'Achat')}${ong('vente', 'Vente')}${ong('historique', 'Historique')}</nav>
      <span class="hdv-k" title="Tes kamas">${K(p.kamas)}</span></div>
      ${this.msg ? `<div class="hdv-msg ${this.msgBon ? 'bon' : ''}">${esc(this.msg)}</div>` : ''}${corps}</div>`;
  }
  private htmlAchat(): string {
    const types = TYPES_VENTE.map(t => `<button class="hdv-t ${this.type === t.k ? 'on' : ''}" data-htype="${t.k}" title="${t.nom}"><img src="assets/ui/hdv/${t.k}.png" alt=""><span>${t.nom}</span></button>`).join('');
    const cats = categories(this.type).map(([k, n]) => `<label class="hdv-ck"><input type="checkbox" data-hcat="${k}" ${this.cats.has(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('');
    const rar = this.type === 'equipement' ? `<div class="hdv-st">Rareté</div><div class="hdv-rar">${(['commun', 'rare', 'epique', 'legendaire', 'mythique'] as Rarity[]).map(r =>
      `<button class="${this.raretes.has(r) ? 'on' : ''}" data-hrar="${r}" style="--c:${RARITY_COLORS[r]}">${RARITY_NAMES[r]}</button>`).join('')}</div>` : '';
    const ligne = (a: Annonce) => {
      const unite = a.prix / a.n, moy = this.moyennes[a.cle], fav = this.moi?.favoris.some(f => f.cle === a.cle);
      const couleur = a.rarete ? RARITY_COLORS[a.rarete as Rarity] : '#e8e2d4';
      return `<div class="hdv-l ${a.moi ? 'moi' : ''}" data-hcourbe="${a.cle}" data-hnom="${esc(a.nom)}">
        <div class="hdv-ic" style="border-color:${couleur}">${icone(a.objet)}</div>
        <div class="hdv-n"><b style="color:${couleur}">${esc(a.nom)}${a.n > 1 ? ` <i>×${a.n}</i>` : ''}</b>
          <small>${a.rarete ? `${RARITY_NAMES[a.rarete as Rarity]} · ` : ''}niv. ${a.niveau} · ${esc(a.vendeur)}${moy ? ` · moyenne ${K(moy)}${a.n > 1 || a.type !== 'equipement' ? ' l\'unité' : ''}` : ''}</small>
          ${a.objet.k === 'objet' ? `<div class="hdv-li">${lignes(a.objet.item)}</div>` : ''}</div>
        <div class="hdv-p">${a.n > 1 ? `<small>${K(unite)} l'unité</small>` : ''}<b>${K(a.prix)}</b></div>
        <button class="hdv-fav ${fav ? 'on' : ''}" data-hfav="${a.cle}" data-hnom="${esc(a.nom)}" title="${fav ? 'Ne plus suivre' : 'Suivre cet objet (favori)'}">★</button>
        ${a.moi ? '<span class="hdv-a">À toi</span>' : `<button class="hdv-b ${this.confirme === a.id ? 'ok' : ''}" data-hach="${a.id}">${this.confirme === a.id ? `Confirmer ${K(a.prix)}` : 'Acheter'}</button>`}</div>`;
    };
    const liste = this.chargement ? '<div class="hdv-note">Recherche…</div>' : !this.charge ? '<div class="hdv-note">Choisis un type, coche des catégories puis lance la recherche.</div>'
      : this.offres.length ? this.offres.map(ligne).join('') + (this.suite || this.page ? `<div class="hdv-pages">${this.page ? '<button data-hpage="-1">‹ Précédents</button>' : ''}${this.suite ? '<button data-hpage="1">Suivants ›</button>' : ''}</div>` : '')
      : '<div class="hdv-note">Rien en vente avec ces filtres.</div>';
    return `<div class="hdv-achat"><aside><div class="hdv-types">${types}</div>
        <input type="search" data-hq placeholder="Rechercher un nom" value="${esc(this.q)}" aria-label="Rechercher">
        <div class="hdv-niv"><span>Niveau</span><input type="number" data-hmin min="1" max="200" placeholder="1" value="${esc(this.min)}"><span>à</span><input type="number" data-hmax min="1" max="200" placeholder="200" value="${esc(this.max)}"></div>
        ${rar}${cats ? `<div class="hdv-st">Catégories</div><div class="hdv-cats">${cats}</div>` : ''}
        <button class="hdv-go" data-hgo>Rechercher</button></aside>
      <section><div class="hdv-liste">${liste}</div>${this.courbe ? this.htmlCourbe() : ''}</section></div>`;
  }
  /** 2C : courbe de prix sur 7 jours ; 2D : favori avec alerte de prix. */
  private htmlCourbe(): string {
    const C = this.courbe!, max = Math.max(1, ...C.courbe.map(x => x.moyenne)), fav = this.moi?.favoris.find(f => f.cle === C.cle);
    const barres = C.courbe.length ? C.courbe.map(x => `<div class="hdv-bar" title="${x.jour} : ${K(x.moyenne)} l'unité (${x.n} vendus)"><i style="height:${Math.max(4, x.moyenne / max * 100)}%"></i><small>${x.jour.slice(8)}/${x.jour.slice(5, 7)}</small></div>`).join('')
      : '<div class="hdv-note">Aucune vente ces 7 derniers jours.</div>';
    return `<div class="hdv-courbe"><div><b>${esc(C.nom)}</b><small>Prix moyen sur 7 jours : ${C.moyenne ? K(C.moyenne) : '—'}</small></div><div class="hdv-bars">${barres}</div>
      <div class="hdv-alerte"><span>Me prévenir sous</span><input type="number" min="1" data-hseuil value="${fav?.seuil ?? ''}" placeholder="prix l'unité"><button data-hsuivre="${C.cle}">${fav ? 'Changer' : 'Suivre'}</button></div></div>`;
  }
  private htmlVente(): string {
    const p = this.W.players[0], L = this.vendables(), moi = this.moi, sel = L.find(x => x.cle === this.choix);
    const solo = !this.ctx().miroir();
    const ligne = (x: (typeof L)[number]) => {
      const it = x.o.k === 'objet' ? x.o.item : null, couleur = it ? RARITY_COLORS[it.rarity] : '#e8e2d4';
      const bloque = x.refus ?? (it && !x.signe ? 'signature' : null);
      return `<div class="hdv-v ${this.choix === x.cle ? 'on' : ''} ${bloque ? 'off' : ''}" data-hvc="${x.cle}" title="${bloque ? esc(ERREURS[bloque] ?? '') : ''}">
        <div class="hdv-ic" style="border-color:${couleur}">${icone(x.o)}</div><span style="color:${couleur}">${esc(x.nom)}</span>${x.n > 1 ? `<i>×${x.n}</i>` : ''}${it && !x.signe ? '<em title="Pas vu par le serveur">solo</em>' : ''}</div>`;
    };
    let fiche = '<div class="hdv-note">Choisis à gauche ce que tu veux vendre.</div>';
    if (sel) {
      const res = sel.o.k === 'ressource', n = res ? this.lot : 1, o: ObjetHdv = res ? { ...sel.o, n } as ObjetHdv : sel.o;
      const prix = Math.floor(Number(this.prix)) || 0, moy = this.moyenneDe === cleHdv(o) ? this.moyenneVente : null, al = prix ? alertePrix(prix / n, moy) : null;
      const bloque = sel.refus ?? (sel.o.k === 'objet' && !sel.signe ? 'signature' : null);
      const lots = res ? `<div class="hdv-lots">${HDV.lots.map(l => `<button class="${this.lot === l ? 'on' : ''} ${sel.n < l ? 'off' : ''}" data-hlot="${l}">Lot de ${l}</button>`).join('')}</div>` : '';
      fiche = `<div class="hdv-fiche"><div class="hdv-fh"><div class="hdv-ic g">${icone(sel.o)}</div><div><b>${esc(sel.nom)}</b><small>${typeVente(o, ITEMS) === 'equipement' ? RARITY_NAMES[(sel.o as { item: Item }).item.rarity] : TYPES_VENTE.find(t => t.k === typeVente(o, ITEMS))?.nom}${nomCat(o)}</small>
          ${sel.o.k === 'objet' ? `<div class="hdv-li">${lignes(sel.o.item)}</div>` : ''}</div></div>
        ${bloque ? `<div class="hdv-msg">${esc(ERREURS[bloque] ?? 'Ne se vend pas.')}</div>` : `${lots}
        <div class="hdv-prix"><label>Prix${n > 1 ? ` du lot de ${n}` : ''}<input type="number" min="1" data-hprix value="${esc(this.prix)}" placeholder="kamas"></label>
          <small>${prix && n > 1 ? `${K(prix / n)} l'unité · ` : ''}prix moyen ${moy ? `${K(moy)} l'unité` : 'inconnu (pas de vente ces 7 jours)'}</small>
          <small>Taxe de mise en vente : ${prix ? K(taxeHdv(prix)) : '2 %'}, perdue même si rien ne se vend.</small>
          ${al ? `<div class="hdv-msg">Attention : ${al === 'bas' ? 'moins d\'un quart' : 'plus de 4 fois'} le prix moyen.</div>` : ''}</div>
        <button class="hdv-go ${prix > 0 && (!res || sel.n >= n) && p.kamas >= taxeHdv(prix || 1) ? '' : 'off'}" data-hvendre>Mettre en vente</button>`}</div>`;
    }
    const annonces = moi ? moi.annonces.map(a => `<div class="hdv-ma"><div class="hdv-ic">${icone(a.objet)}</div><span>${esc(a.nom)}${a.n > 1 ? ` ×${a.n}` : ''}</span><b>${K(a.prix)}</b>
        <small>${Math.max(0, Math.ceil((a.expire - Date.now()) / 86_400_000))} j</small><button data-hret="${a.id}" title="Retirer (la taxe est perdue)">Retirer</button></div>`).join('') || '<div class="hdv-note">Aucune annonce.</div>' : '<div class="hdv-note">…</div>';
    return `<div class="hdv-vente"><aside><input type="search" data-hrv placeholder="Rechercher dans ton sac" value="${esc(this.rechVente)}" aria-label="Rechercher">
        <div class="hdv-sac">${L.map(ligne).join('') || '<div class="hdv-note">Rien à vendre.</div>'}</div></aside>
      <section>${fiche}<div class="hdv-st">Mes annonces ${moi ? `${moi.annonces.length} / ${moi.max}` : ''}${solo && moi ? ` · ressources du solo encore permises aujourd'hui : ${Math.max(0, moi.quota)}` : ''}</div><div class="hdv-mas">${annonces}</div></section></div>`;
  }
  private htmlHisto(): string {
    const m = this.moi;
    if (!m) return '<div class="hdv-note">…</div>';
    const date = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const l = (x: LigneHisto) => `<div class="hdv-h"><span>${esc(x.nom)}${x.n > 1 ? ` ×${x.n}` : ''}</span><b>${K(x.prix)}</b><small>${date(x.quand)}</small></div>`;
    const favs = m.favoris.map(f => `<div class="hdv-h ${f.alerte ? 'al' : ''}"><span>★ ${esc(f.nom)}</span><b>${f.min != null ? `${K(f.min)} l'unité` : 'rien en vente'}</b><small>${f.seuil ? `alerte sous ${K(f.seuil)}` : ''}</small>
      <button data-hvoir="${f.cle}" data-hnom="${esc(f.nom)}">Voir</button><button data-hunfav="${f.cle}">Retirer</button></div>`).join('') || '<div class="hdv-note">Clique sur ★ dans l\'onglet Achat pour suivre un objet.</div>';
    return `<div class="hdv-histo"><div><div class="hdv-st">Favoris</div>${favs}</div>
      <div><div class="hdv-st">Mes ventes</div>${m.ventes.map(l).join('') || '<div class="hdv-note">Aucune vente.</div>'}${m.colis ? `<div class="hdv-msg bon">${m.colis} envoi(s) en attente${m.kamas ? `, ${K(m.kamas)}` : ''} : ils arrivent dans un instant.</div>` : ''}</div>
      <div><div class="hdv-st">Mes achats</div>${m.achats.map(l).join('') || '<div class="hdv-note">Aucun achat.</div>'}</div></div>`;
  }

  /** Branche les boutons après chaque dessin. */
  brancher(el: HTMLElement) {
    const c = this.ctx(), refaire = () => c.refaire(), tous = <T extends HTMLElement>(s: string) => el.querySelectorAll<T>(s);
    tous('[data-hong]').forEach(b => b.addEventListener('click', () => {
      this.onglet = b.dataset.hong as VueHdv['onglet']; this.msg = '';
      if (this.onglet !== 'achat') void this.lireMoi(); else refaire();
    }));
    tous('[data-htype]').forEach(b => b.addEventListener('click', () => { this.type = b.dataset.htype as TypeVente; this.cats.clear(); this.raretes.clear(); void this.chercher(); }));
    tous<HTMLInputElement>('[data-hcat]').forEach(b => b.addEventListener('change', () => { if (b.checked) this.cats.add(b.dataset.hcat!); else this.cats.delete(b.dataset.hcat!); }));
    tous('[data-hrar]').forEach(b => b.addEventListener('click', () => { const r = b.dataset.hrar!; if (this.raretes.has(r)) this.raretes.delete(r); else this.raretes.add(r); b.classList.toggle('on'); }));
    const q = el.querySelector<HTMLInputElement>('[data-hq]');
    q?.addEventListener('input', () => { this.q = q.value; });
    q?.addEventListener('keydown', e => { if (e.key === 'Enter') void this.chercher(); e.stopPropagation(); });
    el.querySelector<HTMLInputElement>('[data-hmin]')?.addEventListener('input', e => { this.min = (e.target as HTMLInputElement).value; });
    el.querySelector<HTMLInputElement>('[data-hmax]')?.addEventListener('input', e => { this.max = (e.target as HTMLInputElement).value; });
    el.querySelector('[data-hgo]')?.addEventListener('click', () => void this.chercher());
    tous('[data-hpage]').forEach(b => b.addEventListener('click', () => void this.chercher(Math.max(0, this.page + Number(b.dataset.hpage)))));
    tous('[data-hach]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const a = this.offres.find(x => x.id === Number(b.dataset.hach));
      if (!a) return;
      if (this.confirme !== a.id) { this.confirme = a.id; refaire(); return; }
      void this.acheter(a);
    }));
    tous('[data-hcourbe]').forEach(b => b.addEventListener('click', () => void this.voirCourbe(b.dataset.hcourbe!, b.dataset.hnom ?? '')));
    tous('[data-hfav]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const k = b.dataset.hfav!, f = this.moi?.favoris.find(x => x.cle === k);
      void this.favori(k, b.dataset.hnom ?? '', f?.seuil ?? null, !!f);
    }));
    el.querySelector<HTMLElement>('[data-hsuivre]')?.addEventListener('click', e => {
      const s = Number(el.querySelector<HTMLInputElement>('[data-hseuil]')?.value) || null, C = this.courbe;
      if (C) void this.favori((e.currentTarget as HTMLElement).dataset.hsuivre!, C.nom, s);
    });
    tous('[data-hvoir]').forEach(b => b.addEventListener('click', () => { this.onglet = 'achat'; void this.voirCourbe(b.dataset.hvoir!, b.dataset.hnom ?? ''); }));
    tous('[data-hunfav]').forEach(b => b.addEventListener('click', () => void this.favori(b.dataset.hunfav!, '', null, true)));
    // vente
    const rv = el.querySelector<HTMLInputElement>('[data-hrv]');
    rv?.addEventListener('input', () => { this.rechVente = rv.value; const pos = rv.selectionStart; refaire(); const n = document.querySelector<HTMLInputElement>('[data-hrv]'); n?.focus(); n?.setSelectionRange(pos, pos); });
    rv?.addEventListener('keydown', e => e.stopPropagation());
    tous('[data-hvc]').forEach(b => b.addEventListener('click', () => {
      this.choix = b.dataset.hvc!; this.prix = ''; this.lot = 1; this.msg = '';
      const x = this.vendables().find(v => v.cle === this.choix);
      if (x) { const o = x.o.k === 'ressource' ? { ...x.o, n: 1 } : x.o, k = cleHdv(o); this.moyenneDe = k; this.moyenneVente = null;
        void this.api<{ moyenne: number | null }>(`/hdv/prix?cle=${encodeURIComponent(k)}`).then(r => { if (this.moyenneDe === k) { this.moyenneVente = r.moyenne ?? null; refaire(); } }); }
      refaire();
    }));
    tous('[data-hlot]').forEach(b => b.addEventListener('click', () => { this.lot = Number(b.dataset.hlot); refaire(); }));
    const pr = el.querySelector<HTMLInputElement>('[data-hprix]');
    pr?.addEventListener('keydown', e => e.stopPropagation());
    pr?.addEventListener('change', () => { this.prix = pr.value; refaire(); });
    el.querySelector('[data-hvendre]')?.addEventListener('click', () => {
      if (pr) this.prix = pr.value;
      const x = this.vendables().find(v => v.cle === this.choix), prix = Math.floor(Number(this.prix));
      if (!x || !(prix > 0)) return;
      const o: ObjetHdv = x.o.k === 'ressource' ? { k: 'ressource', id: x.o.id, n: this.lot } : x.o;
      if (o.k === 'ressource' && x.n < o.n) return this.dire(`Tu n'as que ${x.n} ${x.nom}.`), refaire();
      void this.vendre(o, prix);
    });
    tous('[data-hret]').forEach(b => b.addEventListener('click', () => { const a = this.moi?.annonces.find(x => x.id === Number(b.dataset.hret)); if (a) void this.retirer(a); }));
  }
  /** À l'ouverture de la fenêtre. */
  ouvrir() {
    this.msg = '';
    if (!Compte.enLigne) return;
    void this.lireMoi();
    void this.encaisser().then(n => { if (n) this.ctx().refaire(); });
    if (!this.charge) void this.chercher();
  }
}

export const HDV_CSS = `
.dw .win.hdv{width:min(1000px,96vw);height:min(680px,90vh);display:flex;flex-direction:column}
.hdv{flex:1;min-height:0;display:flex;flex-direction:column;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif;font-size:13px}
.hdv :where(button){all:unset;cursor:pointer;box-sizing:border-box}
.hdv input:not([type=checkbox]){background:#14130f;border:1px solid #3a3a2c;color:#f2ead6;border-radius:4px;padding:5px 7px;font:inherit;box-sizing:border-box}
.hdv-haut{display:flex;align-items:center;border-bottom:1px solid #2c2a1f;background:#1b1a13}
.hdv-haut nav{display:flex;flex:1}
.hdv-haut nav button{padding:10px 18px;font-weight:700;color:#c9c1a8;border-bottom:3px solid transparent}
.hdv-haut nav button.on{color:#fff;border-bottom-color:#b9e54b;background:#24231a}
.hdv-k{padding:0 14px;color:#e8c66a;font-weight:700}
.hdv-msg{margin:8px 12px 0;padding:7px 10px;border-radius:5px;background:#3a1f1a;color:#f2c2b0}
.hdv-msg.bon{background:#1f2e17;color:#cfe8a8}
.hdv-note{padding:14px;color:#a99d86;text-align:center}
.hdv-st{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b9e54b;font-weight:700;margin:12px 0 6px}
.hdv-achat,.hdv-vente{flex:1;min-height:0;display:flex;gap:12px;padding:10px 12px}
.hdv aside{width:240px;flex:none;display:flex;flex-direction:column;gap:8px;overflow:auto}
.hdv section{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;overflow:auto}
.hdv-types{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.hdv-t{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:6px;background:#1d1c15;border:1px solid #2c2a1f;font-size:11px;color:#c9c1a8;text-align:center}
.hdv-t img{width:34px;height:34px;object-fit:contain}
.hdv-t.on{border-color:#b9e54b;color:#fff;background:#262419}
.hdv-niv{display:flex;align-items:center;gap:6px}.dw .hdv-niv input{width:64px}
.hdv-rar{display:flex;flex-wrap:wrap;gap:4px}
.hdv-rar button{padding:4px 8px;border-radius:4px;border:1px solid #3a3a2c;color:var(--c);font-weight:700;font-size:12px}
.hdv-rar button.on{background:#2a281d;border-color:var(--c)}
.hdv-cats{display:flex;flex-direction:column;gap:3px}
.hdv-ck{display:flex;gap:6px;align-items:center;color:#d6cfb8;cursor:pointer}.dw .hdv .hdv-ck input{appearance:none;flex:none;width:24px;height:20px;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;background:url(assets/ui/d3/btn_checkbox_normal.png) center/100% no-repeat;cursor:pointer}.dw .hdv .hdv-ck input:checked{background-image:url(assets/ui/d3/btn_checkbox_selected.png)}
.hdv-go{display:block;text-align:center;padding:8px 12px;border-radius:5px;background:#5d8a1f;color:#fff;font-weight:700}
.hdv-go:hover{background:#6fa125}.hdv-go.off{opacity:.45;pointer-events:none}
.hdv-liste{display:flex;flex-direction:column;gap:4px}
.hdv-l{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;background:#1b1a13;border:1px solid #26241b;cursor:pointer}
.hdv-l:hover{border-color:#3d3a2b}.hdv-l.moi{opacity:.75}
.hdv-ic{width:40px;height:40px;flex:none;border-radius:5px;border:2px solid #3a3a2c;background:#14130f;display:grid;place-items:center}
.hdv-ic .ic,.hdv-ic img{width:34px;height:34px;object-fit:contain}
.hdv-ic.g{width:56px;height:56px}.hdv-ic.g .ic,.hdv-ic.g img{width:48px;height:48px}
.hdv-n{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hdv-n b i{color:#c9c1a8;font-style:normal}
.hdv-n small,.hdv-p small{color:#a99d86;font-size:11px}
.hdv-li{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px;color:#d6cfb8}
.hdv-li .x{color:#9fd0ff}.hdv-li .m{color:#ff8a7a}.hdv-li .l{color:#f08a2c}
.hdv-p{text-align:right;display:flex;flex-direction:column}.hdv-p b{color:#e8c66a}
.hdv-fav{font-size:18px;color:#5c5845;padding:0 4px}.hdv-fav.on{color:#e8c66a}
.hdv-b{padding:6px 12px;border-radius:5px;background:#3d5a17;color:#fff;font-weight:700;white-space:nowrap}
.hdv-b.ok{background:#8a6a1f}
.hdv-a{color:#a99d86;font-size:12px}
.hdv-pages{display:flex;justify-content:center;gap:12px;padding:6px}.hdv-pages button{color:#b9e54b;font-weight:700}
.hdv-courbe{border-top:1px solid #2c2a1f;padding-top:8px;display:flex;flex-direction:column;gap:6px}
.hdv-courbe small{display:block;color:#a99d86}
.hdv-bars{display:flex;align-items:flex-end;gap:6px;height:90px}
.hdv-bar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px}
.hdv-bar i{width:100%;background:linear-gradient(#b9e54b,#5d8a1f);border-radius:3px 3px 0 0}
.hdv-bar small{font-size:10px}
.hdv-alerte{display:flex;gap:6px;align-items:center}.dw .hdv-alerte input{width:110px}
.hdv-alerte button,.hdv-ma button,.hdv-h button{padding:4px 10px;border-radius:4px;background:#2c2a1f;color:#e8e2d4;font-size:12px}
.hdv-sac{display:flex;flex-direction:column;gap:3px}
.hdv-v{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:5px;cursor:pointer;border:1px solid transparent}
.hdv-v .hdv-ic{width:32px;height:32px}.hdv-v .hdv-ic .ic,.hdv-v .hdv-ic img{width:26px;height:26px}
.hdv-v span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdv-v i{color:#c9c1a8;font-style:normal;font-size:12px}
.hdv-v em{font-style:normal;font-size:10px;color:#a99d86;border:1px solid #3a3a2c;border-radius:3px;padding:0 4px}
.hdv-v.on{border-color:#b9e54b;background:#232117}.hdv-v.off{opacity:.5}
.hdv-fiche{display:flex;flex-direction:column;gap:10px;padding:10px;border-radius:6px;background:#1b1a13;border:1px solid #26241b}
.hdv-fh{display:flex;gap:10px}.hdv-fh small{display:block;color:#a99d86}
.hdv-lots{display:flex;gap:6px}
.hdv-lots button{padding:5px 10px;border-radius:4px;border:1px solid #3a3a2c}
.hdv-lots button.on{border-color:#b9e54b;color:#fff}.hdv-lots button.off{opacity:.4;pointer-events:none}
.hdv-prix{display:flex;flex-direction:column;gap:4px}.hdv-prix label{display:flex;align-items:center;gap:8px;font-weight:700}.dw .hdv-prix input{width:160px}
.hdv-prix small{color:#a99d86}
.hdv-mas{display:flex;flex-direction:column;gap:3px}
.hdv-ma,.hdv-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:4px 6px;border-radius:5px;background:#1b1a13}
.hdv-ma .hdv-ic{width:30px;height:30px}.hdv-ma .hdv-ic .ic,.hdv-ma .hdv-ic img{width:24px;height:24px}
.hdv-ma span,.hdv-h span{flex:1;min-width:0}.hdv-ma b,.hdv-h b{color:#e8c66a}.hdv-ma small,.hdv-h small{color:#a99d86}
.hdv-h.al{border:1px solid #e8c66a}
.hdv-histo{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:10px 12px}
.hdv-vide{margin:auto;max-width:420px;text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center;padding:30px}
.hdv-vide img{width:64px}.hdv-vide span{color:#a99d86}
@media (max-width:760px){.hdv-achat,.hdv-vente{flex-direction:column}.hdv aside{width:auto}.hdv-histo{grid-template-columns:1fr}}
`;
