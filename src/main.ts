import Phaser from 'phaser';
import { ZoneScene } from './render/zoneScene';
import { Accueil } from './render/accueil';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#12141b',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
});

// Mode dév (#cra, #astrub, #jeu) : directement en jeu, sans perso ni sauvegarde. Sinon : écran d'accueil (17A),
// avec la partie en vitrine derrière ; « Jouer » relance la scène avec le perso choisi.
const dev = /cra|astrub|jeu/.test(location.hash);
game.scene.add('zone', ZoneScene, true, dev ? {} : { vitrine: true });
const zone = () => game.scene.getScene('zone') as ZoneScene;
const accueil = new Accueil(slot => { accueil.hide(); zone().scene.restart({ slot }); });
game.events.on('accueil', () => { zone().scene.restart({ vitrine: true }); accueil.show(); });
if (!dev) accueil.show();

// Accès console / tests automatisés
(window as unknown as { game: Phaser.Game }).game = game;
