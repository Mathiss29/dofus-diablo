import { IDOLES_DEFS, ORDRE_IDOLES, REGLES_IDOLES, scoreIdoles } from '../sim/idoles';
import type { World } from '../sim/world';
import { esc, iconeObjet, nomObjet } from './butinVue';
import { iconHtml } from './icons';

/** Fenêtre des idoles (maquette 0.6, questions 17-18) : les 6 places actives, le score et son bonus, les 3 jeux enregistrés,
 *  puis les idoles par famille (fabriquer chez le Bricoleur, activer, retirer). Les clics passent par le World. */
export const IDOLES_CSS = `
.dw .win.idoles{width:min(820px,96vw);height:auto;max-height:min(700px,94vh)}
.dw .ido{padding:10px 12px 12px;display:grid;gap:10px;overflow:auto;min-height:0;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif}
.dw .ido .haut{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#1b1a13;border:1px solid #3a3626;border-radius:6px;padding:8px 10px}
.dw .ido .act{display:flex;gap:6px;flex-wrap:wrap}
.dw .ido .pl{width:46px;height:46px;border-radius:6px;border:1px dashed #4a4636;display:grid;place-items:center;background:#12110c;cursor:pointer}
.dw .ido .pl.plein{border:2px solid var(--c);box-shadow:inset 0 0 10px var(--c)}
.dw .ido .pl .ic,.dw .ido .idc .ic{width:38px;height:38px}
.dw .ido .sc{text-align:right;line-height:1.25}
.dw .ido .sc b{font:bold 22px Rowdies,Lexend,sans-serif;color:#ffd86a}
.dw .ido .sc small{display:block;font-size:11.5px;color:#c9c4ab}
.dw .ido .jeux{display:flex;gap:6px;flex-wrap:wrap;font-size:12px}
.dw .ido .jeu{display:flex;gap:4px;align-items:center;background:#24231a;border:1px solid #3a3626;border-radius:4px;padding:3px 6px}
.dw .ido .jeu span{cursor:pointer;color:#b9e54b;font-weight:700}
.dw .ido .jeu span.off{opacity:.35;pointer-events:none}
.dw .ido .msg{font-size:12.5px;color:#ffb35c;min-height:16px}
.dw .ido .fam{display:grid;gap:6px}
.dw .ido .fam h4{margin:4px 0 0;font:bold 13px Lexend,sans-serif;color:var(--c);display:flex;gap:6px;align-items:center}
.dw .ido .fam h4 .ic{width:22px;height:22px}
.dw .ido .lst{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px}
.dw .ido .idc{display:grid;grid-template-columns:40px minmax(0,1fr);gap:4px 8px;background:#2b2a26;border:1px solid #46443d;border-radius:6px;padding:6px 8px;font-size:12px;line-height:1.3}
.dw .ido .idc.on{border-color:var(--c);background:#30301f;box-shadow:0 0 0 1px var(--c) inset}
.dw .ido .idc.non .ic{filter:grayscale(1) brightness(.55)}
.dw .ido .idc .t{display:flex;justify-content:space-between;gap:6px}
.dw .ido .idc .t b{font-size:13px}
.dw .ido .idc .t em{font-style:normal;color:#ffd86a;font-weight:700;white-space:nowrap}
.dw .ido .idc .d{color:#c9c4ab}
.dw .ido .idc .r{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;color:#c9c4ab}
.dw .ido .idc .r i{font-style:normal;display:inline-flex;gap:2px;align-items:center}
.dw .ido .idc .r i .ic{width:20px;height:20px}
.dw .ido .idc .r i.ko{color:#ff7b6b}
.dw .ido .idc .r .bt{margin-left:auto;cursor:pointer;background:#3a2e1a;border:1px solid #8a6a3a;color:#ffd86a;font-weight:700;padding:3px 8px;border-radius:4px}
.dw .ido .idc .r .bt.off{opacity:.4;pointer-events:none}
`;

const pc = (x: number) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');

export function idolesHtml(w: World, titre: string, msg: string): string {
  const p = w.player, e = p.idoles, F = REGLES_IDOLES.familles;
  const score = scoreIdoles(e.actives), plaf = REGLES_IDOLES.plafondDonjon;
  const coul = (id: string) => F[IDOLES_DEFS[id].famille]?.couleur ?? '#ccc';
  const places = Array.from({ length: REGLES_IDOLES.max }, (_, i) => {
    const id = e.actives[i];
    return id ? `<div class="pl plein" style="--c:${coul(id)}" data-ido="${id}" title="${esc(IDOLES_DEFS[id].nom)} (clic : retirer)">${iconHtml(+F[IDOLES_DEFS[id].famille].icone)}</div>`
      : '<div class="pl" title="Place libre"></div>';
  }).join('');
  const jeux = e.jeux.map((j, i) => `<div class="jeu"><b>${esc(j?.nom ?? `Jeu ${i + 1}`)}</b>${j ? ` (${j.ids.length})` : ''}
    <span data-charger="${i}" class="${j ? '' : 'off'}">Charger</span><span data-garder="${i}">Enregistrer</span></div>`).join('');
  const atelier = w.atelierIci('bricoleur') !== null, niv = p.metierLevel('bricoleur');
  const fams = Object.entries(F).map(([k, f]) => {
    const ids = ORDRE_IDOLES.filter(id => IDOLES_DEFS[id].famille === k);
    const cartes = ids.map(id => {
      const I = IDOLES_DEFS[id], a = e.possedees.includes(id), on = e.actives.includes(id);
      let bas = '';
      if (!a) {
        const r = w.recetteIdole(id), ok = r.every(([x, q]) => (p.resources[x] ?? 0) >= q), peut = ok && atelier && niv >= I.niveau;
        const titre = !atelier ? 'Il faut être à un atelier de Bricoleur' : niv < I.niveau ? `Bricoleur niveau ${I.niveau} requis` : ok ? '' : 'Ingrédients manquants';
        bas = `<div class="r">${r.map(([x, q]) => `<i class="${(p.resources[x] ?? 0) >= q ? '' : 'ko'}" title="${esc(nomObjet(x))} : ${p.resources[x] ?? 0}/${q}">${iconeObjet(x)}${q}</i>`).join('')}
          <span class="bt ${peut ? '' : 'off'}" data-fab="${id}" title="${titre}">Fabriquer</span></div>`;
      } else bas = `<div class="r"><span class="bt" data-ido="${id}">${on ? 'Retirer' : 'Activer'}</span></div>`;
      return `<div class="idc ${on ? 'on' : ''} ${a ? '' : 'non'}" style="--c:${f.couleur}">${iconHtml(+f.icone)}
        <div><div class="t"><b>${esc(I.nom)}</b><em>${I.score} pts</em></div><div class="d">${esc(I.desc)}</div>
        ${a ? '' : `<div class="d">Bricoleur niveau ${I.niveau}</div>`}</div>${bas}</div>`;
    }).join('');
    return `<div class="fam" style="--c:${f.couleur}"><h4>${iconHtml(+f.icone)}${esc(f.nom)}</h4><div class="lst">${cartes}</div></div>`;
  }).join('');
  return `${titre}<div class="ido">
    <div class="haut"><div class="act">${places}</div>
      <div class="sc"><b>${score}</b> pts<small>+${pc(score * REGLES_IDOLES.pctParPoint / 100)} d'XP et de butin</small>
      <small>En donjon : +${pc(Math.min(score, plaf) * REGLES_IDOLES.pctParPoint / 100)} (plafond ${plaf} pts)</small></div></div>
    <div class="jeux">${jeux}</div>
    <div class="msg">${esc(msg || 'Une idole par famille, 6 au plus. Les monstres sont plus forts, le butin plus riche. Pas dans les Enfers.')}</div>
    ${fams}</div>`;
}

/** Branche les clics ; refaire() redessine avec le message éventuel. */
export function brancherIdoles(win: HTMLElement, w: World, refaire: (msg?: string) => void) {
  win.querySelectorAll<HTMLElement>('[data-ido]').forEach(el => el.addEventListener('click', () => refaire(w.basculerIdole(el.dataset.ido!) ?? '')));
  win.querySelectorAll<HTMLElement>('[data-fab]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.fab!, err = w.fabriquerIdole(id);
    refaire(err ?? `${IDOLES_DEFS[id].nom} fabriquée.`);
  }));
  win.querySelectorAll<HTMLElement>('[data-charger]').forEach(el => el.addEventListener('click', () => refaire(w.chargerJeuIdoles(+el.dataset.charger!) ?? 'Jeu chargé.')));
  win.querySelectorAll<HTMLElement>('[data-garder]').forEach(el => el.addEventListener('click', () => { w.enregistrerJeuIdoles(+el.dataset.garder!); refaire('Jeu enregistré.'); }));
}
