import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin, newObjectId } from '../lib/db.js';
import { generateOtpCode, generateSecureToken, hashCode, getResetTokenStatus } from '../lib/otp.js';
import { sendPasswordResetEmail, sendRegistrationOtpEmail } from '../lib/emailjs.js';
import { createWelcomeNotification } from './notifications.js';
import { parseBool, userRowToPublic } from '../lib/supabaseMaps.js';
import {
  isValidEmail,
  isValidName,
  isValidPhone,
  isAllowedRegistrationEmail,
  normalizeEmail,
  normalizePhone,
  normalizeSpaces,
  validatePassword,
  validateDateOfBirth,
  validateName,
  validatePasswordConfirmation,
  validateRegistrationPhone,
} from '../lib/validation.js';

const router = express.Router();

function assertEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET');
  }
}

function signToken(user) {
  assertEnv();
  const id = String(user?._id || user?.id || '');
  const isAdmin = parseBool(user?.isAdmin ?? user?.is_admin);
  return jwt.sign({ sub: id, isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function getAdminCredentials() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL || 'agrix.official@gmail.com'),
    password: String(process.env.ADMIN_PASSWORD || 'Admin@12345'),
  };
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_RESENDS_PER_WINDOW = 3;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;

const DEFAULT_RESET_TTL_MINUTES = 30;
function getResetTtlMs() {
  const configuredMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES);
  const ttlMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_RESET_TTL_MINUTES;
  return ttlMinutes * 60 * 1000;
}
const RESET_RESEND_WINDOW_MS = 10 * 60 * 1000;
const RESET_MAX_RESENDS_PER_WINDOW = 3;

function getJsonbField(row, prefix, field) {
  if (!row) return undefined;
  const directKey = `${prefix}.${field}`;
  if (Object.prototype.hasOwnProperty.call(row, directKey)) return row[directKey];
  const nested = row[prefix];
  if (nested && typeof nested === 'object' && Object.prototype.hasOwnProperty.call(nested, field)) {
    return nested[field];
  }
  return undefined;
}

function getEv(row, field) {
  return getJsonbField(row, 'emailVerification', field);
}

function getPr(row, field) {
  return getJsonbField(row, 'passwordReset', field);
}

function redactResetErrorText(value) {
  return String(value || '')
    .replace(/\b[a-f0-9]{64}\b/gi, '[REDACTED_TOKEN]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/((?:confirm)?password\s*[:=]\s*)[^\s,}]+/gi, '$1[REDACTED]');
}

function logResetRouteError(routeName, error) {
  const errorMessage = String(error?.message || '');
  const missingUsedColumn = errorMessage.includes('passwordReset.used')
    && /does not exist|could not find|schema cache/i.test(errorMessage);
  const message = missingUsedColumn
    ? `passwordReset.used column missing, run migration (${redactResetErrorText(error?.message)})`
    : redactResetErrorText(error?.message || error);
  const stack = redactResetErrorText(error?.stack || new Error(message).stack || '');
  const code = error?.code ? ` code=${redactResetErrorText(error.code)}` : '';
  console.error(`[${routeName}] ${message}${code}${stack ? `\n${stack}` : ''}`);
}

function parseUniqueViolation(err, { email = '', phone = '' } = {}) {
  const fieldInfo = { email: false, phone: false, other: false };
  if (err?.code !== '23505') return fieldInfo;
  const msg = String(err?.details || err?.message || err?.constraint_name || '').toLowerCase();
  const columnMatch = msg.match(/\bkey\s*\(\s*"?([a-z0-9_]+)"?\s*\)/i);
  const constraint = String(err?.constraint_name || '').toLowerCase();
  const col = columnMatch ? columnMatch[1].toLowerCase() : '';
  const checkList = [col, constraint, msg];
  for (const token of checkList) {
    if (!token) continue;
    if (/email/.test(token)) fieldInfo.email = true;
    if (/phone/.test(token)) fieldInfo.phone = true;
  }
  if (email) {
    const em = String(email).toLowerCase();
    if (em && msg.includes(em)) fieldInfo.email = true;
  }
  if (phone) {
    const ph = String(phone);
    if (ph && msg.includes(ph)) fieldInfo.phone = true;
  }
  if (!fieldInfo.email && !fieldInfo.phone) fieldInfo.other = true;
  return fieldInfo;
}

function formatUniqueConflict(err, { email, phone } = {}) {
  const info = parseUniqueViolation(err, { email, phone });
  const fieldErrors = {};
  const parts = [];
  if (info.email) {
    fieldErrors.email = 'Email already registered';
    parts.push('Email already registered');
  }
  if (info.phone) {
    fieldErrors.phone = 'Phone number already registered';
    parts.push('Phone number already registered');
  }
  if (info.other || parts.length === 0) {
    if (email) {
      fieldErrors.email = fieldErrors.email || 'Email or phone already in use';
      parts.push(parts[0] ? '' : 'Account already exists');
    }
  }
  const message = parts.filter(Boolean).join(' and ') || 'Account already exists';
  return { error: message, fieldErrors };
}

function getResetRedirectBaseUrl() {
  const configuredFrontend = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || '').split(',')[0].trim();
  const clientOrigin = String(process.env.CLIENT_ORIGIN || '').split(',')[0].trim();
  const v = configuredFrontend || clientOrigin;
  return v;
}

function getRequestResetBaseUrl(req) {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const proto = forwardedProto || String(req.protocol || '').trim() || 'http';
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = forwardedHost || String(req.get('host') || '').trim();
  if (!host) return '';
  return `${proto}://${host}/reset-password`;
}

function buildResetLink(req, token) {
  const base = getResetRedirectBaseUrl() || getRequestResetBaseUrl(req);
  if (!base) {
    const err = new Error('Missing FRONTEND_URL or CLIENT_ORIGIN');
    err.code = 'RESET_URL_NOT_CONFIGURED';
    throw err;
  }
  const hasQuery = String(base).includes('?');
  const joiner = hasQuery ? '&' : '?';
  return `${base}${joiner}resetToken=${encodeURIComponent(String(token || ''))}`;
}

router.post('/check-registration', async (req, res) => {
  try {
    const em = normalizeEmail(req.body?.email);
    const ph = normalizePhone(req.body?.phone);
    const fieldErrors = {};
    if (!isValidEmail(em)) fieldErrors.email = 'Enter a valid email address';
    else if (!isAllowedRegistrationEmail(em)) fieldErrors.email = 'Use a Gmail, Yahoo, or Outlook email address';
    if (!ph) fieldErrors.phone = 'Phone number is required';
    else {
      const phoneError = validateRegistrationPhone(req.body?.phone);
      if (phoneError) fieldErrors.phone = phoneError;
    }
    if (Object.keys(fieldErrors).length) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error } = await supabase
      .from('users')
      .select('_id,email,phone')
      .or(`email.ilike.${em},phone.eq.${ph}`)
      .limit(10);
    if (error) return res.status(500).json({ error: 'Could not check registration details' });

    const fieldErrorsFound = {};
    for (const row of existing || []) {
      if (String(row.email || '').trim().toLowerCase() === em.toLowerCase()) {
        fieldErrorsFound.email = 'Email already registered';
      }
      if (String(row.phone || '').trim() === ph) {
        fieldErrorsFound.phone = 'Phone number already registered';
      }
    }
    if (Object.keys(fieldErrorsFound).length) {
      return res.status(409).json({ error: Object.values(fieldErrorsFound).join(' and '), fieldErrors: fieldErrorsFound });
    }
    return res.json({ available: true });
  } catch (_err) {
    return res.status(500).json({ error: 'Could not check registration details' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, address, dateOfBirth, gender } = req.body || {};

    const fieldErrors = {};
    const first = normalizeSpaces(firstName);
    const last = normalizeSpaces(lastName);
    const em = normalizeEmail(email);
    const ph = normalizePhone(phone);
    const addr = normalizeSpaces(address);
    const gen = String(gender || '').trim().toLowerCase();
    const dobRaw = String(dateOfBirth || '').trim();

    const firstError = validateName(first, 'First name');
    const lastError = validateName(last, 'Last name');
    if (firstError) fieldErrors.firstName = firstError;
    if (lastError) fieldErrors.lastName = lastError;
    if (!isValidEmail(em)) fieldErrors.email = 'Enter a valid email address';
    else if (!isAllowedRegistrationEmail(em)) fieldErrors.email = 'Use a Gmail, Yahoo, or Outlook email address';
    if (!ph) fieldErrors.phone = 'Phone number is required';
    else {
      const phoneError = validateRegistrationPhone(phone);
      if (phoneError) fieldErrors.phone = phoneError;
    }
    if (!addr || addr.length < 5 || addr.length > 160) fieldErrors.address = 'Address is invalid';

    const allowedGenders = new Set(['male', 'female', 'rather_not_say']);
    if (!allowedGenders.has(gen)) fieldErrors.gender = 'Gender is invalid';

    const dobError = validateDateOfBirth(dobRaw);
    const dob = dobError ? null : new Date(`${dobRaw}T00:00:00.000Z`);
    if (dobError) fieldErrors.dateOfBirth = dobError;

    const pwdError = validatePassword(password);
    if (pwdError) fieldErrors.password = pwdError;

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingEmail, error: existingEmailErr } = await supabase
      .from('users')
      .select('_id, email, phone')
      .or(`email.ilike.${em},phone.eq.${ph}`)
      .limit(10);
    if (existingEmailErr) {
      return res.status(500).json({ error: 'Registration failed' });
    }
    const preFieldErrors = {};
    if (existingEmail && existingEmail.length) {
      for (const row of existingEmail) {
        if (String(row.email || '').toLowerCase() === String(em).toLowerCase()) {
          preFieldErrors.email = 'Email already registered';
        }
        if (String(row.phone || '') === String(ph)) {
          preFieldErrors.phone = 'Phone number already registered';
        }
      }
      if (Object.keys(preFieldErrors).length > 0) {
        const msg = Object.values(preFieldErrors).join(' and ');
        return res.status(409).json({ error: msg, fieldErrors: preFieldErrors });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nowIso = new Date().toISOString();
    const skipEmail = process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'development';
    const otpCode = skipEmail ? '' : generateOtpCode();

    const { data: user, error: insertErr } = await supabase
      .from('users')
      .insert({
        _id: newObjectId(),
        createdAt: nowIso,
        updatedAt: nowIso,
        firstName: first,
        lastName: last,
        phone: ph,
        address: addr,
        dateOfBirth: dob ? dob.toISOString() : null,
        gender: gen,
        email: em,
        passwordHash,
        isAdmin: false,
        role: 'user',
        emailVerified: skipEmail,
        phoneVerified: true,
        ...(!skipEmail ? {
          'emailVerification.codeHash': hashCode(otpCode),
          'emailVerification.expiresAt': new Date(Date.now() + OTP_TTL_MS).toISOString(),
          'emailVerification.attempts': 0,
          'emailVerification.lastSentAt': nowIso,
          'emailVerification.resendWindowStart': nowIso,
          'emailVerification.resendCount': 1,
        } : {}),
      })
      .select('*')
      .single();
    if (insertErr || !user) {
      if (insertErr?.code === '23505') {
        const conf = formatUniqueConflict(insertErr, { email: em, phone: ph });
        return res.status(409).json(conf);
      }
      return res.status(500).json({ error: 'Registration failed' });
    }

    try { await createWelcomeNotification(user._id); }
    catch (notificationErr) { console.error('Could not create signup welcome notification:', notificationErr?.message || notificationErr); }

    if (skipEmail) {
      const token = signToken(user);
      return res.status(201).json({ token, user: userRowToPublic(user) });
    }

    let otpSent = true;
    let otpError = null;
    try {
      await sendRegistrationOtpEmail({ toEmail: user.email, otpCode });
    } catch (sendErr) {
      console.error('Failed to send registration OTP email', sendErr);
      otpSent = false;
      otpError = {
        message: String(sendErr?.message || 'Failed to send verification code'),
        code: sendErr?.code || 'EMAIL_SEND_FAILED',
        status: typeof sendErr?.status === 'number' ? sendErr.status : undefined,
      };
      if (sendErr?.code === 'EMAIL_NOT_CONFIGURED' && Array.isArray(sendErr?.missing)) {
        otpError.missing = sendErr.missing;
      }
      if (process.env.NODE_ENV !== 'production' && sendErr?.details) {
        otpError.details = String(sendErr.details).slice(0, 500);
      }
    }

    return res
      .status(201)
      .json({
        requiresVerification: true,
        otpSent,
        otpError,
        userId: String(user._id),
        email: user.email,
        ...(process.env.NODE_ENV !== 'production' ? { devOtpCode: otpCode } : {}),
      });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/start-verification', async (req, res) => {
  try {
    const { userId, email, password, firstName, lastName, phone, address, dateOfBirth, gender } = req.body || {};
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) return res.status(400).json({ error: 'Enter a valid email address', code: 'EMAIL_INVALID' });

    const first = normalizeSpaces(firstName);
    const last = normalizeSpaces(lastName);
    const ph = normalizePhone(phone);
    const addr = normalizeSpaces(address);
    const gen = String(gender || '').trim().toLowerCase();
    const dobRaw = String(dateOfBirth || '').trim();
    const rawPassword = String(password || '');
    const passwordError = rawPassword ? validatePassword(rawPassword) : null;
    const skipEmail = process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.NODE_ENV === 'development';

    const fieldErrors = {};
    const firstError = validateName(first, 'First name');
    const lastError = validateName(last, 'Last name');
    if (firstError) fieldErrors.firstName = firstError;
    if (lastError) fieldErrors.lastName = lastError;
    if (!ph) fieldErrors.phone = 'Phone number is required';
    else {
      const phoneError = validateRegistrationPhone(phone);
      if (phoneError) fieldErrors.phone = phoneError;
    }
    if (!addr || addr.length < 5 || addr.length > 160) fieldErrors.address = 'Address is invalid';
    if (!['male', 'female', 'rather_not_say'].includes(gen)) fieldErrors.gender = 'Gender is invalid';
    const dobError = validateDateOfBirth(dobRaw);
    if (dobError) fieldErrors.dateOfBirth = dobError;
    if (passwordError) fieldErrors.password = passwordError;
    if (Object.keys(fieldErrors).length) return res.status(400).json({ error: 'Validation failed', fieldErrors });

    const dob = new Date(`${dobRaw}T00:00:00.000Z`).toISOString();

    const supabase = getSupabaseAdmin();
    const requestedId = String(userId || '').trim();
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${em}${ph ? `,phone.eq.${ph}` : ''}`)
      .limit(10);
    if (findErr) return res.status(500).json({ error: 'Failed to start verification' });

    let matchedExisting = null;
    const dupPre = {};
    for (const row of existing || []) {
      if (String(row.email || '').toLowerCase() === String(em).toLowerCase()) {
        dupPre.email = 'Email already registered';
        if (!matchedExisting) matchedExisting = row;
      }
      if (ph && String(row.phone || '') === String(ph)) {
        dupPre.phone = 'Phone number already registered';
        if (!matchedExisting && row) matchedExisting = row;
      }
    }
    if (matchedExisting && requestedId && String(matchedExisting._id) === requestedId) {
      // same row - allow it
      for (const k of Object.keys(dupPre)) delete dupPre[k];
      if (!existing?.length) matchedExisting = null;
    }
    if (Object.keys(dupPre).length > 0) {
      const msg = Object.values(dupPre).join(' and ');
      return res.status(409).json({ error: msg, fieldErrors: dupPre });
    }

    const nowIso = new Date().toISOString();
    const targetId = String(matchedExisting?._id || requestedId || newObjectId());
    const nextPasswordHash =
      rawPassword && !passwordError
        ? await bcrypt.hash(rawPassword, 12)
        : matchedExisting?.passwordHash
          ? String(matchedExisting.passwordHash)
          : '';
    const otpCode = skipEmail ? '' : generateOtpCode();
    const payload = {
      _id: targetId,
      ...(!matchedExisting ? { createdAt: nowIso } : {}),
      updatedAt: nowIso,
      email: em,
      firstName: first || '',
      lastName: last || '',
      phone: ph || '',
      address: addr || '',
      dateOfBirth: dob,
      gender: gen || 'rather_not_say',
      isAdmin: false,
      role: 'user',
      emailVerified: skipEmail,
      phoneVerified: true,
      ...(!skipEmail ? {
        'emailVerification.codeHash': hashCode(otpCode),
        'emailVerification.expiresAt': new Date(Date.now() + OTP_TTL_MS).toISOString(),
        'emailVerification.attempts': 0,
        'emailVerification.lastSentAt': nowIso,
        'emailVerification.resendWindowStart': nowIso,
        'emailVerification.resendCount': 1,
      } : {}),
      ...(matchedExisting
        ? nextPasswordHash && !String(matchedExisting?.passwordHash || '')
          ? { passwordHash: nextPasswordHash }
          : {}
        : { passwordHash: nextPasswordHash }),
    };

    const { data: user, error: upsertErr } = matchedExisting
      ? await supabase.from('users').update(payload).eq('_id', matchedExisting._id).select('*').single()
      : await supabase.from('users').insert(payload).select('*').single();
    if (upsertErr || !user) {
      if (upsertErr?.code === '23505') {
        const conf = formatUniqueConflict(upsertErr, { email: em, phone: ph });
        return res.status(409).json(conf);
      }
      const message = String(upsertErr?.message || 'Failed to start verification');
      const looksRls =
        /row level security/i.test(message) ||
        /violates row-level security/i.test(message) ||
        /permission denied/i.test(message);
      const code = looksRls ? 'DB_WRITE_FORBIDDEN' : 'DB_WRITE_FAILED';
      return res.status(looksRls ? 403 : 500).json({
        error: looksRls ? 'Database write is blocked (RLS or missing service role key)' : 'Failed to start verification',
        code,
        ...(process.env.NODE_ENV !== 'production' ? { details: message.slice(0, 600) } : {}),
      });
    }

    if (!matchedExisting) {
      try { await createWelcomeNotification(user._id); }
      catch (notificationErr) { console.error('Could not create signup welcome notification:', notificationErr?.message || notificationErr); }
    }

    if (skipEmail) {
      const token = signToken(user);
      return res.json({ token, user: userRowToPublic(user) });
    }

    let otpSent = true;
    let otpError = null;
    try {
      await sendRegistrationOtpEmail({ toEmail: user.email, otpCode });
    } catch (sendErr) {
      otpSent = false;
      otpError = {
        message: String(sendErr?.message || 'Failed to send verification code'),
        code: sendErr?.code || 'EMAIL_SEND_FAILED',
        status: typeof sendErr?.status === 'number' ? sendErr.status : undefined,
      };
      if (sendErr?.code === 'EMAIL_NOT_CONFIGURED' && Array.isArray(sendErr?.missing)) {
        otpError.missing = sendErr.missing;
      }
      if (process.env.NODE_ENV !== 'production' && sendErr?.details) {
        otpError.details = String(sendErr.details).slice(0, 500);
      }
    }

    return res.json({
      requiresVerification: true,
      otpSent,
      otpError,
      userId: String(user._id),
      email: user.email,
      ...(process.env.NODE_ENV !== 'production' ? { devOtpCode: otpCode } : {}),
    });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to start verification' });
  }
});

router.post('/sync-password', requireAuth, async (req, res) => {
  try {
    const rawPassword = String(req.body?.password || '');
    const passwordError = validatePassword(rawPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError, code: 'PASSWORD_INVALID' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const supabase = getSupabaseAdmin();

    let { data: user, error } = await supabase.from('users').select('*').eq('_id', req.userId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to sync password' });

    if (!user) {
      const authEmail = normalizeEmail(req.authUser?.email || '');
      if (isValidEmail(authEmail)) {
        const byEmail = await supabase.from('users').select('*').ilike('email', authEmail).maybeSingle();
        user = byEmail.data || null;
        error = byEmail.error || null;
        if (error) return res.status(500).json({ error: 'Failed to sync password' });
      }
    }

    if (!user) {
      const authEmail = normalizeEmail(req.authUser?.email || '');
      if (!isValidEmail(authEmail)) {
        return res.status(400).json({ error: 'Email address is invalid' });
      }
      const payload = {
        _id: String(req.userId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        email: authEmail,
        firstName: '',
        lastName: '',
        phone: '',
        address: '',
        dateOfBirth: null,
        gender: 'rather_not_say',
        passwordHash,
        isAdmin: false,
        role: 'user',
        emailVerified: false,
        phoneVerified: true,
      };
      const { error: insertErr } = await supabase.from('users').insert(payload);
      if (insertErr) return res.status(500).json({ error: 'Failed to sync password' });
      return res.json({ ok: true });
    }

    const { error: updateErr } = await supabase.from('users').update({ passwordHash, updatedAt: new Date().toISOString() }).eq('_id', user._id);
    if (updateErr) return res.status(500).json({ error: 'Failed to sync password' });
    return res.json({ ok: true });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to sync password' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const fieldErrors = {};
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) fieldErrors.email = 'Email address is invalid';
    if (!password) fieldErrors.password = 'Password is required';
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors });
    }

    const rawPassword = String(password);
    const adminCreds = getAdminCredentials();
    const supabase = getSupabaseAdmin();
    if (em === adminCreds.email && rawPassword === adminCreds.password) {
      const passwordHash = await bcrypt.hash(rawPassword, 12);
      const { data: existing, error: findErr } = await supabase.from('users').select('*').ilike('email', em).maybeSingle();
      if (findErr) return res.status(500).json({ error: 'Login failed' });

      const payload = existing
        ? {
            passwordHash,
            isAdmin: true,
            role: 'admin',
            emailVerified: true,
            phoneVerified: true,
          }
        : {
            _id: newObjectId(),
            email: em,
            passwordHash,
            firstName: 'AgriX',
            lastName: 'Admin',
            phone: '',
            address: '',
            dateOfBirth: null,
            gender: 'rather_not_say',
            isAdmin: true,
            role: 'admin',
            emailVerified: true,
            phoneVerified: true,
          };

      const { data: user, error: upsertErr } = existing
        ? await supabase.from('users').update(payload).eq('_id', existing._id).select('*').single()
        : await supabase.from('users').insert(payload).select('*').single();
      if (upsertErr || !user) return res.status(500).json({ error: 'Login failed' });

      const token = signToken(user);
      return res.json({ token, user: userRowToPublic(user) });
    }

    let { data: user, error: userErr } = await supabase.from('users').select('*').ilike('email', em).maybeSingle();
    if (userErr) return res.status(500).json({ error: 'Login failed' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user._id) {
      const { data: patched } = await supabase
        .from('users')
        .update({ _id: newObjectId() })
        .eq('email', user.email)
        .select('*')
        .single()
        .catch(() => ({ data: null }));
      if (patched) user = patched;
    }

    const storedHash = String(user.passwordHash || '');
    let ok = false;
    if (storedHash) {
      try {
        ok = await bcrypt.compare(rawPassword, storedHash);
      } catch (_err) {
        ok = false;
      }
    }
    if (!ok) {
      const looksBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');
      const looksPlaintext = !looksBcrypt && storedHash && storedHash === rawPassword;
      if (looksPlaintext) {
        const upgradedHash = await bcrypt.hash(rawPassword, 12);
        const { data: upgraded, error: upgradeErr } = await supabase
          .from('users')
          .update({ passwordHash: upgradedHash })
          .eq('_id', user._id)
          .select('*')
          .single();
        if (!upgradeErr && upgraded) {
          user = upgraded;
          ok = true;
        }
      }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!parseBool(user.isAdmin) && !parseBool(user.emailVerified)) {
      return res.status(403).json({
        error: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        userId: String(user._id),
        email: user.email,
      });
    }

    const token = signToken(user);
    return res.json({ token, user: userRowToPublic(user) });
  } catch (_err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, email, code } = req.body || {};
    const id = String(userId || '').trim();
    const em = normalizeEmail(email);
    const otp = String(code || '').trim();
    if (!id) return res.status(400).json({ error: 'User ID is required', code: 'USER_ID_REQUIRED' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Invalid code', code: 'OTP_INVALID' });

    const supabase = getSupabaseAdmin();
    let { data: user, error } = await supabase.from('users').select('*').eq('_id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Verification failed' });
    if (!user && isValidEmail(em)) {
      const retry = await supabase.from('users').select('*').ilike('email', em).maybeSingle();
      user = retry.data || null;
      error = retry.error || null;
      if (error) return res.status(500).json({ error: 'Verification failed' });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (parseBool(user.isAdmin) || parseBool(user.emailVerified)) {
      return res.json({ ok: true });
    }

    const now = Date.now();
    const expiresAt = getEv(user, 'expiresAt') ? new Date(getEv(user, 'expiresAt')).getTime() : 0;
    if (!expiresAt || expiresAt <= now) {
      return res.status(400).json({ error: 'Code expired. Please resend.', code: 'OTP_EXPIRED' });
    }

    const expectedHash = String(getEv(user, 'codeHash') || '');
    const actualHash = hashCode(otp);
    if (!expectedHash || expectedHash !== actualHash) {
      const nextAttempts = Number(getEv(user, 'attempts') || 0) + 1;
      await supabase.from('users').update({ 'emailVerification.attempts': nextAttempts }).eq('_id', user._id);
      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many attempts. Try again later.', code: 'OTP_LOCKED', retryAfterSeconds: Math.ceil(OTP_LOCK_MS / 1000) });
      }
      return res.status(400).json({
        error: 'Invalid code',
        code: 'OTP_INVALID',
        attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts),
      });
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        emailVerified: true,
        updatedAt: new Date().toISOString(),
        'emailVerification.codeHash': '',
        'emailVerification.expiresAt': null,
        'emailVerification.attempts': 0,
        'emailVerification.lastSentAt': null,
        'emailVerification.resendWindowStart': null,
        'emailVerification.resendCount': 0,
      })
      .eq('_id', user._id);
    if (updateErr) return res.status(500).json({ error: 'Verification failed' });

    return res.json({ ok: true });
  } catch (_err) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const { userId, email } = req.body || {};
    const id = String(userId || '').trim();
    const em = normalizeEmail(email);
    if (!id && !isValidEmail(em)) return res.status(400).json({ error: 'User ID is required', code: 'USER_ID_REQUIRED' });

    const supabase = getSupabaseAdmin();
    let { data: user, error } = id
      ? await supabase.from('users').select('*').eq('_id', id).maybeSingle()
      : await supabase.from('users').select('*').ilike('email', em).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to resend code', code: 'EMAIL_SEND_FAILED' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (parseBool(user.isAdmin) || parseBool(user.emailVerified)) {
      return res.json({ ok: true });
    }

    const now = Date.now();
    const windowStart = getEv(user, 'resendWindowStart')
      ? new Date(getEv(user, 'resendWindowStart')).getTime()
      : 0;
    const inWindow = windowStart && now - windowStart < OTP_RESEND_WINDOW_MS;
    const currentCount = Number(getEv(user, 'resendCount') || 0);
    const nextCount = inWindow ? currentCount + 1 : 1;

    if (inWindow && currentCount >= OTP_MAX_RESENDS_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil((windowStart + OTP_RESEND_WINDOW_MS - now) / 1000);
      return res.set('Retry-After', String(retryAfterSeconds)).status(429).json({
        error: 'Too many resend requests. Try again later.',
        code: 'OTP_RESEND_LIMIT',
        retryAfterSeconds,
      });
    }

    const otpCode = generateOtpCode();
    await supabase
      .from('users')
      .update({
        'emailVerification.codeHash': hashCode(otpCode),
        'emailVerification.expiresAt': new Date(now + OTP_TTL_MS).toISOString(),
        'emailVerification.lastSentAt': new Date(now).toISOString(),
        'emailVerification.resendWindowStart': inWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
        'emailVerification.resendCount': nextCount,
        'emailVerification.attempts': 0,
      })
      .eq('_id', user._id);

    await sendRegistrationOtpEmail({ toEmail: user.email, otpCode });
    return res.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { devOtpCode: otpCode } : {}) });
  } catch (err) {
    if (err?.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' });
    }
    return res.status(500).json({ error: 'Failed to resend code', code: 'EMAIL_SEND_FAILED' });
  }
});

router.post('/verify-registration', async (req, res) => {
  try {
    const { userId, code } = req.body || {};
    const id = String(userId || '').trim();
    const otp = String(code || '').trim();
    if (!id) return res.status(400).json({ error: 'User ID is required', code: 'USER_ID_REQUIRED' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Invalid code', code: 'OTP_INVALID' });

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase.from('users').select('*').eq('_id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Verification failed' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (parseBool(user.isAdmin) || parseBool(user.emailVerified)) {
      const token = signToken(user);
      return res.json({ token, user: userRowToPublic(user) });
    }

    const now = Date.now();
    const expiresAt = getEv(user, 'expiresAt') ? new Date(getEv(user, 'expiresAt')).getTime() : 0;
    if (!expiresAt || expiresAt <= now) {
      return res.status(400).json({ error: 'Code expired. Please resend.', code: 'OTP_EXPIRED' });
    }

    const expectedHash = String(getEv(user, 'codeHash') || '');
    const actualHash = hashCode(otp);
    if (!expectedHash || expectedHash !== actualHash) {
      const nextAttempts = Number(getEv(user, 'attempts') || 0) + 1;
      await supabase.from('users').update({ 'emailVerification.attempts': nextAttempts }).eq('_id', id);
      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many attempts. Try again later.', code: 'OTP_LOCKED', retryAfterSeconds: Math.ceil(OTP_LOCK_MS / 1000) });
      }

      return res.status(400).json({
        error: 'Invalid code',
        code: 'OTP_INVALID',
        attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts),
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update({
        emailVerified: true,
        'emailVerification.codeHash': '',
        'emailVerification.expiresAt': null,
        'emailVerification.attempts': 0,
        'emailVerification.lastSentAt': null,
        'emailVerification.resendWindowStart': null,
        'emailVerification.resendCount': 0,
      })
      .eq('_id', id)
      .select('*')
      .single();
    if (updateErr || !updated) return res.status(500).json({ error: 'Verification failed' });

    const token = signToken(updated);
    return res.json({ token, user: userRowToPublic(updated) });
  } catch (_err) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const id = String(userId || '').trim();
    if (!id) return res.status(400).json({ error: 'User ID is required', code: 'USER_ID_REQUIRED' });

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase.from('users').select('*').eq('_id', id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to resend code', code: 'EMAIL_SEND_FAILED' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (parseBool(user.isAdmin) || parseBool(user.emailVerified)) {
      return res.json({ ok: true });
    }

    const now = Date.now();
    const windowStart = getEv(user, 'resendWindowStart')
      ? new Date(getEv(user, 'resendWindowStart')).getTime()
      : 0;
    const inWindow = windowStart && now - windowStart < OTP_RESEND_WINDOW_MS;
    const currentCount = Number(getEv(user, 'resendCount') || 0);
    const nextCount = inWindow ? currentCount + 1 : 1;

    if (inWindow && currentCount >= OTP_MAX_RESENDS_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil((windowStart + OTP_RESEND_WINDOW_MS - now) / 1000);
      return res.set('Retry-After', String(retryAfterSeconds)).status(429).json({
        error: 'Too many resend requests. Try again later.',
        code: 'OTP_RESEND_LIMIT',
        retryAfterSeconds,
      });
    }

    const otpCode = generateOtpCode();
    await supabase
      .from('users')
      .update({
        'emailVerification.codeHash': hashCode(otpCode),
        'emailVerification.expiresAt': new Date(now + OTP_TTL_MS).toISOString(),
        'emailVerification.lastSentAt': new Date(now).toISOString(),
        'emailVerification.resendWindowStart': inWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
        'emailVerification.resendCount': nextCount,
        'emailVerification.attempts': 0,
      })
      .eq('_id', id);

    await sendRegistrationOtpEmail({ toEmail: user.email, otpCode });
    return res.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { devOtpCode: otpCode } : {}) });
  } catch (err) {
    if (err?.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' });
    }
    return res.status(500).json({ error: 'Failed to resend code', code: 'EMAIL_SEND_FAILED' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const em = normalizeEmail(email);
    if (!isValidEmail(em)) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors: { email: 'Email address is invalid' } });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase.from('users').select('*').ilike('email', em).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to request password reset' });
    if (!user) {
      return res.json({ ok: true });
    }

    const now = Date.now();
    const windowStart = getPr(user, 'resendWindowStart')
      ? new Date(getPr(user, 'resendWindowStart')).getTime()
      : 0;
    const inWindow = windowStart && now - windowStart < RESET_RESEND_WINDOW_MS;
    const currentCount = Number(getPr(user, 'resendCount') || 0);
    if (inWindow && currentCount >= RESET_MAX_RESENDS_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil((windowStart + RESET_RESEND_WINDOW_MS - now) / 1000);
      return res.set('Retry-After', String(retryAfterSeconds)).status(429).json({
        error: 'Too many reset requests. Try again later.',
        code: 'RESET_LIMIT',
        retryAfterSeconds,
      });
    }

    const token = generateSecureToken(32);
    const resetUrl = buildResetLink(req, token);

    const { error: resetTokenSaveError } = await supabase
      .from('users')
      .update({
        'passwordReset.tokenHash': hashCode(token),
        'passwordReset.expiresAt': new Date(now + getResetTtlMs()).toISOString(),
        'passwordReset.used': false,
        'passwordReset.lastSentAt': new Date(now).toISOString(),
        'passwordReset.resendWindowStart': inWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString(),
        'passwordReset.resendCount': inWindow ? currentCount + 1 : 1,
      })
      .eq('_id', user._id);
    if (resetTokenSaveError) {
      logResetRouteError('auth.forgot-password.save-token', resetTokenSaveError);
      return res.status(500).json({ error: 'Failed to request password reset' });
    }

    try {
      await sendPasswordResetEmail({ toEmail: user.email, resetUrl });
    } catch (sendErr) {
      const { error: cleanupError } = await supabase
        .from('users')
        .update({
          'passwordReset.tokenHash': '',
          'passwordReset.expiresAt': null,
          'passwordReset.used': false,
          'passwordReset.lastSentAt': null,
          'passwordReset.resendWindowStart': null,
          'passwordReset.resendCount': 0,
        })
        .eq('_id', user._id);
      if (cleanupError) logResetRouteError('auth.forgot-password.cleanup-token', cleanupError);
      throw sendErr;
    }
    return res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'RESET_URL_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Password reset is not configured', code: 'RESET_URL_NOT_CONFIGURED' });
    }
    if (err?.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Email service is not configured', code: 'EMAIL_NOT_CONFIGURED' });
    }
    if (err?.code === 'EMAIL_SEND_FAILED') {
      return res.status(500).json({ error: 'Failed to send password reset email', code: 'EMAIL_SEND_FAILED' });
    }
    return res.status(500).json({ error: 'Failed to request password reset' });
  }
});

router.post('/validate-reset-token', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(404).json({ error: 'This reset link is invalid. Please request a new one.', code: 'RESET_INVALID', status: 'invalid' });
    const supabase = getSupabaseAdmin();
    const tokenHash = hashCode(token);
    const { data: user, error } = await supabase
      .from('users')
      .select('"passwordReset.tokenHash","passwordReset.expiresAt","passwordReset.used"')
      .filter('"passwordReset.tokenHash"', 'eq', tokenHash)
      .maybeSingle();
    if (error) {
      logResetRouteError('auth.validate-reset-token', error);
      return res.status(500).json({ error: 'Could not validate reset link' });
    }
    const status = getResetTokenStatus(
      token,
      getPr(user, 'tokenHash'),
      getPr(user, 'expiresAt'),
      getPr(user, 'used') === true
    );
    if (status === 'expired') return res.status(410).json({ error: 'This reset link has expired. Please request a new one.', code: 'RESET_EXPIRED', status });
    if (status === 'used') return res.status(410).json({ error: 'This reset link has already been used. Please request a new one.', code: 'RESET_USED', status });
    if (status === 'invalid') return res.status(404).json({ error: 'This reset link is invalid. Please request a new one.', code: 'RESET_INVALID', status });
    if (status !== 'valid') {
      return res.status(404).json({ error: 'This reset link is invalid. Please request a new one.', code: 'RESET_INVALID', status: 'invalid' });
    }
    return res.json({ status: 'valid' });
  } catch (err) {
    logResetRouteError('auth.validate-reset-token', err);
    return res.status(500).json({ error: 'Could not validate reset link' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    const t = String(token || '').trim();
    if (!t) return res.status(400).json({ error: 'Reset token is required', code: 'RESET_TOKEN_REQUIRED' });
    const confirmError = validatePasswordConfirmation(password, confirmPassword);
    if (confirmError) return res.status(400).json({ error: 'Validation failed', fieldErrors: { confirmPassword: confirmError } });

    const pwdError = validatePassword(password);
    if (pwdError) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors: { password: pwdError } });
    }

    const now = Date.now();
    const tokenHash = hashCode(t);
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .filter('"passwordReset.tokenHash"', 'eq', tokenHash)
      .maybeSingle();
    if (error) {
      logResetRouteError('auth.reset-password.lookup', error);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    const resetStatus = getResetTokenStatus(
      t,
      getPr(user, 'tokenHash'),
      getPr(user, 'expiresAt'),
      getPr(user, 'used') === true,
      now
    );
    if (resetStatus === 'expired') return res.status(410).json({ error: 'This reset link has expired. Please request a new one.', code: 'RESET_EXPIRED' });
    if (resetStatus === 'used') return res.status(410).json({ error: 'This reset link has already been used. Please request a new one.', code: 'RESET_USED' });
    if (resetStatus !== 'valid' || !user) return res.status(404).json({ error: 'This reset link is invalid. Please request a new one.', code: 'RESET_INVALID' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update({
        passwordHash,
        updatedAt: new Date().toISOString(),
        'passwordReset.used': true,
        'passwordReset.lastSentAt': null,
        'passwordReset.resendWindowStart': null,
        'passwordReset.resendCount': 0,
        ...(parseBool(user.isAdmin) ? {} : { emailVerified: true }),
      })
      .eq('_id', user._id)
      .filter('"passwordReset.tokenHash"', 'eq', tokenHash)
      .filter('"passwordReset.expiresAt"', 'gt', new Date(now).toISOString())
      .filter('"passwordReset.used"', 'eq', false)
      .select('*')
      .maybeSingle();
    if (updateErr) {
      logResetRouteError('auth.reset-password.update', updateErr);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
    if (!updated) {
      const { data: current, error: currentErr } = await supabase
        .from('users')
        .select('"passwordReset.tokenHash","passwordReset.expiresAt","passwordReset.used"')
        .eq('_id', user._id)
        .maybeSingle();
      if (currentErr) {
        logResetRouteError('auth.reset-password.state-lookup', currentErr);
        return res.status(500).json({ error: 'Failed to reset password' });
      }
      const currentStatus = getResetTokenStatus(
        t,
        getPr(current, 'tokenHash'),
        getPr(current, 'expiresAt'),
        getPr(current, 'used') === true
      );
      if (currentStatus === 'expired') return res.status(410).json({ error: 'This reset link has expired. Please request a new one.', code: 'RESET_EXPIRED' });
      if (currentStatus === 'used') return res.status(410).json({ error: 'This reset link has already been used. Please request a new one.', code: 'RESET_USED' });
      return res.status(404).json({ error: 'This reset link is invalid. Please request a new one.', code: 'RESET_INVALID' });
    }

    const authToken = signToken(updated);
    return res.json({ token: authToken, user: userRowToPublic(updated) });
  } catch (err) {
    logResetRouteError('auth.reset-password', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase.from('users').select('*').eq('_id', req.userId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Failed to load profile' });
    if (!user) {
      if (req.authType === 'supabase' && req.authUser) {
        const authEmail = String(req.authUser.email || '').trim();
        if (authEmail) {
          const { data: byEmail } = await supabase.from('users').select('*').ilike('email', authEmail).maybeSingle();
          if (byEmail) {
            return res.json({ user: userRowToPublic(byEmail) });
          }
        }
        const meta = req.authUser.user_metadata && typeof req.authUser.user_metadata === 'object' ? req.authUser.user_metadata : {};
        const payload = {
          _id: newObjectId(),
          createdAt: new Date().toISOString(),
          email: authEmail,
          firstName: String(meta.firstName || meta.first_name || '').trim(),
          lastName: String(meta.lastName || meta.last_name || '').trim(),
          phone: String(meta.phone || '').trim(),
          address: String(meta.address || '').trim(),
          dateOfBirth: meta.dateOfBirth || meta.date_of_birth || null,
          gender: String(meta.gender || '').trim() || 'rather_not_say',
          avatarUrl: String(meta.avatarUrl || meta.avatar_url || '').trim(),
          isAdmin: Boolean(meta.isAdmin || meta.is_admin),
          role: Boolean(meta.isAdmin || meta.is_admin) ? 'admin' : 'user',
          emailVerified: false,
          phoneVerified: Boolean(meta.phoneVerified || meta.phone_verified),
          passwordHash: '',
        };
        const { data: created, error: createErr } = await supabase.from('users').insert(payload).select('*').single();
        if (createErr || !created) {
          const message = String(createErr?.message || 'Failed to load profile');
          const looksRls =
            /row level security/i.test(message) ||
            /violates row-level security/i.test(message) ||
            /permission denied/i.test(message);
          return res.status(looksRls ? 403 : 500).json({
            error: looksRls ? 'Database write is blocked (RLS or missing service role key)' : 'Failed to load profile',
            code: looksRls ? 'DB_WRITE_FORBIDDEN' : 'DB_WRITE_FAILED',
            ...(process.env.NODE_ENV !== 'production' ? { details: message.slice(0, 600) } : {}),
          });
        }
        return res.json({ user: userRowToPublic(created) });
      }
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: userRowToPublic(user) });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

export default router;

