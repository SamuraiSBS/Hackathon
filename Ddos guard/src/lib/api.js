import { getDemoSnapshot, registerDemoLead, resetDemoStore, submitDemoResult } from './demoStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function hasPhpApi() {
  return API_BASE_URL !== '';
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: options.credentials ?? 'same-origin',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `API request failed with status ${response.status}`, response.status, payload);
  }

  return payload;
}

export async function registerLead(payload) {
  if (!hasPhpApi()) {
    return { ...(await registerDemoLead(payload)), adapter: 'local-demo' };
  }

  return { ...(await request('/register.php', { method: 'POST', body: payload, credentials: 'include' })), adapter: 'php-api' };
}

export async function submitScore(payload) {
  if (!hasPhpApi()) {
    return { ...(await submitDemoResult(payload)), adapter: 'local-demo' };
  }

  return {
    ...(await request('/submit-score.php', { method: 'POST', body: payload, credentials: 'include' })),
    adapter: 'php-api',
  };
}

export async function getPublicSnapshot() {
  if (!hasPhpApi()) {
    return { ...(await getDemoSnapshot()), adapter: 'local-demo' };
  }

  return { ...(await request('/leaderboard.php')), adapter: 'php-api' };
}

export async function getAdminSnapshot() {
  if (!hasPhpApi()) {
    throw new ApiError('Раздел временно недоступен.', 503);
  }

  return { ...(await request('/admin.php', { credentials: 'include' })), adapter: 'php-api' };
}

export async function blockAttempt(sessionId) {
  if (!hasPhpApi()) {
    throw new ApiError('Действие временно недоступно.', 503);
  }

  return request('/block-attempt.php', {
    method: 'POST',
    body: { sessionId },
    credentials: 'include',
  });
}

export async function unblockAttempt(sessionId) {
  if (!hasPhpApi()) {
    throw new ApiError('Действие временно недоступно.', 503);
  }

  return request('/unblock-attempt.php', {
    method: 'POST',
    body: { sessionId },
    credentials: 'include',
  });
}

export async function getAttemptStatus(sessionId) {
  if (!hasPhpApi()) {
    return {
      sessionId,
      status: 'local-demo',
      blocked: false,
      adapter: 'local-demo',
    };
  }

  const params = new URLSearchParams({ sessionId });
  return { ...(await request(`/attempt-status.php?${params.toString()}`, { credentials: 'include' })), adapter: 'php-api' };
}

export async function checkAdminSession() {
  if (!hasPhpApi()) {
    return {
      authenticated: false,
      passwordConfigured: false,
      adapter: 'local-demo',
      requiresPhpApi: true,
    };
  }

  return { ...(await request('/auth-session.php', { credentials: 'include' })), adapter: 'php-api' };
}

export async function loginAdmin(password) {
  if (!hasPhpApi()) {
    throw new ApiError('Раздел временно недоступен.', 503);
  }

  return request('/auth-login.php', {
    method: 'POST',
    body: { password },
    credentials: 'include',
  });
}

export async function logoutAdmin() {
  if (!hasPhpApi()) {
    return { authenticated: false };
  }

  return request('/auth-logout.php', {
    method: 'POST',
    body: {},
    credentials: 'include',
  });
}

export async function checkStandSession() {
  if (!hasPhpApi()) {
    return {
      authenticated: true,
      tokenConfigured: false,
      authenticatedAt: null,
      deactivatedAt: null,
      adapter: 'local-demo',
      requiresPhpApi: false,
    };
  }

  return { ...(await request('/stand-session.php', { credentials: 'include' })), adapter: 'php-api' };
}

export async function loginStand(token) {
  if (!hasPhpApi()) {
    return { authenticated: true };
  }

  return request('/stand-login.php', {
    method: 'POST',
    body: { token },
    credentials: 'include',
  });
}

export async function logoutStand() {
  if (!hasPhpApi()) {
    return { authenticated: false };
  }

  return request('/stand-logout.php', {
    method: 'POST',
    body: {},
    credentials: 'include',
  });
}

export async function getTelegramAuthState() {
  if (!hasPhpApi()) {
    return {
      configured: false,
      profile: null,
      error: '',
      adapter: 'local-demo',
    };
  }

  return { ...(await request('/telegram-session.php', { credentials: 'include' })), adapter: 'php-api' };
}

export async function clearTelegramAuthState() {
  if (!hasPhpApi()) {
    return { ok: true, configured: false };
  }

  return request('/telegram-clear.php', {
    method: 'POST',
    body: {},
    credentials: 'include',
  });
}

export function getTelegramLoginUrl() {
  if (!hasPhpApi()) {
    return '';
  }

  return `${API_BASE_URL}/telegram-login.php`;
}

export async function resetLocalDemo() {
  return { ...(await resetDemoStore()), adapter: 'local-demo' };
}

export { ApiError };
