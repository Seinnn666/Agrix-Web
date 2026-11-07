function asIsoDate(value) {
  const raw = String(value ?? '').trim();
  const numeric = /^\d{10,13}$/.test(raw) ? Number(raw) * (raw.length === 10 ? 1000 : 1) : 0;
  const timestamp = typeof value === 'number' ? value : numeric || Date.parse(raw);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  try {
    return new Date(timestamp).toISOString();
  } catch (_err) {
    return '';
  }
}

function extractEntries(value, depth = 0) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth > 2) return [];
  for (const key of ['items', 'activities', 'events', 'notifications', 'entries', 'data']) {
    const entries = extractEntries(value[key], depth + 1);
    if (entries.length) return entries;
  }
  return value.id || value._id || value.message || value.title ? [value] : [];
}

function normalizeEntry(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const at = asIsoDate(entry.at ?? entry.createdAt ?? entry.created_at ?? entry.timestamp ?? entry.date);
  const message = String(entry.message || entry.body || entry.description || entry.title || '').trim();
  if (!message && !entry.type && !entry.event) return null;
  return {
    ...entry,
    id: String(entry.id || entry._id || entry.uuid || `${at || 'admin'}-${index}`),
    at,
    type: String(entry.type || entry.event || entry.category || 'event'),
    message,
  };
}

function load() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('agrix_admin_activity') || '';
      if (!raw) return [];
      let parsed = JSON.parse(raw);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return extractEntries(parsed).map(normalizeEntry).filter(Boolean);
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

export function clearAdminActivity() {
  save([]);
  markAdminActivityRead();
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

