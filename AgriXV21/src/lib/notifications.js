const STORAGE_KEY = 'agrix_notifications';
const MUTES_KEY = 'agrix_notification_mutes';
const WEB_NOTIFICATIONS_KEY = 'agrix_web_notifications_enabled';
const MAX_ITEMS = 200;

let memoryNotifications = [];
let memoryMutes = {};
let memoryWebNotificationsEnabled = false;
let lastWebNotifyAtByKey = {};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readRaw() {
  if (!canUseStorage()) return memoryNotifications;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (_err) {
    return [];
  }
}

function readMutes() {
  if (!canUseStorage()) return memoryMutes;
  try {
    const raw = window.localStorage.getItem(MUTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch (_err) {
    return {};
  }
}

function readWebNotificationsEnabled() {
  if (!canUseStorage()) return memoryWebNotificationsEnabled;
  try {
    const raw = window.localStorage.getItem(WEB_NOTIFICATIONS_KEY);
    return raw === '1';
  } catch (_err) {
    return false;
  }
}

function writeWebNotificationsEnabled(enabled) {
  const v = enabled ? '1' : '0';
  if (!canUseStorage()) {
    memoryWebNotificationsEnabled = enabled;
    return;
  }
  try {
    window.localStorage.setItem(WEB_NOTIFICATIONS_KEY, v);
  } catch (_err) {}
}

function writeMutes(next) {
  const safe = next && typeof next === 'object' ? next : {};
  if (!canUseStorage()) {
    memoryMutes = safe;
    return;
  }
  try {
    window.localStorage.setItem(MUTES_KEY, JSON.stringify(safe));
  } catch (_err) {}
}

function writeRaw(items) {
  const safeItems = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
  if (!canUseStorage()) {
    memoryNotifications = safeItems;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
  } catch (_err) {
  }
}

function emitChange(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('agrix:notifications', { detail }));
  } catch (_err) {
  }
}

export function isWebNotificationsSupported() {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function isWebNotificationsEnabled() {
  return readWebNotificationsEnabled();
}

export async function enableWebNotifications() {
  if (!isWebNotificationsSupported()) return { ok: false, code: 'UNSUPPORTED' };
  if (window.Notification.permission === 'granted') {
    writeWebNotificationsEnabled(true);
    return { ok: true };
  }
  if (window.Notification.permission === 'denied') return { ok: false, code: 'DENIED' };
  const result = await window.Notification.requestPermission();
  const ok = result === 'granted';
  writeWebNotificationsEnabled(ok);
  return ok ? { ok: true } : { ok: false, code: 'DENIED' };
}

export function disableWebNotifications() {
  writeWebNotificationsEnabled(false);
}

function maybeSendWebNotification(item) {
  if (!isWebNotificationsSupported()) return;
  if (!readWebNotificationsEnabled()) return;
  if (window.Notification.permission !== 'granted') return;

  const level = String(item?.level || 'info').trim().toLowerCase();
  if (level !== 'error' && level !== 'warning') return;

  const key = String(item?.key || '').trim() || 'update';
  const now = Date.now();
  const last = Number(lastWebNotifyAtByKey?.[key] || 0);
  if (Number.isFinite(last) && now - last < 60 * 1000) return;
  lastWebNotifyAtByKey = { ...lastWebNotifyAtByKey, [key]: now };

  const title = String(item?.title || '').trim() || 'Update';
  const message = String(item?.message || '').trim() || '';
  try {
    new window.Notification(title, { body: message });
  } catch (_err) {}
}

export function listNotifications() {
  return readRaw()
    .slice()
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
}

export function listAdminNotifications() {
  return listNotifications().filter((item) => {
    const audience = String(item?.audience || item?.role || '').trim().toLowerCase();
    return audience === 'admin' || audience === 'administrators';
  });
}

export function getUnreadAdminNotificationsCount() {
  return listAdminNotifications().filter((item) => !item.read).length;
}

export function markAdminNotificationsRead() {
  const adminIds = new Set(listAdminNotifications().map((item) => item.id));
  if (!adminIds.size) return;
  const next = listNotifications().map((item) => adminIds.has(item.id) ? { ...item, read: true } : item);
  writeRaw(next);
  emitChange({ type: 'updated' });
}

export function getUnreadNotificationsCount() {
  return listNotifications().filter((n) => !n?.read).length;
}

export function addNotification(payload) {
  const title = String(payload?.title || '').trim() || 'Farm update';
  const message = String(payload?.message || '').trim() || 'There is a new update.';
  const level = String(payload?.level || 'info').trim().toLowerCase();
  const key =
    String(payload?.key || '').trim() ||
    title
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_:-]/g, '')
      .slice(0, 60) ||
    'update';
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    message,
    level,
    key,
    audience: String(payload?.audience || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
    read: false,
    acknowledgedAt: 0,
    createdAt: Date.now(),
  };
  const next = [item, ...listNotifications()].slice(0, MAX_ITEMS);
  writeRaw(next);
  emitChange({ type: 'added', notification: item });
  maybeSendWebNotification(item);
  return item;
}

export function acknowledgeNotification(notificationId) {
  const id = String(notificationId || '');
  if (!id) return;
  const now = Date.now();
  const next = listNotifications().map((n) => (n.id === id ? { ...n, read: true, acknowledgedAt: now } : n));
  writeRaw(next);
  emitChange({ type: 'updated' });
}

export function markNotificationRead(notificationId) {
  const id = String(notificationId || '');
  if (!id) return;
  const next = listNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  writeRaw(next);
  emitChange({ type: 'updated' });
}

export function markAllNotificationsRead() {
  const next = listNotifications().map((n) => ({ ...n, read: true }));
  writeRaw(next);
  emitChange({ type: 'updated' });
}

export function clearNotifications() {
  writeRaw([]);
  emitChange({ type: 'updated' });
}

export function muteNotification(notificationKey, durationMs) {
  const key = String(notificationKey || '').trim();
  if (!key) return;
  const ms = Math.max(0, Number(durationMs || 0));
  const until = Date.now() + ms;
  const next = { ...readMutes(), [key]: until };
  writeMutes(next);
  emitChange({ type: 'mute_updated', key, until });
}

export function unmuteNotification(notificationKey) {
  const key = String(notificationKey || '').trim();
  if (!key) return;
  const current = { ...readMutes() };
  if (!Object.prototype.hasOwnProperty.call(current, key)) return;
  delete current[key];
  writeMutes(current);
  emitChange({ type: 'mute_updated', key, until: 0 });
}

export function getMuteUntil(notificationKey) {
  const key = String(notificationKey || '').trim();
  if (!key) return 0;
  const until = Number(readMutes()?.[key] || 0);
  return Number.isFinite(until) ? until : 0;
}

export function isNotificationMuted(notificationKey) {
  const until = getMuteUntil(notificationKey);
  return until > Date.now();
}

export function subscribeNotifications(listener) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = (event) => {
    if (typeof listener === 'function') listener(event?.detail || { type: 'updated' });
  };
  window.addEventListener('agrix:notifications', handler);
  return () => {
    window.removeEventListener('agrix:notifications', handler);
  };
}
