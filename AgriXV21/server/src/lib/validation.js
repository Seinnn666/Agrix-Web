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

export function validateName(value, label) {
  const name = normalizeSpaces(value);
  if (!name) return `${label} is required`;
  if (name.length < 2) return `${label} must be at least 2 characters`;
  if (name.length > 35) return `${label} must be 35 characters or less`;
  return isValidName(name) ? null : `${label} is invalid`;
}

function dateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validateDateOfBirth(value, now = new Date()) {
  const raw = String(value || '').trim();
  if (!raw) return 'Date of birth is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'Date of birth is invalid';
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return 'Date of birth is invalid';
  }
  const today = dateString(now);
  if (raw > today) return 'Date of birth cannot be in the future';
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  if (age < 18) return 'You must be at least 18 years old';
  return null;
}

export function validateRegistrationPhone(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '+63') return 'Phone number is required';
  const digits = raw.replace(/\D/g, '');
  const local = raw.startsWith('+63') ? `0${digits.slice(2)}` : digits;
  if (raw.startsWith('+63') || local.startsWith('09')) {
    if (local.length !== 11 || !/^09\d{9}$/.test(local)) {
      return `Phone number must be 11 digits (you entered ${local.length})`;
    }
  }
  return isValidPhone(raw) ? null : 'Phone number is invalid';
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

