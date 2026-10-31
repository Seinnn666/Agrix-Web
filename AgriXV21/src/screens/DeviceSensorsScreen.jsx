import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import ConfirmDialog from '../components/ConfirmDialog';
import { theme } from '../ui/theme';
import { dashboardStyles as layoutStyles } from '../components/dashboard/dashboardStyles';
import { clearAuth, loadAuth } from '../lib/authApi';
import { clearAdminAuth, hasAdminPanelAccess } from '../lib/adminApi';
import { ChevronRight, Moon, Sun } from '../components/Icons';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';
import {
  computeBlackAspergillusRisk,
  computeMoldRiskForecast,
  getAlertRules,
  getDeviceMeta,
  getIotIngestUrl,
  getIotSocketUrl,
  getLatestSensorReading,
  getSensorThresholds,
  isReadingFresh,
  listSensorReadings,
  setAlertRules,
  setDeviceMeta,
  setIotSocketUrl,
  subscribeSensors,
} from '../lib/sensors';

export default function DeviceSensorsScreen({ navigation }) {
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const canAccessAdmin = hasAdminPanelAccess();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const [latestReading, setLatestReading] = useState(() => getLatestSensorReading());
  const [thresholds, setThresholds] = useState(() => getSensorThresholds());
  const [device, setDevice] = useState(() => getDeviceMeta());
  const [rules, setRules] = useState(() => getAlertRules());
  const [draftDevice, setDraftDevice] = useState(() => getDeviceMeta());
  const [draftRules, setDraftRules] = useState(() => getAlertRules());
  const [iotSocketUrl, setIotSocketUrlState] = useState(() => getIotSocketUrl());
  const [draftIotSocketUrl, setDraftIotSocketUrl] = useState(() => getIotSocketUrl());
  const [iotTestStatus, setIotTestStatus] = useState('idle');
  const [iotTestMessage, setIotTestMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [lanIngestUrl, setLanIngestUrl] = useState('');

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => {
      setLatestReading(getLatestSensorReading());
      setThresholds(getSensorThresholds());
      setDevice(getDeviceMeta());
      setRules(getAlertRules());
      setIotSocketUrlState(getIotSocketUrl());
    };
    const unsub = subscribeSensors(refresh);
    refresh();
    return unsub;
  }, []);

  const connected = useMemo(() => {
    const offlineMinutes = Math.max(0, Number(rules.offlineMinutes || 0));
    return isReadingFresh(latestReading, offlineMinutes * 60 * 1000);
  }, [latestReading, rules.offlineMinutes]);

  const blackRisk = useMemo(() => {
    if (!latestReading) return { level: 'unknown', score: 0, minutesInRiskZone: 0, reason: 'No reading.' };
    return computeBlackAspergillusRisk(latestReading, listSensorReadings(), { windowMs: 24 * 60 * 60 * 1000 });
  }, [latestReading, thresholds]);

  const riskLabel =
    blackRisk.level === 'high'
      ? 'HIGH RISK'
      : blackRisk.level === 'moderate'
        ? 'MODERATE RISK'
        : blackRisk.level === 'low'
          ? 'LOW RISK'
          : 'UNKNOWN';
  const riskColor = blackRisk.level === 'high' ? theme.colors.danger : blackRisk.level === 'moderate' ? theme.colors.warning : theme.colors.brand;

  const forecast = useMemo(() => {
    if (!latestReading) return { level: 'unknown', hoursToRisk: null, predicted: null, reason: 'No reading.' };
    return computeMoldRiskForecast(latestReading, listSensorReadings(), { windowMs: 6 * 60 * 60 * 1000, horizonHours: rules.forecastHours });
  }, [latestReading, rules.forecastHours]);

  const forecastLabel =
    forecast.level === 'imminent'
      ? 'IMMINENT'
      : forecast.level === 'soon'
        ? 'SOON'
        : forecast.level === 'safe'
          ? 'SAFE'
          : 'UNKNOWN';

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

  const handleLogout = () => setLogoutVisible(true);

  const confirmLogoutNow = () => {
    setLogoutVisible(false);
    clearAuth();
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  const saveDevice = () => {
    const next = setDeviceMeta(draftDevice);
    setDevice(next);
  };

  const saveRules = () => {
    const next = setAlertRules(draftRules);
    setRules(next);
  };

  const ingestUrl = useMemo(() => getIotIngestUrl(), [iotSocketUrl]);

  useEffect(() => {
    let cancelled = false;
    setLanIngestUrl('');
    const base = String(iotSocketUrl || '').trim();
    if (!base) return () => {};
    (async () => {
      try {
        const u = new URL(base);
        const host = String(u.hostname || '').trim().toLowerCase();
        if (host !== 'localhost' && host !== '127.0.0.1') return;
        const res = await fetch(`${u.origin}/local-ip`, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const ips = Array.isArray(data?.ips) ? data.ips : [];
        const ip = String(ips[0] || '').trim();
        if (!ip) return;
        const port = String(u.port || '5000').trim() || '5000';
        const next = `http://${ip}:${port}/api/sensor-data`;
        if (cancelled) return;
        setLanIngestUrl(next);
      } catch (_err) {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iotSocketUrl]);

  const saveIot = () => {
    const next = setIotSocketUrl(draftIotSocketUrl);
    setIotSocketUrlState(next);
    setIotTestStatus('idle');
    setIotTestMessage('');
  };

  const testIot = async () => {
    const url = String(iotSocketUrl || '').trim();
    if (!url) {
      setIotTestStatus('fail');
      setIotTestMessage('Set IoT server URL first.');
      return;
    }
    setIotTestStatus('checking');
    setIotTestMessage('');
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/health`, { method: 'GET' });
      if (!res.ok) {
        setIotTestStatus('fail');
        setIotTestMessage(`Health check failed (${res.status}).`);
        return;
      }
      setIotTestStatus('ok');
      setIotTestMessage('IoT server is reachable.');
    } catch (_err) {
      setIotTestStatus('fail');
      setIotTestMessage('Cannot reach IoT server.');
    }
  };

  const copyArduinoUrl = async () => {
    setCopyStatus('');
    const toCopy = String(lanIngestUrl || ingestUrl || '').trim();
    if (!toCopy) {
      setCopyStatus('Nothing to copy.');
      return;
    }
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
      setCopyStatus('Copy is available on web.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopyStatus('Copied.');
    } catch (_err) {
      setCopyStatus('Copy failed.');
    }
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
                <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose('MyProfile')}>
                  <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                    My Profile
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

              <HoverPressable style={layoutStyles.logoutButton} onPress={handleLogout}>
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
                <Text style={[layoutStyles.pageTitle, isDark && { color: '#F9FAFB' }]}>Device & Sensors</Text>
                <Text style={[layoutStyles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                  Review device status, sensor freshness, alert rules, and your saved thresholds.
                </Text>

                <View style={styles.grid2Col}>
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Status</Text>
                    <View style={styles.kvRow}>
                      <Text style={[styles.kvLabel, isDark && styles.mutedDark]}>Device</Text>
                      <Text style={[styles.kvValue, isDark && styles.textDark]}>{device.deviceName || 'ESP32'}</Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={[styles.kvLabel, isDark && styles.mutedDark]}>Connection</Text>
                      <Text style={[styles.kvValue, { color: connected ? theme.colors.brand : theme.colors.danger }]}>
                        {connected ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={[styles.kvLabel, isDark && styles.mutedDark]}>Last seen</Text>
                      <Text style={[styles.kvValue, isDark && styles.textDark]}>
                        {latestReading?.createdAt ? new Date(latestReading.createdAt).toLocaleString() : 'No readings yet'}
                      </Text>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={[styles.kvLabel, isDark && styles.mutedDark]}>Black mold risk</Text>
                      <View style={[styles.badge, { borderColor: riskColor, backgroundColor: `${riskColor}22` }]}>
                        <Text style={[styles.badgeText, { color: riskColor }]}>{riskLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.kvRow}>
                      <Text style={[styles.kvLabel, isDark && styles.mutedDark]}>Forecast (≤{rules.forecastHours}h)</Text>
                      <View
                        style={[
                          styles.badge,
                          {
                            borderColor:
                              forecast.level === 'imminent'
                                ? theme.colors.danger
                                : forecast.level === 'soon'
                                  ? theme.colors.warning
                                  : theme.colors.brand,
                            backgroundColor: `${
                              forecast.level === 'imminent'
                                ? theme.colors.danger
                                : forecast.level === 'soon'
                                  ? theme.colors.warning
                                  : theme.colors.brand
                            }22`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color:
                                forecast.level === 'imminent'
                                  ? theme.colors.danger
                                  : forecast.level === 'soon'
                                    ? theme.colors.warning
                                    : theme.colors.brand,
                            },
                          ]}
                        >
                          {forecastLabel}
                          {forecast.hoursToRisk !== null ? ` (~${forecast.hoursToRisk.toFixed(1)}h)` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Shortcuts</Text>
                    <Text style={[layoutStyles.cardText, isDark && styles.mutedDark]}>
                      View data history and snapshots for verification and reporting.
                    </Text>
                    <View style={layoutStyles.ctaRow}>
                      <HoverPressable style={layoutStyles.ctaButton} onPress={() => navigation.navigate('ReadingsTimeline')}>
                        <Text style={layoutStyles.ctaButtonText}>Readings timeline</Text>
                      </HoverPressable>
                      <HoverPressable style={layoutStyles.ctaButton} onPress={() => navigation.navigate('GraphHistory')}>
                        <Text style={layoutStyles.ctaButtonText}>Graph history</Text>
                      </HoverPressable>
                      <HoverPressable style={layoutStyles.ctaButton} onPress={() => navigation.navigate('Snapshots')}>
                        <Text style={layoutStyles.ctaButtonText}>Snapshot gallery</Text>
                      </HoverPressable>
                      <HoverPressable style={layoutStyles.secondaryButton} onPress={() => navigation.navigate('AlertHistory')}>
                        <Text style={layoutStyles.secondaryButtonText}>Alert history</Text>
                      </HoverPressable>
                      <HoverPressable style={layoutStyles.secondaryButton} onPress={() => navigation.navigate('Dashboard', { view: 'monitoring' })}>
                        <Text style={layoutStyles.secondaryButtonText}>Open monitoring</Text>
                      </HoverPressable>
                    </View>
                  </View>
                </View>

                <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                  <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Connect device</Text>
                  <Text style={[layoutStyles.cardText, isDark && styles.mutedDark]}>
                    Set the IoT server URL (PC running iot-server.js). This also generates the Arduino server URL.
                  </Text>

                  <View style={styles.formGrid}>
                    <View style={[styles.formField, { minWidth: 320 }]}>
                      <Text style={[styles.formLabel, isDark && styles.mutedDark]}>IoT server URL</Text>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        value={draftIotSocketUrl}
                        onChangeText={setDraftIotSocketUrl}
                        placeholder="http://192.168.1.66:5000"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={[styles.formField, { minWidth: 320 }]}>
                      <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Arduino server URL</Text>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        value={lanIngestUrl || ingestUrl}
                        editable={false}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  <View style={layoutStyles.ctaRow}>
                    <HoverPressable style={layoutStyles.ctaButton} onPress={saveIot}>
                      <Text style={layoutStyles.ctaButtonText}>Save connection</Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.secondaryButton} onPress={testIot}>
                      <Text style={layoutStyles.secondaryButtonText}>
                        {iotTestStatus === 'checking' ? 'Testing…' : 'Test connection'}
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.secondaryButton} onPress={copyArduinoUrl}>
                      <Text style={layoutStyles.secondaryButtonText}>Copy Arduino URL</Text>
                    </HoverPressable>
                  </View>

                  {!!iotTestMessage && (
                    <Text style={[layoutStyles.cardText, { marginTop: 10, color: iotTestStatus === 'ok' ? theme.colors.brand : theme.colors.danger }]}>
                      {iotTestMessage}
                    </Text>
                  )}
                  {!!copyStatus && (
                    <Text style={[layoutStyles.cardText, { marginTop: 6, color: copyStatus === 'Copied.' ? theme.colors.brand : theme.colors.textMuted }]}>
                      {copyStatus}
                    </Text>
                  )}
                </View>

                <View style={styles.grid2Col}>
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Device info</Text>
                    <View style={styles.formGrid}>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Device name</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={draftDevice.deviceName}
                          onChangeText={(v) => setDraftDevice((s) => ({ ...s, deviceName: v }))}
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Firmware version</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={draftDevice.firmwareVersion}
                          onChangeText={(v) => setDraftDevice((s) => ({ ...s, firmwareVersion: v }))}
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Wi‑Fi strength (%)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={draftDevice.wifiStrength === null || typeof draftDevice.wifiStrength === 'undefined' ? '' : String(draftDevice.wifiStrength)}
                          onChangeText={(v) => setDraftDevice((s) => ({ ...s, wifiStrength: v }))}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={layoutStyles.ctaRow}>
                      <HoverPressable style={layoutStyles.ctaButton} onPress={saveDevice}>
                        <Text style={layoutStyles.ctaButtonText}>Save device info</Text>
                      </HoverPressable>
                    </View>
                  </View>

                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Alert rules</Text>
                    <Text style={[layoutStyles.cardText, isDark && styles.mutedDark]}>
                      Reduce noise by alerting only when readings stay risky for a duration.
                    </Text>
                    <View style={styles.formGrid}>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Humidity high (minutes)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.humidityHighMinutes)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, humidityHighMinutes: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Temperature high (minutes)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.temperatureHighMinutes)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, temperatureHighMinutes: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Black mold risk (minutes)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.moldRiskMinutes)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, moldRiskMinutes: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Forecast horizon (hours)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.forecastHours)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, forecastHours: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Escalation (minutes)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.escalationMinutes)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, escalationMinutes: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.formField}>
                        <Text style={[styles.formLabel, isDark && styles.mutedDark]}>Offline timeout (minutes)</Text>
                        <TextInput
                          style={[styles.input, isDark && styles.inputDark]}
                          value={String(draftRules.offlineMinutes)}
                          onChangeText={(v) => setDraftRules((s) => ({ ...s, offlineMinutes: Number(v) }))}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={layoutStyles.ctaRow}>
                      <HoverPressable style={layoutStyles.ctaButton} onPress={saveRules}>
                        <Text style={layoutStyles.ctaButtonText}>Save rules</Text>
                      </HoverPressable>
                    </View>
                  </View>
                </View>
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
  grid2Col: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
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
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
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
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  formField: {
    flexGrow: 1,
    minWidth: 240,
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
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
  inputDark: {
    backgroundColor: '#0B1220',
    borderColor: '#374151',
    color: '#F9FAFB',
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
