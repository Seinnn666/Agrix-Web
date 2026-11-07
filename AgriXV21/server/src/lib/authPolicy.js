import { parseBool } from './supabaseMaps.js';

export function requiresEmailVerification(user) {
  return !parseBool(user?.isAdmin) && !parseBool(user?.emailVerified);
}

export function emailNotVerifiedBody() {
  return { error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' };
}
