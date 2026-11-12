import { ITEMS } from '../sim/data';
import { apercuBrisage, chanceRune, coutKamas, exoPossible, FUSION_N, fusionVers, lignes, RUNES, runesDe, SIGNATURE, type Commande, type Estimation, type FinCommande } from '../sim/forgemagie';
import { kamasDefaire, RARITIES, RARITY_COLORS, RARITY_NAMES, STAT_NAMES, type Item, type Rarity, type Stat } from '../sim/items';
import { nouveauPourCodex } from '../sim/codex';
import type { World } from '../sim/world';
import { iconHtml } from './icons';
import { codexOngletHtml, type EtatCodex } from './codexVue';

/** Fenêtre de forgemagie façon Dofus 3 (maquette « Forgemagie UI : 1B 2A 4A+4B+4C 5A 6A 7A 8A 9A+9B+9C+9D+9E », Mathis 2026-11-08).
 *  Onglet Forgemagie : cases Objet, Rune et Signature, bouton Fusionner et mode avancé (2A) ; lignes Effet, Valeur, Jet avec l'œil,
 *  les barres et les runes de la ligne au bout (4A+4B+4C) ; historique avec l'icône de la rune (5A). Onglet Malek : la commande
 *  (objectifs, planchers, budget, estimation, objet confié). Onglet Fusion (6D). */
export type OngletForge = 'forge' | 'malek' | 'fusion' | 'codex';
export interface LigneLog { t: string; c: string; ic?: string }
export interface EtatForge {
  onglet: OngletForge; uid: number | null; rune: string | null; avance: boolean; caches: Stat[]; log: LigneLog[];
  cmd: Commande; cmdUid: number | null; estim: Estimation | null; brise: number[];
  /** Onglet Codex (0.3) : objet et pouvoir choisis. */
  codex: EtatCodex;
}
export const etatForge = (): EtatForge => ({ onglet: 'forge', uid: null, rune: null, avance: false, caches: [], log: [],
  cmd: { objectifs: {}, planchers: {}, budget: 1000 }, cmdUid: null, estim: null, brise: [], codex: { uid: null, entree: null } });

const D3 = 'assets/ui/d3';
export const FORGE_CSS = `
.dw .win.forge{width:min(1080px,96vw);height:min(700px,92vh)}
.dw .fm .fmg{display:grid;grid-template-columns:140px minmax(0,1fr) minmax(0,250px);gap:12px;min-height:0}
.dw .fm .fml{display:grid;grid-template-columns:repeat(2,58px);grid-auto-rows:58px;gap:6px;align-content:start;max-height:520px;overflow:auto}
.dw .fm .fml .cell.on{outline:2px solid #b9e54b;outline-offset:-2px}
.dw .fm .fml .t{grid-column:1/-1;height:auto;color:#c9a55a;font-size:11px;text-transform:uppercase;letter-spacing:.06em;align-self:end}
.dw .fm .fmc{display:grid;gap:8px;align-content:start;min-width:0}
.dw .fm .fsl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:16px}
.dw .fm .fs{width:56px;height:56px;display:grid;place-items:center;background:url(${D3}/slot_dark_background_full.png) center/100% 100%;border-radius:4px;position:relative}
.dw .fm .fs.vide{background-image:url(${D3}/slot_dark_background_empty.png)}
.dw .fm .fs .ic{width:44px;height:44px}.dw .fm .fs img.v{width:32px;height:32px;opacity:.7;border-radius:4px}
.dw .fm .fs small{position:absolute;bottom:-16px;left:-6px;right:-6px;text-align:center;font-size:10.5px;color:#a9a48f}
.dw .fm .fs.on{outline:2px solid #b9e54b;outline-offset:-2px}.dw .fm .fs[data-fsigne]{cursor:pointer}
.dw .fm .fs.signe::after{content:'✓';position:absolute;right:3px;top:1px;color:#b9e54b;font-weight:bold;font-size:12px}
.dw .fm .bv{border:6px solid transparent;border-image:url(${D3}/btn_green_normal.png) 8 fill/6px;color:#1e2a05;text-shadow:0 1px 0 #e8ff7a;padding:1px 12px;font:400 13px Rowdies,Lexend,sans-serif;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.dw .fm .bv:hover{border-image-source:url(${D3}/btn_green_over.png)}.dw .fm .bv.off{filter:grayscale(1);opacity:.45;cursor:default}
.dw .fm .fob{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dw .fm .fob .ic{width:40px;height:40px}.dw .fm .fob b{font-size:15px}
.dw .fm .ft{width:100%;border-collapse:collapse;font-size:13px}
.dw .fm .ft th{font:600 11px Lexend,sans-serif;color:#c9a55a;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:3px 6px;border-bottom:1px solid #45433b}
.dw .fm .ft td{padding:5px 6px;border-bottom:1px solid #34322b;vertical-align:middle}
.dw .fm .ft td.v{font-weight:bold;font-size:15px;text-align:right;width:44px;color:#f4efe0}
.dw .fm .ft td.j{color:#a9a48f;white-space:nowrap;font-size:12px}.dw .fm .ft td.j small{display:block;color:#f08a2c;font-size:10.5px}
.dw .fm .ft tr.zero td{color:#6d6a5d}.dw .fm .ft tr.zero td.v{color:#6d6a5d}.dw .fm .ft tr.over td.v{color:#f08a2c}
.dw .fm .ft tr.ex td.e{color:#6fb2e8}.dw .fm .ft tr.exo td.e{color:#d68cff}.dw .fm .ft tr.cache td{opacity:.35}.dw .fm .ft tr.sans td.e{color:#8f8a73}
.dw .fm .nlx{display:grid;gap:5px}.dw .fm .nlx .ent{color:#d68cff}.dw .fm .nlx .rr{justify-content:flex-start}
.dw .fm .oe{width:18px;cursor:pointer;opacity:.75;text-align:center}.dw .fm .oe:hover{opacity:1}
.dw .fm .bar{position:relative;height:5px;background:#161613;border-radius:3px;overflow:hidden;margin-top:4px}
.dw .fm .bar i{position:absolute;inset:0 auto 0 0;background:#b9e54b;border-radius:3px}.dw .fm .bar i.over{background:#f08a2c}
.dw .fm .bar b{position:absolute;top:-1px;bottom:-1px;width:2px;background:#f4efe0aa}
.dw .fm .rr{display:flex;gap:3px;justify-content:flex-end;flex-wrap:wrap}
.dw .fm .rc{width:38px;height:38px;display:grid;place-items:center;background:url(${D3}/slot_dark_background_full.png) center/100% 100%;border-radius:3px;position:relative;cursor:pointer;border:1px solid transparent}
.dw .fm .rc:hover,.dw .fm .rc.on{border-color:#b9e54b}.dw .fm .rc.off{opacity:.35;cursor:default}.dw .fm .rc.off:hover{border-color:transparent}
.dw .fm .rc .ic{width:28px;height:28px}
.dw .fm .rc .n{position:absolute;left:2px;top:0;font-size:10px;font-weight:bold;text-shadow:0 0 3px #000}
.dw .fm .rc .p{position:absolute;right:2px;bottom:0;font-size:9.5px;font-weight:bold;color:#b9e54b;text-shadow:0 0 3px #000}
.dw .fm .rc .p.bas{color:#e0625a}.dw .fm .rc .p.sur{color:#7cc4ff}.dw .fm .rc .p.non{color:#8f8a73}
.dw .fm .puits{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#1f2a33;border:1px solid #33506b;border-radius:3px}
.dw .fm .puits b{color:#7cc4ff;font-size:17px}
.dw .fm .fmr{display:grid;gap:8px;align-content:start;min-width:0}
.dw .fm .ent{font:600 11px Lexend,sans-serif;color:#c9a55a;text-transform:uppercase;letter-spacing:.06em}
.dw .fm .hist{display:grid;gap:3px;font-size:12px;max-height:330px;overflow:auto;background:#141412aa;border:1px solid #34322b;border-radius:3px;padding:6px;align-content:start}
.dw .fm .hist div{display:flex;gap:6px;align-items:center}.dw .fm .hist .ic{width:20px;height:20px;flex:none}
.dw .fm .ok{color:#7be07b}.dw .fm .ne{color:#e6b85c}.dw .fm .ko{color:#e0625a}.dw .fm .pu{color:#7cc4ff}.dw .fm .br{color:#b77cf0}.dw .fm .xo{color:#d68cff}
.dw .fm .mk{display:grid;gap:10px;align-content:start;min-width:0}
.dw .fm .mkd{background:#141412cc;border:1px solid #45433b;border-left:3px solid #c9a55a;border-radius:3px;padding:8px 10px;font-size:13px}.dw .fm .mkd b{color:#c9a55a}
.dw .fm .ft input{width:60px}
.dw .fm .mkr{display:grid;gap:3px;font-size:12.5px;background:#141412aa;border:1px solid #34322b;border-radius:3px;padding:8px 10px}.dw .fm .mkr b{color:#b9e54b}
.dw .fm .mkb{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dw .fm .mkb input{width:90px}
.dw .fm .cz{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;min-height:0}
.dw .fm .czg{display:grid;gap:8px;align-content:start}
.dw .fm .czt{display:flex;gap:12px;align-items:center}.dw .fm .czt img{height:120px;border-radius:4px}
.dw .fm .czs{display:grid;grid-template-columns:repeat(auto-fill,52px);grid-auto-rows:52px;gap:5px;min-height:110px;padding:6px;background:#141412aa;border:1px dashed #45433b;border-radius:3px;align-content:start}
.dw .fm .czr{display:flex;gap:6px;flex-wrap:wrap}
.dw .fm .czr span{display:flex;gap:4px;align-items:center;font-size:12px;background:#2a2925;border:1px solid #45433b;border-radius:3px;padding:2px 6px}.dw .fm .czr .ic{width:22px;height:22px}
.dw .fm .eg .cell.on{outline:2px solid #b9e54b;outline-offset:-2px}
.dw .fm .fus{display:grid;gap:6px}.dw .fm .fus .rec{display:grid;grid-template-columns:34px minmax(0,1fr) 20px 34px minmax(0,1fr) auto auto;gap:8px;align-items:center}
.dw .fm .fus .ic{width:32px;height:32px}
@media (max-width:820px){.dw .fm .fmg{grid-template-columns:1fr}.dw .fm .fml{grid-template-columns:repeat(auto-fill,58px)}.dw .fm .cz{grid-template-columns:1fr}}
`;

const nomR = (id: string) => ITEMS.resources[id]?.name ?? 'Rune';
const icR = (id: string) => iconHtml(ITEMS.resources[id]?.icon ?? 0);
const fr = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');
const pc = (x: number) => `${Math.round(x * 100)} %`;
export const mmss = (s: number) => { const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/** Objets qu'on peut forgemager : ceux portés puis ceux du sac (pas les familiers). */
export function objetsForge(world: World): { portes: Item[]; sac: Item[] } {
  const p = world.player, ok = (it?: Item) => !!it && !!ITEMS.equipment[it.id] && !ITEMS.equipment[it.id].familier;
  return { portes: Object.values(p.equipment).filter(ok) as Item[], sac: p.bag.filter(ok) };
}

/** Une ligne d'historique pour un essai (5A) : l'icône de la rune et la couleur de l'issue (critique, neutre, échec, puits, exo). */
export function texteForge(e: { issue: string; stat: string; gain: number; pertes: [string, number][]; rune: string; kamas: number; exo?: boolean }): LigneLog {
  const st = (s: string) => STAT_NAMES[s as Stat] ?? s, pertes = e.pertes.map(([s, n]) => `−${n} ${st(s)}`).join(', ');
  const ic = e.rune;
  if (e.issue === 'echec') return { t: `Échec${pertes ? ` : ${pertes}` : ''}`, c: 'ko', ic };
  const gain = `+${e.gain} ${st(e.stat)}`, c = e.exo ? 'xo' : '';
  if (e.issue === 'puits') return { t: `${gain} (puits)`, c: c || 'pu', ic };
  if (e.issue === 'neutre') return { t: `Succès neutre : ${gain}${pertes ? `, ${pertes}` : ', payé par le puits'}`, c: c || 'ne', ic };
  return { t: `Succès critique : ${gain}`, c: c || 'ok', ic };
}

const liste = (world: World, uid: number | null, tag = 'fuid') => {
  const { portes, sac } = objetsForge(world), tous = [...portes, ...sac];
  const cell = (it: Item) => `<div class="cell ${it.uid === uid ? 'on' : ''}" data-${tag}="${it.uid}">${iconHtml(ITEMS.equipment[it.id].icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`;
  return { tous, html: `<div class="fml">${portes.length ? `<div class="t">Portés</div>${portes.map(cell).join('')}` : ''}${sac.length ? `<div class="t">Sac</div>${sac.map(cell).join('')}` : ''}${tous.length ? '' : '<div class="t">Aucun objet</div>'}</div>` };
};

export function forgeHtml(world: World, e: EtatForge): string {
  const p = world.player;
  const onglet = (k: OngletForge, n: string) => `<span class="eo ${e.onglet === k ? 'on' : ''}" data-fo="${k}">${n}</span>`;
  const c = p.commandeFM, malek = c ? (c.prete ? 'Malek ✓' : `Malek · ${mmss(c.reste)}`) : 'Commande à Malek';
  const tete = `<div class="eh"><div class="eos">${onglet('forge', 'Forgemagie')}${onglet('malek', malek)}${onglet('fusion', 'Fusion')}${p.v03 && p.codexOuvert ? onglet('codex', `Codex · ${p.codex.length}`) : ''}</div>
    <span class="k" title="Kamas">${p.kamas.toLocaleString('fr-FR')} kamas</span></div>`;
  if (e.onglet === 'fusion') return tete + fusionHtml(world);
  if (e.onglet === 'codex' && p.v03 && p.codexOuvert) return tete + codexOngletHtml(world, e.codex);
  if (e.onglet === 'malek') return tete + malekHtml(world, e);
  return tete + forgeOngletHtml(world, e);
}

function historique(e: EtatForge): string {
  return `<span class="ent">Historique</span><div class="hist">${e.log.length ? e.log.map(l => `<div class="${l.c}">${l.ic ? icR(l.ic) : ''}<span>${l.t}</span></div>`).join('') : '<div class="hint">Les essais s\'affichent ici.</div>'}</div>`;
}

function forgeOngletHtml(world: World, e: EtatForge): string {
  const p = world.player, L0 = liste(world, e.uid);
  if (e.uid == null || !L0.tous.some(it => it.uid === e.uid)) e.uid = L0.tous[0]?.uid ?? null;
  const L1 = liste(world, e.uid), it = L1.tous.find(x => x.uid === e.uid);
  if (!it) return `<div class="fmg">${L1.html}<div class="hint">Équipe ou ramasse un objet pour le forgemager.${p.commandeFM ? ' Malek a déjà un objet en commande.' : ''}</div><div class="fmr">${historique(e)}</div></div>`;
  const def = ITEMS.equipment[it.id], L = lignes(def, it);
  if (e.rune && !((p.resources[e.rune] ?? 0) > 0)) e.rune = null;
  // une case de rune (4C) : nombre dans le sac, chance (8B), prix (9B)
  const carte = (id: string) => {
    const ch = chanceRune(def, it, id), n = p.resources[id] ?? 0, k = coutKamas(def, id), ok = n > 0 && !('refus' in ch) && p.kamas >= k;
    const t = 'refus' in ch ? (ch.refus === 'plafond' ? 'max' : '—') : ch.certain ? '100 %' : pc(ch.p);
    const cls = 'refus' in ch ? 'non' : ch.certain ? 'sur' : ch.p < 0.3 ? 'bas' : '';
    return `<div class="rc ${ok ? '' : 'off'} ${e.rune === id ? 'on' : ''}" data-frune="${id}" title="${nomR(id)} : +${RUNES[id].val} ${STAT_NAMES[RUNES[id].stat]} · poids ${fr(RUNES[id].poids)} · ${k} kamas">${icR(id)}<span class="n">${n}</span><span class="p ${cls}">${t}</span></div>`;
  };
  const ordre = [...L.filter(l => !e.caches.includes(l.s)), ...L.filter(l => e.caches.includes(l.s))];
  const rows = ordre.map(l => {
    const top = Math.max(l.cap, l.max, l.v, 1), w = Math.min(100, l.v / top * 100), mk = l.max / top * 100;
    const off = def.stats[l.s], min = off && off[1] > 0 ? off[0] : 1;
    const jet = !l.rune ? 'sans rune' : l.exo ? `exo · max ${l.max}` : `${min} à ${l.max}${l.cap > l.max ? `<small>overmax ${l.cap}</small>` : ''}`;
    const rs = l.rune ? runesDe(l.s).filter(id => (p.resources[id] ?? 0) > 0) : [];
    const cls = [l.v === 0 ? 'zero' : '', l.v > l.max ? 'over' : '', l.extra ? 'ex' : '', l.exo ? 'exo' : '', l.rune ? '' : 'sans', e.caches.includes(l.s) ? 'cache' : ''].join(' ');
    return `<tr class="${cls}"><td class="oe" data-oeil="${l.s}" title="${e.caches.includes(l.s) ? 'Montrer la ligne' : 'Masquer la ligne (elle passe en bas)'}">👁</td>
      <td class="e">${STAT_NAMES[l.s]}<div class="bar"><i class="${l.v > l.max ? 'over' : ''}" style="width:${w}%"></i><b style="left:${mk}%"></b></div></td>
      <td class="v">${l.v}</td><td class="j">${jet}</td><td><div class="rr">${rs.map(carte).join('')}</div></td></tr>`;
  }).join('');
  // nouvelle ligne (exo, 4B) : sur un Légendaire ou un Mythique, la plus petite rune du sac de chaque caractéristique absente
  const exos = [...new Set(Object.keys(p.resources).filter(id => RUNES[id] && p.resources[id] > 0 && exoPossible(def, it, RUNES[id].stat)).map(id => RUNES[id].stat))]
    .map(st => runesDe(st).find(id => (p.resources[id] ?? 0) > 0 && !('refus' in chanceRune(def, it, id)))).filter((x): x is string => !!x)
    .sort((a, b) => STAT_NAMES[RUNES[a].stat].localeCompare(STAT_NAMES[RUNES[b].stat]));
  const nl = exos.length ? `<div class="nlx"><span class="ent">Nouvelle ligne (exo, une seule par objet)</span><div class="rr">${exos.map(carte).join('')}</div></div>` : '';
  const sig = it.signe
    ? `<div class="fs signe" title="Signé par ${esc(it.signe)}">${icR(SIGNATURE.rune)}<small>Signature</small></div>`
    : `<div class="fs vide" data-fsigne title="Signer l'objet : ton nom dans son infobulle. Une Rune de Signature du sac (${p.resources[SIGNATURE.rune] ?? 0}), sinon Malek t'en vend une ${SIGNATURE.kamas} kamas.">${(p.resources[SIGNATURE.rune] ?? 0) > 0 ? icR(SIGNATURE.rune) : `<img class="v" src="${D3}/forge/slot_feather.webp" alt="">`}<small>Signature</small></div>`;
  const rune = e.rune ? `<div class="fs" title="${nomR(e.rune)}">${icR(e.rune)}<small>Rune</small></div>` : `<div class="fs vide"><img class="v" src="${D3}/forge/slot_rune.webp" alt=""><small>Rune</small></div>`;
  const pret = !!e.rune && !e.avance && !('refus' in chanceRune(def, it, e.rune)) && p.kamas >= coutKamas(def, e.rune);
  const slots = `<div class="fsl"><div class="fs on">${iconHtml(def.icon)}<small>Objet</small></div>${rune}${sig}
    <span class="bv ${pret ? '' : 'off'}" data-fusionner>Fusionner</span>
    <label class="ck" title="Un clic sur une rune la fusionne tout de suite"><input type="checkbox" data-avance ${e.avance ? 'checked' : ''}> Mode avancé</label></div>`;
  const objet = `<div class="fob"><b style="color:${RARITY_COLORS[it.rarity]}">${def.name}</b><span class="hint">${RARITY_NAMES[it.rarity]} · niveau ${def.level}${it.signe ? ` · signé par ${esc(it.signe)}` : ''}${it.legendary ? ' · pouvoir légendaire intouchable' : ''}</span></div>`;
  const table = `<table class="ft"><thead><tr><th></th><th>Effet</th><th style="text-align:right">Valeur</th><th>Jet</th><th style="text-align:right">Runes</th></tr></thead><tbody>${rows}</tbody></table>${nl}`;
  const centre = `<div class="fmc">${slots}${objet}${table}<div class="puits"><span>Puits <span class="hint">poids gardé de côté : une rune qu'il couvre passe à coup sûr</span></span><b>${fr(it.puits ?? 0)}</b></div>
    ${L.some(l => l.rune) && !Object.keys(p.resources).some(id => RUNES[id]) ? '<div class="hint">Aucune rune dans ton sac : défais des objets chez Kerubim.</div>' : ''}</div>`;
  const cout = e.rune ? `${coutKamas(def, e.rune)} kamas` : '—';
  const droite = `<div class="fmr">${historique(e)}<div class="hint">Essai : <b>${cout}</b> · ${e.avance ? 'mode avancé : un clic sur une rune la fusionne' : 'choisis une rune au bout de sa ligne, puis Fusionner'}</div></div>`;
  return `<div class="fmg">${L1.html}${centre}${droite}</div>`;
}

const FINS: Record<FinCommande, string> = { ok: 'objectifs atteints', plancher: 'ligne protégée touchée', budget: 'budget atteint', runes: 'plus de rune utile' };
function malekHtml(world: World, e: EtatForge): string {
  const p = world.player, c = p.commandeFM;
  if (c) {   // 9E : l'objet est chez Malek
    const def = ITEMS.equipment[c.item.id], R = c.rapport;
    const diff = (Object.keys({ ...c.avant, ...c.item.stats }) as Stat[]).map(s => {
      const a = c.avant[s] ?? 0, b = c.item.stats[s] ?? 0; return a === b ? '' : `<span class="${b > a ? 'ok' : 'ko'}">${STAT_NAMES[s]} ${a} → ${b}</span>`;
    }).filter(Boolean).join(' · ');
    const issues = (['critique', 'neutre', 'puits', 'echec'] as const).filter(k => R.issues[k]).map(k => `${R.issues[k]} ${({ critique: 'critique', neutre: 'neutre', puits: 'par le puits', echec: 'échec' })[k]}${(R.issues[k] ?? 0) > 1 && k !== 'puits' ? 's' : ''}`).join(', ');
    const dit = c.prete ? (R.fin === 'ok' ? 'C\'est fait, et proprement. Tu peux vérifier, je ne triche jamais sur un jet.' : R.fin === 'plancher' ? 'Ta ligne protégée a lâché, alors j\'ai posé l\'outil. Je ne casse pas ce que tu m\'as demandé de garder.'
      : R.fin === 'budget' ? 'J\'ai arrêté là : un essai de plus et je dépassais ton budget.' : 'Plus de runes qui servent dans ce que tu m\'as laissé. Ramène-m\'en, et on reprend.')
      : 'Laisse-moi travailler. Va chasser un peu, ton objet t\'attendra ici.';
    return `<div class="mk"><div class="mkd"><b>Malek :</b> ${dit}</div>
      <div class="fob">${iconHtml(def.icon)}<b style="color:${RARITY_COLORS[c.item.rarity]}">${def.name}</b><span class="hint">${c.prete ? 'prêt' : `prêt dans ${mmss(c.reste)}`}</span></div>
      ${c.prete ? `<div class="mkr"><span><b>${R.essais} rune${R.essais > 1 ? 's' : ''}</b> posée${R.essais > 1 ? 's' : ''} pour <b>${R.kamas} kamas</b> (commission comprise) · ${FINS[R.fin]}</span><span>${issues}</span><span>${diff || 'aucune ligne n\'a changé'}</span></div>
        <div class="mkb"><span class="bv" data-reprendre>Reprendre l'objet</span></div>` : `<div class="bar" style="height:8px"><i style="width:${Math.round(100 * (1 - c.reste / c.total))}%"></i></div>`}</div>`;
  }
  const L0 = liste(world, e.cmdUid ?? e.uid, 'muid');
  if (e.cmdUid == null || !L0.tous.some(it => it.uid === e.cmdUid)) e.cmdUid = e.uid != null && L0.tous.some(x => x.uid === e.uid) ? e.uid : L0.tous[0]?.uid ?? null;
  const L1 = liste(world, e.cmdUid, 'muid'), it = L1.tous.find(x => x.uid === e.cmdUid);
  if (!it) return `<div class="fmg">${L1.html}<div class="hint">Donne-moi un objet à forgemager.</div><div></div></div>`;
  const def = ITEMS.equipment[it.id], L = lignes(def, it).filter(l => l.rune);
  const rows = L.map(l => `<tr class="${l.v > l.max ? 'over' : ''}"><td class="e">${STAT_NAMES[l.s]}</td><td class="v">${l.v}</td><td class="j">${l.exo ? `max ${l.max}` : `max ${l.max}${l.cap > l.max ? ` · overmax ${l.cap}` : ''}`}</td>
    <td><input type="number" min="0" max="${l.cap}" data-obj="${l.s}" value="${e.cmd.objectifs[l.s] ?? ''}" placeholder="—"></td>
    <td><input type="number" min="0" data-plancher="${l.s}" value="${e.cmd.planchers[l.s] ?? ''}" placeholder="—"></td></tr>`).join('');
  const E = e.estim, fins = E ? (Object.keys(E.fins) as FinCommande[]).map(f => `${FINS[f]} ${pc(E.fins[f]!)}`).join(' · ') : '';
  const dit = !E ? 'Dis-moi ce que tu veux sur cet objet, ce que je ne dois pas casser, et combien tu y mets. Je t\'en dis mon avis avant de toucher à quoi que ce soit.'
    : E.reussite >= 0.7 ? `Ça se fait. Je dirais ${Math.round(E.reussite * 100)} fois sur 100.` : E.reussite >= 0.3 ? `Faisable, mais je ne promets rien : ${Math.round(E.reussite * 100)} chances sur 100.`
    : `Franchement ? ${Math.round(E.reussite * 100)} chances sur 100. Baisse un objectif, ou mets plus de kamas.`;
  return `<div class="fmg">${L1.html}<div class="mk"><div class="mkd"><b>Malek :</b> ${dit}</div>
    <div class="fob"><b style="color:${RARITY_COLORS[it.rarity]}">${def.name}</b><span class="hint">${RARITY_NAMES[it.rarity]} · niveau ${def.level}${it.puits ? ` · puits ${fr(it.puits)}` : ''}</span></div>
    <table class="ft"><thead><tr><th>Ligne</th><th style="text-align:right">Actuel</th><th>Jet</th><th>Objectif</th><th>Plancher</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="mkb"><span class="hint">Budget</span><input type="number" min="0" data-budget value="${e.cmd.budget}"><span class="hint">kamas, sa commission de 50 % comprise</span></div>
    <div class="mkb"><span class="bv" data-estimer style="filter:hue-rotate(160deg)">Estimer</span><span class="bv" data-confier>Confier à Malek</span></div>
    ${E ? `<div class="mkr"><span>Sur ${200} essais simulés : <b>${pc(E.reussite)}</b> de chances d'atteindre tous les objectifs.</span><span>En moyenne <b>${E.kamas} kamas</b> et <b>${fr(E.runes)} runes</b>.</span><span class="hint">Arrêts : ${fins}</span></div>` : ''}
    <div class="hint">Malek pose les runes de ton sac sur la ligne la plus en retard, s'arrête dès qu'une ligne protégée passe sous son plancher, et rend l'objet après quelques minutes (une commande à la fois). Un objet porté est retiré le temps du travail.</div>
  </div><div class="fmr">${historique(e)}</div></div>`;
}

/** « Défaire » chez Kerubim (maquette Magasin 7A-10D) : objets choisis, aperçu des runes, des kamas et des pouvoirs pour le Codex. */
export function defaireHtml(world: World, e: EtatForge): string {
  const p = world.player, I = ITEMS;
  e.brise = e.brise.filter(uid => p.bag.some(b => b.uid === uid && !b.cadenas));
  const choisis = e.brise.map(uid => p.bag.find(b => b.uid === uid)!);
  const tot: Record<string, number> = {};
  let kamas = 0, pouvoirs = 0;
  for (const it of choisis) {
    const d = I.equipment[it.id]; if (!d) continue;
    for (const [id, n] of Object.entries(apercuBrisage(d, it))) tot[id] = (tot[id] ?? 0) + n;
    kamas += kamasDefaire(d, it);
    if (p.v03) for (const l of [it.legendary, it.legendary2]) if (l && nouveauPourCodex(p.codex, p.cls.sorts, l)) pouvoirs++;
  }
  const ap = Object.keys(tot).sort((a, b) => RUNES[a].stat.localeCompare(RUNES[b].stat) || RUNES[a].val - RUNES[b].val)
    .map(id => `<span title="${nomR(id)}">${icR(id)}× ${tot[id]}</span>`).join('');
  const lots: [Rarity, string][] = [['commun', '+ tout le Commun'], ['rare', '+ Commun et Rare'], ['epique', '+ tout sauf Légendaire'], ['mythique', '+ tout le sac']];
  const lotsHtml = lots.map(([r, n]) => `<span class="btn" data-blot="${r}">${n}</span>`).join('');
  const cell = (it: Item, tag: string) => { const d = I.equipment[it.id];
    return `<div class="cell ${it.cadenas ? 'verrou' : ''} ${e.brise.includes(it.uid) ? 'on' : ''} ${world.meilleurQuePorte(it) ? 'up' : ''}" data-${tag}="${it.uid}">${iconHtml(d.icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`; };
  const sac = p.bag.filter(it => I.equipment[it.id] && !I.equipment[it.id].familier);
  return `<div class="cz"><div class="czg">
      <div class="czt"><img src="${D3}/forge/concasseur.webp" alt=""><div class="hint">Pose des objets ici : chacun rend ses runes officielles et des kamas, selon son niveau et sa rareté. Un pouvoir légendaire nouveau va dans ton Codex, une coiffe, une cape ou un bouclier inconnu dans ta collection.</div></div>
      <span class="ent">À défaire (${choisis.length})</span>
      <div class="czs">${choisis.map(it => cell(it, 'bout')).join('') || '<div class="hint" style="grid-column:1/-1">Clique des objets de ton sac pour les poser ici.</div>'}</div>
      <span class="ent">Ce que tu récupères</span><div class="czr">${ap || '<span class="hint" style="border:0;background:none">—</span>'}${kamas ? `<span>${kamas.toLocaleString('fr-FR')} kamas</span>` : ''}${pouvoirs ? `<span>${pouvoirs} pouvoir${pouvoirs > 1 ? 's' : ''} pour le Codex</span>` : ''}</div>
      <div class="mkb"><span class="bv ${choisis.length ? '' : 'off'}" data-briser>Défaire</span>${lotsHtml}</div>
    </div><div class="czg"><span class="ent">Ton sac</span>
      <div class="hint">Clic : poser ou retirer · Ctrl + clic (ou clic droit) : cadenas, jamais défait. Flèche verte : meilleur que ce que tu portes.</div>
      <div class="grid eg">${sac.map(it => cell(it, 'buid')).join('') || '<div class="hint" style="grid-column:1/-1">Ton sac est vide.</div>'}</div>
    </div></div>`;
}

/** Ajoute à « Défaire » tous les objets du sac jusqu'à cette rareté (sans cadenas). */
export function lotConcasseur(world: World, e: EtatForge, jusqua: Rarity) {
  const I = ITEMS, max = RARITIES.indexOf(jusqua);
  for (const it of world.player.bag) {
    const d = I.equipment[it.id];
    if (d && !d.familier && !it.cadenas && RARITIES.indexOf(it.rarity) <= max && !e.brise.includes(it.uid)) e.brise.push(it.uid);
  }
}

function fusionHtml(world: World): string {
  const p = world.player;
  const l = Object.keys(p.resources).filter(id => RUNES[id] && fusionVers(id)).sort((a, b) => RUNES[a].stat.localeCompare(RUNES[b].stat) || RUNES[a].val - RUNES[b].val);
  const rows = l.map(id => { const v = fusionVers(id)!, n = p.resources[id], k = Math.floor(n / FUSION_N);
    return `<div class="rec">${icR(id)}<div><b>${nomR(id)}</b> <span class="hint">× ${n}</span></div><span>→</span>${icR(v)}<div><b>${nomR(v)}</b> <span class="hint">${k ? `${k} possible${k > 1 ? 's' : ''}` : `il en faut ${FUSION_N}`}</span></div>
      <span class="btn ${k ? '' : 'off'}" data-fus="${id}">Fusionner ${FUSION_N}</span><span class="btn ${k > 1 ? '' : 'off'}" data-fust="${id}">Tout</span></div>`; }).join('');
  return `<div class="hint">${FUSION_N} runes d'un palier donnent une rune du palier suivant (Fo → Pa Fo → Ra Fo).</div><div class="fus">${rows || '<div class="hint">Aucune rune à fusionner.</div>'}</div>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
