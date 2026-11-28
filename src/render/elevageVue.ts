import { STAT_NAMES, type Stat } from '../sim/items';
import {
  CAPACITES, DUREES_EXPEDITION, MONTURE, NOM_TRAIT, OBJETS_ENCLOS, RACES, TEMPERAMENTS, TRAITS, dansAmakna, enfantsPossibles, feconde,
  horloge, lieuxExpedition, mure, race, statsMonture, traitNourriture, xpNiveau, type CmdElevage, type Monture,
} from '../sim/montures';
import type { World } from '../sim/world';
import { esc, iconeObjet, nomObjet } from './butinVue';

/** Fenêtre des montures et de l'élevage (« Élevage : » 8A, façon Dofus 3) : liste de l'écurie à gauche, fiche à droite
 *  (jauges des trois traits, capacités, bonus), enclos du Havre-Sac et d'Amakna (l'ordre compte : voisins, 2B),
 *  croisements possibles (4A), expéditions (2D), nourriture (2C), objets du Bricoleur (7B). */
export const ELEVAGE_CSS = `
.dw .win.elevage{width:min(980px,97vw);height:min(720px,95vh)}
.dw .elv{display:grid;grid-template-columns:270px minmax(0,1fr);gap:10px;padding:10px 12px 12px;min-height:0;overflow:hidden;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif;font-size:12.5px}
.dw .elv .col{display:flex;flex-direction:column;gap:6px;min-height:0;overflow:auto}
.dw .elv .mt{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:2px 8px;align-items:center;background:#2b2a26;border:1px solid #46443d;border-radius:6px;padding:5px 7px;cursor:pointer}
.dw .elv .mt.sel{border-color:#ffd86a;background:#35321f}
.dw .elv .mt .ct{grid-row:span 2}
.dw .elv .mt small{color:#c9c4ab}
.dw .elv .mt em{font-style:normal;color:#9ad15a;font-size:11px;white-space:nowrap}
.dw .elv .ct{width:28px;height:28px;border-radius:50%;border:2px solid #1118;background:conic-gradient(var(--a) 0 50%,var(--b) 0 75%,var(--c) 0)}
.dw .elv .ct.gros{width:56px;height:56px}
.dw .elv .fic{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}
.dw .elv .bloc{background:#1b1a13;border:1px solid #3a3626;border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.dw .elv h4{margin:0;font:bold 13px Lexend,sans-serif;color:#ffd86a}
.dw .elv .tete{display:flex;gap:10px;align-items:center}
.dw .elv .tete b{font:bold 17px Rowdies,Lexend,sans-serif}
.dw .elv .jg{display:grid;grid-template-columns:90px minmax(0,1fr) 44px;gap:6px;align-items:center}
.dw .elv .bar{height:9px;border-radius:5px;background:#0007;overflow:hidden}
.dw .elv .bar i{display:block;height:100%}
.dw .elv .tags{display:flex;gap:5px;flex-wrap:wrap}
.dw .elv .tag{background:#24231a;border:1px solid #4a4636;border-radius:4px;padding:2px 6px}
.dw .elv .bt{cursor:pointer;background:#3a2e1a;border:1px solid #8a6a3a;color:#ffd86a;font-weight:700;padding:4px 9px;border-radius:4px;display:inline-flex;gap:4px;align-items:center}
.dw .elv .bt.off{opacity:.4;pointer-events:none}
.dw .elv .rang{display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:40px}
.dw .elv .pl{display:flex;flex-direction:column;align-items:center;gap:2px;width:64px;font-size:10.5px;text-align:center;cursor:pointer}
.dw .elv .pl.sel .ct{outline:2px solid #ffd86a}
.dw .elv .msg{color:#ffb35c;min-height:16px}
.dw .elv .ligne{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dw .elv select{background:#24231a;color:#f2ead6;border:1px solid #4a4636;border-radius:4px;padding:3px}
.dw .elv .nour i{font-style:normal;display:inline-flex;gap:3px;align-items:center;cursor:pointer;background:#24231a;border:1px solid #4a4636;border-radius:4px;padding:2px 5px}
.dw .elv .nour i .ic{width:20px;height:20px}
@media (max-width:640px){.dw .elv{grid-template-columns:1fr}}
`;

const hex = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const pastille = (m: Monture, gros = false) => { const t = RACES[m.race]?.teinte ?? [0, 0, 0]; return `<span class="ct${gros ? ' gros' : ''}" style="--a:${hex(t[0])};--b:${hex(t[1] || t[0])};--c:${hex(t[3] || t[2] || t[0])}"></span>`; };
const COUL: Record<string, string> = { fougue: '#f2c45a', robustesse: '#9ad15a', flair: '#4fc3f7' };
const duree = (s: number) => s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}` : `${Math.max(1, Math.ceil(s / 60))} min`;

export interface EtatElevage { sel: number; partenaire: number; msg: string }
export const etatElevageVide = (): EtatElevage => ({ sel: 0, partenaire: 0, msg: '' });

function etat(m: Monture, w: World, actif: boolean, now: number): string {
  if (m.expedition) return `En expédition (${duree(m.expedition.fin - now)})`;
  if (m.gestation) return `Petits dans ${duree(m.gestation.fin - now)}`;
  if (actif) return w.player.monte ? 'Montée' : 'Équipée';
  const e = w.player.ecurie;
  if (e.enclos.includes(m.uid)) return 'Enclos du Havre-Sac';
  if (e.enclosLoue.includes(m.uid)) return "Enclos d'Amakna";
  return 'Étable';
}

export function elevageHtml(w: World, titre: string, s: EtatElevage): string {
  const p = w.player, e = p.ecurie, now = horloge(w);
  if (!e.montures.length) return `${titre}<div class="elv" style="grid-template-columns:1fr"><div class="bloc"><h4>Aucune monture pour l'instant</h4>
    <div>Les Dragodindes sauvages vivent chez les Koalaks, les Muldos au Bassin des Muldos de la Baie de Sufokia. Bats-en une : la première est toujours capturée, les suivantes une fois sur huit environ.</div></div></div>`;
  const sel = e.montures.find(m => m.uid === s.sel) ?? e.montures.find(m => m.uid === e.active) ?? e.montures[0];
  s.sel = sel.uid;
  const liste = e.montures.map(m => `<div class="mt ${m.uid === sel.uid ? 'sel' : ''}" data-sel="${m.uid}">${pastille(m)}
    <b>${esc(m.nom)} ${m.male ? '♂' : '♀'}</b><em>Niv. ${m.niveau}</em><small>Gén. ${race(m).gen} · ${etat(m, w, m.uid === e.active, now)}</small><span></span></div>`).join('');
  const r = race(sel), st = statsMonture(sel);
  const jauges = TRAITS.map(t => `<div class="jg"><span>${NOM_TRAIT[t]}</span><div class="bar"><i style="width:${sel[t]}%;background:${COUL[t]}"></i></div><span>${Math.floor(sel[t])}/100</span></div>`).join('');
  const bonus = (Object.entries(st) as [Stat, number][]).filter(([, v]) => v).map(([k, v]) => `<span class="tag">+${v} ${STAT_NAMES[k] ?? k}</span>`).join('');
  const capa = sel.capa.map(c => `<span class="tag" title="${esc(CAPACITES[c]?.officiel ?? '')}">${esc(CAPACITES[c]?.nom ?? '?')}</span>`).join('') || '<span class="tag">Aucune</span>';
  const occupe = !!(sel.expedition || sel.gestation), actif = sel.uid === e.active, loue = e.loueJusqua > now;
  const bt = (cmd: string, txt: string, ok = true, tip = '') => `<span class="bt ${ok ? '' : 'off'}" data-cmd='${cmd}' title="${esc(tip)}">${txt}</span>`;
  const J = (c: CmdElevage) => esc(JSON.stringify(c));
  const actions = [
    bt(J({ k: 'equiper', uid: sel.uid }), actif ? 'Équipée' : 'Équiper', !actif && !occupe),
    bt(J({ k: 'ranger', uid: sel.uid, ou: 'havre' }), 'Enclos du Havre-Sac', !e.enclos.includes(sel.uid) && !sel.expedition && e.enclos.length < MONTURE.enclos),
    bt(J({ k: 'ranger', uid: sel.uid, ou: 'amakna' }), "Enclos d'Amakna", loue && !e.enclosLoue.includes(sel.uid) && !sel.expedition, loue ? '' : "Loue d'abord l'enclos d'Amakna"),
    bt(J({ k: 'ranger', uid: sel.uid, ou: null }), "À l'étable", (e.enclos.includes(sel.uid) || e.enclosLoue.includes(sel.uid))),
    bt(J({ k: 'liberer', uid: sel.uid }), 'Libérer', !occupe, 'Elle retourne à la vie sauvage (définitif).'),
  ].join('');
  // 2C : nourriture de récolte que le perso a sur lui
  const nour = Object.entries(p.resources).filter(([id, n]) => n > 0 && traitNourriture(id)).slice(0, 24)
    .map(([id, n]) => `<i data-cmd='${J({ k: 'nourrir', uid: sel.uid, res: id, n: 10 })}' title="${esc(nomObjet(id))} (${n}) : ${NOM_TRAIT[traitNourriture(id)!]}, clic = 10">${iconeObjet(id)}${n}</i>`).join('') || '<span>Pas de céréales, poissons ni plantes dans ton sac.</span>';
  // 2D : expéditions
  const lieux = lieuxExpedition(w, p);
  const exp = sel.expedition ? `<div>Partie dans ${esc(w.zone.open?.subareas[sel.expedition.sub]?.name ?? '?')}, retour dans ${duree(sel.expedition.fin - now)}.</div>`
    : `<div class="ligne"><select data-lieu>${lieux.map(l => `<option value="${l.sub}">${esc(l.nom)} (niv. ${l.niveau})</option>`).join('')}</select>
       <select data-duree>${DUREES_EXPEDITION.map(d => `<option value="${d}">${duree(d)}</option>`).join('')}</select>
       <span class="bt ${occupe || !lieux.length ? 'off' : ''}" data-exp="${sel.uid}">Envoyer</span></div>`;
  // 4A : croisement avec le partenaire choisi
  const autres = e.montures.filter(m => m.uid !== sel.uid && m.male !== sel.male && race(m).famille === r.famille);
  const part = autres.find(m => m.uid === s.partenaire) ?? autres[0];
  const enfants = part ? enfantsPossibles(sel.race, part.race) : [];
  const tot = enfants.reduce((a, x) => a + x.poids, 0);
  const crois = part ? `<div class="ligne"><select data-part>${autres.map(m => `<option value="${m.uid}" ${m === part ? 'selected' : ''}>${esc(m.nom)} (gén. ${race(m).gen})</option>`).join('')}</select>
      <span class="bt ${feconde(sel, now) && feconde(part, now) ? '' : 'off'}" data-cmd='${J({ k: 'accoupler', a: sel.uid, b: part.uid })}' title="Les deux dans un enclos, adultes et fertiles">Accoupler</span></div>
      <div class="tags">${enfants.map(x => `<span class="tag">${esc(RACES[x.race].nom)} · gén. ${RACES[x.race].gen} · ${Math.round(100 * x.poids / tot)} %</span>`).join('')}</div>`
    : `<div>Il faut une monture ${sel.male ? 'femelle' : 'mâle'} de la même famille.</div>`;
  const maturite = mure(sel, now) ? (sel.portees >= MONTURE.sterile ? 'Stérile' : `Adulte · ${sel.portees}/${MONTURE.sterile} portées`) : `Adulte dans ${duree(MONTURE.maturite - (now - sel.nee))}`;
  // 1A + 1C : les enclos, dans l'ordre (2B : chaque bête transmet son tempérament à ses voisins, chaque heure)
  const rang = (l: number[], cap: number) => `<div class="rang">${l.map(u => { const m = e.montures.find(x => x.uid === u); return m ? `<div class="pl ${u === sel.uid ? 'sel' : ''}" data-sel="${u}">${pastille(m)}<span>${esc(m.nom.replace(/^(Dragodinde|Muldo) /, ''))}</span><span>${TEMPERAMENTS[m.temp].nom}</span></div>` : ''; }).join('')}<small>${l.length}/${cap}</small></div>`;
  const dep = e.enclos.includes(sel.uid) || e.enclosLoue.includes(sel.uid) ? `<div class="ligne">${bt(J({ k: 'deplacer', uid: sel.uid, de: -1 }), '◀ Décaler')}${bt(J({ k: 'deplacer', uid: sel.uid, de: 1 }), 'Décaler ▶')}</div>` : '';
  const loyer = `<div class="ligne">${loue ? `<span>Loué encore ${duree(e.loueJusqua - now)}.</span>` : '<span>Pas loué.</span>'}
    ${bt(J({ k: 'louer' }), `${loue ? 'Prolonger' : 'Louer'} une semaine (${MONTURE.loyer.toLocaleString('fr-FR')} kamas)`, dansAmakna(w, p), "À louer dans Amakna")}</div>`;
  const atelier = w.atelierIci('bricoleur') !== null, niv = p.metierLevel('bricoleur');
  const objets = Object.entries(OBJETS_ENCLOS).map(([id, o]) => {
    const a = e.objets.includes(id), ok = o.recette.every(([x, q]) => (p.resources[x] ?? 0) >= q);
    return `<div class="ligne"><b>${esc(o.nom)}</b><span>${esc(o.effet)}</span>${a ? '<span class="tag">Posé</span>' : `${o.recette.map(([x, q]) => `<span class="tag">${iconeObjet(x)} ${q}</span>`).join('')}
      ${bt(J({ k: 'fabriquer', id }), 'Fabriquer', ok && atelier && niv >= o.niveau, !atelier ? 'À un atelier de Bricoleur' : niv < o.niveau ? `Bricoleur niveau ${o.niveau}` : ok ? '' : 'Ingrédients manquants')}`}</div>`;
  }).join('');
  const gens = `Dragodindes : génération ${e.generations.dragodinde}/10 · Muldos : génération ${e.generations.muldo}/10`;
  return `${titre}<div class="elv">
    <div class="col">${liste}<div class="bloc"><small>${gens}</small></div></div>
    <div class="fic">
      <div class="msg">${esc(s.msg)}</div>
      <div class="bloc"><div class="tete">${pastille(sel, true)}<div><b>${esc(sel.nom)}</b> ${sel.male ? '♂' : '♀'}<br>
        ${esc(r.nom)} · génération ${r.gen} · ${TEMPERAMENTS[sel.temp].nom} · ${maturite}<br>
        Niveau ${sel.niveau}${sel.niveau < MONTURE.niveauMax ? ` · ${sel.xp}/${xpNiveau(sel.niveau)} XP` : ''}</div></div>
        ${jauges}<div class="tags">${bonus}</div><div class="tags">Capacités : ${capa}</div><div class="ligne">${actions}</div></div>
      <div class="bloc"><h4>Enclos du Havre-Sac</h4>${rang(e.enclos, MONTURE.enclos)}<h4>Enclos d'Amakna</h4>${loue ? rang(e.enclosLoue, MONTURE.enclosLoue) : ''}${loyer}${dep}
        <small>Chaque heure, même jeu fermé, une monture gagne le trait du tempérament de ses deux voisins.</small></div>
      <div class="bloc"><h4>Croisements</h4>${crois}<small>Gestation ${duree(MONTURE.gestation)}, 1 à 3 petits, stérile après ${MONTURE.sterile} portées.</small></div>
      <div class="bloc"><h4>Nourrir</h4><div class="nour tags">${nour}</div><small>Céréales : Fougue · Poissons : Robustesse · Plantes : Flair.</small></div>
      <div class="bloc"><h4>Expédition</h4>${exp}<small>Elle revient avec des ressources de la région et de l'expérience ; trop dure, elle revient blessée avec peu.</small></div>
      <div class="bloc"><h4>Objets de l'enclos (Bricoleur)</h4>${objets}</div>
    </div></div>`;
}

export function brancherElevage(win: HTMLElement, w: World, s: EtatElevage, refaire: () => void) {
  const faire = (c: CmdElevage) => { s.msg = w.elevage(c) ?? ''; refaire(); };
  win.querySelectorAll<HTMLElement>('[data-sel]').forEach(el => el.addEventListener('click', () => { s.sel = +el.dataset.sel!; s.msg = ''; refaire(); }));
  win.querySelectorAll<HTMLElement>('[data-cmd]').forEach(el => el.addEventListener('click', () => faire(JSON.parse(el.dataset.cmd!))));
  win.querySelector<HTMLSelectElement>('[data-part]')?.addEventListener('change', ev => { s.partenaire = +(ev.target as HTMLSelectElement).value; refaire(); });
  win.querySelector<HTMLElement>('[data-exp]')?.addEventListener('click', () => {
    const sub = win.querySelector<HTMLSelectElement>('[data-lieu]')?.value, d = +(win.querySelector<HTMLSelectElement>('[data-duree]')?.value ?? 0);
    if (sub) faire({ k: 'expedition', uid: s.sel, sub, duree: d });
  });
}
