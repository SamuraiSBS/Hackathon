import { BasePhaserScene } from './basePhaserScene';

const W = 960;
const H = 540;
const GRAVITY = 780;
const SPEED_THRESHOLD = 120;
const HIT_BUFFER = 18;
const TRAIL_TTL = 160;

export class BotSlicerScene extends BasePhaserScene {
  create() {
    this.targets = [];
    this.halves = [];
    this.particles = [];
    this.slashFlashes = [];
    this.spawnTimer = 0.35;
    this.score = 0;
    this.combo = 0;
    this.integrity = 3;
    this.missedBots = 0;

    this.ptrX = W / 2;
    this.ptrY = H / 2;
    this.prevPtrX = W / 2;
    this.prevPtrY = H / 2;
    this.ptrSpeed = 0;
    this.ptrDown = false;
    this.lastPtrMoveAt = 0;
    this.trail = [];

    // Background
    const bgTex = this.textures.createCanvas('bot-slicer-bg', W, H);
    const bgCtx = bgTex.getContext();
    const grad = bgCtx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#0d2f6b');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, W, H);
    bgTex.refresh();
    this.add.image(W / 2, H / 2, 'bot-slicer-bg').setDepth(0);

    // Grid
    const gridGfx = this.add.graphics().setDepth(1);
    gridGfx.lineStyle(1, 0x4488cc, 0.15);
    for (let y = 40; y < H; y += 46) {
      gridGfx.beginPath();
      gridGfx.moveTo(0, y);
      gridGfx.lineTo(W, y);
      gridGfx.strokePath();
    }

    // Effect layers — target containers sit at depth 3
    this.halvesGfx = this.add.graphics().setDepth(4);
    this.particlesGfx = this.add.graphics().setDepth(5);
    this.flashGfx = this.add.graphics().setDepth(6);
    this.trailGfx = this.add.graphics().setDepth(8);

    this.timerText = this.add
      .text(28, 28, '', {
        fontFamily: '"IBM Plex Sans", sans-serif',
        fontSize: '18px',
        fontStyle: '600',
        color: '#a8d4ff',
      })
      .setDepth(10);

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

  /** Spawn two half-circle pieces, juice particles and a flash line on slice */
  _sliceTarget(t) {
    const sliceDx = this.ptrX - this.prevPtrX;
    const sliceDy = this.ptrY - this.prevPtrY;
    const sliceAngle = Math.atan2(sliceDy, sliceDx);

    // Perpendicular to cut — used to push halves apart
    const normX = -Math.sin(sliceAngle);
    const normY = Math.cos(sliceAngle);

    const fillColor = t.type === 'bot' ? 0x061430 : 0x38b6ff;
    const edgeColor = t.type === 'bot' ? 0x2255cc : 0x00ccff;

    for (let side = -1; side <= 1; side += 2) {
      const push = 55 + Math.random() * 65;
      this.halves.push({
        x: t.x + normX * side * 3,
        y: t.y + normY * side * 3,
        vx: t.vx + normX * side * push,
        vy: t.vy + normY * side * push - 30,
        va: side * (2.0 + Math.random() * 3.5), // angular velocity rad/s
        angle: t.angle,
        radius: t.radius,
        fillColor,
        edgeColor,
        side,
        sliceAngle,
        alpha: 1,
        born: this.time.now,
        ttl: 700 + Math.random() * 400,
      });
    }

    // Juice particles
    const juiceColor = t.type === 'bot' ? 0x3366ff : 0x00ccff;
    const count = 10 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 230;
      this.particles.push({
        x: t.x,
        y: t.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 70,
        r: 2 + Math.random() * 3.5,
        color: juiceColor,
        alpha: 1,
        born: this.time.now,
        ttl: 360 + Math.random() * 360,
      });
    }

    // Brief white flash line along the cut
    this.slashFlashes.push({
      x: t.x,
      y: t.y,
      angle: sliceAngle,
      len: t.radius + 18,
      born: this.time.now,
      ttl: 140,
    });

    t.container.destroy();
  }

  update(time, delta) {
    if (this._finished) return;

    const dt = delta / 1000;
    const now = this.time.now;
    const ptrActive = this.ptrDown || now - this.lastPtrMoveAt < 120;

    this.trail = this.trail.filter((p) => now - p.at < TRAIL_TTL);

    // Spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(0.34, 0.58);
      this._spawnTarget();
    }

    // Physics & collision
    for (const t of this.targets) {
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.angle += t.va * dt;
      t.container.setPosition(t.x, t.y);
      t.container.setRotation(t.angle);

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
          this._sliceTarget(t);
        }
      }
    }

    // Update halves physics
    for (const h of this.halves) {
      h.vy += GRAVITY * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.angle += h.va * dt;
      const age = now - h.born;
      h.alpha = Math.max(0, 1 - (age / h.ttl) * 0.65);
    }

    // Draw halves
    this.halvesGfx.clear();
    for (const h of this.halves) {
      this._drawHalf(h);
    }
    this.halves = this.halves.filter((h) => now - h.born < h.ttl && h.y < H + 100);

    // Update & draw particles
    this.particlesGfx.clear();
    for (const p of this.particles) {
      p.vy += GRAVITY * 0.25 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const age = now - p.born;
      p.alpha = Math.max(0, 1 - age / p.ttl);
      this.particlesGfx.fillStyle(p.color, p.alpha);
      this.particlesGfx.fillCircle(p.x, p.y, p.r * (0.4 + 0.6 * p.alpha));
    }
    this.particles = this.particles.filter((p) => now - p.born < p.ttl);

    // Draw & expire flash lines
    this.flashGfx.clear();
    for (const f of this.slashFlashes) {
      const alpha = Math.max(0, 1 - (now - f.born) / f.ttl);
      const cos = Math.cos(f.angle);
      const sin = Math.sin(f.angle);
      this.flashGfx.lineStyle(3, 0xffffff, alpha);
      this.flashGfx.beginPath();
      this.flashGfx.moveTo(f.x - cos * f.len, f.y - sin * f.len);
      this.flashGfx.lineTo(f.x + cos * f.len, f.y + sin * f.len);
      this.flashGfx.strokePath();
    }
    this.slashFlashes = this.slashFlashes.filter((f) => now - f.born < f.ttl);

    // Cleanup targets (container already destroyed in _sliceTarget for sliced ones)
    this.targets = this.targets.filter((t) => {
      if (t.sliced) return false;
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

    // Loss
    if (this.integrity <= 0 || this.missedBots >= 4) {
      this.finish({
        result: 'defeat',
        score: this.score,
        reason: 'Критическая ошибка. Ты задел не тех… Система потеряла доверие.',
      });
      return;
    }

    // Victory
    if (this.timeLeft <= 0) {
      this.finish({
        result: 'victory',
        score: this.score + this.integrity * 110,
        reason:
          'Чистая работа. Боты уничтожены, пользователи не пострадали. Идеальная фильтрация — уровень мастера.',
      });
      return;
    }

    // Draw trail as a smooth sword-slash line
    this.trailGfx.clear();
    const len = this.trail.length;
    if (len > 1) {
      for (let i = 1; i < len; i++) {
        const ratio = i / len;
        // White outer stroke
        this.trailGfx.lineStyle(4 * ratio, 0xffffff, 0.75 * ratio);
        this.trailGfx.beginPath();
        this.trailGfx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        this.trailGfx.lineTo(this.trail[i].x, this.trail[i].y);
        this.trailGfx.strokePath();
        // Cyan inner glow
        this.trailGfx.lineStyle(2 * ratio, 0x00d4ff, 0.65 * ratio);
        this.trailGfx.beginPath();
        this.trailGfx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        this.trailGfx.lineTo(this.trail[i].x, this.trail[i].y);
        this.trailGfx.strokePath();
      }
    }

    this.timerText.setText(`Окно отражения: ${Math.ceil(this.timeLeft)} сек`);

    this._onHud?.({
      score: Math.round(this.score),
      integrity: this.integrity,
      objective: `Комбо: x${this.combo}`,
      timeLeft: this.timeLeft,
    });
  }

  /**
   * Draw one half-circle piece.
   * Each half is one side of the original circle split along sliceAngle.
   * As the piece spins (h.angle), the cut edge rotates with it.
   */
  _drawHalf(h) {
    const gfx = this.halvesGfx;
    const { x: cx, y: cy, radius: r, fillColor, edgeColor, side, sliceAngle, angle: spin, alpha } = h;

    // The cut line rotates as the piece spins
    const cutAngle = sliceAngle + spin;

    // Fill semicircle
    gfx.fillStyle(fillColor, alpha);
    gfx.beginPath();
    if (side === 1) {
      // Arc from cutAngle → cutAngle+π (one half)
      gfx.arc(cx, cy, r, cutAngle, cutAngle + Math.PI, false);
    } else {
      // Arc from cutAngle+π → cutAngle+2π (other half)
      gfx.arc(cx, cy, r, cutAngle + Math.PI, cutAngle + Math.PI * 2, false);
    }
    gfx.lineTo(cx, cy);
    gfx.closePath();
    gfx.fillPath();

    // Outer arc rim
    gfx.lineStyle(2, edgeColor, alpha * 0.9);
    gfx.beginPath();
    if (side === 1) {
      gfx.arc(cx, cy, r, cutAngle, cutAngle + Math.PI, false);
    } else {
      gfx.arc(cx, cy, r, cutAngle + Math.PI, cutAngle + Math.PI * 2, false);
    }
    gfx.strokePath();

    // Flat cut face — white shine to sell the fresh-cut look
    const cos = Math.cos(cutAngle);
    const sin = Math.sin(cutAngle);
    gfx.lineStyle(2, 0xffffff, alpha * 0.5);
    gfx.beginPath();
    gfx.moveTo(cx + cos * r, cy + sin * r);
    gfx.lineTo(cx - cos * r, cy - sin * r);
    gfx.strokePath();
  }

  _spawnTarget() {
    const type = Math.random() > 0.26 ? 'bot' : 'clean';
    const radius = rand(22, 34);

    const gfx = this.add.graphics();
    const fillCol = type === 'bot' ? 0x061430 : 0x38b6ff;
    const rimCol = type === 'bot' ? 0x2255cc : 0x00ccff;
    gfx.fillStyle(fillCol, 1);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(2, rimCol, 0.9);
    gfx.strokeCircle(0, 0, radius);

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
    const container = this.add.container(x, y, [gfx, label]).setDepth(3);

    this.targets.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-520, -400),
      va: rand(-2.2, 2.2), // slow spin while flying
      angle: 0,
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
