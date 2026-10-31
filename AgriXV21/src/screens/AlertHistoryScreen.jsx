import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import ConfirmDialog from '../components/ConfirmDialog';
import { dashboardStyles as layoutStyles } from '../components/dashboard/dashboardStyles';
import { theme } from '../ui/theme';
import { clearAuth } from '../lib/authApi';
import { clearAdminAuth, hasAdminPanelAccess } from '../lib/adminApi';
import { ChevronRight, Moon, Sun } from '../components/Icons';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';
import { acknowledgeNotification, listNotifications, muteNotification, subscribeNotifications, unmuteNotification, isNotificationMuted, getMuteUntil } from '../lib/notifications';

function levelColor(level) {
  if (level === 'error') return theme.colors.danger;
  if (level === 'success') return theme.colors.brand;
  return theme.colors.warning;
}

function formatShortTime(ts) {
  const time = Number(ts);
  if (!Number.isFinite(time) || time <= 0) return '';
  try {
    return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_err) {
    return '';
  }
}

export default function AlertHistoryScreen({ navigation }) {
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const canAccessAdmin = hasAdminPanelAccess();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const [filter, setFilter] = useState('all'); // all | unacknowledged | acknowledged
  const [items, setItems] = useState(() => listNotifications());

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => setItems(listNotifications());
    const unsub = subscribeNotifications(refresh);
    refresh();
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === 'unacknowledged') return Number(n.acknowledgedAt || 0) <= 0;
      if (filter === 'acknowledged') return Number(n.acknowledgedAt || 0) > 0;
      return true;
    });
  }, [filter, items]);

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

  const handleAcknowledge = (id) => {
    acknowledgeNotification(id);
    setItems(listNotifications());
  };

  const handleMute = (key) => {
    muteNotification(key, 60 * 60 * 1000);
    setItems(listNotifications());
  };

  const handleUnmute = (key) => {
    unmuteNotification(key);
    setItems(listNotifications());
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
                <Text style={[layoutStyles.pageTitle, isDark && { color: '#F9FAFB' }]}>Alert history</Text>
                <Text style={[layoutStyles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                  Review notifications and acknowledge important alerts.
                </Text>

                <View style={layoutStyles.ctaRow}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'unacknowledged', label: 'Unacknowledged' },
                    { key: 'acknowledged', label: 'Acknowledged' },
                  ].map((f) => (
                    <HoverPressable key={f.key} style={filter === f.key ? layoutStyles.ctaButton : layoutStyles.secondaryButton} onPress={() => setFilter(f.key)}>
                      <Text style={filter === f.key ? layoutStyles.ctaButtonText : layoutStyles.secondaryButtonText}>{f.label}</Text>
                    </HoverPressable>
                  ))}
                  <HoverPressable style={layoutStyles.secondaryButton} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={layoutStyles.secondaryButtonText}>Open Notifications</Text>
                  </HoverPressable>
                </View>

                <View style={{ height: 12 }} />

                {filtered.length === 0 ? (
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[styles.emptyText, isDark && styles.mutedDark]}>No alerts yet.</Text>
                  </View>
                ) : (
                  filtered.map((item) => (
                    <View key={item.id} style={[styles.itemCard, isDark && styles.cardDark, !item.read && styles.unreadCard]}>
                      <View style={styles.itemRow}>
                        <View style={[styles.levelDot, { backgroundColor: levelColor(item.level) }]} />
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemTitle, isDark && { color: '#F9FAFB' }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.itemMessage, isDark && styles.mutedDark]} numberOfLines={2}>
                            {item.message}
                          </Text>
                          <View style={styles.metaRow}>
                            <Text style={[styles.itemTime, isDark && styles.mutedDark]}>{new Date(item.createdAt).toLocaleString()}</Text>
                            {isNotificationMuted(item.key) ? (
                              <View style={styles.metaBadge}>
                                <Text style={styles.metaBadgeText}>Muted until {formatShortTime(getMuteUntil(item.key))}</Text>
                              </View>
                            ) : null}
                            {Number(item.acknowledgedAt || 0) > 0 ? (
                              <View style={[styles.metaBadge, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                                <Text style={[styles.metaBadgeText, { color: theme.colors.brandDark }]}>Acknowledged</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.actionRow}>
                            <HoverPressable style={styles.actionBtn} onPress={() => handleAcknowledge(item.id)}>
                              <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Acknowledge</Text>
                            </HoverPressable>
                            {isNotificationMuted(item.key) ? (
                              <HoverPressable style={styles.actionBtn} onPress={() => handleUnmute(item.key)}>
                                <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Unmute</Text>
                              </HoverPressable>
                            ) : (
                              <HoverPressable style={styles.actionBtn} onPress={() => handleMute(item.key)}>
                                <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Mute 1h</Text>
                              </HoverPressable>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
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
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '800',
    textAlign: 'center',
  },
  unreadCard: {
    borderColor: theme.colors.brand,
  },
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginTop: 4,
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.text,
  },
  itemMessage: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  actionBtnText: {
    fontWeight: '900',
    color: theme.colors.brandDark,
    fontSize: 12,
    letterSpacing: 0.2,
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
