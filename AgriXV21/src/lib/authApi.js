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
    phone: String(meta.phone || '').trim(),
    email,
    address: String(meta.address || '').trim(),
    dateOfBirth: String(meta.dateOfBirth || meta.date_of_birth || '').trim(),
    gender: String(meta.gender || '').trim() || 'rather_not_say',
    avatarUrl: String(meta.avatarUrl || meta.avatar_url || '').trim(),
    emailVerified: Boolean(authUser?.email_confirmed_at),
    phoneVerified: Boolean(meta.phoneVerified || meta.phone_verified),
    isAdmin: Boolean(meta.isAdmin || meta.is_admin),
    role: String(meta.role || '').trim() || 'farmer',
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

export async function getAuthToken() {
  if (!isWeb()) {
    const { token } = loadAuth();
    return token;
  }
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase.auth.getSession();
  if (error) return '';
  const token = String(data?.session?.access_token || '');
  return token;
}

async function requestJson(path, options) {
  const token = await getAuthToken();
  let lastNetworkErr;
  let lastErr;

  for (let i = 0; i < API_BASE_URLS.length; i += 1) {
    const baseUrl = API_BASE_URLS[i];
    const hasNext = i < API_BASE_URLS.length - 1;

    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers || {}),
        },
        ...options,
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
      const message = res.status === 404 ? 'API endpoint not found' : 'Request failed';
      lastErr = new Error(message);
      throw lastErr;
    }

    const message = data?.error || 'Request failed';
    const err = new Error(message);
    if (data?.fieldErrors) err.fieldErrors = data.fieldErrors;
    if (data?.code) err.code = data.code;
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
  const options = {
    data: {
      firstName: payload?.firstName,
      lastName: payload?.lastName,
      phone: payload?.phone,
      address: payload?.address,
      dateOfBirth: payload?.dateOfBirth,
      gender: payload?.gender,
      role: payload?.role || 'farmer',
    },
  };
  const { data, error } = await supabase.auth.signUp({ email, password, options });
  if (error) {
    const err = new Error(error.message || 'Registration failed');
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
    const message = String(err?.message || '');
    if (isWeb() && message.startsWith('Cannot reach API')) {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (data?.user) return { user: mapSupabaseUserToPublicUser(data.user) };
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
    if (isWeb() && message.startsWith('Cannot reach API')) {
      const nextMeta = {
        firstName: String(payload?.firstName || '').trim(),
        lastName: String(payload?.lastName || '').trim(),
        address: String(payload?.address || '').trim(),
        dateOfBirth: String(payload?.dateOfBirth || '').trim(),
        gender: String(payload?.gender || '').trim(),
      };
      try {
        const supabase = getSupabaseBrowser();
        const { data, error } = await supabase.auth.updateUser({ data: nextMeta });
        if (error) throw new Error(String(error?.message || 'Failed to update profile'));
        if (data?.user) return { user: mapSupabaseUserToPublicUser(data.user) };
        const refreshed = await supabase.auth.getUser();
        if (refreshed?.data?.user) return { user: mapSupabaseUserToPublicUser(refreshed.data.user) };
      } catch (_err) {
      }
    }
    throw err;
  }
}

export async function requestUpdateOtp(payload) {
  return requestJson('/users/me/request-update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyUpdateOtp(payload) {
  return requestJson('/users/me/verify-update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(file) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Unauthorized');
  }
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
      res = await fetch(`${baseUrl}/users/me/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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
      const message = res.status === 404 ? 'API endpoint not found' : 'Upload failed';
      lastErr = new Error(message);
      throw lastErr;
    }

    const message = data?.error || 'Upload failed';
    lastErr = new Error(message);
    throw lastErr;
  }

  if (lastNetworkErr) {
    if (isWeb()) {
      try {
        const supabase = getSupabaseBrowser();
        const { data: userData } = await supabase.auth.getUser();
        const authUser = userData?.user;
        if (!authUser) throw new Error('Unauthorized');

        const rawExt = String(filename || '').split('.').pop() || '';
        const safeExt = rawExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || (String(file?.type || '').includes('png') ? 'png' : 'jpg');
        const objectPath = `${String(authUser.id || 'user')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

        const bucket = supabase.storage.from('avatars');
        const { error: uploadErr } = await bucket.upload(objectPath, file, {
          upsert: true,
          contentType: String(file?.type || '') || undefined,
          cacheControl: '3600',
        });
        if (uploadErr) throw new Error(String(uploadErr?.message || 'Upload failed'));

        let publicUrl = '';
        try {
          const { data } = bucket.getPublicUrl(objectPath);
          publicUrl = String(data?.publicUrl || '').trim();
        } catch (_err2) {
        }
        if (!publicUrl) {
          const { data: signed, error: signedErr } = await bucket.createSignedUrl(objectPath, 60 * 60 * 24 * 365);
          if (signedErr) throw new Error(String(signedErr?.message || 'Upload failed'));
          publicUrl = String(signed?.signedUrl || '').trim();
        }
        if (!publicUrl) throw new Error('Upload failed');

        const { data: updated, error: updateErr } = await supabase.auth.updateUser({ data: { avatarUrl: publicUrl } });
        if (updateErr) throw new Error(String(updateErr?.message || 'Failed to update profile'));
        if (updated?.user) return { user: mapSupabaseUserToPublicUser(updated.user) };

        const refreshed = await supabase.auth.getUser();
        if (refreshed?.data?.user) return { user: mapSupabaseUserToPublicUser(refreshed.data.user) };
      } catch (_err3) {
      }
    }
    throw new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
  }
  throw lastErr || new Error(`Cannot reach API. Tried: ${API_BASE_URLS.join(', ')}`);
}

export function saveAuth(token, user) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('agrix_token', token);
      window.localStorage.setItem('agrix_user', JSON.stringify(user));
    }
  } catch (_err) {
  }
}

export async function clearAuth() {
  if (isWeb()) {
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
    } catch (_err) {
    }
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('agrix_token');
      window.localStorage.removeItem('agrix_user');
    }
  } catch (_err) {
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
