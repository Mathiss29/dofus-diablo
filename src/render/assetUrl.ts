/** Adresses des fichiers du jeu (maquette Hébergement, 6 nov. 2026 : 1A 2A 4A 6B).
 *  - Les fichiers lourds (images et sons des cartes, sprites, effets, sons) peuvent être servis par Cloudflare R2 :
 *    il suffit de construire avec VITE_ASSETS_URL=https://… (voir tools/hebergement/LISEZMOI.md). Sans elle, tout reste local.
 *  - Les JSON (données des cartes, atlas) restent toujours à côté du jeu : les tests les lisent.
 *  - Chaque fichier lourd porte l'empreinte de son contenu (src/data/fichiers-lourds.json) : après une mise à jour,
 *    le navigateur ne retélécharge que ce qui a changé. Les autres fichiers prennent le numéro du build. */
import EMPREINTES from '../data/fichiers-lourds.json';

declare const __BUILD__: string;
const DISTANT = ((import.meta.env?.VITE_ASSETS_URL as string | undefined) ?? '').replace(/\/+$/, '');
/** Dossiers et extensions qui partent sur le stockage distant. */
export const LOURD = /^assets\/((?:mondes|sprites|son|fx|cartes)\/.+\.(?:webp|png|jpg|mp3|ogg))$/;
const E = EMPREINTES as Record<string, string>;

/** Vrai quand les fichiers lourds viennent d'un autre domaine (il faut alors demander les images en CORS). */
export const DISTANTS = DISTANT !== '';

/** Adresse réelle d'un fichier, sans numéro de version. */
export const adresse = (url: string) => {
  const m = DISTANT ? LOURD.exec(url) : null;
  return m ? `${DISTANT}/${m[1]}` : url;
};

/** Adresse avec version, à utiliser pour tout chargement. */
export const v = (url: string) => `${adresse(url)}?v=${E[LOURD.exec(url)?.[1] ?? ''] ?? __BUILD__}`;

/** Dossier de base d'un multi-atlas Phaser (les pages d'images y sont cherchées). */
export const dossier = (dir: string) => DISTANT && /^assets\/(mondes|sprites|son|fx|cartes)(\/|$)/.test(dir) ? `${DISTANT}${dir.slice('assets'.length)}` : dir;
