import Phaser from 'phaser';

/**
 * Base scene for all Phaser-based game modes.
 *
 * Subclass this and implement create() / update(time, delta).
 * Call this.emitHud(score, integrity, objective) every frame to update the HUD.
 * Call this.finish({ result, score, reason }) to end the game early.
 *
 * The scene is automatically ended when the timer runs out (calls finish with result='victory').
 */
export class BasePhaserScene extends Phaser.Scene {
  init() {
    this._onHud = this.registry.get('onHud');
    this._onFinish = this.registry.get('onFinish');
    this._durationSeconds = this.registry.get('durationSeconds');
    this._startedAt = this.time.now;
    this._finished = false;
  }

  get timeLeft() {
    return Math.max(0, this._durationSeconds - (this.time.now - this._startedAt) / 1000);
  }

  finish({ result, score = 0, reason = '' }) {
    if (this._finished) return;
    this._finished = true;
    this._onFinish?.({
      result,
      score: Math.round(score),
      reason,
      durationSeconds: Math.ceil((this.time.now - this._startedAt) / 1000),
    });
    this.scene.stop();
  }

  emitHud(score = 0, integrity = 3, objective = '') {
    this._onHud?.({ score, integrity, objective, timeLeft: this.timeLeft });
    if (this.timeLeft <= 0 && !this._finished) {
      this.finish({ result: 'victory', score });
    }
  }
}
