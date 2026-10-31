function load() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('agrix_admin_activity') || '';
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_err) {
  }
  return [];
}

function save(items) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('agrix_admin_activity', JSON.stringify(items));
    }
  } catch (_err) {
  }
}

export function getAdminActivitySeenAt() {
  try {
    return Number(typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('agrix_admin_activity_seen_at') || 0
      : 0) || 0;
  } catch (_err) {
    return 0;
  }
}

export function getAdminActivityUnreadCount() {
  const seenAt = getAdminActivitySeenAt();
  return load().filter((entry) => {
    const at = Date.parse(entry?.at) || Number(entry?.at) || 0;
    return at > seenAt;
  }).length;
}

export function markAdminActivityRead() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('agrix_admin_activity_seen_at', String(Date.now()));
    }
  } catch (_err) {
  }
}

export function listAdminActivity(limit = 20) {
  const items = load();
  const n = Math.max(1, Math.min(200, Number(limit) || 20));
  return items.slice(0, n);
}

export function logAdminActivity(event) {
  const e = event && typeof event === 'object' ? event : {};
  const entry = {
    id: String(e.id || `${Date.now()}-${Math.floor(Math.random() * 1e9)}`),
    at: e.at ? String(e.at) : new Date().toISOString(),
    type: String(e.type || 'event'),
    message: String(e.message || ''),
  };
  const next = [entry, ...load()].slice(0, 200);
  save(next);
}

