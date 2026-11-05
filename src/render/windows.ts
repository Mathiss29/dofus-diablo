import { ICON_CSS, iconHtml } from './icons';
import { ITEMS } from '../sim/data';
import {
  BASE_STATS, LEGENDARY, RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, metierXpNeeded, recycleValue,
  type EquipSlot, type Item, type Stat,
} from '../sim/items';
import { Player } from '../sim/player';
import type { World } from '../sim/world';

const SLOT_NAMES: Record<EquipSlot, string> = {
  chapeau: 'Coiffe', cape: 'Cape', amulette: 'Amulette', anneau1: 'Anneau', anneau2: 'Anneau', ceinture: 'Ceinture',
  bottes: 'Bottes', arme: 'Arme', bouclier: 'Bouclier',
};
/** Silhouette blanche des emplacements vides (icons_2x de Dofus 3). */
const SLOT_ICONS: Record<EquipSlot, string> = {
  chapeau: 'helmet', cape: 'cape', amulette: 'amulet', anneau1: 'ring', anneau2: 'ring', ceinture: 'belt',
  bottes: 'boots', arme: 'weapon', bouclier: 'shield',
};
/** Place des emplacements autour du perso, comme l'inventaire de Dofus 3 (null = case vide de l'interface). */
const LEFT: (EquipSlot | null)[] = ['chapeau', 'cape', null, 'arme', 'bouclier'];
const RIGHT: (EquipSlot | null)[] = ['amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes'];
/** Onglets verticaux de l'inventaire de Dofus 3 : tout, équipements, consommables, ressources, objets de quête, apparats. */
const TABS: [string, string, string][] = [['tout', 'all', 'Tout'], ['equip', 'equipments', 'Équipements'], ['conso', 'consumables', 'Consommables'],
  ['ressource', 'resources', 'Ressources'], ['quete', 'key', 'Objets de quête'], ['apparat', 'cosmetics', 'Apparats']];
const KINDS: [string, string][] = [['', 'Toutes les catégories'], ['arme', 'Armes'], ['amulette', 'Amulettes'], ['anneau', 'Anneaux'],
  ['chapeau', 'Coiffes'], ['cape', 'Capes'], ['ceinture', 'Ceintures'], ['bottes', 'Bottes'], ['bouclier', 'Boucliers']];
const SORTS: [string, string][] = [['', 'Aucun tri'], ['niveau', 'Niveau'], ['rarete', 'Rareté'], ['nom', 'Nom']];
const RARITY_ORDER: Record<string, number> = { commun: 0, rare: 1, epique: 2, legendaire: 3, mythique: 4 };
const INV = 'assets/ui/inv';

const CSS = `
.dw{position:fixed;inset:0;pointer-events:none;font:13px 'Trebuchet MS',Verdana,sans-serif;color:#e8e2d4;z-index:10}
.dw .win{pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#24231f;border:1px solid #0d0c0a;
 box-shadow:inset 0 0 0 1px #4a4840,0 12px 40px #000c;border-radius:4px;display:grid;grid-template-rows:38px 1fr;overflow:hidden}
.dw .win.inv{width:min(910px,96vw);height:min(720px,92vh)}
.dw .win.car{width:min(440px,96vw);height:min(640px,92vh)}
.dw .ttl{position:relative;display:grid;place-items:center;background:linear-gradient(#34322b,#26241f);border-bottom:1px solid #0d0c0a;box-shadow:inset 0 -1px 0 #4a4840}
.dw .ttl b{font:bold 17px 'Trebuchet MS',sans-serif;color:#f4efe0;text-shadow:0 1px 2px #000;letter-spacing:.3px}
.dw .ttl img{position:absolute;left:8px;top:5px;width:28px;height:28px}
.dw .ttl .x{position:absolute;right:10px;top:4px;cursor:pointer;color:#f4efe0;font-size:22px;line-height:28px}
.dw .ttl .x:hover{color:#b9e54b}
.dw .body{display:grid;grid-template-columns:minmax(0,465px) minmax(0,1fr);min-height:0}
.dw .left{position:relative;display:grid;grid-template-rows:1fr auto;background:radial-gradient(ellipse 30% 48% at 50% 50%,#e4f59a 0%,#9fd27a 18%,#4f8a58 42%,#2b4632 68%,#1b231c 100%);border-right:1px solid #0d0c0a;min-height:0}
.dw .left::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#0004,transparent 18%,transparent 82%,#0004);pointer-events:none}
.dw .perso{position:relative;display:grid;grid-template-columns:64px 1fr 64px;gap:8px;padding:14px 14px 0;min-height:0}
.dw .slots{display:grid;grid-auto-rows:64px;gap:10px;align-content:start;z-index:1}
.dw .slot{width:62px;height:62px;border-radius:4px;background:linear-gradient(#4a4943,#383732);border:1px solid #6a675c;box-shadow:inset 0 0 0 1px #0007,0 2px 4px #0006;position:relative;display:grid;place-items:center;cursor:pointer}
.dw .slot.none{visibility:hidden}
.dw .slot .sil{width:34px;height:34px;opacity:.9}
.dw .slot .ic{width:52px;height:52px}
.dw .slot:hover{border-color:#b9e54b}
.dw .stage{position:relative;display:grid;place-items:end center;min-height:0}
.dw .stage .socle{position:absolute;bottom:40px;width:250px;max-width:100%;filter:drop-shadow(0 8px 10px #0008)}
.dw .stage .who{position:relative;bottom:118px;height:min(270px,40vh);max-width:100%;object-fit:contain}
.dw .stage .lv{position:absolute;top:2px;left:0;right:0;text-align:center;font-weight:bold;color:#f4efe0;text-shadow:0 1px 3px #000}
.dw .dofus{display:flex;justify-content:center;gap:10px;padding:12px 14px 16px;z-index:1}
.dw .dofus .slot{width:54px;height:54px;opacity:.85}
.dw .sets{position:absolute;left:90px;right:90px;bottom:92px;text-align:center;font-size:12px;color:#d6f57a;text-shadow:0 1px 2px #000}
.dw .right{display:grid;grid-template-columns:44px minmax(0,1fr);min-height:0;background:#292824}
.dw .tabs{display:flex;flex-direction:column;gap:6px;padding:14px 4px 0 6px;border-right:1px solid #0d0c0a;background:#1d1c19}
.dw .tab{width:32px;height:32px;border-radius:4px;display:grid;place-items:center;cursor:pointer;background:#2e2d28;border:1px solid #45433b}
.dw .tab img{width:24px;height:24px}
.dw .tab.on{background:linear-gradient(#6f9a2a,#4c6e17);border-color:#b9e54b}
.dw .tab:hover{border-color:#b9e54b}
.dw .list{display:grid;grid-template-rows:auto auto 1fr auto auto;gap:8px;padding:12px 12px 10px;min-height:0}
.dw input,.dw select{width:100%;box-sizing:border-box;background:#141310;border:1px solid #45433b;color:#e8e2d4;padding:7px 9px;border-radius:3px;font:13px 'Trebuchet MS',sans-serif}
.dw select{cursor:pointer}
.dw .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dw .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));grid-auto-rows:62px;gap:6px;overflow:auto;align-content:start;padding-right:2px}
.dw .cell{border-radius:3px;background:linear-gradient(#3e3d37,#33322d);border:1px solid #57554c;box-shadow:inset 0 0 0 1px #0005;position:relative;cursor:pointer;display:grid;place-items:center}
.dw .cell.empty{cursor:default;background:#2e2d29;border-color:#46443d}
.dw .cell:not(.empty):hover{border-color:#b9e54b}
.dw .cell .ic{width:52px;height:52px}
.dw .cell .n{position:absolute;left:4px;top:2px;font-size:13px;font-weight:bold;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000}
.dw .cell .r{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px}
.dw .cell.up::after{content:'';position:absolute;right:4px;top:4px;border:5px solid transparent;border-bottom:7px solid #7be07b;border-top:0}
.dw .cell.low{opacity:.5}
.dw .foot{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#c9c4ab}
.dw .foot b{color:#f4efe0}
.dw .foot .k{display:flex;gap:5px;align-items:center;font-weight:bold;color:#b9e54b;font-size:15px}
.dw .foot .k img{width:18px;height:18px}
.dw .hint{color:#8f8a73;font-size:11px}
.dw .carac{padding:16px 18px;overflow:auto;display:grid;gap:10px;align-content:start}
.dw .who2{display:flex;gap:12px;align-items:center}
.dw .who2 img{width:54px;height:54px;border-radius:50%;background:#1d1c19;border:1px solid #57554c;object-fit:cover;object-position:top}
.dw .who2 b{font-size:16px;color:#f4efe0}
.dw .carac .sub{color:#c9a55a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}.dw .stats{display:grid;gap:3px}.dw .stats div{display:flex;justify-content:space-between;align-items:center;padding:4px 2px;border-bottom:1px solid #34322b}
.dw .plus{cursor:pointer;background:#2c3a12;border:1px solid #6f8f2a;color:#d6f57a;border-radius:3px;padding:0 6px;margin-left:6px;font-weight:bold}
.dw .plus.off{opacity:.3;pointer-events:none}
.dw .pts{color:#b9e54b;font-weight:bold}
.dw .tip{position:fixed;pointer-events:none;z-index:11;min-width:240px;max-width:320px;background:#14130ff4;border:1px solid #57554c;border-radius:4px;padding:10px 12px;box-shadow:0 6px 20px #000a;line-height:1.45}
.dw .tip h4{margin:0 0 2px;font-size:15px}.dw .tip .sub{color:#a9a48b;font-size:12px;margin-bottom:6px}
.dw .tip .up{color:#7be07b}.dw .tip .down{color:#e0625a}.dw .tip .ex{color:#6fb2e8}.dw .tip .leg{color:#f08a2c;margin-top:4px}
.dw .tip .set{color:#9ad15a;margin-top:6px;font-size:12px}.dw .tip .hint{color:#7f7a64;font-size:11px;margin-top:6px}
.dw .win.job{width:min(560px,96vw);height:min(640px,92vh)}
.dw .job .in{padding:14px 16px;overflow:auto;display:grid;gap:12px;align-content:start}
.dw .mh{display:flex;gap:12px;align-items:center}.dw .mh img{width:56px;height:56px}
.dw .mh b{font-size:17px;color:#f4efe0}.dw .bar{height:8px;border-radius:4px;background:#2c281f;overflow:hidden;margin-top:5px;width:260px;max-width:100%}
.dw .bar i{display:block;height:100%;background:#b9e54b}
.dw .note{font-size:12px;color:#c9c4ab;background:#1d1c19;border:1px solid #34322b;border-radius:3px;padding:8px 10px}
.dw .note.ok{border-color:#4c6e17;color:#d6f57a}
.dw .rec{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:8px;border:1px solid #34322b;border-radius:4px;background:#26251f}
.dw .rec .ic{width:48px;height:48px}.dw .rec .ings{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:12px}
.dw .rec .ing{display:flex;align-items:center;gap:3px}.dw .rec .ing .ic{width:26px;height:26px}
.dw .rec .lack{color:#e0625a}.dw .rec .have{color:#9ad15a}
.dw .btn{cursor:pointer;background:linear-gradient(#6f9a2a,#4c6e17);border:1px solid #b9e54b;color:#fff;border-radius:3px;padding:6px 12px;font-weight:bold}
.dw .btn.off{opacity:.35;pointer-events:none;filter:grayscale(1)}
.dw .tip .cmp{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:6px;font-size:12px}
`;

type Mode = 'inv' | 'car' | 'job';

/** Fenêtres façon Dofus 3 : « Inventaire » (le perso sur son socle, ses emplacements autour, le sac à onglets)
 *  et « Caractéristiques » (les points à placer). Le jeu continue derrière (pas de pause : multijoueur prévu).
 *  Les clics appellent l'API de la partie (World / Player). */
export class Windows {
  private root: HTMLDivElement;
  private win: HTMLDivElement | null = null;
  private mode: Mode = 'inv';
  private tip: HTMLDivElement;
  private tab = 'tout';
  private kind = '';
  private sort = '';
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
  /** Ouvre la fenêtre demandée, ou la ferme si c'est déjà elle. */
  toggle(mode: Mode = 'inv') { if (this.win && this.mode === mode) this.close(); else this.show(mode); }
  close() { this.win?.remove(); this.win = null; this.tip.style.display = 'none'; }
  destroy() { this.root.remove(); }

  show(mode: Mode = 'inv') {
    this.close();
    this.mode = mode;
    const w = document.createElement('div'); w.className = `win ${mode}`;
    w.addEventListener('contextmenu', e => e.preventDefault());
    w.addEventListener('pointerdown', e => e.stopPropagation());
    this.win = w; this.root.appendChild(w);
    this.render();
  }
  /** Redessine si la fenêtre est ouverte (après un ramassage, un niveau...). */
  refresh() { if (this.win) this.render(); }

  private render() {
    if (this.mode === 'car') this.renderCarac(); else if (this.mode === 'job') this.renderJob(); else this.renderInv();
    this.win!.querySelector('[data-close]')!.addEventListener('click', () => this.close());
  }
  private title(name: string, icon: string) {
    return `<div class="ttl"><img src="assets/ui/menu/${icon}.png" alt="" style="object-fit:contain"><b>${name}</b><span class="x" data-close title="Fermer (Échap)">✕</span></div>`;
  }

  private renderInv() {
    const w = this.win!, p = this.world.player;
    const slot = (s: EquipSlot | null) => {
      if (!s) return '<div class="slot none"></div>';
      const it = p.equipment[s], d = it && ITEMS.equipment[it.id];
      return `<div class="slot" data-slot="${s}" title="${d ? '' : SLOT_NAMES[s]}" style="${it ? `box-shadow:inset 0 -3px 0 ${RARITY_COLORS[it.rarity]}` : ''}">${d ? iconHtml(d.icon) : `<img class="sil" src="${INV}/s_${SLOT_ICONS[s]}.png" alt="">`}</div>`;
    };
    const { html, n } = this.cells();
    w.innerHTML = `${this.title('Inventaire', 'inventory')}
      <div class="body">
        <div class="left">
          <div class="perso">
            <div class="slots">${LEFT.map(slot).join('')}</div>
            <div class="stage"><div class="lv">${p.cls.name} · niveau ${p.level}</div><img class="socle" src="assets/ui/socle.png" alt=""><img class="who" src="${this.portrait}" alt=""></div>
            <div class="slots">${RIGHT.map(slot).join('')}</div>
          </div>
          <div class="sets">${this.setsHtml()}</div>
          <div class="dofus">${Array.from({ length: 6 }, () => `<div class="slot" title="Dofus (plus tard)"><img class="sil" src="${INV}/s_dofus.png" alt=""></div>`).join('')}</div>
        </div>
        <div class="right">
          <div class="tabs">${TABS.map(([k, ic, name]) => `<div class="tab ${this.tab === k ? 'on' : ''}" data-tab="${k}" title="${name}"><img src="${INV}/tab_${ic}.png" alt=""></div>`).join('')}</div>
          <div class="list">
            <input placeholder="Rechercher..." value="${this.search.replace(/"/g, '&quot;')}" data-search>
            <div class="row2">
              <select data-sort>${SORTS.map(([k, v]) => `<option value="${k}" ${this.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
              <select data-kind>${KINDS.map(([k, v]) => `<option value="${k}" ${this.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            <div class="grid">${html}</div>
            <div class="foot"><span>Visible(s) : <b>${n}</b> · sac <b>${p.bag.length} / ${Player.BAG_SIZE}</b><br><span class="hint">Clic droit : équiper / retirer · Maj + clic : recycler</span></span>
              <span class="k">${p.kamas.toLocaleString('fr-FR')} <img src="${INV}/kamas.png" alt="" title="Kamas"></span></div>
            <div class="foot"><span>Butin affiché au sol</span>
              <select data-filter style="width:auto">${['Tout', 'Rare et plus', 'Épique et plus'].map((n, i) => `<option value="${i}" ${p.lootFilter === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          </div>
        </div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-tab]').forEach(e => e.addEventListener('click', () => { this.tab = e.dataset.tab!; this.render(); }));
    w.querySelector<HTMLSelectElement>('[data-sort]')!.addEventListener('change', e => { this.sort = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-kind]')!.addEventListener('change', e => { this.kind = (e.target as HTMLSelectElement).value; this.render(); });
    w.querySelector<HTMLSelectElement>('[data-filter]')!.addEventListener('change', e => { p.lootFilter = +(e.target as HTMLSelectElement).value; this.render(); });
    w.querySelectorAll('select').forEach(s => s.addEventListener('keydown', e => e.stopPropagation()));
    const inp = w.querySelector<HTMLInputElement>('[data-search]')!;
    inp.addEventListener('input', () => { this.search = inp.value; this.render(); const m = this.win!.querySelector<HTMLInputElement>('[data-search]')!; m.focus(); m.setSelectionRange(m.value.length, m.value.length); });
    inp.addEventListener('keydown', e => e.stopPropagation());
    w.querySelectorAll<HTMLElement>('[data-slot]').forEach(e => {
      const s = e.dataset.slot as EquipSlot;
      e.addEventListener('mouseenter', ev => { const it = p.equipment[s]; if (it) this.showTip(it, ev, true); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', () => { p.unequip(s); this.changed(); });
      e.addEventListener('dblclick', () => { p.unequip(s); this.changed(); });
    });
    w.querySelectorAll<HTMLElement>('[data-res]').forEach(e => {
      const id = e.dataset.res!, r = ITEMS.resources[id];
      const eat = () => { if (this.world.eat(id)) this.changed(); };
      e.addEventListener('mouseenter', ev => { this.tip.innerHTML = `<h4>${r.name}</h4><div class="sub">${r.soin ? 'Consommable' : 'Ressource'} · niveau ${r.level}</div>${r.soin ? `<div class="up">+${r.soin} PV</div><div class="hint">Clic droit : manger</div>` : ''}`; this.tip.style.display = 'block'; this.moveTip(ev); });
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      if (r.soin) { e.addEventListener('contextmenu', eat); e.addEventListener('dblclick', eat); }
    });
    w.querySelectorAll<HTMLElement>('[data-uid]').forEach(e => {
      const uid = +e.dataset.uid!, it = p.bag.find(b => b.uid === uid)!;
      const equip = () => { if (!p.equip(uid)) this.flash(e); this.changed(); };
      e.addEventListener('mouseenter', ev => this.showTip(it, ev, false));
      e.addEventListener('mousemove', ev => this.moveTip(ev));
      e.addEventListener('mouseleave', () => this.hideTip());
      e.addEventListener('contextmenu', equip);
      e.addEventListener('dblclick', equip);
      e.addEventListener('click', ev => { if (ev.shiftKey) { this.world.recycle(uid); this.changed(); } });
    });
  }

  private renderCarac() {
    const w = this.win!, p = this.world.player, st = (k: Stat) => p.stat(k), r1 = (v: number) => Math.round(v * 10) / 10;
    const row = (label: string, v: number | string, tip: string) => `<div title="${tip}"><span>${label}</span><b>${v}</b></div>`;
    w.innerHTML = `${this.title('Caractéristiques', 'characteristic')}
      <div class="carac">
        <div class="who2"><img src="${this.portrait}" alt=""><div><b>${p.cls.name}</b><br>Niveau ${p.level}</div></div>
        <div class="pts">${p.points} point${p.points > 1 ? 's' : ''} à placer</div>
        <div class="stats">
          <div><span>Points de vie</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
          <div><span>PA · PM</span><b>${p.paMax} · ${p.pmMax}</b></div>
          ${BASE_STATS.map(k => `<div><span>${STAT_NAMES[k]}</span><span><b>${st(k)}</b><span class="plus ${p.points ? '' : 'off'}" data-plus="${k}" title="Maj : +10">+</span></span></div>`).join('')}
          <div><span>Auto-attaque</span><b>${(1 / p.attackInterval()).toFixed(2)} / s</b></div>
          ${(['puissance', 'dommages', 'critique', 'vitesse', 'prospection', 'soins'] as Stat[]).map(k => `<div><span>${STAT_NAMES[k]}</span><b>${k === 'critique' ? Math.round(p.critChance * 100) : st(k)}</b></div>`).join('')}
        </div>
        <div class="sub">Combat</div>
        <div class="stats">
          ${row('Portée', st('portee'), '+1 case de portée par point pour les sorts à distance')}
          ${row('Initiative', p.initiative, 'Initiative + Force + Intelligence + Chance + Agilité. Le premier coup porté à un monstre fait +1 % par 10 points (jusqu\'à +50 %)')}
          ${row('Tacle', r1(p.tacle), 'Agilité / 10 + Tacle. Ralentit les monstres à ton contact (leur Fuite y résiste)')}
          ${row('Fuite', r1(p.fuite), 'Agilité / 10 + Fuite. Résiste au Tacle des monstres et réduit les ralentissements subis')}
          ${row('Retrait PA · PM', `${r1(p.retrait('PA'))} · ${r1(p.retrait('PM'))}`, 'Sagesse / 10 + Retrait. Chance que tes retraits de PA / PM passent l\'Esquive du monstre')}
          ${row('Esquive PA · PM', `${r1(p.esquive('PA'))} · ${r1(p.esquive('PM'))}`, 'Sagesse / 10 + Esquive. Chance d\'éviter les retraits de PA / PM des monstres')}
          ${row('Dommages Critiques', st('dommagesCritiques'), 'S\'ajoutent à chaque coup critique')}
          ${row('Dommages Poussée', st('dommagesPoussee'), 'S\'ajoutent aux coups qui repoussent')}
          ${row('Résistance Poussée · Critiques', `${st('resPoussee')} · ${st('resCritiques')}`, 'Sans effet pour l\'instant : les monstres ne font ni dommages de poussée ni coups critiques')}
          ${row('Invocations · Pods', `${st('invocations')} · ${st('pods')}`, 'Invocations : pour l\'Osamodas, plus tard. Pods : pas encore de limite de poids')}
        </div>
        <div class="sub">Résistances (fixe · %)</div>
        <div class="stats">
          ${(['Terre', 'Feu', 'Eau', 'Air', 'Neutre'] as const).map(e => row(e, `${st(`red${e}` as Stat)} · ${st(`res${e}` as Stat)} %`, `Les dommages ${e} reçus perdent d'abord la résistance fixe, puis le pourcentage (50 % au plus)`)).join('')}
        </div>
        <div class="hint">Force : sorts Terre · Intelligence : Feu · Chance : Eau · Agilité : Air (+1 % de dommages par point). Vitalité : +1 PV. Sagesse : +1 % d'XP.</div>
      </div>`;
    w.querySelectorAll<HTMLElement>('[data-plus]').forEach(e => e.addEventListener('click', ev => {
      p.spendPoint(e.dataset.plus as Stat, ev.shiftKey ? Math.min(10, p.points) : 1); this.changed();
    }));
  }

  /** Fenêtre « Métiers » (choix 6A) : le Chasseur, son niveau, et ses recettes officielles faisables avec le butin du jeu. */
  private renderJob() {
    const w = this.win!, p = this.world.player, M = ITEMS.metiers ?? {}, R = ITEMS.recipes ?? [];
    const res = (id: string) => ITEMS.resources[id];
    const jobs = Object.entries(M).map(([k, m]) => {
      const st = p.metiers[k] ?? { level: 1, xp: 0 }, need = metierXpNeeded(st.level);
      const weapon = p.huntingWeapon
        ? `<div class="note ok">Arme de chasse en main : les monstres peuvent lâcher leurs viandes.</div>`
        : `<div class="note">Équipe une arme avec l'effet « Arme de chasse » (Couteau de Chasse, Arc de Chasse…) pour que les monstres lâchent leurs viandes.</div>`;
      const recs = R.map((r, i) => ({ r, i })).filter(({ r }) => r.metier === k).map(({ r, i }) => {
        const out = res(r.result), lvlOk = st.level >= r.level;
        const ok = lvlOk && r.ingredients.every(([id, q]) => (p.resources[id] ?? 0) >= q);
        const ings = r.ingredients.map(([id, q]) => { const have = p.resources[id] ?? 0;
          return `<span class="ing" title="${res(id)?.name ?? id}">${iconHtml(res(id)?.icon ?? 0)}<span class="${have >= q ? 'have' : 'lack'}">${have}/${q}</span> ${res(id)?.name ?? ''}</span>`; }).join('');
        return `<div class="rec">${iconHtml(out?.icon ?? 0)}<div><b>${out?.name ?? r.result}</b> <span class="hint">niveau ${r.level}${out?.soin ? ` · +${out.soin} PV` : ''}</span>
          ${lvlOk ? '' : `<div class="lack" style="font-size:12px">${M[k].name} niveau ${r.level} requis</div>`}<div class="ings">${ings}</div></div>
          <span class="btn ${ok ? '' : 'off'}" data-craft="${i}">Fabriquer</span></div>`;
      }).join('');
      return `<div class="mh"><img src="assets/ui/metier_${k}.png" alt=""><div><b>${m.name}</b> · niveau ${st.level}
        <div class="bar"><i style="width:${Math.round((st.xp / need) * 100)}%"></i></div><span class="hint">${st.xp} / ${need} XP · une viande ramassée ou une recette faite fait monter le métier</span></div></div>
        ${weapon}${recs}`;
    }).join('');
    w.innerHTML = `${this.title('Métiers', 'job')}<div class="in">${jobs || '<div class="hint">Aucun métier.</div>'}</div>`;
    w.querySelectorAll<HTMLElement>('[data-craft]').forEach(e => e.addEventListener('click', () => { this.world.craft(+e.dataset.craft!); this.changed(); }));
  }

  private changed() { this.hideTip(); this.render(); this.onChange(); }
  private flash(e: HTMLElement) { e.style.borderColor = '#e0625a'; }

  /** Contenu du sac selon l'onglet, la catégorie, le tri et la recherche ; les ressources s'empilent.
   *  La grille est complétée de cases vides, comme dans Dofus. */
  private cells(): { html: string; n: number } {
    const p = this.world.player, q = this.search.toLowerCase();
    const cells: string[] = [];
    if (this.tab === 'tout' || this.tab === 'equip') {
      const items = p.bag.filter(it => {
        const d = ITEMS.equipment[it.id];
        return d && (!this.kind || d.slot === this.kind) && (!q || d.name.toLowerCase().includes(q));
      });
      const D = (it: Item) => ITEMS.equipment[it.id];
      if (this.sort === 'niveau') items.sort((x, y) => D(y).level - D(x).level);
      if (this.sort === 'rarete') items.sort((x, y) => RARITY_ORDER[y.rarity] - RARITY_ORDER[x.rarity]);
      if (this.sort === 'nom') items.sort((x, y) => D(x).name.localeCompare(D(y).name));
      for (const it of items) {
        const d = D(it), slot = p.slotFor(it), cur = slot ? p.equipment[slot] : undefined;
        const up = d.level <= p.level && (!cur || this.score(it) > this.score(cur));
        cells.push(`<div class="cell ${up ? 'up' : ''} ${d.level > p.level ? 'low' : ''}" data-uid="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`);
      }
    }
    if ((this.tab === 'tout' || this.tab === 'ressource' || this.tab === 'conso') && !this.kind) for (const [id, n] of Object.entries(p.resources)) {
      const r = ITEMS.resources[id];
      if (!r || (q && !r.name.toLowerCase().includes(q))) continue;
      if (this.tab === 'conso' && !r.soin) continue;
      cells.push(`<div class="cell" data-res="${id}">${iconHtml(r.icon)}<span class="n">${n}</span></div>`);
    }
    const n = cells.length;
    for (let i = n; i < Math.max(35, Math.ceil(n / 5) * 5); i++) cells.push('<div class="cell empty"></div>');
    return { html: cells.join(''), n };
  }
  /** Note grossière d'un objet pour la flèche verte « meilleur que l'objet porté ». */
  private score(it: Item): number {
    let s = 0;
    for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) s += v * (k === 'vitalite' ? 0.5 : k === 'critique' ? 3 : k.startsWith('dommages') ? 4 : k === 'pa' || k === 'pm' ? 40 : 1);
    return s + (it.legendary ? 30 : 0) + (it.legendary2 ? 30 : 0);
  }

  private setsHtml(): string {
    const p = this.world.player, out: string[] = [];
    for (const [id, n] of Object.entries(p.setCount)) {
      const s = ITEMS.sets[id]; if (!s || n < 2) continue;
      const b = s.bonus[String(n - 1)] ?? {};
      out.push(`<div><b>${s.name}</b> (${n} / ${s.items.length}) · <span>${Object.entries(b).map(([k, v]) => `+${v} ${STAT_NAMES[k as Stat]}`).join(' · ')}</span></div>`);
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
    const weapon = (d.weapon ? `<div>${d.weapon.dmg.map(x => `${x.min}–${x.max} dommages ${x.element}`).join(' · ')}</div>` : '')
      + (d.chasse ? '<div class="ex">Arme de chasse</div>' : '');
    const leg = [it.legendary, it.legendary2].map(l => l ? `<div class="leg"><b>${LEGENDARY[l.id].name}</b> : ${LEGENDARY[l.id].text(l.value)}</div>` : '').join('');
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
  hideTip() { this.tip.style.display = 'none'; }
  /** Infobulle libre (sorts de la barre), au-dessus du point (x, y) de l'écran. */
  showHtmlTip(html: string, x: number, y: number) {
    const t = this.tip; t.innerHTML = html; t.style.display = 'block';
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
    t.style.top = `${Math.max(8, y - h - 12)}px`;
  }
}
