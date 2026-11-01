import { API_BASE_URL, loadAuth } from './authApi';

export function loadAdminAuth() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = window.localStorage.getItem('agrix_admin_token') || '';
      const expiresAt = window.localStorage.getItem('agrix_admin_expiresAt') || '';
      return { token, expiresAt };
    }
  } catch (_err) {
  }
  return { token: '', expiresAt: '' };
}

export function saveAdminAuth(token, expiresAt) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('agrix_admin_token', token);
      window.localStorage.setItem('agrix_admin_expiresAt', String(expiresAt || ''));
    }
  } catch (_err) {
  }
}

export function clearAdminAuth() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('agrix_admin_token');
      window.localStorage.removeItem('agrix_admin_expiresAt');
    }
  } catch (_err) {
  }
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() >= ts;
}

function getAdminBearerToken() {
  const { token: adminToken, expiresAt } = loadAdminAuth();
  if (adminToken && !isExpired(expiresAt)) return adminToken;
  if (adminToken && isExpired(expiresAt)) clearAdminAuth();

  const { token: userToken, user } = loadAuth();
  if (userToken && (user?.isAdmin || String(user?.role || '').trim().toLowerCase() === 'admin')) return userToken;
  return '';
}

function didExpireAdminSession() {
  const { token: adminToken, expiresAt } = loadAdminAuth();
  return Boolean(adminToken) && isExpired(expiresAt);
}

export function hasAdminPanelAccess() {
  return Boolean(getAdminBearerToken());
}

async function requestAdminJson(path, options) {
  const expired = didExpireAdminSession();
  const token = getAdminBearerToken();
  if (!token) {
    const err = new Error(expired ? 'Session expired' : 'Unauthorized');
    err.code = expired ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
    throw err;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
      ...options,
    });
  } catch (_err) {
    throw new Error(`Cannot reach API at ${API_BASE_URL}. Start the backend and try again.`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || 'Request failed';
    const err = new Error(message);
    if (data?.fieldErrors) err.fieldErrors = data.fieldErrors;
    if (res.status === 401) err.code = 'UNAUTHORIZED';
    if (res.status === 403) err.code = 'FORBIDDEN';
    throw err;
  }

  return data;
}

export async function loginAdmin(payload) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (_err) {
    throw new Error(`Cannot reach API at ${API_BASE_URL}. Start the backend and try again.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || 'Login failed');
    throw err;
  }
  return data;
}

export async function listAdminUsers({ page, pageSize, q }) {
  const qs = new URLSearchParams();
  if (page) qs.set('page', String(page));
  if (pageSize) qs.set('pageSize', String(pageSize));
  if (q) qs.set('q', String(q));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return requestAdminJson(`/admin/users${suffix}`, { method: 'GET' });
}

export async function updateAdminUser(id, patch) {
  return requestAdminJson(`/admin/users/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: JSON.stringify(patch || {}),
  });
}

export async function deleteAdminUser(id) {
  return requestAdminJson(`/admin/users/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

export async function getAdminMetrics() {
  return requestAdminJson('/admin/metrics', { method: 'GET' });
}

export async function exportAdminUsersCsv({ q } = {}) {
  const token = getAdminBearerToken();
  if (!token) {
    const err = new Error('Unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const qs = new URLSearchParams();
  if (q) qs.set('q', String(q));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/admin/users/export${suffix}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (_err) {
    throw new Error(`Cannot reach API at ${API_BASE_URL}. Start the backend and try again.`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || 'Export failed');
    if (res.status === 401) err.code = 'UNAUTHORIZED';
    if (res.status === 403) err.code = 'FORBIDDEN';
    throw err;
  }

  return res.text();
}

export async function getAdminProfile() {
  return requestAdminJson('/admin/profile', { method: 'GET' });
}

export async function updateAdminProfile(patch) {
  return requestAdminJson('/admin/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch || {}),
  });
}

