import { useEffect, useRef, useState } from 'react';
import { createGameEngine } from '../game/createEngine';
import { getModeById } from '../game/modes';
import { formatTimer } from '../lib/format';

export function GameViewport({ game, onComplete }) {
  const containerRef = useRef(null);
  const mode = getModeById(game.id);
  const isPhaser = mode.isPhaser ?? false;
  const onCompleteRef = useRef(onComplete);
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState({
    score: 0,
    integrity: 1,
    objective: game.goal,
    timeLeft: game.durationSeconds,
  });

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setStarted(false);
    setCountdown(3);
  }, [game.id]);

  useEffect(() => {
    if (started) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          setStarted(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [started]);

  useEffect(() => {
    if (!started || !containerRef.current) {
      return undefined;
    }

    const engine = createGameEngine({
      canvas: containerRef.current,
      game,
      onHud: setHud,
      onFinish: (result) => onCompleteRef.current(result),
    });

    return () => engine.destroy();
  }, [game, started]);

  return (
    <section className="panel panel--feature panel--game">
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
            <span>Жизни</span>
            <strong>{hud.integrity}</strong>
          </div>
        </div>
      </div>

      <div className="canvas-shell">
        {isPhaser ? (
          <div aria-label={game.title} ref={containerRef} />
        ) : (
          <canvas aria-label={game.title} ref={containerRef} />
        )}
        <div className="game-overlay game-overlay--timer">
          <span className="pixel-timer">{formatTimer(hud.timeLeft)}</span>
        </div>
        {!started && countdown > 0 ? (
          <div className="game-overlay game-overlay--countdown">
            <span className="pixel-timer pixel-timer--countdown">{countdown}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
