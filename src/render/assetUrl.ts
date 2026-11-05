/** Numéro de version du build (vite.config.ts) ajouté aux adresses des images et données du jeu :
 *  sans lui, le navigateur peut garder l'ancienne planche d'un perso après une mise à jour (GitHub Pages met en cache 10 min). */
declare const __BUILD__: string;
export const v = (url: string) => `${url}?v=${__BUILD__}`;
