import { useEffect, useRef, useState } from 'react';
import { createGameEngine } from '../game/createEngine';
import { formatTimer } from '../lib/format';

export function GameViewport({ game, onComplete }) {
  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const [hud, setHud] = useState({
    score: 0,
    integrity: 3,
    objective: game.goal,
    timeLeft: game.durationSeconds,
  });

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }

    const engine = createGameEngine({
      canvas: canvasRef.current,
      game,
      onHud: setHud,
      onFinish: (result) => onCompleteRef.current(result),
    });

    return () => engine.destroy();
  }, [game]);

  return (
    <section className="panel panel--feature">
      <div className="game-stage__header">
        <div>
          <div className="eyebrow">{game.subtitle}</div>
          <h1>{game.title}</h1>
        </div>
        <div className="hud-strip">
          <div>
            <span>Счёт</span>
            <strong>{hud.score}</strong>
          </div>
          <div>
            <span>Запас</span>
            <strong>{hud.integrity}</strong>
          </div>
          <div>
            <span>Таймер</span>
            <strong>{formatTimer(hud.timeLeft)}</strong>
          </div>
        </div>
      </div>

      <p className="panel-copy">
        {game.goal} Управление: {game.controls}.
      </p>

      <div className="canvas-shell">
        <canvas aria-label={game.title} ref={canvasRef} />
      </div>

      <div className="objective-note">{hud.objective}</div>
    </section>
  );
}
