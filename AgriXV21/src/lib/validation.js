function normalizeSpaces(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function validateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const ok = normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
  return { ok, value: normalized };
}

const BLOCKED_EMAIL_DOMAINS = ['example.com', 'test.com', 'sample.com', 'domain.com'];
const PLACEHOLDER_EMAIL_MESSAGE = 'Please enter a valid, active email address (placeholder emails are not allowed).';

export function validateActiveEmail(email) {
  const base = validateEmail(email);
  if (!base.ok) return { ok: false, value: base.value, message: 'Enter a valid email address' };
  const domain = base.value.split('@')[1] || '';
  const isPlaceholder = BLOCKED_EMAIL_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
  return isPlaceholder
    ? { ok: false, value: base.value, message: PLACEHOLDER_EMAIL_MESSAGE }
    : { ok: true, value: base.value };
}

export function validateRegistrationEmail(email) {
  const base = validateActiveEmail(email);
  if (!base.ok) return base;
  const domain = base.value.split('@')[1] || '';
  const allowed = new Set(['gmail.com', 'yahoo.com', 'outlook.com']);
  if (!allowed.has(domain)) {
    return { ok: false, value: base.value, message: 'Use a Gmail, Yahoo, or Outlook email address' };
  }
  return { ok: true, value: base.value };
}

export function validateName(name, label) {
  const value = normalizeSpaces(name);
  if (!value) {
    return { ok: false, value, message: `${label} is required` };
  }
  if (value.length < 2) {
    return { ok: false, value, message: `${label} must be at least 2 characters` };
  }
  if (value.length > 35) {
    return { ok: false, value, message: `${label} must be 35 characters or less` };
  }
  if (/\d/.test(value) || /[\u0000-\u001F\u007F]/.test(value)) {
    return { ok: false, value, message: `${label} contains unsupported characters` };
  }
  // Relaxed validation: allow any printable characters, not just English letters
  // Just check it doesn't contain mostly special symbols if needed, but for now length is enough safety
  return { ok: true, value };
}

export function validateAddress(address) {
  const value = normalizeSpaces(address);
  if (!value) return { ok: false, value, message: 'Address is required' };
  if (value.length < 5) return { ok: false, value, message: 'Address must be at least 5 characters' };
  if (value.length > 160) return { ok: false, value, message: 'Address must be 160 characters or less' };
  return { ok: true, value };
}

export function validateDateOfBirth(value, now = new Date()) {
  const raw = String(value || '').trim();
  if (!raw) return { ok: false, value: '', message: 'Date of birth is required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, value: raw, message: 'Date of birth is invalid' };
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return { ok: false, value: raw, message: 'Date of birth is invalid' };
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (raw > today) return { ok: false, value: raw, message: 'Date of birth cannot be in the future' };

  // Compare calendar components so a date-only value is not shifted by timezone offsets.
  const [year, month, day] = raw.split('-').map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  if (age < 18) {
    return { ok: false, value: raw, message: 'You must be at least 18 years old' };
  }

  return { ok: true, value: raw };
}

export function validateGender(value) {
  const v = String(value || '').trim().toLowerCase();
  const allowed = new Set(['male', 'female', 'rather_not_say']);
  if (!allowed.has(v)) return { ok: false, value: v, message: 'Gender is invalid' };
  return { ok: true, value: v };
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCountryCode(countryCode) {
  const cc = String(countryCode || '').trim();
  if (!cc) return '';
  if (cc.startsWith('+')) return `+${normalizeDigits(cc)}`;
  return `+${normalizeDigits(cc)}`;
}

export function getPhoneRules(countryCode) {
  const cc = normalizeCountryCode(countryCode);
  if (cc === '+63') {
    return {
      countryCode: '+63',
      placeholder: '09xxxxxxxxx',
      maxLength: 11,
      validateLocal: (digits) => /^09\d{9}$/.test(digits),
      toE164: (digits) => `+63${digits.slice(1)}`,
      message: 'For Philippines, enter an 11-digit mobile number starting with 09',
    };
  }
  if (cc === '+1') {
    return {
      countryCode: '+1',
      placeholder: '5551234567',
      maxLength: 10,
      validateLocal: (digits) => /^\d{10}$/.test(digits),
      toE164: (digits) => `+1${digits}`,
      message: 'Enter a 10-digit phone number',
    };
  }
  if (cc === '+44') {
    return {
      countryCode: '+44',
      placeholder: '07xxxxxxxxx',
      maxLength: 11,
      validateLocal: (digits) => /^0?\d{10}$/.test(digits),
      toE164: (digits) => `+44${digits.replace(/^0+/, '')}`,
      message: 'For United Kingdom, enter a valid phone number (10–11 digits, optional leading 0)',
    };
  }
  if (cc === '+91') {
    return {
      countryCode: '+91',
      placeholder: '9xxxxxxxxx',
      maxLength: 10,
      validateLocal: (digits) => /^[6-9]\d{9}$/.test(digits),
      toE164: (digits) => `+91${digits}`,
      message: 'For India, enter a 10-digit mobile number starting with 6–9',
    };
  }
  if (cc === '+61') {
    return {
      countryCode: '+61',
      placeholder: '04xxxxxxxx',
      maxLength: 10,
      validateLocal: (digits) => /^0?4\d{8}$/.test(digits),
      toE164: (digits) => `+61${digits.replace(/^0+/, '')}`,
      message: 'For Australia, enter a valid mobile number (starts with 04, 9–10 digits)',
    };
  }

  return {
    countryCode: cc,
    placeholder: 'Phone number',
    maxLength: 15,
    validateLocal: (digits) => /^\d{7,15}$/.test(digits),
    toE164: (digits) => (cc ? `${cc}${digits}` : digits),
    message: 'Phone number is invalid',
  };
}

export function normalizePhoneInput(countryCode, phoneNumber) {
  const rules = getPhoneRules(countryCode);
  const local = normalizeDigits(phoneNumber);
  return {
    countryCode: rules.countryCode,
    local,
    e164: rules.toE164(local),
  };
}

export function buildE164Phone(countryCode, phoneNumber) {
  const { e164 } = normalizePhoneInput(countryCode, phoneNumber);
  return e164;
}

export function validatePhoneE164(phoneE164, { required, countryCode, phoneNumber } = {}) {
  const value = String(phoneE164 || '').trim();
  const local = normalizeDigits(phoneNumber);
  if (countryCode && !local) {
    return required
      ? { ok: false, value: '', message: 'Phone number is required' }
      : { ok: true, value: '' };
  }
  if (!value) {
    return required
      ? { ok: false, value: '', message: 'Phone number is required' }
      : { ok: true, value: '' };
  }

  if (countryCode) {
    const rules = getPhoneRules(countryCode);
    if (rules.countryCode === '+63' && local.length !== 11) {
      return { ok: false, value, message: `Phone number must be 11 digits (you entered ${local.length})` };
    }
    if (!rules.validateLocal(local)) {
      return { ok: false, value, message: rules.message };
    }
    const normalized = normalizePhoneInput(countryCode, phoneNumber).e164;
    const ok = /^\+\d{8,16}$/.test(normalized);
    return ok
      ? { ok: true, value: normalized }
      : { ok: false, value: normalized, message: rules.message };
  }

  const normalized = value.replace(/[\s()-]/g, '');
  const ok = /^\+?[0-9]{7,15}$/.test(normalized);
  return ok ? { ok: true, value: normalized } : { ok: false, value: normalized, message: 'Phone number is invalid' };
}

export function validatePassword(password) {
  const value = String(password || '');
  if (!value) {
    return { ok: false, value, message: 'Password is required' };
  }
  if (value.length < 8) {
    return { ok: false, value, message: 'Password must be at least 8 characters' };
  }
  if (value.length > 72) {
    return { ok: false, value, message: 'Password must be 72 characters or less' };
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, value, message: 'Password must include letters and numbers' };
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, value, message: 'Password must include at least one special character' };
  }
  return { ok: true, value };
}

export function getPasswordStrength(password) {
  const value = String(password || '');
  const checks = [
    { key: 'len', label: 'At least 8 characters', ok: value.length >= 8 },
    { key: 'letter', label: 'Contains a letter (A–Z)', ok: /[A-Za-z]/.test(value) },
    { key: 'number', label: 'Contains a number (0–9)', ok: /\d/.test(value) },
    { key: 'special', label: 'Contains a special character', ok: /[^A-Za-z0-9]/.test(value) },
  ];
  return { checks, score: checks.reduce((sum, check) => sum + (check.ok ? 1 : 0), 0) };
}

export function validateSignUpForm(values) {
  const fieldErrors = {};

  const first = validateName(values.firstName, 'First name');
  if (!first.ok) fieldErrors.firstName = first.message;

  const last = validateName(values.lastName, 'Last name');
  if (!last.ok) fieldErrors.lastName = last.message;

  const addr = validateAddress(values.address);
  if (!addr.ok) fieldErrors.address = addr.message;

  const dob = validateDateOfBirth(values.dateOfBirth);
  if (!dob.ok) fieldErrors.dateOfBirth = dob.message;

  const gen = validateGender(values.gender);
  if (!gen.ok) fieldErrors.gender = gen.message;

  const phone = validatePhoneE164(values.phone, {
    required: true,
    countryCode: values.countryCode,
    phoneNumber: values.phoneNumber,
  });
  if (!phone.ok) fieldErrors.phone = phone.message;

  const email = validateRegistrationEmail(values.email);
  if (!email.ok) fieldErrors.email = email.message;

  const pwd = validatePassword(values.password);
  if (!pwd.ok) fieldErrors.password = pwd.message;

  const confirm = String(values.confirmPassword || '');
  if (!confirm) {
    fieldErrors.confirmPassword = 'Confirm password is required';
  } else if (values.password !== confirm) {
    fieldErrors.confirmPassword = 'Passwords do not match';
  }

  const ok = Object.keys(fieldErrors).length === 0;
  return {
    ok,
    fieldErrors,
    sanitized: {
      firstName: first.value,
      lastName: last.value,
      address: addr.value,
      dateOfBirth: dob.value,
      gender: gen.value,
      phone: phone.value,
      email: email.value,
      password: pwd.value,
    },
  };
}

export function validateSignInForm(values) {
  const fieldErrors = {};
  const email = validateEmail(values.email);
  if (!email.ok) fieldErrors.email = 'Email address is invalid';

  const password = String(values.password || '');
  if (!password) fieldErrors.password = 'Password is required';

  const ok = Object.keys(fieldErrors).length === 0;
  return { ok, fieldErrors, sanitized: { email: email.value, password } };
}

