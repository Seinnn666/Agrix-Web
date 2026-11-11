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

function logSensorQueryFailure(route, error) {
  console.error(`[sensors/${route}] query failed:`, {
    message: error?.message || 'Unknown database query error',
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    stack: error?.stack,
  });
}

function rowToReadingDto(row) {
  const created = row?.createdAt || row?.created_at || row?.createdat;
  const ms = created ? Date.parse(String(created)) : 0;
  return {
    id: String(row?._id || row?.id || ''),
    deviceId: String(row?.deviceId || row?.device_id || row?.deviceid || ''),
    temperature: normalizeNumber(row?.temperature),
    humidity: normalizeNumber(row?.humidity),
    soilMoisture: normalizeNumber(row?.soilMoisture ?? row?.soil_moisture ?? row?.soilmoisture),
    soilPh: normalizeNumber(row?.soilPh ?? row?.soil_ph),
    createdAt: Number.isFinite(ms) && ms > 0 ? ms : Date.now(),
  };
}

async function insertReading(supabase, payload, userId) {
  const base = {
    _id: newObjectId(),
    deviceid: payload.deviceId,
    temperature: payload.temperature,
    humidity: payload.humidity,
    ...(payload.soilMoisture == null ? {} : { soilmoisture: payload.soilMoisture }),
    ...(payload.soilPh == null ? {} : { soilph: payload.soilPh }),
    // sensor_readings uses the SQL-style timestamp column; the DTO still
    // exposes createdAt to the frontend.
    createdat: payload.createdAt,
  };

  if (!userId) {
    const { data, error } = await supabase.from('sensor_readings').insert(base).select('*').single();
    return { data, error };
  }

  let lastResult = null;
  for (const userColumn of ['userId', 'user_id', 'userid']) {
    const result = await supabase
      .from('sensor_readings')
      .insert({ ...base, [userColumn]: userId })
      .select('*')
      .single();
    if (!result.error) return result;
    lastResult = result;
    const message = String(result.error?.message || '');
    if (!/schema cache|could not find.*column|column .* does not exist/i.test(message)) return result;
  }

  return lastResult || { data: null, error: new Error('Could not associate sensor reading with the signed-in user') };
}

async function querySensorHistory(supabase, { userId, deviceId, limit, beforeIso }) {
  const userColumns = userId ? ['userId', 'user_id', 'userid'] : [null];
  const timestampColumns = ['createdAt', 'created_at', 'createdat'];
  const deviceColumns = deviceId ? ['deviceId', 'device_id', 'deviceid'] : [null];
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
    const { data, error } = await querySensorHistory(supabase, { userId: req.userId, deviceId, limit: 1, beforeIso: '' });
    if (error) {
      logSensorQueryFailure('latest', error);
      return res.status(500).json({ error: 'Failed to load reading', code: 'SENSOR_LATEST_QUERY_FAILED' });
    }
    const row = Array.isArray(data) ? data[0] : null;
    return res.json({ reading: row ? rowToReadingDto(row) : null });
  } catch (err) {
    logSensorQueryFailure('latest', err);
    return res.status(500).json({ error: 'Failed to load reading', code: 'SENSOR_LATEST_QUERY_FAILED' });
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
      logSensorQueryFailure('history', error);
      return res.status(500).json({ error: 'Failed to load readings', code: 'SENSOR_HISTORY_QUERY_FAILED' });
    }
    const readings = (Array.isArray(data) ? data : []).map(rowToReadingDto);
    return res.json({ readings });
  } catch (err) {
    logSensorQueryFailure('history', err);
    return res.status(500).json({ error: 'Failed to load readings', code: 'SENSOR_HISTORY_QUERY_FAILED' });
  }
});

export default router;
