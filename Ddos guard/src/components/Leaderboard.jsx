import { useEffect, useState } from 'react';
import { GAME_CATALOG } from '../data/gameCatalog';
import { getPublicSnapshot } from '../lib/api';

export function Leaderboard() {
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicSnapshot()
      .then((snapshot) => setEntries(snapshot.leaderboard ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedGameId ? entries.filter((e) => e.gameId === selectedGameId) : entries;

  return (
    <aside className="panel panel--feature sidebar">
      <div className="eyebrow">Рейтинг</div>
      <h2>Таблица лидеров</h2>

      <div className="leaderboard-tabs">
        <button
          className={`leaderboard-tab ${!selectedGameId ? 'is-active' : ''}`}
          onClick={() => setSelectedGameId(null)}
          type="button"
        >
          Все
        </button>
        {GAME_CATALOG.map((game) => (
          <button
            key={game.id}
            className={`leaderboard-tab ${selectedGameId === game.id ? 'is-active' : ''}`}
            onClick={() => setSelectedGameId(game.id)}
            type="button"
          >
            {game.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="leaderboard-empty">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="leaderboard-empty">Пока нет результатов</div>
      ) : (
        <ol className="leaderboard-list">
          {filtered.map((entry) => (
            <li key={entry.sessionId} className="leaderboard-entry">
              <span className="leaderboard-rank">{entry.rank}</span>
              <span className="leaderboard-name">
                {entry.playerName}
                {!selectedGameId && (
                  <span className="leaderboard-game-label">{entry.gameTitle}</span>
                )}
              </span>
              <span className="leaderboard-score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
