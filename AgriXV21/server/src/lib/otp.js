import crypto from 'crypto';

export function generateOtpCode() {
  const num = crypto.randomInt(0, 1000000);
  return String(num).padStart(6, '0');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export function isResetTokenValid(token, storedHash, expiresAt, now = Date.now()) {
  const expected = String(storedHash || '');
  const expiry = new Date(expiresAt || 0).getTime();
  if (!token || !/^[a-f0-9]{64}$/i.test(expected) || !Number.isFinite(expiry) || expiry <= now) return false;
  const actual = Buffer.from(hashCode(token), 'hex');
  const stored = Buffer.from(expected, 'hex');
  return actual.length === stored.length && crypto.timingSafeEqual(actual, stored);
}

export function generateSecureToken(bytes = 32) {
  const size = Number(bytes);
  const safeSize = Number.isFinite(size) && size >= 16 && size <= 64 ? size : 32;
  return crypto.randomBytes(safeSize).toString('hex');
}

