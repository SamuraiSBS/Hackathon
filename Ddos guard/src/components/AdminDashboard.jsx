import { useEffect, useMemo, useState } from 'react';
import { GAME_CATALOG, getGameById } from '../data/gameCatalog';
import { formatDateTime } from '../lib/format';

function leadStatusLabel(lead) {
  if (lead.status === 'blocked') return 'заблокирован';
  if (lead.status === 'completed') return lead.result === 'victory' ? 'победа' : 'поражение';
  return 'зарегистрирован';
}

function leadStatusTone(lead) {
  if (lead.status === 'blocked') return 'danger';
  if (lead.status === 'completed' && lead.result === 'victory') return 'success';
  if (lead.status === 'completed') return 'muted';
  return 'info';
}

function leadSourceLabel(lead) {
  return lead.source === 'telegram' ? 'Telegram' : 'Форма';
}

function leadSourceTone(lead) {
  return lead.source === 'telegram' ? 'telegram' : 'manual';
}

export function AdminDashboard({
  activeGameId,
  snapshot,
  adapter,
  mutatingSessionId,
  onBlockAttempt,
  onRefresh,
  onResetDemo,
  onSetActiveGame,
  onStandDeactivate,
  onStandUnlock,
  onUnblockAttempt,
  standAuth,
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(snapshot.recentLeads[0]?.sessionId ?? '');
  const [standToken, setStandToken] = useState('');
  const [selectedGameId, setSelectedGameId] = useState(activeGameId || GAME_CATALOG[0].id);
  const isDemoMode = adapter === 'local-demo';
  const isStandOpen = standAuth.status === 'unlocked';
  const accessStatusLabel = isStandOpen ? 'активно' : 'закрыто';
  const accessActionLabel = standAuth.status === 'checking' ? 'Открываем...' : 'Открыть доступ';

  useEffect(() => {
    setSelectedGameId(activeGameId || GAME_CATALOG[0].id);
  }, [activeGameId]);

  useEffect(() => {
    if (snapshot.recentLeads.some((lead) => lead.sessionId === selectedSessionId)) {
      return;
    }

    setSelectedSessionId(snapshot.recentLeads[0]?.sessionId ?? '');
  }, [snapshot.recentLeads, selectedSessionId]);

  const selectedLead = useMemo(
    () => snapshot.recentLeads.find((lead) => lead.sessionId === selectedSessionId) ?? snapshot.recentLeads[0] ?? null,
    [selectedSessionId, snapshot.recentLeads]
  );

  async function handleStandSubmit(event) {
    event.preventDefault();
    await onStandUnlock(standToken);
    setStandToken('');
  }

  async function handleActiveGameAction() {
    if (selectedGameId === activeGameId) {
      await onStandDeactivate();
      return;
    }

    await onSetActiveGame(selectedGameId);
  }

  return (
    <section className="panel panel--feature">
      <div className="dashboard-header">
        <div>
          <div className="eyebrow">Панель управления</div>
          <h1>Результаты и профили</h1>
          <p className="panel-copy">Актуальные данные по участникам и сессиям.</p>
        </div>
        <div className="form-actions">
          <button className="button button--secondary" onClick={onRefresh} type="button">
            Обновить
          </button>
          {isDemoMode ? (
            <button className="button" onClick={onResetDemo} type="button">
              Очистить данные
            </button>
          ) : null}
        </div>
      </div>

      <article className="table-card service-card">
        <div className="eyebrow">Управление</div>
        <div className="service-card__header">
          <div>
            <h3>Управление доступом</h3>
            <p className="panel-copy">Изменение статуса приложения.</p>
          </div>
          <span className={`status-badge status-badge--${isStandOpen ? 'success' : 'muted'}`}>{accessStatusLabel}</span>
        </div>

        {isDemoMode ? <div className="panel-copy">Управление временно недоступно.</div> : null}
        {!standAuth.tokenConfigured ? <div className="form-error">Код доступа недоступен.</div> : null}
        {standAuth.error ? <div className="form-error">{standAuth.error}</div> : null}

        {isStandOpen ? (
          <div className="form-actions">
            <button className="button button--secondary" onClick={onStandDeactivate} type="button">
              Закрыть доступ
            </button>
          </div>
        ) : (
          <form className="service-form" onSubmit={handleStandSubmit}>
            <label>
              <span>Код доступа</span>
              <input
                autoComplete="off"
                disabled={standAuth.status === 'checking' || !standAuth.tokenConfigured}
                type="password"
                value={standToken}
                onChange={(event) => setStandToken(event.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="button" disabled={standAuth.status === 'checking' || !standAuth.tokenConfigured} type="submit">
                {accessActionLabel}
              </button>
            </div>
          </form>
        )}
      </article>

      <article className="table-card service-card">
        <div className="eyebrow">Игра</div>
        <div className="service-card__header">
          <div>
            <h3>Глобальный выбор игры</h3>
            <p className="panel-copy">Выберите игру для всех новых участников.</p>
          </div>
        </div>
        <div className="game-picker-grid">
          {GAME_CATALOG.map((game) => (
            <button
              key={game.id}
              className={`game-tile${selectedGameId === game.id ? ' is-selected' : ''}${activeGameId === game.id ? ' is-active' : ''}`}
              onClick={() => setSelectedGameId(game.id)}
              type="button"
            >
              <span className="game-tile__title">{game.title}</span>
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button className="button" disabled={isDemoMode} onClick={handleActiveGameAction} type="button">
            {selectedGameId === activeGameId ? 'Остановить' : 'Запустить'}
          </button>
        </div>
      </article>

      <div className="summary-grid">
        <article className="stat-card">
          <span>Участников</span>
          <strong>{snapshot.summary.totalLeads}</strong>
        </article>
        <article className="stat-card">
          <span>Сессий</span>
          <strong>{snapshot.summary.completedRuns}</strong>
        </article>
        <article className="stat-card">
          <span>Побед</span>
          <strong>{snapshot.summary.victories}</strong>
        </article>
        <article className="stat-card">
          <span>Лучший счёт</span>
          <strong>{snapshot.summary.bestScore}</strong>
        </article>
      </div>

      <div className="admin-grid admin-grid--stacked">
        <article className="table-card">
          <div className="eyebrow">Рейтинг</div>
          <table className="table">
            <thead>
              <tr>
                <th>Место</th>
                <th>Игрок</th>
                <th>Игра</th>
                <th>Итог</th>
                <th>Очки</th>
                <th>Когда</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.leaderboard.map((row) => {
                const gameResult = row.gameResults?.[0] ?? null;

                return (
                  <tr className={`table-row--clickable${row.sessionId === selectedSessionId ? ' table-row--active' : ''}`} key={row.sessionId}>
                    <td>#{row.rank}</td>
                    <td>
                      <button className="profile-link" type="button" onClick={() => setSelectedSessionId(row.sessionId)}>
                        {row.playerName}
                      </button>
                    </td>
                    <td>{gameResult?.gameTitle || getGameById(gameResult?.gameId || activeGameId).title}</td>
                    <td>
                      <span className={`status-badge status-badge--${gameResult?.result === 'victory' ? 'success' : 'danger'}`}>
                        {gameResult?.result === 'victory' ? 'Победа' : 'Поражение'}
                      </span>
                    </td>
                    <td>{row.score}</td>
                    <td>{formatDateTime(row.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        <article className="table-card">
          <div className="eyebrow">Профили</div>
          <table className="table">
            <thead>
              <tr>
                <th>Профиль</th>
                <th>Телефон</th>
                <th>Telegram</th>
                <th>Игра</th>
                <th>Итог</th>
                <th>Счёт</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentLeads.map((lead) => (
                <tr className={lead.sessionId === selectedSessionId ? 'table-row--active' : ''} key={lead.sessionId}>
                  <td>
                    <button className="profile-link" type="button" onClick={() => setSelectedSessionId(lead.sessionId)}>
                      {lead.playerName}
                    </button>
                  </td>
                  <td>{lead.phone || '—'}</td>
                  <td>
                    <div className="lead-source-stack">
                      <span>{lead.telegram || '—'}</span>
                      <span className={`status-badge status-badge--${leadSourceTone(lead)}`}>{leadSourceLabel(lead)}</span>
                    </div>
                  </td>
                  <td>{lead.gameTitle || getGameById(lead.assignedGameId || activeGameId).title}</td>
                  <td>
                    <span className={`status-badge status-badge--${leadStatusTone(lead)}`}>{leadStatusLabel(lead)}</span>
                  </td>
                  <td>{lead.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {selectedLead ? (
          <article className="table-card profile-card">
            <div className="eyebrow">Профиль</div>
            <div className="profile-card__header">
              <h3>{selectedLead.playerName}</h3>
              <span className={`status-badge status-badge--${leadStatusTone(selectedLead)}`}>{leadStatusLabel(selectedLead)}</span>
            </div>

            {selectedLead.status === 'blocked' ? (
              <div className="profile-alert profile-alert--danger">Профиль исключён из таблицы.</div>
            ) : null}

            <div className="profile-meta">
              <div>
                <span>Телефон</span>
                <strong>{selectedLead.phone || '—'}</strong>
              </div>
              <div>
                <span>Telegram</span>
                <strong>{selectedLead.telegram || '—'}</strong>
              </div>
              <div>
                <span>Игра</span>
                <strong>{selectedLead.gameTitle || getGameById(selectedLead.assignedGameId || activeGameId).title}</strong>
              </div>
              <div>
                <span>Статус</span>
                <strong>{leadStatusLabel(selectedLead)}</strong>
              </div>
              <div>
                <span>Очки</span>
                <strong>{selectedLead.score}</strong>
              </div>
              <div>
                <span>Создан</span>
                <strong>{formatDateTime(selectedLead.createdAt)}</strong>
              </div>
              <div>
                <span>Финиш</span>
                <strong>{formatDateTime(selectedLead.finishedAt)}</strong>
              </div>
              <div>
                <span>Блокировка</span>
                <strong>{formatDateTime(selectedLead.blockedAt)}</strong>
              </div>
            </div>

            {adapter === 'php-api' ? (
              <div className="form-actions">
                {selectedLead.status === 'blocked' ? (
                  <button
                    className="button button--secondary"
                    disabled={mutatingSessionId === selectedLead.sessionId}
                    type="button"
                    onClick={() => onUnblockAttempt(selectedLead.sessionId)}
                  >
                    {mutatingSessionId === selectedLead.sessionId ? 'Разблокируем...' : 'Разблокировать'}
                  </button>
                ) : (
                  <button
                    className="button button--danger"
                    disabled={mutatingSessionId === selectedLead.sessionId}
                    type="button"
                    onClick={() => onBlockAttempt(selectedLead.sessionId)}
                  >
                    {mutatingSessionId === selectedLead.sessionId ? 'Блокируем...' : 'Заблокировать'}
                  </button>
                )}
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
