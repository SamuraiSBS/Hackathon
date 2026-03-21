import Phaser from 'phaser';
import { getModeById } from './modes';

const WIDTH = 960;
const HEIGHT = 540;

export function createPhaserEngine({ canvas, game, onHud, onFinish }) {
  const mode = getModeById(game.id);
  const SceneClass = mode.PhaserScene;

  // Replace the React-managed <canvas> with a host <div>.
  // Phaser then creates its own <canvas> inside that div.
  // This prevents Phaser's ScaleManager from fighting CSS layout.
  const shellDiv = canvas.parentElement;
  const host = document.createElement('div');
  host.className = 'phaser-host';
  shellDiv.replaceChild(host, canvas);

  const phaserGame = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: host,
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
      expandParent: false,
    },
    audio: {
      noAudio: true,
    },
  });

  return {
    destroy: () => {
      phaserGame.destroy(true, false);
      // Restore the original canvas so React's DOM matches its VDOM
      if (host.parentElement) {
        host.parentElement.replaceChild(canvas, host);
      }
    },
  };
}
