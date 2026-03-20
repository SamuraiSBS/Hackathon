import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { GameSummary } from './components/GameSummary';
import { GameViewport } from './components/GameViewport';
import { LeadCapture } from './components/LeadCapture';
import { StandUnlock } from './components/StandUnlock';
import { StartScreen } from './components/StartScreen';
import { GAME_CATALOG, getGameById } from './data/gameCatalog';
import {
  ApiError,
  blockAttempt,
  checkAdminSession,
  checkStandSession,
  clearTelegramAuthState,
  getAdminSnapshot,
  getAttemptStatus,
  getPublicSnapshot,
  getTelegramAuthState,
  getTelegramLoginUrl,
  hasPhpApi,
  loginAdmin,
  loginStand,
  logoutAdmin,
  logoutStand,
  registerLead,
  resetLocalDemo,
  submitScore,
  unblockAttempt,
} from './lib/api';

const phpApiEnabled = hasPhpApi();
const standClosedMessage = 'Доступ завершён. Обратитесь к администратору.';
const sessionFinishedMessage = 'Сессия завершена. Можно начать новую регистрацию.';
const adminSessionExpiredMessage = 'Сессия завершена. Войдите снова.';

const emptyAdminSnapshot = {
  leaderboard: [],
  summary: {
    totalLeads: 0,
    completedRuns: 0,
    victories: 0,
    bestScore: 0,
    telegramLeads: 0,
    manualLeads: 0,
  },
  recentLeads: [],
};

const initialStandState = phpApiEnabled
  ? {
      status: 'idle',
      error: '',
      tokenConfigured: false,
      authenticatedAt: null,
      deactivatedAt: null,
    }
  : {
      status: 'unlocked',
      error: '',
      tokenConfigured: false,
      authenticatedAt: null,
      deactivatedAt: null,
    };

const initialTelegramState = phpApiEnabled
  ? {
      status: 'idle',
      configured: false,
      profile: null,
      error: '',
    }
  : {
      status: 'disabled',
      configured: false,
      profile: null,
      error: '',
    };

const GAME_IDS = new Set(GAME_CATALOG.map((g) => g.id));

function readRoute() {
  return window.location.pathname === '/admin' ? 'admin' : 'stand';
}

function readGameIdFromPath() {
  const segment = window.location.pathname.slice(1);
  return GAME_IDS.has(segment) ? segment : null;
}

function isUnauthorized(error) {
  return error instanceof ApiError && error.status === 401;
}

function getStandUnlockError(error) {
  if (!isUnauthorized(error)) {
    return error.message || 'Не удалось открыть доступ.';
  }

  return error.message === 'Unauthorized.' ? 'Требуется вход.' : 'Неверный код доступа.';
}

export default function App() {
  const [route, setRoute] = useState(readRoute());
  const [phase, setPhase] = useState('lead');
  const [busy, setBusy] = useState(false);
  const [adapter, setAdapter] = useState('local-demo');
  const [sessionId, setSessionId] = useState('');
  const [player, setPlayer] = useState(null);
  const [selectedGameId, setSelectedGameId] = useState(GAME_CATALOG[0].id);
  const [pendingGameId, setPendingGameId] = useState(readGameIdFromPath);
  const [result, setResult] = useState(null);
  const [adminSnapshot, setAdminSnapshot] = useState(emptyAdminSnapshot);
  const [appError, setAppError] = useState('');
  const [adminAuth, setAdminAuth] = useState({
    status: 'idle',
    error: '',
    passwordConfigured: false,
    requiresPhpApi: false,
  });
  const [standAuth, setStandAuth] = useState(initialStandState);
  const [telegramAuth, setTelegramAuth] = useState(initialTelegramState);
  const [telegramAutoSubmitKey, setTelegramAutoSubmitKey] = useState('');
  const [mutatingSessionId, setMutatingSessionId] = useState('');

  const selectedGame = useMemo(() => getGameById(selectedGameId), [selectedGameId]);
  const isAdminAuthenticated = adminAuth.status === 'authenticated';
  const isStandUnlocked = standAuth.status === 'unlocked';

  function applyStandSession(response, error = '') {
    setStandAuth({
      status: response.authenticated ? 'unlocked' : 'locked',
      error,
      tokenConfigured: response.tokenConfigured,
      authenticatedAt: response.authenticatedAt ?? null,
      deactivatedAt: response.deactivatedAt ?? null,
    });
  }

  function lockCurrentStand(error) {
    setStandAuth((current) => ({
      ...current,
      status: 'locked',
      error,
      tokenConfigured: true,
      authenticatedAt: null,
    }));
  }

  useEffect(() => {
    if (window.location.pathname !== '/registration') {
      window.history.replaceState(null, '', '/registration');
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(readRoute());
      const path = window.location.pathname;
      if (path === '/') {
        setPhase('start');
      } else if (path === '/registration') {
        resetStandFlow();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function resetStandFlow() {
    setPhase('lead');
    setSessionId('');
    setPlayer(null);
    setResult(null);
    setSelectedGameId(GAME_CATALOG[0].id);
    setPendingGameId(null);
    setTelegramAutoSubmitKey('');
    if (window.location.pathname !== '/registration') {
      window.history.pushState(null, '', '/registration');
    }
    setTelegramAuth((current) => ({
      ...current,
      status: phpApiEnabled ? 'idle' : 'disabled',
      profile: null,
      error: '',
    }));
  }

  async function refreshPublicSnapshot() {
    const nextSnapshot = await getPublicSnapshot();
    setAdapter(nextSnapshot.adapter);
  }

  async function refreshAdminSnapshot() {
    const nextSnapshot = await getAdminSnapshot();
    setAdapter(nextSnapshot.adapter);
    setAdminSnapshot({
      leaderboard: nextSnapshot.leaderboard,
      summary: nextSnapshot.summary,
      recentLeads: nextSnapshot.recentLeads,
    });
  }

  useEffect(() => {
    refreshPublicSnapshot().catch((error) => {
      setAppError(error.message || 'Не удалось загрузить данные.');
    });
  }, []);

  useEffect(() => {
    if (!phpApiEnabled) {
      return;
    }

    let cancelled = false;

    async function ensureStandSession() {
      setStandAuth((current) => ({
        ...current,
        status: current.status === 'idle' ? 'checking' : current.status,
        error: '',
      }));

      try {
        const response = await checkStandSession();

        if (cancelled) {
          return;
        }

        if (response.authenticated) {
          applyStandSession(response);
          return;
        }

        applyStandSession(response);

        if (route === 'stand') {
          resetStandFlow();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        lockCurrentStand(error.message || 'Не удалось проверить доступ.');
      }
    }

    ensureStandSession();
    const intervalId = window.setInterval(ensureStandSession, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [route]);

  useEffect(() => {
    if (route !== 'stand' || !phpApiEnabled || !isStandUnlocked || sessionId === '' || phase === 'lead') {
      return;
    }

    let cancelled = false;

    async function checkAttempt() {
      try {
        const response = await getAttemptStatus(sessionId);

        if (cancelled || response.sessionId !== sessionId) {
          return;
        }

        if (response.blocked) {
          setAppError(sessionFinishedMessage);
          resetStandFlow();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isUnauthorized(error)) {
          lockCurrentStand(standClosedMessage);
          resetStandFlow();
        }
      }
    }

    checkAttempt();
    const intervalId = window.setInterval(checkAttempt, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [route, phase, isStandUnlocked, sessionId]);

  useEffect(() => {
    if (route !== 'admin') {
      return;
    }

    let cancelled = false;

    async function ensureAdminSession() {
      setAdminAuth((current) => ({ ...current, status: 'checking', error: '' }));

      try {
        const response = await checkAdminSession();

        if (cancelled) {
          return;
        }

        if (response.requiresPhpApi) {
          setAdminAuth({
            status: 'unauthenticated',
            error: '',
            passwordConfigured: false,
            requiresPhpApi: true,
          });
          return;
        }

        if (!response.passwordConfigured) {
          setAdminAuth({
            status: 'unauthenticated',
            error: '',
            passwordConfigured: false,
            requiresPhpApi: false,
          });
          return;
        }

        if (response.authenticated) {
          setAdminAuth({
            status: 'authenticated',
            error: '',
            passwordConfigured: true,
            requiresPhpApi: false,
          });
          try {
            await refreshAdminSnapshot();
          } catch (snapshotError) {
            if (!cancelled && isUnauthorized(snapshotError)) {
              setAdminAuth({
                status: 'unauthenticated',
                error: adminSessionExpiredMessage,
                passwordConfigured: true,
                requiresPhpApi: false,
              });
            }
          }
          return;
        }

        setAdminAuth({
          status: 'unauthenticated',
          error: '',
          passwordConfigured: true,
          requiresPhpApi: false,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAdminAuth({
          status: 'unauthenticated',
          error: error.message || 'Не удалось проверить доступ.',
          passwordConfigured: true,
          requiresPhpApi: false,
        });
      }
    }

    ensureAdminSession();

    return () => {
      cancelled = true;
    };
  }, [route]);

  useEffect(() => {
    if (route !== 'stand' || phase !== 'lead' || !phpApiEnabled || !isStandUnlocked) {
      return;
    }

    let cancelled = false;

    async function refreshTelegramAuth() {
      setTelegramAuth((current) => ({
        ...current,
        status: 'checking',
      }));

      try {
        const response = await getTelegramAuthState();

        if (cancelled) {
          return;
        }

        setTelegramAuth({
          status: 'ready',
          configured: response.configured,
          profile: response.profile ?? null,
          error: response.error ?? '',
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isUnauthorized(error)) {
          lockCurrentStand(standClosedMessage);
          resetStandFlow();
          return;
        }

        setTelegramAuth({
          status: 'error',
          configured: false,
          profile: null,
          error: error.message || 'Не удалось проверить Telegram.',
        });
      }
    }

    refreshTelegramAuth();

    return () => {
      cancelled = true;
    };
  }, [phase, route, isStandUnlocked]);

  async function clearTelegramState() {
    setTelegramAuth((current) => ({
      ...current,
      status: phpApiEnabled ? 'idle' : 'disabled',
      profile: null,
      error: '',
    }));

    if (!phpApiEnabled) {
      return;
    }

    try {
      await clearTelegramAuthState();
    } catch {
    }
  }

  function createTelegramLeadPayload(profile) {
    const fallbackName = profile.telegram ? profile.telegram.replace(/^@/, '') : 'Игрок';

    return {
      firstName: profile.firstName || fallbackName,
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      telegram: profile.telegram || '',
      telegramId: profile.telegramId || '',
      telegramPhotoUrl: profile.photoUrl || '',
      source: 'telegram',
    };
  }

  useEffect(() => {
    if (route !== 'stand' || phase !== 'lead' || !isStandUnlocked || busy) {
      return;
    }

    const profile = telegramAuth.profile;

    if (!profile) {
      return;
    }

    const autoKey = [profile.telegramId, profile.telegram, profile.authenticatedAt].filter(Boolean).join(':');

    if (!autoKey || autoKey === telegramAutoSubmitKey) {
      return;
    }

    setTelegramAutoSubmitKey(autoKey);
    setTelegramAuth((current) => ({
      ...current,
      status: 'submitting',
      error: '',
    }));

    handleLeadSubmit(createTelegramLeadPayload(profile), { fromTelegram: true });
  }, [
    route,
    phase,
    isStandUnlocked,
    busy,
    telegramAuth.profile,
    telegramAutoSubmitKey,
  ]);

  async function handleStandUnlock(token) {
    setStandAuth((current) => ({ ...current, status: 'checking', error: '' }));
    setAppError('');

    try {
      const response = await loginStand(token);
      applyStandSession({
        authenticated: true,
        tokenConfigured: true,
        authenticatedAt: response.authenticatedAt ?? null,
        deactivatedAt: null,
      });
      resetStandFlow();
      await clearTelegramState();
      await refreshPublicSnapshot();
    } catch (error) {
      setStandAuth((current) => ({
        ...current,
        status: 'locked',
        error: getStandUnlockError(error),
      }));
    }
  }

  async function handleStandDeactivate() {
    setStandAuth((current) => ({ ...current, status: 'checking', error: '' }));
    setAppError('');

    try {
      const response = await logoutStand();
      applyStandSession({
        authenticated: false,
        tokenConfigured: true,
        authenticatedAt: standAuth.authenticatedAt,
        deactivatedAt: response.deactivatedAt ?? null,
      });
      resetStandFlow();
    } catch (error) {
      setStandAuth((current) => ({
        ...current,
        status: current.tokenConfigured ? 'unlocked' : 'locked',
        error: isUnauthorized(error) ? 'Требуется вход.' : error.message || 'Не удалось закрыть доступ.',
      }));
    }
  }

  async function handleLeadSubmit(form, options = {}) {
    setBusy(true);
    setAppError('');

    try {
      const response = await registerLead(form);
      setAdapter(response.adapter);
      setSessionId(response.sessionId);
      setPlayer(response.player);
      await clearTelegramState();
      if (pendingGameId) {
        setSelectedGameId(pendingGameId);
        setPendingGameId(null);
        setPhase('game');
        window.history.replaceState(null, '', `/${pendingGameId}`);
      } else {
        setPhase('start');
        window.history.replaceState(null, '', '/');
      }
      await refreshPublicSnapshot();
    } catch (error) {
      if (isUnauthorized(error)) {
        lockCurrentStand(standClosedMessage);
        resetStandFlow();
      } else {
        if (options.fromTelegram) {
          setTelegramAutoSubmitKey('');
          setTelegramAuth((current) => ({
            ...current,
            status: 'ready',
            error: error.message || 'Не удалось выполнить вход через Telegram.',
          }));
        } else {
          setAppError(error.message || 'Не удалось зарегистрировать участника.');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSelectGame(gameId) {
    if (!player) {
      setPendingGameId(gameId);
      setPhase('lead');
      window.history.pushState(null, '', '/registration');
      return;
    }
    setSelectedGameId(gameId);
    setPhase('game');
    window.history.pushState(null, '', `/${gameId}`);
  }

  function handleReturnToStart() {
    setPhase('start');
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  }

  async function handleGameComplete(gameResult) {
    setBusy(true);
    setAppError('');

    try {
      const response = await submitScore({
        sessionId,
        gameId: selectedGame.id,
        gameTitle: selectedGame.title,
        result: gameResult.result,
        score: gameResult.score,
        reason: gameResult.reason,
        durationSeconds: gameResult.durationSeconds,
      });

      setAdapter(response.adapter);
      setResult(response.attempt);
      setPhase('summary');
      await refreshPublicSnapshot();
    } catch (error) {
      if (isUnauthorized(error)) {
        lockCurrentStand(standClosedMessage);
        resetStandFlow();
      } else if (error instanceof ApiError && error.status === 403) {
        setAppError(sessionFinishedMessage);
        resetStandFlow();
      } else if (error instanceof ApiError && error.status === 409) {
        setAppError('Эта попытка уже завершена. Начните новую регистрацию.');
        resetStandFlow();
      } else {
        setAppError(error.message || 'Не удалось отправить результат игры.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResetDemo() {
    const nextSnapshot = await resetLocalDemo();
    setAdapter(nextSnapshot.adapter);
    setAdminSnapshot({
      leaderboard: nextSnapshot.leaderboard,
      summary: nextSnapshot.summary,
      recentLeads: nextSnapshot.recentLeads,
    });
  }

  async function handleAdminRefresh() {
    try {
      await refreshAdminSnapshot();
    } catch (error) {
      if (isUnauthorized(error)) {
        setAdminAuth({
          status: 'unauthenticated',
          error: adminSessionExpiredMessage,
          passwordConfigured: true,
          requiresPhpApi: false,
        });
        setAdminSnapshot(emptyAdminSnapshot);
        return;
      }

      setAppError(error.message || 'Не удалось обновить данные.');
    }
  }

  async function handleAdminBlockAttempt(targetSessionId) {
    setMutatingSessionId(targetSessionId);
    setAppError('');

    try {
      await blockAttempt(targetSessionId);
      await refreshAdminSnapshot();
    } catch (error) {
      if (isUnauthorized(error)) {
        setAdminAuth({
          status: 'unauthenticated',
          error: adminSessionExpiredMessage,
          passwordConfigured: true,
          requiresPhpApi: false,
        });
        setAdminSnapshot(emptyAdminSnapshot);
        return;
      }

      setAppError(error.message || 'Не удалось заблокировать участника.');
    } finally {
      setMutatingSessionId('');
    }
  }

  async function handleAdminUnblockAttempt(targetSessionId) {
    setMutatingSessionId(targetSessionId);
    setAppError('');

    try {
      await unblockAttempt(targetSessionId);
      await refreshAdminSnapshot();
    } catch (error) {
      if (isUnauthorized(error)) {
        setAdminAuth({
          status: 'unauthenticated',
          error: adminSessionExpiredMessage,
          passwordConfigured: true,
          requiresPhpApi: false,
        });
        setAdminSnapshot(emptyAdminSnapshot);
        return;
      }

      setAppError(error.message || 'Не удалось разблокировать участника.');
    } finally {
      setMutatingSessionId('');
    }
  }

  async function handleAdminLogin(password) {
    setAdminAuth((current) => ({ ...current, status: 'checking', error: '' }));

    try {
      await loginAdmin(password);
    } catch (error) {
      const message = isUnauthorized(error) ? 'Неверный пароль.' : error.message || 'Не удалось выполнить вход.';

      setAdminAuth((current) => ({
        ...current,
        status: 'unauthenticated',
        error: message,
      }));
      return;
    }

    setAdminAuth({
      status: 'authenticated',
      error: '',
      passwordConfigured: true,
      requiresPhpApi: false,
    });

    try {
      await refreshAdminSnapshot();
    } catch {
      // Авторизация прошла успешно — ошибка загрузки снапшота не разлогиниваем
    }
  }

  async function handleAdminLogout() {
    await logoutAdmin();
    setAdminAuth({
      status: 'unauthenticated',
      error: '',
      passwordConfigured: true,
      requiresPhpApi: false,
    });
    setAdminSnapshot(emptyAdminSnapshot);
    window.history.pushState(null, '', '/');
    setRoute('stand');
  }

  function handleTelegramLogin() {
    const loginUrl = getTelegramLoginUrl();

    if (!loginUrl) {
      setTelegramAuth({
        status: 'error',
        configured: false,
        profile: null,
        error: 'Telegram временно недоступен.',
      });
      return;
    }

    setTelegramAuth((current) => ({
      ...current,
      status: 'redirecting',
      error: '',
    }));
    window.location.assign(loginUrl);
  }

  function restartFlow() {
    resetStandFlow();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img alt="DDoS-Guard" className="brand-logo" src="/brand/logo-basic.svg" />
          <div className="brand-lockup__copy">
            <div className="brand-kicker">Prototype</div>
          </div>
        </div>
        <nav className="topbar-nav">
          {route === 'admin' && isAdminAuthenticated ? (
            <button className="button button--secondary topbar-action" onClick={handleAdminLogout} type="button">
              Выход
            </button>
          ) : null}
        </nav>
      </header>

      <main className="layout layout--single">
        <section className="content">
          {appError ? <div className="form-error">{appError}</div> : null}

          {route === 'admin' && adminAuth.status === 'checking' ? (
            <section className="panel panel--feature">
              <div className="eyebrow">Вход</div>
              <h1>Проверяем доступ</h1>
            </section>
          ) : null}

          {route === 'admin' && adminAuth.status !== 'checking' && !isAdminAuthenticated ? (
            <AdminLogin
              busy={adminAuth.status === 'checking'}
              error={adminAuth.error}
              onSubmit={handleAdminLogin}
              passwordConfigured={adminAuth.passwordConfigured}
              requiresPhpApi={adminAuth.requiresPhpApi}
            />
          ) : null}

          {route === 'admin' && isAdminAuthenticated ? (
            <AdminDashboard
              adapter={adapter}
              mutatingSessionId={mutatingSessionId}
              onBlockAttempt={handleAdminBlockAttempt}
              onStandDeactivate={handleStandDeactivate}
              onStandUnlock={handleStandUnlock}
              onUnblockAttempt={handleAdminUnblockAttempt}
              onRefresh={handleAdminRefresh}
              onResetDemo={handleResetDemo}
              snapshot={adminSnapshot}
              standAuth={standAuth}
            />
          ) : null}

          {route === 'stand' && phpApiEnabled && standAuth.status === 'checking' ? (
            <section className="panel panel--feature">
              <div className="eyebrow">Доступ</div>
              <h1>Проверяем доступ</h1>
            </section>
          ) : null}

          {route === 'stand' && phpApiEnabled && standAuth.status !== 'checking' && !isStandUnlocked ? (
            <StandUnlock error={standAuth.error} tokenConfigured={standAuth.tokenConfigured} />
          ) : null}

          {route === 'stand' && isStandUnlocked && phase === 'lead' ? (
            <LeadCapture busy={busy} onSubmit={handleLeadSubmit} onTelegramLogin={handleTelegramLogin} telegramAuth={telegramAuth} />
          ) : null}
          {route === 'stand' && isStandUnlocked && phase === 'start' ? (
            <StartScreen onSelectGame={handleSelectGame} player={player} />
          ) : null}
          {route === 'stand' && isStandUnlocked && phase === 'game' ? (
            <GameViewport game={selectedGame} key={`${sessionId}-${selectedGame.id}`} onComplete={handleGameComplete} onReturnHome={handleReturnToStart} />
          ) : null}
          {route === 'stand' && isStandUnlocked && phase === 'summary' && result ? (
            <GameSummary onRestart={restartFlow} result={result} selectedGame={selectedGame} />
          ) : null}
        </section>
      </main>
    </div>
  );
}
