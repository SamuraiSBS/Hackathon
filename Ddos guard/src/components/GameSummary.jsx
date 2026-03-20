export function GameSummary({ result, onRestart, onChangeGame, selectedGame }) {
  const title =
    result.result === "victory" ? "✅ Победа" : "❌ Поражение";

  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Результат</div>
      <h1>{title}</h1>
      <p className="panel-copy">
        {result.reason} Игра: <strong>{selectedGame.title}</strong>.
      </p>

      <div className="summary-grid">
        <article className="stat-card">
          <span>Очки</span>
          <strong>{result.score}</strong>
        </article>
        <article className="stat-card">
          <span>Итог</span>
          <strong>
            {result.result === "victory" ? "Победа" : "Поражение"}
          </strong>
        </article>
        <article className="stat-card">
          <span>Длительность</span>
          <strong>{result.durationSeconds} сек</strong>
        </article>
      </div>

      <div className="form-actions">
        <button className="button" onClick={onRestart} type="button">
          Новая попытка
        </button>
        {onChangeGame ? (
          <button
            className="button button--secondary"
            onClick={onChangeGame}
            type="button"
          >
            На главную
          </button>
        ) : null}
      </div>
    </section>
  );
}
