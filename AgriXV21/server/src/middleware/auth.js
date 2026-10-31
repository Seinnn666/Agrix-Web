import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../lib/db.js';

export async function requireAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded?.sub ? String(decoded.sub) : '';
        if (userId) {
          req.userId = userId;
          req.authType = 'legacy';
          return next();
        }
      } catch (_err) {
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    const authUser = data?.user || null;
    if (error || !authUser?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.authUser = authUser;
    req.authType = 'supabase';
    req.authUserId = String(authUser.id);

    const email = String(authUser.email || '').trim().toLowerCase();
    if (email) {
      const { data: row } = await supabase.from('users').select('_id').ilike('email', email).maybeSingle();
      if (row?._id) {
        req.userId = String(row._id);
        return next();
      }
    }

    req.userId = String(authUser.id);
    req.authUser = authUser;
    req.authType = 'supabase';
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

