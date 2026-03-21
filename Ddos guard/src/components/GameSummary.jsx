export function GameSummary({ actionLabel, onAction, playerName, selectedGame, result }) {
  const title = result.result === 'victory' ? 'Выигрыш' : 'Проигрыш';

  return (
    <section className="panel panel--feature panel--result">
      <div className="result-shell">
        <div className="result-heading">
          <div className="eyebrow">Результат</div>
          <h1>{title}</h1>
          <p className="panel-copy">
            {result.reason} Игра: <strong>{selectedGame.title}</strong>.
          </p>
        </div>

        <div className="result-main">
          <div className="summary-grid summary-grid--compact">
            <article className="stat-card">
              <span>Игрок</span>
              <strong>{playerName || 'Игрок'}</strong>
            </article>
            <article className="stat-card">
              <span>Очки</span>
              <strong>{result.score}</strong>
            </article>
            <article className="stat-card">
              <span>Итог</span>
              <strong>{result.result === 'victory' ? 'Победа' : 'Поражение'}</strong>
            </article>
            <article className="stat-card">
              <span>Длительность</span>
              <strong>{result.durationSeconds} сек</strong>
            </article>
          </div>
        </div>
      </div>

      <div className="form-actions summary-actions">
        <button className="button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
