import { GAME_CATALOG } from '../data/gameCatalog';

export function StartScreen({ player, onSelectGame }) {
  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Игры</div>
      <h1>{player.firstName}, выберите игру</h1>
      <p className="panel-copy">На прохождение даётся до 2 минут. Результат сохраняется автоматически.</p>

      <div className="game-grid">
        {GAME_CATALOG.map((game) => (
          <article className={`game-card game-card--${game.accent}`} key={game.id}>
            <div className="eyebrow">{game.subtitle}</div>
            <h3>{game.title}</h3>
            <p>{game.teaser}</p>
            <ul className="detail-list">
              <li>Время: до {game.durationSeconds} сек</li>
              <li>Управление: {game.controls}</li>
              <li>Цель: {game.goal}</li>
            </ul>
            <button className="button" onClick={() => onSelectGame(game.id)} type="button">
              Играть
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
