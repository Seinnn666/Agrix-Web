import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function resolveSupabaseUrl() {
  const v = String(process.env.SUPABASE_URL || '').trim();
  if (v) return v;
  return 'https://bqqsirgieooyzybxbykg.supabase.co';
}

function resolveSupabaseKey() {
  const secret = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  if (secret) return secret;
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (service) return service;
  const anon = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (anon) return anon;
  return '';
}

let supabaseAdmin;
let supabaseAuthVerifier;

export function getSupabaseAuthVerifier() {
  if (supabaseAuthVerifier) return supabaseAuthVerifier;
  const url = resolveSupabaseUrl();
  const key = String(process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  if (!key) {
    throw new Error('Missing SUPABASE_ANON_KEY for access-token verification');
  }
  supabaseAuthVerifier = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabaseAuthVerifier;
}

export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseKey();
  if (!key) {
    throw new Error('Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  }
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabaseAdmin;
}

export function newObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

export async function checkDb() {
  const url = resolveSupabaseUrl().replace(/\/$/, '');
  const key = resolveSupabaseKey();
  if (!key) throw new Error('Missing Supabase server key');

  let response;
  try {
    response = await fetch(`${url}/rest/v1/users?select=_id&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  } catch (error) {
    const networkError = new Error(error?.message || 'Cannot reach Supabase');
    networkError.code = error?.cause?.code || error?.code;
    networkError.details = error?.cause?.message || '';
    throw networkError;
  }

  if (!response.ok) {
    const bodyText = await response.text();
    let body = {};
    try {
      body = JSON.parse(bodyText);
    } catch (_error) {
      body = {};
    }
    const databaseError = new Error(body.message || body.msg || `Supabase request failed (HTTP ${response.status})`);
    databaseError.code = body.code || `HTTP_${response.status}`;
    databaseError.hint = body.hint;
    databaseError.details = body.details || bodyText;
    throw databaseError;
  }
}
