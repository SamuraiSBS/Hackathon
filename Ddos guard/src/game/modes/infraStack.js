export const infraStackMode = {
  createState({ width, height }) {
    return {
      stack: [{ x: width / 2 - 150, y: height - 84, width: 300 }],
      active: { x: 40, y: height - 128, width: 280, direction: 1, speed: 250 },
      score: 0,
      integrity: 3,
      layers: 1,
    };
  },

  update({ state, input, dt, width, finish, timeLeft }) {
    state.active.x += state.active.direction * state.active.speed * dt;

    if (state.active.x < 24 || state.active.x + state.active.width > width - 24) {
      state.active.direction *= -1;
    }

    if (input.tap) {
      const previous = state.stack[state.stack.length - 1];
      const overlapLeft = Math.max(previous.x, state.active.x);
      const overlapRight = Math.min(previous.x + previous.width, state.active.x + state.active.width);
      const overlapWidth = overlapRight - overlapLeft;

      if (overlapWidth < 28) {
        finish({
          result: 'defeat',
          score: state.score,
          reason: 'Обрушение. Нагрузка оказалась сильнее архитектуры. Система не выдержала давления.',
        });
        return;
      }

      const perfect = Math.abs(previous.x - state.active.x) < 10;
      const nextWidth = perfect ? previous.width : overlapWidth;
      const nextX = perfect ? previous.x : overlapLeft;
      const nextY = previous.y - 44;

      state.stack.push({ x: nextX, y: nextY, width: nextWidth, perfect });
      state.layers += 1;
      state.score += perfect ? 180 : 130;

      if (state.layers >= 10) {
        finish({
          result: 'victory',
          score: state.score + Math.ceil(timeLeft) * 8,
          reason: 'Инфраструктура выдержала. Слои работают как единое целое. Теперь эту систему не так просто сломать.',
        });
        return;
      }

      state.active = {
        x: state.layers % 2 === 0 ? 36 : width - nextWidth - 36,
        y: nextY - 44,
        width: nextWidth,
        direction: state.layers % 2 === 0 ? 1 : -1,
        speed: Math.min(340, 240 + state.layers * 14),
      };
    }
  },

  render({ context, state, width, height, timeLeft }) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#f8fbff');
    gradient.addColorStop(1, '#e6f0ff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawBackdrop(context, width, height);

    const cameraOffset = Math.min(0, state.stack[state.stack.length - 1].y - 220);
    state.stack.forEach((block) => {
      drawBlock(context, block.x, block.y - cameraOffset, block.width, block.perfect);
    });

    drawActiveBlock(context, state.active.x, state.active.y - cameraOffset, state.active.width);

    context.fillStyle = '#11151d';
    context.font = '600 18px "IBM Plex Sans", sans-serif';
    context.fillText(`Укрепление слоёв: ${Math.ceil(timeLeft)} сек`, 28, 38);
  },

  getHud({ state, timeLeft }) {
    return {
      score: Math.round(state.score),
      integrity: state.integrity,
      objective: `Слои: ${state.layers}/10`,
      timeLeft,
    };
  },

  onTimeout({ state, finish }) {
    finish({
      result: state.layers >= 7 ? 'victory' : 'defeat',
      score: state.score,
      reason:
        state.layers >= 7
          ? 'Инфраструктура выдержала. Слои работают как единое целое. Теперь эту систему не так просто сломать.'
          : 'Обрушение. Нагрузка оказалась сильнее архитектуры. Система не выдержала давления.',
    });
  },
};

function drawBackdrop(context, width, height) {
  context.strokeStyle = 'rgba(0, 119, 255, 0.12)';
  context.lineWidth = 1;
  for (let y = 0; y < height; y += 56) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawBlock(context, x, y, width, perfect) {
  context.fillStyle = perfect ? '#0077ff' : '#11151d';
  context.fillRect(x, y, width, 28);
  context.fillStyle = 'rgba(255, 255, 255, 0.42)';
  context.fillRect(x + 10, y + 6, Math.max(0, width - 20), 4);
}

function drawActiveBlock(context, x, y, width) {
  context.fillStyle = '#ffffff';
  context.fillRect(x, y, width, 28);
  context.strokeStyle = '#0077ff';
  context.lineWidth = 3;
  context.strokeRect(x, y, width, 28);
}
