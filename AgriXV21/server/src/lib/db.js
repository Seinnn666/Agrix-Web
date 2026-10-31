import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function resolveSupabaseUrl() {
  const v = String(process.env.SUPABASE_URL || '').trim();
  if (v) return v;
  return 'https://bqqsirgieooyzybxbykg.supabase.co';
}

function resolveSupabaseKey() {
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (service) return service;
  const anon = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (anon) return anon;
  return '';
}

let supabaseAdmin;

export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseKey();
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
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
  const client = getSupabaseAdmin();
  const { error } = await client.from('users').select('_id', { head: true, count: 'exact' }).limit(1);
  if (error) {
    const err = new Error(error.message || 'Supabase query failed');
    err.details = error;
    throw err;
  }
}
