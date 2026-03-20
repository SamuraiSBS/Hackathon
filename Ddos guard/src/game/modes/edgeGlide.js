const playerX = 220;

export const edgeGlideMode = {
  createState({ height }) {
    return {
      y: height / 2,
      velocity: 0,
      obstacles: [],
      spawnTimer: 0.8,
      score: 0,
      passed: 0,
      integrity: 3,
      hitCooldown: 0,
    };
  },

  update({ state, input, dt, width, height, finish }) {
    if (input.tap) {
      state.velocity = -300;
    }

    state.velocity += 720 * dt;
    state.y += state.velocity * dt;
    state.spawnTimer -= dt;
    state.hitCooldown = Math.max(0, state.hitCooldown - dt);
    state.score += dt * 16;

    if (state.spawnTimer <= 0) {
      state.spawnTimer = randomBetween(1.3, 1.75);
      state.obstacles.push({
        x: width + 90,
        width: randomBetween(92, 120),
        gapY: randomBetween(140, height - 140),
        gapHeight: randomBetween(140, 182),
        passed: false,
      });
    }

    for (const obstacle of state.obstacles) {
      obstacle.x -= 240 * dt;

      if (!obstacle.passed && obstacle.x + obstacle.width < playerX) {
        obstacle.passed = true;
        state.passed += 1;
        state.score += 140;
      }

      if (collidesWithObstacle(state.y, obstacle) && state.hitCooldown === 0) {
        state.integrity -= 1;
        state.hitCooldown = 0.8;
        state.velocity = -180;
      }
    }

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -60);

    if ((state.y < 30 || state.y > height - 30) && state.hitCooldown === 0) {
      state.integrity -= 1;
      state.hitCooldown = 0.8;
      state.y = clamp(state.y, 30, height - 30);
      state.velocity = -160;
    }

    if (state.integrity <= 0) {
      finish({
        result: 'defeat',
        score: state.score,
        reason: 'Перегрузка. Канал не выдержал давления. Соединение потеряно.',
      });
    }
  },

  render({ context, state, width, height, timeLeft }) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#10161f');
    gradient.addColorStop(1, '#1b2940');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawGrid(context, width, height, 'rgba(0, 119, 255, 0.12)');

    context.strokeStyle = 'rgba(0, 119, 255, 0.24)';
    context.lineWidth = 2;
    context.setLineDash([18, 18]);
    context.beginPath();
    context.moveTo(playerX, 40);
    context.lineTo(playerX, height - 40);
    context.stroke();
    context.setLineDash([]);

    state.obstacles.forEach((obstacle) => {
      drawTunnelObstacle(context, obstacle, height);
    });

    drawPlayer(context, playerX, state.y, state.hitCooldown > 0);

    context.fillStyle = '#ffffff';
    context.font = '600 18px "IBM Plex Sans", sans-serif';
    context.fillText(`Канал под защитой: ${Math.ceil(timeLeft)} сек`, 28, 38);
  },

  getHud({ state, timeLeft }) {
    return {
      score: Math.round(state.score),
      integrity: state.integrity,
      objective: `Пролётов: ${state.passed}`,
      timeLeft,
    };
  },

  onTimeout({ state, finish }) {
    finish({
      result: 'victory',
      score: state.score + state.integrity * 120,
      reason: 'Трафик стабилизирован. Ты провёл данные сквозь хаос и сохранил соединение живым. Сеть работает — благодаря тебе.',
    });
  },
};

function collidesWithObstacle(playerY, obstacle) {
  const playerRadius = 22;
  const insideX = playerX + playerRadius > obstacle.x && playerX - playerRadius < obstacle.x + obstacle.width;
  const inGap = playerY > obstacle.gapY - obstacle.gapHeight / 2 && playerY < obstacle.gapY + obstacle.gapHeight / 2;
  return insideX && !inGap;
}

function drawTunnelObstacle(context, obstacle, height) {
  context.fillStyle = '#11151d';
  context.fillRect(obstacle.x, 0, obstacle.width, obstacle.gapY - obstacle.gapHeight / 2);
  context.fillRect(
    obstacle.x,
    obstacle.gapY + obstacle.gapHeight / 2,
    obstacle.width,
    height - (obstacle.gapY + obstacle.gapHeight / 2),
  );

  context.fillStyle = '#0077ff';
  context.fillRect(obstacle.x - 4, obstacle.gapY - obstacle.gapHeight / 2 - 8, obstacle.width + 8, 8);
  context.fillRect(obstacle.x - 4, obstacle.gapY + obstacle.gapHeight / 2, obstacle.width + 8, 8);
}

function drawGrid(context, width, height, color) {
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawPlayer(context, x, y, damaged) {
  context.save();
  context.translate(x, y);
  context.fillStyle = damaged ? '#cdddff' : '#ffffff';
  context.beginPath();
  context.moveTo(-26, 0);
  context.lineTo(0, -18);
  context.lineTo(26, 0);
  context.lineTo(0, 18);
  context.closePath();
  context.fill();
  context.strokeStyle = '#0077ff';
  context.lineWidth = 3;
  context.stroke();
  context.restore();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
