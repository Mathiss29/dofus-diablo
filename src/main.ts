import Phaser from 'phaser';
import { ZoneScene } from './render/zoneScene';
import { Accueil } from './render/accueil';

// Polices de Dofus 3 : chargées tout de suite, les textes de Phaser (dégâts, noms, HUD) les dessinent sur le canevas
for (const f of ['400 13px Lexend', '600 13px Lexend', '700 13px Lexend', '13px Rowdies']) document.fonts?.load(f).catch(() => {});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#12141b',
  // fichiers lourds éventuellement servis par Cloudflare R2 (src/render/assetUrl.ts) : images demandées en CORS
  loader: { crossOrigin: 'anonymous' },
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
});

// Mode dév (#cra, #astrub, #jeu) : directement en jeu, sans perso ni sauvegarde. Sinon : écran d'accueil (17A),
// avec la partie en vitrine derrière ; « Jouer » relance la scène avec le perso choisi.
const dev = /cra|astrub|jeu/.test(location.hash);
game.scene.add('zone', ZoneScene, true, dev ? {} : { vitrine: true });
const zone = () => game.scene.getScene('zone') as ZoneScene;
const accueil = new Accueil(slot => { accueil.hide(); zone().scene.restart({ slot }); },
  // Accueil 8B : essayer une classe 60 s dans les Champs d'Astrub, puis retour à la création
  (classe, sexe) => { accueil.hide(); zone().scene.restart({ classe, zone: 'champs-astrub', essai: sexe }); });
game.events.on('accueil', (page?: 'creation') => { zone().scene.restart({ vitrine: true }); accueil.show(page ?? 'accueil'); });
if (!dev) accueil.show();

// Accès console / tests automatisés
(window as unknown as { game: Phaser.Game }).game = game;
