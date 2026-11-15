import { STATS, STAT_NAMES, type ItemsData, type Stat } from '../sim/items';
import { iconHtml } from './icons';

/** Panoplies de l'inventaire façon Dofus 3 (maquette « Panoplies : 1A 2A 3A 4A 5A 6A 7A », 2026-11-15) :
 *  bouton « panoplie » au coin du socle (pastille = panoplies actives), fiche au survol et fenêtre au clic,
 *  la même fiche en bas de l'infobulle des objets, éclat + message quand un palier est gagné.
 *  Rien ici ne modifie la partie : on lit `player.setCount` et l'équipement porté. */

type SetDef = ItemsData['sets'][string];
type Bonus = Partial<Record<Stat, number>>;

const C = 'assets/ui/d3/caracs';
/** Icône officielle de carac (fenêtre Caractéristiques de Dofus 3) ; les autres stats ont une puce. */
const ICONES: Partial<Record<Stat | 'dommages5', string>> = {
  force: 'tx_strength', agilite: 'tx_agility', chance: 'tx_chance', intelligence: 'tx_intelligence', vitalite: 'tx_vitality',
  sagesse: 'tx_wisdom', initiative: 'tx_initiative', pa: 'tx_actionPoints', pm: 'tx_movementPoints', critique: 'tx_crit',
  dommagesCritiques: 'tx_criticalDamage', soins: 'tx_heal', prospection: 'tx_prospecting', invocations: 'tx_summonableCreaturesBoost',
  tacle: 'tx_tackle', fuite: 'tx_escape', puissance: 'tx_multiElement', dommages: 'tx_damage', dommages5: 'tx_damage',
  dommagesNeutre: 'tx_damage', dommagesTerre: 'tx_damage', dommagesFeu: 'tx_damage', dommagesEau: 'tx_damage', dommagesAir: 'tx_damage',
};
const ELEMENTS: Stat[] = ['dommagesNeutre', 'dommagesTerre', 'dommagesFeu', 'dommagesEau', 'dommagesAir'];

/** Bonus d'une panoplie portée à n pièces (le premier palier officiel est à 2 pièces). */
export function bonusPalier(s: SetDef, n: number): Bonus {
  return n >= 2 ? (s.bonus[String(n - 1)] ?? {}) as Bonus : {};
}

/** Prochain nombre de pièces qui change les bonus (null si la panoplie est complète ou n'a plus de palier). */
export function palierSuivant(s: SetDef, n: number): number | null {
  for (let k = Math.max(2, n + 1); k <= s.items.length; k++) if (s.bonus[String(k - 1)]) return k;
  return null;
}

export interface LigneBonus { cle: string; v: number; texte: string; icone?: string }
/** Une ligne par carac (4A), dans l'ordre des stats ; les 5 dommages élémentaires égaux tiennent en une ligne. */
export function lignesBonus(b: Bonus): LigneBonus[] {
  const out: LigneBonus[] = [];
  const v0 = b[ELEMENTS[0]], groupe = v0 != null && ELEMENTS.every(k => b[k] === v0);
  for (const k of STATS) {
    const v = b[k]; if (v == null || v === 0) continue;
    if (groupe && ELEMENTS.includes(k)) {
      if (k === ELEMENTS[0]) out.push({ cle: 'dommages5', v, texte: 'Dommages (5 éléments)', icone: ICONES.dommages5 });
      continue;
    }
    out.push({ cle: k, v, texte: STAT_NAMES[k] ?? k, icone: ICONES[k] });
  }
  return out;
}

/** Panoplies dont au moins une pièce est portée, la plus avancée d'abord. */
export function panosPortees(setCount: Record<string, number>, items: ItemsData): [string, number][] {
  return Object.entries(setCount).filter(([id, n]) => n >= 1 && items.sets[id])
    .sort((a, b) => b[1] - a[1] || items.sets[a[0]].name.localeCompare(items.sets[b[0]].name));
}
/** Pastille du bouton : seulement les panoplies qui donnent un bonus (6A : une pièce seule ne compte pas). */
export const nbActives = (setCount: Record<string, number>) => Object.values(setCount).filter(n => n >= 2).length;

/** 7A : paliers gagnés entre deux états (panoplies passées à un nombre de pièces qui a des bonus). */
export function paliersGagnes(avant: Record<string, number>, apres: Record<string, number>, items: ItemsData): [string, number][] {
  return Object.entries(apres).filter(([id, n]) => n > (avant[id] ?? 0) && n >= 2 && items.sets[id]?.bonus[String(n - 1)]);
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ligne = (l: LigneBonus) => `<div class="pst">${l.icone ? `<img src="${C}/${l.icone}.png" alt="">` : '<i></i>'}<b>${l.v > 0 ? '+' : ''}${l.v}</b> ${esc(l.texte)}</div>`;

/** Fiche d'une panoplie (2A 3A 4A) : pièces portées / manquantes, bonus actifs, palier suivant en grisé. */
export function ficheHtml(id: string, n: number, portes: Set<string>, items: ItemsData): string {
  const s = items.sets[id]; if (!s) return '';
  const pieces = s.items.map(i => {
    const d = items.equipment[String(i)]; if (!d) return '';
    const ok = portes.has(String(i));
    return `<span class="ppc ${ok ? '' : 'off'}" title="${esc(d.name)}${ok ? '' : ' (pas portée)'}">${iconHtml(d.icon)}</span>`;
  }).join('');
  const act = lignesBonus(bonusPalier(s, n)), k = palierSuivant(s, n);
  const actifs = act.length ? `<div class="pbl"><span class="plb">Bonus actifs · ${n} pièces</span>${act.map(ligne).join('')}</div>` : '';
  const suiv = k ? `<div class="pbl nx"><span class="plb">Avec ${k} pièces</span>${lignesBonus(bonusPalier(s, k)).map(ligne).join('')}</div>`
    : n >= s.items.length ? '<div class="plb ok">Panoplie complète</div>' : '';
  return `<div class="pfi${n < 2 ? ' seule' : ''}"><div class="pfh"><span class="pico"></span><b>${esc(s.name)}</b><span class="pcpt">${n} / ${s.items.length}</span></div>
    <div class="ppcs">${pieces}</div>${actifs}${suiv}</div>`;
}

/** Toutes les panoplies portées, pour l'infobulle du bouton et la fenêtre. */
export function fichesPortees(setCount: Record<string, number>, portes: Set<string>, items: ItemsData): string {
  const l = panosPortees(setCount, items);
  return l.length ? l.map(([id, n]) => ficheHtml(id, n, portes, items)).join('') : '<div class="plb">Aucune pièce de panoplie portée.</div>';
}

export const PANOPLIE_CSS = `
.dw .pico{display:inline-block;width:18px;height:18px;flex:none;background:#c4e35a;-webkit-mask:url(assets/ui/d3/panoplie.png) center/contain no-repeat;mask:url(assets/ui/d3/panoplie.png) center/contain no-repeat}
.dw .pano-btn{position:absolute;left:6px;bottom:44px;z-index:3;width:40px;height:40px;border-radius:6px;border:1px solid #6a7b38;background:linear-gradient(#3b4521,#262c17);display:grid;place-items:center;cursor:pointer;box-shadow:0 0 0 2px #0008,0 0 10px #c4e35a44}
.dw .pano-btn:hover,.dw .pano-btn.on{border-color:#c4e35a;box-shadow:0 0 0 2px #0008,0 0 14px #c4e35a99}
.dw .pano-btn .pico{width:24px;height:24px}
.dw .pano-btn em{position:absolute;right:-6px;top:-6px;font:bold 11px/18px Lexend,sans-serif;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#c4e35a;color:#1b2109;font-style:normal;text-align:center}
.dw .pano-btn.eclat{animation:panoEclat 1.2s ease-out 2}
@keyframes panoEclat{0%{box-shadow:0 0 0 2px #0008,0 0 0 #ffd86a}40%{box-shadow:0 0 0 2px #0008,0 0 26px 8px #ffd86a}100%{box-shadow:0 0 0 2px #0008,0 0 10px #c4e35a44}}
.dw .pano-msg{position:absolute;left:52px;white-space:nowrap;bottom:52px;z-index:3;font-size:12px;color:#ffd86a;text-shadow:0 1px 3px #000;pointer-events:none;animation:panoMsg 4s ease-out forwards}
@keyframes panoMsg{0%,75%{opacity:1}100%{opacity:0}}
.dw .pano-fen{position:absolute;left:10px;right:10px;top:34px;bottom:96px;z-index:4;background:#10130d;border:1px solid #4b5536;border-radius:6px;box-shadow:0 8px 24px #000a;display:grid;grid-template-rows:auto minmax(0,1fr)}
.dw .pano-fen .pano-hd{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #353c28;font-weight:bold;color:#f4efe0}
.dw .pano-fen .pano-hd span:not(.pico){flex:1}.dw .pano-fen .pano-hd b{cursor:pointer;font-size:18px;line-height:1;color:#c9c4ab}.dw .pano-fen .pano-hd b:hover{color:#b9e54b}
.dw .pano-fen .pfc{overflow:auto;padding:8px 10px;display:grid;gap:10px;align-content:start}
.dw .pfi{display:grid;gap:6px}
.dw .pfi+.pfi{border-top:1px solid #353c28;padding-top:9px}
.dw .pfi.seule{opacity:.7}
.dw .pfh{display:flex;align-items:center;gap:7px;font-size:13px}
.dw .pfh b{color:#c4e35a;flex:1;min-width:0}
.dw .pcpt{font-size:12px;color:#f4efe0;background:#2b3220;border:1px solid #4b5536;border-radius:10px;padding:0 7px;white-space:nowrap}
.dw .ppcs{display:flex;gap:4px;flex-wrap:wrap}
.dw .ppc{width:32px;height:32px;display:grid;place-items:center;background:url(assets/ui/d3/slot_dark_background_full.png) center/100%;border:1px solid #5a6a2a;border-radius:3px}
.dw .ppc .ic{width:28px;height:28px}
.dw .ppc.off{border-color:#2d3222}.dw .ppc.off .ic{filter:grayscale(1) brightness(.45)}
.dw .pbl{display:grid;gap:1px}
.dw .plb{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#9b9a86;margin-bottom:2px}
.dw .plb.ok{color:#c4e35a}
.dw .pst{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#f4efe0}
.dw .pst img{width:17px;height:17px}.dw .pst i{width:17px;height:17px;display:grid;place-items:center}.dw .pst i::before{content:'';width:5px;height:5px;border-radius:50%;background:#9b9a86}
.dw .pst b{color:#c4e35a;min-width:30px}
.dw .nx .pst,.dw .nx .pst b{color:#8a8978}.dw .nx .pst img{opacity:.5}
.dw .tip .pfi{border-top:1px solid #3a3a2c;margin-top:6px;padding-top:7px}
.dw .tip .pfs .pfi:first-child{border-top:0;margin-top:0;padding-top:0}.dw .tip .pfs+.hint{border-top:1px solid #3a3a2c;padding-top:5px}
`;
