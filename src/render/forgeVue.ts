import { ITEMS } from '../sim/data';
import { chanceRune, coutKamas, FUSION_N, fusionVers, lignes, poidsBrisage, RUNES } from '../sim/forgemagie';
import { RARITIES, RARITY_COLORS, RARITY_NAMES, STAT_NAMES, type Item, type Rarity, type Stat } from '../sim/items';
import type { World } from '../sim/world';
import { iconHtml } from './icons';

/** Fenêtre du forgemage (maquette « Forgemagie » 8A+8B+8D) : l'objet et ses lignes (barre min, max, overmax), tes runes avec
 *  leur chance et leur prix, le puits, le mode « viser » ; onglets Brisage (7A+7B, 11B) et Fusion (6D). */
export type OngletForge = 'forge' | 'brisage' | 'fusion';
export interface EtatForge { onglet: OngletForge; uid: number | null; log: { t: string; c: string }[]; vstat: Stat | ''; vcible: number }
export const etatForge = (): EtatForge => ({ onglet: 'forge', uid: null, log: [], vstat: '', vcible: 0 });

export const FORGE_CSS = `
.dw .win.forge{width:min(980px,96vw);height:min(680px,92vh)}
.dw .fm .fmg{display:grid;grid-template-columns:150px minmax(0,1fr) minmax(0,300px);gap:12px;min-height:0}
.dw .fm .fml{display:grid;grid-template-columns:repeat(2,62px);grid-auto-rows:62px;gap:6px;align-content:start;max-height:440px;overflow:auto}
.dw .fm .fml .cell.on{outline:2px solid #b9e54b;outline-offset:-2px}
.dw .fm .fml .t{grid-column:1/-1;height:auto;color:#c9a55a;font-size:11px;text-transform:uppercase;letter-spacing:.06em;align-self:end}
.dw .fm .fmc{display:grid;gap:8px;align-content:start;min-width:0}
.dw .fm .fmo{display:flex;gap:10px;align-items:center}.dw .fm .fmo .ic{width:52px;height:52px}.dw .fm .fmo b{font-size:16px}
.dw .fm .lig{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;align-items:center;padding:5px 8px;background:#2a2925;border:1px solid #3d3b34;border-radius:3px}
.dw .fm .lig .nm{font-weight:bold;font-size:13px}.dw .fm .lig .nm small{font-weight:normal;color:#8f8a73;margin-left:6px;font-size:11px}
.dw .fm .lig .v{font-weight:bold;font-size:16px;color:#f4efe0}
.dw .fm .lig.ex .nm{color:#6fb2e8}.dw .fm .lig.exo .nm{color:#f08a2c}.dw .fm .lig.sans{opacity:.55}
.dw .fm .bar{grid-column:1/-1;position:relative;height:6px;background:#161613;border-radius:3px;overflow:hidden}
.dw .fm .bar i{position:absolute;inset:0 auto 0 0;background:#b9e54b;border-radius:3px}.dw .fm .bar i.over{background:#f08a2c}
.dw .fm .bar b{position:absolute;top:-1px;bottom:-1px;width:2px;background:#f4efe0aa}
.dw .fm .puits{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#1f2a33;border:1px solid #33506b;border-radius:3px}
.dw .fm .puits b{color:#7cc4ff;font-size:17px}
.dw .fm .vis{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dw .fm .vis select,.dw .fm .vis input{width:auto}.dw .fm .vis input{width:64px}
.dw .fm .fmr{display:grid;gap:5px;align-content:start;max-height:440px;overflow:auto}
.dw .fm .rn{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:2px 8px;align-items:center;padding:4px 8px;background:#2a2925;border:1px solid #45433b;border-radius:3px;cursor:pointer}
.dw .fm .rn:hover{border-color:#b9e54b}.dw .fm .rn.off{opacity:.4;cursor:default}.dw .fm .rn.off:hover{border-color:#45433b}
.dw .fm .rn .ic{width:32px;height:32px;grid-row:span 2}.dw .fm .rn b{font-size:12.5px}.dw .fm .rn .n{color:#e6b85c;font-weight:bold}
.dw .fm .rn .p{font-weight:bold;color:#b9e54b;text-align:right}.dw .fm .rn .p.bas{color:#e0625a}.dw .fm .rn .p.sur{color:#7cc4ff}
.dw .fm .rn small{color:#8f8a73;font-size:11px}
.dw .fm .log{display:grid;gap:2px;font-size:12px;max-height:110px;overflow:auto;border-top:1px solid #34322b;padding-top:6px}
.dw .fm .log .ok{color:#7be07b}.dw .fm .log .ne{color:#e6b85c}.dw .fm .log .ko{color:#e0625a}.dw .fm .log .pu{color:#7cc4ff}.dw .fm .log .br{color:#b77cf0}
.dw .fm .fus{display:grid;gap:6px}.dw .fm .fus .rec{display:grid;grid-template-columns:34px minmax(0,1fr) 20px 34px minmax(0,1fr) auto auto;gap:8px;align-items:center}
.dw .fm .fus .ic{width:32px;height:32px}
@media (max-width:760px){.dw .fm .fmg{grid-template-columns:1fr}.dw .fm .fml{grid-template-columns:repeat(auto-fill,62px)}}
`;

const nomR = (id: string) => ITEMS.resources[id]?.name ?? 'Rune';
const icR = (id: string) => iconHtml(ITEMS.resources[id]?.icon ?? 0);
const fr = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');

/** Objets qu'on peut forgemager : ceux portés puis ceux du sac (pas les familiers). */
export function objetsForge(world: World): { portes: Item[]; sac: Item[] } {
  const p = world.player, ok = (it?: Item) => !!it && !!ITEMS.equipment[it.id] && !ITEMS.equipment[it.id].familier;
  return { portes: Object.values(p.equipment).filter(ok) as Item[], sac: p.bag.filter(ok) };
}

/** Une ligne de log pour un évènement de la partie (render/zoneScene la passe à la fenêtre). */
export function texteForge(e: { issue: string; stat: string; gain: number; pertes: [string, number][]; rune: string; kamas: number }): { t: string; c: string } {
  const st = (s: string) => STAT_NAMES[s as Stat] ?? s, pertes = e.pertes.map(([s, n]) => `−${n} ${st(s)}`).join(', ');
  if (e.issue === 'echec') return { t: `${nomR(e.rune)} : échec${pertes ? `, ${pertes}` : ''}`, c: 'ko' };
  if (e.issue === 'puits') return { t: `${nomR(e.rune)} : +${e.gain} ${st(e.stat)}, payé par le puits`, c: 'pu' };
  if (e.issue === 'neutre') return { t: `${nomR(e.rune)} : +${e.gain} ${st(e.stat)}${pertes ? `, mais ${pertes}` : ', le puits a payé'}`, c: 'ne' };
  return { t: `${nomR(e.rune)} : succès critique, +${e.gain} ${st(e.stat)}`, c: 'ok' };
}

export function forgeHtml(world: World, e: EtatForge): string {
  const p = world.player;
  const onglet = (k: OngletForge, n: string) => `<span class="eo ${e.onglet === k ? 'on' : ''}" data-fo="${k}">${n}</span>`;
  const tete = `<div class="eh"><div class="eos">${onglet('forge', 'Forgemagie')}${onglet('brisage', 'Brisage')}${onglet('fusion', 'Fusion')}</div>
    <span class="k" title="Kamas">${p.kamas.toLocaleString('fr-FR')} kamas</span></div>`;
  const log = e.log.length ? `<div class="log">${e.log.map(l => `<div class="${l.c}">${l.t}</div>`).join('')}</div>` : '';
  if (e.onglet === 'brisage') return tete + brisageHtml(world) + log;
  if (e.onglet === 'fusion') return tete + fusionHtml(world) + log;

  const { portes, sac } = objetsForge(world), tous = [...portes, ...sac];
  if (e.uid == null || !tous.some(it => it.uid === e.uid)) e.uid = tous[0]?.uid ?? null;
  const cell = (it: Item) => `<div class="cell ${it.uid === e.uid ? 'on' : ''}" data-fuid="${it.uid}">${iconHtml(ITEMS.equipment[it.id].icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`;
  const liste = `<div class="fml">${portes.length ? `<div class="t">Portés</div>${portes.map(cell).join('')}` : ''}${sac.length ? `<div class="t">Sac</div>${sac.map(cell).join('')}` : ''}${tous.length ? '' : '<div class="t">Aucun objet</div>'}</div>`;
  const it = tous.find(x => x.uid === e.uid);
  if (!it) return tete + `<div class="fmg">${liste}<div class="hint">Équipe ou ramasse un objet pour le forgemager.</div><div></div></div>` + log;
  const def = ITEMS.equipment[it.id], L = lignes(def, it);
  const lig = L.map(l => {
    const top = Math.max(l.cap, l.max, l.v, 1), w = Math.min(100, l.v / top * 100), mk = l.max / top * 100;
    const lim = !l.rune ? 'sans rune' : l.exo ? 'ligne ajoutée' : `jusqu'à ${l.max}${l.cap > l.max ? ` · overmax ${l.cap}` : ''}`;
    return `<div class="lig ${l.extra ? 'ex' : ''} ${l.exo ? 'exo' : ''} ${l.rune ? '' : 'sans'}"><span class="nm">${STAT_NAMES[l.s]}<small>${lim}</small></span><span class="v">${l.v}</span>
      <span class="bar"><i class="${l.v > l.max ? 'over' : ''}" style="width:${w}%"></i><b style="left:${mk}%"></b></span></div>`;
  }).join('');
  // runes du sac utiles à cet objet : ses lignes, et une ligne nouvelle si l'objet l'autorise (4B)
  const runes = Object.keys(p.resources).filter(id => RUNES[id] && p.resources[id] > 0)
    .map(id => ({ id, c: chanceRune(def, it, id) }))
    .filter(x => !('refus' in x.c) || x.c.refus === 'plafond' || L.some(l => l.s === RUNES[x.id].stat))
    .sort((a, b) => RUNES[a.id].stat.localeCompare(RUNES[b.id].stat) || RUNES[a.id].val - RUNES[b.id].val);
  const rn = runes.map(({ id, c }) => {
    const k = coutKamas(def, id), ok = !('refus' in c) && p.kamas >= k;
    const ptxt = 'refus' in c ? (c.refus === 'plafond' ? 'plafond' : 'non') : c.certain ? '100 %' : `${Math.round(c.p * 100)} %`;
    const cls = 'refus' in c ? '' : c.certain ? 'sur' : c.p < 0.3 ? 'bas' : '';
    return `<div class="rn ${ok ? '' : 'off'}" data-frune="${id}" title="+${RUNES[id].val} ${STAT_NAMES[RUNES[id].stat]} · poids ${fr(RUNES[id].poids)}">${icR(id)}
      <b>${nomR(id)} <span class="n">×${p.resources[id]}</span></b><span class="p ${cls}">${ptxt}</span><small>+${RUNES[id].val} ${STAT_NAMES[RUNES[id].stat]}</small><small>${k} kamas</small></div>`;
  }).join('');
  const visables = L.filter(l => l.rune && l.v < l.cap);
  if (!e.vstat || !visables.some(l => l.s === e.vstat)) e.vstat = visables[0]?.s ?? '';
  const lv = L.find(l => l.s === e.vstat);
  if (lv && (e.vcible <= lv.v || e.vcible > lv.cap)) e.vcible = Math.min(lv.cap, Math.max(lv.v + 1, lv.max));
  const viser = visables.length ? `<div class="vis"><span class="hint">Viser</span><select data-vstat>${visables.map(l => `<option value="${l.s}" ${l.s === e.vstat ? 'selected' : ''}>${STAT_NAMES[l.s]}</option>`).join('')}</select>
    <input type="number" data-vcible min="${(lv?.v ?? 0) + 1}" max="${lv?.cap ?? 0}" value="${e.vcible}"><span class="btn" data-viser>Le forgemage pose tes runes</span>
    <span class="hint">+50 % de kamas par essai (sa commission)</span></div>` : '';
  const centre = `<div class="fmc"><div class="fmo">${iconHtml(def.icon)}<div><b style="color:${RARITY_COLORS[it.rarity]}">${def.name}</b><div class="hint">${RARITY_NAMES[it.rarity]} · niveau ${def.level}${it.legendary ? ' · pouvoir légendaire intouchable' : ''}</div></div></div>
    ${lig}<div class="puits"><span>Puits <span class="hint">poids gardé de côté : une rune qu'il couvre passe à coup sûr</span></span><b>${fr(it.puits ?? 0)}</b></div>${viser}</div>`;
  const droite = `<div class="fmr">${rn || `<div class="hint">Aucune rune pour cet objet. Brise des objets (onglet Brisage) pour en obtenir.</div>`}</div>`;
  return tete + `<div class="fmg">${liste}${centre}${droite}</div>` + log;
}

function brisageHtml(world: World): string {
  const p = world.player, I = ITEMS;
  const lots: [Rarity, string][] = [['commun', 'Tout le Commun'], ['rare', 'Commun et Rare'], ['epique', 'Tout sauf Légendaire']];
  const lotsHtml = lots.map(([r, n]) => {
    const l = p.bag.filter(it => I.equipment[it.id] && !I.equipment[it.id].familier && !it.cadenas && RARITIES.indexOf(it.rarity) <= RARITIES.indexOf(r));
    return `<span class="btn ${l.length ? '' : 'off'}" data-blot="${r}">${n}<small>${l.length} objet${l.length > 1 ? 's' : ''}</small></span>`;
  }).join('');
  const objets = p.bag.filter(it => I.equipment[it.id] && !I.equipment[it.id].familier).map(it => { const d = I.equipment[it.id];
    return `<div class="cell ${it.cadenas ? 'verrou' : ''}" data-buid="${it.uid}" title="poids rendu ≈ ${fr(poidsBrisage(d, it))}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i>${it.cadenas ? '' : `<span class="pv">${fr(poidsBrisage(d, it))}</span>`}</div>`; }).join('');
  return `<div class="lots">${lotsHtml}</div>
    <div class="hint">Clic : briser l'objet en runes officielles · Ctrl + clic (ou clic droit) : cadenas. Le chiffre est le poids de runes rendu ; une rareté haute rend plus (×1,5 Rare, ×2 Épique, ×3 Légendaire, ×4 Mythique). Les Pépites, c'est chez Kerubim.</div>
    <div class="grid eg">${objets || '<div class="hint">Ton sac est vide.</div>'}</div>`;
}

function fusionHtml(world: World): string {
  const p = world.player;
  const l = Object.keys(p.resources).filter(id => RUNES[id] && fusionVers(id)).sort((a, b) => RUNES[a].stat.localeCompare(RUNES[b].stat) || RUNES[a].val - RUNES[b].val);
  const rows = l.map(id => { const v = fusionVers(id)!, n = p.resources[id], k = Math.floor(n / FUSION_N);
    return `<div class="rec">${icR(id)}<div><b>${nomR(id)}</b> <span class="hint">× ${n}</span></div><span>→</span>${icR(v)}<div><b>${nomR(v)}</b> <span class="hint">${k ? `${k} possible${k > 1 ? 's' : ''}` : `il en faut ${FUSION_N}`}</span></div>
      <span class="btn ${k ? '' : 'off'}" data-fus="${id}">Fusionner ${FUSION_N}</span><span class="btn ${k > 1 ? '' : 'off'}" data-fust="${id}">Tout</span></div>`; }).join('');
  return `<div class="hint">${FUSION_N} runes d'un palier donnent une rune du palier suivant (Fo → Pa Fo → Ra Fo).</div><div class="fus">${rows || '<div class="hint">Aucune rune à fusionner.</div>'}</div>`;
}
