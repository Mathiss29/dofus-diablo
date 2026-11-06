import { GAME_DATA, ITEMS } from '../sim/data';
import type { EtatJoueur } from '../sim/sauvegarde';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../sim/items';
import { REGLAGES_TEST, RARETES_TEST, type CommandeTest, type RangTest, type ReglagesTest } from '../sim/outilsTest';
import type { World } from '../sim/world';
import { iconHtml } from './icons';
import { LOOKS } from './looks';

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
  { nom: 'Crâ 20 · Crypte de Kardorim · tenue Épique', classe: 'cra', niveau: 20, zone: 'incarnam', tenue: 'epique', carte: ['crypte_1', 'Crypte de Kardorim'] },
  { nom: 'Crâ 35 · Astrub · tenue Rare', classe: 'cra', niveau: 35, zone: 'astrub', tenue: 'rare' },
  { nom: 'Iop 30 · Cour du Bouftou Royal · tenue Légendaire', classe: 'iop', niveau: 30, zone: 'astrub', tenue: 'legendaire', carte: ['cour_1', 'Cour du Bouftou Royal'] },
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
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
type Onglet = 'perso' | 'aller' | 'objets' | 'monstres' | 'aides';
const ONGLETS: [Onglet, string][] = [['perso', 'Perso'], ['aller', 'Aller à'], ['objets', 'Objets'], ['monstres', 'Monstres'], ['aides', 'Aides']];

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
  }
  get ouvert() { return !this.el.hidden; }
  basculer() { this.el.hidden = !this.el.hidden; if (!this.el.hidden) { this.niveau = this.world.player.level; this.dessiner(); } }
  destroy() { this.el.remove(); this.badge.remove(); }

  /** Un coup donné à un monstre (événement « hit » de la simulation). */
  noterCoup(n: number) { this.coups.push({ t: this.world.time, n }); this.dernierCoup = n; }
  /** Quatre fois par seconde : compteur de DPS. */
  maj(now: number, force = false) {
    const t0 = this.world.time - 10;
    while (this.coups.length && this.coups[0].t < t0) this.coups.shift();
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
    // Aides et course / murs
    this.el.querySelectorAll<HTMLInputElement>('[data-reg]').forEach(i => i.onchange = () => this.actions.envoyer({ k: 'reglage', cle: i.dataset.reg as keyof ReglagesTest, on: i.checked }));
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
      const donjons = (open.donjons ?? []).map(d => { const t = Object.keys(d.salles)[0]; return t && wg.mapByTag(t) ? bouton(t, d.nom, 'donjon') : ''; }).join('');
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
      </div>`;
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
  private aides() {
    return `${this.inter('invincible', 'Invincible', 'Les coups s\'affichent, les PV ne baissent pas.')}
      ${this.inter('recharges', 'Recharges à zéro', 'Sorts relançables tout de suite, PA et PM toujours pleins.')}
      <p class="note">Rien de la partie de test ne compte pour ton compte : pas de succès, pas de bestiaire, pas de carnet. Le perso de test est gardé à part de tes 3 persos.</p>`;
  }
}
