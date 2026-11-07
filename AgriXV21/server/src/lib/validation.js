export function normalizeSpaces(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAllowedRegistrationEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return false;
  const domain = email.split('@')[1] || '';
  return domain === 'gmail.com' || domain === 'yahoo.com' || domain === 'outlook.com';
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidActiveEmail(value) {
  const email = normalizeEmail(value);
  if (!isValidEmail(email)) return false;
  const domain = email.split('@')[1] || '';
  const blockedDomains = ['example.com', 'test.com', 'sample.com', 'domain.com'];
  return !blockedDomains.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

export function isValidName(value) {
  const v = normalizeSpaces(value);
  if (!v) return false;
  if (v.length < 2 || v.length > 35) return false;
  return /^[a-zA-Z][a-zA-Z\s'-]*$/.test(v);
}

export function normalizePhone(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const cleaned = v.replace(/[\s()-]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  if (/^09\d{9}$/.test(digits)) {
    return `+63${digits.slice(1)}`;
  }
  if (/^9\d{9}$/.test(digits)) {
    return `+63${digits}`;
  }

  return digits;
}

export function isValidPhone(value) {
  const v = normalizePhone(value);
  if (!v) return true;
  if (v.startsWith('+63')) {
    return /^\+639\d{9}$/.test(v);
  }
  if (v.startsWith('+1')) {
    return /^\+1\d{10}$/.test(v);
  }
  if (v.startsWith('+44')) {
    return /^\+44\d{10,11}$/.test(v);
  }
  if (v.startsWith('+91')) {
    return /^\+91[6-9]\d{9}$/.test(v);
  }
  if (v.startsWith('+61')) {
    return /^\+614\d{8}$/.test(v);
  }
  if (v.startsWith('+')) {
    return /^\+\d{7,15}$/.test(v);
  }
  return false;
}

export function validatePassword(value) {
  const v = String(value || '');
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (v.length > 72) return 'Password must be 72 characters or less';
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Password must include letters and numbers';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Password must include at least one special character';
  return null;
}

