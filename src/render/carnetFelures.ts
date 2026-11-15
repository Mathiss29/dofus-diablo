import type { ActeDef } from '../sim/campagne';
import { SCEAUX } from '../sim/campagne';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../sim/items';
import type { World } from '../sim/world';
import { esc } from './butinVue';

/** Fenêtre « Le Carnet des Fêlures » (maquette Campagne 1A, touche W) : les actes à gauche, un par région, avec leur avancement ;
 *  à droite l'acte choisi : la bulle du guide, les chapitres, les objectifs du chapitre en cours, la récompense de fin d'acte,
 *  et les boutons Suivre, Voir sur la carte (Zaap conseillé, 2C) et Passer l'acte (8A, dès le 2e perso).
 *  Lit world.quetes ; les clics passent par les fonctions données (la fenêtre ne modifie pas la partie elle-même). */
export const CARNET_CSS = `
.dw .win.campagne{width:min(900px,96vw);height:min(620px,94vh)}
.dw .cdf{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;color:#f2ead6;font-family:Lexend,Nunito,system-ui,sans-serif}
.dw .cdf .sx{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #3a3626;background:#17150f}
.dw .cdf .sx b{font:bold 13px Lexend,sans-serif;color:#e6b85c;white-space:nowrap}
.dw .cdf .sx .pips{display:flex;gap:4px;flex-wrap:wrap}
.dw .cdf .sx .pip{width:16px;height:16px;border-radius:50%;border:2px solid #4a4636;background:#12110c}
.dw .cdf .sx .pip.on{border-color:#e6b85c;background:radial-gradient(circle at 40% 35%,#ffe29a,#b47a1c);box-shadow:0 0 6px #e6b85c99}
.dw .cdf .sx small{margin-left:auto;color:#a8a28a;font-size:11.5px}
.dw .cdf .co{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:0}
.dw .cdf .ac{border-right:1px solid #3a3626;padding:8px;display:grid;gap:4px;align-content:start;overflow:auto;background:#14130e}
.dw .cdf .a{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;padding:6px 8px;border-radius:5px;border:1px solid transparent;cursor:pointer}
.dw .cdf .a:hover{background:#1f1d15}
.dw .cdf .a.on{border-color:#8a6a3a;background:#2a2214}
.dw .cdf .a .p{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:bold 12px Lexend,sans-serif;border:2px solid #4a4636;color:#a8a28a}
.dw .cdf .a.fait .p{border-color:#6fcf97;color:#6fcf97}
.dw .cdf .a.cours .p{border-color:#e6b85c;color:#e6b85c;box-shadow:0 0 8px #e6b85c66}
.dw .cdf .a.tard{opacity:.6}
.dw .cdf .a .t{font:bold 13px/1.2 Lexend,sans-serif}
.dw .cdf .a .s{font-size:11px;color:#a8a28a}
.dw .cdf .a .b{display:block;height:4px;background:#2c2a20;border-radius:2px;margin-top:4px;overflow:hidden}
.dw .cdf .a .b i{display:block;height:100%;background:#e6b85c}
.dw .cdf .de{padding:12px 14px;display:grid;gap:10px;align-content:start;overflow:auto}
.dw .cdf .de h3{margin:0;font:bold 20px Rowdies,Lexend,sans-serif;color:#e6b85c}
.dw .cdf .de .li{color:#a8a28a;font-size:12.5px}
.dw .cdf .de .re{font-size:13px;color:#d8d0b8;line-height:1.45}
.dw .cdf .gu{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:start;background:#1d1b14;border:1px solid #3a3626;border-radius:6px;padding:8px 10px}
.dw .cdf .gu .po{width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#7a6a4a,#2a2418);display:grid;place-items:center;font:bold 16px Rowdies,serif;color:#fff}
.dw .cdf .gu b{display:block;color:#e6b85c;font-size:12px}
.dw .cdf .gu p{margin:0;font-size:13px;line-height:1.4}
.dw .cdf .ch{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;align-items:start;padding:7px 10px;border:1px solid #3a3626;border-radius:5px;background:#191812}
.dw .cdf .ch .m{font:bold 13px Lexend,sans-serif;color:#a8a28a}
.dw .cdf .ch.fait{opacity:.65}.dw .cdf .ch.fait .m{color:#6fcf97}
.dw .cdf .ch.cours{border-color:#8a6a3a;background:#241e12}.dw .cdf .ch.cours .m{color:#e6b85c}
.dw .cdf .ch.sceau{border-left:3px solid #d8574a}
.dw .cdf .ch b{font-size:13.5px}
.dw .cdf .ch p{margin:2px 0 0;font-size:12px;color:#c9c4ab;line-height:1.4}
.dw .cdf .ch .n{font-size:11px;color:#a8a28a;white-space:nowrap}
.dw .cdf .ob{font-size:12.5px;display:flex;justify-content:space-between;gap:8px;margin-top:3px}
.dw .cdf .ob.ok{color:#9ad15a}
.dw .cdf .rw{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px}
.dw .cdf .rw .lb{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#a8a28a}
.dw .cdf .rw span.pi{border:1px solid #4a4636;border-radius:99px;padding:3px 8px}
.dw .cdf .bt{display:flex;gap:8px;flex-wrap:wrap}
.dw .cdf .bt span{cursor:pointer;background:#3a2e1a;border:1px solid #8a6a3a;color:#ffd86a;font-weight:700;padding:6px 10px;border-radius:5px;font-size:12.5px}
.dw .cdf .bt span.g{background:#24231a;border-color:#4a4636;color:#f2ead6}
.dw .cdf .bt span.off{opacity:.4;pointer-events:none}
.dw .cdf .bt span.ko{border-color:#a8483e;color:#ff9a8a}
@media (max-width:700px){.dw .cdf .co{grid-template-columns:1fr}.dw .cdf .ac{border-right:0;border-bottom:1px solid #3a3626;max-height:160px}}
`;

export interface EtatCarnet { acte: string | null; confirmer: string | null }

export function carnetHtml(w: World, titre: string, vue: EtatCarnet): string {
  const Q = w.quetes!, actes = Q.actes, lvl = w.player.level, ch = Q.chapitre;
  const acteCours = ch ? Q.acteDe(ch.id) : null;
  const sel = actes.find(a => a.id === vue.acte) ?? acteCours ?? actes[0];
  const n = Q.sceaux;
  const pips = Array.from({ length: SCEAUX }, (_, i) => `<span class="pip ${i < n ? 'on' : ''}" title="Sceau ${i + 1}"></span>`).join('');
  const etatActe = (a: ActeDef) => a.chapitres.every(id => Q.finies.has(id)) ? 'fait' : a === acteCours ? 'cours' : lvl < a.niveaux[0] ? 'tard' : '';
  const romain = (a: ActeDef, i: number) => a.nom.startsWith('Acte ') ? a.nom.slice(5) : a.nom === 'Prologue' ? 'P' : a.region[0] ?? String(i);
  const liste = actes.map((a, i) => {
    const e = etatActe(a), pct = Math.round(Q.avancementActe(a) * 100);
    const sous = e === 'fait' ? 'Terminé' : e === 'cours' ? 'En cours' : e === 'tard' ? `Conseillé niv. ${a.niveaux[0]}` : `Niv. ${a.niveaux[0]}-${a.niveaux[1]}`;
    return `<div class="a ${e} ${a === sel ? 'on' : ''}" data-acte="${a.id}"><span class="p">${e === 'fait' ? '✓' : esc(romain(a, i + 1))}</span>
      <span><span class="t">${esc(a.nom)} · ${esc(a.region)}</span><br><span class="s">${sous}</span><span class="b"><i style="width:${pct}%"></i></span></span></div>`;
  }).join('');
  let det = '<div class="re">La campagne commence après le tutoriel.</div>';
  if (sel) {
    const guide = Q.data.pnj[sel.guide];
    const cur = ch && sel.chapitres.includes(ch.id) ? ch : null, etCur = cur && !cur.aRendre ? Q.etapeDe(cur) : null;
    const quiParle = etCur?.pnj ?? (cur ? Q.def(cur.id).pnj : null) ?? sel.guide, nomGuide = Q.data.pnj[quiParle]?.nom ?? guide?.nom ?? '';
    const bulle = etCur?.bulle ?? (sel.chapitres.every(id => Q.finies.has(id)) ? Q.def(sel.chapitres[sel.chapitres.length - 1]).merci ?? '' : sel.resume);
    const chaps = sel.chapitres.map((id, i) => {
      const q = Q.def(id), st = Q.etatChapitre(id);
      let obs = '';
      if (st === 'cours' && cur && etCur) obs = etCur.objectifs.map((o, k) => {
        const t = Q.total(o), v = Math.min(cur.compte[k] ?? 0, t);
        return `<div class="ob ${v >= t ? 'ok' : ''}"><span>${v >= t ? '✓' : '•'} ${esc(o.texte)}</span><span>${t > 1 ? `${v}/${t}` : ''}</span></div>`;
      }).join('');
      else if (st === 'cours' && cur?.aRendre && q.rendre) obs = `<div class="ob"><span>• Retourner voir ${esc(Q.data.pnj[q.rendre]?.nom ?? '')}</span></div>`;
      const sous = q.sceau ? `Sceau des Douze ${q.sceau}` : st === 'cours' && etCur ? esc(etCur.nom) : '';
      return `<div class="ch ${st} ${q.sceau ? 'sceau' : ''}"><span class="m">${st === 'fini' ? '✓' : i + 1}</span>
        <span><b>${esc(q.nom)}</b>${sous ? `<p>${sous}</p>` : ''}${st === 'cours' ? `<p>${esc(q.texte)}</p>` : ''}${obs}</span><span class="n">niv. ${q.niveau}</span></div>`;
    }).join('');
    const der = Q.def(sel.chapitres[sel.chapitres.length - 1]).recompense;
    const rw = [der.sac ? `<span class="pi" style="color:${RARITY_COLORS[der.sac as Rarity]}">Sac ${RARITY_NAMES[der.sac as Rarity]} garanti</span>` : '',
      der.xp ? `<span class="pi">${der.xp.toLocaleString('fr-FR')} XP</span>` : '', der.titre ? `<span class="pi">Titre « ${esc(der.titre)} »</span>` : '',
      der.apparats?.length ? '<span class="pi">Apparat de fin de campagne</span>' : ''].filter(Boolean).join('');
    const fini = sel.chapitres.every(id => Q.finies.has(id)), zaap = cur ? Q.zaapConseille() : null;
    const passer = Q.peutPasserActe && !fini
      ? `<span class="g ${vue.confirmer === sel.id ? 'ko' : ''}" data-passer="${sel.id}" title="Dès ton 2e perso : les titres et les passages de l'acte, sans les sacs ni l'XP">${vue.confirmer === sel.id ? 'Clique encore pour passer l\'acte' : 'Passer l\'acte'}</span>` : '';
    det = `<div><h3>${esc(sel.nom)} · ${esc(sel.region)}</h3><div class="li">Niveau conseillé ${sel.niveaux[0]}-${sel.niveaux[1]} · ton niveau : ${lvl}${lvl < sel.niveaux[0] && !fini ? ' · conseillé plus tard, rien n\'est fermé' : ''}</div></div>
      <div class="gu"><div class="po">${esc(nomGuide[0] ?? '?')}</div><p><b>${esc(nomGuide)}</b>« ${esc(bulle)} »</p></div>
      <div class="re">${esc(sel.resume)}</div>
      ${chaps}
      ${rw ? `<div class="rw"><span class="lb">Fin de l'acte</span>${rw}</div>` : ''}
      <div class="bt">${cur ? `<span data-suivre class="${Q.suivie === cur.id ? 'off' : ''}">${Q.suivie === cur.id ? 'Chapitre suivi' : 'Suivre (flèche)'}</span>
        <span class="g" data-carte>Voir sur la carte${zaap ? ` · Zaap conseillé : ${esc(zaap.name)}` : ''}</span>` : ''}${passer}</div>`;
  }
  return `${titre}<div class="cdf"><div class="sx"><b>Sceaux des Douze</b><span class="pips">${pips}</span><small>${n} / ${SCEAUX} · chaque boss de région garde un éclat des Enfers</small></div>
    <div class="co"><div class="ac">${liste}</div><div class="de">${det}</div></div></div>`;
}

/** Clics de la fenêtre : choisir un acte, suivre le chapitre, voir sur la carte, passer l'acte (deux clics). */
export function brancherCarnet(el: HTMLElement, w: World, vue: EtatCarnet, redessiner: () => void, carte: () => void) {
  const Q = w.quetes!;
  el.querySelectorAll<HTMLElement>('[data-acte]').forEach(e => e.addEventListener('click', () => { vue.acte = e.dataset.acte!; vue.confirmer = null; redessiner(); }));
  el.querySelector('[data-suivre]')?.addEventListener('click', () => { const ch = Q.chapitre; if (ch) Q.suivie = ch.id; redessiner(); });
  el.querySelector('[data-carte]')?.addEventListener('click', () => { const ch = Q.chapitre; if (ch) Q.suivie = ch.id; carte(); });
  el.querySelector<HTMLElement>('[data-passer]')?.addEventListener('click', e => {
    const id = (e.currentTarget as HTMLElement).dataset.passer!;
    if (vue.confirmer !== id) { vue.confirmer = id; redessiner(); return; }
    vue.confirmer = null; Q.passerActe(id); redessiner();
  });
}
