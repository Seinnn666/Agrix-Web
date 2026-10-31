import crypto from 'crypto';

export function generateOtpCode() {
  const num = crypto.randomInt(0, 1000000);
  return String(num).padStart(6, '0');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export function generateSecureToken(bytes = 32) {
  const size = Number(bytes);
  const safeSize = Number.isFinite(size) && size >= 16 && size <= 64 ? size : 32;
  return crypto.randomBytes(safeSize).toString('hex');
}

