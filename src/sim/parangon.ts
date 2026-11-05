// Parangon (après le niveau 200) : un arbre par classe, généré par tools/parangon/generer.py.
// Données seulement pour l'instant : rien n'est branché dans la partie (le niveau max de la V1 est bien plus bas).
import iop from '../data/parangon/iop.json';
import cra from '../data/parangon/cra.json';
import osamodas from '../data/parangon/osamodas.json';

export type ZoneParangon = 'terre' | 'feu' | 'eau' | 'air' | 'soutien';
export type Palier = 'petit' | 'moyen' | 'transformation';

export interface NoeudParangon {
  id: number;
  type: 'depart' | 'carac' | 'sort' | 'notable' | 'rune' | 'cle';
  zone: ZoneParangon | null;
  x: number;
  y: number;
  profondeur?: number;
  nom?: string;
  texte?: string;
  stat?: string;
  valeur?: number;
  prix?: string;
  runes?: string[];
  sort?: { id: number; nom: string; niveau: number; palier: Palier };
}

export interface ArbreParangon {
  classe: string;
  nom: string;
  regles: { ouverture: number; clesDeVouteMax: number; runes: Record<string, number> } & Record<string, unknown>;
  noeuds: NoeudParangon[];
  liens: [number, number][];
}

export const PARANGON: Record<string, ArbreParangon> = {
  iop: iop as unknown as ArbreParangon,
  cra: cra as unknown as ArbreParangon,
  osamodas: osamodas as unknown as ArbreParangon,
};

/** Distance officielle d'un nœud de sort : niveau 1 -> 6 points, niveau 190 -> 40 points. */
export const distanceSort = (niveau: number) => Math.round(6 + ((niveau - 1) * 34) / 189);

export function voisins(a: ArbreParangon): number[][] {
  const v: number[][] = a.noeuds.map(() => []);
  for (const [x, y] of a.liens) {
    v[x].push(y);
    v[y].push(x);
  }
  return v;
}

/** Nombre de points minimal pour atteindre chaque nœud depuis le départ. */
export function distances(a: ArbreParangon): number[] {
  const v = voisins(a);
  const d = a.noeuds.map(() => -1);
  d[0] = 0;
  const file = [0];
  for (let i = 0; i < file.length; i++)
    for (const w of v[file[i]])
      if (d[w] < 0) {
        d[w] = d[file[i]] + 1;
        file.push(w);
      }
  return d;
}

/** Un nœud se prend s'il touche un nœud déjà pris ; une seule clé de voûte à la fois. */
export function peutPrendre(a: ArbreParangon, pris: ReadonlySet<number>, id: number): boolean {
  if (pris.has(id)) return false;
  const n = a.noeuds[id];
  if (n.type === 'cle' && [...pris].filter((p) => a.noeuds[p].type === 'cle').length >= a.regles.clesDeVouteMax)
    return false;
  return voisins(a)[id].some((w) => w === 0 || pris.has(w));
}
