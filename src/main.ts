import Phaser from 'phaser';
import { ZoneScene } from './render/zoneScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#12141b',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [ZoneScene],
});

// Accès console / tests automatisés
(window as unknown as { game: Phaser.Game }).game = game;
