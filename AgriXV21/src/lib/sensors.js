const READINGS_KEY = 'agrix_sensor_readings';
const THRESHOLDS_KEY = 'agrix_sensor_thresholds';
const SNAPSHOT_KEY = 'agrix_latest_snapshot';
const SNAPSHOTS_KEY = 'agrix_snapshots';
const DEVICE_KEY = 'agrix_device_meta';
const RULES_KEY = 'agrix_alert_rules';
const ALERT_STATE_KEY = 'agrix_alert_state';
const IOT_SOCKET_URL_KEY = 'agrix_iot_socket_url';
const MAX_READINGS = 288;
const MAX_SNAPSHOTS = 60;

let memoryReadings = [];
let memoryThresholds = {
  humidity: { min: 50, max: 60 },
  temperature: { min: 35, max: 45 },
};
let memorySnapshot = null;
let memorySnapshots = [];
let memoryDeviceMeta = { deviceName: 'ESP32', firmwareVersion: '', wifiStrength: null };
let memoryRules = {
  humidityHighMinutes: 10,
  temperatureHighMinutes: 10,
  moldRiskMinutes: 60,
  forecastHours: 6,
  escalationMinutes: 30,
  offlineMinutes: 5,
};
let memoryAlertState = {};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitChange(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent('agrix:sensors', { detail }));
  } catch (_err) {}
}

function readJson(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_err) {}
}

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) return '';
  return v.replace(/\/+$/, '');
}

function readRuntimeConfig() {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.__AGRIX_RUNTIME_CONFIG__;
    if (!v || typeof v !== 'object') return null;
    return v;
  } catch (_err) {
    return null;
  }
}

export function getIotSocketUrl() {
  const stored = canUseStorage() ? normalizeUrl(readJson(IOT_SOCKET_URL_KEY, '')) : '';
  if (stored) return stored;
  const runtime = readRuntimeConfig();
  const fromEnv = normalizeUrl(runtime?.iotSocketUrl || process.env.EXPO_PUBLIC_IOT_SOCKET_URL);
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = String(window.location.hostname || '').trim();
    if (host) return normalizeUrl(`http://${host}:4012`);
  }
  return '';
}

export function setIotSocketUrl(value) {
  const next = normalizeUrl(value);
  if (canUseStorage()) {
    if (next) writeJson(IOT_SOCKET_URL_KEY, next);
    else {
      try {
        window.localStorage.removeItem(IOT_SOCKET_URL_KEY);
      } catch (_err) {}
    }
  }
  emitChange({ type: 'iot_config_updated', iotSocketUrl: next });
  return next;
}

export function getIotIngestUrl() {
  const base = getIotSocketUrl();
  if (!base) return '';
  return `${base}/sensors/ingest`;
}

export function listSensorReadings() {
  const raw = canUseStorage() ? readJson(READINGS_KEY, []) : memoryReadings;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice()
    .filter((r) => r && typeof r === 'object')
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
    .slice(0, MAX_READINGS);
}

export function getLatestSensorReading() {
  return listSensorReadings()[0] || null;
}

export function addSensorReading(payload) {
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    temperature: normalizeNumber(payload?.temperature),
    humidity: normalizeNumber(payload?.humidity),
    soilPh: normalizeNumber(payload?.soilPh),
    soilMoisture: normalizeNumber(payload?.soilMoisture),
    createdAt: Number(payload?.createdAt || Date.now()),
    source: String(payload?.source || 'manual'),
  };
  const next = [item, ...listSensorReadings()].slice(0, MAX_READINGS);
  if (!canUseStorage()) {
    memoryReadings = next;
  } else {
    writeJson(READINGS_KEY, next);
  }
  emitChange({ type: 'reading_added', reading: item });
  return item;
}

export function getSensorThresholds() {
  const raw = canUseStorage() ? readJson(THRESHOLDS_KEY, null) : null;
  const base = raw && typeof raw === 'object' ? raw : memoryThresholds;
  const humidity = base?.humidity && typeof base.humidity === 'object' ? base.humidity : memoryThresholds.humidity;
  const temperature =
    base?.temperature && typeof base.temperature === 'object' ? base.temperature : memoryThresholds.temperature;
  return {
    humidity: { min: normalizeNumber(humidity.min) ?? memoryThresholds.humidity.min, max: normalizeNumber(humidity.max) ?? memoryThresholds.humidity.max },
    temperature: { min: normalizeNumber(temperature.min) ?? memoryThresholds.temperature.min, max: normalizeNumber(temperature.max) ?? memoryThresholds.temperature.max },
  };
}

export function setSensorThresholds(next) {
  const sanitized = {
    humidity: {
      min: normalizeNumber(next?.humidity?.min) ?? memoryThresholds.humidity.min,
      max: normalizeNumber(next?.humidity?.max) ?? memoryThresholds.humidity.max,
    },
    temperature: {
      min: normalizeNumber(next?.temperature?.min) ?? memoryThresholds.temperature.min,
      max: normalizeNumber(next?.temperature?.max) ?? memoryThresholds.temperature.max,
    },
  };
  if (!canUseStorage()) {
    memoryThresholds = sanitized;
  } else {
    writeJson(THRESHOLDS_KEY, sanitized);
  }
  emitChange({ type: 'thresholds_updated', thresholds: sanitized });
  return sanitized;
}

export function getLatestSnapshot() {
  const raw = canUseStorage() ? readJson(SNAPSHOT_KEY, null) : memorySnapshot;
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw?.url || '').trim();
  if (!url) return null;
  return {
    url,
    createdAt: Number(raw?.createdAt || 0) || 0,
  };
}

export function setLatestSnapshot(payload) {
  const url = String(payload?.url || '').trim();
  if (!url) return null;
  const item = { url, createdAt: Number(payload?.createdAt || Date.now()) };
  if (!canUseStorage()) {
    memorySnapshot = item;
  } else {
    writeJson(SNAPSHOT_KEY, item);
  }
  addSnapshot(item);
  emitChange({ type: 'snapshot_updated', snapshot: item });
  return item;
}

export function listSnapshots() {
  const raw = canUseStorage() ? readJson(SNAPSHOTS_KEY, []) : memorySnapshots;
  if (!Array.isArray(raw)) return [];
  return raw
    .slice()
    .filter((s) => s && typeof s === 'object' && String(s.url || '').trim())
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
    .slice(0, MAX_SNAPSHOTS);
}

export function addSnapshot(payload) {
  const url = String(payload?.url || '').trim();
  if (!url) return null;
  const item = {
    id: String(payload?.id || '') || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    url,
    createdAt: Number(payload?.createdAt || Date.now()),
  };
  const next = [item, ...listSnapshots()].slice(0, MAX_SNAPSHOTS);
  if (!canUseStorage()) {
    memorySnapshots = next;
  } else {
    writeJson(SNAPSHOTS_KEY, next);
  }
  emitChange({ type: 'snapshot_added', snapshot: item });
  return item;
}

export function getDeviceMeta() {
  const raw = canUseStorage() ? readJson(DEVICE_KEY, null) : null;
  const base = raw && typeof raw === 'object' ? raw : memoryDeviceMeta;
  const wifiStrength = normalizeNumber(base?.wifiStrength);
  return {
    deviceName: String(base?.deviceName || memoryDeviceMeta.deviceName),
    firmwareVersion: String(base?.firmwareVersion || memoryDeviceMeta.firmwareVersion),
    wifiStrength: wifiStrength === null ? null : wifiStrength,
  };
}

export function setDeviceMeta(next) {
  const sanitized = {
    deviceName: String(next?.deviceName || memoryDeviceMeta.deviceName),
    firmwareVersion: String(next?.firmwareVersion || memoryDeviceMeta.firmwareVersion),
    wifiStrength: normalizeNumber(next?.wifiStrength),
  };
  if (!canUseStorage()) {
    memoryDeviceMeta = sanitized;
  } else {
    writeJson(DEVICE_KEY, sanitized);
  }
  emitChange({ type: 'device_updated', device: sanitized });
  return sanitized;
}

export function getAlertRules() {
  const raw = canUseStorage() ? readJson(RULES_KEY, null) : null;
  const base = raw && typeof raw === 'object' ? raw : memoryRules;
  const clamp = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const clampForecastHours = (v, d) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.max(1, Math.min(6, Math.round(n)));
  };
  return {
    humidityHighMinutes: clamp(base?.humidityHighMinutes, memoryRules.humidityHighMinutes),
    temperatureHighMinutes: clamp(base?.temperatureHighMinutes, memoryRules.temperatureHighMinutes),
    moldRiskMinutes: clamp(base?.moldRiskMinutes, memoryRules.moldRiskMinutes),
    forecastHours: clampForecastHours(base?.forecastHours, memoryRules.forecastHours),
    escalationMinutes: clamp(base?.escalationMinutes, memoryRules.escalationMinutes),
    offlineMinutes: clamp(base?.offlineMinutes, memoryRules.offlineMinutes),
  };
}

export function setAlertRules(next) {
  const clamp = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  const clampForecastHours = (v, d) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.max(1, Math.min(6, Math.round(n)));
  };
  const sanitized = {
    humidityHighMinutes: clamp(next?.humidityHighMinutes, memoryRules.humidityHighMinutes),
    temperatureHighMinutes: clamp(next?.temperatureHighMinutes, memoryRules.temperatureHighMinutes),
    moldRiskMinutes: clamp(next?.moldRiskMinutes, memoryRules.moldRiskMinutes),
    forecastHours: clampForecastHours(next?.forecastHours, memoryRules.forecastHours),
    escalationMinutes: clamp(next?.escalationMinutes, memoryRules.escalationMinutes),
    offlineMinutes: clamp(next?.offlineMinutes, memoryRules.offlineMinutes),
  };
  if (!canUseStorage()) {
    memoryRules = sanitized;
  } else {
    writeJson(RULES_KEY, sanitized);
  }
  emitChange({ type: 'rules_updated', rules: sanitized });
  return sanitized;
}

export function getAlertState() {
  const raw = canUseStorage() ? readJson(ALERT_STATE_KEY, {}) : memoryAlertState;
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

export function setAlertState(next) {
  const safe = next && typeof next === 'object' ? next : {};
  if (!canUseStorage()) {
    memoryAlertState = safe;
  } else {
    writeJson(ALERT_STATE_KEY, safe);
  }
  emitChange({ type: 'alert_state_updated' });
  return safe;
}

export function computeBlackAspergillusRisk(latestReading, readings, options) {
  const latest = latestReading && typeof latestReading === 'object' ? latestReading : null;
  if (!latest) return { level: 'unknown', score: 0, minutesInRiskZone: 0, reason: 'No reading.' };

  const h = Number(latest?.humidity);
  const t = Number(latest?.temperature);
  if (!Number.isFinite(h) || !Number.isFinite(t)) {
    return { level: 'unknown', score: 0, minutesInRiskZone: 0, reason: 'Missing humidity/temperature.' };
  }

  const windowMs = Math.max(0, Number(options?.windowMs || 24 * 60 * 60 * 1000));
  const now = Date.now();
  const minTs = now - windowMs;

  const isRiskZone = (hh, tt) => {
    if (!Number.isFinite(hh) || !Number.isFinite(tt)) return false;
    return hh >= 70 && tt >= 25 && tt <= 37;
  };

  const history = Array.isArray(readings) ? readings : [];
  const filtered = history
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      ts: Number(r?.createdAt || 0),
      h: Number(r?.humidity),
      t: Number(r?.temperature),
    }))
    .filter((r) => Number.isFinite(r.ts) && r.ts > 0 && r.ts >= minTs)
    .sort((a, b) => a.ts - b.ts);

  let minutesInRiskZone = 0;
  for (let i = 1; i < filtered.length; i += 1) {
    const a = filtered[i - 1];
    const b = filtered[i];
    if (isRiskZone(a.h, a.t) && isRiskZone(b.h, b.t)) {
      minutesInRiskZone += Math.max(0, Math.min(windowMs, b.ts - a.ts)) / 60000;
    }
  }

  let score = 0;
  score += Math.min(100, (minutesInRiskZone / 360) * 100);
  if (h >= 80) score += 10;
  if (h >= 85) score += 10;
  if (t >= 30 && t <= 35) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 70 ? 'high' : score >= 30 ? 'moderate' : 'low';
  const reason = `Risk-zone time (24h): ${Math.round(minutesInRiskZone)} min. Current: ${h.toFixed(1)}% RH, ${t.toFixed(1)}°C.`;

  return { level, score, minutesInRiskZone: Math.round(minutesInRiskZone), reason };
}

function fitLine(points) {
  const pts = Array.isArray(points) ? points : [];
  if (pts.length < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  let n = 0;

  for (const p of pts) {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    n += 1;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  if (n < 2) return null;
  const denom = n * sumXX - sumX * sumX;
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  return { slope, intercept };
}

export function computeMoldRiskForecast(latestReading, readings, options) {
  const latest = latestReading && typeof latestReading === 'object' ? latestReading : null;
  if (!latest) return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'No reading.' };

  const currentH = Number(latest?.humidity);
  const currentT = Number(latest?.temperature);
  if (!Number.isFinite(currentH) || !Number.isFinite(currentT)) {
    return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'Missing humidity/temperature.' };
  }

  const isRiskZone = (hh, tt) => Number.isFinite(hh) && Number.isFinite(tt) && hh >= 70 && tt >= 25 && tt <= 37;
  if (isRiskZone(currentH, currentT)) {
    return { level: 'now', hoursToRisk: 0, predicted: { humidity: currentH, temperature: currentT }, reason: 'Already in risk zone.' };
  }

  const history = Array.isArray(readings) ? readings : [];
  const now = Date.now();
  const windowMs = Math.max(10 * 60 * 1000, Number(options?.windowMs || 6 * 60 * 60 * 1000));
  const minTs = now - windowMs;
  const maxPoints = Math.max(10, Number(options?.maxPoints || 120));
  const stepMinutes = Math.max(5, Number(options?.stepMinutes || 10));
  const horizonHours = Math.max(1, Math.min(6, Number(options?.horizonHours || 6)));

  const raw = history
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({ ts: Number(r?.createdAt || 0), h: Number(r?.humidity), t: Number(r?.temperature) }))
    .filter((r) => Number.isFinite(r.ts) && r.ts >= minTs && Number.isFinite(r.h) && Number.isFinite(r.t))
    .sort((a, b) => a.ts - b.ts)
    .slice(-maxPoints);

  if (raw.length < 3) {
    return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'Not enough recent readings to forecast.' };
  }

  const pointsH = raw.map((r) => ({ x: (r.ts - now) / 3600000, y: r.h }));
  const pointsT = raw.map((r) => ({ x: (r.ts - now) / 3600000, y: r.t }));
  const fitH = fitLine(pointsH);
  const fitT = fitLine(pointsT);
  if (!fitH || !fitT) {
    return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'Forecast fit failed.' };
  }

  let hoursToRisk = null;
  let predicted = null;
  const maxMinutes = Math.round(horizonHours * 60);
  for (let m = stepMinutes; m <= maxMinutes; m += stepMinutes) {
    const x = m / 60;
    const hh = fitH.intercept + fitH.slope * x;
    const tt = fitT.intercept + fitT.slope * x;
    if (isRiskZone(hh, tt)) {
      hoursToRisk = x;
      predicted = { humidity: hh, temperature: tt };
      break;
    }
  }

  if (hoursToRisk === null) {
    return {
      level: 'safe',
      hoursToRisk: null,
      predicted: null,
      reason: `No risk-zone entry predicted within ${horizonHours} hour(s).`,
    };
  }

  const level = hoursToRisk <= 1 ? 'imminent' : 'soon';
  const reason = `Forecast enters risk zone in ~${hoursToRisk.toFixed(1)} hour(s). Predicted: ${predicted.humidity.toFixed(
    1,
  )}% RH, ${predicted.temperature.toFixed(1)}°C.`;
  return { level, hoursToRisk, predicted: { humidity: Number(predicted.humidity.toFixed(1)), temperature: Number(predicted.temperature.toFixed(1)) }, reason };
}

export function computeRiskLevel(reading, thresholds) {
  const h = Number(reading?.humidity);
  const t = Number(reading?.temperature);
  const hasH = Number.isFinite(h);
  const hasT = Number.isFinite(t);
  if (!hasH && !hasT) return 'unknown';
  const hMin = Number(thresholds?.humidity?.min);
  const hMax = Number(thresholds?.humidity?.max);
  const tMin = Number(thresholds?.temperature?.min);
  const tMax = Number(thresholds?.temperature?.max);

  const hOut = hasH && (h < hMin || h > hMax);
  const tOut = hasT && (t < tMin || t > tMax);
  if (!hOut && !tOut) return 'low';
  if (hOut && tOut) return 'high';
  return 'moderate';
}

export function isReadingFresh(reading, maxAgeMs) {
  const ts = Number(reading?.createdAt || 0);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts <= Math.max(0, Number(maxAgeMs || 0));
}

export function subscribeSensors(listener) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = (event) => {
    if (typeof listener === 'function') listener(event?.detail || { type: 'updated' });
  };
  window.addEventListener('agrix:sensors', handler);
  return () => window.removeEventListener('agrix:sensors', handler);
}

let activeSync = null;

async function fetchJson(url, token) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.code = data?.code;
    throw err;
  }
  return data;
}

export function startSensorSync(options) {
  const baseUrl = String(options?.baseUrl || '').trim().replace(/\/$/, '');
  if (!baseUrl) return () => {};
  const getToken = typeof options?.getToken === 'function' ? options.getToken : () => '';
  const deviceId = String(options?.deviceId || '').trim();
  const pollMs = Math.max(1000, Number(options?.pollMs || 5000));
  if (activeSync?.running) return activeSync.stop;

  let stopped = false;
  let timerId = null;
  let lastSeen = 0;

  const stop = () => {
    stopped = true;
    if (timerId) clearInterval(timerId);
    timerId = null;
    activeSync = null;
  };

  const seedFromHistory = async () => {
    const token = String(getToken() || '').trim();
    if (!token) return;
    const url = `${baseUrl}/sensors/history?limit=120${deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ''}`;
    const data = await fetchJson(url, token);
    const existing = new Set(listSensorReadings().map((r) => Number(r?.createdAt || 0)).filter((n) => Number.isFinite(n) && n > 0));
    const incoming = Array.isArray(data?.readings) ? data.readings : [];
    const ordered = incoming.slice().sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
    for (const r of ordered) {
      const ts = Number(r?.createdAt || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (existing.has(ts)) continue;
      addSensorReading({ ...r, source: 'api' });
      if (ts > lastSeen) lastSeen = ts;
    }
  };

  const pollLatest = async () => {
    const token = String(getToken() || '').trim();
    if (!token) return;
    const url = `${baseUrl}/sensors/latest${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''}`;
    const data = await fetchJson(url, token);
    const r = data?.reading;
    if (!r) return;
    const ts = Number(r?.createdAt || 0);
    if (!Number.isFinite(ts) || ts <= 0) return;
    if (ts <= lastSeen) return;
    lastSeen = ts;
    addSensorReading({ ...r, source: 'api' });
  };

  (async () => {
    try {
      lastSeen = Number(getLatestSensorReading()?.createdAt || 0) || 0;
      await seedFromHistory();
      await pollLatest();
    } catch (_err) {
    }
    if (stopped) return;
    timerId = setInterval(() => {
      if (stopped) return;
      pollLatest().catch(() => {});
    }, pollMs);
  })();

  activeSync = { running: true, stop };
  return stop;
}

export function stopSensorSync() {
  if (activeSync?.running && typeof activeSync.stop === 'function') {
    activeSync.stop();
  }
}
