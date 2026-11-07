import { RUNES } from '../sim/forgemagie';
import { GAME_DATA, ITEMS } from '../sim/data';
import type { EtatJoueur } from '../sim/sauvegarde';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../sim/items';
import { REGLAGES_TEST, RARETES_TEST, type CommandeTest, type RangTest, type ReglagesTest } from '../sim/outilsTest';
import type { World } from '../sim/world';
import { iconHtml } from './icons';
import { LOOKS } from './looks';
import { anomaliesButin, lieuxDe, niveauHorsPartie, rangDe, tableButin, tirerButin, type Rang } from '../sim/butin';
import { Rng } from '../sim/math';
import { groupesBestiaire, nomObjet, pct, unSur } from './butinVue';
import { EditeurPlacement } from './placementVue';

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
export const ETATS_PRETS: { nom: string; classe: string; niveau: number; zone: string; tenue: Rarity; carte?: [string, string] }[] = [
  { nom: 'Iop 12 · Incarnam · tenue Commune', classe: 'iop', niveau: 12, zone: 'incarnam', tenue: 'commun' },
  { nom: 'Crâ 20 · Crypte de Kardorim · tenue Épique', classe: 'cra', niveau: 20, zone: 'incarnam', tenue: 'epique', carte: ['arene_crypte', 'Crypte de Kardorim'] },
  { nom: 'Crâ 35 · Astrub · tenue Rare', classe: 'cra', niveau: 35, zone: 'astrub', tenue: 'rare' },
  { nom: 'Iop 30 · Cour du Bouftou Royal · tenue Légendaire', classe: 'iop', niveau: 30, zone: 'astrub', tenue: 'legendaire', carte: ['arene_cour', 'Cour du Bouftou Royal'] },
];

/** Ce que le panneau demande à la scène (qui seule relance la partie ou parle à la simulation). */
export interface ActionsTest {
  envoyer(c: CommandeTest): void;
  /** 4B : même perso, autre classe. */
  classe(id: string): void;
  /** Autre zone : la partie repart là-bas (puis va sur cette carte). */
  zone(id: string, carte?: [string, string]): void;
  pret(i: number): void;
  /** Le prochain clic en jeu pose ces monstres (7A, 7D). */
  poser(p: { type: string; n: number; rang: RangTest; mannequin: boolean } | null): void;
  nouveau(): void;
  /** Forgemagie (maquette « Forgemagie » 10C) : ouvre la fenêtre du forgemage, où qu'on soit. */
  forge(): void;
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
type Onglet = 'perso' | 'aller' | 'objets' | 'monstres' | 'butin' | 'placement' | 'aides';
const ONGLETS: [Onglet, string][] = [['perso', 'Perso'], ['aller', 'Aller à'], ['objets', 'Objets'], ['monstres', 'Monstres'], ['butin', 'Butin'], ['placement', 'Placement'], ['aides', 'Aides']];

const CSS = `
#ptest-badge{position:fixed;bottom:118px;left:50%;transform:translateX(-50%);z-index:12;pointer-events:none;background:#f0a83a;color:#1b1206;font:13px Rowdies,Lexend,sans-serif;letter-spacing:.12em;padding:5px 12px;border-radius:3px;box-shadow:0 2px 8px #000a}
#ptest-badge small{font:500 11px Lexend,sans-serif;letter-spacing:0;margin-left:8px;opacity:.75}
#ptest{position:fixed;top:56px;right:12px;bottom:150px;width:min(360px,calc(100vw - 24px));z-index:11;display:grid;grid-template-rows:42px auto 1fr;grid-template-columns:minmax(0,1fr);box-sizing:border-box;
 background:#24221dee url(assets/ui/d3/block_background_second.jpg) center/cover;border:1px solid #0b0a07;border-radius:4px;box-shadow:0 12px 40px #000c;
 font:13px Lexend,Verdana,sans-serif;color:#e8e2d4}
#ptest[hidden]{display:none}
#ptest .tt{display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:linear-gradient(#4d4535,#332e23 70%,#2a261d);border-bottom:1px solid #0b0a07;border-radius:4px 4px 0 0}
#ptest .tt b{font:17px Rowdies,Lexend,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
#ptest .tt span{font-size:11px;color:#c9c4ab}
#ptest .ong{display:flex;border-bottom:1px solid #0b0a07;background:#0003}
#ptest .ong button{all:unset;flex:1;text-align:center;padding:8px 2px;cursor:pointer;color:#c9c4ab;font-size:12px;border-bottom:2px solid transparent}
#ptest .ong button.on{color:#b9e54b;border-bottom-color:#b9e54b}
#ptest .ong button:focus-visible{outline:1px solid #b9e54b}
#ptest .corps{overflow:auto;padding:10px 12px 14px;display:grid;grid-template-columns:minmax(0,1fr);gap:9px;align-content:start;min-width:0}
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
#ptest .liste{display:grid;gap:3px}
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
#ptest .pose{background:#3a2a10;border:1px solid #f0a83a;border-radius:3px;padding:6px 8px;color:#ffd9a0;font-size:12px}
`;

/** Panneau de la partie de test (3A) : touche F1, sur le côté droit, aux couleurs des fenêtres de Dofus 3. */
export class PanneauTest {
  private el: HTMLDivElement;
  private badge: HTMLDivElement;
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
  pose: { type: string; n: number; rang: RangTest; mannequin: boolean } | null = null;
  /** Coups donnés aux monstres (DPS, 7D) : temps de la partie et dégâts. */
  private coups: { t: number; n: number }[] = [];
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
    document.getElementById('ptest')?.remove(); document.getElementById('ptest-badge')?.remove();
    this.badge = document.createElement('div'); this.badge.id = 'ptest-badge';
    this.badge.innerHTML = 'PARTIE DE TEST<small>F1 : outils</small>';
    this.el = document.createElement('div'); this.el.id = 'ptest'; this.el.hidden = true;
    // Phaser écoute aussi mousedown sur toute la page : sans ça, un clic dans le panneau ouvrait le menu du HUD caché dessous
    for (const t of ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'contextmenu'] as const) this.el.addEventListener(t, e => e.stopPropagation());
    // on tape dans le panneau : les touches ne vont pas au jeu (S ouvrirait les sorts...)
    this.el.addEventListener('keydown', e => { if (e.key !== 'F1') e.stopPropagation(); });
    this.el.addEventListener('keyup', e => e.stopPropagation());
    document.body.append(this.badge, this.el);
    this.niveau = world.player.level;
    this.editeur = new EditeurPlacement(world, c => actions.envoyer(c), () => { if (this.ouvert && this.onglet === 'placement') this.dessiner(); });
  }
  get ongletPlacement() { return this.onglet === 'placement'; }
  /** Édition du placement en cours : un clic en jeu pose ou retire un point au lieu de faire marcher. */
  get editionPlacement() { return this.ouvert && this.onglet === 'placement' && this.editeur.pose && !!this.world.zone.open; }
  get ouvert() { return !this.el.hidden; }
  basculer() { this.el.hidden = !this.el.hidden; if (!this.el.hidden) { this.niveau = this.world.player.level; this.dessiner(); } }
  private lignesDev: LigneDev[] | null = null;
  destroy() { this.el.remove(); this.badge.remove(); this.editeur.destroy(); }

  /** Un coup donné à un monstre (événement « hit » de la simulation). */
  noterCoup(n: number) { this.coups.push({ t: this.world.time, n }); this.dernierCoup = n; }
  /** Quatre fois par seconde : compteur de DPS. */
  maj(now: number, force = false) {
    const t0 = this.world.time - 10;
    while (this.coups.length && this.coups[0].t < t0) this.coups.shift();
    // Placement : la fiche suit la carte où l'on marche
    if (this.ouvert && this.onglet === 'placement') { const c = this.editeur.carte(); if (c !== this.carteVue) { this.carteVue = c; this.dessiner(); } }
    if (!this.ouvert || this.onglet !== 'monstres' || (!force && now - this.majT < 250)) return;
    this.majT = now;
    const total = this.coups.reduce((a, c) => a + c.n, 0), d = this.coups.length ? Math.max(1, this.world.time - this.coups[0].t) : 1;
    const box = this.el.querySelector('.dps');
    if (box) box.innerHTML = `<div><b>${Math.round(total / d)}</b><span>DPS</span></div><div><b>${total}</b><span>dégâts sur 10 s</span></div><div><b>${this.dernierCoup}</b><span>dernier coup</span></div>`;
  }
  /** Le clic qui posait les monstres a été fait. */
  posee() { this.pose = null; this.actions.poser(null); if (this.ouvert) this.dessiner(); }

  private dessiner() {
    const p = this.world.player;
    this.el.classList.toggle('large', this.onglet === 'butin'); this.lignesDev = null;
    this.el.innerHTML = `<div class="tt"><b>Outils de test</b><span>F1 pour fermer</span></div>
      <div class="ong" role="tablist">${ONGLETS.map(([k, n]) => `<button type="button" role="tab" data-o="${k}" class="${this.onglet === k ? 'on' : ''}" aria-selected="${this.onglet === k}">${n}</button>`).join('')}</div>
      <div class="corps">${this[this.onglet]()}</div>`;
    this.el.querySelectorAll<HTMLElement>('[data-o]').forEach(b => b.onclick = () => { this.onglet = b.dataset.o as Onglet; this.dessiner(); });
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
    tous('[data-nb]', b => { this.nombre = +b.dataset.nb!; this.dessiner(); });
    tous('[data-rang]', b => { this.rang = b.dataset.rang as RangTest; this.dessiner(); });
    tous('[data-poser]', b => { this.pose = { type: this.monstre, n: b.dataset.poser === 'm' ? 1 : this.nombre, rang: b.dataset.poser === 'm' ? 'normal' : this.rang, mannequin: b.dataset.poser === 'm' }; this.actions.poser(this.pose); this.dessiner(); });
    tous('[data-annuler]', () => this.posee());
    tous('[data-retirer]', () => this.actions.envoyer({ k: 'retirer' }));
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
    this.el.querySelectorAll<HTMLInputElement>('[data-reg]').forEach(i => i.onchange = () => this.actions.envoyer({ k: 'reglage', cle: i.dataset.reg as keyof ReglagesTest, on: i.checked }));
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
    this.el.querySelectorAll<HTMLElement>('[data-mon]').forEach(b => b.onclick = () => { this.monstre = b.dataset.mon!; this.dessiner(); });
  }
  private inter(cle: keyof ReglagesTest, nom: string, aide: string) {
    const on = !!this.world.test?.[cle];
    return `<label class="inter"><span>${nom}<br><span class="note">${aide}</span></span><input type="checkbox" data-reg="${cle}" ${on ? 'checked' : ''}></label>`;
  }

  private perso() {
    const p = this.world.player;
    return `<div class="l"><span>Classe</span><span style="display:flex;gap:4px">${Object.entries(GAME_DATA.classes).map(([k, c]) =>
      `<button type="button" class="b g ${p.cls === c ? 'on' : ''}" data-classe="${k}">${esc(c.name)}</button>`).join('')}</span></div>
      <p class="note">Changer de classe garde le niveau, le sac, l'équipement et la position ; les sorts sont ceux de la nouvelle classe.</p>
      <div class="l"><span>Niveau</span><input type="number" id="pt-nivn" min="1" max="200" value="${this.niveau}"></div>
      <div class="l"><input type="range" id="pt-niv" min="1" max="200" value="${this.niveau}"></div>
      <label class="inter"><span>Points répartis tout seuls<br><span class="note">Tous dans la caractéristique de l'élément principal ; à replacer dans C si besoin.</span></span><input type="checkbox" id="pt-auto" ${this.auto ? 'checked' : ''}></label>
      <button type="button" class="b" data-niv>Passer au niveau ${this.niveau}</button>
      <h4>États tout prêts</h4>
      <div class="liste">${ETATS_PRETS.map((e, i) => `<button type="button" data-pret="${i}"><span class="n">${esc(e.nom)}</span><span class="d">▶</span></button>`).join('')}</div>
      <p class="note">Un état tout prêt remplace le perso de test (sac, niveau, quêtes).</p>
      <button type="button" class="b g" data-nouveau>Nouveau perso de test (niveau 1)</button>`;
  }

  private aller() {
    const w = this.world, wg = w.worldGrid, open = w.zone.open;
    let ici = '';
    if (wg && open) {
      const bouton = (tag: string, nom: string, d: string) => `<button type="button" data-carte="${tag}" data-nom="${esc(nom)}"><span class="n">${esc(nom)}</span><span class="d">${d}</span></button>`;
      const zaaps = open.checkpoints.map(c => { const m = wg.mapByCoords(c.map[0], c.map[1]); return m ? bouton(m.tag, c.name, `Zaap [${c.map.join(',')}]`) : ''; }).join('');
      const donjons = (open.donjons ?? []).map(d => { const t = d.arene?.tag ?? Object.keys(d.salles)[0]; return t && wg.mapByTag(t) ? bouton(t, d.nom, 'donjon') : ''; }).join('');
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
    return `${ici}<h4>Autres zones</h4><div class="liste">${autres}</div>
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
      <h4>Monnaies et consommables</h4>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b g" data-kamas="100000">+100 000 kamas</button>
        <button type="button" class="b g" data-res="${pepite}:500">+500 Pépites</button>
        <button type="button" class="b g" data-res="${cles}:3">Clés de donjon ×3</button>
        <button type="button" class="b g" data-res="${rappel}:10">Potions de Rappel ×10</button>
      </div>
      <h4>Forgemagie</h4>
      <div class="l" style="flex-wrap:wrap;justify-content:flex-start">
        <button type="button" class="b" data-forge>Ouvrir la forgemagie</button>
        <button type="button" class="b g" data-res="${petites}:30">Petites runes ×30</button>
        <button type="button" class="b g" data-res="${grosses}:5">Runes Pa et Ra ×5</button>
      </div>
      <span class="note">Le forgemage s'ouvre ici avant d'avoir sa place au Bastion des Douze : pose des runes, brise des objets, règle les chances en jouant.</span>`;
  }

  private static monstres() {
    return Object.entries(GAME_DATA.monsters).filter(([, d]) => LOOKS[d.look]);
  }
  private listeMonstres() {
    const r = sansAccent(this.rechercheMonstre.trim());
    const l = PanneauTest.monstres().filter(([, d]) => !r || sansAccent(d.name).includes(r))
      .sort((a, b) => (a[1].level ?? 0) - (b[1].level ?? 0)).slice(0, 60);
    if (!l.length) return '<p class="note">Aucun monstre de ce nom.</p>';
    return l.map(([k, d]) => `<button type="button" data-mon="${k}" class="${this.monstre === k ? 'on' : ''}"><span class="n">${esc(d.name)}</span><span class="d">${d.boss ? 'boss · ' : d.elite ? 'élite · ' : ''}niv. ${d.level ?? '?'}</span></button>`).join('');
  }
  private monstres() {
    const d = GAME_DATA.monsters[this.monstre], nom = d ? esc(d.name) : '?';
    const pose = this.pose ? `<div class="pose">Clique au sol pour poser ${this.pose.mannequin ? 'le mannequin' : `${this.pose.n} × ${nom}`}. <button type="button" class="b g" data-annuler>Annuler</button></div>` : '';
    return `${pose}<input type="text" id="pt-mon" placeholder="bouftou, kardorim, chafer..." value="${esc(this.rechercheMonstre)}" autocomplete="off">
      <div class="liste" id="pt-monl" style="max-height:220px;overflow:auto">${this.listeMonstres()}</div>
      <div class="l"><span>Nombre</span><span style="display:flex;gap:4px">${[1, 3, 6, 10].map(n => `<button type="button" class="b g ${this.nombre === n ? 'on' : ''}" data-nb="${n}">${n}</button>`).join('')}</span></div>
      <div class="l"><span>Rang</span><span style="display:flex;gap:4px">${([['normal', 'Normal'], ['elite', 'Élite'], ['boss', 'Boss']] as const).map(([k, n]) => `<button type="button" class="b g ${this.rang === k ? 'on' : ''}" data-rang="${k}">${n}</button>`).join('')}</span></div>
      <p class="note">Élite : PV et XP ×3, attaques annoncées au sol. Boss : PV et XP ×10.</p>
      <button type="button" class="b" data-poser="n">Poser ${this.nombre} × ${nom}</button>
      <h4>Entraînement</h4>
      <button type="button" class="b g" data-poser="m">Poser un mannequin (${nom}, increvable et immobile)</button>
      <div class="dps"></div>
      <p class="note">Le compteur prend tous les coups donnés aux monstres sur les 10 dernières secondes.</p>
      <button type="button" class="b g" data-retirer>Retirer les monstres posés</button>`;
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
      <div class="btab" id="pt-butt">${this.tableDev()}</div>
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
  private aides() {
    return `${this.inter('invincible', 'Invincible', 'Les coups s\'affichent, les PV ne baissent pas.')}
      ${this.inter('recharges', 'Recharges à zéro', 'Sorts relançables tout de suite, PA et PM toujours pleins.')}
      <p class="note">Rien de la partie de test ne compte pour ton compte : pas de succès, pas de bestiaire, pas de carnet. Le perso de test est gardé à part de tes 3 persos.</p>`;
  }
}
