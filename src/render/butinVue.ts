import { v } from './assetUrl';
import { iconHtml } from './icons';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../sim/data';
import { RARITY_COLORS, RARITY_NAMES, RARITIES } from '../sim/items';
import { lieuxDe, niveauHorsPartie, rangDe, tableButin, type CtxButin, type LigneButin, type Source, type TableButin } from '../sim/butin';

/** Affichage du butin (maquette « Drops », Mathis 2026-11-07) : partagé par le Bestiaire en jeu (B), l'accueil,
 *  les infobulles d'objets (« Où le trouver ») et l'outil de test (F1). Ne fait que lire : tout le calcul est dans src/sim/butin.ts. */
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fr = (x: number, d: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: d });
/** « 74,2 % » (2B) ; sous 1 % on garde deux décimales. */
export const pct = (p: number) => `${fr(p * 100, p < 0.01 ? 2 : 1)} %`;
/** « 1 sur 68 » (2C). */
export function unSur(p: number) {
  if (p <= 0) return '—';
  if (p >= 0.995) return 'toujours';
  const n = 1 / p;
  return `1 sur ${fr(n < 10 ? n : Math.round(n), 1)}`;
}
export const nomObjet = (id: string) => (ITEMS.resources[id] ?? ITEMS.equipment[id])?.name ?? id;
export const iconeObjet = (id: string) => iconHtml((ITEMS.resources[id] ?? ITEMS.equipment[id])?.icon ?? 0);

const POOL = Object.entries(ITEMS.equipment).filter(([, d]) => !d.familier).map(([id, d]) => ({ id, level: d.level }));
const FAMILIERS_DE: Record<string, string[]> = {};
for (const [id, d] of Object.entries(ITEMS.equipment)) for (const m of d.familier?.monstres ?? []) (FAMILIERS_DE[m] ??= []).push(id);
/** Contexte sans partie (accueil, outil de test hors combat) : Prospection 0, pas de métier. */
export function ctxHorsPartie(type: string, prospection = 0): CtxButin {
  const d = GAME_DATA.monsters[type];
  return { type, rang: d ? rangDe(d) : 'normal', niveau: niveauHorsPartie(type, GAME_DATA), prospection, items: ITEMS, familiers: FAMILIERS_DE[type] ?? [], pool: POOL,
    metierNiveau: () => 1, armeChasse: false };
}

/** Groupes du Bestiaire : chaque sous-zone (et donjon) des mondes ouverts, avec ses monstres, du plus bas niveau au plus haut. */
export interface Groupe { zone: string; nom: string; niveau: number; donjon: boolean; monstres: string[] }
let groupes: Groupe[] | null = null;
export function groupesBestiaire(): Groupe[] {
  if (groupes) return groupes;
  const out: Groupe[] = [], vus = new Set<string>();
  for (const [zid, z] of Object.entries(GAME_DATA.zones)) {
    const o = z.open; if (!o || zid === 'havresac') continue;
    const noms = new Set((o.donjons ?? []).map(d => d.nom));
    for (const s of Object.values(o.subareas)) {
      if (noms.has(s.name)) continue;
      const m = [...new Set([...s.monsters, ...(s.elite ? [s.elite] : [])])].filter(x => GAME_DATA.monsters[x]);
      if (m.length) out.push({ zone: z.name, nom: s.name, niveau: s.level, donjon: false, monstres: m });
    }
    for (const d of o.donjons ?? []) {
      const m = [...new Set(Object.values(d.salles).flat(2))].filter(x => GAME_DATA.monsters[x]);
      const lvl = Object.values(o.subareas).find(s => s.name === d.nom)?.level ?? z.level;
      if (m.length) out.push({ zone: z.name, nom: d.nom, niveau: lvl, donjon: true, monstres: m });
    }
  }
  out.sort((a, b) => a.niveau - b.niveau || Number(a.donjon) - Number(b.donjon));
  // chaque monstre une fois, là où on le croise d'abord
  for (const g of out) g.monstres = g.monstres.filter(m => !vus.has(m) && vus.add(m));
  return groupes = out.filter(g => g.monstres.length);
}

/** D'où vient un objet (1B, 7A+7B+7C+7D) : monstres, récolte, recettes, boutiques ; et à quoi il sert. */
export function sourcesDe(id: string): { sources: Source[]; sertA: Source[] } {
  const sources: Source[] = [], sertA: Source[] = [];
  for (const [m, l] of Object.entries(ITEMS.drops)) for (const d of l) if (d.item === id && GAME_DATA.monsters[m]) {
    const md = GAME_DATA.monsters[m], lieu = lieuxDe(m, GAME_DATA)[0];
    sources.push({ k: 'monstre', cle: m, nom: md.name + (md.boss ? ' (boss)' : md.elite ? ' (élite)' : ''), chance: d.chance / 100,
      detail: lieu ? `${lieu.nom} · niv. ${lieu.niveau}` : `niv. ${md.level ?? '?'}`, etat: d.cond === 'quete' ? 'quete' : d.cond === 'evenement' ? 'evenement' : d.metier ? 'metier' : 'ok' });
  }
  sources.sort((a, b) => Number(a.etat !== 'ok' && a.etat !== 'metier') - Number(b.etat !== 'ok' && b.etat !== 'metier') || (b.chance ?? 0) - (a.chance ?? 0));
  const rc = RECOLTES.ressources[id];
  if (rc) {
    const mondes = Object.entries(RECOLTES).filter(([, x]) => Array.isArray(x) && (x as unknown[][]).some(e => e[2] === id)).map(([k]) => GAME_DATA.zones[k]?.name ?? k);
    sources.push({ k: 'recolte', nom: rc.metier ? `${RECOLTES.metiers[rc.metier]?.nom ?? rc.metier} niveau ${rc.niveau}` : 'Sans métier', detail: mondes.join(', ') || 'pas encore dans le jeu' });
  }
  for (const r of ITEMS.recipes ?? []) {
    const job = ITEMS.metiers?.[r.metier]?.name ?? r.metier;
    if (r.result === id) sources.push({ k: 'recette', nom: `${job} niveau ${r.level}`, detail: r.ingredients.map(([i, q]) => `${q} ${nomObjet(i)}`).join(', ') });
    if (r.ingredients.some(([i]) => i === id)) sertA.push({ k: 'recette', nom: nomObjet(r.result), detail: `${job} niveau ${r.level}` });
  }
  for (const [pnj, l] of Object.entries(BOUTIQUES)) for (const a of l) if (a.id === id)
    sources.push({ k: 'boutique', nom: QUETES.pnj[pnj]?.nom ?? pnj, detail: `${a.prix} Pépites` });
  return { sources, sertA };
}
const PASTILLE: Record<Source['k'], [string, string]> = { monstre: ['Monstre', '#e0605a'], recolte: ['Récolte', '#6fcf97'], recette: ['Recette', '#5aa8ff'], boutique: ['Boutique', '#e6b85c'] };
const etatTxt = (s: Source) => s.etat === 'quete' ? 'quête de Dofus, ne tombe pas' : s.etat === 'evenement' ? 'pendant un événement' : '';
/** Lignes « Où le trouver » : max = nombre de lignes (infobulle), sinon tout. */
export function sourcesHtml(id: string, max = 0): string {
  const { sources, sertA } = sourcesDe(id), l = max ? sources.filter(s => s.etat !== 'quete').slice(0, max) : sources;
  const ligne = (s: Source) => { const [n, c] = PASTILLE[s.k], gris = s.etat === 'quete' || s.etat === 'evenement';
    return `<div class="bu-src${gris ? ' gris' : ''}"${s.cle ? ` data-bmon="${s.cle}"` : ''}><span class="bu-pill" style="background:${c}">${n}</span><span>${esc(s.nom)}<small>${esc([s.detail, etatTxt(s)].filter(Boolean).join(' · '))}</small></span><b>${s.chance != null ? pct(s.chance) : ''}</b></div>`; };
  const reste = max && sources.length > l.length ? `<div class="bu-plus">+ ${sources.length - l.length} autre${sources.length - l.length > 1 ? 's' : ''} dans le Bestiaire (B)</div>` : '';
  if (max) return l.length ? `<div class="bu-ou">Où le trouver</div>${l.map(ligne).join('')}${reste}` : '';
  return `<div class="bu-ou">Où le trouver</div>${l.map(ligne).join('') || '<div class="bu-plus">Nulle part pour l\'instant.</div>'}
    ${sertA.length ? `<div class="bu-ou">Sert à</div>${sertA.map(ligne).join('')}` : ''}`;
}

/** Onglet Butin d'un monstre (2B+2C, 4A) : butin officiel avec la chance pour toi, puis le butin aléatoire. */
export function butinHtml(t: TableButin, ctx: CtxButin): string {
  const tag = (l: LigneButin) => {
    const out: string[] = [];
    if (l.equipement) out.push('<span class="bu-tag eq">équipement · rareté tirée</span>');
    if (l.d.metier) out.push(`<span class="bu-tag ${l.etat === 'metier' ? 'non' : 'job'}">${esc(ITEMS.metiers?.chasseur?.name ?? 'Chasseur')} ${l.d.metier.min}${l.d.chasse ? ' + arme de chasse' : ''}</span>`);
    if (l.etat === 'evenement') out.push('<span class="bu-tag gris">événement</span>');
    if (l.etat === 'quete') out.push('<span class="bu-tag gris">quête de Dofus</span>');
    return out.join('');
  };
  const ok = t.officiel.filter(l => l.etat === 'ok' || l.etat === 'metier'), gris = t.officiel.filter(l => l.etat === 'evenement' || l.etat === 'quete');
  const ligne = (l: LigneButin) => {
    const tombe = l.etat === 'ok';
    return `<tr class="${tombe ? '' : 'gris'}" data-bobj="${l.d.item}"><td><span class="bu-obj">${iconeObjet(l.d.item)}<span>${esc(nomObjet(l.d.item))}${tag(l)}</span></span></td>
      <td class="n">${fr(l.d.chance, 2)} %</td><td class="n hi">${tombe ? pct(l.chance) : '—'}</td><td class="n">${tombe ? unSur(l.chance) : ''}</td></tr>`;
  };
  const r = t.raretes, barre = RARITIES.filter(k => k !== 'mythique').map(k => {
    const p = k === 'legendaire' ? r.legendaire + r.mythique : r[k];
    return `<span style="flex:${Math.max(p * 100, 3)} 1 0;background:${RARITY_COLORS[k]}" title="${RARITY_NAMES[k]} ${pct(p)}${k === 'legendaire' ? ` (dont Mythique ${pct(r.mythique)})` : ''}">${RARITY_NAMES[k]} ${pct(p)}</span>`;
  }).join('');
  const e = t.equipement, fam = t.familiers.map(f => `<div class="bu-al"><span>${iconeObjet(f.id)} Familier : ${esc(nomObjet(f.id))}</span><b>${unSur(f.chance)}</b></div>`).join('');
  return `<p class="bu-pros">Ta Prospection : <b>${ctx.prospection}</b> · chances ×${fr(1 + ctx.prospection / 100, 2)}</p>
    <div class="bu-tab"><table class="bu-t"><thead><tr><th>Butin officiel</th><th class="n">Dofus</th><th class="n">Pour toi</th><th class="n">Soit</th></tr></thead>
    <tbody>${ok.map(ligne).join('') || '<tr><td colspan="4" class="bu-plus">Aucun butin officiel.</td></tr>'}${gris.map(ligne).join('')}</tbody></table></div>
    <div class="bu-alea"><div class="bu-ou">Butin aléatoire (en plus)</div>
      <div class="bu-al"><span>Équipement officiel du niveau ${Math.max(1, e.min)} à ${e.max} (${e.nb} possibles)${e.tirages > 1 ? `, ${e.tirages} tirages` : ''}</span><b>${pct(e.chance)} · ${unSur(e.chance)}</b></div>
      <div class="bu-rar">${barre}</div>
      <div class="bu-al"><span>Légendaire ou Mythique, par monstre vaincu</span><b style="color:${RARITY_COLORS.legendaire}">${unSur(t.legendaire)}</b></div>
      <div class="bu-al"><span>Kamas</span><b>${pct(t.kamas.chance)} · ${t.kamas.min} à ${t.kamas.max}</b></div>
      ${fam || '<div class="bu-al gris"><span>Familier de sa famille</span><b>aucun</b></div>'}
    </div>`;
}
export const butinMonstre = (ctx: CtxButin) => butinHtml(tableButin(ctx), ctx);

/** Styles du butin, communs aux fenêtres, à l'accueil et à l'outil de test. */
export const BUTIN_CSS = `
.bu-pros{margin:0;font-size:12px;color:#a9a48b}.bu-pros b{color:#b9e54b}
.bu-tab{overflow:auto}
.bu-t{border-collapse:collapse;width:100%;font-size:12.5px}
.bu-t th,.bu-t td{padding:4px 6px;border-bottom:1px solid #3a3830;text-align:left;vertical-align:middle}
.bu-t th{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#a9a48b;font-weight:600;position:sticky;top:0;background:#24231f}
.bu-t .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.bu-t .hi{color:#b9e54b}
.bu-t tr.gris{opacity:.5}
.bu-t tr[data-bobj]{cursor:pointer}.bu-t tr[data-bobj]:hover td{background:#ffffff08}
.bu-obj{display:flex;gap:7px;align-items:center}
.bu-obj .ic{width:28px;height:28px;flex:none}
.bu-obj > span{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.bu-tag{font-size:10px;line-height:1.2;padding:1px 5px;border-radius:3px;border:1px solid #57554c;color:#c9c4ab;white-space:nowrap}
.bu-tag.eq{color:#6fb2e8;border-color:#2f4f6b}.bu-tag.job{color:#7be07b;border-color:#2f5a40}.bu-tag.non{color:#e0896a;border-color:#6b3f2c}.bu-tag.gris{color:#a9a48b}
.bu-alea{display:grid;gap:6px;background:#1d1c19;border:1px solid #3a3830;border-radius:4px;padding:9px 10px}
.bu-al{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;align-items:center}
.bu-al span{display:flex;align-items:center;gap:6px}.bu-al .ic{width:22px;height:22px}
.bu-al b{white-space:nowrap;font-variant-numeric:tabular-nums}.bu-al.gris{opacity:.55}
.bu-rar{display:flex;height:20px;border-radius:3px;overflow:hidden;font-size:10px;line-height:20px;font-weight:700}
.bu-rar span{min-width:0;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#15140f}
.bu-ou{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#a9a48b;margin-top:4px}
.bu-src{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:12.5px;padding:3px 0;border-bottom:1px solid #3a383055}
.bu-src[data-bmon]{cursor:pointer}.bu-src[data-bmon]:hover{color:#b9e54b}
.bu-src small{display:block;color:#a9a48b;font-size:11px}
.bu-src.gris{opacity:.55}
.bu-src b{font-variant-numeric:tabular-nums}
.bu-pill{font-size:9.5px;font-weight:700;padding:3px 5px;border-radius:3px;color:#15140f;text-transform:uppercase;letter-spacing:.05em}
.bu-plus{font-size:11.5px;color:#a9a48b}
`;

interface Cadre { im: HTMLImageElement; x: number; y: number; w: number; h: number }
const cadres = new Map<string, Promise<Cadre | null>>();
/** Image de repos d'une planche de monstre (atlas simple ou multi-atlas de TexturePacker). */
export function cadre(atlas: string): Promise<Cadre | null> {
  if (!cadres.has(atlas)) cadres.set(atlas, (async () => {
    try {
      type F = { filename?: string; frame: { x: number; y: number; w: number; h: number } };
      const j = await (await fetch(v(`assets/sprites/${atlas}.json`))).json();
      const pages: { image: string; frames: F[] }[] = j.textures ?? [{ image: `${atlas}.avif`, frames: Object.entries(j.frames).map(([filename, f]) => ({ filename, ...(f as F) })) }];
      let pick: { page: string; f: F } | null = null;
      for (const pg of pages) for (const f of pg.frames) {
        if (!pick || (f.filename?.startsWith('AnimStatique_1') && !pick.f.filename?.startsWith('AnimStatique_1'))) pick = { page: pg.image, f };
      }
      if (!pick) return null;
      const im = new Image(); im.crossOrigin = 'anonymous'; im.src = v(`assets/sprites/${pick.page}`); await im.decode();
      return { im, ...pick.f.frame };
    } catch { return null; }
  })());
  return cadres.get(atlas)!;
}
/** Dessine les portraits (canvas[data-atlas]) : la première image de l'animation de repos du monstre. */
export function dessinerPortraits(root: ParentNode) {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-atlas]').forEach(async cv => {
    const a = cv.dataset.atlas; if (!a) return;
    const f = await cadre(a); if (!f || !cv.isConnected) return;
    const ctx = cv.getContext('2d')!, k = Math.min(cv.width / f.w, cv.height / f.h);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(f.im, f.x, f.y, f.w, f.h, (cv.width - f.w * k) / 2, cv.height - f.h * k, f.w * k, f.h * k);
  });
}
