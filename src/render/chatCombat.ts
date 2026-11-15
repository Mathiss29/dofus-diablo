// Canaux du tchat (maquette du 2026-11-15, 3B + 3C) : ce que l'onglet Combat résume, sans DOM ni Phaser (testé dans tests/chat.test.ts).
// - 3B : un résumé par combat (massacre : monstres, durée, dégâts, XP ; boss : temps et dégâts), jamais une ligne par coup ;
// - 3C : les derniers coups reçus, pour le récapitulatif de mort.

/** Un coup reçu par le joueur de cet écran. */
export interface CoupRecu { t: number; n: number; el: string; de?: string; sort?: string }
interface Cible { type: string; t0: number; t1: number; dmg: number }

/** Calme (s) après lequel un nouveau combat commence (un peu plus que la fenêtre d'un massacre, 3 s). */
const CALME = 4;
/** Coups gardés pour le récap de mort : au plus 5, des 6 dernières secondes. */
const COUPS = 5, FENETRE_MORT = 6;

const fr = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
const duree = (s: number) => (s < 60 ? `${Math.max(1, Math.round(s))} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);

export class SuiviCombat {
  private combat = { t0: 0, t1: -1e9, dmg: 0, xp: 0 };
  private cibles = new Map<number, Cible>();
  private recus: CoupRecu[] = [];

  private tic(t: number) { const c = this.combat; if (t - c.t1 > CALME) { c.t0 = t; c.dmg = 0; c.xp = 0; } c.t1 = t; }
  /** Coup donné à un monstre (type : retrouvé seulement la première fois qu'on le touche). */
  coupDonne(t: number, id: number | undefined, n: number, type: () => string | undefined) {
    this.tic(t); this.combat.dmg += n;
    if (id == null) return;
    let c = this.cibles.get(id);
    if (!c) {
      const ty = type(); if (!ty) return;
      if (this.cibles.size > 300) for (const [k, v] of this.cibles) if (t - v.t1 > 30) this.cibles.delete(k);
      c = { type: ty, t0: t, t1: t, dmg: 0 }; this.cibles.set(id, c);
    }
    c.t1 = t; c.dmg += n;
  }
  xp(t: number, n: number) { this.tic(t); this.combat.xp += n; }
  /** Fin d'un massacre (3B) : « Massacre de 14 monstres · 18 s · 9 830 dégâts · +3 120 XP ». */
  massacre(n: number): string {
    const c = this.combat, l = [`Massacre de ${n} monstres`, duree(c.t1 - c.t0)];
    if (c.dmg > 0) l.push(`${fr(c.dmg)} dégâts`);
    if (c.xp > 0) l.push(`+${fr(c.xp)} XP`);
    return l.join(' · ');
  }
  /** Boss vaincu (3B) : « Bouftou Royal vaincu en 42 s · 21 400 dégâts ». */
  boss(type: string, nom: string): string {
    let best: [number, Cible] | null = null;
    for (const e of this.cibles) if (e[1].type === type && (!best || e[1].dmg > best[1].dmg)) best = e;
    if (!best) return `${nom} vaincu !`;
    this.cibles.delete(best[0]);
    return `${nom} vaincu en ${duree(best[1].t1 - best[1].t0)} · ${fr(best[1].dmg)} dégâts`;
  }
  /** Coup reçu par le joueur de cet écran (3C). */
  coupRecu(c: CoupRecu) { this.recus.push(c); if (this.recus.length > COUPS) this.recus.shift(); }
  /** Les coups qui ont mené à la mort (les plus récents, des dernières secondes), puis on repart de zéro. */
  mort(t: number): CoupRecu[] { const l = this.recus.filter(c => t - c.t <= FENETRE_MORT); this.recus = []; return l; }
}

const EL: Record<string, [string, string]> = {
  neutre: ['Neutre', '#c8c2b0'], terre: ['Terre', '#b98a4e'], feu: ['Feu', '#ff7a5c'], eau: ['Eau', '#6fb4ff'], air: ['Air', '#8fe07a'],
};
export const nomElement = (el: string) => EL[el]?.[0] ?? 'Neutre';
/** L'élément qui a fait le plus de dégâts parmi ces coups. */
export function elementDominant(l: CoupRecu[]): string {
  const s = new Map<string, number>();
  for (const c of l) s.set(c.el, (s.get(c.el) ?? 0) + c.n);
  return [...s].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutre';
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!));
/** 3C : le récapitulatif de mort en HTML. nomMonstre : type → nom ; res : résistance (%) du joueur à l'élément dominant. */
export function recapMort(l: CoupRecu[], nomMonstre: (type: string) => string, res: number, plafond = 50): { tueur: string; html: string } {
  const dernier = [...l].reverse().find(c => c.de), tueur = dernier?.de ? nomMonstre(dernier.de) : 'un coup venu de loin';
  const lignes = l.map(c => {
    const qui = c.de ? nomMonstre(c.de) : '', quoi = c.sort ? `${c.sort}${qui ? ` (${qui})` : ''}` : qui || 'Coup';
    const [en, coul] = EL[c.el] ?? EL.neutre;
    return `<div class="l"><span>${esc(quoi)}</span><b style="color:${coul}">−${fr(c.n)} ${en}</b></div>`;
  }).join('');
  const tot = l.reduce((s, c) => s + c.n, 0), d = l.length > 1 ? l[l.length - 1].t - l[0].t : 0;
  const el = elementDominant(l), conseil = res < plafond
    ? `Ta résistance ${nomElement(el)} est à ${Math.round(res)} % (plafond ${plafond} %) : c'est l'élément qui t'a le plus frappé.`
    : `Ta résistance ${nomElement(el)} est déjà au plafond : plus de Vitalité ou de soins aideront.`;
  const html = `<div class="t">Tué par ${esc(tueur)}</div>${lignes || '<div class="l"><span>Aucun coup noté</span></div>'}`
    + (l.length ? `<div class="l tot"><span>${l.length} dernier${l.length > 1 ? 's' : ''} coup${l.length > 1 ? 's' : ''}${d > 0 ? ` en ${d.toFixed(1).replace('.', ',')} s` : ''}</span><b>−${fr(tot)} PV</b></div><div class="c">${conseil}</div>` : '');
  return { tueur, html };
}
