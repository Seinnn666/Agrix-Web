import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/db.js';
import {
  isValidEmail,
  isValidName,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  normalizeSpaces,
} from '../lib/validation.js';
import { generateOtpCode, hashCode } from '../lib/otp.js';
import { sendRegistrationOtpEmail } from '../lib/emailjs.js';
import { userRowToPublic } from '../lib/supabaseMaps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');
const avatarDir = path.join(uploadsRoot, 'avatars');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    return cb(null, true);
  },
});

function extForMime(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/jpg') return 'jpg';
  if (mime === 'image/pjpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic') return 'heic';
  if (mime === 'image/heif') return 'heif';
  return 'bin';
}

const router = express.Router();

router.put('/me', requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, address, dateOfBirth, gender } = req.body || {};
    const supabase = getSupabaseAdmin();
    const { data: current, error: currentErr } = await supabase.from('users').select('*').eq('_id', req.userId).maybeSingle();
    if (currentErr) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    if (!current) {
      return res.status(404).json({ error: 'User not found' });
    }

    const first = normalizeSpaces(firstName);
    const last = normalizeSpaces(lastName);
    const em = normalizeEmail(email);
    const ph = normalizePhone(phone);

    const fieldErrors = {};
    if (!isValidName(first)) fieldErrors.firstName = 'First name is invalid';
    if (!isValidName(last)) fieldErrors.lastName = 'Last name is invalid';
    // Email/Phone updates handled separately
    // if (!isValidEmail(em)) fieldErrors.email = 'Email address is invalid';
    // if (!ph) fieldErrors.phone = 'Phone number is required';
    // else if (!isValidPhone(ph)) fieldErrors.phone = 'Phone number is invalid';

    // const updates = { firstName: first, lastName: last, phone: ph, email: em };
    const updates = { firstName: first, lastName: last };

    if (address !== undefined) {
      const addr = normalizeSpaces(address);
      if (!addr || addr.length < 5 || addr.length > 160) fieldErrors.address = 'Address is invalid';
      else updates.address = addr;
    }

    if (gender !== undefined) {
      const gen = String(gender || '').trim().toLowerCase();
      const allowedGenders = new Set(['male', 'female', 'rather_not_say']);
      if (!allowedGenders.has(gen)) fieldErrors.gender = 'Gender is invalid';
      else updates.gender = gen;
    }

    if (dateOfBirth !== undefined) {
      const dobRaw = String(dateOfBirth || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
        fieldErrors.dateOfBirth = 'Date of birth is invalid';
      } else {
        const parsed = new Date(`${dobRaw}T00:00:00.000Z`);
        if (!Number.isFinite(parsed.getTime())) {
          fieldErrors.dateOfBirth = 'Date of birth is invalid';
        } else if (parsed.getTime() > Date.now()) {
          fieldErrors.dateOfBirth = 'Date of birth is invalid';
        } else {
          updates.dateOfBirth = parsed;
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors });
    }

    // Existing check removed since we don't update email here
    /*
    const existing = await User.findOne({ email: em }).lean();
    if (existing && existing._id.toString() !== String(req.userId)) {
      return res.status(409).json({ error: 'Email already registered', fieldErrors: { email: 'Email already registered' } });
    }
    */

    const { data: user, error: updateErr } = await supabase
      .from('users')
      .update({
        firstName: updates.firstName,
        lastName: updates.lastName,
        updatedAt: new Date().toISOString(),
        ...(Object.prototype.hasOwnProperty.call(updates, 'address') ? { address: updates.address } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'gender') ? { gender: updates.gender } : {}),
        ...(Object.prototype.hasOwnProperty.call(updates, 'dateOfBirth') ? { dateOfBirth: updates.dateOfBirth?.toISOString?.() || null } : {}),
      })
      .eq('_id', req.userId)
      .select('*')
      .single();
    if (updateErr || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: userRowToPublic(user) });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/me/request-update', requireAuth, async (req, res) => {
  try {
    const { type, value } = req.body;
    const supabase = getSupabaseAdmin();
    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('_id', req.userId).maybeSingle();
    if (userErr) return res.status(500).json({ error: 'Failed to request update' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let normalizedValue;
    if (type === 'email') {
      normalizedValue = normalizeEmail(value);
      if (!isValidEmail(normalizedValue)) return res.status(400).json({ error: 'Invalid email' });
      const { data: existing } = await supabase.from('users').select('_id').ilike('email', normalizedValue).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    } else if (type === 'phone') {
      normalizedValue = normalizePhone(value);
      if (!isValidPhone(normalizedValue)) return res.status(400).json({ error: 'Invalid phone number' });
    } else {
      return res.status(400).json({ error: 'Invalid update type' });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: pendingErr } = await supabase
      .from('pending_user_updates')
      .upsert({
        user_id: String(req.userId),
        update_type: type,
        target_value: normalizedValue,
        otp_hash: hashCode(otpCode),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (pendingErr) {
      console.error('Failed to persist pending profile update', pendingErr);
      return res.status(500).json({ error: 'Failed to save verification session. Please try again.' });
    }

    if (type === 'email') {
      try {
        await sendRegistrationOtpEmail({ toEmail: normalizedValue, otpCode });
      } catch (err) {
        console.error('Failed to send email OTP', err);
        return res.status(502).json({ error: 'Failed to send verification code. Please request a new OTP.' });
      }
    }

    return res.json({ ok: true, message: `OTP sent to ${normalizedValue}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to request update' });
  }
});

router.post('/me/verify-update', requireAuth, async (req, res) => {
  try {
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the 6-digit verification code.' });
    const supabase = getSupabaseAdmin();
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_user_updates')
      .select('user_id, update_type, target_value, otp_hash, expires_at')
      .eq('user_id', String(req.userId))
      .maybeSingle();
    if (pendingErr) {
      console.error('Failed to load pending profile update', pendingErr);
      return res.status(500).json({ error: 'Failed to verify update' });
    }

    const expiredMessage = 'Verification session expired. Please request a new OTP.';
    if (!pending?.otp_hash || !pending?.expires_at || !pending?.target_value || !pending?.update_type) {
      return res.status(400).json({ error: expiredMessage, code: 'UPDATE_SESSION_EXPIRED' });
    }

    if (new Date(pending.expires_at).getTime() <= Date.now()) {
      await supabase
        .from('pending_user_updates')
        .delete()
        .eq('user_id', String(req.userId))
        .eq('otp_hash', pending.otp_hash);
      return res.status(400).json({ error: expiredMessage, code: 'UPDATE_SESSION_EXPIRED' });
    }

    if (hashCode(otp) !== pending.otp_hash) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const type = String(pending.update_type);
    if (!['email', 'phone'].includes(type)) {
      return res.status(400).json({ error: expiredMessage, code: 'UPDATE_SESSION_EXPIRED' });
    }

    const update =
      type === 'email'
        ? { email: pending.target_value, emailVerified: false, updatedAt: new Date().toISOString() }
        : { phone: pending.target_value, phoneVerified: false, updatedAt: new Date().toISOString() };
    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update(update)
      .eq('_id', req.userId)
      .select('*')
      .single();
    if (updateErr || !updated) {
      if (updateErr?.code === '23505') return res.status(409).json({ error: 'Email already in use' });
      console.error('Failed to apply verified profile update', updateErr);
      return res.status(500).json({ error: 'Failed to verify update' });
    }

    const { error: consumeErr } = await supabase
      .from('pending_user_updates')
      .delete()
      .eq('user_id', String(req.userId))
      .eq('otp_hash', pending.otp_hash);
    if (consumeErr) console.error('Failed to clear verified profile update', consumeErr);

    return res.json({ ok: true, user: userRowToPublic(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify update' });
  }
});

router.post('/me/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image is too large (max 5MB)' });
      }
      const message = String(err?.message || 'Upload failed');
      if (message.toLowerCase().includes('invalid file type')) {
        return res
          .status(400)
          .json({ error: 'Invalid file type. Please upload JPG, PNG, WebP, HEIC, or HEIF.' });
      }
      return res.status(500).json({ error: message || 'Upload failed' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Missing avatar file' });
      }

      await fs.mkdir(avatarDir, { recursive: true });
      const ext = extForMime(req.file.mimetype);
      const filename = `${req.userId}-${Date.now()}.${ext}`;
      const filePath = path.join(avatarDir, filename);
      await fs.writeFile(filePath, req.file.buffer);

      const avatarUrl = `/uploads/avatars/${filename}`;
      const supabase = getSupabaseAdmin();
      const { data: user, error: updateErr } = await supabase
        .from('users')
        .update({ avatarUrl, updatedAt: new Date().toISOString() })
        .eq('_id', req.userId)
        .select('*')
        .single();
      if (updateErr || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ user: userRowToPublic(user) });
    } catch (_err2) {
      const message = String(_err2?.message || 'Upload failed');
      return res.status(500).json({ error: message || 'Upload failed' });
    }
  });
});

export default router;

