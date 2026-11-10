import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../middleware/adminAuth.js';
import { getSupabaseAdmin, newObjectId } from '../lib/db.js';
import { isDatabaseUnavailableError } from '../lib/dbDiagnostics.js';
import {
  isValidEmail,
  isValidActiveEmail,
  isValidName,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  normalizeSpaces,
  validateDateOfBirth,
  validateName,
} from '../lib/validation.js';
import { parseBool, userRowToAdminDto } from '../lib/supabaseMaps.js';

const router = express.Router();

function assertEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET');
  }
}

function getAdminCredentials() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL || 'agrix.official@gmail.com'),
    password: String(process.env.ADMIN_PASSWORD || 'Admin@12345'),
  };
}

function signAdminToken(user) {
  assertEnv();
  const id = String(user?._id || user?.id || '');
  return jwt.sign({ sub: id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

function normalizeRole(v) {
  const raw = String(v || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'admin') return 'admin';
  if (raw === 'user') return 'user';
  return '';
}

async function enrichUsersFromAuth(supabase, rows) {
  const users = Array.isArray(rows) ? rows : [];
  const needsAuthData = users.some((row) => {
    const dto = userRowToAdminDto(row);
    return !dto.fullName || !dto.createdAt;
  });
  if (!needsAuthData) return users.map(userRowToAdminDto);

  const emailsNeeded = new Set(users
    .filter((row) => {
      const dto = userRowToAdminDto(row);
      return !dto.fullName || !dto.createdAt;
    })
    .map((row) => String(row.email || '').trim().toLowerCase())
    .filter(Boolean));
  if (!emailsNeeded.size) return users.map(userRowToAdminDto);

  const authUsersByEmail = new Map();
  try {
    for (let page = 1; page <= 10 && emailsNeeded.size; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const authUsers = Array.isArray(data?.users) ? data.users : [];
      for (const authUser of authUsers) {
        const email = String(authUser.email || '').trim().toLowerCase();
        if (emailsNeeded.has(email)) {
          authUsersByEmail.set(email, authUser);
          emailsNeeded.delete(email);
        }
      }
      if (authUsers.length < 1000) break;
    }
  } catch (_err) {
  }

  return users.map((row) => {
    const dto = userRowToAdminDto(row);
    const authUser = authUsersByEmail.get(String(row.email || '').trim().toLowerCase());
    if (!authUser) return dto;
    const metadata = authUser.user_metadata && typeof authUser.user_metadata === 'object' ? authUser.user_metadata : {};
    const metadataName = String(metadata.fullName || metadata.full_name || metadata.name || '').trim();
    const firstName = dto.firstName || String(metadata.firstName || metadata.first_name || '').trim();
    const lastName = dto.lastName || String(metadata.lastName || metadata.last_name || '').trim();
    const fullName = dto.fullName || metadataName || `${firstName} ${lastName}`.trim();
    return {
      ...dto,
      firstName,
      lastName,
      fullName,
      emailVerified: dto.emailVerified || Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
      createdAt: dto.createdAt || authUser.created_at || authUser.confirmed_at || '',
    };
  });
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const creds = getAdminCredentials();
    const u = normalizeEmail(username);
    const p = String(password || '');
    
    if (!u || !p) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    let targetUser = null;
    const supabase = getSupabaseAdmin();

    // 1. Check if it matches Hardcoded Admin Credentials
    if (u === creds.email && p === creds.password) {
      const passwordHash = await bcrypt.hash(p, 12);
      const { data: existing, error: findErr } = await supabase.from('users').select('*').eq('email', u).maybeSingle();
      if (findErr) return res.status(503).json({ error: 'Service temporarily unavailable', code: 'DATABASE_UNAVAILABLE' });

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
            email: u,
            passwordHash,
            firstName: 'Super',
            lastName: 'Admin',
            isAdmin: true,
            role: 'admin',
            emailVerified: true,
            phoneVerified: true,
          };

      const { data: user, error: saveErr } = existing
        ? await supabase.from('users').update(payload).eq('_id', existing._id).select('*').single()
        : await supabase.from('users').insert(payload).select('*').single();

      if (saveErr || !user) return res.status(503).json({ error: 'Service temporarily unavailable', code: 'DATABASE_UNAVAILABLE' });
      targetUser = user;
    } else {
      // 2. Check Database for other admins
      const { data: user, error } = await supabase.from('users').select('*').ilike('email', u).maybeSingle();
      if (error) return res.status(503).json({ error: 'Service temporarily unavailable', code: 'DATABASE_UNAVAILABLE' });
      targetUser = user;
      if (!targetUser) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!parseBool(targetUser.isAdmin)) {
        return res.status(403).json({ error: 'Not an admin' });
      }
      const ok = await bcrypt.compare(p, String(targetUser.passwordHash || ''));
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const token = signAdminToken(targetUser);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    return res.json({ token, expiresAt, user: userRowToAdminDto(targetUser) });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return res.status(503).json({ error: 'Service temporarily unavailable', code: 'DATABASE_UNAVAILABLE' });
    }
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/profile', requireAdmin, async (req, res) => {
  try {
    if (!req.user) {
      // This happens if token is the legacy 'admin' one and no user found, 
      // but we now force user creation on login, so this should be rare.
      // Or if middleware didn't attach user (shouldn't happen with our change).
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.json(userRowToAdminDto(req.userRow || req.user));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/profile', requireAdmin, async (req, res) => {
  try {
    if (!req.userRow) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const user = req.userRow;
    const updates = {};
    const fieldErrors = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'firstName')) {
      updates.firstName = normalizeSpaces(req.body.firstName);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lastName')) {
      updates.lastName = normalizeSpaces(req.body.lastName);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
      const nextEmail = normalizeEmail(req.body.email);
      if (!isValidEmail(nextEmail)) {
        return res.status(400).json({ error: 'Validation failed', fieldErrors: { email: 'Enter a valid email address' } });
      }
      if (!isValidActiveEmail(nextEmail)) {
        return res.status(400).json({ error: 'Validation failed', fieldErrors: { email: 'Please enter a valid, active email address (placeholder emails are not allowed).' } });
      }
      if (nextEmail !== user.email) {
        // Check uniqueness
        const supabase = getSupabaseAdmin();
        const { data: exists } = await supabase.from('users').select('_id').ilike('email', nextEmail).maybeSingle();
        if (exists && String(exists._id || exists.id) !== String(user._id || user.id)) return res.status(409).json({ error: 'Email already taken' });
        updates.email = nextEmail;
        updates.emailVerified = false;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
      const nextPhone = normalizePhone(req.body.phone);
      if (nextPhone !== user.phone) {
         if (nextPhone && !isValidPhone(nextPhone)) return res.status(400).json({ error: 'Invalid phone' });
         updates.phone = nextPhone;
         updates.phoneVerified = false;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'address')) {
      updates.address = normalizeSpaces(req.body.address);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dateOfBirth')) {
       // Basic validation or just store string? Model expects Date usually.
       // The DTO converts to string. The Model field is Date.
       // Let's parse it.
       const raw = req.body.dateOfBirth;
       if (raw) {
         const d = new Date(raw);
         if (!isNaN(d.getTime())) updates.dateOfBirth = d.toISOString();
       }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'gender')) {
      updates.gender = req.body.gender;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'firstName')) {
      const nameError = validateName(updates.firstName, 'First name');
      if (nameError) fieldErrors.firstName = nameError;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'lastName')) {
      const nameError = validateName(updates.lastName, 'Last name');
      if (nameError) fieldErrors.lastName = nameError;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'address') && (updates.address.length < 5 || updates.address.length > 160)) {
      fieldErrors.address = 'Address must be between 5 and 160 characters';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'dateOfBirth')) {
      const dateValue = String(updates.dateOfBirth || '').split('T')[0];
      const dateError = validateDateOfBirth(dateValue);
      if (dateError) fieldErrors.dateOfBirth = dateError;
      else updates.dateOfBirth = new Date(`${dateValue}T00:00:00.000Z`).toISOString();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'gender') && !['male', 'female', 'rather_not_say'].includes(String(updates.gender || '').trim().toLowerCase())) {
      fieldErrors.gender = 'Gender is invalid';
    }
    if (Object.keys(fieldErrors).length) return res.status(400).json({ error: 'Validation failed', fieldErrors });
    
    // Password update
    if (req.body.password) {
       // Validate password strength if needed
       if (req.body.password.length < 6) return res.status(400).json({ error: 'Password too short' });
       updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    }
    updates.updatedAt = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('_id', user._id)
      .select('*')
      .single();
    if (error || !updated) return res.status(500).json({ error: 'Failed to update profile' });
    return res.json(userRowToAdminDto(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)));
    const q = String(req.query.q || '').trim();

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('createdAt', { ascending: false, nullsFirst: false });
    if (q) {
      const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`email.ilike.%${safe}%,firstName.ilike.%${safe}%,lastName.ilike.%${safe}%`);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: items, count, error } = await query.range(from, to);
    if (error) return res.status(500).json({ error: 'Failed to load users' });

    return res.json({
      items: await enrichUsersFromAuth(supabase, items),
      page,
      pageSize,
      total: Number(count || 0),
    });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/metrics', requireAdmin, async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const [{ count: totalUsers }, { count: totalAdmins }, { count: emailVerified }, { count: phoneVerified }] =
      await Promise.all([
        supabase.from('users').select('_id', { count: 'exact', head: true }),
        supabase.from('users').select('_id', { count: 'exact', head: true }).eq('isAdmin', true),
        supabase.from('users').select('_id', { count: 'exact', head: true }).eq('emailVerified', true),
        supabase.from('users').select('_id', { count: 'exact', head: true }).eq('phoneVerified', true),
      ]);

    const { data: recentUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false, nullsFirst: false })
      .range(0, 7);
    if (error) return res.status(500).json({ error: 'Failed to load metrics' });

    return res.json({
      metrics: {
        totalUsers: Number(totalUsers || 0),
        totalAdmins: Number(totalAdmins || 0),
        emailVerified: Number(emailVerified || 0),
        phoneVerified: Number(phoneVerified || 0),
      },
      recentUsers: await enrichUsersFromAuth(supabase, recentUsers),
    });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to load metrics' });
  }
});

router.get('/users/export', requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const supabase = getSupabaseAdmin();
    let query = supabase.from('users').select('*').order('createdAt', { ascending: false, nullsFirst: false });
    if (q) {
      const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`email.ilike.%${safe}%,firstName.ilike.%${safe}%,lastName.ilike.%${safe}%`);
    }
    const { data: users, error } = await query.range(0, 4999);
    if (error) return res.status(500).json({ error: 'Failed to export users' });

    const header = ['email', 'firstName', 'lastName', 'phone', 'isAdmin', 'emailVerified', 'phoneVerified', 'createdAt', 'updatedAt'];
    const esc = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = (users || []).map((u) => {
      const dto = userRowToAdminDto(u);
      return [
        dto.email,
        dto.firstName,
        dto.lastName,
        dto.phone,
        dto.isAdmin,
        dto.emailVerified,
        dto.phoneVerified,
        dto.createdAt,
        dto.updatedAt,
      ].map(esc);
    });

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="agrix-users.csv"');
    return res.status(200).send(csv);
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to export users' });
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const supabase = getSupabaseAdmin();
    const { data: user, error: userErr } = await supabase.from('users').select('*').eq('_id', id).maybeSingle();
    if (userErr) return res.status(500).json({ error: 'Failed to update user' });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const next = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      dateOfBirth: user.dateOfBirth || '',
      gender: user.gender || '',
      isAdmin: parseBool(user.isAdmin),
      role: parseBool(user.isAdmin) || String(user.role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user',
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'firstName')) {
      next.firstName = normalizeSpaces(req.body.firstName);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lastName')) {
      next.lastName = normalizeSpaces(req.body.lastName);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
      next.email = normalizeEmail(req.body.email);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
      next.phone = normalizePhone(req.body.phone);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'address')) {
      next.address = normalizeSpaces(req.body.address);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dateOfBirth')) {
      next.dateOfBirth = String(req.body.dateOfBirth || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'gender')) {
      next.gender = String(req.body.gender || '').trim();
    }
    next.updatedAt = new Date().toISOString();
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isAdmin')) {
      next.isAdmin = parseBool(req.body.isAdmin);
      next.role = next.isAdmin ? 'admin' : 'user';
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'role')) {
      const normalized = normalizeRole(req.body.role);
      if (!normalized) {
        return res.status(400).json({ error: 'Validation failed', fieldErrors: { role: 'Invalid role' } });
      }
      next.role = normalized;
      next.isAdmin = normalized === 'admin';
    }

    const fieldErrors = {};
    const firstNameError = validateName(next.firstName, 'First name');
    const lastNameError = validateName(next.lastName, 'Last name');
    if (firstNameError) fieldErrors.firstName = firstNameError;
    if (lastNameError) fieldErrors.lastName = lastNameError;
    if (!isValidActiveEmail(next.email)) fieldErrors.email = 'Please enter a valid, active email address (placeholder emails are not allowed).';
    if (next.phone && !isValidPhone(next.phone)) fieldErrors.phone = 'Phone number is invalid';
    if (next.address.length < 5 || next.address.length > 160) fieldErrors.address = 'Address must be between 5 and 160 characters';
    const dateError = validateDateOfBirth(next.dateOfBirth);
    if (dateError) fieldErrors.dateOfBirth = dateError;
    if (!['male', 'female', 'rather_not_say'].includes(String(next.gender || '').trim().toLowerCase())) {
      fieldErrors.gender = 'Gender is invalid';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fieldErrors });
    }

    const { data: existing } = await supabase.from('users').select('_id').ilike('email', next.email).maybeSingle();
    if (existing && String(existing._id) !== String(user._id)) {
      return res.status(409).json({ error: 'Email already registered', fieldErrors: { email: 'Email already registered' } });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update({
        firstName: next.firstName,
        lastName: next.lastName,
        email: next.email,
        phone: next.phone,
        address: next.address,
        dateOfBirth: next.dateOfBirth || null,
        gender: next.gender,
        isAdmin: next.isAdmin,
        role: next.role,
        updatedAt: next.updatedAt,
      })
      .eq('_id', id)
      .select('*')
      .single();
    if (updateErr || !updated) return res.status(500).json({ error: 'Failed to update user' });
    return res.json({ user: userRowToAdminDto(updated) });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const supabase = getSupabaseAdmin();
    const { data: user, error: userErr } = await supabase.from('users').select('_id,email').eq('_id', id).maybeSingle();
    if (userErr) return res.status(500).json({ error: 'Failed to delete user' });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let deletedAuth = false;
    const email = String(user.email || '').trim().toLowerCase();
    if (email) {
      try {
        for (let page = 1; page <= 10; page += 1) {
          const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) break;
          const list = Array.isArray(data?.users) ? data.users : [];
          const match = list.find((u) => String(u.email || '').trim().toLowerCase() === email);
          if (match?.id) {
            const { error: delAuthErr } = await supabase.auth.admin.deleteUser(String(match.id));
            if (!delAuthErr) deletedAuth = true;
            break;
          }
          if (list.length < 1000) break;
        }
      } catch (_err) {
      }
    }

    const { error } = await supabase.from('users').delete().eq('_id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete user' });
    return res.json({ deleted: true, deletedAuth });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
