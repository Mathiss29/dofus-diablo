import { STAT_NAMES, type Stat } from './items';
import type { Player } from './player';
import { BENEDICTION, BENEDICTIONS } from './magasin';
import { CONSO, ELIXIRS, REPAS, texteBonus } from './consommables';

/** Bulles d'effets actifs (maquette « Bulles : 1A 2A+2B+2C 3A 4A 5A 6A 7A 8A ») : ce qui agit sur le perso en ce moment.
 *  sorte : 'sort' = bonus d'un de ses sorts (bord vert), 'monstre' = malus reçu (bord rouge), 'objet' = pouvoir d'objet (bord doré).
 *  Le rendu ne fait que lire cette liste. */
export interface EffetActif {
  id: string;
  sorte: 'sort' | 'monstre' | 'objet';
  nom: string;
  /** Icône : un sort de la classe (icône officielle) ou une caractéristique (icônes tx_ de Dofus 3). */
  sort?: number; carac?: 'pm' | 'dommages' | 'puissance' | 'vie';
  /** Secondes restantes et durée de départ (l'anneau se vide de tMax à 0). */
  t: number; tMax: number;
  /** Charges (Fureur, Flèche Glacée…). */
  charges?: number;
  /** Lignes de l'infobulle. */
  lignes: string[];
}

const fr = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const signe = (n: number) => (n > 0 ? '+' : '') + n;

export function effetsActifs(p: Player): EffetActif[] {
  const out: EffetActif[] = [];
  const sp = p.cls.spells;
  // Bonus de sorts (Cortège Sauvage, Pas Chassé, Épée Divine…) : un même sort peut donner plusieurs lignes
  const parSort = new Map<string, EffetActif>();
  const malus = new Map<Stat, EffetActif>();
  for (const m of p.mods) {
    if (m.src && sp[m.src]) {
      const d = sp[m.src];
      let e = parSort.get(m.src);
      if (!e) { e = { id: m.src, sorte: 'sort', nom: d.name, sort: d.icon, t: m.t, tMax: m.t0 ?? m.t, lignes: [] }; parSort.set(m.src, e); out.push(e); }
      e.t = Math.max(e.t, m.t); e.tMax = Math.max(e.tMax, m.t0 ?? m.t);
      e.lignes.push(`${signe(m.n)} ${STAT_NAMES[m.k] ?? m.k}`);
    } else if (m.src === 'boisson' || m.src === 'dore') {   // « Métiers : » 4A boisson de résistance, 6A coup de pouce d'une ressource dorée
      const id = m.src, e = out.find(x => x.id === id);
      if (e) { e.lignes.push(`${signe(m.n)} ${STAT_NAMES[m.k] ?? m.k}`); continue; }
      out.push({ id, sorte: 'objet', nom: id === 'dore' ? 'Ressource dorée' : 'Boisson de résistance', carac: id === 'dore' ? 'puissance' : 'vie', t: m.t, tMax: m.t0 ?? m.t, lignes: [`${signe(m.n)} ${STAT_NAMES[m.k] ?? m.k}`] });
    } else if (!m.src) {   // sort de monstre (ex. Puissance retirée)
      let e = malus.get(m.k);
      const neg = m.n < 0;
      if (!e) {
        e = { id: `mod_${m.k}`, sorte: neg ? 'monstre' : 'objet', nom: neg ? `${STAT_NAMES[m.k] ?? m.k} réduite` : STAT_NAMES[m.k] ?? m.k,
          carac: m.k === 'pm' ? 'pm' : m.k === 'puissance' ? 'puissance' : 'dommages', t: m.t, tMax: m.t0 ?? m.t, lignes: [] };
        malus.set(m.k, e); out.push(e);
      }
      e.t = Math.max(e.t, m.t); e.tMax = Math.max(e.tMax, m.t0 ?? m.t);
      e.lignes.push(`${signe(m.n)} ${STAT_NAMES[m.k] ?? m.k}`);
    }
  }
  // Charges (Fureur, Flèche Glacée) : le prochain lancer frappe plus fort
  for (const [id, st] of Object.entries(p.stacks)) {
    const d = sp[id]; if (!d?.stack) continue;
    out.push({ id: `stack_${id}`, sorte: 'sort', nom: d.name, sort: d.icon, t: st.t, tMax: d.stack.time, charges: st.n,
      lignes: [`${st.n} charge${st.n > 1 ? 's' : ''} sur ${d.stack.max}`, `Prochain lancer : +${Math.round(d.stack.per * st.n * 100)} % de dommages`] });
  }
  // Bénédiction achetée au Marché (Magasin 6D), 30 minutes
  if (p.benediction) { const b = BENEDICTIONS[p.benediction.k];
    out.push({ id: 'benediction', sorte: 'objet', nom: b.nom, carac: 'puissance', t: p.benediction.reste, tMax: BENEDICTION.duree, lignes: [b.texte, `Encore ${Math.ceil(p.benediction.reste / 60)} min`] }); }
  // « Métiers : » 4B + 4C : repas et élixir de 30 minutes
  for (const [k, c, l] of [['repas', p.repas, REPAS], ['elixir', p.elixir, ELIXIRS]] as const) if (c && l[c.id]) {
    out.push({ id: k, sorte: 'objet', nom: p.items?.resources[c.id]?.name ?? (k === 'repas' ? 'Repas' : 'Élixir'), carac: k === 'repas' ? 'vie' : 'puissance',
      t: c.reste, tMax: CONSO.duree, lignes: [texteBonus(l[c.id]), `Encore ${Math.ceil(c.reste / 60)} min`] });
  }
  // Bouclier (Ferveur)
  if (p.shieldT > 0 && p.shield > 0) {
    const d = sp[p.shieldSrc];
    out.push({ id: 'bouclier', sorte: 'sort', nom: d?.name ?? 'Bouclier', sort: d?.icon, carac: d ? undefined : 'vie', t: p.shieldT, tMax: p.shieldT0 || p.shieldT,
      lignes: [`Bouclier de ${p.shield} PV`] });
  }
  // Malus reçus des monstres (2B)
  if (p.slowT > 0) out.push({ id: 'ralenti', sorte: 'monstre', nom: 'Ralenti', carac: 'pm', t: p.slowT, tMax: p.slowT0 || p.slowT,
    lignes: [`Vitesse -${Math.round(p.slowK * 100)} %`, 'PM retirés par un monstre'] });
  if (p.subisT > 0 && p.subis !== 1) {
    const pire = p.subis > 1, pct = Math.round((p.subis - 1) * 100);
    out.push({ id: 'subis', sorte: pire ? 'monstre' : 'objet', nom: pire ? 'Affaibli' : 'Protégé', carac: 'vie', t: p.subisT, tMax: p.subisT0 || p.subisT,
      lignes: [`Dommages subis ${signe(pct)} %`] });
  }
  if (p.pacifiste > 0) out.push({ id: 'pacifiste', sorte: 'monstre', nom: 'Pacifiste', carac: 'dommages', t: p.pacifiste, tMax: p.pacifisteT0 || p.pacifiste,
    lignes: ['Ne peut plus infliger de dommages'] });
  // Potion Wabbit (« Wabbits : 2D »)
  if (p.deguise > 0) out.push({ id: 'deguise', sorte: 'objet', nom: 'Déguisé en Wabbit', carac: 'pm', t: p.deguise, tMax: 600,
    lignes: ['Les Wabbits de l\'île ne t\'attaquent pas', 'Tant que tu ne les tapes pas'] });
  for (const e of out) e.lignes.push(`Encore ${fr(Math.max(0, e.t))} s`);
  return out;
}
