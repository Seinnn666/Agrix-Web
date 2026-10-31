import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { addSnapshot, listSnapshots, setLatestSnapshot, subscribeSensors } from '../lib/sensors';

export default function SnapshotsScreen({ navigation }) {
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const canAccessAdmin = hasAdminPanelAccess();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';

  const [items, setItems] = useState(() => listSnapshots());
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => setItems(listSnapshots());
    const unsub = subscribeSensors(refresh);
    refresh();
    return unsub;
  }, []);

  const selectedItems = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i]));
    return selected.map((id) => map.get(id)).filter(Boolean);
  }, [items, selected]);

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

  const pickSnapshot = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        const item = addSnapshot({ url, createdAt: Date.now() });
        if (item) setLatestSnapshot(item);
        setItems(listSnapshots());
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
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
                <Text style={[layoutStyles.pageTitle, isDark && { color: '#F9FAFB' }]}>Snapshot gallery</Text>
                <Text style={[layoutStyles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                  Upload snapshots and compare two images for visual verification.
                </Text>

                {Platform.OS === 'web' ? (
                  <View style={layoutStyles.ctaRow}>
                    <HoverPressable style={layoutStyles.ctaButton} onPress={pickSnapshot}>
                      <Text style={layoutStyles.ctaButtonText}>Upload snapshot</Text>
                    </HoverPressable>
                    <HoverPressable style={layoutStyles.secondaryButton} onPress={() => setSelected([])}>
                      <Text style={layoutStyles.secondaryButtonText}>Clear selection</Text>
                    </HoverPressable>
                  </View>
                ) : null}

                <View style={{ height: 12 }} />

                {selectedItems.length === 2 ? (
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[layoutStyles.cardTitle, isDark && { color: '#F9FAFB' }]}>Compare</Text>
                    <View style={styles.compareRow}>
                      {selectedItems.map((s) => (
                        <View key={s.id} style={styles.compareCol}>
                          <Image source={{ uri: s.url }} style={styles.compareImage} resizeMode="cover" />
                          <Text style={[styles.compareMeta, isDark && styles.mutedDark]}>{new Date(s.createdAt).toLocaleString()}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {items.length === 0 ? (
                  <View style={[layoutStyles.card, isDark && styles.cardDark]}>
                    <Text style={[styles.emptyText, isDark && styles.mutedDark]}>No snapshots yet.</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {items.map((s) => {
                      const isSelected = selected.includes(s.id);
                      return (
                        <HoverPressable
                          key={s.id}
                          style={[styles.thumbCard, isDark && styles.thumbCardDark, isSelected && styles.thumbSelected]}
                          onPress={() => toggleSelect(s.id)}
                        >
                          <Image source={{ uri: s.url }} style={styles.thumbImage} resizeMode="cover" />
                          <Text style={[styles.thumbMeta, isDark && styles.mutedDark]} numberOfLines={1}>
                            {new Date(s.createdAt).toLocaleString()}
                          </Text>
                        </HoverPressable>
                      );
                    })}
                  </View>
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
  grid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  thumbCard: {
    width: 220,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  thumbCardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#1F2937',
  },
  thumbSelected: {
    borderColor: theme.colors.brand,
  },
  thumbImage: {
    width: '100%',
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  thumbMeta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  compareCol: {
    flexGrow: 1,
    minWidth: 260,
  },
  compareImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compareMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
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
