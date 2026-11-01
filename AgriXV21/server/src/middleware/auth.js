import jwt from 'jsonwebtoken';
import { getSupabaseAdmin, getSupabaseAuthVerifier } from '../lib/db.js';

const AUTH_LOG_WINDOW_MS = 30_000;
const lastAuthLogAt = new Map();

function logAuthRejection(reason) {
  const now = Date.now();
  const category = String(reason).split(':', 1)[0];
  const previous = lastAuthLogAt.get(category) || 0;
  if (now - previous < AUTH_LOG_WINDOW_MS) return;
  lastAuthLogAt.set(category, now);
  console.warn(`[auth] ${reason}`);
}

function logBearerHeaderReceived() {
  const now = Date.now();
  const previous = lastAuthLogAt.get('Bearer header received') || 0;
  if (now - previous < AUTH_LOG_WINDOW_MS) return;
  lastAuthLogAt.set('Bearer header received', now);
  // Never print the token itself; it is a credential that grants account access.
  console.info('[auth] Bearer authorization header received (token redacted)');
}

export async function requireAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '').trim();
    const match = header.match(/^Bearer\s+([^\s]+)$/i);
    const token = match?.[1] || '';
    if (!token) {
      logAuthRejection('Rejected request: missing or malformed bearer token');
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
    logBearerHeaderReceived();

    if (process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.sub ? String(decoded.sub) : '';
        if (userId) {
          req.user = decoded;
          req.userId = userId;
          req.authType = 'legacy';
          return next();
        }
      } catch (_err) {
      }
    }

    const verifier = getSupabaseAuthVerifier();
    const { data, error } = await verifier.auth.getUser(token);
    const authUser = data?.user || null;
    if (error || !authUser?.id) {
      logAuthRejection(`Supabase rejected bearer token: ${error?.message || 'user not found'}`);
      return res.status(401).json({ error: 'Invalid or expired login session', code: 'AUTH_INVALID' });
    }
    req.user = authUser;
    req.authUser = authUser;
    req.authType = 'supabase';
    req.authUserId = String(authUser.id);

    const supabase = getSupabaseAdmin();
    const email = String(authUser.email || '').trim().toLowerCase();
    if (email) {
      const { data: row } = await supabase.from('users').select('_id').ilike('email', email).maybeSingle();
      if (row?._id) {
        req.userId = String(row._id);
        return next();
      }
    }

    req.userId = String(authUser.id);
    req.authUser = authUser;
    req.authType = 'supabase';
    return next();
  } catch (err) {
    logAuthRejection(`Authentication middleware failed: ${err?.message || 'unknown error'}`);
    return res.status(401).json({ error: 'Unable to verify login session', code: 'AUTH_INVALID' });
  }
}

