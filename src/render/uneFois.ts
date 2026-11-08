import type Phaser from 'phaser';

/** Fichiers demandés et pas encore arrivés, communs à toutes les scènes (comme les textures). Quand la scène repart pendant un
 *  chargement, la demande de l'ancienne scène arrive quand même : la redemander ferait « Texture key already in use ».
 *  Une demande vraiment perdue est refaite après DELAI ms. */
const DEMANDES = new Map<string, number>();
const DELAI = 15000;

/** Charge la texture `cle` une seule fois pour tout le jeu (`charger` met le fichier dans la file du chargeur de la scène).
 *  Vrai si elle est déjà là. */
export function textureUneFois(scene: Phaser.Scene, cle: string, charger: (l: Phaser.Loader.LoaderPlugin) => void): boolean {
  if (scene.textures.exists(cle)) { DEMANDES.delete(cle); return true; }
  const t = DEMANDES.get(cle);
  if (t !== undefined && Date.now() - t < DELAI) return false;
  DEMANDES.set(cle, Date.now());
  charger(scene.load);
  if (!scene.load.isLoading()) scene.load.start();
  return false;
}
