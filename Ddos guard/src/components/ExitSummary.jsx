export function ExitSummary({ onBack, onFinish, playerName, stats }) {
  return (
    <section className="panel panel--feature panel--result panel--exit">
      <div className="result-shell">
        <div className="result-heading">
          <h1>Сводка участника</h1>
          <p className="panel-copy">Проверьте итог и завершите сессию.</p>
        </div>

        <div className="result-main">
          <div className="summary-grid summary-grid--compact">
            <article className="stat-card">
              <span>Участник</span>
              <strong>{playerName || 'Игрок'}</strong>
            </article>
            <article className="stat-card">
              <span>Пройдено игр</span>
              <strong>{stats.gamesCompleted}</strong>
            </article>
            <article className="stat-card">
              <span>Победы / поражения</span>
              <strong>
                {stats.wins} / {stats.losses}
              </strong>
            </article>
            <article className="stat-card">
              <span>Общие очки</span>
              <strong>{stats.totalScore}</strong>
            </article>
          </div>
        </div>
      </div>

      <div className="form-actions summary-actions">
        <button className="button button--secondary" onClick={onBack} type="button">
          Назад к играм
        </button>
        <button className="button" onClick={onFinish} type="button">
          Завершить
        </button>
      </div>
    </section>
  );
}
