export const packetCatcherMode = {
  createState({ width, height }) {
    return {
      catcherX: width / 2 - 58,
      items: [],
      spawnTimer: 0.6,
      score: 0,
      integrity: 3,
      cleanCaught: 0,
      badCaught: 0,
      width,
      height,
    };
  },

  update({ state, input, dt, finish }) {
    if (input.pointer.active) {
      state.catcherX = clamp(input.pointer.x - 58, 20, state.width - 116);
    } else {
      const speed = input.left ? -320 : input.right ? 320 : 0;
      state.catcherX = clamp(state.catcherX + speed * dt, 20, state.width - 116);
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = randomBetween(0.26, 0.5);
      state.items.push({
        x: randomBetween(40, state.width - 40),
        y: -30,
        radius: randomBetween(16, 24),
        speed: randomBetween(200, 290),
        type: Math.random() > 0.3 ? 'clean' : 'bad',
      });
    }

    state.items.forEach((item) => {
      item.y += item.speed * dt;

      const collides =
        item.x > state.catcherX &&
        item.x < state.catcherX + 116 &&
        item.y + item.radius > state.height - 72 &&
        item.y - item.radius < state.height - 18;

      if (collides) {
        item.collected = true;
        if (item.type === 'clean') {
          state.cleanCaught += 1;
          state.score += 90;
        } else {
          state.badCaught += 1;
          state.integrity -= 1;
          state.score = Math.max(0, state.score - 40);
        }
      }
    });

    state.items = state.items.filter((item) => !item.collected && item.y < state.height + 40);

    if (state.integrity <= 0) {
      finish({
        result: 'defeat',
        score: state.score,
        reason: 'Фильтр принял слишком много вредоносных пакетов.',
      });
    }
  },

  render({ context, state, width, height, timeLeft }) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f7fbff');
    gradient.addColorStop(1, '#e5efff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawLanes(context, width, height);

    state.items.forEach((item) => {
      context.beginPath();
      context.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      context.fillStyle = item.type === 'clean' ? '#0077ff' : '#11151d';
      context.fill();
    });

    context.fillStyle = '#ffffff';
    context.fillRect(state.catcherX, height - 46, 116, 18);
    context.strokeStyle = '#0077ff';
    context.lineWidth = 3;
    context.strokeRect(state.catcherX, height - 46, 116, 18);

    context.fillStyle = '#11151d';
    context.font = '600 18px "IBM Plex Sans", sans-serif';
    context.fillText(`Фильтрация потока: ${Math.ceil(timeLeft)} сек`, 28, 38);
  },

  getHud({ state, timeLeft }) {
    return {
      score: Math.round(state.score),
      integrity: state.integrity,
      objective: `Чистых пакетов: ${state.cleanCaught}`,
      timeLeft,
    };
  },

  onTimeout({ state, finish }) {
    finish({
      result: 'victory',
      score: state.score + state.integrity * 90,
      reason: 'Чистый трафик доставлен без перегруза.',
    });
  },
};

function drawLanes(context, width, height) {
  context.strokeStyle = 'rgba(17, 21, 29, 0.08)';
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 72) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
