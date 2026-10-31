import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../ui/theme';
import { listAdminActivity, getAdminActivitySeenAt, markAdminActivityRead } from '../lib/adminActivity';
import AgriXLogo from '../components/AgriXLogo';
import { ChevronRight, Moon, Sun } from '../components/Icons';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import ConfirmDialog from '../components/ConfirmDialog';
import { clearAuth, loadAuth } from '../lib/authApi';
import { clearAdminAuth, hasAdminPanelAccess } from '../lib/adminApi';
import { dashboardStyles as layoutStyles } from '../components/dashboard/dashboardStyles';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';
import {
  acknowledgeNotification,
  clearNotifications,
  disableWebNotifications,
  enableWebNotifications,
  getMuteUntil,
  isNotificationMuted,
  isWebNotificationsEnabled,
  isWebNotificationsSupported,
  listNotifications,
  listAdminNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  muteNotification,
  unmuteNotification,
  subscribeNotifications,
  markAdminNotificationsRead,
} from '../lib/notifications';

function formatDateTime(ts) {
  const time = Number(ts);
  if (!Number.isFinite(time)) return '';
  try {
    return new Date(time).toLocaleString();
  } catch (_err) {
    return '';
  }
}

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

export default function NotificationsScreen({ navigation }) {
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const adminView = hasAdminPanelAccess();
  const toAdminItems = () => [
    ...listAdminNotifications(),
    ...listAdminActivity(200).map((entry) => {
      const createdAt = Date.parse(entry.at) || 0;
      return {
        id: entry.id,
        title: entry.type ? String(entry.type).replace(/[_-]/g, ' ') : 'Admin activity',
        message: entry.message || 'Administrative activity recorded.',
        level: 'info',
        key: entry.type || 'admin_activity',
        read: createdAt <= getAdminActivitySeenAt(),
        createdAt,
        adminActivity: true,
      };
    }),
  ].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const getVisibleItems = () => adminView ? toAdminItems() : listNotifications();
  const [items, setItems] = useState(() => getVisibleItems());
  const [webNotifsEnabled, setWebNotifsEnabled] = useState(() => isWebNotificationsEnabled());
  const { token, user } = loadAuth();
  const canAccessAdmin = hasAdminPanelAccess();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  useEffect(() => {
    const refresh = () => setItems(getVisibleItems());
    const unsubscribe = subscribeNotifications(refresh);
    if (adminView) {
      markAdminActivityRead();
      markAdminNotificationsRead();
    }
    refresh();
    if (adminView) {
      const timer = setInterval(refresh, 1500);
      return () => { unsubscribe(); clearInterval(timer); };
    }
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  const unreadCount = items.filter((item) => !item.read).length;

  const handleRead = React.useCallback((id) => {
    if (!adminView) markNotificationRead(id);
    setItems(getVisibleItems());
  }, [adminView]);

  const handleReadAll = React.useCallback(() => {
    if (!adminView) markAllNotificationsRead();
    setItems(getVisibleItems());
  }, [adminView]);

  const handleClearAll = React.useCallback(() => {
    if (!adminView) clearNotifications();
    setItems(getVisibleItems());
  }, [adminView]);

  const handleAcknowledge = (id) => {
    if (!adminView) acknowledgeNotification(id);
    setItems(getVisibleItems());
  };

  const handleMute = (key) => {
    if (!adminView) muteNotification(key, 60 * 60 * 1000);
    setItems(getVisibleItems());
  };

  const handleUnmute = (key) => {
    if (!adminView) unmuteNotification(key);
    setItems(getVisibleItems());
  };

  const expandSidebar = () => {
    Animated.timing(sidebarTranslateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const collapseSidebar = () => {
    Animated.timing(sidebarTranslateY, {
      toValue: hiddenSidebarTranslateY,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const navigateAndClose = (routeName, params) => {
    navigation.navigate(routeName, params);
    collapseSidebar();
  };

  const openNotifications = () => {
    collapseSidebar();
  };

  const handleAdminPress = () => {
    navigation.navigate(canAccessAdmin ? 'AdminUsers' : 'AdminLogin');
    collapseSidebar();
  };

  const handleAdminDashboardPress = () => {
    navigation.navigate(canAccessAdmin ? 'AdminDashboard' : 'AdminLogin');
    collapseSidebar();
  };

  const handleLogout = () => {
    setLogoutVisible(true);
  };

  const confirmLogoutNow = () => {
    setLogoutVisible(false);
    clearAuth();
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  const subtitle = useMemo(() => {
    return unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up';
  }, [unreadCount]);

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: adminView ? 'AdminDashboard' : token ? 'Dashboard' : 'Landing' }] });
  };

  const goBack = () => {
    if (adminView) {
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      return;
    }
    try {
      if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
    } catch (_err) {}
    goHome();
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

  return (
    <SafeAreaView style={[layoutStyles.container, isDark && { backgroundColor: '#020617' }]}>
      <ScreenTransition type="slideRight">
        <Animated.View style={[layoutStyles.mainLayout, { opacity: fadeOpacity }]}>
          <View style={[layoutStyles.topNavbar, isDark && { backgroundColor: 'rgba(2, 6, 23, 0.85)', borderBottomColor: '#1F2937' }]}>
            <View style={styles.navLeft}>
              <HoverPressable style={styles.backButton} onPress={goBack}>
                <View style={styles.backIconWrap}>
                  <ChevronRight size={22} color={isDark ? '#4ADE80' : theme.colors.brand} />
                </View>
              </HoverPressable>
              <AgriXLogo
                onPress={goHome}
                style={layoutStyles.navbarLogo}
                variant="navbar"
                scale={1}
              />
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
                <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose(adminView ? 'AdminDashboard' : 'Dashboard')}>
                  <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                    Home
                  </Text>
                </HoverPressable>
                <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose(adminView ? 'AdminProfile' : 'MyProfile')}>
                  <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                    My Profile
                  </Text>
                </HoverPressable>

                {canAccessAdmin ? (
                  <>
                    <HoverPressable style={layoutStyles.menuItem} onPress={handleAdminDashboardPress}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Admin Dashboard
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.menuItem} onPress={handleAdminPress}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        User Management
                      </Text>
                    </HoverPressable>
                  </>
                ) : null}

                {!canAccessAdmin ? (
                  <>
                    <HoverPressable style={layoutStyles.menuItem} onPress={() => navigateAndClose('DeviceSensors')}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Device & Sensors
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.menuItem} onPress={openNotifications}>
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Notifications
                      </Text>
                    </HoverPressable>
                  </>
                ) : null}
                <HoverPressable style={layoutStyles.menuItem} onPress={toggleTheme}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {isDark ? <Moon size={16} color="#4ADE80" /> : <Sun size={16} color={theme.colors.brandDark} />}
                      <Text style={[layoutStyles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Dark mode
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 46,
                        height: 26,
                        borderRadius: 999,
                        padding: 3,
                        borderWidth: 1,
                        borderColor: isDark ? '#1F2937' : theme.colors.border,
                        backgroundColor: isDark ? 'rgba(74,222,128,0.18)' : 'rgba(15,23,42,0.06)',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          backgroundColor: isDark ? '#4ADE80' : '#fff',
                          transform: [{ translateX: isDark ? 20 : 0 }],
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(74,222,128,0.35)' : theme.colors.border,
                        }}
                      />
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
                <Text style={[layoutStyles.pageTitle, isDark && { color: '#F9FAFB' }]}>{adminView ? 'Admin Notifications' : 'Notifications'}</Text>
                <Text style={[layoutStyles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>{subtitle}</Text>

                {!adminView && Platform.OS === 'web' && isWebNotificationsSupported() ? (
                  <>
                    <View style={{ height: 14 }} />
                    <View style={[layoutStyles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
                      <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Browser notifications</Text>
                      <Text style={[layoutStyles.cardText, isDark && { color: '#9CA3AF' }]}>
                        Shows system notifications for important alerts while this site is open.
                      </Text>
                      <View style={layoutStyles.ctaRow}>
                        {webNotifsEnabled ? (
                          <HoverPressable
                            style={layoutStyles.secondaryButton}
                            onPress={() => {
                              disableWebNotifications();
                              setWebNotifsEnabled(false);
                            }}
                          >
                            <Text style={layoutStyles.secondaryButtonText}>Turn off</Text>
                          </HoverPressable>
                        ) : (
                          <HoverPressable
                            style={layoutStyles.ctaButton}
                            onPress={async () => {
                              const res = await enableWebNotifications();
                              setWebNotifsEnabled(Boolean(res?.ok));
                            }}
                          >
                            <Text style={layoutStyles.ctaButtonText}>Turn on</Text>
                          </HoverPressable>
                        )}
                      </View>
                    </View>
                  </>
                ) : null}

                {!adminView ? <View style={layoutStyles.ctaRow}>
                  <HoverPressable style={layoutStyles.ctaButton} onPress={handleReadAll}>
                    <Text style={layoutStyles.ctaButtonText}>Mark all as read</Text>
                  </HoverPressable>
                  <HoverPressable style={layoutStyles.secondaryButton} onPress={handleClearAll}>
                    <Text style={layoutStyles.secondaryButtonText}>Clear all</Text>
                  </HoverPressable>
                </View> : null}

                <View style={{ height: 16 }} />

                {items.length === 0 ? (
                  <View style={[layoutStyles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}>
                    <Text style={[styles.emptyText, isDark && { color: '#9CA3AF' }]}>No updates yet.</Text>
                  </View>
                ) : (
                  items.map((item) => (
                    <HoverPressable
                      key={item.id}
                      style={[
                        styles.itemCard,
                        isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' },
                        !item.read && styles.unreadCard,
                      ]}
                      onPress={() => handleRead(item.id)}
                      hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -4 }], opacity: 1 } : null}
                      pressedStyle={{ opacity: 0.85 }}
                    >
                      <View style={styles.itemRow}>
                        <View style={[styles.levelDot, { backgroundColor: levelColor(item.level) }]} />
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemTitle, isDark && { color: '#F9FAFB' }]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.itemMessage, isDark && { color: '#9CA3AF' }]} numberOfLines={2}>
                            {item.message}
                          </Text>
                          <View style={styles.metaRow}>
                            <Text style={[styles.itemTime, isDark && { color: '#9CA3AF' }]}>{formatDateTime(item.createdAt)}</Text>
                            {!adminView && isNotificationMuted(item.key) ? (
                              <View style={styles.metaBadge}>
                                <Text style={styles.metaBadgeText}>
                                  Muted until {formatShortTime(getMuteUntil(item.key))}
                                </Text>
                              </View>
                            ) : null}
                            {!adminView && Number(item.acknowledgedAt || 0) > 0 ? (
                              <View style={[styles.metaBadge, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                                <Text style={[styles.metaBadgeText, { color: theme.colors.brandDark }]}>Acknowledged</Text>
                              </View>
                            ) : null}
                          </View>
                          {!adminView ? <View style={styles.actionRow}>
                            <HoverPressable
                              style={styles.actionBtn}
                              onPress={() => handleAcknowledge(item.id)}
                              hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -2 }], opacity: 1 } : null}
                            >
                              <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Acknowledge</Text>
                            </HoverPressable>
                            {isNotificationMuted(item.key) ? (
                              <HoverPressable
                                style={styles.actionBtn}
                                onPress={() => handleUnmute(item.key)}
                                hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -2 }], opacity: 1 } : null}
                              >
                                <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Unmute</Text>
                              </HoverPressable>
                            ) : (
                              <HoverPressable
                                style={styles.actionBtn}
                                onPress={() => handleMute(item.key)}
                                hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -2 }], opacity: 1 } : null}
                              >
                                <Text style={[styles.actionBtnText, isDark && { color: '#A7F3D0' }]}>Mute 1h</Text>
                              </HoverPressable>
                            )}
                          </View> : null}
                        </View>
                      </View>
                    </HoverPressable>
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
  emptyText: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
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
        transition: 'transform 0.22s cubic-bezier(0.22,0.61,0.36,1), opacity 0.22s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metaRow: {
    marginTop: 8,
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
    ...Platform.select({
      web: {
        transition: 'transform 0.22s cubic-bezier(0.22,0.61,0.36,1), opacity 0.22s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  actionBtnText: {
    fontWeight: '900',
    color: theme.colors.brandDark,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    marginTop: 5,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  itemMessage: {
    marginTop: 4,
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  itemTime: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
