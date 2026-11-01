import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { theme } from '../../ui/theme';
import HoverPressable from '../HoverPressable';
import { API_BASE_URL } from '../../lib/authApi';
import { addNotification, listNotifications, subscribeNotifications } from '../../lib/notifications';
import { getThemeMode, subscribeTheme } from '../../lib/themePref';
import {
  addSensorReading,
  computeBlackAspergillusRisk,
  computeMoldRiskForecast,
  getAlertRules,
  setAlertRules,
  getIotSocketUrl,
  getLatestSensorReading,
  getSensorThresholds,
  getAlertState,
  setAlertState,
  isReadingFresh,
  listSensorReadings,
  setSensorThresholds,
  subscribeSensors,
} from '../../lib/sensors';

export default function FarmerDashboard({ user, navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const [sparkSmoothEnabled, setSparkSmoothEnabled] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown');
  const [iotStatus, setIotStatus] = useState(() => (Platform.OS === 'web' ? 'disabled' : 'connecting'));
  const [iotSocketUrl, setIotSocketUrlState] = useState(() => getIotSocketUrl());
  const [notifications, setNotifications] = useState(() => listNotifications());
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';
  const [latestReading, setLatestReading] = useState(() => getLatestSensorReading());
  const [thresholds, setThresholds] = useState(() => getSensorThresholds());
  const [rules, setRules] = useState(() => getAlertRules());
  const [thresholdModal, setThresholdModal] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState(() => getSensorThresholds());
  const [rulesDraft, setRulesDraft] = useState(() => getAlertRules());
  const [preset, setPreset] = useState('custom');
  const alertStateRef = useRef({}); // key -> state string

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setApiStatus('checking');
        const res = await fetch(`${API_BASE_URL}/health`);
        if (cancelled) return;
        setApiStatus(res.ok ? 'ok' : 'down');
      } catch (_err) {
        if (cancelled) return;
        setApiStatus('down');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setNotifications(listNotifications());
    const unsub = subscribeNotifications(refresh);
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => {
      setLatestReading(getLatestSensorReading());
      setThresholds(getSensorThresholds());
      setRules(getAlertRules());
      setIotSocketUrlState(getIotSocketUrl());
    };
    const unsub = subscribeSensors(refresh);
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const socketUrl = iotSocketUrl;
    if (!socketUrl) {
      setIotStatus('disabled');
      return;
    }
    let socket = null;
    setIotStatus('connecting');
    try {
      const { io } = require('socket.io-client');
      socket = io(socketUrl, { transports: ['websocket'] });

      socket.on('connect', () => setIotStatus('online'));
      socket.on('disconnect', () => setIotStatus('offline'));
      socket.on('connect_error', () => setIotStatus('error'));
    } catch (_err) {
      setIotStatus('error');
    }

    return () => {
      try {
        socket?.removeAllListeners?.();
        socket?.disconnect?.();
      } catch (_err) {}
    };
  }, [iotSocketUrl]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const connected = isReadingFresh(latestReading, Math.max(0, Number(rules.offlineMinutes || 0)) * 60 * 1000);
  const liveConnected = Platform.OS === 'web' ? connected : String(iotStatus || '') === 'online' && connected;
  const displayReading = liveConnected ? latestReading : null;
  const connectionIndicator = useMemo(() => {
    const status = String(iotStatus || '');
    if (Platform.OS === 'web') {
      const hasAnyReading = Boolean(latestReading);
      return {
        dot: liveConnected ? theme.colors.brand : apiStatus === 'checking' ? theme.colors.warning : theme.colors.danger,
        label: liveConnected
          ? 'Connected'
          : apiStatus === 'checking'
            ? 'Checking API…'
            : apiStatus !== 'ok'
              ? 'API offline'
              : hasAnyReading
                ? 'Disconnected'
                : 'No sensor data yet',
      };
    }
    if (status === 'online') {
      return {
        dot: theme.colors.brand,
        label: latestReading ? (connected ? 'Online' : 'Offline') : 'Online (waiting for data)',
      };
    }
    if (status === 'connecting') {
      return { dot: theme.colors.warning, label: 'Connecting…' };
    }
    return { dot: theme.colors.danger, label: 'Offline' };
  }, [iotStatus, connected, latestReading, apiStatus, liveConnected]);

  const blackRisk = useMemo(() => {
    if (!displayReading) return { level: 'unknown', score: 0, minutesInRiskZone: 0, reason: 'No reading.' };
    return computeBlackAspergillusRisk(displayReading, listSensorReadings(), { windowMs: 24 * 60 * 60 * 1000 });
  }, [displayReading, latestReading]);
  const blackRiskLabel =
    blackRisk.level === 'high' ? 'HIGH' : blackRisk.level === 'moderate' ? 'MODERATE' : blackRisk.level === 'low' ? 'LOW' : 'UNKNOWN';

  const forecast = useMemo(() => {
    if (!displayReading) return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'No reading.' };
    return computeMoldRiskForecast(displayReading, listSensorReadings(), { windowMs: 6 * 60 * 60 * 1000, horizonHours: rules.forecastHours });
  }, [displayReading, latestReading, rules.forecastHours]);

  const forecastLabel =
    forecast.level === 'imminent'
      ? 'IMMINENT'
      : forecast.level === 'soon'
        ? 'SOON'
        : forecast.level === 'safe'
          ? 'SAFE'
          : 'UNKNOWN';

  const kpis = useMemo(() => {
    const fmt = (v, suffix) => {
      if (typeof v === 'number') return `${v.toFixed(1)}${suffix}`;
      if (apiStatus === 'checking') return 'Loading…';
      if (!liveConnected) return latestReading ? 'Disconnected' : 'No data yet';
      return 'No data yet';
    };

    return [
      { label: 'Temperature', value: fmt(displayReading?.temperature, '°C'), helper: 'Storage room monitoring' },
      { label: 'Humidity', value: fmt(displayReading?.humidity, '%'), helper: 'Mold risk indicator' },
      { label: 'Bean Moisture', value: fmt(displayReading?.soilMoisture, '%'), helper: 'Storage monitoring' },
    ];
  }, [displayReading, apiStatus, liveConnected, latestReading]);

  const readingsForSparkline = useMemo(() => {
    const items = [];
    const now = Date.now();
    const recent = listSensorReadings();
    for (const r of recent) {
      const ts = Number(r?.createdAt || 0);
      if (!Number.isFinite(ts) || now - ts > 24 * 60 * 60 * 1000) continue;
      items.push({ createdAt: ts, humidity: Number(r?.humidity), temperature: Number(r?.temperature) });
    }
    return items
      .filter((r) => Number.isFinite(r.createdAt) && Number.isFinite(r.humidity) && Number.isFinite(r.temperature))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-60);
  }, [latestReading]);

  useEffect(() => {
    alertStateRef.current = getAlertState();
  }, []);

  const computeOutOfRangeDurationMs = (field, min, max) => {
    const readings = listSensorReadings();
    if (!readings.length) return { outOfRange: false, durationMs: 0, latestTs: 0, latestVal: null };
    const latest = readings[0];
    const latestTs = Number(latest?.createdAt || 0);
    const latestVal = Number(latest?.[field]);
    if (!Number.isFinite(latestVal)) return { outOfRange: false, durationMs: 0, latestTs, latestVal: null };
    const outOfRange = latestVal < min || latestVal > max;
    if (!outOfRange) return { outOfRange: false, durationMs: 0, latestTs, latestVal };

    let lastInRangeTs = null;
    for (const r of readings) {
      const ts = Number(r?.createdAt || 0);
      const v = Number(r?.[field]);
      if (!Number.isFinite(ts) || !Number.isFinite(v)) continue;
      if (v >= min && v <= max) {
        lastInRangeTs = ts;
        break;
      }
    }
    if (lastInRangeTs === null) {
      const oldest = readings[readings.length - 1];
      lastInRangeTs = Number(oldest?.createdAt || latestTs);
    }
    return { outOfRange: true, durationMs: Math.max(0, latestTs - lastInRangeTs), latestTs, latestVal };
  };

  const computeConditionDurationMs = (predicate) => {
    const readings = listSensorReadings();
    if (!readings.length) return { active: false, durationMs: 0, latestTs: 0 };
    const latest = readings[0];
    const latestTs = Number(latest?.createdAt || 0);
    if (!Number.isFinite(latestTs) || latestTs <= 0) return { active: false, durationMs: 0, latestTs: 0 };
    if (!predicate(latest)) return { active: false, durationMs: 0, latestTs };

    let lastFalseTs = null;
    for (const r of readings) {
      const ts = Number(r?.createdAt || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (!predicate(r)) {
        lastFalseTs = ts;
        break;
      }
    }
    if (lastFalseTs === null) {
      const oldest = readings[readings.length - 1];
      lastFalseTs = Number(oldest?.createdAt || latestTs);
    }
    return { active: true, durationMs: Math.max(0, latestTs - lastFalseTs), latestTs };
  };

  const updateRuleAlerts = () => {
    const state = { ...(alertStateRef.current || {}) };
    const h = computeOutOfRangeDurationMs('humidity', thresholds.humidity.min, thresholds.humidity.max);
    const t = computeOutOfRangeDurationMs('temperature', thresholds.temperature.min, thresholds.temperature.max);
    const humidityMs = Math.max(0, Number(rules.humidityHighMinutes || 0)) * 60 * 1000;
    const tempMs = Math.max(0, Number(rules.temperatureHighMinutes || 0)) * 60 * 1000;
    const moldMs = Math.max(0, Number(rules.moldRiskMinutes || 0)) * 60 * 1000;
    const escalationMs = Math.max(0, Number(rules.escalationMinutes || 0)) * 60 * 1000;

    const check = (keyBase, out, durationMs, latestVal, thresholdMs, units, label) => {
      const current = state[keyBase] && typeof state[keyBase] === 'object' ? state[keyBase] : { stage: 'safe' };
      if (!out) {
        if (current.stage !== 'safe') {
          addNotification({ key: `${keyBase}:normal`, title: `${label} back to normal`, message: 'Reading is back within the safe range.', level: 'success' });
        }
        state[keyBase] = { stage: 'safe' };
        return;
      }

      if (thresholdMs > 0 && durationMs >= thresholdMs && current.stage === 'safe') {
        const latestText = Number.isFinite(latestVal) ? `${latestVal.toFixed(1)}${units}` : 'N/A';
        addNotification({
          key: `${keyBase}:duration`,
          title: `${label} high`,
          message: `${label} has been out of range for ${Math.ceil(durationMs / 60000)} minute(s). Latest: ${latestText}.`,
          level: 'warning',
        });
        current.stage = 'alerted';
      }

      if (escalationMs > 0 && durationMs >= escalationMs && current.stage !== 'escalated') {
        addNotification({
          key: `${keyBase}:escalation`,
          title: `${label} critical`,
          message: `${label} has remained out of range for ${Math.ceil(durationMs / 60000)} minute(s). Immediate action recommended.`,
          level: 'error',
        });
        current.stage = 'escalated';
      }

      state[keyBase] = current;
    };

    check('rule:humidity', h.outOfRange, h.durationMs, h.latestVal, humidityMs, '%', 'Humidity');
    check('rule:temperature', t.outOfRange, t.durationMs, t.latestVal, tempMs, '°C', 'Temperature');

    const mold = computeConditionDurationMs((r) => {
      const hh = Number(r?.humidity);
      const tt = Number(r?.temperature);
      return Number.isFinite(hh) && Number.isFinite(tt) && hh >= 70 && tt >= 25 && tt <= 37;
    });
    check('rule:black_mold', mold.active, mold.durationMs, Number(displayReading?.humidity), moldMs, '% RH', 'Black mold risk');

    const forecastNow = computeMoldRiskForecast(displayReading, listSensorReadings(), { windowMs: 6 * 60 * 60 * 1000, horizonHours: rules.forecastHours });
    const forecastKey = 'rule:black_mold_forecast';
    const fState = state[forecastKey] && typeof state[forecastKey] === 'object' ? state[forecastKey] : { active: false };
    const shouldWarn = forecastNow.level === 'imminent' || forecastNow.level === 'soon';
    if (shouldWarn && !fState.active) {
      const hTxt = forecastNow.predicted ? `${forecastNow.predicted.humidity}% RH` : 'N/A';
      const tTxt = forecastNow.predicted ? `${forecastNow.predicted.temperature}°C` : 'N/A';
      const eta = forecastNow.hoursToRisk !== null ? `${forecastNow.hoursToRisk.toFixed(1)}h` : 'soon';
      addNotification({
        key: 'forecast:black_mold',
        title: 'Forecast: Black mold risk',
        message: `Conditions are predicted to enter the risk zone in ~${eta}. Predicted: ${hTxt}, ${tTxt}.`,
        level: 'warning',
      });
      state[forecastKey] = { active: true };
    }
    if (!shouldWarn && fState.active) {
      state[forecastKey] = { active: false };
    }

    const offlineMinutes = Math.max(0, Number(rules.offlineMinutes || 0));
    const offline = Boolean(latestReading) && !isReadingFresh(latestReading, offlineMinutes * 60 * 1000);
    const wasOffline = Boolean(state['device:offline']?.active);
    if (offline && !wasOffline) {
      addNotification({
        key: 'device:offline',
        title: 'Device offline',
        message: `No recent readings for ${offlineMinutes} minute(s).`,
        level: 'error',
      });
      state['device:offline'] = { active: true };
    }
    if (!offline && wasOffline) {
      addNotification({
        key: 'device:online',
        title: 'Device online',
        message: 'Readings are updating again.',
        level: 'success',
      });
      state['device:offline'] = { active: false };
    }

    alertStateRef.current = state;
    setAlertState(state);
  };

  useEffect(() => {
    updateRuleAlerts();
  }, [latestReading, thresholds, rules, apiStatus]);

  const openThresholds = () => {
    const current = getSensorThresholds();
    const currentRules = getAlertRules();
    setThresholdDraft(current);
    setRulesDraft(currentRules);
    const safePreset = current.humidity.min === 55 && current.humidity.max === 70 && current.temperature.min === 18 && current.temperature.max === 28;
    const highPreset = current.humidity.min === 60 && current.humidity.max === 65 && current.temperature.min === 20 && current.temperature.max === 25;
    setPreset(safePreset ? 'safe' : highPreset ? 'high' : 'custom');
    setThresholdModal(true);
  };

  const saveThresholds = () => {
    const next = setSensorThresholds(thresholdDraft);
    const nextRules = setAlertRules(rulesDraft);
    setThresholds(next);
    setRules(nextRules);
    addNotification({
      key: 'thresholds:update',
      title: 'Settings updated',
      message: `Humidity: ${next.humidity.min}–${next.humidity.max}%, Temperature: ${next.temperature.min}–${next.temperature.max}°C. Alerts: ${nextRules.humidityHighMinutes}m humidity, ${nextRules.temperatureHighMinutes}m temperature, ${nextRules.moldRiskMinutes}m mold risk, ${nextRules.escalationMinutes}m escalation.`,
      level: 'success',
    });
    setThresholdModal(false);
  };

  const addTestReading = () => {
    const temp = 18 + Math.random() * 14;
    const hum = 50 + Math.random() * 30;
    const soilMoisture = 30 + Math.random() * 40;
    const reading = addSensorReading({ temperature: temp, humidity: hum, soilMoisture, source: 'demo' });
    setLatestReading(reading);
  };

  const Sparkline = ({ points, color, unit = '', title = '', recommendedBand, thresholdLines }) => {
    const [cursorTs, setCursorTs] = useState(0);
    const [cursorVisible, setCursorVisible] = useState(false);
    const raw = Array.isArray(points)
      ? points
          .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => a.x - b.x)
      : [];

    const movingAverage = (series, w) => {
      const win = Math.max(1, Math.min(18, Math.floor(Number(w) || 5)));
      if (!series || series.length < 3 || win <= 1) return series || [];
      const out = [];
      for (let i = 0; i < series.length; i += 1) {
        let sum = 0;
        let count = 0;
        const start = Math.max(0, i - (win - 1));
        for (let j = start; j <= i; j += 1) {
          sum += series[j].y;
          count += 1;
        }
        out.push({ x: series[i].x, y: sum / Math.max(1, count) });
      }
      return out;
    };

    const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v)));
    const niceStep = (span, targetTicks) => {
      const s = Math.max(1e-9, Number(span) || 1);
      const rawStep = s / Math.max(2, Number(targetTicks) || 5);
      const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const n = rawStep / pow;
      const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
      return step * pow;
    };
    const niceTicks = (min, max, count) => {
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
    };

    const series = sparkSmoothEnabled ? movingAverage(raw, 6) : raw;
    const w = isCompact ? Math.min(420, Math.max(260, width - 120)) : 300;
    const h = 96;
    const padL = 56;
    const padR = 12;
    const padT = 10;
    const padB = 24;
    const plotW = Math.max(1, w - padL - padR);
    const plotH = Math.max(1, h - padT - padB);
    const axisColor = isDark ? '#1F2937' : '#E5E7EB';
    const labelColor = isDark ? '#9CA3AF' : theme.colors.textMuted;
    const gridColor = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.25)';

    if (series.length < 2) {
      return (
        <View style={[styles.sparkEmpty, { width: w, height: h }]}>
          <Text style={styles.sparkEmptyText}>No data yet</Text>
        </View>
      );
    }
    const xs = series.map((p) => p.x);
    const ys = series.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = Math.max(1e-9, max - min);
    const spanX = Math.max(1, maxX - minX);
    const xToPx = (x) => padL + ((x - minX) / spanX) * plotW;
    const yToPx = (y) => padT + (1 - (y - min) / span) * plotH;
    const pts = series
      .map((p) => `${xToPx(p.x).toFixed(1)},${yToPx(p.y).toFixed(1)}`)
      .join(' ');

    const u = String(unit || '');
    const yTicks = niceTicks(min, max, 5);
    const xTicks = [minX, minX + spanX / 2, maxX];
    const recommended = recommendedBand && Number.isFinite(recommendedBand?.min) && Number.isFinite(recommendedBand?.max) ? recommendedBand : null;

    const findNearest = (ts) => {
      const target = Number(ts);
      if (!Number.isFinite(target)) return null;
      let best = null;
      let bestDist = Infinity;
      for (const p of series) {
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
    const tooltipText1 = cursorPoint ? `${title}: ${cursorPoint.y.toFixed(1)}${u}` : '';
    const tooltipText2 = cursorPoint ? new Date(cursorPoint.x).toLocaleString() : '';

    const updateFromEvent = (evt) => {
      const x = Number(evt?.nativeEvent?.locationX);
      if (!Number.isFinite(x)) return;
      const px = clamp(x, padL, padL + plotW);
      const ts = minX + ((px - padL) / plotW) * spanX;
      setCursorTs(ts);
      setCursorVisible(true);
    };

    return (
      <View>
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
              <React.Fragment key={`${title}_yt_${t}`}>
                <Line x1={padL} y1={y} x2={w - padR} y2={y} stroke={gridColor} strokeWidth={1} />
                <Line x1={padL - 4} y1={y} x2={padL} y2={y} stroke={axisColor} strokeWidth={1} />
                <SvgText x={padL - 8} y={y + 4} fontSize="11" fontWeight="800" fill={labelColor} textAnchor="end">
                  {`${Number(t).toFixed(1)}${u}`}
                </SvgText>
              </React.Fragment>
            );
          })}
          {xTicks.map((t, idx) => {
            const x = xToPx(t);
            return <Line key={`${title}_xt_${idx}`} x1={x} y1={padT} x2={x} y2={h - padB} stroke={gridColor} strokeWidth={1} />;
          })}
          {Array.isArray(thresholdLines)
            ? thresholdLines
                .filter((l) => Number.isFinite(Number(l?.value)))
                .map((l) => {
                  const y = yToPx(Number(l.value));
                  return <Line key={`${title}_thr_${l.label}`} x1={padL} y1={y} x2={w - padR} y2={y} stroke={l.color} strokeWidth={1.5} strokeDasharray="6 4" />;
                })
            : null}
          <Polyline points={pts} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {cursorPoint ? (
            <>
              <Line x1={cursorX} y1={padT} x2={cursorX} y2={h - padB} stroke={labelColor} strokeWidth={1} />
              <Circle cx={cursorX} cy={cursorY} r={5} fill={color} />
              <Rect
                x={clamp(cursorX - 120, padL, w - padR - 240)}
                y={padT + 6}
                width={240}
                height={46}
                rx={10}
                fill={isDark ? 'rgba(2,6,23,0.92)' : 'rgba(255,255,255,0.92)'}
                stroke={isDark ? '#1F2937' : '#E5E7EB'}
                strokeWidth={1}
              />
              <SvgText x={clamp(cursorX - 110, padL + 10, w - padR - 230)} y={padT + 24} fontSize="12" fontWeight="900" fill={isDark ? '#E5E7EB' : '#111827'}>
                {tooltipText1}
              </SvgText>
              <SvgText x={clamp(cursorX - 110, padL + 10, w - padR - 230)} y={padT + 42} fontSize="11" fontWeight="700" fill={labelColor}>
                {tooltipText2}
              </SvgText>
            </>
          ) : null}
          <SvgText x={padL + plotW / 2} y={h - 5} fontSize="11" fontWeight="800" fill={labelColor} textAnchor="middle">
            Time
          </SvgText>
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
    );
  };

  const computeSparkStats = (pts) => {
    const safe = Array.isArray(pts)
      ? pts
          .map((p) => ({ x: Number(p?.x), y: Number(p?.y) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => a.x - b.x)
      : [];
    if (!safe.length) return { min: null, max: null, now: null };
    const ys = safe.map((p) => p.y);
    return { min: Math.min(...ys), max: Math.max(...ys), now: safe[safe.length - 1].y };
  };

  const humidityPoints = readingsForSparkline.map((r) => ({ x: r.createdAt, y: r.humidity }));
  const temperaturePoints = readingsForSparkline.map((r) => ({ x: r.createdAt, y: r.temperature }));
  const humidityStats = computeSparkStats(humidityPoints);
  const temperatureStats = computeSparkStats(temperaturePoints);

  return (
    <>
      <View style={[styles.bg, isDark && { backgroundColor: '#020617' }]}>
        <ScrollView style={[styles.container, isCompact && styles.containerCompact]} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, isCompact && styles.headerCardCompact, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderWidth: 1, borderColor: '#1F2937' }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.welcome, isDark && { color: '#F9FAFB' }]} numberOfLines={1} ellipsizeMode="tail">
                Welcome, {user.firstName}
              </Text>
              <View style={[styles.roleBadge, isDark && { backgroundColor: 'rgba(74,222,128,0.16)', borderColor: 'rgba(74,222,128,0.35)' }]}>
                <Text style={[styles.roleBadgeText, isDark && { color: '#A7F3D0' }]}>Monitoring</Text>
              </View>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: connectionIndicator.dot,
                },
              ]}
            />
            <Text style={[styles.statusText, isDark && { color: '#9CA3AF' }]}>
              {connectionIndicator.label}
            </Text>
            <Text style={styles.statusSep}>•</Text>
            <Text style={[styles.statusText, isDark && { color: '#9CA3AF' }]}>
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'No unread alerts'}
            </Text>
            {latestReading?.createdAt ? (
              <>
                <Text style={styles.statusSep}>•</Text>
                <Text style={[styles.statusText, isDark && { color: '#9CA3AF' }]}>Last reading: {new Date(latestReading.createdAt).toLocaleString()}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.statCard, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
              <Text style={styles.statNumber}>{k.value}</Text>
              <Text style={[styles.statLabel, isDark && { color: '#9CA3AF' }]}>{k.label}</Text>
              <Text style={[styles.statHelper, isDark && { color: '#9CA3AF' }]}>{k.helper}</Text>
            </View>
          ))}
        </View>

        <View style={styles.contentArea}>
          <View style={[styles.guideCard, isCompact && styles.guideCardCompact, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
              <Text style={[styles.guideText, isDark && { color: '#F9FAFB' }]}>Real-time monitoring dashboard</Text>
              <Text style={[styles.guideSubText, isCompact && styles.guideSubTextCompact, isDark && { color: '#9CA3AF' }]}>
                Track humidity and temperature in storage environments and monitor bean moisture to support safer Robusta coffee handling.
              </Text>
          </View>

          <View style={styles.grid2Col}>
            <View style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
              <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>System status</Text>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>API</Text>
                <Text style={[styles.kvValue, isDark && { color: '#E5E7EB' }]}>{apiStatus === 'ok' ? 'Online' : apiStatus === 'checking' ? 'Checking…' : 'Offline'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>Sensor</Text>
                <Text style={[styles.kvValue, isDark && { color: '#E5E7EB' }]}>
                  {Platform.OS === 'web'
                    ? connected
                      ? 'Live readings'
                      : latestReading
                        ? 'Stale / offline'
                        : 'No data yet'
                    : iotStatus === 'online'
                      ? connected
                        ? 'Online'
                        : latestReading
                          ? 'Online (stale)'
                          : 'Online (waiting)'
                      : iotStatus === 'connecting'
                        ? 'Connecting…'
                        : 'Offline'}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>Black mold risk</Text>
                <Text
                  style={[
                    styles.kvValue,
                    { color: blackRisk.level === 'high' ? theme.colors.danger : blackRisk.level === 'moderate' ? theme.colors.warning : theme.colors.brand },
                  ]}
                >
                  {blackRiskLabel}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>Forecast (≤{rules.forecastHours}h)</Text>
                <Text
                  style={[
                    styles.kvValue,
                    { color: forecast.level === 'imminent' ? theme.colors.danger : forecast.level === 'soon' ? theme.colors.warning : theme.colors.brand },
                  ]}
                >
                  {forecastLabel}
                  {forecast.hoursToRisk !== null ? ` (~${forecast.hoursToRisk.toFixed(1)}h)` : ''}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>Last alert</Text>
                <Text style={[styles.kvValue, isDark && { color: '#E5E7EB' }]}>{notifications[0]?.createdAt ? new Date(notifications[0].createdAt).toLocaleString() : 'None yet'}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={[styles.kvLabel, isDark && { color: '#9CA3AF' }]}>Thresholds</Text>
                <Text style={[styles.kvValue, isDark && { color: '#E5E7EB' }]}>
                  H {thresholds.humidity.min}–{thresholds.humidity.max}% • T {thresholds.temperature.min}–{thresholds.temperature.max}°C
                </Text>
              </View>
              <View style={styles.ctaRow}>
                <HoverPressable style={styles.primaryAction} onPress={openThresholds}>
                  <Text style={styles.primaryActionText}>Set thresholds</Text>
                </HoverPressable>
                <HoverPressable style={styles.secondaryAction} onPress={addTestReading}>
                  <Text style={styles.secondaryActionText}>Add test reading</Text>
                </HoverPressable>
                <HoverPressable style={styles.secondaryAction} onPress={() => navigation?.navigate?.('ReadingsTimeline')}>
                  <Text style={styles.secondaryActionText}>Readings</Text>
                </HoverPressable>
                <HoverPressable style={styles.secondaryAction} onPress={() => navigation?.navigate?.('AlertHistory')}>
                  <Text style={styles.secondaryActionText}>Alert history</Text>
                </HoverPressable>
              </View>
            </View>

            <View style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
              <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Trends (last 24h)</Text>
              <View style={styles.sparkControls}>
                <HoverPressable style={sparkSmoothEnabled ? styles.sparkToggleActive : styles.sparkToggle} onPress={() => setSparkSmoothEnabled(true)}>
                  <Text style={sparkSmoothEnabled ? styles.sparkToggleTextActive : styles.sparkToggleText}>Smoothed</Text>
                </HoverPressable>
                <HoverPressable style={!sparkSmoothEnabled ? styles.sparkToggleActive : styles.sparkToggle} onPress={() => setSparkSmoothEnabled(false)}>
                  <Text style={!sparkSmoothEnabled ? styles.sparkToggleTextActive : styles.sparkToggleText}>Raw</Text>
                </HoverPressable>
              </View>
              <Text style={[styles.cardHint, isDark && { color: '#9CA3AF' }]}>Humidity</Text>
              <Text style={[styles.sparkMeta, isDark && { color: '#9CA3AF' }]}>
                {humidityStats.now !== null ? `Now ${humidityStats.now.toFixed(1)}% • ` : ''}
                {humidityStats.min !== null ? `Min ${humidityStats.min.toFixed(1)}% • ` : ''}
                {humidityStats.max !== null ? `Max ${humidityStats.max.toFixed(1)}%` : ''}
              </Text>
              <Sparkline
                title="Humidity"
                points={humidityPoints}
                unit="%"
                color={theme.colors.brand}
                recommendedBand={{ min: 50, max: 60 }}
                thresholdLines={[
                  { value: thresholds?.humidity?.min, label: 'Min', color: theme.colors.brandDark },
                  { value: thresholds?.humidity?.max, label: 'Max', color: theme.colors.brandDark },
                ]}
              />
              <View style={{ height: 10 }} />
              <Text style={[styles.cardHint, isDark && { color: '#9CA3AF' }]}>Temperature</Text>
              <Text style={[styles.sparkMeta, isDark && { color: '#9CA3AF' }]}>
                {temperatureStats.now !== null ? `Now ${temperatureStats.now.toFixed(1)}°C • ` : ''}
                {temperatureStats.min !== null ? `Min ${temperatureStats.min.toFixed(1)}°C • ` : ''}
                {temperatureStats.max !== null ? `Max ${temperatureStats.max.toFixed(1)}°C` : ''}
              </Text>
              <Sparkline
                title="Temperature"
                points={temperaturePoints}
                unit="°C"
                color={theme.colors.accentTeal}
                recommendedBand={{ min: 35, max: 45 }}
                thresholdLines={[
                  { value: thresholds?.temperature?.min, label: 'Min', color: theme.colors.accentTeal },
                  { value: thresholds?.temperature?.max, label: 'Max', color: theme.colors.accentTeal },
                ]}
              />
            </View>

            <View style={[styles.card, { flexBasis: '100%' }, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
              <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Daily checklist</Text>
              <View style={styles.bullets}>
                {[
                  'Check humidity and temperature to prevent mold-friendly conditions in storage.',
                  'Monitor bean moisture for storage surveillance and better decisions.',
                  'Acknowledge important alerts so nothing gets missed.',
                ].map((t) => (
                  <View key={t} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={[styles.bulletText, isDark && { color: '#9CA3AF' }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
        </ScrollView>
      </View>

      {thresholdModal ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && { backgroundColor: 'rgba(2, 6, 23, 0.95)', borderColor: '#1F2937' }]}>
            <Text style={[styles.modalTitle, isDark && { color: '#F9FAFB' }]}>Set thresholds</Text>
            <Text style={[styles.modalSubtitle, isDark && { color: '#9CA3AF' }]}>Alerts trigger when readings exceed these ranges.</Text>
            <Text style={[styles.recommendedText, isDark && { color: '#9CA3AF' }]}>
              Recommended for Robusta drying: Humidity 50–60%, Temp 35–45°C
            </Text>

            <View style={styles.presetRow}>
              <HoverPressable
                style={[styles.presetBtn, preset === 'safe' && styles.presetBtnActive, isDark && styles.presetBtnDark]}
                onPress={() => {
                  setPreset('safe');
                  setThresholdDraft({ humidity: { min: 50, max: 60 }, temperature: { min: 35, max: 45 } });
                }}
              >
                <Text style={[styles.presetBtnText, preset === 'safe' && styles.presetBtnTextActive, isDark && { color: preset === 'safe' ? '#052e16' : '#E5E7EB' }]}>
                  Recommended
                </Text>
              </HoverPressable>
              <HoverPressable
                style={[styles.presetBtn, preset === 'high' && styles.presetBtnActive, isDark && styles.presetBtnDark]}
                onPress={() => {
                  setPreset('high');
                  setThresholdDraft({ humidity: { min: 60, max: 65 }, temperature: { min: 20, max: 25 } });
                }}
              >
                <Text style={[styles.presetBtnText, preset === 'high' && styles.presetBtnTextActive, isDark && { color: preset === 'high' ? '#052e16' : '#E5E7EB' }]}>
                  High risk
                </Text>
              </HoverPressable>
              <HoverPressable
                style={[styles.presetBtn, preset === 'custom' && styles.presetBtnActive, isDark && styles.presetBtnDark]}
                onPress={() => setPreset('custom')}
              >
                <Text style={[styles.presetBtnText, preset === 'custom' && styles.presetBtnTextActive, isDark && { color: preset === 'custom' ? '#052e16' : '#E5E7EB' }]}>
                  Custom
                </Text>
              </HoverPressable>
            </View>

            <Text style={[styles.sectionLabel, isDark && { color: '#9CA3AF' }]}>Threshold ranges</Text>

            <View style={styles.modalGrid}>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Humidity min (%)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(thresholdDraft.humidity.min)}
                  onChangeText={(v) => {
                    setPreset('custom');
                    setThresholdDraft((s) => ({ ...s, humidity: { ...s.humidity, min: Number(v) } }));
                  }}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Humidity max (%)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(thresholdDraft.humidity.max)}
                  onChangeText={(v) => {
                    setPreset('custom');
                    setThresholdDraft((s) => ({ ...s, humidity: { ...s.humidity, max: Number(v) } }));
                  }}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Temperature min (°C)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(thresholdDraft.temperature.min)}
                  onChangeText={(v) => {
                    setPreset('custom');
                    setThresholdDraft((s) => ({ ...s, temperature: { ...s.temperature, min: Number(v) } }));
                  }}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Temperature max (°C)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(thresholdDraft.temperature.max)}
                  onChangeText={(v) => {
                    setPreset('custom');
                    setThresholdDraft((s) => ({ ...s, temperature: { ...s.temperature, max: Number(v) } }));
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={[styles.sectionLabel, isDark && { color: '#9CA3AF' }]}>Alert rules</Text>
            <View style={styles.modalGrid}>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Humidity high (minutes)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.humidityHighMinutes)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, humidityHighMinutes: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Temperature high (minutes)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.temperatureHighMinutes)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, temperatureHighMinutes: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Black mold risk (minutes)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.moldRiskMinutes)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, moldRiskMinutes: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Forecast horizon (hours)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.forecastHours)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, forecastHours: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Escalation (minutes)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.escalationMinutes)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, escalationMinutes: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, isDark && { color: '#9CA3AF' }]}>Offline timeout (minutes)</Text>
                <TextInput
                  style={[styles.modalInput, isDark && { backgroundColor: '#0B1220', borderColor: '#374151', color: '#F9FAFB' }]}
                  value={String(rulesDraft.offlineMinutes)}
                  onChangeText={(v) => setRulesDraft((s) => ({ ...s, offlineMinutes: Number(v) }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <HoverPressable style={styles.secondaryAction} onPress={() => setThresholdModal(false)}>
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </HoverPressable>
              <HoverPressable style={styles.primaryAction} onPress={saveThresholds}>
                <Text style={styles.primaryActionText}>Save</Text>
              </HoverPressable>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    padding: 32,
  },
  containerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: theme.radius.card,
    padding: 32,
    marginBottom: 24,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  headerCardCompact: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcome: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  roleBadge: {
    backgroundColor: theme.colors.brandLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.brand,
  },
  roleBadgeText: {
    fontSize: 12,
    color: theme.colors.brandDark,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  statusSep: {
    fontSize: 12,
    color: theme.colors.border,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 16,
  },
  searchContainerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 20,
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 16,
    color: theme.colors.text,
    ...theme.shadows.soft,
  },
  searchBtn: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  searchBtnCompact: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  searchBtnText: {
    color: theme.colors.surface,
    fontWeight: '800',
    fontSize: 15,
  },
  contentArea: {
    gap: 24,
  },
  grid2Col: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  ctaRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryAction: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '900',
  },
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 12,
  },
  cardHint: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  sparkMeta: {
    marginTop: -2,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  sparkControls: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  sparkToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.55)',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  sparkToggleActive: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.brand,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  sparkToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  sparkToggleTextActive: {
    fontSize: 12,
    fontWeight: '900',
    color: '#052e16',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  kvLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  kvValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sparkEmpty: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkEmptyText: {
    fontWeight: '800',
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(14px)',
      },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 14,
  },
  recommendedText: {
    marginTop: -6,
    marginBottom: 14,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  presetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  presetBtnDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
    borderColor: '#1F2937',
  },
  presetBtnActive: {
    backgroundColor: theme.colors.brand,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  presetBtnText: {
    fontWeight: '900',
    color: theme.colors.text,
    fontSize: 12,
  },
  presetBtnTextActive: {
    color: '#052e16',
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalField: {
    flexGrow: 1,
    minWidth: 220,
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  modalInput: {
    height: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  bullets: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.brand,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  alertList: {
    gap: 12,
  },
  alertRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginTop: 5,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.text,
  },
  alertMessage: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 16,
  },
  secondaryAction: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  secondaryActionText: {
    color: theme.colors.brandDark,
    fontWeight: '900',
  },
  guideCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  guideCardCompact: {
    height: 'auto',
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
  },
  statsRowCompact: {
    flexDirection: 'column',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: theme.radius.card,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.brand,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statHelper: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
  },
  guideText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  guideSubText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  guideSubTextCompact: {
    maxWidth: '100%',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  farmCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  farmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  farmName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 16,
  },
  farmLocation: {
    fontSize: 13,
    color: theme.colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  farmDesc: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: 20,
    lineHeight: 22,
  },
  farmFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
  ownerName: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    ...theme.shadows.medium,
  },
  applyBtnText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 32,
  },
});
