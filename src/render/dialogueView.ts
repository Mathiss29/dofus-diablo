import type Phaser from 'phaser';
import { v } from './assetUrl';
import { ICON_CSS, iconHtml } from './icons';
import { ITEMS } from '../sim/data';
import type { Dialogue, RecompenseDef } from '../sim/quests';
import type { World } from '../sim/world';
import { QUEST_ICON, type QuestView } from './questView';

/** Dialogue avec les PNJ, comme Dofus 3 (maquette « Dialogues », tranchée le 2026-11-06 : 1C 2A+2C 3A+3B+3C 4A+4B+4C 5A+5C 6B+6C 7B 8A+8B 9A 10A+10B).
 *  - bulle sombre à contour clair qui pointe vers le PNJ, ruban parchemin officiel (npcdialogskin_all 1) avec son nom, croix ;
 *  - dessous, cadre vert des réponses (clic ou touches 1 à 4, Échap ou la croix pour fermer) ;
 *  - clic droit sur un PNJ : petit menu d'actions ; survol : son nom et ce qu'il propose.
 *  Le texte s'affiche d'un coup. Lit world.quetes.dialogue ; la réponse choisie repart par l'entrée du joueur (input.reponse). */
const CSS = `
.dlgv{position:fixed;inset:0;pointer-events:none;z-index:9;font:600 14px/1.45 Lexend,Verdana,sans-serif;color:#f4efe0}
.dlgv .dlg{position:absolute;width:min(400px,46vw);display:grid;gap:10px;pointer-events:auto}
.dlgv .bul{position:relative;background:#1b1711f2;border:2px solid #f1ecd8;border-radius:16px;padding:30px 20px 16px;box-shadow:0 6px 20px #000a;white-space:pre-line}
.dlgv .bul::after{content:"";position:absolute;top:var(--py,40%);border:10px solid transparent}
.dlgv .dlg.d .bul::after{left:-20px;border-right:12px solid #f1ecd8}
.dlgv .dlg.g .bul::after{right:-20px;border-left:12px solid #f1ecd8}
.dlgv .rub{position:absolute;left:50%;top:-22px;transform:translateX(-50%);min-width:170px;height:46px;padding:0 34px;box-sizing:border-box;
 background:url(${v('assets/ui/quetes/rubanPnj.png')}) center/100% 100% no-repeat;display:grid;place-items:center;
 font:bold 15px Lexend,sans-serif;color:#fff;text-shadow:0 1px 2px #5a3305,0 0 3px #5a3305;white-space:nowrap}
.dlgv .x{position:absolute;right:12px;top:8px;cursor:pointer;font-size:17px;line-height:1;color:#f4efe0}
.dlgv .x:hover{color:#b9e54b}
.dlgv .rep{background:#1b1711f2;border:2px solid #a8d84b;border-radius:14px;padding:10px;display:grid;gap:6px;box-shadow:0 6px 20px #000a}
.dlgv .rep .r{background:#3a352c;border-radius:6px;padding:7px 10px;cursor:pointer;display:flex;gap:8px;align-items:center}
.dlgv .rep .r:hover{background:#4f5a2c;box-shadow:inset 0 0 0 2px #b9e54b}
.dlgv .rep .r small{color:#c9a55a;font-weight:bold}
.dlgv .rep .r em{color:#c9a55a;font-style:normal;font-weight:normal;font-size:12px}
.dlgv .rep .r img{width:20px;height:20px;object-fit:contain}
.dlgv .rew{display:flex;flex-wrap:wrap;gap:6px 14px;font-weight:bold;color:#f2d36b;padding:0 4px 2px;font-size:13px}
.dlgv .rew span{display:flex;align-items:center;gap:4px}
.dlgv .rew .ic{width:22px;height:22px}
.dlgv .menu{position:absolute;pointer-events:auto;background:#14130ff2;border:1px solid #57554c;border-radius:4px;padding:4px 0;min-width:170px;box-shadow:0 6px 16px #000a}
.dlgv .menu div{padding:3px 14px;cursor:pointer}
.dlgv .menu .t{color:#c9c4ab;border-bottom:1px solid #3a3933;margin-bottom:3px;cursor:default}
.dlgv .menu div:not(.t):hover{background:#3a4a1c}
.dlgv .tip{position:absolute;background:#14130fe8;border:1px solid #57554c;border-radius:4px;padding:3px 9px;font-size:13px;white-space:nowrap}
.dlgv .tip span{color:#f2d36b}
`;

export class DialogueView {
  private root: HTMLDivElement;
  private box: HTMLDivElement | null = null;
  private menu: HTMLDivElement | null = null;
  private tip: HTMLDivElement;
  private shown: Dialogue | null = null;
  /** Réponse cliquée ou tapée, envoyée au prochain pas (input.reponse). */
  reponse: number | null = null;
  /** PNJ choisi dans le menu du clic droit : on va lui parler. */
  menuTalk: string | null = null;

  constructor(private scene: Phaser.Scene, private world: World, private qv: QuestView) {
    const style = document.createElement('style'); style.textContent = CSS + ICON_CSS; document.head.appendChild(style);
    this.root = document.createElement('div'); this.root.className = 'dlgv'; document.body.appendChild(this.root);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.hidden = true; this.root.appendChild(this.tip);
    this.root.append(style);
  }
  get ouvert() { return !!this.world.quetes?.dialogue; }
  /** Touches 1 à 4 pendant un dialogue (à la place des sorts) ; Échap ferme. */
  touche(i: number) { const d = this.world.quetes?.dialogue; if (d && (i < 0 || i < d.reponses.length)) this.reponse = i; }

  /** Position écran (pixels de la page) d'un point du monde dessiné. */
  private ecran(sx: number, sy: number) {
    const cam = this.scene.cameras.main, r = this.scene.game.canvas.getBoundingClientRect();
    const k = r.width / this.scene.scale.width;
    return { x: r.left + (sx - cam.worldView.x) * cam.zoom * k, y: r.top + (sy - cam.worldView.y) * cam.zoom * k, k: cam.zoom * k };
  }

  update() {
    const d = this.world.quetes?.dialogue ?? null;
    if (d !== this.shown) { this.box?.remove(); this.box = d ? this.construire(d) : null; this.shown = d; if (d) this.fermerMenu(); }
    if (!d || !this.box) return;
    const a = this.qv.ancre(d.pnj);
    if (!a) { this.box.hidden = true; return; }
    this.box.hidden = false;
    const p = this.ecran(a.x, a.y - a.h * 0.75), W = window.innerWidth, H = window.innerHeight;
    const bw = this.box.offsetWidth, bh = this.box.offsetHeight, gap = 46 * Math.min(1.4, p.k);
    const droite = p.x + gap + bw < W - 12 || p.x - gap - bw < 12;
    const x = droite ? p.x + gap : p.x - gap - bw;
    const bulle = this.box.firstElementChild as HTMLElement;
    const y = Math.max(30, Math.min(H - bh - 12, p.y - bulle.offsetHeight * 0.45));
    this.box.className = `dlg ${droite ? 'd' : 'g'}`;
    this.box.style.left = `${Math.max(12, Math.min(W - bw - 12, x))}px`; this.box.style.top = `${y}px`;
    bulle.style.setProperty('--py', `${Math.max(14, Math.min(bulle.offsetHeight - 30, p.y - y - 10))}px`);
  }

  private construire(d: Dialogue) {
    const Q = this.world.quetes!, el = document.createElement('div');
    el.className = 'dlg d';
    const reps = d.reponses.map((r, i) => {
      const q = 'quete' in r ? Q.def(r.quete) : null;
      const ic = r.a === 'voir' && q ? `<img src="${v(`assets/ui/quetes/${QUEST_ICON[q.type][0]}.png`)}" alt="">` : '';
      return `<div class="r" data-i="${i}"><small>${i + 1}</small>${ic}<span>${esc(r.texte)}${r.detail ? ` <em>(${esc(r.detail)})</em>` : ''}</span></div>`;
    }).join('');
    el.innerHTML = `<div class="bul"><div class="rub">${esc(Q.data.pnj[d.pnj]?.nom ?? '')}</div><span class="x" title="Fermer (Échap)">✕</span>${esc(d.texte)}</div>
      <div class="rep">${d.recompense ? `<div class="rew">${recompense(d.recompense, Q.classe)}</div>` : ''}${reps}</div>`;
    el.querySelector('.x')!.addEventListener('pointerdown', e => { e.stopPropagation(); this.reponse = -1; });
    el.querySelectorAll<HTMLElement>('.r').forEach(r => r.addEventListener('pointerdown', e => { e.stopPropagation(); this.reponse = +r.dataset.i!; }));
    this.root.appendChild(el);
    return el;
  }

  /** Clic droit sur un PNJ (1C) : son nom, « Parler », ses quêtes. */
  ouvrirMenu(pnj: string, ptr: Phaser.Input.Pointer) {
    this.fermerMenu();
    const Q = this.world.quetes!, n = Q.aDonnerTous(pnj).length + (Q.aRendre(pnj) ? 1 : 0);
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = `<div class="t">${esc(Q.data.pnj[pnj]?.nom ?? '')}</div><div data-a>Parler</div>${n ? `<div data-a>Quêtes (${n})</div>` : ''}`;
    m.querySelectorAll<HTMLElement>('[data-a]').forEach(x => x.addEventListener('pointerdown', e => { e.stopPropagation(); this.menuTalk = pnj; this.fermerMenu(); }));
    const r = this.scene.game.canvas.getBoundingClientRect(), k = r.width / this.scene.scale.width;
    m.style.left = `${r.left + ptr.x * k + 6}px`; m.style.top = `${r.top + ptr.y * k + 6}px`;
    this.root.appendChild(m); this.menu = m;
  }
  fermerMenu() { this.menu?.remove(); this.menu = null; }

  /** Survol (8B) : nom du PNJ et ce qu'il propose. */
  survol(pnj: string | null, ptr: Phaser.Input.Pointer) {
    if (!pnj || this.menu) { this.tip.hidden = true; return; }
    const Q = this.world.quetes!, ic = Q.icone(pnj) ?? (Q.attendParler(pnj) ? { rendre: true } : null);
    const quoi = !ic ? 'Parler' : ic.rendre ? 'Quête à rendre' : Q.aDonnerTous(pnj).length > 1 ? 'Quêtes' : 'Quête';
    this.tip.innerHTML = `${esc(Q.data.pnj[pnj]?.nom ?? '')} · <span>${quoi}</span>`;
    const r = this.scene.game.canvas.getBoundingClientRect(), k = r.width / this.scene.scale.width;
    this.tip.style.left = `${r.left + ptr.x * k + 16}px`; this.tip.style.top = `${r.top + ptr.y * k + 18}px`;
    this.tip.hidden = false;
  }

  destroy() { this.root.remove(); }
}

function recompense(r: RecompenseDef, classe: string) {
  const obj = (o: string) => ITEMS.resources[o] ?? ITEMS.equipment[o];
  const un = r.objetParClasse?.[classe] ?? r.objet;
  return [r.xp ? `<span>${r.xp} XP</span>` : '', r.kamas ? `<span><img src="assets/ui/inv/kamas.png" alt="" style="width:16px">${r.kamas} kamas</span>` : '',
    un ? `<span>${iconHtml(obj(un)?.icon ?? 0)}${esc(obj(un)?.name ?? un)}</span>` : '',
    ...(r.objets ?? []).map(([o, n]) => `<span>${iconHtml(obj(o)?.icon ?? 0)}${n} × ${esc(obj(o)?.name ?? o)}</span>`),
    r.potions ? '<span>Potions remplies</span>' : ''].filter(Boolean).join('');
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
