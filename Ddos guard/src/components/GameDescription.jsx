export function GameDescription({ game, onPlay, onBack }) {
  return (
    <section className="panel panel--feature">
      <button className="button button--ghost" onClick={onBack} type="button" style={{ alignSelf: 'flex-start', marginBottom: '1.5rem' }}>
        ← Назад
      </button>

      <div className="eyebrow">{game.subtitle}</div>
      <h1>{game.title}</h1>
      <p className="panel-copy">{game.teaser}</p>

      <ul className="detail-list" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <li>Время: до {game.durationSeconds} сек</li>
        <li>Управление: {game.controls}</li>
        <li>Цель: {game.goal}</li>
      </ul>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button className="button" onClick={onPlay} type="button">
          Играть
        </button>
      </div>
    </section>
  );
}
