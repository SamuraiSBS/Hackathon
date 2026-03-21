import { BasePhaserScene } from './basePhaserScene';

const W = 960;
const H = 540;
const GRAVITY = 780;
const SPEED_THRESHOLD = 120;
const HIT_BUFFER = 18;
const TRAIL_TTL = 140;

export class BotSlicerScene extends BasePhaserScene {
  create() {
    // Game state
    this.targets = [];
    this.spawnTimer = 0.35;
    this.score = 0;
    this.combo = 0;
    this.integrity = 3;
    this.missedBots = 0;

    // Pointer tracking
    this.ptrX = W / 2;
    this.ptrY = H / 2;
    this.prevPtrX = W / 2;
    this.prevPtrY = H / 2;
    this.ptrSpeed = 0;
    this.ptrDown = false;
    this.lastPtrMoveAt = 0;
    this.trail = [];

    // --- Background gradient ---
    const bgTex = this.textures.createCanvas('bot-slicer-bg', W, H);
    const bgCtx = bgTex.getContext();
    const grad = bgCtx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#0d2f6b');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, W, H);
    bgTex.refresh();
    this.add.image(W / 2, H / 2, 'bot-slicer-bg');

    // --- Grid backdrop ---
    const gridGfx = this.add.graphics();
    gridGfx.lineStyle(1, 0x4488cc, 0.15);
    for (let y = 40; y < H; y += 46) {
      gridGfx.beginPath();
      gridGfx.moveTo(0, y);
      gridGfx.lineTo(W, y);
      gridGfx.strokePath();
    }

    // --- Trail (redrawn each frame) ---
    this.trailGfx = this.add.graphics();

    // --- Timer text ---
    this.timerText = this.add.text(28, 28, '', {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: '18px',
      fontStyle: '600',
      color: '#a8d4ff',
    });

    // --- Input ---
    this.input.on('pointerdown', (pointer) => {
      this.ptrDown = true;
      this.prevPtrX = pointer.x;
      this.prevPtrY = pointer.y;
      this.ptrX = pointer.x;
      this.ptrY = pointer.y;
      this.lastPtrMoveAt = this.time.now;
      this._pushTrail(pointer.x, pointer.y);
    });

    this.input.on('pointermove', (pointer) => {
      const now = this.time.now;
      const elapsed = Math.max(0.016, (now - this.lastPtrMoveAt) / 1000);
      const dx = pointer.x - this.ptrX;
      const dy = pointer.y - this.ptrY;

      this.prevPtrX = this.ptrX;
      this.prevPtrY = this.ptrY;
      this.ptrX = pointer.x;
      this.ptrY = pointer.y;
      this.ptrSpeed = Math.hypot(dx, dy) / elapsed;
      this.lastPtrMoveAt = now;
      this._pushTrail(pointer.x, pointer.y);
    });

    this.input.on('pointerup', () => {
      this.ptrDown = false;
      this.lastPtrMoveAt = this.time.now;
    });
  }

  _pushTrail(x, y) {
    const now = this.time.now;
    this.trail.push({ x, y, at: now });
    this.trail = this.trail.filter((p) => now - p.at < TRAIL_TTL);
  }

  update(time, delta) {
    if (this._finished) return;

    const dt = delta / 1000;
    const now = this.time.now;
    const ptrActive = this.ptrDown || now - this.lastPtrMoveAt < 120;

    // Expire old trail points
    this.trail = this.trail.filter((p) => now - p.at < TRAIL_TTL);

    // --- Spawn ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(0.34, 0.58);
      this._spawnTarget();
    }

    // --- Physics & Collision ---
    for (const t of this.targets) {
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.container.setPosition(t.x, t.y);

      if (!t.sliced && ptrActive && this.ptrSpeed > SPEED_THRESHOLD) {
        const d1 = Math.hypot(t.x - this.ptrX, t.y - this.ptrY);
        const d2 = Math.hypot(t.x - this.prevPtrX, t.y - this.prevPtrY);
        if (d1 < t.radius + HIT_BUFFER || d2 < t.radius + HIT_BUFFER) {
          t.sliced = true;
          if (t.type === 'bot') {
            this.score += 100 + Math.min(this.combo, 5) * 12;
            this.combo += 1;
          } else {
            this.combo = 0;
            this.integrity -= 1;
          }
        }
      }
    }

    // --- Cleanup ---
    this.targets = this.targets.filter((t) => {
      if (t.sliced) {
        t.container.destroy();
        return false;
      }
      if (t.y > H + 60) {
        if (t.type === 'bot') {
          this.missedBots += 1;
          this.combo = 0;
        }
        t.container.destroy();
        return false;
      }
      return true;
    });

    // --- Loss ---
    if (this.integrity <= 0 || this.missedBots >= 4) {
      this.finish({
        result: 'defeat',
        score: this.score,
        reason: 'Критическая ошибка. Ты задел не тех… Система потеряла доверие.',
      });
      return;
    }

    // --- Victory (before emitHud to apply bonus) ---
    if (this.timeLeft <= 0) {
      this.finish({
        result: 'victory',
        score: this.score + this.integrity * 110,
        reason:
          'Чистая работа. Боты уничтожены, пользователи не пострадали. Идеальная фильтрация — уровень мастера.',
      });
      return;
    }

    // --- Draw trail ---
    this.trailGfx.clear();
    const len = this.trail.length;
    for (let i = 0; i < len; i++) {
      const alpha = ((i + 1) / len) * 0.35;
      const r = 6 * ((i + 1) / len);
      this.trailGfx.fillStyle(0x00d4ff, alpha);
      this.trailGfx.fillCircle(this.trail[i].x, this.trail[i].y, r);
    }

    // --- Timer ---
    this.timerText.setText(`Окно отражения: ${Math.ceil(this.timeLeft)} сек`);

    // --- HUD ---
    this._onHud?.({
      score: Math.round(this.score),
      integrity: this.integrity,
      objective: `Комбо: x${this.combo}`,
      timeLeft: this.timeLeft,
    });
  }

  _spawnTarget() {
    const type = Math.random() > 0.26 ? 'bot' : 'clean';
    const radius = rand(22, 34);

    const gfx = this.add.graphics();
    gfx.fillStyle(type === 'bot' ? 0x061430 : 0x38b6ff, 1);
    gfx.fillCircle(0, 0, radius);

    const label = this.add
      .text(0, 0, type === 'bot' ? 'BOT' : 'OK', {
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    const x = rand(100, W - 100);
    const y = H + 40;
    const container = this.add.container(x, y, [gfx, label]);

    this.targets.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-520, -400),
      radius,
      type,
      sliced: false,
      container,
    });
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
