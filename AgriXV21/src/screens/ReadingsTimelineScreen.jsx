import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import AgriXLogo from '../components/AgriXLogo';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import ConfirmDialog from '../components/ConfirmDialog';
import { dashboardStyles as layoutStyles } from '../components/dashboard/dashboardStyles';
import { theme } from '../ui/theme';
import { getApiJson, clearAuth } from '../lib/authApi';
import { clearAdminAuth, hasAdminPanelAccess } from '../lib/adminApi';
import { ChevronRight, Moon, Sun } from '../components/Icons';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';
import { listNotifications } from '../lib/notifications';
import { getAlertRules, getSensorThresholds, listSensorReadings, subscribeSensors } from '../lib/sensors';

function fmtNumber(v, suffix = '') {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}${suffix}` : '—';
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function niceStep(span, targetTicks) {
  const s = Math.max(1e-9, Number(span) || 1);
  const raw = s / Math.max(2, Number(targetTicks) || 5);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function niceTicks(min, max, count) {
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) return [lo];
  const step = niceStep(hi - lo, count);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const out = [];
  for (let v = start; v <= end + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function movingAverage(series, windowSize) {
  const w = Math.max(1, Math.min(25, Math.floor(Number(windowSize) || 5)));
  if (!Array.isArray(series) || series.length < 3 || w <= 1) return series || [];
  const out = [];
  for (let i = 0; i < series.length; i += 1) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - (w - 1));
    for (let j = start; j <= i; j += 1) {
      const y = Number(series[j]?.y);
      if (!Number.isFinite(y)) continue;
      sum += y;
      count += 1;
    }
    const x = Number(series[i]?.x);
    if (!Number.isFinite(x)) continue;
    if (!count) continue;
    out.push({ x, y: sum / count });
  }
  return out;
}

function formatAxisTime(ts, rangeKey) {
  const d = new Date(Number(ts));
  if (rangeKey === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (rangeKey === '7d') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReadingsTimelineScreen({ navigation, route }) {
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const canAccessAdmin = hasAdminPanelAccess();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';
  const { width: windowWidth } = useWindowDimensions();

  const screenMode = String(route?.params?.mode || 'timeline');
  const isGraphMode = screenMode === 'graphs';

  const [range, setRange] = useState('24h');
  const [metric, setMetric] = useState('all');
  const [smoothEnabled, setSmoothEnabled] = useState(false);
  const [viewByKey, setViewByKey] = useState({});
  const [exportStatus, setExportStatus] = useState('');
  const [readings, setReadings] = useState(() => listSensorReadings());
  const [historyReadings, setHistoryReadings] = useState([]);
  const [historyStatus, setHistoryStatus] = useState({ loading: false, error: '' });
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState(0);

  const mergeByTimestamp = (base, incoming) => {
    const map = new Map();
    for (const r of [...incoming, ...base]) {
      const ts = Number(r?.createdAt || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (!map.has(ts)) map.set(ts, r);
    }
    return Array.from(map.values()).sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  };

  const fetchHistoryPage = async ({ limit = 500, before = 0 } = {}) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(1, Math.min(500, Number(limit) || 500))));
    if (before && Number.isFinite(Number(before)) && Number(before) > 0) qs.set('before', String(Math.floor(Number(before))));
    const data = await getApiJson(`/sensors/history?${qs.toString()}`);
    return Array.isArray(data?.readings) ? data.readings : [];
  };

  const loadHistoryForRange = async (nextRange) => {
    const windowMs = nextRange === '24h' ? 24 * 60 * 60 * 1000 : nextRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : Infinity;
    const now = Date.now();
    const targetMinTs = windowMs === Infinity ? 0 : now - windowMs;

    setHistoryStatus({ loading: true, error: '' });
    try {
      let combined = [];
      let before = 0;
      let pages = 0;

      while (pages < 4) {
        pages += 1;
        const page = await fetchHistoryPage({ limit: 500, before });
        if (!page.length) break;
        combined = mergeByTimestamp(combined, page);

        const oldest = combined.reduce((min, r) => {
          const ts = Number(r?.createdAt || 0);
          if (!Number.isFinite(ts) || ts <= 0) return min;
          return min === 0 ? ts : Math.min(min, ts);
        }, 0);
        before = oldest > 0 ? oldest - 1 : 0;
        if (targetMinTs && oldest && oldest <= targetMinTs) break;
        if (page.length < 500) break;
      }

      const oldestLoaded = combined.reduce((min, r) => {
        const ts = Number(r?.createdAt || 0);
        if (!Number.isFinite(ts) || ts <= 0) return min;
        return min === 0 ? ts : Math.min(min, ts);
      }, 0);

      setHistoryCursor(oldestLoaded || 0);
      setHistoryHasMore(Boolean(oldestLoaded));
      setHistoryReadings(combined);
      setHistoryStatus({ loading: false, error: '' });
    } catch (err) {
      const message = err?.code === 'API_AUTH_REJECTED'
        ? 'Session expired. Please log in again.'
        : err?.code === 'SENSOR_HISTORY_QUERY_FAILED'
          ? 'The server could not query reading history. Check the server log for details.'
          : (err?.message || 'Failed to load history');
      setHistoryStatus({ loading: false, error: message });
    }
  };

  const loadMoreHistory = async () => {
    if (!historyCursor) return;
    setHistoryStatus((s) => ({ ...s, loading: true, error: '' }));
    try {
      const page = await fetchHistoryPage({ limit: 500, before: historyCursor - 1 });
      const combined = mergeByTimestamp(historyReadings, page);
      const oldestLoaded = combined.reduce((min, r) => {
        const ts = Number(r?.createdAt || 0);
        if (!Number.isFinite(ts) || ts <= 0) return min;
        return min === 0 ? ts : Math.min(min, ts);
      }, 0);
      setHistoryCursor(oldestLoaded || 0);
      setHistoryHasMore(page.length === 500 && Boolean(oldestLoaded));
      setHistoryReadings(combined);
      setHistoryStatus({ loading: false, error: '' });
    } catch (err) {
      setHistoryStatus({
        loading: false,
        error: err?.code === 'API_AUTH_REJECTED'
          ? 'Session expired. Please log in again.'
          : err?.message || 'Failed to load more history',
      });
    }
  };

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => setReadings(listSensorReadings());
    const unsub = subscribeSensors(refresh);
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    loadHistoryForRange(range).catch(() => {});
  }, [range]);

  useEffect(() => {
    setViewByKey({});
  }, [range, metric]);

  const combinedReadings = useMemo(() => mergeByTimestamp(readings, historyReadings), [historyReadings, readings]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const windowMs = range === '24h' ? 24 * 60 * 60 * 1000 : range === '7d' ? 7 * 24 * 60 * 60 * 1000 : Infinity;
    return combinedReadings
      .filter((r) => {
        const ts = Number(r?.createdAt);
        if (!Number.isFinite(ts) || ts <= 0 || ts > now) return false;
        return windowMs === Infinity || now - ts <= windowMs;
      })
      .filter((r) => {
        if (metric === 'all') return true;
        if (metric === 'humidity') return r?.humidity != null && r.humidity !== '' && Number.isFinite(Number(r.humidity));
        if (metric === 'temperature') return r?.temperature != null && r.temperature !== '' && Number.isFinite(Number(r.temperature));
        if (metric === 'soilMoisture') return r?.soilMoisture != null && r.soilMoisture !== '' && Number.isFinite(Number(r.soilMoisture));
        return true;
      });
  }, [combinedReadings, metric, range]);

  const chartSeries = useMemo(() => {
    const points = filtered
      .slice()
      .filter((r) => Number.isFinite(Number(r?.createdAt || 0)))
      .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));

    const toSeries = (key) => {
      const raw = points
        .map((r) => ({ x: Number(r.createdAt), y: Number(r?.[key]) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

      const maxPts = 220;
      if (raw.length <= maxPts) return raw;
      const step = Math.ceil(raw.length / maxPts);
      const reduced = [];
      for (let i = 0; i < raw.length; i += step) reduced.push(raw[i]);
      if (reduced[reduced.length - 1]?.x !== raw[raw.length - 1]?.x) reduced.push(raw[raw.length - 1]);
      return reduced;
    };

    return {
      humidity: toSeries('humidity'),
      temperature: toSeries('temperature'),
      soilMoisture: toSeries('soilMoisture'),
    };
  }, [filtered]);

  const rules = getAlertRules();
  const thresholds = getSensorThresholds();
  const notifications = listNotifications();

  const eventMarkers = useMemo(() => {
    const out = [];
    const offlineMinutes = Math.max(0, Number(rules?.offlineMinutes || 0));
    const gapMs = offlineMinutes ? offlineMinutes * 60 * 1000 : 0;
    const sorted = combinedReadings
      .slice()
      .map((r) => ({ ts: Number(r?.createdAt || 0) }))
      .filter((r) => Number.isFinite(r.ts) && r.ts > 0)
      .sort((a, b) => a.ts - b.ts);
    if (gapMs && sorted.length >= 2) {
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1].ts;
        const next = sorted[i].ts;
        if (next - prev >= gapMs) {
          out.push({ ts: prev, kind: 'disconnect', label: 'Offline' });
        }
      }
    }
    const alertItems = notifications
      .filter((n) => {
        const level = String(n?.level || '').toLowerCase();
        return level === 'warning' || level === 'error';
      })
      .map((n) => ({
        ts: Number(n?.createdAt || 0),
        kind: 'alert',
        label: String(n?.title || '').trim() || 'Alert',
      }))
      .filter((n) => Number.isFinite(n.ts) && n.ts > 0);
    return [...out, ...alertItems].sort((a, b) => a.ts - b.ts);
  }, [combinedReadings, notifications, rules?.offlineMinutes]);

  const buildCsv = (rows) => {
    const safe = Array.isArray(rows) ? rows : [];
    const header = ['timestamp_ms', 'timestamp_local', 'humidity', 'temperature', 'bean_moisture', 'source'];
    const lines = [header.join(',')];
    for (const r of safe) {
      const ts = Number(r?.createdAt || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      const local = new Date(ts).toLocaleString();
      const h = Number(r?.humidity);
      const t = Number(r?.temperature);
      const bm = Number(r?.soilMoisture);
      const src = String(r?.source || '');
      lines.push(
        [
          String(Math.floor(ts)),
          `"${String(local).replace(/"/g, '""')}"`,
          Number.isFinite(h) ? h.toFixed(2) : '',
          Number.isFinite(t) ? t.toFixed(2) : '',
          Number.isFinite(bm) ? bm.toFixed(2) : '',
          `"${src.replace(/"/g, '""')}"`,
        ].join(','),
      );
    }
    return lines.join('\n');
  };

  const downloadText = async (filename, mime, text) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setExportStatus('Download is available on web.');
      return;
    }
    try {
      const blob = new Blob([String(text || '')], { type: String(mime || 'text/plain') });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(filename || 'export.txt');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportStatus(`Downloaded ${a.download}`);
      setTimeout(() => setExportStatus(''), 2500);
    } catch (_err) {
      setExportStatus('Download failed.');
    }
  };

  const LineChart = ({ chartKey, title, unit, xLabel, yLabel, color, series, recommendedBand, thresholdLines }) => {
    const [cursorTs, setCursorTs] = useState(0);
    const [cursorVisible, setCursorVisible] = useState(false);
    const w = Math.max(320, Number(windowWidth || 800) - 120);
    const h = 220;
    const padL = 62;
    const padR = 18;
    const padT = 16;
    const padB = 42;
    const plotW = Math.max(1, w - padL - padR);
    const plotH = Math.max(1, h - padT - padB);

    if (!series?.length) {
      return (
        <View style={[layoutStyles.card, isDark && styles.cardDark]}>
          <Text style={[styles.chartTitle, isDark && { color: '#F9FAFB' }]}>{title}</Text>
          <Text style={[styles.emptyText, isDark && styles.mutedDark]}>No data yet</Text>
        </View>
      );
    }

    const baseSeries = smoothEnabled ? movingAverage(series, 6) : series;
    const xs = baseSeries.map((p) => p.x);
    const ys = baseSeries.map((p) => p.y);
    const fullMinX = Math.min(...xs);
    const fullMaxX = Math.max(...xs);
    const fullMinY = Math.min(...ys);
    const fullMaxY = Math.max(...ys);
    const fullSpanX = Math.max(1, fullMaxX - fullMinX);

    const currentView = viewByKey?.[chartKey];
    const view = currentView && Number.isFinite(currentView?.minX) && Number.isFinite(currentView?.maxX) ? currentView : { minX: fullMinX, maxX: fullMaxX };
    const minX = clamp(view.minX, fullMinX, fullMaxX - 1);
    const maxX = clamp(view.maxX, fullMinX + 1, fullMaxX);
    const spanX = Math.max(1, maxX - minX);

    const inView = baseSeries.filter((p) => p.x >= minX && p.x <= maxX);
    const ysInView = inView.length ? inView.map((p) => p.y) : ys;
    const minY = Math.min(...ysInView);
    const maxY = Math.max(...ysInView);
    const spanY = Math.max(1e-9, maxY - minY);

    const xToPx = (x) => padL + ((x - minX) / spanX) * plotW;
    const yToPx = (y) => padT + (1 - (y - minY) / spanY) * plotH;

    const pts = inView
      .map((p) => `${xToPx(p.x).toFixed(1)},${yToPx(p.y).toFixed(1)}`)
      .join(' ');

    const yTicks = niceTicks(minY, maxY, 6);
    const xTicks = [minX, minX + spanX / 2, maxX].map((t) => Math.round(t));
    const axisColor = isDark ? '#1F2937' : '#E5E7EB';
    const labelColor = isDark ? '#9CA3AF' : theme.colors.textMuted;
    const gridColor = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.25)';

    const yLabelText = String(yLabel || '').trim();
    const xLabelText = String(xLabel || '').trim();
    const lastPoint = inView[inView.length - 1] || baseSeries[baseSeries.length - 1] || null;
    const nowY = lastPoint && Number.isFinite(Number(lastPoint.y)) ? Number(lastPoint.y) : null;

    const startLabel = formatAxisTime(minX, range);
    const midLabel = formatAxisTime(minX + spanX / 2, range);
    const endLabel = formatAxisTime(maxX, range);

    const findNearest = (ts) => {
      const target = Number(ts);
      if (!Number.isFinite(target)) return null;
      let best = null;
      let bestDist = Infinity;
      for (const p of inView) {
        const d = Math.abs(p.x - target);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    };

    const cursorPoint = cursorVisible ? findNearest(cursorTs) : null;
    const cursorX = cursorPoint ? xToPx(cursorPoint.x) : 0;
    const cursorY = cursorPoint ? yToPx(cursorPoint.y) : 0;

    const tooltipText1 = cursorPoint ? `${title}: ${fmtNumber(cursorPoint.y, unit)}` : '';
    const tooltipText2 = cursorPoint ? new Date(cursorPoint.x).toLocaleString() : '';

    const markerInView = eventMarkers.filter((m) => m.ts >= minX && m.ts <= maxX);
    const recommended = recommendedBand && Number.isFinite(recommendedBand?.min) && Number.isFinite(recommendedBand?.max) ? recommendedBand : null;

    const updateFromEvent = (evt) => {
      const x = Number(evt?.nativeEvent?.locationX);
      if (!Number.isFinite(x)) return;
      const px = clamp(x, padL, padL + plotW);
      const ts = minX + ((px - padL) / plotW) * spanX;
      setCursorTs(ts);
      setCursorVisible(true);
    };

    const setView = (next) => {
      setViewByKey((s) => ({ ...s, [chartKey]: next }));
    };

    const resetView = () => setView({ minX: fullMinX, maxX: fullMaxX });
    const zoom = (factor) => {
      const center = (minX + maxX) / 2;
      const nextSpan = clamp(spanX * factor, Math.max(5 * 60 * 1000, fullSpanX * 0.01), fullSpanX);
      const nextMin = clamp(center - nextSpan / 2, fullMinX, fullMaxX - nextSpan);
      const nextMax = clamp(nextMin + nextSpan, nextMin + 1, fullMaxX);
      setView({ minX: nextMin, maxX: nextMax });
    };
    const pan = (dir) => {
      const shift = spanX * 0.2 * (dir < 0 ? -1 : 1);
      const nextMin = clamp(minX + shift, fullMinX, fullMaxX - spanX);
      const nextMax = nextMin + spanX;
      setView({ minX: nextMin, maxX: nextMax });
    };

    const svgToString = () => {
      const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const poly = pts;
      const lines = [];
      lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
      lines.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${isDark ? '#0b1220' : '#ffffff'}"/>`);
      lines.push(`<line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="${axisColor}" stroke-width="1"/>`);
      lines.push(`<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="${axisColor}" stroke-width="1"/>`);
      for (const t of yTicks) {
        const y = yToPx(t);
        lines.push(`<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`);
        lines.push(`<text x="${padL - 8}" y="${y + 4}" font-size="11" font-weight="700" fill="${labelColor}" text-anchor="end">${esc(`${t.toFixed(1)}${unit}`)}</text>`);
      }
      lines.push(`<polyline points="${esc(poly)}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
      if (yLabelText) {
        lines.push(
          `<text x="14" y="${h / 2}" font-size="11" font-weight="800" fill="${labelColor}" text-anchor="middle" transform="rotate(-90 14 ${h / 2})">${esc(
            yLabelText,
          )}</text>`,
        );
      }
      if (xLabelText) {
        lines.push(`<text x="${w / 2}" y="${h - 6}" font-size="11" font-weight="800" fill="${labelColor}" text-anchor="middle">${esc(xLabelText)}</text>`);
      }
      lines.push(`</svg>`);
      return lines.join('');
    };

    return (
      <View style={[layoutStyles.card, isDark && styles.cardDark]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, isDark && { color: '#F9FAFB' }]}>{title}</Text>
          <Text style={[styles.chartMeta, isDark && styles.mutedDark]}>
            {nowY !== null ? `Now ${nowY.toFixed(1)}${unit} • ` : ''}
            Min {minY.toFixed(1)}
            {unit} • Max {maxY.toFixed(1)}
            {unit}
          </Text>
        </View>
        <View style={styles.chartSvgWrap}>
          <Svg width={w} height={h}>
            {recommended ? (
              <Rect
                x={padL}
                y={yToPx(Math.max(recommended.min, recommended.max))}
                width={plotW}
                height={Math.abs(yToPx(recommended.min) - yToPx(recommended.max))}
                fill={isDark ? 'rgba(74,222,128,0.12)' : 'rgba(16,185,129,0.12)'}
              />
            ) : null}
            <Line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke={axisColor} strokeWidth={1} />
            <Line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke={axisColor} strokeWidth={1} />
            {yTicks.map((t) => {
              const y = yToPx(t);
              return (
                <React.Fragment key={`${chartKey}_yt_${t}`}>
                  <Line x1={padL} y1={y} x2={w - padR} y2={y} stroke={gridColor} strokeWidth={1} />
                  <Line x1={padL - 4} y1={y} x2={padL} y2={y} stroke={axisColor} strokeWidth={1} />
                  <SvgText x={padL - 8} y={y + 4} fontSize="11" fontWeight="700" fill={labelColor} textAnchor="end">
                    {`${Number(t).toFixed(1)}${unit}`}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {xTicks.map((t, idx) => {
              const x = xToPx(t);
              return (
                <React.Fragment key={`${chartKey}_xt_${idx}`}>
                  <Line x1={x} y1={padT} x2={x} y2={h - padB} stroke={gridColor} strokeWidth={1} />
                </React.Fragment>
              );
            })}
            {Array.isArray(thresholdLines)
              ? thresholdLines
                  .filter((l) => Number.isFinite(Number(l?.value)))
                  .map((l) => {
                    const y = yToPx(Number(l.value));
                    return (
                      <React.Fragment key={`${chartKey}_thr_${l.label}`}>
                        <Line
                          x1={padL}
                          y1={y}
                          x2={w - padR}
                          y2={y}
                          stroke={l.color}
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                        />
                        <SvgText x={w - padR} y={y - 4} fontSize="10" fontWeight="800" fill={l.color} textAnchor="end">
                          {l.label}
                        </SvgText>
                      </React.Fragment>
                    );
                  })
              : null}
            {markerInView.map((m, idx) => {
              const x = xToPx(m.ts);
              const c = m.kind === 'alert' ? theme.colors.warning : theme.colors.danger;
              return (
                <React.Fragment key={`${chartKey}_m_${idx}`}>
                  <Line x1={x} y1={padT} x2={x} y2={h - padB} stroke={c} strokeWidth={1} strokeDasharray="3 3" />
                </React.Fragment>
              );
            })}
            <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {cursorPoint ? (
              <>
                <Line x1={cursorX} y1={padT} x2={cursorX} y2={h - padB} stroke={labelColor} strokeWidth={1} />
                <Circle cx={cursorX} cy={cursorY} r={5} fill={color} />
                <Rect
                  x={clamp(cursorX - 110, padL, w - padR - 220)}
                  y={padT + 6}
                  width={220}
                  height={48}
                  rx={10}
                  fill={isDark ? 'rgba(2,6,23,0.92)' : 'rgba(255,255,255,0.92)'}
                  stroke={isDark ? '#1F2937' : '#E5E7EB'}
                  strokeWidth={1}
                />
                <SvgText x={clamp(cursorX - 100, padL + 10, w - padR - 210)} y={padT + 24} fontSize="12" fontWeight="900" fill={isDark ? '#E5E7EB' : '#111827'}>
                  {tooltipText1}
                </SvgText>
                <SvgText x={clamp(cursorX - 100, padL + 10, w - padR - 210)} y={padT + 42} fontSize="11" fontWeight="700" fill={labelColor}>
                  {tooltipText2}
                </SvgText>
              </>
            ) : null}
            {yLabelText ? (
              <SvgText x={16} y={padT + plotH / 2} fontSize="11" fontWeight="800" fill={labelColor} textAnchor="middle" transform={`rotate(-90 16 ${padT + plotH / 2})`}>
                {yLabelText}
              </SvgText>
            ) : null}
            {xLabelText ? (
              <SvgText x={padL + plotW / 2} y={h - 6} fontSize="11" fontWeight="800" fill={labelColor} textAnchor="middle">
                {xLabelText}
              </SvgText>
            ) : null}
            <Rect
              x={padL}
              y={padT}
              width={plotW}
              height={plotH}
              fill="transparent"
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={updateFromEvent}
              onResponderMove={updateFromEvent}
              onResponderRelease={() => setCursorVisible(false)}
              onResponderTerminate={() => setCursorVisible(false)}
            />
          </Svg>
        </View>
        <View style={styles.chartFooter}>
          <Text style={[styles.chartAxis, isDark && styles.mutedDark]} numberOfLines={1}>{startLabel}</Text>
          <Text style={[styles.chartAxis, isDark && styles.mutedDark]} numberOfLines={1}>{midLabel}</Text>
          <Text style={[styles.chartAxis, isDark && styles.mutedDark]} numberOfLines={1}>{endLabel}</Text>
        </View>
        <View style={styles.chartControls}>
          <View style={styles.controlRow}>
            <HoverPressable style={layoutStyles.secondaryButton} onPress={() => zoom(0.6)}>
              <Text style={layoutStyles.secondaryButtonText}>Zoom in</Text>
            </HoverPressable>
            <HoverPressable style={layoutStyles.secondaryButton} onPress={() => zoom(1.6)}>
              <Text style={layoutStyles.secondaryButtonText}>Zoom out</Text>
            </HoverPressable>
            <HoverPressable style={layoutStyles.secondaryButton} onPress={resetView}>
              <Text style={layoutStyles.secondaryButtonText}>Reset</Text>
            </HoverPressable>
            <HoverPressable style={layoutStyles.secondaryButton} onPress={() => pan(-1)}>
              <Text style={layoutStyles.secondaryButtonText}>◀</Text>
            </HoverPressable>
            <HoverPressable style={layoutStyles.secondaryButton} onPress={() => pan(1)}>
              <Text style={layoutStyles.secondaryButtonText}>▶</Text>
            </HoverPressable>
          </View>
          <View style={styles.controlRow}>
            <HoverPressable style={smoothEnabled ? layoutStyles.ctaButton : layoutStyles.secondaryButton} onPress={() => setSmoothEnabled(true)}>
              <Text style={smoothEnabled ? layoutStyles.ctaButtonText : layoutStyles.secondaryButtonText}>Smoothed</Text>
            </HoverPressable>
            <HoverPressable style={!smoothEnabled ? layoutStyles.ctaButton : layoutStyles.secondaryButton} onPress={() => setSmoothEnabled(false)}>
              <Text style={!smoothEnabled ? layoutStyles.ctaButtonText : layoutStyles.secondaryButtonText}>Raw</Text>
            </HoverPressable>
            <HoverPressable
              style={layoutStyles.secondaryButton}
              onPress={() => {
                const sortedRows = filtered
                  .slice()
                  .filter((r) => Number.isFinite(Number(r?.createdAt || 0)))
                  .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
                downloadText(`agrix_${chartKey}_${range}.csv`, 'text/csv', buildCsv(sortedRows));
              }}
            >
              <Text style={layoutStyles.secondaryButtonText}>Download CSV</Text>
            </HoverPressable>
            <HoverPressable
              style={layoutStyles.secondaryButton}
              onPress={() => downloadText(`agrix_${chartKey}_${range}.svg`, 'image/svg+xml', svgToString())}
            >
              <Text style={layoutStyles.secondaryButtonText}>Download SVG</Text>
            </HoverPressable>
          </View>
          {!!exportStatus ? <Text style={[styles.exportStatus, isDark && styles.mutedDark]}>{exportStatus}</Text> : null}
        </View>
      </View>
    );
  };

  const expandSidebar = () => {
    Animated.timing(sidebarTranslateY, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };

  const collapseSidebar = () => {
    Animated.timing(sidebarTranslateY, { toValue: hiddenSidebarTranslateY, duration: 300, useNativeDriver: false }).start();
  };

  const navigateAndClose = (routeName, params) => {
    navigation.navigate(routeName, params);
    collapseSidebar();
  };

  const goToMonitoring = () => {
    collapseSidebar();
    navigation.navigate('Dashboard', { view: 'monitoring' });
  };

  const toggleTheme = () => {
    if (isThemeAnimatingRef.current) return;
    isThemeAnimatingRef.current = true;
    const next = isDark ? 'light' : 'dark';
    Animated.timing(fadeOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setAppTheme(next);
      setThemeMode(next);
      Animated.timing(fadeOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => {
        isThemeAnimatingRef.current = false;
      });
    });
  };

  const confirmLogoutNow = () => {
    setLogoutVisible(false);
    clearAuth();
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  return (
    <SafeAreaView style={[layoutStyles.container, isDark && { backgroundColor: '#020617' }]}>
      <ScreenTransition type="slideRight">
        <Animated.View style={[layoutStyles.mainLayout, { opacity: fadeOpacity }]}>
          <View style={[layoutStyles.topNavbar, isDark && { backgroundColor: 'rgba(2, 6, 23, 0.85)', borderBottomColor: '#1F2937' }]}>
            <View style={styles.navLeft}>
              <HoverPressable style={styles.backButton} onPress={goToMonitoring}>
                <View style={styles.backIconWrap}>
                  <ChevronRight size={22} color={isDark ? '#4ADE80' : theme.colors.brand} />
                </View>
              </HoverPressable>
              <AgriXLogo onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })} style={layoutStyles.navbarLogo} variant="navbar" scale={1} />
            </View>
            <HoverPressable style={layoutStyles.hamburgerContainer} onPress={expandSidebar} onHoverIn={expandSidebar}>
              <View style={[layoutStyles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
              <View style={[layoutStyles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
              <View style={[layoutStyles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
            </HoverPressable>
          </View>

          <Animated.View
            style={[
              layoutStyles.sidebar,
              isDark && { backgroundColor: 'rgba(2, 6, 23, 0.92)', borderColor: '#1F2937' },
              { transform: [{ translateY: sidebarTranslateY }] },
            ]}
            onMouseLeave={collapseSidebar}
            onMouseEnter={expandSidebar}
          >
            <View style={layoutStyles.sidebarContent}>
              <View style={layoutStyles.sidebarHeader}>
                <Text style={[layoutStyles.logoText, isDark && { color: '#4ADE80' }]} numberOfLines={1}>
                  AGRIX
                </Text>
                <Text style={[layoutStyles.subLogoText, isDark && { color: '#9CA3AF' }]} numberOfLines={1}>
                  Coffee Crop Tracker
                </Text>
              </View>

              <View style={layoutStyles.menuItems}>
                <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose('Dashboard')}>
                  <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                    Home
                  </Text>
                </HoverPressable>
                {!canAccessAdmin ? (
                  <>
                    <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose('DeviceSensors')}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Device & Sensors
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose('Notifications')}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Notifications
                      </Text>
                    </HoverPressable>
                  </>
                ) : null}
                <HoverPressable style={layoutStyles.menuItem} onPress={toggleTheme}>
                  <View style={styles.themeRow}>
                    <View style={styles.themeLeft}>
                      {isDark ? <Moon size={16} color="#4ADE80" /> : <Sun size={16} color={theme.colors.brandDark} />}
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]}>Dark mode</Text>
                    </View>
                    <View style={[styles.themeSwitch, isDark && styles.themeSwitchDark]}>
                      <View style={[styles.themeKnob, isDark && styles.themeKnobDark]} />
                    </View>
                  </View>
                </HoverPressable>
              </View>

              <HoverPressable style={layoutStyles.logoutButton} onPress={() => setLogoutVisible(true)}>
                <Text style={[layoutStyles.menuText, { color: theme.colors.danger }]} numberOfLines={1}>
                  Logout
                </Text>
              </HoverPressable>
            </View>
          </Animated.View>

          <ConfirmDialog
            visible={logoutVisible}
            title="Log out"
            message="Are you sure you want to log out?"
            confirmText="Log out"
            cancelText="Cancel"
            destructive
            onCancel={() => setLogoutVisible(false)}
            onConfirm={confirmLogoutNow}
          />

          <View style={[layoutStyles.contentBg, isDark && { backgroundColor: '#020617' }]}>
            <View style={layoutStyles.contentArea}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={[layoutStyles.scrollContent, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false}>
                <Text style={[layoutStyles.pageTitle, isDark && { color: '#F9FAFB' }]}>{isGraphMode ? 'Graph history' : 'Readings timeline'}</Text>
                <Text style={[layoutStyles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                  {isGraphMode ? 'Review sensor trends by time range and metric.' : 'Review sensor readings by time range and metric.'}
                </Text>

                <View style={layoutStyles.ctaRow}>
                  {[
                    { key: '24h', label: '24h' },
                    { key: '7d', label: '7d' },
                    { key: 'all', label: 'All' },
                  ].map((r) => (
                    <HoverPressable key={r.key} style={range === r.key ? layoutStyles.ctaButton : layoutStyles.secondaryButton} onPress={() => setRange(r.key)}>
                      <Text style={range === r.key ? layoutStyles.ctaButtonText : layoutStyles.secondaryButtonText}>{r.label}</Text>
                    </HoverPressable>
                  ))}
                </View>

                <View style={{ height: 10 }} />

                <View style={layoutStyles.ctaRow}>
                  {[
                    { key: 'all', label: 'All metrics' },
                    { key: 'humidity', label: 'Humidity' },
                    { key: 'temperature', label: 'Temperature' },
                    { key: 'soilMoisture', label: 'Bean moisture' },
                  ].map((m) => (
                    <HoverPressable key={m.key} style={metric === m.key ? layoutStyles.ctaButton : layoutStyles.secondaryButton} onPress={() => setMetric(m.key)}>
                      <Text style={metric === m.key ? layoutStyles.ctaButtonText : layoutStyles.secondaryButtonText}>{m.label}</Text>
                    </HoverPressable>
                  ))}
                </View>

                <View style={{ height: 12 }} />

                {isGraphMode ? (
                  <>
                    <View style={{ gap: 12 }}>
                      {metric === 'all' || metric === 'humidity' ? (
                        <LineChart
                          chartKey="humidity"
                          title="Humidity"
                          yLabel="Humidity (%)"
                          xLabel="Time"
                          unit="%"
                          color={theme.colors.brand}
                          series={chartSeries.humidity}
                          recommendedBand={{ min: 50, max: 60 }}
                          thresholdLines={[
                            { value: thresholds?.humidity?.min, label: `Min ${fmtNumber(thresholds?.humidity?.min, '%')}`, color: theme.colors.brandDark },
                            { value: thresholds?.humidity?.max, label: `Max ${fmtNumber(thresholds?.humidity?.max, '%')}`, color: theme.colors.brandDark },
                          ]}
                        />
                      ) : null}
                      {metric === 'all' || metric === 'temperature' ? (
                        <LineChart
                          chartKey="temperature"
                          title="Temperature"
                          yLabel="Temperature (°C)"
                          xLabel="Time"
                          unit="°C"
                          color={theme.colors.accentTeal}
                          series={chartSeries.temperature}
                          recommendedBand={{ min: 35, max: 45 }}
                          thresholdLines={[
                            { value: thresholds?.temperature?.min, label: `Min ${fmtNumber(thresholds?.temperature?.min, '°C')}`, color: theme.colors.accentTeal },
                            { value: thresholds?.temperature?.max, label: `Max ${fmtNumber(thresholds?.temperature?.max, '°C')}`, color: theme.colors.accentTeal },
                          ]}
                        />
                      ) : null}
                      {metric === 'all' || metric === 'soilMoisture' ? (
                        <LineChart
                          chartKey="soilMoisture"
                          title="Bean moisture"
                          yLabel="Bean moisture (%)"
                          xLabel="Time"
                          unit="%"
                          color={theme.colors.accentCoffee}
                          series={chartSeries.soilMoisture}
                          recommendedBand={null}
                          thresholdLines={null}
                        />
                      ) : null}
                    </View>

                    <View style={{ height: 12 }} />

                    {historyStatus.error ? (
                      <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                        <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{historyStatus.error}</Text>
                      </View>
                    ) : historyStatus.loading ? (
                      <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                        <Text style={[styles.emptyText, isDark && styles.mutedDark]}>Loading readings…</Text>
                      </View>
                    ) : null}

                    <View style={layoutStyles.ctaRow}>
                      <HoverPressable
                        style={layoutStyles.secondaryButton}
                        onPress={loadHistoryForRange.bind(null, range)}
                        disabled={historyStatus.loading}
                      >
                        <Text style={layoutStyles.secondaryButtonText}>{historyStatus.loading ? 'Loading…' : 'Refresh history'}</Text>
                      </HoverPressable>
                      {historyHasMore ? (
                        <HoverPressable style={layoutStyles.secondaryButton} onPress={loadMoreHistory} disabled={historyStatus.loading}>
                          <Text style={layoutStyles.secondaryButtonText}>{historyStatus.loading ? 'Loading…' : 'Load more'}</Text>
                        </HoverPressable>
                      ) : null}
                      <HoverPressable style={layoutStyles.secondaryButton} onPress={() => navigation.navigate('ReadingsTimeline')}>
                        <Text style={layoutStyles.secondaryButtonText}>Open timeline</Text>
                      </HoverPressable>
                    </View>
                  </>
                ) : (
                  <View style={layoutStyles.ctaRow}>
                    <HoverPressable style={layoutStyles.secondaryButton} onPress={() => navigation.navigate('GraphHistory')}>
                      <Text style={layoutStyles.secondaryButtonText}>Open graph history</Text>
                    </HoverPressable>
                  </View>
                )}

                {filtered.length === 0 && (!isGraphMode || (!historyStatus.error && !historyStatus.loading)) ? (
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[styles.emptyText, isDark && styles.mutedDark]}>No readings for this filter.</Text>
                  </View>
                ) : (
                  !isGraphMode
                    ? filtered.map((r) => (
                        <View key={r.id} style={[layoutStyles.card, isDark && styles.cardDark]}>
                          <Text style={[styles.rowTitle, isDark && { color: '#F9FAFB' }]}>{new Date(r.createdAt).toLocaleString()}</Text>
                          <Text style={[styles.rowMeta, isDark && styles.mutedDark]}>Source: {r.source || '—'}</Text>
                          <View style={styles.rowGrid}>
                            {(metric === 'all' || metric === 'temperature') ? (
                              <View style={styles.rowCell}>
                                <Text style={[styles.cellLabel, isDark && styles.mutedDark]}>Temp</Text>
                                <Text style={[styles.cellValue, isDark && styles.textDark]}>{fmtNumber(r.temperature, '°C')}</Text>
                              </View>
                            ) : null}
                            {(metric === 'all' || metric === 'humidity') ? (
                              <View style={styles.rowCell}>
                                <Text style={[styles.cellLabel, isDark && styles.mutedDark]}>Humidity</Text>
                                <Text style={[styles.cellValue, isDark && styles.textDark]}>{fmtNumber(r.humidity, '%')}</Text>
                              </View>
                            ) : null}
                            {(metric === 'all' || metric === 'soilMoisture') ? (
                              <View style={styles.rowCell}>
                                <Text style={[styles.cellLabel, isDark && styles.mutedDark]}>Bean moisture</Text>
                                <Text style={[styles.cellValue, isDark && styles.textDark]}>{fmtNumber(r.soilMoisture, '%')}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ))
                    : null
                )}
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      </ScreenTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  backIconWrap: {
    transform: [{ rotate: '180deg' }],
  },
  cardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#1F2937',
  },
  mutedDark: {
    color: '#9CA3AF',
  },
  textDark: {
    color: '#E5E7EB',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '800',
    textAlign: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.text,
  },
  rowMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  rowGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowCell: {
    minWidth: 150,
    flexGrow: 1,
    gap: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.text,
  },
  chartMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  chartFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartAxis: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    maxWidth: '48%',
  },
  chartControls: {
    marginTop: 12,
    gap: 10,
    position: 'relative',
    zIndex: 5,
  },
  chartSvgWrap: {
    alignSelf: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  exportStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: '800',
    textAlign: 'center',
  },
  cellLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeSwitch: {
    width: 46,
    height: 26,
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(15,23,42,0.06)',
    justifyContent: 'center',
  },
  themeSwitchDark: {
    borderColor: '#1F2937',
    backgroundColor: 'rgba(74,222,128,0.18)',
  },
  themeKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#fff',
    transform: [{ translateX: 0 }],
  },
  themeKnobDark: {
    backgroundColor: '#4ADE80',
    transform: [{ translateX: 20 }],
  },
});
