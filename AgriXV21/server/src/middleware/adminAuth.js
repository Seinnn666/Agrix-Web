import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '../lib/db.js';
import { userRowToPublic } from '../lib/supabaseMaps.js';

function assertEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET');
  }
}

export async function requireAdmin(req, res, next) {
  try {
    assertEnv();
    const header = String(req.headers.authorization || '');
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded?.sub ? String(decoded.sub) : '';
    if (!userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const supabase = getSupabaseAdmin();
    const { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('_id', userId)
      .maybeSingle();
    if (error || !userRow) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = userRowToPublic(userRow);
    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = user;
    req.userRow = userRow;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
