// Écran du bas de l'AYN Thor (maquette « Console : » 9A) : page compagnon diablofus.com/#compagnon, ouverte dans Chrome
// sur l'écran du bas pendant que le jeu tourne en haut (appli installée). Page de test : elle dit par où les deux pages se parlent.
// 1. lien direct (BroadcastChannel), 2. stockage partagé (événement storage), et en secours, en lecture seule :
// 3. la sauvegarde du perso (écrite toutes les 5 s par le jeu), 4. le serveur (compte Discord en ligne).
import { API, Compte } from './compte';
import { dernier, lirePersos } from './persos';

export interface EtatCompagnon { nom: string; classe: string; niveau: number; pv: number; pvMax: number; lieu: string; kamas: number; potions: number }
export type MsgCompagnon =
  | { k: 'bonjour' } | { k: 'ping'; n: number; t: number } | { k: 'pong'; n: number; t: number }
  | { k: 'etat'; e: EtatCompagnon | null } | { k: 'action'; a: ActionCompagnon };
export type ActionCompagnon = 'potion' | 'inv' | 'sorts' | 'car' | 'carte' | 'quetes' | 'fermer';
export type Lien = 'direct' | 'stockage';
type De = 'jeu' | 'ecran';
interface Enveloppe { de: De; id: string; m: MsgCompagnon }

const CANAL = 'diablofus-compagnon', CLE = 'diablofus.compagnon.';

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
    try { localStorage.setItem(CLE + this.moi, JSON.stringify(env)); } catch { /* stockage indisponible */ }
  }
}

// ---------- Côté jeu (écran du haut) : muet tant qu'aucun écran du bas ne s'est annoncé ----------
export interface BrancheCompagnon { etat(): EtatCompagnon | null; action(a: ActionCompagnon): void; annonce(t: string): void }
let canalJeu: Canal | null = null, branche: BrancheCompagnon | null = null, actifJusque = 0, envoiT = 0;

/** Appelé à chaque lancement de la scène de jeu : la page n'a qu'un canal, la scène du moment répond. */
export function brancherCompagnon(b: BrancheCompagnon) {
  branche = b;
  if (canalJeu) return;
  const c = canalJeu = new Canal('jeu');
  c.ecoute = (m, par) => {
    const t = performance.now();
    if (m.k === 'bonjour') {
      if (t > actifJusque) branche?.annonce(`Écran du bas relié (${par === 'direct' ? 'lien direct' : 'par le stockage'})`);
      actifJusque = t + 6000; envoiT = 0;
      c.envoyer({ k: 'bonjour' });
    } else if (m.k === 'ping') {
      c.envoyer({ k: 'pong', n: m.n, t: m.t });
      branche?.annonce('Coucou de l\'écran du bas !');
    } else if (m.k === 'action') branche?.action(m.a);
  };
}

/** À chaque image : l'état du perso part vers l'écran du bas 3 fois par seconde, seulement s'il est là. */
export function tickCompagnon() {
  const t = performance.now();
  if (!canalJeu || t > actifJusque || t - envoiT < 330) return;
  envoiT = t;
  canalJeu.envoyer({ k: 'etat', e: branche?.etat() ?? null });
}

// ---------- Page compagnon (écran du bas) ----------
const CSS = `
#cmp{position:fixed;inset:0;overflow:auto;background:#0d0f14;color:#e8e2d4;font:500 15px Lexend,system-ui,sans-serif;padding:12px 14px calc(12px + env(safe-area-inset-bottom));box-sizing:border-box;-webkit-tap-highlight-color:transparent}
#cmp h1{font:400 18px Rowdies,Lexend,sans-serif;margin:0 0 8px;color:#d3f46f;display:flex;justify-content:space-between;align-items:center;gap:8px}
#cmp h1 small{font:500 12px Lexend,sans-serif;color:#8e8a78}
#cmp .liens{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
#cmp .lien{background:#161a22;border:1px solid #2a2f3a;border-radius:10px;padding:7px 9px;font-size:13px;line-height:1.3}
#cmp .lien b{display:flex;align-items:center;gap:6px;font-weight:700}
#cmp .lien i{width:10px;height:10px;border-radius:50%;background:#4a4f5a;flex:none}
#cmp .lien.ok i{background:#7fd04b;box-shadow:0 0 8px #7fd04b}
#cmp .lien.lent i{background:#ffc14d}
#cmp .lien span{color:#8e8a78;font-size:12px}
#cmp .perso{background:#161a22;border:1px solid #4d5a2c;border-radius:12px;padding:9px 11px;margin-bottom:10px}
#cmp .perso .l1{display:flex;justify-content:space-between;gap:8px;font-weight:700}
#cmp .perso .l2{color:#b9b29c;font-size:13px;margin-top:2px}
#cmp .pv{height:10px;border-radius:5px;background:#2a1414;margin:7px 0 2px;overflow:hidden}
#cmp .pv div{height:100%;background:linear-gradient(#ff6a5a,#c8332a);width:0;transition:width .2s}
#cmp .src{font-size:11px;color:#8e8a78}
#cmp .btns{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}
#cmp button{font:600 14px Lexend,sans-serif;color:#e8e2d4;background:#232a1a;border:1px solid #4d5a2c;border-radius:10px;padding:13px 4px;touch-action:manipulation}
#cmp button:active{background:#3a4a1c;transform:scale(.97)}
#cmp button.large{grid-column:span 2;background:#2b3a14;color:#d3f46f}
#cmp button:disabled{opacity:.4}
#cmp .journal{font:12px ui-monospace,Menlo,monospace;color:#9a957f;background:#0a0b0f;border-radius:8px;padding:6px 8px;min-height:60px;white-space:pre-wrap}
#cmp .aide{font-size:13px;color:#cfc8b0;background:#1d1a10;border:1px solid #5a5236;border-radius:10px;padding:8px 10px;margin-bottom:10px}
#cmp .aide[hidden]{display:none}`;

const NOMS: Record<string, string> = { direct: 'Lien direct', stockage: 'Stockage partagé', sauvegarde: 'Sauvegarde', serveur: 'Serveur' };

/** Remplace la page par l'écran compagnon (le jeu ne se charge pas). */
export function ecranCompagnon() {
  document.getElementById('chargement')?.remove();
  document.getElementById('game')?.remove();
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  const r = document.createElement('div'); r.id = 'cmp'; document.body.appendChild(r);
  r.innerHTML = `<h1>Écran du bas <small>Diablofus · page de test</small></h1>
    <div class="aide" hidden>Lance le jeu sur l'écran du haut (l'appli installée) et entre en jeu avec un perso. Cette page le trouve toute seule.</div>
    <div class="liens">${Object.keys(NOMS).map(k => `<div class="lien" data-l="${k}"><b><i></i>${NOMS[k]}</b><span>jamais</span></div>`).join('')}</div>
    <div class="perso"><div class="l1"><span class="nom">Aucun perso</span><span class="niv"></span></div><div class="l2"></div><div class="pv"><div></div></div><div class="src"></div></div>
    <div class="btns">
      <button class="large" data-a="ping">Coucou au jeu</button><button class="large" data-a="potion">Potion</button>
      <button data-a="inv">Sac</button><button data-a="sorts">Sorts</button><button data-a="carte">Carte</button><button data-a="quetes">Quêtes</button>
      <button data-a="car">Caracs</button><button data-a="fermer">Fermer</button><button class="large" data-a="rapport">Copier le rapport</button>
    </div>
    <div class="journal"></div>`;
  const q = <T extends HTMLElement>(sel: string) => r.querySelector(sel) as T;
  const lignes: string[] = [];
  const noter = (t: string) => {
    const h = new Date().toLocaleTimeString('fr-FR');
    lignes.unshift(`${h}  ${t}`); lignes.length = Math.min(lignes.length, 8);
    q('.journal').textContent = lignes.join('\n');
  };

  const c = new Canal('ecran');
  const debut = performance.now();
  const vu: Record<string, number> = { direct: 0, stockage: 0, sauvegarde: 0, serveur: 0 };
  const detail: Record<string, string> = {};
  const pings = new Map<number, number>(); let nPing = 0, dernierPing = '';
  let etatDirect: { e: EtatCompagnon | null; t: number } | null = null;
  type Secours = { e: Partial<EtatCompagnon>; maj: number } | null;
  let deSauvegarde: Secours = null, deServeur: Secours = null;
  let premier = true;

  c.ecoute = (m, par) => {
    vu[par] = performance.now();
    if (premier) { premier = false; noter(`Jeu trouvé (${NOMS[par].toLowerCase()})`); }
    if (m.k === 'etat') etatDirect = { e: m.e, t: performance.now() };
    else if (m.k === 'pong') {
      const t0 = pings.get(m.n);
      if (t0 != null) { pings.delete(m.n); dernierPing = `${Math.round(performance.now() - t0)} ms`; noter(`Réponse du jeu en ${dernierPing} (${NOMS[par].toLowerCase()})`); }
    }
  };

  // les voies directes : on s'annonce toutes les 2 s, le jeu répond et envoie l'état tant qu'il nous entend
  const annoncer = () => c.envoyer({ k: 'bonjour' });
  annoncer(); setInterval(annoncer, 2000);
  if (!c.direct) detail.direct = 'absent de ce navigateur';

  // secours 1 : la sauvegarde du dernier perso joué (même site, même stockage), relue toutes les 3 s
  let majSauvegarde = 0;
  const lireSauvegarde = () => {
    const i = dernier(), p = i == null ? null : lirePersos()[i];
    if (!p) { detail.sauvegarde = 'aucun perso'; return; }
    if (p.maj !== majSauvegarde) { if (majSauvegarde) vu.sauvegarde = performance.now(); majSauvegarde = p.maj; }
    detail.sauvegarde = `écrite à ${new Date(p.maj).toLocaleTimeString('fr-FR')}`;
    deSauvegarde = { e: { nom: p.nom, classe: p.classe, niveau: p.etat?.level, lieu: p.lieu, kamas: p.etat?.kamas, potions: p.etat?.potions }, maj: p.maj };
  };
  lireSauvegarde(); setInterval(lireSauvegarde, 3000);

  // secours 2 : le serveur (compte Discord en ligne), relu toutes les 15 s
  const lireServeur = async () => {
    const jeton = Compte.jeton;
    if (!jeton) { detail.serveur = 'pas connecté (Discord)'; return; }
    try {
      const rep = await fetch(`${API}/moi`, { headers: { authorization: `Bearer ${jeton}` }, cache: 'no-store' });
      if (!rep.ok) { detail.serveur = `erreur ${rep.status}`; return; }
      const d = await rep.json() as { persos: ({ perso: import('./persos').Perso } | null)[] };
      const i = dernier() ?? d.persos.findIndex(x => x), p = i == null || i < 0 ? null : d.persos[i]?.perso;
      vu.serveur = performance.now();
      if (!p) { detail.serveur = 'répond, aucun perso'; return; }
      detail.serveur = `perso du ${new Date(p.maj).toLocaleTimeString('fr-FR')}`;
      deServeur = { e: { nom: p.nom, classe: p.classe, niveau: p.etat?.level, lieu: p.lieu, kamas: p.etat?.kamas, potions: p.etat?.potions }, maj: p.maj };
    } catch { detail.serveur = 'injoignable'; }
  };
  void lireServeur(); setInterval(() => void lireServeur(), 15000);

  r.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (!a) return;
    if (a === 'ping') { const n = ++nPing; pings.set(n, performance.now()); c.envoyer({ k: 'ping', n, t: Date.now() }); noter('Coucou envoyé'); return; }
    if (a === 'rapport') { void copierRapport(); return; }
    c.envoyer({ k: 'action', a: a as ActionCompagnon });
    noter(`Bouton ${(e.target as HTMLElement).textContent} envoyé`);
  });

  const age = (t: number) => { const s = (performance.now() - t) / 1000; return s < 2 ? 'à l\'instant' : s < 60 ? `il y a ${Math.round(s)} s` : `il y a ${Math.round(s / 60)} min`; };
  const dessiner = () => {
    const t = performance.now();
    for (const k of Object.keys(NOMS)) {
      const el = q(`.lien[data-l="${k}"]`), d = t - vu[k], fenetre = k === 'serveur' ? 20000 : k === 'sauvegarde' ? 8000 : 3000;
      el.className = `lien${vu[k] && d < fenetre ? ' ok' : vu[k] ? ' lent' : ''}`;
      el.querySelector('span')!.textContent = [vu[k] ? age(vu[k]) : 'jamais', detail[k]].filter(Boolean).join(' · ');
    }
    const direct = etatDirect && t - etatDirect.t < 3000 ? etatDirect.e : null;
    const secours = [deSauvegarde, deServeur].filter(x => x).sort((a, b) => b!.maj - a!.maj)[0] ?? null;
    const e: Partial<EtatCompagnon> | null = direct ?? secours?.e ?? null;
    q('.nom').textContent = e?.nom ?? 'Aucun perso';
    q('.niv').textContent = e?.niveau ? `${e.classe ?? ''} niv. ${e.niveau}` : '';
    q('.l2').textContent = e ? [e.lieu, e.kamas != null ? `${e.kamas.toLocaleString('fr-FR')} kamas` : '', e.potions != null ? `${e.potions} potions` : ''].filter(Boolean).join(' · ') : '';
    const pv = direct ? direct.pv / Math.max(1, direct.pvMax) : 0;
    (q('.pv div')).style.width = `${Math.round(pv * 100)}%`;
    q('.pv').style.visibility = direct ? 'visible' : 'hidden';
    q('.src').textContent = direct ? `En direct · PV ${Math.round(direct.pv)} / ${direct.pvMax}${dernierPing ? ` · coucou en ${dernierPing}` : ''}`
      : secours ? `D'après ${secours === deServeur ? 'le serveur' : 'la sauvegarde'} (${new Date(secours.maj).toLocaleTimeString('fr-FR')}), lecture seule` : '';
    const relie = t - Math.max(vu.direct, vu.stockage) < 3000 && Math.max(vu.direct, vu.stockage) > 0;
    r.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach(b => { if (b.dataset.a !== 'rapport') b.disabled = !relie; });
    q('.aide').hidden = relie || t - debut < 4000;
  };
  setInterval(dessiner, 250); dessiner();

  const copierRapport = async () => {
    const t = performance.now();
    const txt = [
      'Diablofus, écran du bas',
      `Écran : ${innerWidth}×${innerHeight} px CSS, densité ${devicePixelRatio}`,
      `Appli installée : ${matchMedia('(display-mode: standalone)').matches ? 'oui' : 'non (onglet Chrome)'}`,
      ...Object.keys(NOMS).map(k => `${NOMS[k]} : ${vu[k] ? `${t - vu[k] < 5000 ? 'OK' : 'plus de nouvelles'} (${age(vu[k])})` : 'jamais'}${detail[k] ? `, ${detail[k]}` : ''}`),
      `Coucou aller-retour : ${dernierPing || 'pas essayé'}`,
      navigator.userAgent,
    ].join('\n');
    try { await navigator.clipboard.writeText(txt); noter('Rapport copié : colle-le dans le fil'); } catch { noter('Copie impossible : rapport ci-dessous'); q('.journal').textContent = txt; }
  };
}
