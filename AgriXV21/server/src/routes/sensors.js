import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSupabaseAdmin, newObjectId } from '../lib/db.js';

const router = express.Router();

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceCreatedAt(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString();
  const ms = Date.parse(raw);
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  return new Date().toISOString();
}

function requireDeviceKey(req) {
  const required = String(process.env.SENSOR_INGEST_KEY || '').trim();
  if (!required) return { ok: true };
  const got = String(req.header('x-device-key') || '').trim();
  if (got && got === required) return { ok: true };
  return { ok: false, error: 'Unauthorized device', code: 'DEVICE_UNAUTHORIZED' };
}

function rowToReadingDto(row) {
  const created = row?.createdAt || row?.created_at || row?.createdat;
  const ms = created ? Date.parse(String(created)) : 0;
  return {
    id: String(row?._id || row?.id || ''),
    deviceId: String(row?.deviceId || row?.device_id || ''),
    temperature: normalizeNumber(row?.temperature),
    humidity: normalizeNumber(row?.humidity),
    soilMoisture: normalizeNumber(row?.soilMoisture ?? row?.soil_moisture),
    soilPh: normalizeNumber(row?.soilPh ?? row?.soil_ph),
    createdAt: Number.isFinite(ms) && ms > 0 ? ms : Date.now(),
  };
}

async function insertReading(supabase, payload, userId) {
  const base = {
    _id: newObjectId(),
    deviceId: payload.deviceId,
    temperature: payload.temperature,
    humidity: payload.humidity,
    soilMoisture: payload.soilMoisture,
    soilPh: payload.soilPh,
    createdAt: payload.createdAt,
  };

  if (!userId) {
    const { data, error } = await supabase.from('sensor_readings').insert(base).select('*').single();
    return { data, error };
  }

  const first = await supabase
    .from('sensor_readings')
    .insert({ ...base, userId })
    .select('*')
    .single();
  if (!first.error) return first;

  const msg = String(first.error?.message || '');
  if (/column .*userId/i.test(msg) || /userId/i.test(msg) || /schema cache/i.test(msg)) {
    const second = await supabase
      .from('sensor_readings')
      .insert({ ...base, user_id: userId })
      .select('*')
      .single();
    if (!second.error) return second;
    const msg2 = String(second.error?.message || '');
    if (/column .*user_id/i.test(msg2) || /user_id/i.test(msg2) || /schema cache/i.test(msg2)) {
      return supabase.from('sensor_readings').insert(base).select('*').single();
    }
    return second;
  }
  return first;
}

function applyUserFilter(query, userId) {
  if (!userId) return query;
  return query.or(`userId.eq.${userId},user_id.eq.${userId}`);
}

async function querySensorHistory(supabase, { userId, deviceId, limit, beforeIso }) {
  const userColumns = userId ? ['userId', 'user_id'] : [null];
  const timestampColumns = ['createdAt', 'created_at'];
  const deviceColumns = deviceId ? ['deviceId', 'device_id'] : [null];
  let lastError = null;

  for (const userColumn of userColumns) {
    for (const timestampColumn of timestampColumns) {
      for (const deviceColumn of deviceColumns) {
        let query = supabase.from('sensor_readings').select('*').order(timestampColumn, { ascending: false }).limit(limit);
        if (userColumn) query = query.eq(userColumn, userId);
        if (deviceColumn) query = query.eq(deviceColumn, deviceId);
        if (beforeIso) query = query.lt(timestampColumn, beforeIso);
        const result = await query;
        if (!result.error) return result;
        lastError = result.error;
      }
    }
  }

  return { data: null, error: lastError || new Error('Failed to query sensor history') };
}

router.post('/ingest', async (req, res) => {
  try {
    const auth = requireDeviceKey(req);
    if (!auth.ok) return res.status(401).json({ error: auth.error, code: auth.code });

    const deviceId = String(req.body?.deviceId || req.body?.device_id || '').trim() || 'esp32';
    const temperature = normalizeNumber(req.body?.temperature);
    const humidity = normalizeNumber(req.body?.humidity);
    const soilMoisture = normalizeNumber(req.body?.soilMoisture ?? req.body?.soil_moisture ?? req.body?.soil);
    const soilPh = normalizeNumber(req.body?.soilPh ?? req.body?.soil_ph ?? req.body?.soilPH);
    const createdAt = coerceCreatedAt(req.body?.createdAt ?? req.body?.created_at);

    const supabase = getSupabaseAdmin();
    const { data, error } = await insertReading(
      supabase,
      { deviceId, temperature, humidity, soilMoisture, soilPh, createdAt },
      String(req.body?.userId || req.body?.user_id || '').trim() || '',
    );

    if (error || !data) {
      const msg = String(error?.message || 'Failed to save reading');
      return res.status(500).json({ error: msg, code: 'READING_SAVE_FAILED' });
    }

    return res.status(201).json({ ok: true, reading: rowToReadingDto(data) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to ingest reading', code: 'READING_INGEST_FAILED' });
  }
});

router.post('/ingest-auth', requireAuth, async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || req.body?.device_id || '').trim() || 'esp32';
    const temperature = normalizeNumber(req.body?.temperature);
    const humidity = normalizeNumber(req.body?.humidity);
    const soilMoisture = normalizeNumber(req.body?.soilMoisture ?? req.body?.soil_moisture ?? req.body?.soil);
    const soilPh = normalizeNumber(req.body?.soilPh ?? req.body?.soil_ph ?? req.body?.soilPH);
    const createdAt = coerceCreatedAt(req.body?.createdAt ?? req.body?.created_at);

    const supabase = getSupabaseAdmin();
    const { data, error } = await insertReading(
      supabase,
      { deviceId, temperature, humidity, soilMoisture, soilPh, createdAt },
      req.userId,
    );

    if (error || !data) {
      const msg = String(error?.message || 'Failed to save reading');
      return res.status(500).json({ error: msg, code: 'READING_SAVE_FAILED' });
    }

    return res.status(201).json({ ok: true, reading: rowToReadingDto(data) });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to ingest reading', code: 'READING_INGEST_FAILED' });
  }
});

router.get('/latest', requireAuth, async (req, res) => {
  try {
    const deviceId = String(req.query?.deviceId || req.query?.device_id || '').trim();
    const supabase = getSupabaseAdmin();
    let q = supabase.from('sensor_readings').select('*').order('createdAt', { ascending: false }).limit(1);
    q = applyUserFilter(q, req.userId);
    if (deviceId) q = q.eq('deviceId', deviceId);
    let data;
    let error;
    ({ data, error } = await q);
    if (error) {
      const msg = String(error?.message || '');
      if (/userId|user_id|column/i.test(msg)) {
        let q2 = supabase.from('sensor_readings').select('*').order('createdAt', { ascending: false }).limit(1);
        if (deviceId) q2 = q2.eq('deviceId', deviceId);
        ({ data, error } = await q2);
      }
    }
    if (error) return res.status(500).json({ error: 'Failed to load reading' });
    const row = Array.isArray(data) ? data[0] : null;
    return res.json({ reading: row ? rowToReadingDto(row) : null });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to load reading' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const deviceId = String(req.query?.deviceId || req.query?.device_id || '').trim();
    const limitRaw = Number(req.query?.limit || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const beforeMs = Number(req.query?.before || 0);
    const beforeIso = Number.isFinite(beforeMs) && beforeMs > 0 ? new Date(beforeMs).toISOString() : '';

    const supabase = getSupabaseAdmin();
    const { data, error } = await querySensorHistory(supabase, { userId: req.userId, deviceId, limit, beforeIso });
    if (error) {
      console.error('[sensors/history] database query failed:', error);
      return res.status(500).json({ error: 'Failed to load readings', code: 'SENSOR_HISTORY_QUERY_FAILED' });
    }
    const readings = (Array.isArray(data) ? data : []).map(rowToReadingDto);
    return res.json({ readings });
  } catch (err) {
    console.error('[sensors/history] handler failed:', err);
    return res.status(500).json({ error: 'Failed to load readings', code: 'SENSOR_HISTORY_QUERY_FAILED' });
  }
});

export default router;
