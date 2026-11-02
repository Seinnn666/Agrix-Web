import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

function normalizeBaseUrl(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
}

function tryParseUrl(v) {
  try {
    return new URL(v);
  } catch (_err) {
    return null;
  }
}

function shouldIgnoreEnvBaseUrlInBrowser(envBaseUrl, location) {
  const env = normalizeBaseUrl(envBaseUrl);
  if (!env || !location?.hostname) return false;

  const host = String(location.hostname || '').trim().toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const envLooksLocal = /(^http:\/\/localhost\b)|(^http:\/\/127\.0\.0\.1\b)/i.test(env);
  if (!isLocalHost && envLooksLocal) return true;

  const parsed = tryParseUrl(env);
  if (!parsed) return false;

  const envHost = String(parsed.hostname || '').trim().toLowerCase();
  const envIsLocalHost = envHost === 'localhost' || envHost === '127.0.0.1';
  if (isLocalHost && !envIsLocalHost) return true;

  const isProdHost = !isLocalHost;
  const sameHost = envHost === host;
  const port = String(parsed.port || '').trim();
  const looksLikeDevPort = port === '4000' || port === '4012' || port === '3000';
  const isMixedContent = String(location.protocol || '').toLowerCase() === 'https:' && parsed.protocol === 'http:';

  if (isProdHost && sameHost && looksLikeDevPort) return true;
  if (isProdHost && isMixedContent) return true;

  return false;
}

function resolveApiBaseUrls() {
  const candidates = [];
  const runtimeConfig = readRuntimeConfig();
  const envBaseUrl = normalizeBaseUrl(runtimeConfig?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL);
  let ignoredEnvBaseUrl = false;
  if (envBaseUrl) {
    if (typeof window !== 'undefined' && window.location) {
      if (!shouldIgnoreEnvBaseUrlInBrowser(envBaseUrl, window.location)) {
        candidates.push(envBaseUrl);
      } else {
        ignoredEnvBaseUrl = true;
      }
    } else {
      candidates.push(envBaseUrl);
    }
  }

  if ((!envBaseUrl || ignoredEnvBaseUrl) && typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, origin } = window.location;
    const host = String(hostname || '').trim().toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (origin && origin !== 'null') {
      const originUrl = normalizeBaseUrl(origin);
      if (originUrl) {
        candidates.push(`${originUrl}/api`);
        candidates.push(originUrl);
      }
    }

    if (protocol && hostname) {
      if (isLocalHost) {
        candidates.push(`${protocol}//${hostname}:4000`);
      } else if (host.startsWith('api.')) {
        candidates.push(`${protocol}//${hostname}`);
      } else {
        candidates.push(`${protocol}//${hostname}/api`);
        candidates.push(`${protocol}//api.${hostname}`);
      }
    }
  }

  if (!envBaseUrl || ignoredEnvBaseUrl) {
    candidates.push('http://localhost:4000');
  }

  return Array.from(new Set(candidates.map((v) => normalizeBaseUrl(v)).filter(Boolean)));
}

export const API_BASE_URLS = resolveApiBaseUrls();
export const API_BASE_URL = API_BASE_URLS[0] || 'http://localhost:4000';

function readRuntimeConfig() {
  try {
    if (!isWeb()) return null;
    const v = window.__AGRIX_RUNTIME_CONFIG__;
    if (!v || typeof v !== 'object') return null;
    return v;
  } catch (_err) {
    return null;
  }
}

const DEFAULT_SUPABASE_URL = 'https://bqqsirgieooyzybxbykg.supabase.co';
const RUNTIME_CONFIG = readRuntimeConfig();
const SUPABASE_URL =
  String(RUNTIME_CONFIG?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = String(RUNTIME_CONFIG?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_PROJECT_REF = 'bqqsirgieooyzybxbykg';

let supabaseBrowserClient;

function isWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getSupabaseBrowser() {
  if (!isWeb()) return null;
  if (supabaseBrowserClient) return supabaseBrowserClient;
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  supabaseBrowserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseBrowserClient;
}

function readSupabaseSessionFromLocalStorage() {
  try {
    if (!isWeb() || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`sb-${SUPABASE_PROJECT_REF}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const access_token = String(parsed?.access_token || '');
    const user = parsed?.user && typeof parsed.user === 'object' ? parsed.user : null;
    if (!access_token || !user) return null;
    return { access_token, user };
  } catch (_err) {
    return null;
  }
}

function mapSupabaseUserToPublicUser(authUser) {
  const meta = (authUser?.user_metadata && typeof authUser.user_metadata === 'object') ? authUser.user_metadata : {};
  const id = String(authUser?.id || '').trim();
  const email = String(authUser?.email || '').trim();
  return {
    _id: id,
    id,
    firstName: String(meta.firstName || meta.first_name || '').trim(),
    lastName: String(meta.lastName || meta.last_name || '').trim(),
    phone: String(authUser?.phone || meta.phone || '').trim(),
    email,
    address: String(meta.address || '').trim(),
    dateOfBirth: String(meta.dateOfBirth || meta.date_of_birth || '').trim(),
    gender: String(meta.gender || '').trim() || 'rather_not_say',
    avatarUrl: String(meta.avatarUrl || meta.avatar_url || '').trim(),
    emailVerified: Boolean(authUser?.email_confirmed_at),
    phoneVerified: Boolean(authUser?.phone_confirmed_at || meta.phoneVerified || meta.phone_verified),
    isAdmin: Boolean(meta.isAdmin || meta.is_admin),
    role: Boolean(meta.isAdmin || meta.is_admin) ? 'admin' : 'user',
  };
}

export function loadAuth() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = window.localStorage.getItem('agrix_token') || '';
      const rawUser = window.localStorage.getItem('agrix_user') || '';
      const user = rawUser ? JSON.parse(rawUser) : null;
      return { token, user };
    }
  } catch (_err) {
  }
  const fallback = readSupabaseSessionFromLocalStorage();
  if (fallback) {
    return { token: fallback.access_token, user: mapSupabaseUserToPublicUser(fallback.user) };
  }
  return { token: '', user: null };
}

function isLegacyApiToken(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload || typeof atob !== 'function') return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    const issuer = String(claims?.iss || '');
    return Boolean(claims?.sub) && !claims?.session_id && !issuer.includes('/auth/v1');
  } catch (_err) {
    return false;
  }
}

async function getAuthTokens() {
  if (isWeb()) {
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.getSession();
      const session = !error ? data?.session : null;
      const sessionToken = String(session?.access_token || '');
      const expiresAt = Number(session?.expires_at || 0) * 1000;

      if (sessionToken && (!expiresAt || expiresAt > Date.now() + 30_000)) return [sessionToken];
      if (sessionToken) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        const refreshedToken = String(refreshed?.session?.access_token || '');
        if (!refreshError && refreshedToken) return [refreshedToken];
        if (expiresAt > Date.now()) return [sessionToken];
        return [];
      }
    } catch (_err) {
    }

    // Do not send a cached Supabase JWT after Supabase has lost its session.
    // A legacy API JWT is distinguishable and remains supported during migration.
    const cachedToken = String(loadAuth()?.token || '');
    return isLegacyApiToken(cachedToken) ? [cachedToken] : [];
  }

  const cachedToken = String(loadAuth()?.token || '');
  return cachedToken ? [cachedToken] : [];
}

export async function getAuthToken() {
  return (await getAuthTokens())[0] || '';
}

async function fetchWithAuthFallback(url, options) {
  // Resolve the latest persisted Supabase session at request time so all API
  // calls (including notifications and multipart uploads) share auth headers.
  const candidates = await getAuthTokens();
  if (!candidates.length) candidates.push('');
  let response;
  for (let index = 0; index < candidates.length; index += 1) {
    const token = candidates[index];
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status !== 401) return response;
  }

  // Access tokens can expire while a browser tab is asleep. Give Supabase one
  // chance to rotate the token, then retry the same request without signing
  // the user out if refresh is unavailable or rejected.
  if (response?.status === 401 && isWeb()) {
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.auth.refreshSession();
      const refreshedToken = String(data?.session?.access_token || '');
      if (!error && refreshedToken && !candidates.includes(refreshedToken)) {
        const refreshedUser = data?.user || data?.session?.user;
        saveAuth(refreshedToken, refreshedUser ? mapSupabaseUserToPublicUser(refreshedUser) : loadAuth()?.user || null);
        response = await fetch(url, {
          ...options,
          headers: {
            ...(options?.headers || {}),
            Authorization: `Bearer ${refreshedToken}`,
          },
        });
      }
    } catch (_err) {
      // Keep the existing session and surface the original API response.
    }
  }

  return response;
}

async function requestJson(path, options) {
  let lastNetworkErr;
  let lastErr;

  for (let i = 0; i < API_BASE_URLS.length; i += 1) {
    const baseUrl = API_BASE_URLS[i];
    const hasNext = i < API_BASE_URLS.length - 1;

    let res;
    try {
      res = await fetchWithAuthFallback(`${baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
    } catch (err) {
      lastNetworkErr = err;
      lastErr = err;
      if (hasNext) continue;
      break;
    }

    const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
    const looksJson = contentType.includes('application/json');
    const data = looksJson ? await res.json().catch(() => null) : null;

    if (res.ok) {
      if (!looksJson) {
        if (hasNext) continue;
        return {};
      }
      return data ?? {};
    }

    if (!looksJson || data === null) {
      if ((res.status === 404 || res.status === 502 || res.status === 503) && hasNext) continue;
      if (res.status === 401) {
        const authError = new Error('The API rejected the request (401).');
        authError.code = 'API_AUTH_REJECTED';
        throw authError;
      }
      const message = res.status === 404 ? 'API endpoint not found' : 'Request failed';
      lastErr = new Error(message);
      throw lastErr;
    }

    const message = res.status === 401
      ? 'The API rejected the request (401).'
      : (data?.error || 'Request failed');
    const err = new Error(message);
    if (res.status === 401) {
      err.code = 'API_AUTH_REJECTED';
      if (data?.code) err.serverCode = data.code;
    }
    if (data?.fieldErrors) err.fieldErrors = data.fieldErrors;
    if (res.status !== 401 && data?.code) err.code = data.code;
    if (typeof data?.retryAfterSeconds === 'number') err.retryAfterSeconds = data.retryAfterSeconds;
    if (data?.userId) err.userId = data.userId;
    if (data?.email) err.email = data.email;
    lastErr = err;
    throw err;
  }

  if (lastNetworkErr) {
    throw new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
  }
  throw lastErr || new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
}

export function getApiJson(path) {
  return requestJson(path, { method: 'GET' });
}

export async function fetchUserNotifications() {
  return requestJson('/notifications', { method: 'GET' });
}

export async function registerUser(payload) {
  if (!isWeb()) {
    return requestJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const supabase = getSupabaseBrowser();
  const email = String(payload?.email || '').trim();
  const password = String(payload?.password || '').trim();
  await requestJson('/auth/check-registration', {
    method: 'POST',
    body: JSON.stringify({ email, phone: payload?.phone }),
  });
  const options = {
    data: {
      firstName: payload?.firstName,
      lastName: payload?.lastName,
      phone: payload?.phone,
      address: payload?.address,
      dateOfBirth: payload?.dateOfBirth,
      gender: payload?.gender,
      role: 'user',
    },
  };
  const { data, error } = await supabase.auth.signUp({ email, password, options });
  if (error) {
    const message = /already registered|already exists/i.test(String(error.message || ''))
      ? 'This email already has an account. Sign in or use password reset to recover it.'
      : error.message || 'Registration failed';
    const err = new Error(message);
    throw err;
  }

  const authUser = data?.user || null;
  const started = await requestJson('/auth/start-verification', {
    method: 'POST',
    body: JSON.stringify({ userId: String(authUser?.id || '').trim(), email, ...payload }),
  });

  try {
    await supabase.auth.signOut();
  } catch (_err) {
  }
  saveAuth('', null);

  return {
    requiresVerification: true,
    userId: started?.userId,
    email: started?.email || email,
    otpSent: started?.otpSent,
    otpError: started?.otpError,
  };
}

export async function loginUser(payload) {
  if (!isWeb()) {
    return requestJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const supabase = getSupabaseBrowser();
  const email = String(payload?.email || '').trim();
  const password = String(payload?.password || '').trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials|user not found|email not confirmed/i.test(String(error.message || ''))) {
      try {
        const fallback = await requestJson('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const token = String(fallback?.token || '');
        if (token && fallback?.user) {
          saveAuth(token, fallback.user);
          return fallback;
        }
      } catch (_fallbackError) {
      }
    }
    const msg = String(error.message || 'Sign in failed');
    const err = new Error(msg);
    if (/email not confirmed/i.test(msg)) err.code = 'EMAIL_NOT_CONFIRMED';
    throw err;
  }
  await requestJson('/auth/sync-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }).catch(() => null);
  const accessToken = String(data?.session?.access_token || '');
  const authUser = data?.user || null;
  let user = authUser ? mapSupabaseUserToPublicUser(authUser) : null;
  const profile = await requestJson('/auth/me', { method: 'GET' }).catch(() => null);
  if (profile?.user) user = profile.user;

  if (user && user.emailVerified === false) {
    const userId = String(user?._id || user?.id || authUser?.id || '').trim();
    const email = String(user?.email || authUser?.email || payload?.email || '').trim();
    const started = await requestJson('/auth/start-verification', {
      method: 'POST',
      body: JSON.stringify({ userId, email }),
    }).catch(() => null);
    try {
      await supabase.auth.signOut();
    } catch (_err) {
    }
    saveAuth('', null);
    const err = new Error('Email not verified');
    err.code = 'OTP_REQUIRED';
    err.userId = userId;
    err.email = email;
    if (started) {
      err.otpSent = started?.otpSent;
      err.otpError = started?.otpError;
    }
    throw err;
  }

  saveAuth(accessToken, user);
  return { token: accessToken, user };
}

export async function forgotPassword(payload) {
  if (!isWeb()) {
    return requestJson('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  const supabase = getSupabaseBrowser();
  const email = String(payload?.email || '').trim();
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) throw new Error(error.message || 'Failed to send reset link');
  return { ok: true };
}

export async function resetPassword(payload) {
  if (!isWeb()) {
    return requestJson('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  const supabase = getSupabaseBrowser();
  const password = String(payload?.password || '').trim();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message || 'Failed to reset password');
  await requestJson('/auth/sync-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }).catch(() => null);
  const accessToken = String((await supabase.auth.getSession())?.data?.session?.access_token || '');
  const user = data?.user ? mapSupabaseUserToPublicUser(data.user) : loadAuth().user;
  saveAuth(accessToken, user);
  return { token: accessToken, user };
}

export async function verifyRegistration(payload) {
  if (!isWeb()) {
    return requestJson('/auth/verify-registration', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  return requestJson('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendVerification(payload) {
  if (!isWeb()) {
    return requestJson('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  return requestJson('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe() {
  try {
    return await requestJson('/auth/me', { method: 'GET' });
  } catch (err) {
    if (isWeb() && err?.code === 'API_AUTH_REJECTED') {
      await clearAuth();
      throw err;
    }
    const message = String(err?.message || '');
    if (isWeb() && message.startsWith('Cannot reach API')) {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const mapped = mapSupabaseUserToPublicUser(data.user);
          const cached = loadAuth()?.user || {};
          for (const key of ['firstName', 'lastName', 'phone', 'email', 'address', 'dateOfBirth', 'gender', 'avatarUrl']) {
            if (!mapped[key]) mapped[key] = cached[key] || '';
          }
          return { user: { ...cached, ...mapped } };
        }
      } catch (_err) {
      }
      const cached = loadAuth()?.user;
      if (cached) return { user: cached };
    }
    throw err;
  }
}

export async function updateMe(payload) {
  try {
    return await requestJson('/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = String(err?.message || '');
    let directUpdateError = null;
    if (isWeb() && (message.startsWith('Cannot reach API') || err?.code === 'API_AUTH_REJECTED')) {
      try {
        const supabase = getSupabaseBrowser();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.access_token) throw err;
        const currentMeta = sessionData.session.user?.user_metadata || {};
        const nextMeta = { ...currentMeta };
        const dbUpdate = { updatedAt: new Date().toISOString() };
        for (const key of ['firstName', 'lastName', 'address', 'dateOfBirth', 'gender']) {
          if (Object.prototype.hasOwnProperty.call(payload || {}, key)) {
            nextMeta[key] = String(payload[key] ?? '').trim();
            dbUpdate[key] = nextMeta[key];
          }
        }
        const profileEmail = String(sessionData.session.user?.email || '').trim();
        if (profileEmail) {
          // Keep the application profile row in sync when its RLS policy allows
          // the signed-in user to update their own record.
          await supabase.from('users').update(dbUpdate).ilike('email', profileEmail);
        }
        const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
        if (error) throw new Error(String(error?.message || 'Failed to update profile'));
        if (data?.user) {
          const user = { ...(loadAuth()?.user || {}), ...mapSupabaseUserToPublicUser(data.user) };
          saveAuth(sessionData.session.access_token, user);
          return { user };
        }
        const refreshed = await supabase.auth.getUser();
        if (refreshed?.data?.user) {
          const user = { ...(loadAuth()?.user || {}), ...mapSupabaseUserToPublicUser(refreshed.data.user) };
          saveAuth(sessionData.session.access_token, user);
          return { user };
        }
      } catch (fallbackError) {
        directUpdateError = fallbackError;
      }
    }
    throw directUpdateError || err;
  }
}

export async function requestUpdateOtp(payload) {
  try {
    return await requestJson('/users/me/request-update', { method: 'POST', body: JSON.stringify(payload) });
  } catch (err) {
    if (!isWeb() || (err?.code !== 'API_AUTH_REJECTED' && !String(err?.message || '').startsWith('Cannot reach API'))) throw err;
    const supabase = getSupabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) throw err;
    const type = String(payload?.type || '');
    const value = String(payload?.value || '').trim();
    if (type === 'email') {
      const { error } = await supabase.auth.updateUser({ email: value });
      if (error) throw new Error(error.message || 'Could not request email verification');
    } else if (type === 'phone') {
      const { error } = await supabase.auth.updateUser({ phone: value });
      if (error) throw new Error(error.message || 'Could not request phone verification');
    } else throw err;
    pendingSupabaseProfileUpdate = { type, value };
    return { ok: true, otpSent: true };
  }
}

let pendingSupabaseProfileUpdate = null;


export async function verifyUpdateOtp(payload) {
  try {
    return await requestJson('/users/me/verify-update', { method: 'POST', body: JSON.stringify(payload) });
  } catch (err) {
    if (!isWeb() || !pendingSupabaseProfileUpdate || (err?.code !== 'API_AUTH_REJECTED' && !String(err?.message || '').startsWith('Cannot reach API'))) throw err;
    const supabase = getSupabaseBrowser();
    const { type, value } = pendingSupabaseProfileUpdate;
    const { data, error } = await supabase.auth.verifyOtp({
      [type]: value,
      token: String(payload?.otp || ''),
      type: type === 'email' ? 'email_change' : 'phone_change',
    });
    if (error) throw new Error(error.message || 'Verification failed');
    const authUser = data?.user || (await supabase.auth.getUser()).data?.user;
    if (!authUser) throw new Error('Verification completed, but the updated profile could not be loaded');
    pendingSupabaseProfileUpdate = null;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = { ...(loadAuth()?.user || {}), ...mapSupabaseUserToPublicUser(authUser) };
    if (sessionData?.session?.access_token) saveAuth(sessionData.session.access_token, user);
    return { user };
  }
}

async function getFreshUploadTokens() {
  if (!isWeb()) return getAuthTokens();

  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.getSession();
  const session = !error ? data?.session : null;
  const token = String(session?.access_token || '');
  const expiresAt = Number(session?.expires_at || 0) * 1000;

  // Refresh before starting the upload if the session token is expired or
  // about to expire. Do not clear the user's session if refresh fails.
  if (token && (!expiresAt || expiresAt > Date.now() + 30_000)) return [token];

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedToken = String(refreshed?.session?.access_token || '');
  if (!refreshError && refreshedToken) return [refreshedToken];
  const cachedToken = String(loadAuth()?.token || '');
  return isLegacyApiToken(cachedToken) ? [cachedToken] : [];
}

async function uploadAvatarDirectToSupabase(file, filename) {
  const supabase = getSupabaseBrowser();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Your Supabase session is unavailable. The profile photo was not uploaded.');
  }
  const authUser = sessionData.session.user;
  if (!authUser?.id) throw new Error('Your Supabase session has no user ID.');

  const rawExt = String(filename || '').split('.').pop() || '';
  const safeExt = rawExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || (String(file?.type || '').includes('png') ? 'png' : 'jpg');
  const objectPath = `${authUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const bucket = supabase.storage.from('avatars');
  const { error: uploadErr } = await bucket.upload(objectPath, file, {
    upsert: true,
    contentType: String(file?.type || '') || undefined,
    cacheControl: '3600',
  });
  if (uploadErr) throw new Error(`Supabase photo upload failed: ${uploadErr.message || 'Storage rejected the upload'}`);

  let avatarUrl = '';
  const { data: publicData } = bucket.getPublicUrl(objectPath);
  avatarUrl = String(publicData?.publicUrl || '').trim();
  if (!avatarUrl) {
    const { data: signedData, error: signedError } = await bucket.createSignedUrl(objectPath, 60 * 60 * 24 * 365);
    if (signedError) throw new Error(`Photo uploaded, but its URL could not be created: ${signedError.message}`);
    avatarUrl = String(signedData?.signedUrl || '').trim();
  }
  if (!avatarUrl) throw new Error('Photo uploaded, but Supabase did not return an image URL.');

  const { data: updated, error: updateError } = await supabase.auth.updateUser({ data: { avatarUrl } });
  if (updateError) throw new Error(`Photo uploaded, but the profile could not be updated: ${updateError.message}`);
  const user = updated?.user || (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Photo uploaded, but the updated profile could not be loaded.');
  if (user.email) {
    // The backend normally updates this row. Mirror that behavior for the
    // direct Storage fallback when the user's table policy permits it.
    await supabase.from('users').update({ avatarUrl, updatedAt: new Date().toISOString() }).ilike('email', user.email);
  }
  saveAuth(sessionData.session.access_token, { ...(loadAuth()?.user || {}), ...mapSupabaseUserToPublicUser(user) });
  return { user: { ...(loadAuth()?.user || {}), ...mapSupabaseUserToPublicUser(user) } };
}

export async function uploadAvatar(file) {
  if (!file) {
    throw new Error('Select an image to upload');
  }
  const formData = new FormData();
  const filename =
    typeof file?.name === 'string' && file.name.trim()
      ? file.name.trim()
      : `avatar.${String(file?.type || '').includes('png') ? 'png' : 'jpg'}`;
  try {
    formData.append('avatar', file, filename);
  } catch (_err) {
    formData.append('avatar', file);
  }
  let lastNetworkErr;
  let lastErr;

  for (let i = 0; i < API_BASE_URLS.length; i += 1) {
    const baseUrl = API_BASE_URLS[i];
    const hasNext = i < API_BASE_URLS.length - 1;

    let res;
    try {
      // Read the active Supabase session immediately before each upload fetch
      // so this multipart request uses the latest access token.
      const tokens = await getFreshUploadTokens();
      if (!tokens.length) {
        const authError = new Error('A current Supabase session is required to upload a profile photo.');
        authError.code = 'API_AUTH_REJECTED';
        throw authError;
      }
      res = await fetchWithAuthFallback(`${baseUrl}/users/me/avatar`, {
        method: 'POST',
        headers: {},
        body: formData,
      });
    } catch (err) {
      if (err?.code === 'API_AUTH_REJECTED') throw err;
      lastNetworkErr = err;
      lastErr = err;
      if (hasNext) continue;
      break;
    }

    const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
    const looksJson = contentType.includes('application/json');
    const data = looksJson ? await res.json().catch(() => null) : null;

    if (res.ok) {
      if (!looksJson) {
        if (hasNext) continue;
        return {};
      }
      return data ?? {};
    }

    if (!looksJson || data === null) {
      if ((res.status === 404 || res.status === 502 || res.status === 503) && hasNext) continue;
      if (res.status === 401) {
        try {
          return await uploadAvatarDirectToSupabase(file, filename);
        } catch (fallbackError) {
          const authError = new Error(`Profile API rejected the request (401), and direct Supabase photo upload failed: ${fallbackError?.message || 'unknown error'}`);
          authError.code = 'API_AUTH_REJECTED';
          throw authError;
        }
      }
      const message = res.status === 404 ? 'API endpoint not found' : 'Upload failed';
      lastErr = new Error(message);
      throw lastErr;
    }

    const message = res.status === 401
      ? 'The API rejected the login token (401).'
      : (data?.error || 'Upload failed');
    if (res.status === 401) {
      try {
        return await uploadAvatarDirectToSupabase(file, filename);
      } catch (fallbackError) {
        throw new Error(`Profile API rejected the request (401), and direct Supabase photo upload failed: ${fallbackError?.message || 'unknown error'}`);
      }
    }
    lastErr = new Error(message);
    if (res.status === 401) lastErr.code = 'API_AUTH_REJECTED';
    throw lastErr;
  }

  if (lastNetworkErr) {
    if (isWeb()) {
      try {
        return await uploadAvatarDirectToSupabase(file, filename);
      } catch (_err3) {
        lastErr = _err3;
      }
    }
    if (lastErr && String(lastErr.message || '').startsWith('Supabase')) throw lastErr;
    throw new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
  }
  throw lastErr || new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
}

export function saveAuth(token, user) {
  let previousId = '';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const previous = JSON.parse(window.localStorage.getItem('agrix_user') || 'null');
      previousId = String(previous?.id || previous?._id || '');
      window.localStorage.setItem('agrix_token', token);
      window.localStorage.setItem('agrix_user', JSON.stringify(user));
      const nextId = String(user?.id || user?._id || '');
      if (previousId !== nextId) window.dispatchEvent(new CustomEvent('agrix:auth', { detail: { userId: nextId } }));
    }
  } catch (_err) {
  }
}

export async function clearAuth() {
  let hadUser = false;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('agrix_token');
      hadUser = Boolean(window.localStorage.getItem('agrix_user'));
      window.localStorage.removeItem('agrix_user');
      if (hadUser) window.dispatchEvent(new CustomEvent('agrix:auth', { detail: { userId: '' } }));
    }
  } catch (_err) {
  }
  // Clear local app state immediately, then revoke the Supabase session.
  // This prevents repeated inactivity checks from racing a slow signOut call.
  if (isWeb()) {
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
    } catch (_err) {
    }
  }
}

export function startWebAuthSync() {
  if (!isWeb()) return () => {};
  const supabase = getSupabaseBrowser();

  const hydrateProfile = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const data = await requestJson('/auth/me', { method: 'GET' }).catch(() => null);
      if (!data?.user) return;
      if (data.user.emailVerified === false) {
        try {
          await supabase.auth.signOut();
        } catch (_err) {
        }
        saveAuth('', null);
        return;
      }
      saveAuth(token, data.user);
    } catch (_err) {
    }
  };

  supabase.auth
    .getSession()
    .then(({ data }) => {
      const session = data?.session || null;
      if (!session) return;
      const token = String(session.access_token || '');
      const user = session.user ? mapSupabaseUserToPublicUser(session.user) : null;
      if (token) saveAuth(token, user);
      hydrateProfile();
    })
    .catch(() => {});

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      saveAuth('', null);
      return;
    }
    const token = String(session.access_token || '');
    const user = session.user ? mapSupabaseUserToPublicUser(session.user) : null;
    saveAuth(token, user);
    hydrateProfile();
  });

  return () => {
    try {
      sub?.subscription?.unsubscribe?.();
    } catch (_err) {
    }
  };
}
