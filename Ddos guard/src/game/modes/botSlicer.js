export const botSlicerMode = {
  createState({ width, height }) {
    return {
      targets: [],
      spawnTimer: 0.35,
      score: 0,
      combo: 0,
      integrity: 3,
      missedBots: 0,
      width,
      height,
    };
  },

  update({ state, input, dt, finish }) {
    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0) {
      state.spawnTimer = randomBetween(0.34, 0.58);
      state.targets.push({
        x: randomBetween(100, state.width - 100),
        y: state.height + 40,
        vx: randomBetween(-120, 120),
        vy: randomBetween(-520, -400),
        radius: randomBetween(22, 34),
        type: Math.random() > 0.26 ? 'bot' : 'clean',
        sliced: false,
      });
    }

    state.targets.forEach((target) => {
      target.vy += 780 * dt;
      target.x += target.vx * dt;
      target.y += target.vy * dt;

      if (!target.sliced && input.pointer.active && input.pointer.speed > 120) {
        const closeEnough =
          distance(target.x, target.y, input.pointer.x, input.pointer.y) < target.radius + 18 ||
          distance(target.x, target.y, input.pointer.prevX, input.pointer.prevY) < target.radius + 18;

        if (closeEnough) {
          target.sliced = true;

          if (target.type === 'bot') {
            state.score += 100 + Math.min(state.combo, 5) * 12;
            state.combo += 1;
          } else {
            state.combo = 0;
            state.integrity -= 1;
          }
        }
      }
    });

    state.targets = state.targets.filter((target) => {
      if (target.sliced) {
        return false;
      }

      if (target.y > state.height + 60) {
        if (target.type === 'bot') {
          state.missedBots += 1;
          state.combo = 0;
        }
        return false;
      }

      return true;
    });

    if (state.integrity <= 0 || state.missedBots >= 4) {
      finish({
        result: 'defeat',
        score: state.score,
        reason: 'Критическая ошибка. Ты задел не тех… Система потеряла доверие.',
      });
    }
  },

  render({ context, state, input, width, height, timeLeft }) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f7fbff');
    gradient.addColorStop(1, '#dcecff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawBackdrop(context, width, height);

    input.pointer.trail.forEach((point, index) => {
      const alpha = (index + 1) / input.pointer.trail.length;
      context.fillStyle = `rgba(0, 119, 255, ${alpha * 0.35})`;
      context.beginPath();
      context.arc(point.x, point.y, 6 * alpha, 0, Math.PI * 2);
      context.fill();
    });

    state.targets.forEach((target) => {
      context.beginPath();
      context.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
      context.fillStyle = target.type === 'bot' ? '#11151d' : '#0077ff';
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = '700 14px "Space Grotesk", sans-serif';
      context.textAlign = 'center';
      context.fillText(target.type === 'bot' ? 'BOT' : 'OK', target.x, target.y + 5);
    });

    context.textAlign = 'left';
    context.fillStyle = '#11151d';
    context.font = '600 18px "IBM Plex Sans", sans-serif';
    context.fillText(`Окно отражения: ${Math.ceil(timeLeft)} сек`, 28, 38);
  },

  getHud({ state, timeLeft }) {
    return {
      score: Math.round(state.score),
      integrity: state.integrity,
      objective: `Комбо: x${state.combo}`,
      timeLeft,
    };
  },

  onTimeout({ state, finish }) {
    finish({
      result: 'victory',
      score: state.score + state.integrity * 110,
      reason: 'Чистая работа. Боты уничтожены, пользователи не пострадали. Идеальная фильтрация — уровень мастера.',
    });
  },
};

function drawBackdrop(context, width, height) {
  context.strokeStyle = 'rgba(17, 21, 29, 0.08)';
  context.lineWidth = 1;
  for (let y = 40; y < height; y += 46) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
