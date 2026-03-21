import { GAME_CATALOG } from '../data/gameCatalog';
import { displayName, formatPhone } from './format';

const STORAGE_KEY = 'ddos-guard-expo-arcade-demo-v1';
const AVAILABLE_GAME_IDS = GAME_CATALOG.map((game) => game.id);

function createSeedAttempts() {
  return [
    {
      sessionId: 'demo-anna',
      firstName: 'Анна',
      lastName: 'Ковалева',
      phone: '+7 (921) 111-20-30',
      telegram: '@annak',
      source: 'telegram',
      consent: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      gameId: 'edge-glide',
      gameTitle: 'Edge Glide',
      result: 'victory',
      status: 'completed',
      score: 1840,
      durationSeconds: 70,
    },
    {
      sessionId: 'demo-ivan',
      firstName: 'Иван',
      lastName: 'Сергеев',
      phone: '+7 (903) 222-11-00',
      telegram: '',
      source: 'manual',
      consent: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      gameId: 'bot-slicer',
      gameTitle: 'Bot Slicer',
      result: 'victory',
      status: 'completed',
      score: 2360,
      durationSeconds: 60,
    },
    {
      sessionId: 'demo-polina',
      firstName: 'Полина',
      lastName: 'Миронова',
      phone: '+7 (926) 555-44-10',
      telegram: '@pmironova',
      source: 'telegram',
      consent: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
      gameId: 'infra-stack',
      gameTitle: 'Infra Stack',
      result: 'victory',
      status: 'completed',
      score: 1480,
      durationSeconds: 55,
    },
    {
      sessionId: 'demo-maxim',
      firstName: 'Максим',
      lastName: 'Орлов',
      phone: '+7 (999) 444-66-55',
      telegram: '',
      source: 'manual',
      consent: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      gameId: 'packet-catcher',
      gameTitle: 'Packet Catcher',
      result: 'defeat',
      status: 'completed',
      score: 760,
      durationSeconds: 49,
    },
  ];
}

function createInitialState() {
  return {
    attempts: createSeedAttempts(),
  };
}

function sourceFromPayload(payload) {
  if (payload.source === 'telegram' || payload.source === 'manual') {
    return payload.source;
  }

  return payload.telegramId || payload.telegramPhotoUrl ? 'telegram' : 'manual';
}

function readState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initialState = createInitialState();
    writeState(initialState);
    return initialState;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const initialState = createInitialState();
    writeState(initialState);
    return initialState;
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function legacyPlayFromAttempt(attempt) {
  if (!attempt.gameId) {
    return null;
  }

  return {
    gameId: attempt.gameId,
    gameTitle: attempt.gameTitle ?? '',
    result: attempt.result ?? 'defeat',
    reason: attempt.reason ?? '',
    score: attempt.score ?? 0,
    durationSeconds: attempt.durationSeconds ?? 0,
    finishedAt: attempt.finishedAt ?? '',
  };
}

function attemptPlays(attempt) {
  if (Array.isArray(attempt.plays) && attempt.plays.length > 0) {
    return attempt.plays.filter((play) => play?.gameId);
  }

  const legacyPlay = legacyPlayFromAttempt(attempt);
  return legacyPlay ? [legacyPlay] : [];
}

function latestAttemptPlay(attempt) {
  return [...attemptPlays(attempt)].sort((left, right) => new Date(right.finishedAt || 0) - new Date(left.finishedAt || 0))[0] ?? null;
}

function playedGameIds(attempt) {
  return [...new Set(attemptPlays(attempt).map((play) => play.gameId))];
}

function allGamesCompleted(attempt) {
  return playedGameIds(attempt).length >= AVAILABLE_GAME_IDS.length;
}

function leaderboardFromAttempts(attempts) {
  return attempts
    .flatMap((attempt) =>
      attemptPlays(attempt).map((play) => ({
        sessionId: `${attempt.sessionId}:${play.gameId}`,
        playerName: displayName(attempt),
        score: play.score,
        result: play.result,
        gameId: play.gameId,
        gameTitle: play.gameTitle,
        finishedAt: play.finishedAt,
      }))
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(left.finishedAt).getTime() - new Date(right.finishedAt).getTime();
    })
    .slice(0, 12)
    .map((attempt, index) => ({
      rank: index + 1,
      sessionId: attempt.sessionId,
      playerName: attempt.playerName,
      score: attempt.score,
      result: attempt.result,
      gameId: attempt.gameId,
      gameTitle: attempt.gameTitle,
      finishedAt: attempt.finishedAt,
    }));
}

function summaryFromAttempts(attempts) {
  const completed = attempts.flatMap((attempt) => attemptPlays(attempt));
  const victories = completed.filter((attempt) => attempt.result === 'victory').length;
  const sourceStats = attempts.reduce(
    (accumulator, attempt) => {
      const source = attempt.source === 'telegram' ? 'telegram' : 'manual';
      accumulator[source] += 1;
      return accumulator;
    },
    { telegram: 0, manual: 0 },
  );

  return {
    totalLeads: attempts.length,
    completedRuns: completed.length,
    victories,
    bestScore: completed.length ? Math.max(...completed.map((attempt) => attempt.score)) : 0,
    telegramLeads: sourceStats.telegram,
    manualLeads: sourceStats.manual,
  };
}

function snapshotFromState(state) {
  const attempts = [...state.attempts].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  return {
    leaderboard: leaderboardFromAttempts(state.attempts),
    summary: summaryFromAttempts(state.attempts),
    recentLeads: attempts.slice(0, 12).map((attempt) => {
      const latestPlay = latestAttemptPlay(attempt);

      return {
        sessionId: attempt.sessionId,
        playerName: displayName(attempt),
        phone: formatPhone(attempt.phone),
        telegram: attempt.source === 'telegram' ? attempt.telegram : '',
        source: attempt.source,
        status: attempt.status,
        result: latestPlay?.result ?? null,
        gameTitle: latestPlay?.gameTitle ?? '',
        score: latestPlay?.score ?? 0,
        createdAt: attempt.createdAt,
        finishedAt: latestPlay?.finishedAt ?? null,
        playedGameIds: playedGameIds(attempt),
        gamesCompleted: playedGameIds(attempt).length,
        gamesAvailable: AVAILABLE_GAME_IDS.length,
      };
    }),
  };
}

export async function registerDemoLead(payload) {
  const state = readState();
  const sessionId = createId('lead');
  const source = sourceFromPayload(payload);

  const attempt = {
    sessionId,
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phone: formatPhone(payload.phone),
    telegram: source === 'telegram' ? payload.telegram?.trim() ?? '' : '',
    source,
    consent: true,
    createdAt: new Date().toISOString(),
    status: 'registered',
  };

  state.attempts.unshift(attempt);
  writeState(state);

  return {
    sessionId,
    player: {
      firstName: attempt.firstName,
      lastName: attempt.lastName,
      phone: attempt.phone,
      telegram: attempt.telegram,
      source: attempt.source,
      telegramId: payload.telegramId?.trim() ?? '',
      telegramPhotoUrl: payload.telegramPhotoUrl?.trim() ?? '',
      playedGameIds: [],
      gamesAvailable: AVAILABLE_GAME_IDS.length,
    },
  };
}

export async function submitDemoResult(payload) {
  const state = readState();
  const attempt = state.attempts.find((entry) => entry.sessionId === payload.sessionId);

  if (!attempt) {
    throw new Error('Попытка не найдена в демо-хранилище.');
  }

  if (playedGameIds(attempt).includes(payload.gameId)) {
    throw new Error('Для этой игры попытка уже использована.');
  }

  const finishedAt = new Date().toISOString();
  attempt.plays = [
    ...attemptPlays(attempt),
    {
      gameId: payload.gameId,
      gameTitle: payload.gameTitle,
      score: Math.round(payload.score),
      result: payload.result,
      durationSeconds: payload.durationSeconds,
      reason: payload.reason,
      finishedAt,
    },
  ];
  attempt.status = allGamesCompleted(attempt) ? 'completed' : 'in_progress';
  attempt.finishedAt = finishedAt;
  attempt.gameId = payload.gameId;
  attempt.gameTitle = payload.gameTitle;
  attempt.score = Math.round(payload.score);
  attempt.result = payload.result;
  attempt.durationSeconds = payload.durationSeconds;
  attempt.reason = payload.reason;

  writeState(state);

  return {
    attempt: {
      ...attempt,
      playedGameIds: playedGameIds(attempt),
      gamesCompleted: playedGameIds(attempt).length,
      gamesAvailable: AVAILABLE_GAME_IDS.length,
      allGamesCompleted: allGamesCompleted(attempt),
    },
  };
}

export async function getDemoSnapshot() {
  return snapshotFromState(readState());
}

export async function resetDemoStore() {
  writeState(createInitialState());
  return snapshotFromState(readState());
}
