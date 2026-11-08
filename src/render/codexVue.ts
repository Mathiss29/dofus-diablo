import { ITEMS } from '../sim/data';
import { imprimable, pouvoirsDuCodex, prixImpression, type EntreeCodex } from '../sim/codex';
import { LEGENDARY, PEPITE, RARITY_COLORS, RARITY_NAMES, lignePouvoir, type Item, type LegendaryId } from '../sim/items';
import type { Player } from '../sim/player';
import { POUVOIR_PAR_ID } from '../sim/pouvoirs';
import { PC_PAR_ID, fourchette } from '../sim/pouvoirsClasse';
import type { World } from '../sim/world';
import { iconHtml } from './icons';

/** Codex des pouvoirs (version 0.3, 5A+5B+5D, 7A+7B) : onglet « Codex » de Malek (impression) et page de consultation
 *  dans la fenêtre des Sorts. Trouvés en couleur, manquants en gris avec l'emplacement où les chercher (5D). */
export const CODEX_CSS = `
.dw .cdx{display:grid;gap:10px;align-content:start;min-width:0}
.dw .cdx .cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.dw .cdx .cs{background:#141412aa;border:1px solid #34322b;border-radius:3px;padding:6px 8px;display:grid;gap:3px;align-content:start}
.dw .cdx .cs h4{margin:0;font:600 11px Lexend,sans-serif;color:#c9a55a;text-transform:uppercase;letter-spacing:.06em}
.dw .cdx .cp{font-size:12px;color:#6d6a5d;padding:2px 4px;border-radius:2px}
.dw .cdx .cp.vu{color:#f08a2c}.dw .cdx .cp.vu b{color:#ffb268}
.dw .cdx .cp.ch{cursor:pointer;border:1px solid transparent}.dw .cdx .cp.ch:hover{border-color:#b9e54b}.dw .cdx .cp.ch.on{border-color:#b9e54b;background:#2a3410}
.dw .cdx .cp.no{opacity:.45}
.dw .cdx .ct{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.dw .cdx .cpx{display:flex;gap:10px;align-items:center;flex-wrap:nowrap;font-size:13px}.dw .cdx .cpx>span:last-child{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dw .cdx .cp i{font-style:normal;font-size:10.5px;color:#5d5a4f}.dw .cdx .cpx .ic{width:24px;height:24px}
`;
const SLOTS: [string, string][] = [['chapeau', 'Chapeau'], ['cape', 'Cape'], ['amulette', 'Amulette'], ['anneau', 'Anneau'], ['ceinture', 'Ceinture'],
  ['bottes', 'Bottes'], ['arme', 'Arme'], ['bouclier', 'Bouclier']];
const nomSlot = (s: string) => SLOTS.find(x => x[0] === s)?.[1].toLowerCase() ?? s;

/** Ligne d'un pouvoir du Codex (nom du sort + effet), pour ce perso. */
function ligne(p: Player, id: string, e?: EntreeCodex): string {
  const c = PC_PAR_ID[id];
  if (c) {   // légendaire de classe inventé : le jet gardé (4A), sinon la fourchette
    return `<b style="color:#ff9a3c">${c.nom}</b> : ${c.texte(e?.value ?? c.jet[1]).replace(/\d+(,\d+)?/, e?.value != null ? '$&' : 'jusqu\'à $&')}${e?.value != null ? ` <i>(jet gardé, ${fourchette(c)})</i>` : ''}`;
  }
  const o = POUVOIR_PAR_ID[id], k = o && Object.keys(p.cls.spells).find(x => p.cls.spells[x].dofusId === o.dofusId);
  const fx = { id, value: o ? 0 : Math.round((LEGENDARY[id as LegendaryId]?.max ?? 0)), sort: e?.sort };
  const { nom, texte } = lignePouvoir(fx, e?.sort && p.cls.spells[e.sort]?.name, !!k && p.zoneSeule(k));
  return `<b>${nom}</b> : ${o ? texte : texte.replace(/\d+(,\d+)?/, 'jusqu\'à $&')}${o && !k ? ' <i>(sort pas encore en jeu)</i>' : ''}`;
}

/** Page du Codex : les 40 pouvoirs officiels de la classe par emplacement, et les 5 pouvoirs maison. choix : entrée cliquable. */
export function codexPageHtml(p: Player, choix?: { ok: (id: string) => boolean; on: string | null }): string {
  const ids = pouvoirsDuCodex(p.cls.sorts), a = (id: string) => p.codex.find(c => c.id === id);
  const n = ids.filter(id => a(id)).length;
  const cp = (id: string) => {
    const e = a(id), clic = choix && e && choix.ok(id);
    return `<div class="cp ${e ? 'vu' : ''} ${clic ? 'ch' : choix && e ? 'no' : ''} ${choix?.on === id ? 'on' : ''}" ${clic ? `data-centree="${id}"` : ''}>${ligne(p, id, e)}</div>`;
  };
  const parSlot = SLOTS.map(([s, nom]) => {
    const l = ids.filter(id => (POUVOIR_PAR_ID[id] ?? PC_PAR_ID[id])?.slot === s);
    return `<div class="cs"><h4>${nom}</h4>${l.map(cp).join('')}</div>`;
  }).join('');
  const maison = `<div class="cs"><h4>Toutes classes, tout emplacement</h4>${Object.keys(LEGENDARY).map(cp).join('')}</div>`;
  return `<div class="cdx"><div class="ct"><span class="ent">Codex de ${p.cls.name}</span><span class="hint">${n} pouvoirs sur ${ids.length} · en gris : à trouver sur un Légendaire de l'emplacement</span></div>
    <div class="cg">${parSlot}${maison}</div></div>`;
}

export interface EtatCodex { uid: number | null; entree: string | null }
/** Onglet Codex de Malek : choisir un objet Rare ou Épique, un pouvoir du Codex de son emplacement, et payer. */
export function codexOngletHtml(world: World, e: EtatCodex): string {
  const p = world.player;
  const ok = (it?: Item) => !!it && !!ITEMS.equipment[it.id] && !ITEMS.equipment[it.id].familier && (it.rarity === 'rare' || it.rarity === 'epique');
  const portes = (Object.values(p.equipment) as (Item | undefined)[]).filter(ok) as Item[], sac = p.bag.filter(ok), tous = [...portes, ...sac];
  if (e.uid == null || !tous.some(x => x.uid === e.uid)) { e.uid = tous[0]?.uid ?? null; e.entree = null; }
  const cell = (it: Item) => `<div class="cell ${it.uid === e.uid ? 'on' : ''}" data-cuid="${it.uid}">${iconHtml(ITEMS.equipment[it.id].icon)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i></div>`;
  const liste = `<div class="fml">${portes.length ? `<div class="t">Portés</div>${portes.map(cell).join('')}` : ''}${sac.length ? `<div class="t">Sac</div>${sac.map(cell).join('')}` : ''}${tous.length ? '' : '<div class="t">Aucun objet Rare ou Épique</div>'}</div>`;
  const it = tous.find(x => x.uid === e.uid), def = it && ITEMS.equipment[it.id];
  let centre = '<div class="hint">Brise un Légendaire ou un Mythique au Concasseur : ses pouvoirs entrent dans le Codex. Tu peux ensuite les imprimer sur un objet Rare ou Épique, qui devient Légendaire.</div>';
  if (it && def) {
    const okE = (id: string) => { const c = p.codex.find(x => x.id === id); return !!c && imprimable(def, it, c); };
    if (e.entree && !okE(e.entree)) e.entree = null;
    const px = prixImpression(def, it), nr = px.rune ? p.resources[px.rune] ?? 0 : 0, np = p.resources[PEPITE] ?? 0;
    const okK = !!e.entree && p.kamas >= px.kamas && (!px.rune || nr >= px.runes), okP = !!e.entree && np >= px.pepites;
    const rune = px.rune ? `${iconHtml(ITEMS.resources[px.rune]?.icon ?? 0)} ${px.runes} ${ITEMS.resources[px.rune]?.name ?? 'runes'} <span class="hint">(${nr})</span>` : '';
    centre = `<div class="fob">${iconHtml(def.icon)}<b style="color:${RARITY_COLORS[it.rarity]}">${def.name}</b><span class="hint">${RARITY_NAMES[it.rarity]} · ${nomSlot(def.slot)} · niveau ${def.level}</span></div>
      <div class="hint">Choisis un pouvoir du Codex de cet emplacement (les pouvoirs « toutes classes » vont partout). L'objet garde ses caractéristiques et devient Légendaire.</div>
      <div class="cpx"><span class="bv ${okK ? '' : 'off'}" data-cimp="kamas">Imprimer</span><span>${px.kamas.toLocaleString('fr-FR')} kamas ${rune ? '+ ' + rune : ''}</span></div>
      <div class="cpx"><span class="bv ${okP ? '' : 'off'}" data-cimp="pepites">Imprimer</span><span>${iconHtml(ITEMS.resources[PEPITE]?.icon ?? 0)} ${px.pepites} Pépites <span class="hint">(${np})</span></span></div>
      ${codexPageHtml(p, { ok: okE, on: e.entree })}`;
  }
  return `<div class="fmg" style="grid-template-columns:140px minmax(0,1fr)">${liste}<div class="fmc cdx" style="overflow:auto;max-height:560px;padding-right:4px">${centre}</div></div>`;
}
