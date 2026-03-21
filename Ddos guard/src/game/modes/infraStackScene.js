import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;
const BLOCK_H = 32;
const BLOCK_STEP = 40;

// Blue/dark-blue palette — shades from deep navy to bright cyan
const PALETTE = [
  0x1a3a6b, // deep navy
  0x1e4d8c, // dark blue
  0x1565c0, // strong blue
  0x1976d2, // medium blue
  0x2196f3, // bright blue
  0x42a5f5, // light blue
  0x0d47a1, // indigo blue
  0x0277bd, // dark cyan-blue
  0x0288d1, // cyan-blue
  0x29b6f6, // sky cyan
];

export class InfraStackScene extends BasePhaserScene {
  constructor() {
    super({ key: 'InfraStackScene' });
  }

  create() {
    this._stack = [
      { x: WIDTH / 2 - 150, y: HEIGHT - 80, width: 300, perfect: false, color: PALETTE[0] },
    ];
    this._active = { x: 40, y: HEIGHT - 80 - BLOCK_STEP, width: 280, direction: 1, speed: 250 };
    this._score = 0;
    this._layers = 1;
    this._camY = 0; // smooth camera Y offset

    this._bgGfx = this.add.graphics();
    this._blockGfx = this.add.graphics();
    this._activeGfx = this.add.graphics();
    this._guideGfx = this.add.graphics();

    // HUD — fixed on screen, not part of world graphics
    this._timerText = this.add.text(WIDTH / 2, 24, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '700',
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5, 0);

    this._layerDots = this.add.text(WIDTH / 2, 56, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '700',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0);

    this._keys = this.input.keyboard.addKeys({
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    });
    this.input.on('pointerdown', () => this._placeBlock());
  }

  // Override emitHud: defeat on timeout if layers < 7
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

    // Move active block
    this._active.x += this._active.direction * this._active.speed * dt;
    if (this._active.x < 24 || this._active.x + this._active.width > WIDTH - 24) {
      this._active.direction *= -1;
    }

    // Keyboard tap
    if (
      Phaser.Input.Keyboard.JustDown(this._keys.space) ||
      Phaser.Input.Keyboard.JustDown(this._keys.up) ||
      Phaser.Input.Keyboard.JustDown(this._keys.w)
    ) {
      this._placeBlock();
    }

    // Smooth camera — lerp toward target
    const topBlock = this._stack[this._stack.length - 1];
    const targetCamY = Math.min(0, topBlock.y - 260);
    this._camY += (targetCamY - this._camY) * Math.min(1, 5 * dt);

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
    const nextY = prev.y - BLOCK_STEP;
    const points = perfect ? 180 : 130;
    const color = PALETTE[this._layers % PALETTE.length];

    this._stack.push({ x: nextX, y: nextY, width: nextWidth, perfect, color });
    this._layers += 1;
    this._score += points;

    // Floating score popup via Phaser tween
    const screenX = nextX + nextWidth / 2;
    const screenY = nextY - this._camY - 16;
    const popup = this.add.text(
      screenX,
      screenY,
      perfect ? `★  PERFECT  +${points}` : `+${points}`,
      {
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontStyle: '900',
        fontSize: perfect ? '26px' : '20px',
        color: perfect ? '#00e5ff' : '#90caf9',
        stroke: '#000000',
        strokeThickness: 5,
      }
    ).setOrigin(0.5, 1).setDepth(100);

    this.tweens.add({
      targets: popup,
      y: screenY - 80,
      alpha: 0,
      duration: 1100,
      ease: 'Power2',
      onComplete: () => popup.destroy(),
    });

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
      y: nextY - BLOCK_STEP,
      width: nextWidth,
      direction: this._layers % 2 === 0 ? 1 : -1,
      speed: Math.min(380, 240 + this._layers * 15),
    };
  }

  _redraw() {
    const camY = this._camY;
    const topBlock = this._stack[this._stack.length - 1];

    // ── Background ──────────────────────────────────────────────
    this._bgGfx.clear();
    this._bgGfx.fillGradientStyle(0x020c1f, 0x020c1f, 0x0a1929, 0x0a1929, 1);
    this._bgGfx.fillRect(0, 0, WIDTH, HEIGHT);

    // Dark grid
    this._bgGfx.lineStyle(1, 0x0d2845, 0.9);
    const gridOffY = ((camY * 0.25) % 60 + 60) % 60;
    for (let y = gridOffY - 60; y < HEIGHT + 60; y += 60) {
      this._bgGfx.lineBetween(0, y, WIDTH, y);
    }
    for (let x = 0; x < WIDTH; x += 80) {
      this._bgGfx.lineBetween(x, 0, x, HEIGHT);
    }

    // Subtle column guide (shows where tower sits)
    this._bgGfx.fillStyle(0x1565c0, 0.07);
    this._bgGfx.fillRect(topBlock.x, 0, topBlock.width, HEIGHT);

    // ── Guide lines from top block edges ────────────────────────
    this._guideGfx.clear();
    const topDrawY = topBlock.y - camY;
    if (topDrawY < HEIGHT) {
      this._guideGfx.lineStyle(1, 0x42a5f5, 0.3);
      this._guideGfx.lineBetween(topBlock.x, 0, topBlock.x, topDrawY);
      this._guideGfx.lineBetween(topBlock.x + topBlock.width, 0, topBlock.x + topBlock.width, topDrawY);
    }

    // ── Stacked blocks ───────────────────────────────────────────
    this._blockGfx.clear();
    for (const block of this._stack) {
      const drawY = block.y - camY;
      if (drawY > HEIGHT + 40 || drawY + BLOCK_H < -10) continue;

      const color = block.color ?? 0x1976d2;

      // Drop shadow
      this._blockGfx.fillStyle(0x000000, 0.45);
      this._blockGfx.fillRoundedRect(block.x + 4, drawY + 6, block.width, BLOCK_H, 6);

      // Main block
      this._blockGfx.fillStyle(color, 1);
      this._blockGfx.fillRoundedRect(block.x, drawY, block.width, BLOCK_H, 6);

      // Top gloss
      this._blockGfx.fillStyle(0xffffff, 0.28);
      this._blockGfx.fillRoundedRect(block.x + 6, drawY + 5, Math.max(0, block.width - 12), 11, 4);

      // Bottom dark edge
      this._blockGfx.fillStyle(0x000000, 0.18);
      this._blockGfx.fillRoundedRect(block.x, drawY + BLOCK_H - 7, block.width, 7, { tl: 0, tr: 0, bl: 6, br: 6 });

      // Perfect cyan ring
      if (block.perfect) {
        this._blockGfx.lineStyle(2, 0x00e5ff, 1);
        this._blockGfx.strokeRoundedRect(block.x - 1, drawY - 1, block.width + 2, BLOCK_H + 2, 7);
      }
    }

    // ── Active block (pulsing white) ─────────────────────────────
    this._activeGfx.clear();
    const activeDrawY = this._active.y - camY;
    const pulse = 0.78 + 0.22 * Math.sin(this.time.now / 180);

    // Drop shadow
    this._activeGfx.fillStyle(0x000000, 0.3);
    this._activeGfx.fillRoundedRect(this._active.x + 4, activeDrawY + 6, this._active.width, BLOCK_H, 6);

    // Body — bright cyan-blue pulsing
    this._activeGfx.fillStyle(0x29b6f6, pulse);
    this._activeGfx.fillRoundedRect(this._active.x, activeDrawY, this._active.width, BLOCK_H, 6);

    // Lighter cyan gloss
    this._activeGfx.fillStyle(0x80d8ff, 0.4);
    this._activeGfx.fillRoundedRect(
      this._active.x + 6,
      activeDrawY + 5,
      Math.max(0, this._active.width - 12),
      11,
      4
    );

    // Outline — electric cyan
    this._activeGfx.lineStyle(2, 0x00e5ff, 1);
    this._activeGfx.strokeRoundedRect(this._active.x, activeDrawY, this._active.width, BLOCK_H, 6);

    // ── HUD ───────────────────────────────────────────────────────
    const tl = Math.ceil(this.timeLeft);
    this._timerText.setText(`⏱  ${tl} сек`);

    // Layer progress as dots
    const filled = this._layers - 1;
    const dots = Array.from({ length: 9 }, (_, i) => (i < filled ? '●' : '○')).join('  ');
    this._layerDots.setText(dots);
  }
}
