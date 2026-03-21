import { getModeById } from './modes';
import { createPhaserEngine } from './createPhaserEngine';

const WIDTH = 960;
const HEIGHT = 540;

export function createGameEngine({ canvas, game, onHud, onFinish }) {
  const mode = getModeById(game.id);

  if (mode.isPhaser) {
    return createPhaserEngine({ parent: canvas, game, onHud, onFinish });
  }


  const context = canvas.getContext('2d');
  const state = mode.createState({ width: WIDTH, height: HEIGHT, durationSeconds: game.durationSeconds });
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    pointer: {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      prevX: WIDTH / 2,
      prevY: HEIGHT / 2,
      down: false,
      justPressed: false,
      justReleased: false,
      lastMoveAt: performance.now(),
      speed: 0,
      trail: [],
    },
  };

  let animationFrameId = 0;
  let lastFrameAt = performance.now();
  let finished = false;
  const startedAt = performance.now();

  canvas.width = WIDTH * devicePixelRatio;
  canvas.height = HEIGHT * devicePixelRatio;
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;

  function getPositionFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
    };
  }

  function pushTrail(x, y) {
    const now = performance.now();
    input.pointer.trail.push({ x, y, at: now });
    input.pointer.trail = input.pointer.trail.filter((point) => now - point.at < 140);
  }

  function handleKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD'].includes(event.code)) {
      event.preventDefault();
    }

    if (!input.keys.has(event.code)) {
      input.justPressed.add(event.code);
    }

    input.keys.add(event.code);
  }

  function handleKeyUp(event) {
    input.keys.delete(event.code);
  }

  function handlePointerDown(event) {
    const point = getPositionFromEvent(event);
    input.pointer.down = true;
    input.pointer.justPressed = true;
    input.pointer.x = point.x;
    input.pointer.y = point.y;
    input.pointer.prevX = point.x;
    input.pointer.prevY = point.y;
    input.pointer.lastMoveAt = performance.now();
    pushTrail(point.x, point.y);
  }

  function handlePointerMove(event) {
    const point = getPositionFromEvent(event);
    const now = performance.now();
    const deltaTime = Math.max(0.016, (now - input.pointer.lastMoveAt) / 1000);
    const deltaX = point.x - input.pointer.x;
    const deltaY = point.y - input.pointer.y;

    input.pointer.prevX = input.pointer.x;
    input.pointer.prevY = input.pointer.y;
    input.pointer.x = point.x;
    input.pointer.y = point.y;
    input.pointer.speed = Math.hypot(deltaX, deltaY) / deltaTime;
    input.pointer.lastMoveAt = now;
    pushTrail(point.x, point.y);
  }

  function handlePointerUp(event) {
    const point = getPositionFromEvent(event);
    input.pointer.down = false;
    input.pointer.justReleased = true;
    input.pointer.x = point.x;
    input.pointer.y = point.y;
    input.pointer.lastMoveAt = performance.now();
    pushTrail(point.x, point.y);
  }

  function snapshotInput() {
    const now = performance.now();
    return {
      left: input.keys.has('ArrowLeft') || input.keys.has('KeyA'),
      right: input.keys.has('ArrowRight') || input.keys.has('KeyD'),
      tap:
        input.justPressed.has('Space') ||
        input.justPressed.has('ArrowUp') ||
        input.justPressed.has('KeyW') ||
        input.pointer.justPressed,
      pointer: {
        ...input.pointer,
        active: input.pointer.down || now - input.pointer.lastMoveAt < 120,
      },
    };
  }

  function resetEphemeralInput() {
    const now = performance.now();
    input.justPressed.clear();
    input.pointer.justPressed = false;
    input.pointer.justReleased = false;
    input.pointer.trail = input.pointer.trail.filter((point) => now - point.at < 140);
  }

  function cleanup() {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointerleave', handlePointerUp);
  }

  function finish(payload) {
    if (finished) {
      return;
    }

    finished = true;
    cleanup();
    onFinish({
      result: payload.result,
      score: Math.round(payload.score),
      reason: payload.reason,
      durationSeconds: Math.ceil((performance.now() - startedAt) / 1000),
    });
  }

  function frame(now) {
    const dt = Math.min(0.032, (now - lastFrameAt) / 1000 || 0.016);
    const elapsedSeconds = (now - startedAt) / 1000;
    const timeLeft = Math.max(0, game.durationSeconds - elapsedSeconds);
    const currentInput = snapshotInput();

    lastFrameAt = now;

    mode.update({
      state,
      input: currentInput,
      dt,
      width: WIDTH,
      height: HEIGHT,
      timeLeft,
      finish,
    });

    mode.render({
      context,
      state,
      input: currentInput,
      width: WIDTH,
      height: HEIGHT,
      timeLeft,
    });

    onHud?.(mode.getHud({ state, timeLeft, durationSeconds: game.durationSeconds }));
    resetEphemeralInput();

    if (finished) {
      return;
    }

    if (timeLeft <= 0) {
      if (mode.onTimeout) {
        mode.onTimeout({ state, finish });
      } else {
        finish({
          result: state.integrity > 0 ? 'victory' : 'defeat',
          score: state.score ?? 0,
          reason: 'Сессия завершена.',
        });
      }
      return;
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerUp);
  animationFrameId = requestAnimationFrame(frame);

  return { destroy: cleanup };
}

