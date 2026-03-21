import Phaser from 'phaser';
import { getModeById } from './modes';

const WIDTH = 960;
const HEIGHT = 540;

export function createPhaserEngine({ container, game, onHud, onFinish }) {
  const mode = getModeById(game.id);
  const SceneClass = mode.PhaserScene;

  const phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#f8fbff',
    scene: SceneClass,
    callbacks: {
      preBoot: (g) => {
        g.registry.set('onHud', onHud);
        g.registry.set('onFinish', onFinish);
        g.registry.set('durationSeconds', game.durationSeconds);
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: {
      noAudio: true,
    },
  });

  return {
    destroy: () => phaserGame.destroy(true, false),
  };
}
