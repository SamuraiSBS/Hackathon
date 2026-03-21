import Phaser from 'phaser';
import { BasePhaserScene } from './basePhaserScene';

const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_X = 220;
const GRAVITY = 720;
const JUMP_VELOCITY = -300;
const OBSTACLE_SPEED = 240;
const GROUND_H = 40;
const PLAY_H = HEIGHT - GROUND_H; // 500px active play area

export class EdgeGlideScene extends BasePhaserScene {
  constructor() {
    super({ key: 'EdgeGlideScene' });
  }

  create() {
    // ── Static background ──────────────────────────────────────────────────
    const bgGfx = this.add.graphics();
    bgGfx.fillGradientStyle(0x10161f, 0x10161f, 0x1b2940, 0x1b2940, 1);
    bgGfx.fillRect(0, 0, WIDTH, PLAY_H);

    // ── Grid overlay (drawn once, static) ─────────────────────────────────
    const gridGfx = this.add.graphics();
    gridGfx.lineStyle(1, 0x0077ff, 0.12);
    for (let x = 0; x <= WIDTH; x += 48) gridGfx.lineBetween(x, 0, x, PLAY_H);
    for (let y = 0; y <= PLAY_H; y += 48) gridGfx.lineBetween(0, y, WIDTH, y);

    // ── Dashed player-lane marker (static) ────────────────────────────────
    const laneGfx = this.add.graphics();
    laneGfx.lineStyle(2, 0x0077ff, 0.24);
    for (let y = 40; y < PLAY_H - 40; y += 36) {
      laneGfx.lineBetween(PLAYER_X, y, PLAYER_X, Math.min(y + 18, PLAY_H - 40));
    }

    // ── Dynamic render layers (cleared each frame) ────────────────────────
    this._groundGfx = this.add.graphics();
    this._obstacleGfx = this.add.graphics();
    this._playerGfx = this.add.graphics();
    this._flashGfx = this.add.graphics();

    // ── Game state ────────────────────────────────────────────────────────
    this._playerY = PLAY_H / 2;
    this._playerVelocity = 0;
    this._playerRotation = 0;
    this._obstacles = [];
    this._spawnTimer = 0.8;
    this._score = 0;
    this._passed = 0;
    this._integrity = 3;
    this._hitCooldown = 0;
    this._groundOffset = 0;
    this._justTapped = false;

    // ── Input ─────────────────────────────────────────────────────────────
    this._spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this._wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.input.on('pointerdown', () => {
      this._justTapped = true;
    });
  }

  update(_time, delta) {
    if (this._finished) return;

    const dt = Math.min(0.032, delta / 1000);

    // ── Input ─────────────────────────────────────────────────────────────
    const tapped =
      Phaser.Input.Keyboard.JustDown(this._spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this._upKey) ||
      Phaser.Input.Keyboard.JustDown(this._wKey) ||
      this._justTapped;
    this._justTapped = false;

    if (tapped) {
      this._playerVelocity = JUMP_VELOCITY;
    }

    // ── Physics ───────────────────────────────────────────────────────────
    this._playerVelocity += GRAVITY * dt;
    this._playerY += this._playerVelocity * dt;
    this._hitCooldown = Math.max(0, this._hitCooldown - dt);
    this._score += dt * 16;
    this._spawnTimer -= dt;
    this._groundOffset = (this._groundOffset + OBSTACLE_SPEED * dt) % 48;

    // ── Spawn obstacles ───────────────────────────────────────────────────
    if (this._spawnTimer <= 0) {
      this._spawnTimer = this._rnd(1.3, 1.75);
      this._obstacles.push({
        x: WIDTH + 90,
        width: this._rnd(60, 80),
        gapY: this._rnd(150, PLAY_H - 150),
        gapHeight: this._rnd(140, 175),
        passed: false,
      });
    }

    // ── Move obstacles, score, collision ──────────────────────────────────
    for (const obs of this._obstacles) {
      obs.x -= OBSTACLE_SPEED * dt;

      if (!obs.passed && obs.x + obs.width < PLAYER_X) {
        obs.passed = true;
        this._passed += 1;
        this._score += 140;
        this._spawnPassEffect();
      }

      if (this._collidesWithObstacle(this._playerY, obs) && this._hitCooldown === 0) {
        this._integrity -= 1;
        this._hitCooldown = 0.8;
        this._playerVelocity = -180;
        this._triggerHitFlash();
      }
    }

    this._obstacles = this._obstacles.filter((obs) => obs.x + obs.width > -100);

    // ── Boundary collision ────────────────────────────────────────────────
    if ((this._playerY < 30 || this._playerY > PLAY_H - 30) && this._hitCooldown === 0) {
      this._integrity -= 1;
      this._hitCooldown = 0.8;
      this._playerY = Math.min(Math.max(this._playerY, 30), PLAY_H - 30);
      this._playerVelocity = -160;
      this._triggerHitFlash();
    }

    // ── Defeat ────────────────────────────────────────────────────────────
    if (this._integrity <= 0) {
      this.finish({
        result: 'defeat',
        score: this._score,
        reason: 'Перегрузка. Канал не выдержал давления. Соединение потеряно.',
      });
      return;
    }

    // ── Victory (time out) — override BasePhaserScene to add integrity bonus
    if (this.timeLeft <= 0) {
      this.finish({
        result: 'victory',
        score: this._score + this._integrity * 120,
        reason:
          'Трафик стабилизирован. Ты провёл данные сквозь хаос и сохранил соединение живым. Сеть работает — благодаря тебе.',
      });
      return;
    }

    // ── Player rotation (Flappy Bird: nose-up on flap, nose-down on fall) ──
    const targetRot = Math.min(
      Math.PI * 0.45,
      Math.max(-Math.PI / 6, this._playerVelocity * 0.003),
    );
    this._playerRotation += (targetRot - this._playerRotation) * 0.15;

    // ── Render ────────────────────────────────────────────────────────────
    this._renderGround();
    this._renderObstacles();
    this._renderPlayer();

    // ── HUD ───────────────────────────────────────────────────────────────
    this.emitHud(Math.round(this._score), this._integrity, `Пролётов: ${this._passed}`);
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  _renderGround() {
    const g = this._groundGfx;
    g.clear();

    // Base fill
    g.fillStyle(0x0d3b6e, 1);
    g.fillRect(0, PLAY_H, WIDTH, GROUND_H);

    // Scrolling lighter stripe blocks
    g.fillStyle(0x1565c0, 1);
    for (let x = -this._groundOffset; x < WIDTH + 48; x += 48) {
      g.fillRect(x, PLAY_H, 24, GROUND_H);
    }

    // Top bright border
    g.fillStyle(0x90caf9, 1);
    g.fillRect(0, PLAY_H, WIDTH, 5);
  }

  _renderObstacles() {
    const g = this._obstacleGfx;
    g.clear();
    for (const obs of this._obstacles) {
      this._drawPipe(g, obs);
    }
  }

  _drawPipe(g, obs) {
    const topH = obs.gapY - obs.gapHeight / 2;
    const botY = obs.gapY + obs.gapHeight / 2;
    const botH = PLAY_H - botY;
    const capW = 14; // horizontal overhang of cap on each side
    const capH = 26; // cap height

    // ── Top pipe ─────────────────────────────────────────────────
    if (topH > 0) {
      // Body
      g.fillStyle(0x1565c0, 1);
      g.fillRect(obs.x, 0, obs.width, topH);
      // Highlight stripe
      g.fillStyle(0x42a5f5, 0.25);
      g.fillRect(obs.x + 5, 0, 8, topH);

      // Cap
      const capTop = Math.max(0, topH - capH);
      const capActualH = topH - capTop;
      g.fillStyle(0x1976d2, 1);
      g.fillRect(obs.x - capW, capTop, obs.width + capW * 2, capActualH);
      g.lineStyle(2, 0x90caf9, 1);
      g.strokeRect(obs.x - capW, capTop, obs.width + capW * 2, capActualH);
      // Cap highlight
      g.fillStyle(0x90caf9, 0.35);
      g.fillRect(obs.x - capW + 5, capTop + 3, 7, capActualH - 6);
    }

    // ── Bottom pipe ──────────────────────────────────────────────
    if (botH > 0) {
      // Body
      g.fillStyle(0x1565c0, 1);
      g.fillRect(obs.x, botY, obs.width, botH);
      // Highlight stripe
      g.fillStyle(0x42a5f5, 0.25);
      g.fillRect(obs.x + 5, botY, 8, botH);

      // Cap
      const capActualH = Math.min(capH, botH);
      g.fillStyle(0x1976d2, 1);
      g.fillRect(obs.x - capW, botY, obs.width + capW * 2, capActualH);
      g.lineStyle(2, 0x90caf9, 1);
      g.strokeRect(obs.x - capW, botY, obs.width + capW * 2, capActualH);
      // Cap highlight
      g.fillStyle(0x90caf9, 0.35);
      g.fillRect(obs.x - capW + 5, botY + 3, 7, capActualH - 6);
    }
  }

  _renderPlayer() {
    const g = this._playerGfx;
    g.clear();

    const x = PLAYER_X;
    const y = this._playerY;
    const rot = this._playerRotation;
    const damaged = this._hitCooldown > 0;

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Rotate a point relative to player center
    const rx = (px, py) => x + px * cos - py * sin;
    const ry = (px, py) => y + px * sin + py * cos;

    const pts = [
      [-26, 0],
      [0, -18],
      [26, 0],
      [0, 18],
    ];

    // Engine trail (behind player)
    if (!damaged) {
      g.fillStyle(0x0077ff, 0.12);
      g.fillCircle(rx(-46, 0), ry(-46, 0), 7);
      g.fillStyle(0x0077ff, 0.2);
      g.fillCircle(rx(-34, 0), ry(-34, 0), 10);
    }

    // Diamond fill
    g.fillStyle(damaged ? 0xff9999 : 0xffffff, 1);
    g.beginPath();
    g.moveTo(rx(...pts[0]), ry(...pts[0]));
    g.lineTo(rx(...pts[1]), ry(...pts[1]));
    g.lineTo(rx(...pts[2]), ry(...pts[2]));
    g.lineTo(rx(...pts[3]), ry(...pts[3]));
    g.closePath();
    g.fillPath();

    // Diamond outline
    g.lineStyle(3, damaged ? 0xff4444 : 0x0077ff, 1);
    g.beginPath();
    g.moveTo(rx(...pts[0]), ry(...pts[0]));
    g.lineTo(rx(...pts[1]), ry(...pts[1]));
    g.lineTo(rx(...pts[2]), ry(...pts[2]));
    g.lineTo(rx(...pts[3]), ry(...pts[3]));
    g.closePath();
    g.strokePath();

    // Engine core glow
    g.fillStyle(0x0077ff, 0.7);
    g.fillCircle(x, y, 4);
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  _triggerHitFlash() {
    this.tweens.killTweensOf(this._playerGfx);
    this._playerGfx.setAlpha(1);
  }

  _spawnPassEffect() {
    const g = this._flashGfx;
    g.clear();
    g.fillStyle(0x22c55e, 0.6);
    g.fillCircle(PLAYER_X + 38, this._playerY, 14);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(PLAYER_X + 38, this._playerY, 5);
    g.setAlpha(1);
    this.tweens.killTweensOf(g);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
    });
  }

  // ── Collision ────────────────────────────────────────────────────────────

  _collidesWithObstacle(playerY, obstacle) {
    const playerRadius = 22;
    const insideX =
      PLAYER_X + playerRadius > obstacle.x &&
      PLAYER_X - playerRadius < obstacle.x + obstacle.width;
    const inGap =
      playerY > obstacle.gapY - obstacle.gapHeight / 2 &&
      playerY < obstacle.gapY + obstacle.gapHeight / 2;
    return insideX && !inGap;
  }

  // ── Utils ────────────────────────────────────────────────────────────────

  _rnd(min, max) {
    return min + Math.random() * (max - min);
  }
}
