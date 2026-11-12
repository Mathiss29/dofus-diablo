/** D'où viennent les familiers (ligne « Familiers : 1A+1B+1C+1D 2D 3A 4A+4C 5A+5C+5D 6A+6B+6C 7A 8A », 2026-11-12).
 *  1A/1C : monstres de leur famille et boss (tirage pur, 2D) ; 1B/4A : Animalerie du Marché en kamas ; 4C : familier de départ au niveau 10 ;
 *  1D/6C : succès de la Ménagerie ; 5C : un familier déjà dans la Ménagerie ne tombe plus ; 7A : Ménagerie du compte ; 8A : zones à venir.
 *  Données : src/data/familiers_sources.json, écrit par tools/contenu/familiers_sources.py. */
import sources from '../data/familiers_sources.json';

export const FAMILIERS_SOURCES = sources as unknown as {
  familles: Record<string, string[]>;
  invasion: string[];
  chances: { invasion: number };
  animalerie: Record<string, number>;
  depart: { niveau: number; familiers: string[] };
  /** 5A : niveaux gagnés en donnant un double à manger. */
  repasDouble: number;
  succes: Record<string, unknown>;
  avenir: Record<string, string>;
};
const S = FAMILIERS_SOURCES;

export type SourceFamilier = { k: 'famille'; monstres: string[] } | { k: 'invasion' } | { k: 'animalerie'; prix: number }
  | { k: 'succes'; succes: string } | { k: 'avenir'; zone: string };

/** Source d'un familier (null : familier d'apparat ou inconnu). `succesDe` = succès dont il est la récompense. */
export function sourceFamilier(id: string, succesDe?: string): SourceFamilier | null {
  if (S.familles[id]) return { k: 'famille', monstres: S.familles[id] };
  if (S.invasion.includes(id)) return { k: 'invasion' };
  if (S.animalerie[id] != null) return { k: 'animalerie', prix: S.animalerie[id] };
  if (succesDe) return { k: 'succes', succes: succesDe };
  if (id in S.avenir) return { k: 'avenir', zone: S.avenir[id] };
  return null;
}

/** Texte « où le trouver » de la Ménagerie (6A). */
export function ouTrouverFamilier(s: SourceFamilier | null, nomMonstre: (k: string) => string, nomSucces: (k: string) => string): string {
  if (!s) return '';
  switch (s.k) {
    case 'famille': {
      const noms = [...new Set(s.monstres.filter(m => !m.startsWith('archi_')).map(nomMonstre))];
      return `Tombe des ${noms.slice(0, 4).join(', ')}${noms.length > 4 ? '…' : ''}`;
    }
    case 'invasion': return 'Coffre d\'invasion (Éclats Obscurs)';
    case 'animalerie': return `Animalerie du Marché : ${s.prix.toLocaleString('fr-FR')} kamas`;
    case 'succes': return `Succès : ${nomSucces(s.succes)}`;
    case 'avenir': return s.zone ? `Arrive avec ${s.zone}` : 'Arrive avec une zone à venir';
  }
}
