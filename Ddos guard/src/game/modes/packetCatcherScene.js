import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;
const CATCHER_W = 120;
const CATCHER_H = 22;
const CATCHER_Y = HEIGHT - 52;

export class PacketCatcherScene extends BasePhaserScene {
  constructor() {
    super({ key: 'PacketCatcherScene' });
  }

  create() {
    // State
    this._catcherX = WIDTH / 2 - CATCHER_W / 2;
    this._items = [];
    this._spawnTimer = 0.6;
    this._score = 0;
    this._integrity = 1;
    this._cleanCaught = 0;
    this._pointerX = null;
    this._pointerLastMoveAt = -9999;

    // Graphics layers
    this._bgGfx = this.add.graphics();
    this._itemsGfx = this.add.graphics();
    this._catcherGfx = this.add.graphics();

    // Keyboard
    this._keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Mouse/Touch
    this.input.on('pointermove', (ptr) => {
      this._pointerX = ptr.x;
      this._pointerLastMoveAt = this.time.now;
    });
    this.input.on('pointerdown', (ptr) => {
      this._pointerX = ptr.x;
      this._pointerLastMoveAt = this.time.now;
    });

    // HUD texts
    this._timerText = this.add.text(WIDTH / 2, 20, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '700',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(10);

    this._integrityText = this.add.text(WIDTH - 20, 20, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '700',
      fontSize: '20px',
      color: '#42a5f5',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'right',
    }).setOrigin(1, 0).setDepth(10);
  }

  update(time, delta) {
    const dt = delta / 1000;

    // --- Move catcher ---
    const pointerActive = this.time.now - this._pointerLastMoveAt < 150;
    if (pointerActive && this._pointerX !== null) {
      this._catcherX = Phaser.Math.Clamp(
        this._pointerX - CATCHER_W / 2,
        20,
        WIDTH - CATCHER_W - 20
      );
    } else {
      const left = this._keys.left.isDown || this._keys.a.isDown;
      const right = this._keys.right.isDown || this._keys.d.isDown;
      const speed = left ? -340 : right ? 340 : 0;
      this._catcherX = Phaser.Math.Clamp(
        this._catcherX + speed * dt,
        20,
        WIDTH - CATCHER_W - 20
      );
    }

    // --- Spawn items ---
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = Phaser.Math.FloatBetween(0.26, 0.5);
      this._items.push({
        x: Phaser.Math.FloatBetween(40, WIDTH - 40),
        y: -30,
        radius: Phaser.Math.FloatBetween(14, 22),
        speed: Phaser.Math.FloatBetween(200, 290),
        type: Math.random() > 0.3 ? 'clean' : 'bad',
        collected: false,
      });
    }

    // --- Move & collide ---
    for (const item of this._items) {
      item.y += item.speed * dt;

      const inX = item.x > this._catcherX && item.x < this._catcherX + CATCHER_W;
      const inY = item.y + item.radius > CATCHER_Y && item.y - item.radius < CATCHER_Y + CATCHER_H;

      if (inX && inY) {
        item.collected = true;
        if (item.type === 'clean') {
          this._cleanCaught += 1;
          this._score += 90;
          this._spawnPopup(item.x, CATCHER_Y, '+90', '#90caf9');
        } else {
          this._integrity -= 1;
          this._score = Math.max(0, this._score - 40);
          this._spawnPopup(item.x, CATCHER_Y, '-40', '#ef5350');
          if (this._integrity <= 0) {
            this.finish({
              result: 'defeat',
              score: this._score,
              reason: 'Фильтр пробит. Вредоносный трафик прошёл внутрь. Система под угрозой.',
            });
            return;
          }
        }
      }
    }

    this._items = this._items.filter((i) => !i.collected && i.y < HEIGHT + 50);

    // --- Redraw ---
    this._redraw();

    // HUD
    const tl = Math.ceil(this.timeLeft);
    this._timerText.setText(`⏱  ${tl} сек`);
    const hearts = this._integrity > 0 ? '❤' : '♡';
    this._integrityText.setText(hearts);

    this.emitHud(this._score, this._integrity, `Чистых пакетов: ${this._cleanCaught}`);
  }

  _spawnPopup(x, y, text, color) {
    const popup = this.add.text(x, y - 10, text, {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontStyle: '900',
      fontSize: '22px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(100);

    this.tweens.add({
      targets: popup,
      y: y - 80,
      alpha: 0,
      duration: 900,
      ease: 'Power2',
      onComplete: () => popup.destroy(),
    });
  }

  _redraw() {
    // ── Background ──
    this._bgGfx.clear();
    this._bgGfx.fillGradientStyle(0x020c1f, 0x020c1f, 0x0a1929, 0x0a1929, 1);
    this._bgGfx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid
    this._bgGfx.lineStyle(1, 0x0d2845, 0.9);
    for (let y = 0; y < HEIGHT; y += 60) {
      this._bgGfx.lineBetween(0, y, WIDTH, y);
    }
    for (let x = 0; x < WIDTH; x += 72) {
      this._bgGfx.lineBetween(x, 0, x, HEIGHT);
    }

    // Catcher zone line
    this._bgGfx.lineStyle(1, 0x1565c0, 0.4);
    this._bgGfx.lineBetween(0, CATCHER_Y + CATCHER_H + 8, WIDTH, CATCHER_Y + CATCHER_H + 8);

    // ── Items ──
    this._itemsGfx.clear();
    for (const item of this._items) {
      if (item.type === 'clean') {
        // Outer glow ring
        this._itemsGfx.lineStyle(3, 0x42a5f5, 0.4);
        this._itemsGfx.strokeCircle(item.x, item.y, item.radius + 5);
        // Main circle
        this._itemsGfx.fillStyle(0x1976d2, 1);
        this._itemsGfx.fillCircle(item.x, item.y, item.radius);
        // Inner highlight
        this._itemsGfx.fillStyle(0x90caf9, 0.7);
        this._itemsGfx.fillCircle(item.x - item.radius * 0.28, item.y - item.radius * 0.28, item.radius * 0.38);
      } else {
        // Bad packet — dark purple
        this._itemsGfx.lineStyle(2, 0xb71c1c, 0.7);
        this._itemsGfx.strokeCircle(item.x, item.y, item.radius + 4);
        this._itemsGfx.fillStyle(0x4a148c, 1);
        this._itemsGfx.fillCircle(item.x, item.y, item.radius);
        // Red core
        this._itemsGfx.fillStyle(0xc62828, 0.85);
        this._itemsGfx.fillCircle(item.x, item.y, item.radius * 0.42);
        // X marks
        const r = item.radius * 0.55;
        this._itemsGfx.lineStyle(2, 0xff5252, 1);
        this._itemsGfx.lineBetween(item.x - r, item.y - r, item.x + r, item.y + r);
        this._itemsGfx.lineBetween(item.x + r, item.y - r, item.x - r, item.y + r);
      }
    }

    // ── Catcher ──
    this._catcherGfx.clear();
    const pulse = 0.75 + 0.25 * Math.sin(this.time.now / 200);

    // Shadow
    this._catcherGfx.fillStyle(0x000000, 0.4);
    this._catcherGfx.fillRoundedRect(this._catcherX + 4, CATCHER_Y + 6, CATCHER_W, CATCHER_H, 6);

    // Body
    this._catcherGfx.fillStyle(0x1565c0, 1);
    this._catcherGfx.fillRoundedRect(this._catcherX, CATCHER_Y, CATCHER_W, CATCHER_H, 6);

    // Top gloss
    this._catcherGfx.fillStyle(0xffffff, 0.25);
    this._catcherGfx.fillRoundedRect(this._catcherX + 6, CATCHER_Y + 4, CATCHER_W - 12, 8, 3);

    // Pulsing cyan outline
    this._catcherGfx.lineStyle(2, 0x00e5ff, pulse);
    this._catcherGfx.strokeRoundedRect(this._catcherX, CATCHER_Y, CATCHER_W, CATCHER_H, 6);

    // Outer glow
    this._catcherGfx.lineStyle(6, 0x00e5ff, pulse * 0.2);
    this._catcherGfx.strokeRoundedRect(this._catcherX - 3, CATCHER_Y - 3, CATCHER_W + 6, CATCHER_H + 6, 9);
  }
}
