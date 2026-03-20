import { GAME_CATALOG } from '../data/gameCatalog';

export function StartScreen({ player, onSelectGame, onChangePlayer }) {
  return (
    <section className="panel panel--feature">
      <div className="eyebrow">Игры</div>
      <h1>{player ? `${player.firstName}, выберите игру` : 'Выберите игру'}</h1>
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

      {player && onChangePlayer ? (
        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button className="button button--secondary" onClick={onChangePlayer} type="button">
            Сменить игрока
          </button>
        </div>
      ) : null}
    </section>
  );
}
