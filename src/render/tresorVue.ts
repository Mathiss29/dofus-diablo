import { ITEMS } from '../sim/data';
import { coffreDe, couleurCoffre, nomsCoffre, palierCoffre, piecesObjet, rareteVitrine, seuilsCoffre, type ReglesCoffre } from '../sim/enutrof';
import { RARITY_COLORS, RARITY_NAMES, type Item, type Rarity } from '../sim/items';
import type { World } from '../sim/world';
import { v } from './assetUrl';
import { iconHtml } from './icons';

/** Fenêtre du coffre au trésor de l'Enutrof (maquette « Coffre Enu : 1A+1B+1D 2C 3A+3B+3C+3D 4A+4B+4C 5B 6B 7B+7C+7D 8A+8B »,
 *  Mathis 2026-11-12). Ouverte par la touche du coffre (2C) ou un clic sur le médaillon ; la partie continue derrière.
 *  Piste des paliers avec la vitrine (3A, 5B), santé du coffre (3C), journal des pièces (3B), records (3D),
 *  gueule où glisser un Rare ou un Épique (4A), « Tout donner » (4C), bouton Ouvrir. Lecture seule : les clics passent par Windows. */
export const TRESOR_CSS = `
.dw .win.tresor{width:min(900px,96vw);height:auto;max-height:min(680px,94vh)}
.dw .tr{padding:12px;display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;overflow:auto;min-height:0}
@media (max-width:700px){.dw .tr{grid-template-columns:1fr}}
.dw .tr .trc{display:grid;gap:8px;align-content:start;justify-items:center;background:radial-gradient(circle at 50% 35%,#3a2c18,#120d07 72%);border:1px solid #3c3020;border-radius:6px;padding:10px}
.dw .tr .trc img{width:120px;image-rendering:auto;filter:drop-shadow(0 4px 3px #000a)}
.dw .tr .trc img.ko{filter:grayscale(1) brightness(.6)}
.dw .tr .tot{font:bold 24px Rowdies,Lexend,sans-serif;line-height:1}
.dw .tr .tot small{font:600 12px Lexend,sans-serif;color:#c9c4ab;margin-left:4px}
.dw .tr .sante{width:100%;display:grid;gap:3px;font-size:12px;color:#c9c4ab}
.dw .tr .sante .b{height:6px;border-radius:3px;background:#2b1210;overflow:hidden}.dw .tr .sante .b i{display:block;height:100%}
.dw .tr .gueule{width:100%;box-sizing:border-box;border:2px dashed #8a6a3a;border-radius:6px;padding:10px 8px;text-align:center;font-size:12px;color:#e6c78a;background:#0006;transition:background .15s,border-color .15s}
.dw .tr .gueule.sur{background:#3a2a10;border-color:#ffd86a;color:#fff3c8}
.dw .tr .btn2{cursor:pointer;width:100%;box-sizing:border-box;background:#3a2e1a;border:1px solid #8a6a3a;color:#ffd86a;font:bold 12.5px Lexend,sans-serif;padding:6px 10px;border-radius:4px;text-align:center}
.dw .tr .btn2:hover{background:#4a3a20}
.dw .tr .btn2.off{opacity:.4;pointer-events:none}
.dw .tr .trd{display:grid;gap:10px;align-content:start;min-width:0}
.dw .tr .piste{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
@media (max-width:700px){.dw .tr .piste{grid-template-columns:repeat(3,minmax(0,1fr))}}
.dw .tr .pal{border:1px solid #46443d;border-radius:6px;padding:7px 4px;background:#2b2a26;display:grid;gap:4px;justify-items:center;text-align:center;font-size:11px;color:#c9c4ab;line-height:1.3}
.dw .tr .pal b{font:bold 13px Lexend,sans-serif}
.dw .tr .pal.ok{background:#332b1c}
.dw .tr .pal.ici{box-shadow:0 0 0 2px var(--c) inset}
.dw .tr .pal.sur{border-style:dashed;border-color:#7a3a2a}
.dw .tr .vits{display:flex;gap:3px}
.dw .tr .vit{width:40px;height:40px;border-radius:6px;display:grid;place-items:center;font:bold 18px Rowdies,Lexend,sans-serif;background:#16150f;border:1px solid #46443d;color:#555}
.dw .tr .vits .vit{width:26px;height:26px;font-size:13px}
.dw .tr .vit.plein{border-color:var(--r);box-shadow:inset 0 0 12px var(--r),0 0 7px var(--r);color:#fff}
.dw .tr .vit.kamas{border-color:#c9a55a;color:#f2d36b}
.dw .tr .blocs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:700px){.dw .tr .blocs{grid-template-columns:1fr}}
.dw .tr .bloc{border:1px solid #46443d;border-radius:6px;padding:8px 10px;background:#1d1c19;display:grid;gap:4px;align-content:start;font-size:12.5px;min-width:0}
.dw .tr .bloc h4{margin:0 0 2px;font:bold 11px Lexend,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#c9a55a}
.dw .tr .jr{display:flex;justify-content:space-between;gap:8px;color:#d8d2bf}
.dw .tr .jr span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dw .tr .jr b{font-variant-numeric:tabular-nums;white-space:nowrap}
.dw .tr .jr .p{color:#ffd86a}.dw .tr .jr .m{color:#ff8a6a}
.dw .tr .sac{display:flex;gap:4px;flex-wrap:wrap}
.dw .tr .sac .cell{width:44px;height:44px}
.dw .tr .sac .cell .ic{width:40px;height:40px}
.dw .tr .sac .cell.cad{opacity:.35;cursor:not-allowed}
.dw .tr .sac .cell .pc{position:absolute;right:2px;top:1px;font-size:10px;font-weight:bold;color:#ffd86a;text-shadow:0 0 3px #000}
.dw .tr .hint{font-size:12px;color:#a8a290}
.dw .tr .ouv{display:grid;gap:6px}
.dw .tr .ouv .warn{font-size:12.5px;color:#ff9a7a}
.dw .tr .ouv .go{cursor:pointer;background:linear-gradient(#e6b85c,#b88a30);border:1px solid #ffe2a0;color:#1a1308;font:bold 14px Rowdies,Lexend,sans-serif;padding:9px 14px;border-radius:5px;text-align:center}
.dw .tr .ouv .go:hover{filter:brightness(1.1)}
.dw .tr .ouv .go.off{opacity:.4;filter:grayscale(.8);pointer-events:none}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Ce qui s'ajoute au coffre à un palier, en clair. */
function texteAjout(C: ReglesCoffre, k: number): string {
  const A = k < C.butin.length ? C.butin[k] : C.surcharge.butin, e = 'epique' in A && A.epique;
  const t = A.n > 0 ? `butin ${A.rang === 'boss' ? 'de boss' : A.rang === 'elite' ? 'd\'élite' : 'de monstre'}${A.n > 1 ? ` ×${A.n}` : ''}` : '';
  return [t, e ? '1 Épique ou mieux' : ''].filter(Boolean).join(' + ');
}
/** Une case de la vitrine : lueur de la rareté cachée (5B), « ? » tant que le coffre n'est pas ouvert. */
function caseVitrine(w: World, k: number, petite = false): string {
  const v = w.player.coffreVitrine.find(x => x.palier === k);
  if (!v) return `<div class="vit" title="Rien pour l'instant">${petite ? '' : ''}</div>`;
  const r = rareteVitrine(v) as Rarity | null;
  if (!r) return `<div class="vit kamas" title="Des kamas (${v.butin.kamas})">₭</div>`;
  const n = v.butin.objets.length;
  return `<div class="vit plein" style="--r:${RARITY_COLORS[r]}" title="${n} objet${n > 1 ? 's' : ''} caché${n > 1 ? 's' : ''}, le meilleur ${RARITY_NAMES[r]}">?</div>`;
}

/** Empreinte de ce que montre la fenêtre : elle ne se redessine que si elle change (le glisser-déposer n'est pas coupé). */
export function signatureTresor(w: World): string {
  const p = w.player, c = coffreDe(p, w);
  return [p.coffrePieces, Math.ceil(p.coffreKoT), c ? Math.ceil(c.hp) : -1, c ? Math.ceil(c.shield) : 0, p.coffreVitrine.length, p.coffreJournal[0]?.t ?? '', p.coffreJournal[0]?.n ?? 0, p.coffreJournal.length,
    p.bag.length, p.coffreRecords.ouverts].join('|');
}

export function tresorHtml(w: World, titre: string): string {
  const p = w.player, C = p.cls.coffre!, S = seuilsCoffre(C), noms = nomsCoffre(C), pal = palierCoffre(p), c = coffreDe(p, w), ko = p.coffreKoT > 0;
  const nb = C.paliers.length, sur = pal >= nb, coul = couleurCoffre(pal);
  // gauche : le coffre, ses pièces, sa santé (3C), la gueule (4A) et « Tout donner » (4C)
  const hr = c ? Math.max(0, Math.min(1, c.hp / c.maxHp)) : 0;
  const sante = ko ? `<span style="color:#ff9a7a">Assommé : revient dans ${Math.ceil(p.coffreKoT)} s</span>`
    : c ? `<span>PV ${Math.max(0, Math.ceil(c.hp))} / ${c.maxHp}</span><div class="b"><i style="width:${(hr * 100).toFixed(1)}%;background:#d24a3a"></i></div>
      ${c.shield > 0 ? `<span>Bouclier ${Math.ceil(c.shield)}${c.shieldT > 0 ? ` · ${Math.ceil(c.shieldT)} s` : ''}</span><div class="b"><i style="width:${Math.min(100, (c.shield / c.maxHp) * 100).toFixed(1)}%;background:#9fd3ff"></i></div>` : ''}` : '';
  const dons = p.bag.filter(it => !it.cadenas && piecesObjet(p, it.rarity) > 0), gain = dons.reduce((a, it) => a + piecesObjet(p, it.rarity), 0);
  const plein = p.coffrePieces >= S[S.length - 1];
  const gauche = `<div class="trc">
    <img src="${v('assets/ui/coffre_tresor.webp')}" alt="Coffre Animé" class="${ko ? 'ko' : ''}">
    <div class="tot" style="color:${coul}">${p.coffrePieces}<small>pièces</small></div>
    <div class="sante">${sante}</div>
    <div class="gueule" data-gueule>${plein ? 'Le coffre est plein' : `Glisse ici un Rare (+${C.avale.rare}) ou un Épique (+${C.avale.epique})`}</div>
    <div class="btn2 ${dons.length && !plein ? '' : 'off'}" data-tout>${dons.length ? `Tout donner : ${dons.length} objet${dons.length > 1 ? 's' : ''}, +${gain} pièces` : 'Rien à donner'}</div>
    <div class="hint">Aussi : Maj + clic sur un objet du sac. Jamais les objets sous cadenas.</div>
  </div>`;
  // piste des paliers (3A) avec la vitrine (5B), puis la surcharge (6B)
  const tuiles = C.paliers.map((n, k) => {
    const ok = pal >= k, c2 = couleurCoffre(k);
    return `<div class="pal ${ok ? 'ok' : ''} ${pal === k ? 'ici' : ''}" style="--c:${c2}"><b style="color:${c2}">${noms[k]}</b>${n}${caseVitrine(w, k)}<span>+ ${texteAjout(C, k)}</span></div>`;
  }).join('');
  const sp = C.surcharge.paliers, surT = `<div class="pal sur ${sur ? 'ok ici' : ''}" style="--c:#ff5a3a"><b style="color:#ff6a4a">Surcharge</b>${sp.join(' · ')}
    <div class="vits">${sp.map((_, j) => caseVitrine(w, nb + j, true)).join('')}</div><span>+ ${texteAjout(C, nb)} par palier</span></div>`;
  // journal (3B)
  const journal = p.coffreJournal.length ? p.coffreJournal.map(l => `<div class="jr"><span title="${esc(l.t)}">${esc(l.t)}${l.fois ? ` ×${l.fois}` : ''}</span><b class="${l.n >= 0 ? 'p' : 'm'}">${l.n >= 0 ? '+' : '−'}${Math.abs(l.n)}</b></div>`).join('')
    : '<div class="hint">Les pièces gagnées et perdues s\'affichent ici.</div>';
  // sac (4A : à glisser) et records (3D)
  const objets = p.bag.filter(it => piecesObjet(p, it.rarity) > 0);
  const sac = objets.length ? objets.map(it => { const d = ITEMS.equipment[it.id];
    return `<div class="cell ${it.cadenas ? 'cad' : ''}" ${it.cadenas ? '' : 'draggable="true"'} data-du="${it.uid}">${iconHtml(d?.icon ?? 0)}<i class="r" style="background:${RARITY_COLORS[it.rarity]}"></i>${it.cadenas ? '' : `<span class="pc">+${piecesObjet(p, it.rarity)}</span>`}</div>`; }).join('')
    : '<div class="hint">Aucun Rare ni Épique dans ton sac.</div>';
  const R3 = p.coffreRecords;
  const records = `<div class="jr"><span>Coffres ouverts</span><b>${R3.ouverts}</b></div>
    <div class="jr"><span>Plus gros coffre</span><b>${R3.ouverts ? `${R3.plusGros} pièces` : '—'}</b></div>
    <div class="jr"><span>Meilleur palier</span><b style="color:${couleurCoffre(R3.palierMax)}">${R3.palierMax >= 0 ? noms[R3.palierMax] : '—'}</b></div>
    <div class="jr"><span>Légendaires sortis du coffre</span><b>${R3.legendaires}</b></div>
    <div class="jr"><span>Pièces gagnées en tout</span><b>${R3.total}</b></div>`;
  // ouvrir (2C)
  const peut = pal >= 0 && !!c && !ko;
  const warn = ko ? 'Le coffre est assommé : protège-le mieux la prochaine fois.' : sur ? 'Surcharge : il attire les monstres autour de lui, et s\'il tombe il perd TOUT.'
    : pal >= 0 && pal < nb - 1 ? `Encore ${S[pal + 1] - p.coffrePieces} pièces pour ${noms[pal + 1]}. S'il tombe, il perd la moitié de ses pièces et l'objet du dernier palier.` : '';
  const ouv = `<div class="ouv">${warn ? `<div class="warn">${warn}</div>` : ''}<div class="go ${peut ? '' : 'off'}" data-ouvrir>${pal >= 0 ? `Ouvrir le coffre ${noms[pal]}` : `${p.coffrePieces} / ${C.paliers[0]} pièces pour ouvrir`}</div></div>`;
  return `${titre}<div class="in tr">${gauche}<div class="trd"><div class="piste">${tuiles}${surT}</div>
    <div class="blocs"><div class="bloc"><h4>Journal des pièces</h4>${journal}</div>
    <div class="bloc"><h4>Rares et Épiques du sac</h4><div class="sac">${sac}</div><h4 style="margin-top:6px">Records</h4>${records}</div></div>${ouv}</div></div>`;
}

/** Objet du sac sous une case de la fenêtre. */
export function objetTresor(w: World, uid: number): Item | undefined { return w.player.bag.find(b => b.uid === uid); }
