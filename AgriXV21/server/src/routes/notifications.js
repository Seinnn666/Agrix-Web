import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/db.js';

const router = express.Router();

export async function createWelcomeNotification(userId) {
  const id = String(userId || '').trim();
  if (!id) return;
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('notifications').insert({
    userId: id,
    audience: 'user',
    title: 'Welcome to AgriX',
    message: 'Your account is ready. Welcome to the AgriX community!',
    level: 'success',
    read: false,
    createdAt: now,
    updatedAt: now,
  });
  if (error) throw error;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: owned, error: ownedError } = await supabase
      .from('notifications').select('*').eq('userId', String(req.userId)).order('createdAt', { ascending: false });
    if (ownedError) throw ownedError;

    const { data: broadcasts, error: broadcastError } = await supabase
      .from('notifications').select('*').in('audience', ['all', 'broadcast']).order('createdAt', { ascending: false });
    if (broadcastError) throw broadcastError;

    const { data: profile } = await supabase.from('users').select('isAdmin,role').eq('_id', String(req.userId)).maybeSingle();
    const role = String(profile?.role || req.authUser?.user_metadata?.role || '').toLowerCase();
    const isAdmin = profile?.isAdmin === true || req.authUser?.user_metadata?.isAdmin === true || req.authUser?.user_metadata?.is_admin === true || role === 'admin';
    let adminBroadcasts = [];
    if (isAdmin) {
      const { data, error } = await supabase.from('notifications').select('*').in('audience', ['admin', 'administrators']);
      if (error) throw error;
      adminBroadcasts = data || [];
    }
    const unique = new Map();
    for (const item of [...(owned || []), ...(broadcasts || []), ...adminBroadcasts]) unique.set(String(item.id || item._id), item);
    return res.json({ notifications: [...unique.values()].sort((a, b) => Date.parse(b.createdAt || b.created_at || 0) - Date.parse(a.createdAt || a.created_at || 0)) });
  } catch (error) {
    console.error('Failed to load notifications', error?.message || error);
    const missingTable = error?.code === 'PGRST205'
      || error?.code === '42P01'
      || /could not find the table ['"]?public\.notifications/i.test(String(error?.message || ''));
    if (missingTable) {
      return res.status(503).json({
        error: 'Notifications storage is not installed. Apply server/sql/notifications.sql in the Supabase SQL Editor.',
        code: 'NOTIFICATIONS_SCHEMA_MISSING',
      });
    }
    return res.status(500).json({ error: 'Failed to load notifications' });
  }
});

export default router;
