import { useEffect, useRef, useState } from 'react';
import { createGameEngine } from '../game/createEngine';
import { getModeById } from '../game/modes';
import { formatTimer } from '../lib/format';

export function GameViewport({ game, onComplete, onReturnHome }) {
  const containerRef = useRef(null);
  const mode = getModeById(game.id);
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
    if (!containerRef.current) {
      return undefined;
    }

    const engine = createGameEngine({
      canvas: containerRef.current,
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
          <button className="button button--ghost" onClick={onReturnHome} type="button">
            ← Главная
          </button>
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
        {mode.isPhaser ? (
          <div aria-label={game.title} ref={containerRef} />
        ) : (
          <canvas aria-label={game.title} ref={containerRef} />
        )}
      </div>

      <div className="objective-note">{hud.objective}</div>
    </section>
  );
}
