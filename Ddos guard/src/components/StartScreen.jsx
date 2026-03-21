export function StartScreen({ busy, game, onStart, player }) {
  return (
    <section className="panel panel--feature panel--brief">
      <div className="brief-shell">
        <div className="brief-heading">
          <h1>{player.firstName}, ваш режим: {game.title}</h1>
          <p className="panel-copy">{game.teaser}</p>
        </div>

        <div className="brief-main">
          <div className="brief-content">
          <article className={`game-card game-card--${game.accent}`}>
            <div className="eyebrow">{game.subtitle}</div>
            <h3>{game.title}</h3>
            <ul className="detail-list">
              <li>Время: до {game.durationSeconds} сек</li>
              <li>Управление: {game.controls}</li>
              <li>Цель: {game.goal}</li>
            </ul>
          </article>

          <div className="brief-meta-grid">
            <article className="brief-meta-card">
              <span>Формат</span>
              <strong>Одна попытка</strong>
            </article>
            <article className="brief-meta-card">
              <span>Система</span>
              <strong>Победа / Поражение</strong>
            </article>
            <article className="brief-meta-card">
              <span>Результат</span>
              <strong>Очки сразу после игры</strong>
            </article>
          </div>

          <div className="form-actions start-actions">
            <button className="button" disabled={busy} onClick={onStart} type="button">
              Начать игру
            </button>
          </div>
          </div>

          <aside className="brief-aside" aria-label="Маскот">
            <img alt="Маскот DDoS-Guard" className="brief-aside__image" src="/brand/logo-square.svg" />
            <h3>Талисман режима</h3>
            <p>Собранный стэк готов к запуску. Нажмите старт и покажите максимум очков.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
