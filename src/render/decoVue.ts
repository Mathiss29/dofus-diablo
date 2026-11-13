import Phaser from 'phaser';
import { v as url } from './assetUrl';
import { textureUneFois } from './uneFois';
import { SOL } from './worldView';
import { DECO, MEUBLES, SPECIAUX, casesDe, cleSac, type MeubleDef, type Pose } from '../sim/meubles';
import { themesPossedes } from '../sim/havresac';
import { PORTABLE } from '../sim/dofus';
import { ITEMS, RECOLTES, THEMES_HAVRESAC } from '../sim/data';
import { iconHtml } from './icons';
import type { World } from '../sim/world';

/** Havre-Sac complet (0.6, 10A-D) : les meubles posés dessinés dans la pièce (MeublesVue, lecture seule) et le mode déco
 *  (DecoPanneau : catalogue, aperçu sur la grille, choix de la vitrine et du potager). Les actions passent par world.deco. */
const S = 1.1;   // pixels Dofus -> écran du jeu (GridMap.S)
const cleMeuble = (g: number) => `meuble_${g}`;
const urlMeuble = (g: number) => url(`assets/sprites/meubles/${g}.webp`);
const cleIcone = (i: number) => `objet_${i}`;
/** Icône de ce qui est exposé sur un socle (d:Dofus, t:trophée, f:familier). */
export function iconeExpose(quoi: string): number {
  const [s, id] = quoi.split(':');
  return s === 'f' ? ITEMS.equipment[id]?.icon ?? 0 : PORTABLE(id)?.icon ?? 0;
}

export class MeublesVue {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private flottants: { im: Phaser.GameObjects.Image; y: number; ph: number }[] = [];
  private sig = '';
  private sigT = 0;
  private manque = false;
  private fantome: Phaser.GameObjects.Image | null = null;
  private cases: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene, private world: World) {
    this.cases = scene.add.graphics().setDepth(SOL + 30);
  }
  destroy() { for (const o of this.objs) o.destroy(); this.objs = []; this.fantome?.destroy(); this.cases.destroy(); }

  private texture(g: number) { const k = cleMeuble(g); return textureUneFois(this.scene, k, l => l.image(k, urlMeuble(g))); }
  private icone(i: number) { const k = cleIcone(i); return textureUneFois(this.scene, k, l => l.image(k, `assets/ui/objets/${i}.webp`)); }

  /** Point écran du milieu d'une case locale, et profondeur du bas de cette case. */
  private ecran(c: number) {
    const d = this.world.deco!, wg = this.world.worldGrid!, g = wg.cellOf(d.tag, c), m = wg.cellCenter(g), h = wg.data.grid.h;
    return { m, s: wg.toScreen(m.x, m.y), prof: wg.toScreen(m.x, m.y + h / 2).y };
  }
  /** Image d'un meuble posé sur la case c (le milieu de l'image décalé de son origine officielle). */
  private image(m: MeubleDef, c: number, tourne: boolean, levee = 0): Phaser.GameObjects.Image | null {
    if (!this.texture(m.gfx)) { this.manque = true; return null; }
    const wg = this.world.worldGrid!, e = this.ecran(c), ox = tourne ? -m.ox : m.ox;
    const p = wg.toScreen(e.m.x + ox, e.m.y - m.oy - levee);
    const im = this.scene.add.image(p.x, p.y, cleMeuble(m.gfx)).setScale(S).setFlipX(tourne);
    im.setDepth(m.couche === 0 ? SOL + 20 + c * 1e-4 : e.prof + (m.couche === 2 ? 0.5 : 0) + c * 1e-4);
    return im;
  }

  /** Signature de ce qui est posé (refaire le dessin seulement quand ça change). */
  private signature() {
    const d = this.world.deco;
    if (!d) return '';
    const s = d.sac, aj = this.world.opts.aujourdhui ?? '';
    return JSON.stringify([s.theme, s.poses, s.vitrine, Object.entries(s.potager).map(([k, v]) => [k, v.r, v.j < aj])]);
  }
  update(dt: number) {
    const w = this.world, d = w.deco;
    if (!d) return;
    if ((this.sigT -= dt) <= 0 || this.manque) {
      this.sigT = 0.3;
      const sig = this.signature();
      if (sig !== this.sig || this.manque) { this.sig = sig; this.refaire(); }
    }
    for (const f of this.flottants) f.im.y = f.y + Math.sin(w.time * 2 + f.ph) * 4;
  }
  private refaire() {
    for (const o of this.objs) o.destroy();
    this.objs = []; this.flottants = []; this.manque = false;
    const d = this.world.deco!, s = d.sac, poses = s.poses;
    // un bibelot posé sur un meuble empilable est levé de la hauteur de pose de ce meuble
    const sous = (p: Pose) => poses.find(q => q !== p && MEUBLES[q.m]?.empilable && casesDe(MEUBLES[q.m], q.c, !!q.r).includes(p.c));
    for (const p of poses) {
      const m = MEUBLES[p.m]; if (!m) continue;
      const support = m.couche === 2 ? sous(p) : undefined;
      let gfx = m;
      if (m.sorte === 'potager') {   // 10C : une parcelle prête montre ses carottes mûres
        const v = d.parcelle(p.c);
        gfx = { ...m, gfx: v?.pret ? 7655 : v ? 7652 : 7650 };
      }
      const im = this.image(gfx, p.c, !!p.r, support ? MEUBLES[support.m].pose : 0);
      if (!im) continue;
      this.objs.push(im);
      if (m.sorte === 'vitrine') {   // 10B : l'objet exposé flotte au-dessus du socle
        const q = s.vitrine[cleSac(s.theme, p.c)], ic = q ? iconeExpose(q) : 0;
        if (ic && this.icone(ic)) {
          const y = im.y - im.displayHeight / 2 - 26;
          const ico = this.scene.add.image(im.x, y, cleIcone(ic)).setDisplaySize(46, 46).setDepth(im.depth + 0.1);
          const halo = this.scene.add.image(im.x, y, cleIcone(ic)).setDisplaySize(58, 58).setDepth(im.depth + 0.05).setTintFill(0xffe39a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
          this.objs.push(halo, ico); this.flottants.push({ im: ico, y, ph: p.c }, { im: halo, y, ph: p.c });
        } else if (ic) this.manque = true;
      }
      if (m.sorte === 'potager') {
        const v = d.parcelle(p.c), r = v && RECOLTES.ressources[v.r];
        if (r) { const t = this.scene.add.text(im.x, im.y - im.displayHeight / 2 - 6, v.pret ? `${r.nom} · prêt !` : r.nom, { fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: v.pret ? '#b9e54b' : '#e8e0c8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(1e6 - 4); this.objs.push(t); }
      }
      if (m.sorte === 'mannequin') {
        const i = p.p ?? -1, pr = i >= 0 ? this.world.player.prereglages[i] : null;
        const t = this.scene.add.text(im.x, im.y - im.displayHeight / 2 - 4, pr ? pr.nom : `Préréglage ${i + 1} (vide)`, { fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: pr ? '#ffd34a' : '#9a937f', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(1e6 - 4);
        this.objs.push(t);
      }
    }
  }

  /** Mode déco : aperçu du meuble choisi sur la case visée (vert : possible, rouge : refusé), cases du meuble survolé. */
  apercu(id: number | null, c: number, tourne: boolean): string | null {
    const d = this.world.deco!;
    this.fantome?.destroy(); this.fantome = null; this.cases.clear();
    if (c < 0) return null;
    const m = id != null ? MEUBLES[id] : null, non = m ? d.refus(m.id, c, tourne) : null;
    const cs = m ? casesDe(m, c, tourne) : (() => { const p = d.pose(c); return p ? casesDe(MEUBLES[p.m], p.c, !!p.r) : [c]; })();
    const wg = this.world.worldGrid!, gw = wg.data.grid.w, gh = wg.data.grid.h, coul = m ? (non ? 0xff5a4a : 0x8fe36b) : d.pose(c) ? 0xffd34a : 0xffffff;
    for (const x of cs) {
      const e = this.ecran(x);
      const pts = [wg.toScreen(e.m.x, e.m.y - gh / 2), wg.toScreen(e.m.x + gw / 2, e.m.y), wg.toScreen(e.m.x, e.m.y + gh / 2), wg.toScreen(e.m.x - gw / 2, e.m.y)];
      this.cases.fillStyle(coul, 0.25).fillPoints(pts.map(p => new Phaser.Math.Vector2(p.x, p.y)), true).lineStyle(2, coul, 0.8).strokePoints(pts.map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
    }
    if (m) {
      const im = this.image(m, c, tourne);
      if (im) { im.setAlpha(0.75).setTint(non ? 0xff8a80 : 0xd8ffc8).setDepth(1e6 - 10); this.fantome = im; }
    }
    return non;
  }
  finApercu() { this.fantome?.destroy(); this.fantome = null; this.cases.clear(); }
}

const CSS = `.dc-bt{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:7;background:#1b1712ee;border:1px solid #8a7444;border-radius:16px;
 padding:5px 14px;font:600 13px Lexend,Verdana,sans-serif;color:#f4e3b0;cursor:pointer;box-shadow:0 2px 8px #000a}.dc-bt:hover{background:#2b2418}
.dc{position:fixed;right:58px;top:186px;bottom:150px;width:340px;z-index:9;display:flex;flex-direction:column;background:#141210f2;border:1px solid #4a4436;
 border-radius:6px;font:13px/1.35 Lexend,Verdana,sans-serif;color:#f4efe0;box-shadow:0 4px 14px #000c}
.dc h3{margin:0;padding:9px 12px;font:15px Rowdies,Lexend,sans-serif;color:#ffd34a;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2e2a22}
.dc h3 small{font:12px Lexend,sans-serif;color:#b9b1a0}.dc .x{cursor:pointer;color:#c9c0aa;padding:0 4px}
.dc .bar{display:flex;gap:6px;padding:8px 10px;flex-wrap:wrap}.dc select{flex:1;background:#221e18;color:#f4efe0;border:1px solid #4a4436;border-radius:4px;padding:3px}
.dc .ch{padding:2px 9px;border:1px solid #4a4436;border-radius:10px;cursor:pointer;color:#cfc6b0;font-size:12px}.dc .ch.on{background:#3a3020;border-color:#c9a24a;color:#ffe08a}
.dc .gr{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:6px 10px;align-content:start}
.dc .gr div{aspect-ratio:1;background:#1f1b15;border:1px solid #2e2a22;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}
.dc .gr div:hover{border-color:#8a7444}.dc .gr div.on{border-color:#ffd34a;background:#2e2616}.dc .gr img{max-width:88%;max-height:88%}
.dc .gr div i{position:absolute;right:2px;bottom:1px;font-style:normal;font-size:9px;color:#c28bff}.dc .gr div i.f{color:#7cc7ff}
.dc .pied{padding:8px 10px;border-top:1px solid #2e2a22;font-size:12px;color:#b9b1a0}.dc .pied b{color:#f4efe0}
.dc .pied .tr{margin-top:6px;display:flex;gap:6px}.dc button{background:#2b2418;border:1px solid #6a5a3a;color:#f4e3b0;border-radius:4px;padding:3px 10px;cursor:pointer;font:12px Lexend,sans-serif}
.dc-ch{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;width:420px;max-height:70vh;display:flex;flex-direction:column;background:#141210f6;
 border:1px solid #6a5a3a;border-radius:6px;font:13px Lexend,Verdana,sans-serif;color:#f4efe0;box-shadow:0 6px 20px #000d}
.dc-ch h3{margin:0;padding:9px 12px;font:15px Rowdies,Lexend,sans-serif;color:#ffd34a;border-bottom:1px solid #2e2a22;display:flex;justify-content:space-between}
.dc-ch .l{overflow-y:auto;padding:8px 10px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.dc-ch .l div{display:flex;align-items:center;gap:8px;padding:5px 7px;background:#1f1b15;border:1px solid #2e2a22;border-radius:4px;cursor:pointer}
.dc-ch .l div:hover{border-color:#ffd34a}.dc-ch .l .ic{width:32px;height:32px;flex:none}.dc-ch p{margin:6px 12px 10px;color:#b9b1a0;font-size:12px}`;

type Filtre = 'tout' | 1 | 2 | 0;
/** Mode déco (10A) et fenêtres de la vitrine (10B) et du potager (10C). */
export class DecoPanneau {
  actif = false;
  choisi: number | null = null;
  tourne = false;
  private onglet = 'speciaux';
  private filtre: Filtre = 'tout';
  private bt: HTMLDivElement;
  private el: HTMLDivElement | null = null;
  private ch: HTMLDivElement | null = null;
  private tout = 0;
  constructor(private world: World, private toast: (t: string) => void, private fin: () => void) {
    if (!document.getElementById('dc-css')) { const st = document.createElement('style'); st.id = 'dc-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.bt = document.createElement('div'); this.bt.className = 'dc-bt'; this.bt.textContent = 'Décorer le Havre-Sac (N)';
    this.bt.addEventListener('click', () => this.basculer());
    this.bt.style.display = world.deco?.decorable ? '' : 'none';
    document.body.appendChild(this.bt);
    const T = world.opts.themesHavreSac, t = world.deco?.theme;
    if (T && t != null && themesPossedes(T, world.coffre).includes(t)) this.onglet = String(t);
    document.addEventListener('keydown', this.touche, true);
  }
  destroy() { this.bt.remove(); this.el?.remove(); this.ch?.remove(); document.removeEventListener('keydown', this.touche, true); }
  get ouvertChoix() { return !!this.ch; }
  /** Le curseur est sur le panneau (le clic ne va pas en jeu). */
  dessus(x: number, y: number) { const r = this.el?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }

  private touche = (e: KeyboardEvent) => {
    if (!this.actif || e.target instanceof HTMLInputElement) return;
    if (e.code === 'KeyR') { this.tourne = !this.tourne; e.stopPropagation(); }
    else if (e.code === 'Escape') { if (this.choisi != null) this.choisi = null; else this.basculer(); this.dessiner(); e.stopPropagation(); e.preventDefault(); }
  };
  basculer() {
    const d = this.world.deco;
    if (!d?.decorable) { this.toast('Seul le maître du Havre-Sac le décore'); return; }
    this.actif = !this.actif; this.choisi = null; this.tourne = false;
    if (this.actif) this.dessiner(); else { this.el?.remove(); this.el = null; this.fin(); }
    this.bt.textContent = this.actif ? 'Finir la déco (N)' : 'Décorer le Havre-Sac (N)';
  }
  /** Clic en jeu pendant la déco : poser le meuble choisi, ou ranger celui qu'on vise ; clic droit : tourner. */
  clic(c: number, droit: boolean) {
    const d = this.world.deco!;
    if (droit) { if (this.choisi != null) this.tourne = !this.tourne; else if (c >= 0) d.ranger(c); return; }
    if (c < 0) return;
    if (this.choisi != null) { d.poser(this.choisi, c, this.tourne); this.dessiner(); }
    else if (d.ranger(c)) this.dessiner();
  }

  private liste(): MeubleDef[] {
    const d = this.world.deco!, a = d.possedes();
    let l: MeubleDef[];
    if (this.onglet === 'speciaux') l = Object.values(SPECIAUX).map(s => MEUBLES[s.id]);
    else if (this.onglet === 'gagnes') l = [...(this.world.coffre.meubles ?? [])].map(id => MEUBLES[id]).filter(Boolean);
    else l = Object.values(MEUBLES).filter(m => m.id > 0 && m.theme === Number(this.onglet) && a.has(m.id));
    return l.filter(m => this.filtre === 'tout' || m.couche === this.filtre);
  }
  dessiner() {
    if (!this.actif) return;
    const w = this.world, d = w.deco!, T = THEMES_HAVRESAC, poss = themesPossedes(T, w.coffre), nom = (id: number) => T.themes.find(t => t.id === id)?.nom ?? `Thème ${id}`;
    const n = d.sac.poses.length, rares = Object.values(MEUBLES).filter(m => m.tier === 'rare'), fab = Object.values(MEUBLES).filter(m => m.tier === 'fabrique');
    const g = new Set(w.coffre.meubles ?? []);
    const el = this.el ?? document.createElement('div');
    if (!this.el) { el.className = 'dc'; document.body.appendChild(el); this.el = el; }
    const l = this.liste();
    el.innerHTML = `<h3>Décorer <small>${n} / ${DECO.max} meubles</small><span class="x" data-x>✕</span></h3>
      <div class="bar"><select data-o>
        <option value="speciaux"${this.onglet === 'speciaux' ? ' selected' : ''}>Vitrine, potager, mannequins</option>
        <option value="gagnes"${this.onglet === 'gagnes' ? ' selected' : ''}>Meubles gagnés (${g.size})</option>
        ${poss.filter(id => Object.values(MEUBLES).some(m => m.theme === id)).map(id => `<option value="${id}"${this.onglet === String(id) ? ' selected' : ''}>Thème ${nom(id)}</option>`).join('')}
      </select></div>
      <div class="bar">${([['tout', 'Tout'], [1, 'Meubles'], [2, 'Bibelots'], [0, 'Tapis']] as [Filtre, string][]).map(([f, t]) => `<span class="ch${this.filtre === f ? ' on' : ''}" data-f="${f}">${t}</span>`).join('')}</div>
      <div class="gr">${l.map(m => `<div class="${this.choisi === m.id ? 'on' : ''}" data-m="${m.id}" title="${m.sorte ? SPECIAUX[m.sorte].nom : `${m.couche === 0 ? 'Tapis' : m.couche === 2 ? 'Bibelot' : 'Meuble'} · ${nom(m.theme)}${m.tier !== 'base' ? (m.tier === 'rare' ? ' · rare' : ' · fabriqué') : ''}`}"><img src="${urlMeuble(m.gfx)}" loading="lazy" alt="">${m.tier === 'rare' ? '<i>rare</i>' : m.tier === 'fabrique' ? '<i class="f">fab.</i>' : ''}</div>`).join('') || '<p style="grid-column:1/-1;color:#9a937f">Rien ici pour l\'instant.</p>'}</div>
      <div class="pied">Clic : poser · <b>R</b> ou clic droit : tourner · sans meuble choisi, un clic range celui qu'on vise · Échap : finir.<br>
        Chaque thème possédé donne ses meubles de base. Rares trouvés : <b>${rares.filter(m => g.has(m.id)).length} / ${rares.length}</b> (coffres de donjon, succès, lots de la Boutique d'Ogrines) · fabriqués : <b>${fab.filter(m => g.has(m.id)).length} / ${fab.length}</b> (Bricoleur, Sculpteur).
        <div class="tr"><button data-t>${this.tout ? 'Sûr ? Tout ranger' : 'Tout ranger'}</button></div></div>`;
    el.querySelector('[data-x]')!.addEventListener('click', () => this.basculer());
    el.querySelector<HTMLSelectElement>('[data-o]')!.addEventListener('change', e => { this.onglet = (e.target as HTMLSelectElement).value; this.choisi = null; this.dessiner(); });
    el.querySelectorAll<HTMLElement>('[data-f]').forEach(x => x.addEventListener('click', () => { const f = x.dataset.f!; this.filtre = f === 'tout' ? 'tout' : Number(f) as Filtre; this.dessiner(); }));
    el.querySelectorAll<HTMLElement>('[data-m]').forEach(x => x.addEventListener('click', () => { const id = Number(x.dataset.m); this.choisi = this.choisi === id ? null : id; this.tourne = false; this.dessiner(); }));
    el.querySelector('[data-t]')!.addEventListener('click', () => { if (this.tout) { d.toutRanger(); this.tout = 0; } else this.tout = 1; this.dessiner(); });
  }

  // --- 10B + 10C : fenêtres de choix -----------------------------------------------------------------------------------
  private fermerChoix() { this.ch?.remove(); this.ch = null; }
  choix(sorte: 'vitrine' | 'potager' | 'mannequin', c: number) {
    const w = this.world, d = w.deco;
    if (!d || sorte === 'mannequin') return;
    this.fermerChoix();
    const ch = this.ch = document.createElement('div'); ch.className = 'dc-ch';
    let items: { cle: string; ic: string; nom: string }[], titre: string, note: string;
    if (sorte === 'vitrine') {
      titre = 'Vitrine'; note = d.decorable ? 'Expose un trophée de boss, un Dofus ou un familier de ta Ménagerie. Tes autres persos le verront aussi.' : 'La vitrine de ton hôte.';
      items = d.decorable ? d.exposables().map(q => ({ cle: q, ic: iconHtml(iconeExpose(q)), nom: d.nomExpose(q) })) : [];
      if (d.decorable && w.coffre.vitrine?.[cleSac(d.theme, c)]) items.unshift({ cle: '', ic: '<i class="ic"></i>', nom: 'Vider le socle' });
    } else {
      const v = d.parcelle(c);
      titre = 'Potager'; note = d.decorable ? `${v ? `${RECOLTES.ressources[v.r]?.nom ?? ''} pousse : récolte demain. ` : ''}Sème une plante que tu as déjà récoltée dans le monde : elle se récolte une fois par jour (${DECO.recolte.base} et plus selon ton métier).` : 'Le potager de ton hôte.';
      items = d.decorable ? d.plantables().map(r => ({ cle: r, ic: iconHtml(ITEMS.resources[r]?.icon ?? 0), nom: RECOLTES.ressources[r]?.nom ?? r })) : [];
    }
    ch.innerHTML = `<h3>${titre}<span class="x" data-x style="cursor:pointer">✕</span></h3><p>${note}</p><div class="l">${items.map(i => `<div data-k="${i.cle}">${i.ic}<span>${i.nom}</span></div>`).join('') || '<p style="grid-column:1/-1">Rien à proposer pour l\'instant.</p>'}</div>`;
    document.body.appendChild(ch);
    ch.querySelector('[data-x]')!.addEventListener('click', () => this.fermerChoix());
    ch.querySelectorAll<HTMLElement>('[data-k]').forEach(x => x.addEventListener('click', () => {
      const k = x.dataset.k!;
      if (sorte === 'vitrine') d.exposer(c, k || null); else if (d.planter(c, k)) this.toast(`${RECOLTES.ressources[k]?.nom ?? 'Plante'} semée : récolte demain`);
      this.fermerChoix();
    }));
  }
  majBouton() { this.bt.style.display = this.world.deco?.decorable ? '' : 'none'; }
}
