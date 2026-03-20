export function digitsOnly(value = '') {
  return value.replace(/\D/g, '');
}

export function normalizePhone(value = '') {
  const digits = digitsOnly(value);

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.startsWith('7')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function formatPhone(value = '') {
  const normalized = normalizePhone(value);
  const digits = digitsOnly(normalized);

  if (digits.length < 11 || digits[0] !== '7') {
    return normalized;
  }

  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

export function maskPhone(value = '') {
  const formatted = formatPhone(value);
  const digits = digitsOnly(formatted);

  if (digits.length < 11) {
    return formatted;
  }

  return `+7 (${digits.slice(1, 4)}) ***-**-${digits.slice(9, 11)}`;
}

export function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatTimer(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remainder = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function displayName(person = {}) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
}

