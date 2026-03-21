import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;

const GRAVITY = 800;
const JUMP_VELOCITY = -650;
const BOOST_VELOCITY = -1000;
const HORIZONTAL_SPEED = 380;

const PLATFORM_COUNT = 12;
const PLATFORM_MIN_WIDTH = 90;
const PLATFORM_MAX_WIDTH = 150;
const PLATFORM_HEIGHT = 14;
const PLATFORM_GAP_MIN = 50;
const PLATFORM_GAP_MAX = 150;
const BOOST_CHANCE = 0.15;

const SCORE_NORMAL = 80;
const SCORE_BOOST = 110;
const HEIGHT_MULTIPLIER = 2.1;
const VICTORY_BONUS = 180;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

class ShieldHopScene extends BasePhaserScene {
  create() {
    this.score = 0;
    this.integrity = 3;
    this.bestWorldY = HEIGHT - 150;

    this.physics.world.gravity.y = GRAVITY;

    this._generateTextures();
    this._drawBackground();

    // Player
    this.player = this.physics.add.sprite(WIDTH / 2, HEIGHT - 150, 'shield');
    this.player.setVelocityY(JUMP_VELOCITY);
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(34, 40);
    this.player.body.setOffset(4, 8);
    this.player.setDepth(5);

    // Platforms
    this.platformGroup = this.physics.add.staticGroup();
    this._spawnInitialPlatforms();

    // Overlap-based collision (no physical separation)
    this.physics.add.overlap(
      this.player,
      this.platformGroup,
      this._onPlatformLand,
      this._shouldLand,
      this,
    );

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({ left: 'A', right: 'D' });

    // HUD text (fixed on screen)
    this.hudText = this.add
      .text(28, 18, '', {
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontSize: '18px',
        fontStyle: '600',
        color: '#a8d8ff',
      })
      .setScrollFactor(0)
      .setDepth(10);

    // Landing particles
    this.landingEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 40, max: 120 },
      angle: { min: 220, max: 320 },
      lifespan: 350,
      quantity: 8,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    });
    this.landingEmitter.setDepth(4);

    this.boostEmitter = this.add.particles(0, 0, 'particle-blue', {
      speed: { min: 60, max: 160 },
      angle: { min: 200, max: 340 },
      lifespan: 500,
      quantity: 14,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.boostEmitter.setDepth(4);
  }

  update(_time, delta) {
    if (this._finished) return;

    // Horizontal input
    const left = this.cursors.left.isDown || this.wasdKeys.left.isDown;
    const right = this.cursors.right.isDown || this.wasdKeys.right.isDown;
    this.player.setVelocityX(left ? -HORIZONTAL_SPEED : right ? HORIZONTAL_SPEED : 0);

    // Screen wrapping
    if (this.player.x < -30) {
      this.player.x = WIDTH + 30;
    } else if (this.player.x > WIDTH + 30) {
      this.player.x = -30;
    }

    // Height score
    if (this.player.y < this.bestWorldY) {
      this.bestWorldY = this.player.y;
      this.score = Math.max(this.score, Math.round((HEIGHT - this.bestWorldY) * HEIGHT_MULTIPLIER));
    }

    // Camera — follow upward only
    if (this.player.y < this.cameras.main.scrollY + 180) {
      this.cameras.main.scrollY = this.player.y - 180;
    }

    // Recycle platforms that fell below camera
    this._recyclePlatforms();

    // Defeat — fell below screen
    if (this.player.y > this.cameras.main.scrollY + HEIGHT + 80) {
      this.finish({
        result: 'defeat',
        score: this.score,
        reason: 'Прорыв. Один неверный шаг — и защита дала трещину. Сеть пала быстрее, чем ты ожидал.',
      });
      return;
    }

    // Victory — time's up
    if (this.timeLeft <= 0 && !this._finished) {
      this.finish({
        result: 'victory',
        score: this.score + VICTORY_BONUS,
        reason: 'Периметр удержан. Атака захлебнулась, не добравшись до ядра системы. Ты доказал: защита — это не случайность, а навык.',
      });
      return;
    }

    // HUD
    this.hudText.setText(`Защитный контур активен: ${Math.ceil(this.timeLeft)} сек`);
    const heightM = Math.max(0, Math.round((HEIGHT - this.bestWorldY) * 0.1));
    this.emitHud(Math.round(this.score), this.integrity, `Высота: ${heightM} м`);
  }

  // --- Collision ---

  _shouldLand(player, platform) {
    return (
      player.body.velocity.y > 0 &&
      player.body.bottom >= platform.body.top &&
      player.body.bottom <= platform.body.top + 24
    );
  }

  _onPlatformLand(player, platform) {
    const isBoost = platform.getData('boost');

    player.setVelocityY(isBoost ? BOOST_VELOCITY : JUMP_VELOCITY);
    player.y = platform.body.top - player.body.halfHeight;
    this.score += isBoost ? SCORE_BOOST : SCORE_NORMAL;

    // Particles
    if (isBoost) {
      this.boostEmitter.emitParticleAt(player.x, platform.y);
      this.cameras.main.shake(80, 0.003);
    } else {
      this.landingEmitter.emitParticleAt(player.x, platform.y);
    }

    // Squash & stretch
    this.tweens.add({
      targets: player,
      scaleX: 1.25,
      scaleY: 0.75,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // Platform bump
    const origY = platform.y;
    this.tweens.add({
      targets: platform,
      y: origY + 4,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        platform.y = origY;
        platform.refreshBody();
      },
    });
  }

  // --- Platforms ---

  _spawnInitialPlatforms() {
    let currentY = HEIGHT - 80;
    // Гарантированная платформа прямо под стартовой позицией игрока
    const startW = randomBetween(PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH);
    this._createPlatform(WIDTH / 2, currentY, startW, false);
    currentY -= randomBetween(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
    for (let i = 1; i < PLATFORM_COUNT; i++) {
      const w = randomBetween(PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH);
      const x = randomBetween(90, WIDTH - 220);
      const isBoost = Math.random() < BOOST_CHANCE;
      this._createPlatform(x + w / 2, currentY, w, isBoost);
      currentY -= randomBetween(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
    }
  }

  _createPlatform(cx, y, width, isBoost) {
    const key = isBoost ? 'platform-boost' : 'platform-normal';
    const platform = this.platformGroup.create(cx, y, key);
    platform.setDisplaySize(width, PLATFORM_HEIGHT);
    platform.refreshBody();
    platform.setData('boost', isBoost);
    platform.setDepth(2);

    if (isBoost) {
      this.tweens.add({
        targets: platform,
        alpha: { from: 1, to: 0.7 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return platform;
  }

  _recyclePlatforms() {
    const cameraBottom = this.cameras.main.scrollY + HEIGHT;
    const cameraTop = this.cameras.main.scrollY;

    const toRecycle = this.platformGroup.getChildren().filter(
      (p) => p.y > cameraBottom + 50
    );

    if (toRecycle.length === 0) return;

    // Find the topmost platform among non-recycled ones
    let topY = cameraTop - 60;
    this.platformGroup.getChildren().forEach((p) => {
      if (!toRecycle.includes(p) && p.y < topY) {
        topY = p.y;
      }
    });

    // Place each recycled platform above the previous with a proper gap
    toRecycle.forEach((platform) => {
      const newWidth = randomBetween(PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH);
      const newX = randomBetween(80, WIDTH - 210) + newWidth / 2;
      topY -= randomBetween(PLATFORM_GAP_MIN, PLATFORM_GAP_MAX);
      const isBoost = Math.random() < BOOST_CHANCE;

      platform.setPosition(newX, topY);
      platform.setDisplaySize(newWidth, PLATFORM_HEIGHT);
      platform.setTexture(isBoost ? 'platform-boost' : 'platform-normal');
      platform.setData('boost', isBoost);
      platform.setAlpha(1);
      platform.refreshBody();

      this.tweens.killTweensOf(platform);
      if (isBoost) {
        this.tweens.add({
          targets: platform,
          alpha: { from: 1, to: 0.7 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  // --- Textures ---

  _generateTextures() {
    // Shield (player) — light blue hexagon with dark blue outline
    const sg = this.make.graphics({ add: false });
    sg.fillStyle(0x90c8f4, 1);
    sg.beginPath();
    sg.moveTo(21, 0);
    sg.lineTo(41, 16);
    sg.lineTo(35, 44);
    sg.lineTo(21, 54);
    sg.lineTo(7, 44);
    sg.lineTo(1, 16);
    sg.closePath();
    sg.fillPath();
    sg.lineStyle(3, 0x04509e, 1);
    sg.beginPath();
    sg.moveTo(21, 0);
    sg.lineTo(41, 16);
    sg.lineTo(35, 44);
    sg.lineTo(21, 54);
    sg.lineTo(7, 44);
    sg.lineTo(1, 16);
    sg.closePath();
    sg.strokePath();
    sg.generateTexture('shield', 42, 56);
    sg.destroy();

    // Normal platform — medium blue
    const pg = this.make.graphics({ add: false });
    pg.fillStyle(0x3a88d8, 1);
    pg.fillRect(0, 0, PLATFORM_MAX_WIDTH, PLATFORM_HEIGHT);
    pg.generateTexture('platform-normal', PLATFORM_MAX_WIDTH, PLATFORM_HEIGHT);
    pg.destroy();

    // Boost platform — dark royal blue
    const bg = this.make.graphics({ add: false });
    bg.fillStyle(0x0d3596, 1);
    bg.fillRect(0, 0, PLATFORM_MAX_WIDTH, PLATFORM_HEIGHT);
    bg.generateTexture('platform-boost', PLATFORM_MAX_WIDTH, PLATFORM_HEIGHT);
    bg.destroy();

    // Light blue particle
    const wp = this.make.graphics({ add: false });
    wp.fillStyle(0xaae0ff, 1);
    wp.fillCircle(4, 4, 4);
    wp.generateTexture('particle', 8, 8);
    wp.destroy();

    // Bright blue particle
    const bp = this.make.graphics({ add: false });
    bp.fillStyle(0x40b8ff, 1);
    bp.fillCircle(4, 4, 4);
    bp.generateTexture('particle-blue', 8, 8);
    bp.destroy();
  }

  _drawBackground() {
    const bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    bg.fillGradientStyle(0x04111f, 0x04111f, 0x0a2040, 0x0a2040, 1, 1, 1, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    bg.lineStyle(1, 0x1560c0, 0.20);
    for (let x = 0; x < WIDTH; x += 60) {
      bg.beginPath();
      bg.moveTo(x, 0);
      bg.lineTo(x, HEIGHT);
      bg.strokePath();
    }
  }
}

export const shieldHopMode = {
  isPhaser: true,
  PhaserScene: ShieldHopScene,
};
