// Compte Discord et persos en ligne (maquette « Vrai multi : » 3A, 4A, 5A, 11B ; serveur : serveur/comptes.mjs).
// Le serveur renvoie le jeu à diablofus.com/#connexion=<jeton> : on garde le jeton dans le navigateur et on efface l'adresse.
// En mode « En ligne », persos.ts lit et écrit une copie locale des persos du compte ; ce module l'envoie au serveur
// (au plus toutes les 30 s par emplacement, et tout de suite quand on quitte la page ou revient à l'accueil).
import { EMPLACEMENTS, lireCoffreBrut, lirePersos, lirePersosLocaux, remplacerCoffreEnLigne, remplacerPersosEnLigne, sourceEnLigne, type Perso } from './persos';

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.diablofus.com';
const CLE_JETON = 'diablofus.jeton', CLE_MODE = 'diablofus.mode';
const ECART = 30_000;

export interface InfosCompte { nom: string; avatar: string | null; testeur: boolean; admin: boolean; importe: boolean }
type Etat = 'hors' | 'chargement' | 'connecte' | 'erreur';
const ERREURS: Record<string, string> = {
  indisponible: 'La connexion Discord n\'est pas encore ouverte.',
  refus: 'Connexion annulée sur Discord.',
  discord: 'Discord n\'a pas répondu, réessaie dans un instant.',
  occupe: 'Trop de connexions en même temps, réessaie dans un instant.',
};

const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrireCle = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* rien */ } };

class CompteEnLigne {
  etat: Etat = 'hors';
  infos: InfosCompte | null = null;
  /** Message à montrer une fois à l'accueil (erreur de connexion, conflit…). */
  message = '';
  private ecouteurs = new Set<() => void>();
  /** Dernière version envoyée (ou reçue) de chaque emplacement et de chaque coffre. */
  private envoye = new Map<string, string>();
  private attente = new Map<string, number>();
  private dernierEnvoi = new Map<string, number>();

  get jeton() { return lire(CLE_JETON); }
  get enLigne() { return this.etat === 'connecte' && lire(CLE_MODE) === 'enligne'; }

  /** Au lancement (main.ts), avant tout le reste : lit #connexion=… ou #connexion-erreur=… et nettoie l'adresse. */
  demarrer() {
    const h = location.hash, a = /^#connexion=([0-9a-f]{64})$/.exec(h), e = /^#connexion-erreur=(\w+)$/.exec(h);
    if (a) { ecrireCle(CLE_JETON, a[1]); ecrireCle(CLE_MODE, 'enligne'); }
    if (e) this.message = ERREURS[e[1]] ?? 'La connexion n\'a pas marché.';
    if (a || e) history.replaceState(null, '', location.pathname + location.search);
    sourceEnLigne(false, quoi => this.programmer(quoi));
    addEventListener('pagehide', () => this.toutEnvoyer(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.toutEnvoyer(true); });
    if (this.jeton) void this.charger();
  }
  ecouter(f: () => void) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }
  private changer() { sourceEnLigne(this.enLigne); for (const f of this.ecouteurs) f(); }

  /** Persos Hardcore morts (« p0 »…) : leur suppression part comme une tombe, gardée par le classement (Ladder 3B). */
  private morts = new Map<string, { niveau: number; lieu: string; tueur: string }>();
  /** Un perso Hardcore vient de mourir : à appeler juste avant supprimerPerso. */
  tomber(slot: number, stele: { niveau: number; lieu: string; tueur: string }) { if (this.enLigne) this.morts.set(`p${slot}`, stele); }
  /** Requête au serveur avec le jeton du compte (classement, réglages). */
  appeler(chemin: string, o: RequestInit = {}) { return this.api(chemin, o); }
  private async api(chemin: string, o: RequestInit = {}) {
    const r = await fetch(API + chemin, { ...o, headers: { authorization: `Bearer ${this.jeton}`, ...(o.body ? { 'content-type': 'application/json' } : {}), ...o.headers } });
    if (r.status === 401) { ecrireCle(CLE_JETON, null); this.etat = 'hors'; this.infos = null; this.message = 'Ta connexion a expiré, reconnecte-toi.'; this.changer(); throw new Error('connexion'); }
    return r;
  }

  /** Lit le compte et ses persos sur le serveur ; remplace la copie locale. */
  async charger() {
    if (!this.jeton) return;
    this.etat = 'chargement'; this.changer();
    try {
      const r = await this.api('/moi');
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json() as { compte: InfosCompte; persos: ({ perso: Perso } | null)[]; coffres: Record<string, unknown> };
      this.infos = d.compte;
      const l = Array.from({ length: EMPLACEMENTS }, (_, i) => d.persos[i]?.perso ?? null);
      remplacerPersosEnLigne(l);
      l.forEach((p, i) => this.envoye.set(`p${i}`, JSON.stringify(p)));
      for (const s of ['normal', 'hardcore'] as const) { remplacerCoffreEnLigne(s, d.coffres?.[s] ?? null); this.envoye.set(s, JSON.stringify(d.coffres?.[s] ?? null)); }
      this.etat = 'connecte';
    } catch (e) {
      if ((e as Error).message !== 'connexion') { this.etat = 'erreur'; this.message = 'Le serveur ne répond pas : tes persos en ligne reviendront dès qu\'il répond.'; }
    }
    this.changer();
  }

  connecter() { location.href = `${API}/connexion?retour=${encodeURIComponent(location.origin + location.pathname)}`; }
  async deconnecter() {
    await this.toutEnvoyer();
    try { await this.api('/deconnexion', { method: 'POST' }); } catch { /* déjà expirée */ }
    ecrireCle(CLE_JETON, null); this.etat = 'hors'; this.infos = null; this.changer();
  }
  /** « Navigateur » ou « En ligne » (persos de l'écran Mes personnages). */
  choisir(enLigne: boolean) { ecrireCle(CLE_MODE, enLigne ? 'enligne' : 'local'); this.changer(); }

  /** 4A : met UNE fois un perso du navigateur en ligne, dans le premier emplacement libre du compte. */
  async importer(local: number): Promise<string | null> {
    const p = lirePersosLocaux()[local], libre = lirePersos().findIndex(x => !x);
    if (!p) return 'Perso introuvable.';
    if (!this.enLigne) return 'Passe d\'abord en mode « En ligne ».';
    if (libre < 0) return 'Tes 3 emplacements en ligne sont pris.';
    if (lirePersos().some(q => q?.nom.toLowerCase() === p.nom.toLowerCase())) return 'Tu as déjà un perso de ce nom en ligne.';
    const r = await this.api('/import', { method: 'POST', body: JSON.stringify({ emplacement: libre, perso: p }) }).catch(() => null);
    if (!r) return 'Le serveur ne répond pas.';
    if (r.status === 403) return 'Tu as déjà mis un perso en ligne.';
    if (!r.ok) return 'Le serveur a refusé ce perso.';
    await this.charger();
    return null;
  }

  /** Une écriture locale (persos.ts) : envoi groupé, au plus toutes les 30 s par emplacement. */
  private programmer(quoi: 'persos' | 'normal' | 'hardcore' | 'test') {
    if (!this.enLigne || quoi === 'test') return;
    const cles = quoi === 'persos' ? Array.from({ length: EMPLACEMENTS }, (_, i) => `p${i}`) : [quoi];
    for (const k of cles) {
      if (this.contenu(k) === this.envoye.get(k) || this.attente.has(k)) continue;
      const delai = Math.max(0, (this.dernierEnvoi.get(k) ?? 0) + ECART - Date.now());
      // une suppression part tout de suite
      this.attente.set(k, window.setTimeout(() => void this.envoyer(k), k.startsWith('p') && this.contenu(k) === 'null' ? 0 : delai));
    }
  }
  private contenu(k: string) { return k.startsWith('p') ? JSON.stringify(lirePersos()[Number(k.slice(1))] ?? null) : JSON.stringify(lireCoffreBrut(k as 'normal' | 'hardcore')); }
  private async envoyer(k: string, garder = false) {
    clearTimeout(this.attente.get(k)); this.attente.delete(k);
    const c = this.contenu(k);
    if (c === this.envoye.get(k) || !this.jeton) return;
    this.dernierEnvoi.set(k, Date.now());
    const coffre = !k.startsWith('p'), p = coffre ? null : JSON.parse(c) as Perso | null;
    const mort = !coffre && !p ? this.morts.get(k) : undefined;
    const chemin = mort ? `/tombes/${k.slice(1)}` : coffre ? `/coffres/${k}` : `/persos/${k.slice(1)}`;
    const corps = mort ? JSON.stringify(mort) : coffre ? JSON.stringify({ coffre: JSON.parse(c) }) : p ? JSON.stringify({ perso: p, maj: p.maj }) : undefined;
    try {
      const r = await this.api(chemin, { method: mort ? 'POST' : corps ? 'PUT' : 'DELETE', body: corps, keepalive: garder && (corps?.length ?? 0) < 60_000 });
      if (r.ok && mort) this.morts.delete(k);
      if (r.ok) { this.envoye.set(k, c); return; }
      if (r.status === 409) { this.message = 'Ce perso a été joué plus récemment sur un autre PC : sa dernière version est revenue.'; await this.charger(); return; }
      if (r.status === 413) this.message = 'Ce perso est trop lourd pour être sauvé en ligne.';
    } catch { /* hors ligne : on réessaiera à la prochaine sauvegarde */ }
  }
  /** Envoie tout ce qui attend (retour à l'accueil, page fermée). */
  async toutEnvoyer(garder = false) {
    if (!this.enLigne) return;
    const cles = [...Array.from({ length: EMPLACEMENTS }, (_, i) => `p${i}`), 'normal', 'hardcore'];
    await Promise.all(cles.map(k => this.envoyer(k, garder)));
  }
}

export const Compte = new CompteEnLigne();
