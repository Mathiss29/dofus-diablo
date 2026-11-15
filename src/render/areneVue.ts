import { GAME_DATA } from '../sim/data';
import { ARENE_AMES, cleFile, type AmeDef } from '../sim/areneAmes';
import { scoreIdoles } from '../sim/idoles';
import type { World } from '../sim/world';
import { LOOKS } from './looks';
import { archisParLieu, dessinerPortraits, esc, groupesBestiaire, iconeObjet, nomObjet } from './butinVue';

/** Fenêtre de l'arène des âmes (ligne « Arène : » du 15 novembre 2026), ouverte par la Gardienne ou le Gardien de l'arène :
 *  onglets Boss / Archimonstres (3A), fiche de l'âme (3B), filtres par région et « jamais vaincu » (3C), âmes manquantes en gris
 *  avec où les capturer (3D), file de 1 à 5 âmes (5A, 13A), idoles et groupe (7A, 7B), records (7C), âme de la semaine (16A). */
export const ARENE_CSS = `
.dw .win.arene{width:min(900px,96vw);height:min(640px,94vh)}
.dw .ara{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif;font-size:13px}
.dw .ara .tabs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px 12px;border-bottom:1px solid #3a3626}
.dw .ara .tabs span{padding:4px 10px;border-radius:5px;background:#24231a;color:#c9c4ab;cursor:pointer}
.dw .ara .tabs span.on{background:#3b2f1c;color:#ffd86a;border:1px solid #8a6a3a}
.dw .ara .tabs select{margin-left:auto;background:#1b1a13;color:#f2ead6;border:1px solid #3a3626;border-radius:4px;padding:3px 6px}
.dw .ara .tabs label{display:flex;gap:4px;align-items:center;color:#c9c4ab;cursor:pointer}
.dw .ara .corps{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);min-height:0}
.dw .ara .liste{overflow:auto;border-right:1px solid #3a3626;min-height:0}
.dw .ara .bh{padding:6px 10px 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8d8471}
.dw .ara .am{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:3px 10px;border-bottom:1px solid #26251d;cursor:pointer}
.dw .ara .am canvas{width:44px;height:44px}
.dw .ara .am.off{opacity:.42}
.dw .ara .am.off canvas{filter:grayscale(1)}
.dw .ara .am.on{background:#2f2616;box-shadow:inset 3px 0 0 #ffd86a}
.dw .ara .am small{color:#9a927f}
.dw .ara .am b.n{color:#ffd86a;min-width:28px;text-align:right}
.dw .ara .am .ok{color:#7fc47a;font-size:11px}
.dw .ara .fiche{padding:10px 12px;display:grid;gap:8px;align-content:start;overflow:auto;min-height:0}
.dw .ara .hd{display:flex;gap:10px;align-items:center}
.dw .ara .hd canvas{width:84px;height:84px;background:#12110c;border:1px solid #3a3626;border-radius:8px}
.dw .ara .hd small{color:#9a927f}
.dw .ara .lb{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8d8471}
.dw .ara .tx{color:#c9c4ab;line-height:1.35}
.dw .ara .file{display:flex;gap:6px;flex-wrap:wrap}
.dw .ara .file .ame{display:flex;gap:4px;align-items:center;background:#24231a;border:1px solid #3a3626;border-radius:5px;padding:2px 6px;cursor:pointer}
.dw .ara .file .ame .ic{width:24px;height:24px}
.dw .ara .file .vide{color:#7d7666;font-style:italic}
.dw .ara .bt{cursor:pointer;background:#3a2e1a;border:1px solid #8a6a3a;color:#ffd86a;font-weight:700;padding:4px 10px;border-radius:4px;justify-self:start}
.dw .ara .bt.off{opacity:.4;pointer-events:none}
.dw .ara .go{justify-self:stretch;text-align:center;padding:9px;font-size:14px;background:linear-gradient(#a8722e,#7a4f1c);color:#fff3dc;border-color:#c08a3e}
.dw .ara .semaine{display:flex;gap:8px;align-items:center;background:#1b1a13;border:1px solid #3a3626;border-radius:6px;padding:6px 8px}
.dw .ara .semaine .ic{width:32px;height:32px}
.dw .ara .msg{color:#ffb35c;min-height:16px}
@media (max-width:700px){.dw .ara .corps{grid-template-columns:1fr}}
`;

export interface EtatArene { onglet: 'boss' | 'archis'; region: string; jamais: boolean; choix: string | null; file: string[]; msg: string }
export const etatAreneVide = (): EtatArene => ({ onglet: 'boss', region: '', jamais: false, choix: null, file: [], msg: '' });

/** Où se capture une âme : donjon du boss, ou sous-zone du monstre de l'archimonstre. */
function lieuDe(a: AmeDef): { zone: string; nom: string } {
  if (a.boss) { const g = groupesBestiaire().find(x => x.donjon && x.monstres.includes(a.type)); return g ? { zone: g.zone, nom: g.nom } : { zone: 'Donjons', nom: 'Boss de donjon' }; }
  const g = archisParLieu().find(x => x.archis.includes(a.type));
  return g ? { zone: g.zone, nom: g.nom } : { zone: 'Ailleurs', nom: '' };
}
const chrono = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const portrait = (type: string, px: number) => `<canvas data-atlas="${LOOKS[GAME_DATA.monsters[type]?.look]?.atlas ?? ''}" width="${px}" height="${px}"></canvas>`;

export function areneHtml(w: World, titre: string, e: EtatArene): string {
  const p = w.player, M = GAME_DATA.monsters, toutes = w.toutesAmes(), nb = (id: string) => p.resources[id] ?? 0;
  const regions = [...new Set(toutes.map(a => lieuDe(a).zone))];
  const vues = toutes.filter(a => a.boss === (e.onglet === 'boss') && (!e.region || lieuDe(a).zone === e.region) && (!e.jamais || !(p.areneAmes.v[a.type] > 0)));
  if (!e.choix || !toutes.some(a => a.id === e.choix)) e.choix = vues.find(a => nb(a.id))?.id ?? vues[0]?.id ?? null;
  let lieu = '';
  const lignes = vues.map(a => {
    const l = lieuDe(a), tete = l.nom !== lieu ? `<div class="bh">${esc(l.zone)}${l.nom ? ` · ${esc(l.nom)}` : ''}</div>` : ''; lieu = l.nom;
    const v = p.areneAmes.v[a.type] ?? 0;
    return `${tete}<div class="am ${nb(a.id) ? '' : 'off'} ${a.id === e.choix ? 'on' : ''}" data-ame="${a.id}">${portrait(a.type, 44)}
      <span>${esc(M[a.type].name)}<br><small>niv. ${M[a.type].level ?? '?'}${v ? ` · <span class="ok">${v} victoire${v > 1 ? 's' : ''}</span>` : ''}</small></span><span></span><b class="n">${nb(a.id) ? `×${nb(a.id)}` : '—'}</b></div>`;
  }).join('') || '<div class="tx" style="padding:12px">Aucune âme ici.</div>';
  const a = toutes.find(x => x.id === e.choix), d = a ? M[a.type] : undefined;
  let fiche = '<div class="tx">Choisis une âme à gauche.</div>';
  if (a && d) {
    const l = lieuDe(a), v = p.areneAmes.v[a.type] ?? 0, rec = p.areneAmes.rec[a.type], recS = p.areneAmes.recSem[a.type];
    const ou = nb(a.id) ? '' : `<div class="tx">Pas d'âme en poche. ${a.boss ? `Bats ${esc(d.name)} (${esc(l.nom)}) avec une Petite pierre d'âme dans le sac.` : `Il remplace parfois un ${esc(M[d.archiDe!]?.name ?? 'monstre')}${l.nom ? ` (${esc(l.nom)})` : ''} : bats-le avec une Petite pierre d'âme dans le sac.`} ${p.ames.includes(a.type) ? 'Elle reste notée au registre de l\'Assistante.' : ''}</div>`;
    const plein = e.file.length >= ARENE_AMES.max, reste = nb(a.id) - e.file.filter(x => x === a.id).length;
    fiche = `<div class="hd">${portrait(a.type, 84)}<div><b>${esc(d.name)}</b><br><small>Niveau ${d.level ?? '?'} · ${esc(l.zone)}${l.nom ? ` · ${esc(l.nom)}` : ''}</small><br>
      <small>${a.boss ? 'Boss de donjon : il revient seul.' : 'Archimonstre : il revient avec 3 à 5 monstres de sa famille, et donne un Rare à coup sûr.'}</small></div></div>
      ${ou}
      <div class="tx">${v ? `${v} victoire${v > 1 ? 's' : ''} contre lui` : 'Jamais vaincu dans l\'arène'}${rec ? ` · meilleur temps ${chrono(rec)}` : ''}${recS && p.areneAmes.sem ? ` · cette semaine ${chrono(recS)}` : ''}</div>
      <span class="bt ${reste > 0 && !plein ? '' : 'off'}" data-ajout="${a.id}">Ajouter à la file</span>`;
  }
  const file = e.file.length ? e.file.map((id, i) => `<span class="ame" data-retire="${i}" title="Retirer">${iconeObjet(id)}${esc(M[w.opts.items?.resources[id]?.ame ?? '']?.name ?? nomObjet(id))} ✕</span>`).join('') : '<span class="vide">Vide : ajoute 1 à 5 âmes</span>';
  const types = e.file.map(id => w.opts.items?.resources[id]?.ame ?? ''), boss = types.filter(t => !M[t]?.archiDe).length;
  const recFile = e.file.length > 1 ? p.areneAmes.rec[cleFile(types)] : undefined;
  const groupe = w.players.filter(q => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= ARENE_AMES.rayonGroupe);
  const loin = w.players.filter(q => !groupe.includes(q));
  const sc = p.v06 ? scoreIdoles(p.idoles.actives) : 0;
  const s = w.ameDeLaSemaine(), sDispo = w.ameDeLaSemaineDispo();
  const semaine = s ? `<div class="semaine">${iconeObjet(s.id)}<div style="flex:1"><b>Âme de la semaine : ${esc(M[s.type]?.name ?? '')}</b><br><small class="tx">${esc(ARENE_AMES.lundi.texte)}${p.areneAmes.recSem[s.type] && p.areneAmes.sem ? ` Ton temps cette semaine : ${chrono(p.areneAmes.recSem[s.type])}.` : ''}</small></div>
    <span class="bt ${sDispo ? '' : 'off'}" data-semaine>${sDispo ? 'Prendre' : 'Déjà prise'}</span></div>` : '';
  const pret = w.pretPourArene() && !w.combatAmes;
  const droite = `${fiche}
    <div class="lb">File (${e.file.length} / ${ARENE_AMES.max})</div><div class="file">${file}</div>
    ${boss >= ARENE_AMES.chaine.min ? `<div class="tx">Enchaînement de ${boss} boss : grand coffre garanti à la fin.</div>` : ''}${recFile ? `<div class="tx">Record de cette file : ${chrono(recFile)}</div>` : ''}
    <div class="lb">Défi</div><div class="tx">Tiré au hasard en entrant (sans potion, contre la montre, toujours en mouvement, sans une égratignure). Réussi : un tirage de butin de boss en plus par âme. Une âme sur vingt revient corrompue : 2 affixes, butin doublé.</div>
    <div class="lb">Idoles</div><div class="tx">${p.v06 ? `Score ${sc}${sc ? ` : monstres plus durs, butin et XP en plus` : ' : aucune idole active'}. <span class="bt" data-idoles style="display:inline-block;padding:1px 8px">Idoles (Y)</span>` : 'Les idoles arrivent avec la 0.6.'}</div>
    <div class="lb">Groupe</div><div class="tx">${groupe.map(q => q === p ? 'Toi' : esc(q.nom ?? 'Allié')).join(' · ')}${loin.length ? ` · <i>${loin.map(q => esc(q.nom ?? 'Allié')).join(', ')} trop loin</i>` : ''}</div>
    ${semaine}
    <div class="msg">${esc(e.msg)}</div>
    <span class="bt go ${e.file.length && pret ? '' : 'off'}" data-invoquer>${w.combatAmes ? 'L\'arène est occupée' : `Invoquer · ${e.file.length} âme${e.file.length > 1 ? 's' : ''}`}</span>`;
  return `${titre}<div class="ara">
    <div class="tabs"><span class="${e.onglet === 'boss' ? 'on' : ''}" data-onglet="boss">Boss · ${toutes.filter(x => x.boss && nb(x.id)).length}</span><span class="${e.onglet === 'archis' ? 'on' : ''}" data-onglet="archis">Archimonstres · ${toutes.filter(x => !x.boss && nb(x.id)).length}</span>
      <select data-region><option value="">Toutes les régions</option>${regions.map(r => `<option ${r === e.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <label><input type="checkbox" data-jamais ${e.jamais ? 'checked' : ''}>Jamais vaincu</label></div>
    <div class="corps"><div class="liste">${lignes}</div><div class="fiche">${droite}</div></div></div>`;
}

export function brancherArene(root: HTMLElement, w: World, e: EtatArene, maj: () => void, idoles: () => void, fermer: () => void) {
  dessinerPortraits(root);
  const on = (sel: string, f: (el: HTMLElement) => void) => root.querySelectorAll<HTMLElement>(sel).forEach(el => el.addEventListener('click', () => f(el)));
  on('[data-onglet]', el => { e.onglet = el.dataset.onglet as EtatArene['onglet']; e.choix = null; maj(); });
  on('[data-ame]', el => { e.choix = el.dataset.ame!; maj(); });
  on('[data-ajout]', el => { if (e.file.length < ARENE_AMES.max) e.file.push(el.dataset.ajout!); maj(); });
  on('[data-retire]', el => { e.file.splice(+el.dataset.retire!, 1); maj(); });
  on('[data-idoles]', () => idoles());
  on('[data-semaine]', () => { e.msg = w.prendreAmeDeLaSemaine() ? 'Âme de la semaine ajoutée à ton sac.' : ''; maj(); });
  on('[data-invoquer]', () => { if (w.invoquerAmes(e.file)) { e.file = []; e.msg = ''; fermer(); } else { e.msg = 'Impossible pour l\'instant.'; maj(); } });
  root.querySelector<HTMLSelectElement>('[data-region]')?.addEventListener('change', ev => { e.region = (ev.target as HTMLSelectElement).value; e.choix = null; maj(); });
  root.querySelector<HTMLInputElement>('[data-jamais]')?.addEventListener('change', ev => { e.jamais = (ev.target as HTMLInputElement).checked; e.choix = null; maj(); });
}
