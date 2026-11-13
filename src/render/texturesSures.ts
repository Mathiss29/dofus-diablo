import Phaser from 'phaser';

/** Plus de jeu figé sur « Cannot read properties of null (reading 'glTexture') » (rapport de Mycs, 2026-11-13).
 *  Phaser plante au rendu quand une texture est détruite alors qu'une image l'affiche encore (la Frame garde source = null).
 *  Ça arrivait quand une planche de monstre oubliée, une page du perso dessiné ou une texture refaite (brume, menus...)
 *  partait sous une image encore à l'écran. Deux filets, valables pour toutes les textures du jeu :
 *  1. juste avant qu'une texture soit détruite, les images de toutes les scènes qui l'affichent passent sur __DEFAULT
 *     (transparente) : elles reprennent leur vraie image à leur prochaine mise à jour ;
 *  2. si une Frame détruite arrive malgré tout au rendu, elle prend la texture __DEFAULT au lieu de planter.
 *  Chaque cas est signalé une fois dans la console (clé de la texture), pour retrouver la cause. */

type AvecTexture = Phaser.GameObjects.GameObject & { texture?: Phaser.Textures.Texture; list?: Phaser.GameObjects.GameObject[] };

const signales = new Set<string>();
function signaler(cle: string, quoi: string) {
  if (signales.has(cle)) return;
  signales.add(cle);
  console.warn(`Texture « ${cle} » détruite alors qu'${quoi} l'affichait encore : image remplacée, le jeu continue.`);
}

/** Les objets affichés de la scène (conteneurs et calques compris). */
function* objets(liste: Phaser.GameObjects.GameObject[]): Generator<AvecTexture> {
  for (const o of liste as AvecTexture[]) {
    yield o;
    if (Array.isArray(o.list)) yield* objets(o.list);
  }
}

/** Vrai si un objet affiché d'une scène du jeu montre la texture `cle`. */
export function textureAffichee(game: Phaser.Game, cle: string): boolean {
  for (const sc of game.scene.scenes) {
    const dl = sc.sys.displayList;
    if (!dl) continue;
    for (const o of objets(dl.list)) if (o.texture?.key === cle && o.active) return true;
  }
  return false;
}

let game: Phaser.Game | null = null;
const T = Phaser.Textures.Texture.prototype as unknown as { destroy(): void; key: string; manager: Phaser.Textures.TextureManager | null };
const detruire = T.destroy;
T.destroy = function (this: typeof T) {
  const g = this.manager?.game ?? game;
  if (g && this.key !== '__DEFAULT' && this.key !== '__MISSING') {
    for (const sc of g.scene.scenes) {
      const dl = sc.sys.displayList;
      if (!dl) continue;
      for (const o of objets(dl.list)) {
        if (o.texture !== (this as unknown as Phaser.Textures.Texture)) continue;
        const im = o as unknown as Phaser.GameObjects.Sprite;
        if (typeof im.setTexture === 'function') { im.anims?.stop(); im.setTexture('__DEFAULT'); signaler(this.key, 'une image'); }
        else { (o as unknown as { setVisible?(v: boolean): void }).setVisible?.(false); signaler(this.key, 'un objet'); }
      }
    }
  }
  detruire.call(this);
};

// Dernier filet : Frame détruite (source = null) qui arrive au rendu
const F = Phaser.Textures.Frame.prototype;
const avant = Object.getOwnPropertyDescriptor(F, 'glTexture');
if (avant?.get) {
  Object.defineProperty(F, 'glTexture', {
    configurable: true,
    get(this: Phaser.Textures.Frame) {
      if (this.source) return avant.get!.call(this);
      signaler(this.name ?? '?', 'une image (Frame)');
      return game?.textures.get('__DEFAULT').source[0]?.glTexture ?? null;
    },
  });
}

/** À appeler une fois au lancement (main.ts) : le jeu sert au filet de la Frame, qui n'a plus sa texture. */
export function brancherTexturesSures(g: Phaser.Game) { game = g; }
