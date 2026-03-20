import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;

class ShieldHopScene extends BasePhaserScene {
  create() {
    this.score = 0;
    this.integrity = 3;
    this.playerX = WIDTH / 2;
    this.playerWorldY = HEIGHT - 150;
    this.playerVy = -520;
    this.bestWorldY = HEIGHT - 150;
    this.cameraY = 0;

    this.platforms = [];
    let currentY = HEIGHT - 80;
    for (let i = 0; i < 11; i++) {
      this.platforms.push({
        x: randomBetween(90, WIDTH - 220),
        y: currentY,
        width: randomBetween(110, 170),
        boost: Math.random() > 0.78,
      });
      currentY -= randomBetween(70, 115);
    }

    this.gfx = this.add.graphics().setScrollFactor(0);

    this.hudText = this.add
      .text(28, 18, '', {
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontSize: '18px',
        fontStyle: '600',
        color: '#ffffff',
      })
      .setScrollFactor(0)
      .setDepth(10);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({ left: 'A', right: 'D' });
  }

  update(_time, delta) {
    const dt = Math.min(delta / 1000, 0.032);
    const left = this.cursors.left.isDown || this.wasdKeys.left.isDown;
    const right = this.cursors.right.isDown || this.wasdKeys.right.isDown;
    const horizontalSpeed = left ? -260 : right ? 260 : 0;

    const previousY = this.playerWorldY;

    this.playerX += horizontalSpeed * dt;
    this.playerWorldY += this.playerVy * dt;
    this.playerVy += 980 * dt;

    if (this.playerX < -30) {
      this.playerX = WIDTH + 30;
    } else if (this.playerX > WIDTH + 30) {
      this.playerX = -30;
    }

    this.platforms.forEach((platform) => {
      const landsOnPlatform =
        this.playerVy > 0 &&
        previousY + 22 <= platform.y &&
        this.playerWorldY + 22 >= platform.y &&
        this.playerX > platform.x &&
        this.playerX < platform.x + platform.width;

      if (landsOnPlatform) {
        this.playerVy = platform.boost ? -720 : -560;
        this.score += platform.boost ? 110 : 80;
      }

      const screenY = platform.y - this.cameraY;
      if (screenY > HEIGHT + 50) {
        platform.y = this.cameraY - randomBetween(90, 140);
        platform.x = randomBetween(80, WIDTH - 210);
        platform.width = randomBetween(110, 170);
        platform.boost = Math.random() > 0.82;
      }
    });

    if (this.playerWorldY < this.bestWorldY) {
      this.bestWorldY = this.playerWorldY;
      this.score = Math.max(this.score, Math.round((HEIGHT - this.bestWorldY) * 2.1));
    }

    if (this.playerWorldY < this.cameraY + 180) {
      this.cameraY = this.playerWorldY - 180;
    }

    if (this.playerWorldY - this.cameraY > HEIGHT + 80) {
      this.finish({
        result: 'defeat',
        score: this.score,
        reason: 'Прорыв. Один неверный шаг — и защита дала трещину. Сеть пала быстрее, чем ты ожидал.',
      });
      return;
    }

    if (this.timeLeft <= 0 && !this._finished) {
      this.finish({
        result: 'victory',
        score: this.score + 180,
        reason: 'Периметр удержан. Атака захлебнулась, не добравшись до ядра системы. Ты доказал: защита — это не случайность, а навык.',
      });
      return;
    }

    this._draw();

    this.hudText.setText(`Защитный контур активен: ${Math.ceil(this.timeLeft)} сек`);

    const heightM = Math.max(0, Math.round((HEIGHT - this.bestWorldY) * 0.1));
    this.emitHud(Math.round(this.score), this.integrity, `Высота: ${heightM} м`);
  }

  _draw() {
    const gfx = this.gfx;
    gfx.clear();

    // Background gradient
    gfx.fillGradientStyle(0x10161f, 0x10161f, 0x273750, 0x273750, 1, 1, 1, 1);
    gfx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grid
    gfx.lineStyle(1, 0x0077ff, 0.12);
    for (let x = 0; x < WIDTH; x += 60) {
      gfx.beginPath();
      gfx.moveTo(x, 0);
      gfx.lineTo(x, HEIGHT);
      gfx.strokePath();
    }

    // Platforms
    this.platforms.forEach((platform) => {
      const sy = platform.y - this.cameraY;
      gfx.fillStyle(platform.boost ? 0x0077ff : 0xffffff, 1);
      gfx.fillRect(platform.x, sy, platform.width, 14);
      gfx.fillStyle(0x11151d, 0.16);
      gfx.fillRect(platform.x + 10, sy + 3, platform.width - 20, 4);
    });

    // Shield (player)
    const px = this.playerX;
    const py = this.playerWorldY - this.cameraY;

    gfx.fillStyle(0xffffff, 1);
    gfx.beginPath();
    gfx.moveTo(px, py - 26);
    gfx.lineTo(px + 20, py - 10);
    gfx.lineTo(px + 14, py + 18);
    gfx.lineTo(px, py + 28);
    gfx.lineTo(px - 14, py + 18);
    gfx.lineTo(px - 20, py - 10);
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(3, 0x0077ff, 1);
    gfx.beginPath();
    gfx.moveTo(px, py - 26);
    gfx.lineTo(px + 20, py - 10);
    gfx.lineTo(px + 14, py + 18);
    gfx.lineTo(px, py + 28);
    gfx.lineTo(px - 14, py + 18);
    gfx.lineTo(px - 20, py - 10);
    gfx.closePath();
    gfx.strokePath();
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export const shieldHopMode = {
  isPhaser: true,
  PhaserScene: ShieldHopScene,
};
