import { useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { ExitSummary } from './components/ExitSummary';
import { GameSummary } from './components/GameSummary';
import { GameViewport } from './components/GameViewport';
import { LeadCapture } from './components/LeadCapture';
import { StandUnlock } from './components/StandUnlock';
import { StartScreen } from './components/StartScreen';
import { GAME_CATALOG, getGameById } from './data/gameCatalog';
import {
  ApiError,
  beginTelegramLogin,
  blockAttempt,
  checkAdminSession,
  checkStandSession,
  clearTelegramAuthState,
  getAdminSnapshot,
  getAttemptStatus,
  getPublicSnapshot,
  getTelegramAuthState,
  hasPhpApi,
  loginAdmin,
  loginStand,
  logoutAdmin,
  logoutStand,
  registerLead,
  resetLocalDemo,
  setActiveGame,
  submitScore,
  unblockAttempt,
} from './lib/api';
import { displayName } from './lib/format';

const phpApiEnabled = hasPhpApi();
const standClosedMessage = 'Доступ завершён. Обратитесь к администратору.';
const sessionFinishedMessage = 'Сессия завершена. Можно начать новую регистрацию.';
const adminSessionExpiredMessage = 'Сессия завершена. Войдите снова.';
const STAND_PROGRESS_KEY = 'ddos-guard-stand-progress-v1';

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
  stand: {
    activeGameId: GAME_CATALOG[0].id,
  },
};

const initialStandState = phpApiEnabled
  ? {
      status: 'idle',
      error: '',
      tokenConfigured: false,
      authenticatedAt: null,
      deactivatedAt: null,
      activeGameId: GAME_CATALOG[0].id,
    }
  : {
      status: 'unlocked',
      error: '',
      tokenConfigured: false,
      authenticatedAt: null,
      deactivatedAt: null,
      activeGameId: GAME_CATALOG[0].id,
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

function readRoute() {
  if (window.location.hash === '#/admin') {
    return 'admin';
  }

  if (window.location.hash === '#/exit') {
    return 'exit';
  }

  return 'stand';
}

function readStandProgress() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(STAND_PROGRESS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStandProgress(payload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(STAND_PROGRESS_KEY, JSON.stringify(payload));
}

function clearStandProgress() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(STAND_PROGRESS_KEY);
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
  const initialProgress = readStandProgress();
  const [route, setRoute] = useState(readRoute());
  const [phase, setPhase] = useState(initialProgress?.phase === 'start' ? 'brief' : initialProgress?.phase ?? 'lead');
  const [busy, setBusy] = useState(false);
  const [adapter, setAdapter] = useState('local-demo');
  const [sessionId, setSessionId] = useState(initialProgress?.sessionId ?? '');
  const [player, setPlayer] = useState(initialProgress?.player ?? null);
  const [playedGameIds, setPlayedGameIds] = useState(initialProgress?.playedGameIds ?? []);
  const [gameResultsById, setGameResultsById] = useState(initialProgress?.gameResultsById ?? {});
  const [selectedGameId, setSelectedGameId] = useState(initialProgress?.selectedGameId ?? GAME_CATALOG[0].id);
  const [result, setResult] = useState(initialProgress?.result ?? null);
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
  const playerStats = useMemo(() => {
    const values = Object.values(gameResultsById);
    const wins = values.filter((entry) => entry.result === 'victory').length;
    const losses = values.filter((entry) => entry.result !== 'victory').length;
    const totalScore = values.reduce((sum, entry) => sum + (entry.score ?? 0), 0);

    return {
      gamesCompleted: values.length,
      wins,
      losses,
      totalScore,
    };
  }, [gameResultsById]);
  const isAdminAuthenticated = adminAuth.status === 'authenticated';
  const isStandUnlocked = standAuth.status === 'unlocked';

  function gameResultsMapFromPlays(plays = []) {
    return plays.reduce((accumulator, play) => {
      if (!play?.gameId) {
        return accumulator;
      }

      accumulator[play.gameId] = {
        gameId: play.gameId,
        gameTitle: play.gameTitle ?? '',
        result: play.result ?? 'defeat',
        score: play.score ?? 0,
        finishedAt: play.finishedAt ?? null,
      };

      return accumulator;
    }, {});
  }

  function applyStandSession(response, error = '') {
    setStandAuth({
      status: response.authenticated ? 'unlocked' : 'locked',
      error,
      tokenConfigured: response.tokenConfigured,
      authenticatedAt: response.authenticatedAt ?? null,
      deactivatedAt: response.deactivatedAt ?? null,
      activeGameId: response.activeGameId || GAME_CATALOG[0].id,
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
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (sessionId === '' || !player) {
      clearStandProgress();
      return;
    }

    writeStandProgress({
      phase,
      sessionId,
      player,
      playedGameIds,
      gameResultsById,
      selectedGameId,
      result,
    });
  }, [phase, sessionId, player, playedGameIds, gameResultsById, selectedGameId, result]);

  useEffect(() => {
    if (route !== 'exit') {
      return;
    }

    if (!player || sessionId === '') {
      window.location.hash = '#/';
    }
  }, [route, player, sessionId]);

  useEffect(() => {
    if (sessionId !== '') {
      return;
    }

    if (standAuth.activeGameId) {
      setSelectedGameId(standAuth.activeGameId);
    }
  }, [sessionId, standAuth.activeGameId]);

  function resetStandFlow() {
    setPhase('lead');
    setSessionId('');
    setPlayer(null);
    setPlayedGameIds([]);
    setGameResultsById({});
    setResult(null);
    setSelectedGameId(GAME_CATALOG[0].id);
    clearStandProgress();
    setTelegramAutoSubmitKey('');
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
      stand: {
        activeGameId: nextSnapshot.stand?.activeGameId || GAME_CATALOG[0].id,
      },
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
    if (route !== 'stand' || !phpApiEnabled || !isStandUnlocked || sessionId === '') {
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
          return;
        }

        setPlayedGameIds(response.playedGameIds ?? []);
        if (response.assignedGameId) {
          setSelectedGameId(response.assignedGameId);
        }
        setGameResultsById(
          (response.gameResults ?? []).reduce((accumulator, entry) => {
            if (!entry?.gameId) {
              return accumulator;
            }

            accumulator[entry.gameId] = entry;
            return accumulator;
          }, {})
        );

        if (phase === 'lead') {
          setPhase('brief');
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
          await refreshAdminSnapshot();
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
          status: response.configured ? 'ready' : 'disabled',
          configured: response.configured,
          profile: response.profile ?? null,
          error: response.error || (response.configured ? '' : 'Telegram Login не настроен на backend.'),
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
        activeGameId: standAuth.activeGameId,
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
        activeGameId: standAuth.activeGameId,
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
      setPlayedGameIds(response.player.playedGameIds ?? []);
      setGameResultsById(gameResultsMapFromPlays(response.player.plays ?? []));
      setSelectedGameId(response.player.activeGameId || standAuth.activeGameId || GAME_CATALOG[0].id);
      setResult(null);
      await clearTelegramState();
      setPhase('brief');
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

  function handleStartAssignedGame() {
    setAppError('');
    setResult(null);
    setPhase('game');
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
      setPlayedGameIds(response.attempt.playedGameIds ?? []);
      setGameResultsById(gameResultsMapFromPlays(response.attempt.plays ?? []));
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
        setAppError(error.message || 'Попытка уже завершена.');
        setPhase('brief');
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
      stand: {
        activeGameId: nextSnapshot.stand?.activeGameId || GAME_CATALOG[0].id,
      },
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

  async function handleAdminSetActiveGame(gameId) {
    setAppError('');

    try {
      await setActiveGame(gameId);
      await refreshAdminSnapshot();
      setStandAuth((current) => ({
        ...current,
        activeGameId: gameId,
      }));
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

      setAppError(error.message || 'Не удалось выбрать активный режим.');
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
      setAdminAuth({
        status: 'authenticated',
        error: '',
        passwordConfigured: true,
        requiresPhpApi: false,
      });
      await refreshAdminSnapshot();
    } catch (error) {
      const message = isUnauthorized(error) ? 'Неверный пароль.' : error.message || 'Не удалось выполнить вход.';

      setAdminAuth((current) => ({
        ...current,
        status: 'unauthenticated',
        error: message,
      }));
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
    window.location.hash = '#/';
  }

  async function handleTelegramLogin() {
    setTelegramAuth((current) => ({
      ...current,
      status: 'redirecting',
      error: '',
    }));

    try {
      const loginUrl = await beginTelegramLogin();

      if (!loginUrl) {
        setTelegramAuth((current) => ({
          ...current,
          status: 'error',
          error: 'Не удалось подготовить вход через Telegram.',
        }));
        return;
      }

      window.location.assign(loginUrl);
    } catch (error) {
      if (isUnauthorized(error)) {
        lockCurrentStand(standClosedMessage);
        resetStandFlow();
        return;
      }

      setTelegramAuth((current) => ({
        ...current,
        status: 'error',
        error: error.message || 'Не удалось выполнить вход через Telegram.',
      }));
    }
  }

  function handleOpenExitPage() {
    window.location.hash = '#/exit';
  }

  function handleBackFromExitPage() {
    window.location.hash = '#/';
    setPhase('brief');
  }

  function handleFinishSession() {
    resetStandFlow();
    window.location.hash = '#/';
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
          {route !== 'admin' && isStandUnlocked && sessionId !== '' && !(route === 'stand' && phase === 'summary') ? (
            <button className="button button--secondary topbar-action" onClick={handleOpenExitPage} type="button">
              Выход
            </button>
          ) : null}
          {route === 'admin' && isAdminAuthenticated ? (
            <button className="button button--secondary topbar-action" onClick={handleAdminLogout} type="button">
              Выход
            </button>
          ) : null}
        </nav>
      </header>

      <main className={`layout layout--single${route === 'stand' && phase === 'summary' ? ' layout--summary' : ''}`}>
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
              activeGameId={adminSnapshot.stand.activeGameId}
              adapter={adapter}
              mutatingSessionId={mutatingSessionId}
              onBlockAttempt={handleAdminBlockAttempt}
              onStandDeactivate={handleStandDeactivate}
              onSetActiveGame={handleAdminSetActiveGame}
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
          {route === 'stand' && isStandUnlocked && phase === 'brief' && player ? (
            <StartScreen
              busy={busy}
              game={selectedGame}
              onStart={handleStartAssignedGame}
              player={player}
            />
          ) : null}
          {route === 'stand' && isStandUnlocked && phase === 'game' ? (
            <GameViewport game={selectedGame} key={`${sessionId}-${selectedGame.id}`} onComplete={handleGameComplete} />
          ) : null}
          {route === 'stand' && isStandUnlocked && phase === 'summary' && result ? (
            <GameSummary
              actionLabel="Завершить"
              onAction={handleFinishSession}
              playerName={displayName(player)}
              result={result}
              selectedGame={selectedGame}
            />
          ) : null}
          {route === 'exit' && isStandUnlocked && player ? (
            <ExitSummary
              onBack={handleBackFromExitPage}
              onFinish={handleFinishSession}
              playerName={displayName(player)}
              stats={playerStats}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
