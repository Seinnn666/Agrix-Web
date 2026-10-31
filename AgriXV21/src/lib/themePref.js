const STORAGE_KEY = 'agrix_theme';

let memoryTheme = 'light';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitChange(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('agrix:theme', { detail }));
  } catch (_err) {}
}

export function getThemeMode() {
  if (!canUseStorage()) return memoryTheme;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'dark' ? 'dark' : 'light';
  } catch (_err) {
    return 'light';
  }
}

export function setThemeMode(mode) {
  const next = mode === 'dark' ? 'dark' : 'light';
  if (!canUseStorage()) {
    memoryTheme = next;
  } else {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (_err) {}
  }
  emitChange({ type: 'updated', mode: next });
  return next;
}

export function subscribeTheme(listener) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = (event) => {
    if (typeof listener === 'function') listener(event?.detail || { type: 'updated' });
  };
  window.addEventListener('agrix:theme', handler);
  return () => window.removeEventListener('agrix:theme', handler);
}

