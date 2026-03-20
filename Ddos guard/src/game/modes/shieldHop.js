export const shieldHopMode = {
  createState({ width, height }) {
    const platforms = [];
    let currentY = height - 80;

    for (let index = 0; index < 11; index += 1) {
      platforms.push({
        x: randomBetween(90, width - 220),
        y: currentY,
        width: randomBetween(110, 170),
        boost: Math.random() > 0.78,
      });
      currentY -= randomBetween(70, 115);
    }

    return {
      player: { x: width / 2, y: height - 150, vy: -520 },
      platforms,
      score: 0,
      bestY: height - 150,
      cameraY: 0,
      integrity: 3,
    };
  },

  update({ state, input, dt, width, height, finish }) {
    const player = state.player;
    const horizontalSpeed = input.left ? -260 : input.right ? 260 : 0;
    const previousY = player.y;

    player.x += horizontalSpeed * dt;
    player.y += player.vy * dt;
    player.vy += 980 * dt;

    if (player.x < -30) {
      player.x = width + 30;
    } else if (player.x > width + 30) {
      player.x = -30;
    }

    state.platforms.forEach((platform) => {
      const landsOnPlatform =
        player.vy > 0 &&
        previousY + 22 <= platform.y &&
        player.y + 22 >= platform.y &&
        player.x > platform.x &&
        player.x < platform.x + platform.width;

      if (landsOnPlatform) {
        player.vy = platform.boost ? -720 : -560;
        state.score += platform.boost ? 110 : 80;
      }

      const screenY = platform.y - state.cameraY;
      if (screenY > height + 50) {
        platform.y = state.cameraY - randomBetween(90, 140);
        platform.x = randomBetween(80, width - 210);
        platform.width = randomBetween(110, 170);
        platform.boost = Math.random() > 0.82;
      }
    });

    if (player.y < state.bestY) {
      state.bestY = player.y;
      state.score = Math.max(state.score, Math.round((height - state.bestY) * 2.1));
    }

    if (player.y < state.cameraY + 180) {
      state.cameraY = player.y - 180;
    }

    if (player.y - state.cameraY > height + 80) {
      finish({
        result: 'defeat',
        score: state.score,
        reason: 'Щит провалился ниже уровня защиты.',
      });
    }
  },

  render({ context, state, width, height, timeLeft }) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#10161f');
    gradient.addColorStop(1, '#273750');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawGrid(context, width, height);

    state.platforms.forEach((platform) => {
      const screenY = platform.y - state.cameraY;
      context.fillStyle = platform.boost ? '#0077ff' : '#ffffff';
      context.fillRect(platform.x, screenY, platform.width, 14);
      context.fillStyle = 'rgba(17, 21, 29, 0.16)';
      context.fillRect(platform.x + 10, screenY + 3, platform.width - 20, 4);
    });

    const playerY = state.player.y - state.cameraY;
    drawShield(context, state.player.x, playerY);

    context.fillStyle = '#ffffff';
    context.font = '600 18px "IBM Plex Sans", sans-serif';
    context.fillText(`Защитный контур активен: ${Math.ceil(timeLeft)} сек`, 28, 38);
  },

  getHud({ state, timeLeft }) {
    return {
      score: Math.round(state.score),
      integrity: state.integrity,
      objective: `Высота: ${Math.max(0, Math.round((540 - state.bestY) * 0.1))} м`,
      timeLeft,
    };
  },

  onTimeout({ state, finish }) {
    finish({
      result: 'victory',
      score: state.score + 180,
      reason: 'Прыжковый маршрут удержал нагрузку до конца.',
    });
  },
};

function drawGrid(context, width, height) {
  context.strokeStyle = 'rgba(0, 119, 255, 0.12)';
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
}

function drawShield(context, x, y) {
  context.save();
  context.translate(x, y);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(0, -26);
  context.lineTo(20, -10);
  context.lineTo(14, 18);
  context.lineTo(0, 28);
  context.lineTo(-14, 18);
  context.lineTo(-20, -10);
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
