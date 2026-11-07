import { parseBool } from './supabaseMaps.js';
import { hashCode } from './otp.js';
import { isValidEmail, normalizeEmail } from './validation.js';

export function requiresEmailVerification(user) {
  return !parseBool(user?.isAdmin) && !parseBool(user?.emailVerified);
}

export function emailNotVerifiedBody(email) {
  const normalizedEmail = normalizeEmail(email);
  return {
    error: 'Email not verified',
    code: 'EMAIL_NOT_VERIFIED',
    ...(isValidEmail(normalizedEmail) ? { email: normalizedEmail } : {}),
  };
}

export async function findVerificationUser(supabase, userId, email) {
  const id = String(userId || '').trim();
  const em = normalizeEmail(email);
  if (id) {
    const byId = await supabase.from('users').select('*').eq('_id', id).maybeSingle();
    if (byId.error || byId.data) return byId;
  }
  if (isValidEmail(em)) return supabase.from('users').select('*').ilike('email', em).maybeSingle();
  return { data: null, error: null };
}

export function hasOtpIdentifier(userId, email) {
  return Boolean(String(userId || '').trim()) || isValidEmail(normalizeEmail(email));
}

export function isEmailOtpValid(user, code) {
  const storedHash = user?.['emailVerification.codeHash'] ?? user?.emailVerification?.codeHash ?? '';
  return /^\d{6}$/.test(String(code || '').trim())
    && Boolean(storedHash)
    && String(storedHash) === hashCode(String(code).trim());
}

export function invalidOtpBody() {
  return { error: 'Invalid or expired code', code: 'OTP_INVALID' };
}
