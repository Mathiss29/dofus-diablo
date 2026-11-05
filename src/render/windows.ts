import { ICON_CSS, iconHtml } from './icons';
import { ITEMS } from '../sim/data';
import {
  BASE_STATS, LEGENDARY, RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, recycleValue,
  type EquipSlot, type Item, type Stat,
} from '../sim/items';
import type { World } from '../sim/world';

const SLOT_NAMES: Record<EquipSlot, string> = {
  chapeau: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau', anneau2: 'Anneau', ceinture: 'Ceinture',
  bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier',
};
/** Place des emplacements autour du perso (gauche puis droite), comme l'inventaire de Dofus 3. */
const LEFT: EquipSlot[] = ['chapeau', 'cape', 'amulette', 'ceinture'];
const RIGHT: EquipSlot[] = ['anneau1', 'anneau2', 'bottes', 'arme', 'bouclier'];
const CATS: [string, string][] = [['tout', 'Tout'], ['arme', 'Armes'], ['amulette', 'Amulettes'], ['anneau', 'Anneaux'],
  ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['ceinture', 'Ceintures'], ['bottes', 'Bottes'], ['ressource', 'Ressources']];

const CSS = `
.dw{position:fixed;inset:0;pointer-events:none;font:13px 'Trebuchet MS',Verdana,sans-serif;color:#e8e2d4;z-index:10}
.dw .win{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1080px,96vw);height:min(640px,90vh);
 background:linear-gradient(#24211a,#17150f);border:1px solid #8a6d32;box-shadow:inset 0 0 0 2px #17140d,inset 0 0 0 3px #5a4a26,0 10px 40px #000a;border-radius:6px;display:grid;grid-template-columns:330px 1fr 250px;grid-template-rows:40px 1fr}
.dw .bar{grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:0 14px;border-bottom:1px solid #3a3a2c;font-weight:bold;color:#ffe9b0;font-size:15px}
.dw .bar .x{margin-left:auto;cursor:pointer;color:#c9c4ab;font-size:18px}
.dw .bar .tab{cursor:pointer;color:#a9a48b;font-size:13px}.dw .bar .tab.on{color:#ffe9b0;box-shadow:inset 0 -2px 0 #b9e54b}
.dw .col{padding:12px;overflow:auto;min-height:0}
.dw .perso{display:grid;grid-template-columns:62px 1fr 62px;gap:6px;align-items:center}
.dw .slots{display:grid;gap:8px}
.dw .slot{width:56px;height:56px;border-radius:5px;background:#1d1c15;border:1px solid #4a4736;position:relative;display:grid;place-items:center;cursor:pointer}
.dw .slot .ic{width:48px;height:48px}.dw .slot .lab{position:absolute;inset:0;display:grid;place-items:center;font-size:10px;color:#6f6a55;text-align:center}
.dw .stage{position:relative;height:300px;display:grid;place-items:end center}
.dw .stage .socle{position:absolute;bottom:8px;width:190px;opacity:.9;filter:sepia(.5) saturate(1.3) drop-shadow(0 0 10px #8fe8ff66)}
.dw .stage .who{position:relative;bottom:40px;image-rendering:auto;max-height:230px}
.dw .name{text-align:center;font-weight:bold;color:#ffe9b0;margin-top:6px}
.dw .cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.dw .cats span{padding:3px 8px;border-radius:3px;background:#1d1c15;border:1px solid #3a3a2c;cursor:pointer;font-size:12px}
.dw .cats span.on{border-color:#b9e54b;color:#d6f57a}
.dw input{width:100%;box-sizing:border-box;background:#0f0e0b;border:1px solid #3a3a2c;color:#e8e2d4;padding:6px 8px;border-radius:4px;margin-bottom:8px}
.dw .grid{display:grid;grid-template-columns:repeat(auto-fill,52px);gap:5px}
.dw .cell{width:52px;height:52px;border-radius:4px;background:#1d1c15;border:1px solid #3a3a2c;position:relative;cursor:pointer}
.dw .cell .ic{width:44px;height:44px;margin:4px}.dw .cell .n{position:absolute;right:3px;bottom:1px;font-size:11px;font-weight:bold;text-shadow:0 0 2px #000}
.dw .cell.up::after{content:'▲';position:absolute;left:3px;top:1px;color:#7be07b;font-size:10px}
.dw .cell.low{opacity:.55}
.dw .stats{display:grid;gap:3px}.dw .stats div{display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid #2a2820}
.dw .plus{cursor:pointer;background:#2c3a12;border:1px solid #6f8f2a;color:#d6f57a;border-radius:3px;padding:0 6px;margin-left:6px;font-weight:bold}
.dw .plus.off{opacity:.3;pointer-events:none}
.dw .pts{color:#b9e54b;font-weight:bold;margin:4px 0 8px}
.dw .tip{position:fixed;pointer-events:none;z-index:11;min-width:240px;max-width:320px;background:#14130ff4;border:1px solid #8a6d32;border-radius:5px;padding:10px 12px;box-shadow:0 6px 20px #000a;line-height:1.45}
.dw .tip h4{margin:0 0 2px;font-size:15px}.dw .tip .sub{color:#a9a48b;font-size:12px;margin-bottom:6px}
.dw .tip .up{color:#7be07b}.dw .tip .down{color:#e0625a}.dw .tip .ex{color:#6fb2e8}.dw .tip .leg{color:#f08a2c;margin-top:4px}
.dw .tip .set{color:#9ad15a;margin-top:6px;font-size:12px}.dw .tip .hint{color:#7f7a64;font-size:11px;margin-top:6px}
.dw .tip .cmp{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:6px;font-size:12px}
.dw .btn{display:inline-block;margin-top:8px;padding:5px 10px;border-radius:4px;background:linear-gradient(#cff26a,#9ccd2c);color:#1d2a06;font-weight:bold;cursor:pointer}
`;

/** Fenêtre « Personnage » façon Dofus 3 (choix 14D) : le perso sur son socle avec ses emplacements autour,
 *  le sac en grille (catégories, recherche), les caractéristiques avec les points à placer.
 *  Le jeu continue derrière (pas de pause : multijoueur prévu). Les clics appellent l'API de la partie (World / Player). */
export class Windows {
  private root: HTMLDivElement;
  private win: HTMLDivElement | null = null;
  private tip: HTMLDivElement;
  private cat = 'tout';
  private search = '';
  /** Image du perso (frame de repos de sa planche). */
  portrait = '';
  onChange: () => void = () => {};

  constructor(private world: World) {
    const style = document.createElement('style'); style.textContent = CSS + ICON_CSS; document.head.appendChild(style);
    this.root = document.createElement('div'); this.root.className = 'dw'; document.body.appendChild(this.root);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; this.tip.style.display = 'none'; this.root.appendChild(this.tip);
  }
  get open() { return !!this.win; }
  toggle() { if (this.win) this.close(); else this.show(); }
  close() { this.win?.remove(); this.win = null; this.tip.style.display = 'none'; }
  destroy() { this.root.remove(); }

  show() {
    this.close();
    const w = document.createElement('div'); w.className = 'win';
    w.addEventListener('contextmenu', e => e.preventDefault());
    w.addEventListener('pointerdown', e => e.stopPropagation());
    this.win = w; this.root.appendChild(w);
    this.render();
  }
  /** Redessine si la fenêtre est ouverte (après un ramassage, un niveau...). */
  refresh() { if (this.win) this.render(); }

  private render() {
    const w = this.win!, p = this.world.player, cls = p.cls;
    const slot = (s: EquipSlot) => {
      const it = p.equipment[s], d = it && ITEMS.equipment[it.id];
      return `<div class="slot" data-slot="${s}" style="${it ? `border-color:${RARITY_COLORS[it.rarity]}` : ''}">${d ? `${iconHtml(d.icon)}` : `<span class="lab">${SLOT_NAMES[s]}</span>`}</div>`;
    };
    const bag = this.filtered();
    const st = (k: Stat) => p.stat(k);
    w.innerHTML = `
      <div class="bar">Personnage · ${cls.name} niv. ${p.level}<span class="x" data-close>✕</span></div>
      <div class="col">
        <div class="perso">
          <div class="slots">${LEFT.map(slot).join('')}</div>
          <div><div class="stage"><img class="socle" src="assets/ui/socle.png" alt=""><img class="who" src="${this.portrait}" alt=""></div>
            <div class="name">${cls.name} · niv. ${p.level}</div></div>
          <div class="slots">${RIGHT.map(slot).join('')}</div>
        </div>
        ${this.setsHtml()}
      </div>
      <div class="col">
        <div class="cats">${CATS.map(([k, n]) => `<span data-cat="${k}" class="${this.cat === k ? 'on' : ''}">${n}</span>`).join('')}</div>
        <input placeholder="Rechercher un objet" value="${this.search.replace(/"/g, '&quot;')}" data-search>
        <div class="grid">${bag}</div>
        <div style="color:#7f7a64;font-size:11px;margin-top:8px">${p.bag.length} / 60 · clic droit : équiper · Maj + clic : recycler</div>
      </div>
      <div class="col">
        <div class="pts">${p.points} point${p.points > 1 ? 's' : ''} à placer</div>
        <div class="stats">
          <div><span>Points de vie</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
          <div><span>PA · PM</span><b>${p.paMax} · ${p.pmMax}</b></div>
          ${BASE_STATS.map(k => `<div><span>${STAT_NAMES[k]}</span><span><b>${st(k)}</b><span class="plus ${p.points ? '' : 'off'}" data-plus="${k}" title="Maj : +10">+</span></span></div>`).join('')}
          ${(['puissance', 'dommages', 'critique', 'prospection', 'soins'] as Stat[]).map(k => `<div><span>${STAT_NAMES[k]}</span><b>${k === 'critique' ? Math.round(p.critChance * 100) : st(k)}</b></div>`).join('')}
        </div>
        <div style="color:#7f7a64;font-size:11px;margin-top:10px">Force : sorts Terre · Intelligence : Feu · Chance : Eau · Agilité : Air (+1 % de dommages par point). Vitalité : +1 PV. Sagesse : +1 % d'XP.</div>
      </div>`;
    w.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    w.querySelectorAll<HTMLElement>('[data-cat]').forEach(e => e.addEventListener('click', () => { this.cat = e.dataset.cat!; this.render(); }));
    const inp = w.querySelector<HTMLInputElement>('[data-search]')!;
    inp.addEventListener('input', () => { this.search = inp.value; this.render(); const n = this.win!.querySelector<HTMLInputElement>('[data-search]')!; n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    inp.addEventListener('keydown', e => e.stopPropagation());
    w.querySelectorAll<HTMLElement>('[data-plus]').forEach(e => e.addEventListener('click', ev => {
      p.spendPoint(e.dataset.plus as Stat, ev.shiftKey ? Math.min(10, p.points) : 1); this.changed();
    }));
    w.querySelectorAll<HTMLElement>('[data-slot]').forEach(e => {
      const s = e.dataset.slot as EquipSlot;
      e.addEventListener('mouseenter', ev => { const it = p.equipment[s]; if (it) this.showTip(it, ev, true); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', () => { p.unequip(s); this.changed(); });
    });
    w.querySelectorAll<HTMLElement>('[data-uid]').forEach(e => {
      const uid = +e.dataset.uid!, it = p.bag.find(b => b.uid === uid)!;
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', () => { if (!p.equip(uid)) this.flash(e); this.changed(); });
      e.addEventListener('click', ev => { if (ev.shiftKey) { this.world.recycle(uid); this.changed(); } });
    });
  }

  private changed() { this.hideTip(); this.render(); this.onChange(); }
  private flash(e: HTMLElement) { e.style.borderColor = '#e0625a'; }

  /** Contenu du sac selon la catégorie et la recherche ; les ressources s'empilent. */
  private filtered(): string {
    const p = this.world.player, q = this.search.toLowerCase();
    const cells: string[] = [];
    if (this.cat !== 'ressource') for (const it of p.bag) {
      const d = ITEMS.equipment[it.id];
      if (!d || (this.cat !== 'tout' && d.slot !== this.cat) || (q && !d.name.toLowerCase().includes(q))) continue;
      const slot = p.slotFor(it), cur = slot ? p.equipment[slot] : undefined;
      const up = d.level <= p.level && (!cur || this.score(it) > this.score(cur));
      cells.push(`<div class="cell ${up ? 'up' : ''} ${d.level > p.level ? 'low' : ''}" data-uid="${it.uid}" style="border-color:${RARITY_COLORS[it.rarity]}88">${iconHtml(d.icon)}</div>`);
    }
    if (this.cat === 'tout' || this.cat === 'ressource') for (const [id, n] of Object.entries(p.resources)) {
      const r = ITEMS.resources[id];
      if (!r || (q && !r.name.toLowerCase().includes(q))) continue;
      cells.push(`<div class="cell" title="${r.name}">${iconHtml(r.icon)}<span class="n">${n}</span></div>`);
    }
    return cells.join('') || '<div style="color:#7f7a64">Rien ici pour l\'instant. Les monstres lâchent leurs objets officiels.</div>';
  }
  /** Note grossière d'un objet pour la flèche verte « meilleur que l'objet porté ». */
  private score(it: Item): number {
    let s = 0;
    for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) s += v * (k === 'vitalite' ? 0.5 : k === 'critique' ? 3 : k.startsWith('dommages') ? 4 : k === 'pa' || k === 'pm' ? 40 : 1);
    return s + (it.legendary ? 30 : 0);
  }

  private setsHtml(): string {
    const p = this.world.player, out: string[] = [];
    for (const [id, n] of Object.entries(p.setCount)) {
      const s = ITEMS.sets[id]; if (!s || n < 2) continue;
      const b = s.bonus[String(n - 1)] ?? {};
      out.push(`<div style="margin-top:8px;color:#9ad15a"><b>${s.name}</b> (${n} / ${s.items.length})<br><span style="font-size:12px">${Object.entries(b).map(([k, v]) => `+${v} ${STAT_NAMES[k as Stat]}`).join(' · ')}</span></div>`);
    }
    return out.join('');
  }

  // --- Fiche d'objet au survol : jets, rareté, panoplie, comparaison avec l'objet porté ---
  private showTip(it: Item, ev: MouseEvent, worn: boolean) {
    const p = this.world.player, d = ITEMS.equipment[it.id];
    if (!d) return;
    const slot = p.slotFor(it), cur = !worn && slot ? p.equipment[slot] : undefined;
    const line = (k: Stat, v: number) => `<div class="${it.extra.includes(k) ? 'ex' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k]}</div>`;
    const stats = STATS.filter(k => it.stats[k] !== undefined).map(k => line(k, it.stats[k]!)).join('');
    const weapon = d.weapon ? `<div>${d.weapon.dmg.map(x => `${x.min}–${x.max} dommages ${x.element}`).join(' · ')}</div>` : '';
    const leg = it.legendary ? `<div class="leg"><b>${LEGENDARY[it.legendary.id].name}</b> : ${LEGENDARY[it.legendary.id].text(it.legendary.value)}</div>` : '';
    const set = d.set && ITEMS.sets[d.set] ? `<div class="set">${ITEMS.sets[d.set].name}</div>` : '';
    let cmp = '';
    if (cur) {
      const ks = STATS.filter(k => (it.stats[k] ?? 0) !== (cur.stats[k] ?? 0));
      cmp = `<div class="cmp">Par rapport à ${ITEMS.equipment[cur.id]?.name ?? 'l\'objet porté'} :<br>${ks.map(k => {
        const dv = (it.stats[k] ?? 0) - (cur.stats[k] ?? 0);
        return `<span class="${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '+' : ''}${dv} ${STAT_NAMES[k]}</span>`;
      }).join('<br>') || 'identique'}</div>`;
    }
    const lvl = d.level > p.level ? `<div class="down">Niveau ${d.level} requis</div>` : '';
    this.tip.innerHTML = `<h4 style="color:${RARITY_COLORS[it.rarity]}">${d.name}</h4>
      <div class="sub">${RARITY_NAMES[it.rarity]} · ${d.weapon?.type ?? SLOT_NAMES[(slot ?? 'amulette') as EquipSlot]} · niveau ${d.level}</div>
      ${weapon}${stats}${leg}${set}${lvl}${cmp}
      <div class="hint">${worn ? 'Clic droit : retirer' : `Clic droit : équiper · Maj + clic : recycler (${recycleValue(d, it)} runes)`}</div>`;
    this.tip.style.display = 'block'; this.moveTip(ev);
  }
  private moveTip(ev: MouseEvent) {
    const t = this.tip, w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.min(innerWidth - w - 8, ev.clientX + 16)}px`;
    t.style.top = `${Math.min(innerHeight - h - 8, ev.clientY + 12)}px`;
  }
  private hideTip() { this.tip.style.display = 'none'; }
}
