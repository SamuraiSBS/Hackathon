const PLAYER_KEY = 'ddos-guard-player';

export function savePlayer(player) {
  try {
    window.localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // localStorage may be full or disabled
  }
}

export function loadPlayer() {
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.firstName === 'string' && typeof parsed.phone === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPlayer() {
  try {
    window.localStorage.removeItem(PLAYER_KEY);
  } catch {
    // silently ignore
  }
}
