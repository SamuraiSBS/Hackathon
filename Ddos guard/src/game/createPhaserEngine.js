import Phaser from 'phaser';
import { getModeById } from './modes';

const WIDTH = 960;
const HEIGHT = 540;

export function createPhaserEngine({ canvas, game, onHud, onFinish }) {
  const mode = getModeById(game.id);
  const SceneClass = mode.PhaserScene;

  const phaserGame = new Phaser.Game({
    type: Phaser.CANVAS,
    canvas,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0a0a1a',
    scene: SceneClass,
    callbacks: {
      preBoot: (g) => {
        g.registry.set('onHud', onHud);
        g.registry.set('onFinish', onFinish);
        g.registry.set('durationSeconds', game.durationSeconds);
      },
    },
    scale: {
      mode: Phaser.Scale.NONE,
    },
    audio: {
      noAudio: true,
    },
  });

  return {
    destroy: () => phaserGame.destroy(true, false),
  };
}
