import type { Player } from '../sim/player';
import type { SkillId, SpellDef } from '../sim/defs';
import { ELEMENT_COLORS } from './fx';

const ELEMENT_NAMES: Record<string, string> = { neutre: 'Neutre', terre: 'Terre', feu: 'Feu', eau: 'Eau', air: 'Air', meilleur: 'meilleur élément' };
const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** Choix 2B : ce que la Rage pleine pousse de +50 % pour chaque sort. */
const RAGE_TEXT: Record<NonNullable<SpellDef['rage']>, (d: SpellDef) => string> = {
  knock: () => 'repousse 50 % plus loin', length: () => 'ligne 50 % plus longue', radius: () => 'zone 50 % plus grande',
  explode: () => 'explosion 50 % plus grande', dash: () => 'avance 50 % plus loin', stack: d => `+${Math.round((d.stack?.per ?? 0) * 150)} % par lancer`,
  lifesteal: d => `vole ${Math.round((d.lifesteal ?? 0) * 150)} % des dommages`, erosion: d => `Érosion ${Math.round((d.erosion ?? 0) * 150)} %`,
  pm: d => `-${Math.round((d.pmLoss ?? 0) * 1.5)} PM`, pa: d => `-${Math.round((d.paLoss ?? 0) * 1.5)} PA`,
};

function zone(d: SpellDef): string {
  const h = d.hit;
  if (h.shape === 'cone') return h.arc >= 180 ? `Zone : demi-cercle devant soi (${h.range})` : `Zone : cône devant soi (${h.range})`;
  if (h.shape === 'line') return `Zone : ligne (${h.length})`;
  if (h.shape === 'circle') return d.move ? `Zone : cercle à l'arrivée (${h.radius})` : `Zone : cercle autour de soi (${h.radius})`;
  return `Projectile, portée ${h.range}${h.explode ? `, explose (${h.explode})` : ''}${h.pierce ? ', traverse les ennemis' : ''}`;
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
  const col = ELEMENT_COLORS[d.element] !== undefined ? '#' + ELEMENT_COLORS[d.element].toString(16).padStart(6, '0') : '#e8e2d4';
  const cost = d.pm ? `${d.pm} PM` : d.pa ? `${d.pa} PA` : 'Sans coût';
  const key = id === p.autoAttack ? 'Auto-attaque · clic gauche' : id === p.cls.mobility ? 'Déplacement · Espace' : id === p.cls.favorite ? 'Sort favori · clic droit' : '';
  const extra = [
    id === p.autoAttack ? `${n1(1 / p.attackInterval())} attaque(s) par seconde (Vitesse d'attaque : +${p.stat('vitesse')} %)` : '',
    d.stun ? `Étourdit ${n1(d.stun)} s` : '',
    d.stack ? `+${Math.round(d.stack.per * 100)} % par lancer (jusqu'à ${d.stack.max} fois)` : '',
    d.lifesteal ? `Vole ${Math.round(d.lifesteal * 100)} % des dommages en PV` : '',
    d.erosion ? `Érosion ${Math.round(d.erosion * 100)} % (PV max retirés)` : '',
    d.pmLoss ? `-${d.pmLoss} PM (ralentit la cible)` : '',
    d.paLoss ? `-${d.paLoss} PA (retarde ses attaques)` : '',
    d.move ? `${d.move.kind === 'leap' ? 'Saut' : 'Ruée'} jusqu'à ${d.move.maxRange}` : '',
    d.charge ? 'Se charge avant de frapper' : '',
  ].filter(Boolean);
  const dmg = d.dmg ? `Dommages : <b style="color:${col}">${Math.round(p.damage(d.dmg, d.element))}</b> ${ELEMENT_NAMES[d.element] ?? ''}` : '';
  return `<h4 style="color:${col}">${d.name}</h4>
    <div class="sub">${[cost, d.cooldown >= 1 ? `recharge ${n1(d.cooldown)} s` : '', key].filter(Boolean).join(' · ')}</div>
    ${d.desc ? `<div>${d.desc.replace(/\n+/g, '<br>')}</div>` : ''}
    <div class="cmp">${[dmg, zone(d), ...extra].filter(Boolean).join('<br>')}</div>
    ${d.move?.kind === 'leap' ? '' : `<div class="leg" style="${p.rageFull ? '' : 'opacity:.6'}">${p.cls.rage.name}${p.rageFull ? ' pleine' : ''} : +${Math.round(p.cls.rage.bonus * 100)} % de dommages${d.rage ? `, ${RAGE_TEXT[d.rage](d)}` : ''}</div>`}`;
}
