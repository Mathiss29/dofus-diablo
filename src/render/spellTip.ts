import type { Player } from '../sim/player';
import type { SkillId, SpellDef } from '../sim/defs';
import type { SortGrade } from '../sim/sorts';
import { ELEMENT_COLORS } from './fx';
import { STAT_NAMES } from '../sim/items';

const ELEMENT_NAMES: Record<string, string> = { neutre: 'Neutre', terre: 'Terre', feu: 'Feu', eau: 'Eau', air: 'Air', meilleur: 'meilleur élément' };
export const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** Choix 2B : ce que la Rage pleine pousse de +50 % pour chaque sort. */
const RAGE_TEXT: Record<NonNullable<SpellDef['rage']>, (d: SpellDef) => string> = {
  knock: () => 'repousse 50 % plus loin', length: () => 'ligne 50 % plus longue', radius: () => 'zone 50 % plus grande',
  explode: () => 'explosion 50 % plus grande', dash: () => 'avance 50 % plus loin', stack: d => `+${Math.round((d.stack?.per ?? 0) * 150)} % par lancer`,
  lifesteal: d => `vole ${Math.round((d.lifesteal ?? 0) * 150)} % des dommages`, erosion: d => `Érosion ${Math.round((d.erosion ?? 0) * 150)} %`,
  pm: d => `-${Math.round((d.pmLoss ?? 0) * 1.5)} PM`, pa: d => `-${Math.round((d.paLoss ?? 0) * 1.5)} PA`,
  buff: d => `${d.buff?.stat === 'portee' ? 'Portée' : d.buff?.stat === 'pm' ? 'PM' : 'Dommages'} +${Math.round((d.buff?.n ?? 0) * 1.5)}`, shield: () => 'bouclier 50 % plus gros',
  selfKnock: () => 'recule 50 % plus loin', summon: d => `+${Math.round(((d.vsSummon ?? 1) - 1) * 150)} % sur les invocations, les élites et les boss`,
};

function zone(d: SpellDef): string {
  const h = d.hit, c = (px: number) => { const n = Math.max(1, Math.round(px / 48 * 2) / 2); return `${n1(n)} case${n > 1 ? 's' : ''}`; };
  if (h.shape === 'cone') return h.arc >= 180 ? `Zone : demi-cercle devant soi, ${c(h.range)}` : `Zone : cône devant soi, ${c(h.range)}`;
  if (h.shape === 'line') return `Zone : ligne de ${c(h.length)}`;
  if (h.shape === 'circle') return d.move ? `Zone : cercle à l'arrivée, rayon ${c(h.radius)}` : `Zone : cercle autour de soi, rayon ${c(h.radius)}`;
  if (h.shape === 'point') return h.radius <= 36 ? `Une cible, portée ${c(h.range)}` : `Zone autour de la cible (rayon ${c(h.radius)}), portée ${c(h.range)}`;
  return `Projectile, portée ${c(h.range)}${h.explode ? `, explose (rayon ${c(h.explode)})` : ''}${h.pierce ? ', traverse les ennemis' : ''}`;
}

/** Ce que fait le sort en jeu, au grade donné (par défaut celui atteint), avec les caractéristiques du perso. */
export function spellDetail(p: Player, id: SkillId, gOver?: SortGrade) {
  const d = p.spell(id)!;
  const col = ELEMENT_COLORS[d.element] !== undefined ? '#' + ELEMENT_COLORS[d.element].toString(16).padStart(6, '0') : '#e8e2d4';
  const o = p.official(id), g = gOver ?? p.grade(id);
  const pa = d.pm ? 0 : g?.pa ?? p.paCost(id);
  const cost = d.pm ? `${d.pm} PM` : pa ? `${pa} PA` : 'Sans coût';
  // Maquette Recharges 9D : recharge réelle (gros coup, relance officielle, réductions) ou charges
  const cdS = gOver && !d.grosCoup ? Math.max(d.cooldown, gOver.relance * 3, gOver.parTour === 1 ? 3 : 0) : p.recharge(id);
  const nCh = d.pm || d.grosCoup ? 0 : (gOver ?? g)?.parTour ?? 0;
  const extra = [
    id === p.autoAttack ? `${n1(1 / p.attackInterval())} attaque(s) par seconde (Vitesse d'attaque : +${p.stat('vitesse')} %)` : '',
    d.stun ? `Étourdit ${n1(d.stun)} s` : '',
    d.stack ? `+${Math.round(d.stack.per * 100)} % par lancer (jusqu'à ${d.stack.max} fois)` : '',
    d.lifesteal ? `Vole ${Math.round(d.lifesteal * 100)} % des dommages en PV` : '',
    d.erosion ? `Érosion ${Math.round(d.erosion * 100)} % (PV max retirés)` : '',
    d.pmLoss ? `-${d.pmLoss} PM (ralentit la cible)` : '',
    d.paLoss ? `-${d.paLoss} PA (retarde ses attaques)` : '',
    d.pushDmg ? `Repousse la cible de ${Math.max(1, Math.round(d.knock / 48 / 7.13))} case(s)` : '',
    d.move ? `${d.move.kind === 'leap' ? 'Saut' : 'Ruée'} jusqu'à ${Math.round(d.move.maxRange / 48)} cases` : '',
    d.charge ? 'Se charge avant de frapper' : '',
    nCh >= 2 ? `${nCh} charges, chacune revient ${n1(p.retourCharge)} s après usage` : '',
    d.grosCoup ? `Gros coup : dommages ×${d.grosCoup.mult}` : '',
    d.buff ? `${STAT_NAMES[d.buff.stat] ?? 'Dommages'} +${d.buff.n} pendant ${d.buff.t} s` : '',
    d.buff?.instinct ? 'Instinct : remplace le bonus des autres instincts (un seul à la fois)' : '',
    d.poLoss ? `-${d.poLoss[0]} Portée à la cible pendant 3 s${d.poLoss.length > 1 && d.poLoss.at(-1) !== d.poLoss[0] ? ` (-${d.poLoss.at(-1)} au dernier grade)` : ''}` : '',
    d.shield ? `Bouclier : ${Math.round(p.maxHp * d.shield.part)} PV pendant ${d.shield.t} s` : '',
    d.selfKnock ? `Recule de ${Math.round(d.selfKnock / 48)} cases` : '',
    d.vsSummon ? `+${Math.round((d.vsSummon - 1) * 100)} % sur les invocations` : '',
    d.vuln ? `Ennemis autour de l'arrivée : dommages subis +${d.vuln.n} % pendant ${d.vuln.t} s` : '',
    d.pushDmg ? 'Dommages de poussée si elle heurte un obstacle' : '',
    // Sacrieur
    d.attire ? `Attire ${d.attire.vers === 'centre' ? 'vers le centre de la zone' : 'la cible'} de ${d.attire.cases} case(s)` : '',
    d.echange ? 'Échange de place avec la cible' : '',
    d.supplice ? `Pendant ${d.supplice.t} s, frapper la cible te soigne de ${Math.round(d.supplice.part * 100)} % des dommages` : '',
    d.dmgPV ? `Dommages : ${Math.round(d.dmgPV * 100)} % de tes PV restants (${Math.round(p.damage(p.hp * d.dmgPV, d.element))})` : '',
    d.renvoi ? `Renvoie ${Math.round(d.renvoi.part * 100)} % des dommages de mêlée pendant ${d.renvoi.t} s` : '',
    d.mutilation ? `Sacrifie ${Math.round(d.mutilation.sacrifice * 100)} % de tes PV (jamais sous 1) : +${d.mutilation.puissance} Puissance, puis toutes les ${d.mutilation.periode} s un nouveau sacrifice (+${d.mutilation.cran}, ${d.mutilation.crans} crans max, le sacrifice continue ensuite). Reste active sans limite de durée. Relancer : Coagulation, bouclier de ${Math.round(d.mutilation.coagulation[0] * 100)} à ${Math.round(d.mutilation.coagulation.at(-1)! * 100)} % des PV max` : '',
    d.souffrance6 ? `Souffrance 6 ou plus : ${[d.souffrance6.po ? `portée +${d.souffrance6.po}` : '', d.souffrance6.attire ? `attire de ${d.souffrance6.attire} cases` : '', d.souffrance6.bouclierParEnnemi ? `bouclier +${Math.round(d.souffrance6.bouclierParEnnemi * 100)} % par ennemi proche` : ''].filter(Boolean).join(', ')}` : '',
  ].filter(Boolean);
  const gm = o && g && o.grades[0].dmg && g.dmg ? (g.dmg[0] + g.dmg[1]) / (o.grades[0].dmg[0] + o.grades[0].dmg[1]) : 1;
  const dmg = d.dmg ? `Dommages : <b style="color:${col}">${Math.round(p.damage(d.dmg * gm * (d.grosCoup?.mult ?? 1), d.element))}</b> ${ELEMENT_NAMES[d.element] ?? ''}` : '';
  const rage = d.move?.kind === 'leap' || p.cls.souffrance ? '' : `${p.cls.rage.name} pleine : +${Math.round(p.cls.rage.bonus * 100)} % de dommages${d.rage ? `, ${RAGE_TEXT[d.rage](d)}` : ''}`;
  return { d, col, cost, cdS, nCh, dmg, zone: zone(d), extra, rage, grade: o && g ? `Grade ${o.grades.indexOf(g) + 1}/${o.grades.length}` : '' };
}

/** Infobulle d'un sort de la barre : description officielle, coût, recharge, dommages réels avec les caractéristiques du perso. */
export function spellTipHtml(p: Player, id: SkillId): string {
  const d = p.spell(id);
  if (!d) {
    const A = p.cls.attaque, hit = A.combo[0];
    return `<h4>${A.name}</h4><div class="sub">Auto-attaque · clic gauche · sans arme</div>
      Combo de ${A.combo.length} coups au corps à corps, le dernier repousse plus fort.<br>
      Dommages : <b>${Math.round(p.damage(hit.dmg, A.element))}</b> ${ELEMENT_NAMES[A.element]}
      <div class="hint">Équipe une arme pour changer d'auto-attaque (épée, marteau, arc…).</div>`;
  }
  const x = spellDetail(p, id), slot = p.bar.indexOf(id);
  const key = id === p.autoAttack ? 'Auto-attaque · clic gauche' : slot === 7 ? 'Déplacement · Espace' : slot === 6 ? 'Clic droit' : '';
  return `<h4 style="color:${x.col}">${d.name}</h4>
    <div class="sub">${[x.cost, x.cdS >= 1 ? `recharge ${n1(x.cdS)} s` : '', x.nCh >= 2 ? `${x.nCh} charges` : '', x.grade, key].filter(Boolean).join(' · ')}</div>
    ${d.desc ? `<div>${d.desc.replace(/\n+/g, '<br>')}</div>` : ''}
    <div class="cmp">${[x.dmg, x.zone, ...x.extra].filter(Boolean).join('<br>')}</div>
    ${x.rage ? `<div class="leg" style="${p.rageFull ? '' : 'opacity:.6'}">${x.rage}</div>` : ''}`;
}
