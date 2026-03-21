import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;
const BLOCK_H = 28;

export class InfraStackScene extends BasePhaserScene {
  constructor() {
    super({ key: 'InfraStackScene' });
  }

  create() {
    this._stack = [{ x: WIDTH / 2 - 150, y: HEIGHT - 84, width: 300, perfect: false }];
    this._active = { x: 40, y: HEIGHT - 128, width: 280, direction: 1, speed: 250 };
    this._score = 0;
    this._layers = 1;

    this._bgGfx = this.add.graphics();
    this._blockGfx = this.add.graphics();
    this._activeGfx = this.add.graphics();

    this._hudText = this.add.text(28, 18, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '600',
      fontSize: '18px',
      color: '#11151d',
    });

    this._keys = this.input.keyboard.addKeys({
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    });
    this.input.on('pointerdown', () => this._placeBlock());
  }

  // Override emitHud for custom timeout: defeat if layers < 7
  emitHud(score, integrity, objective) {
    this._onHud?.({ score, integrity, objective, timeLeft: this.timeLeft });
    if (this.timeLeft <= 0 && !this._finished) {
      this.finish({
        result: this._layers >= 7 ? 'victory' : 'defeat',
        score,
        reason:
          this._layers >= 7
            ? 'Инфраструктура выдержала. Слои работают как единое целое. Теперь эту систему не так просто сломать.'
            : 'Обрушение. Нагрузка оказалась сильнее архитектуры. Система не выдержала давления.',
      });
    }
  }

  update(time, delta) {
    const dt = delta / 1000;

    this._active.x += this._active.direction * this._active.speed * dt;
    if (this._active.x < 24 || this._active.x + this._active.width > WIDTH - 24) {
      this._active.direction *= -1;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this._keys.space) ||
      Phaser.Input.Keyboard.JustDown(this._keys.up) ||
      Phaser.Input.Keyboard.JustDown(this._keys.w)
    ) {
      this._placeBlock();
    }

    this._redraw();
    this.emitHud(this._score, 3, `Слои: ${this._layers}/10`);
  }

  _placeBlock() {
    if (this._finished) return;
    const prev = this._stack[this._stack.length - 1];
    const overlapLeft = Math.max(prev.x, this._active.x);
    const overlapRight = Math.min(prev.x + prev.width, this._active.x + this._active.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth < 28) {
      this.finish({
        result: 'defeat',
        score: this._score,
        reason: 'Обрушение. Нагрузка оказалась сильнее архитектуры. Система не выдержала давления.',
      });
      return;
    }

    const perfect = Math.abs(prev.x - this._active.x) < 10;
    const nextWidth = perfect ? prev.width : overlapWidth;
    const nextX = perfect ? prev.x : overlapLeft;
    const nextY = prev.y - 44;

    this._stack.push({ x: nextX, y: nextY, width: nextWidth, perfect });
    this._layers += 1;
    this._score += perfect ? 180 : 130;

    if (this._layers >= 10) {
      this.finish({
        result: 'victory',
        score: this._score + Math.ceil(this.timeLeft) * 8,
        reason: 'Инфраструктура выдержала. Слои работают как единое целое. Теперь эту систему не так просто сломать.',
      });
      return;
    }

    this._active = {
      x: this._layers % 2 === 0 ? 36 : WIDTH - nextWidth - 36,
      y: nextY - 44,
      width: nextWidth,
      direction: this._layers % 2 === 0 ? 1 : -1,
      speed: Math.min(340, 240 + this._layers * 14),
    };
  }

  _redraw() {
    const topBlock = this._stack[this._stack.length - 1];
    const cameraOffset = Math.min(0, topBlock.y - 220);

    // Background gradient + grid
    this._bgGfx.clear();
    this._bgGfx.fillGradientStyle(0xf8fbff, 0xf8fbff, 0xe6f0ff, 0xe6f0ff, 1);
    this._bgGfx.fillRect(0, 0, WIDTH, HEIGHT);
    this._bgGfx.lineStyle(1, 0x0077ff, 0.12);
    for (let y = 0; y < HEIGHT; y += 56) {
      this._bgGfx.lineBetween(0, y, WIDTH, y);
    }

    // Stacked blocks
    this._blockGfx.clear();
    for (const block of this._stack) {
      const drawY = block.y - cameraOffset;
      this._blockGfx.fillStyle(block.perfect ? 0x0077ff : 0x11151d, 1);
      this._blockGfx.fillRect(block.x, drawY, block.width, BLOCK_H);
      this._blockGfx.fillStyle(0xffffff, 0.42);
      this._blockGfx.fillRect(block.x + 10, drawY + 6, Math.max(0, block.width - 20), 4);
    }

    // Active block
    this._activeGfx.clear();
    const activeDrawY = this._active.y - cameraOffset;
    this._activeGfx.fillStyle(0xffffff, 1);
    this._activeGfx.fillRect(this._active.x, activeDrawY, this._active.width, BLOCK_H);
    this._activeGfx.lineStyle(3, 0x0077ff, 1);
    this._activeGfx.strokeRect(this._active.x, activeDrawY, this._active.width, BLOCK_H);

    this._hudText.setText(`Укрепление слоёв: ${Math.ceil(this.timeLeft)} сек`);
  }
}
