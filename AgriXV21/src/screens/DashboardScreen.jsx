import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Animated, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import { API_BASE_URL, clearAuth, loadAuth } from '../lib/authApi';
import { clearAdminAuth, hasAdminPanelAccess } from '../lib/adminApi';
import { listAdminActivity } from '../lib/adminActivity';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import { theme } from '../ui/theme';
import { dashboardStyles as styles } from '../components/dashboard/dashboardStyles';
import AppFooter from '../components/AppFooter';
import ConfirmDialog from '../components/ConfirmDialog';
import FarmerDashboard from '../components/dashboard/FarmerDashboard';
import { Bell, Moon, Sun, User } from '../components/Icons';
import { listNotifications, subscribeNotifications } from '../lib/notifications';
import { addSensorReading, getIotSocketUrl, getLatestSensorReading, isReadingFresh, startSensorSync, subscribeSensors } from '../lib/sensors';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';

export default function DashboardScreen({ navigation, route }) {
  const hiddenSidebarTranslateY = -520;
  // Animation value for sidebar translation (starts above, hidden)
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current; 
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const scrollRef = useRef(null);
  const lastIngestTsRef = useRef(0);
  const isWeb = Platform.OS === 'web';
  const [iotStatus, setIotStatus] = useState(() => (Platform.OS === 'web' ? 'disabled' : 'connecting'));
  const [iotSocketUrl, setIotSocketUrlState] = useState(() => getIotSocketUrl());
  const [logoutVisible, setLogoutVisible] = useState(false);
  const { user } = loadAuth();
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';
  const dashboardRouteName = 'Dashboard';
  const [dashboardView, setDashboardView] = useState(() => {
    const name = String(route?.name || '');
    if (name === 'FarmerDashboard') return 'monitoring';
    return 'overview';
  });

  useEffect(() => {
    const view = String(route?.params?.view || '').trim().toLowerCase();
    if (view === 'monitoring' || view === 'overview') {
      setDashboardView(view);
    }
  }, [route?.params?.view]);

  useEffect(() => {
    const unsub = subscribeTheme(() => setThemeMode(getThemeMode()));
    setThemeMode(getThemeMode());
    return unsub;
  }, []);

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

  const handleLogout = () => {
    setLogoutVisible(true);
  };
  const confirmLogoutNow = () => {
    setLogoutVisible(false);
    clearAuth();
    clearAdminAuth();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  };

  const expandSidebar = () => {
    Animated.timing(sidebarTranslateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const navigateAndClose = (routeName) => {
    navigation.navigate(routeName);
    collapseSidebar();
  };

  const openNotifications = () => {
    navigation.navigate('Notifications');
    setTimeout(() => {
      const state = navigation.getState?.();
      const currentRouteName = state?.routes?.[state?.index || 0]?.name;
      if (currentRouteName !== 'Notifications') {
        navigation.reset({ index: 0, routes: [{ name: 'Notifications' }] });
      }
    }, 0);
    setTimeout(collapseSidebar, 0);
  };

  const handleAdminPress = () => {
    const can = hasAdminPanelAccess();
    if (!can) return;
    navigation.navigate('AdminUsers');
    collapseSidebar();
  };

  const handleAdminDashboardPress = () => {
    const can = hasAdminPanelAccess();
    if (!can) return;
    navigation.navigate('AdminDashboard');
    collapseSidebar();
  };

  const canAccessAdmin = hasAdminPanelAccess();

  const [apiStatus, setApiStatus] = useState('unknown');
  const adminActivity = useMemo(() => (canAccessAdmin ? listAdminActivity(6) : []), [canAccessAdmin]);
  const [unreadCount, setUnreadCount] = useState(() => listNotifications().filter((n) => !n.read).length);
  const [latestReading, setLatestReading] = useState(() => getLatestSensorReading());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

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
    const stop = startSensorSync({
      baseUrl: API_BASE_URL,
      getToken: () => loadAuth()?.token,
    });
    return stop;
  }, []);

  useEffect(() => {
    const refresh = () => setUnreadCount(listNotifications().filter((n) => !n.read).length);
    const unsub = subscribeNotifications(refresh);
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => {
      setLatestReading(getLatestSensorReading());
      setIotSocketUrlState(getIotSocketUrl());
    };
    const unsub = subscribeSensors(refresh);
    refresh();
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const socketUrl = iotSocketUrl;
    if (!socketUrl) {
      setIotStatus('disabled');
      return;
    }
    let cancelled = false;
    let socket = null;

    (async () => {
      try {
        const mod = await import('socket.io-client/dist/socket.io.js');
        const ioClient = mod?.default || mod?.io || mod;
        if (cancelled) return;
        if (typeof ioClient !== 'function') {
          setIotStatus('error');
          return;
        }

        socket = ioClient(socketUrl, {
          transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
          setIotStatus('online');
        });

        socket.on('deviceStatus', (status) => {
          const s = String(status?.status || '').toLowerCase();
          if (s === 'offline') setIotStatus('offline');
          if (s === 'online') setIotStatus('online');
        });

        socket.on('sensorUpdate', (data) => {
          const temperature = Number(data?.temp ?? data?.temperature);
          const humidity = Number(data?.hum ?? data?.humidity);
          const soilMoisture = Number(data?.soil ?? data?.soilMoisture);
          const createdAt = Date.now();

          addSensorReading({
            temperature: Number.isFinite(temperature) ? temperature : null,
            humidity: Number.isFinite(humidity) ? humidity : null,
            soilMoisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
            createdAt,
            source: 'socket',
          });

          try {
            const token = String(loadAuth()?.token || '').trim();
            if (!token) return;
            if (createdAt <= (lastIngestTsRef.current || 0)) return;
            lastIngestTsRef.current = createdAt;
            fetch(`${API_BASE_URL}/sensors/ingest-auth`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                deviceId: 'esp32',
                temperature: Number.isFinite(temperature) ? temperature : null,
                humidity: Number.isFinite(humidity) ? humidity : null,
                soilMoisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
                createdAt,
              }),
            }).catch(() => {});
          } catch (_err) {
          }
        });

        socket.on('disconnect', () => {
          setIotStatus('offline');
        });

        socket.on('connect_error', (err) => {
          setIotStatus('error');
        });
      } catch (err) {
        setIotStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      try {
        socket?.removeAllListeners?.();
        socket?.disconnect?.();
      } catch (_err) {}
    };
  }, [iotSocketUrl]);

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
      socket = io(socketUrl, {
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        setIotStatus('online');
      });

      socket.on('deviceStatus', (status) => {
        const s = String(status?.status || '').toLowerCase();
        if (s === 'offline') setIotStatus('offline');
        if (s === 'online') setIotStatus('online');
      });

      socket.on('sensorUpdate', (data) => {
        const temperature = Number(data?.temp ?? data?.temperature);
        const humidity = Number(data?.hum ?? data?.humidity);
        const soilMoisture = Number(data?.soil ?? data?.soilMoisture);
        const createdAt = Date.now();

        addSensorReading({
          temperature: Number.isFinite(temperature) ? temperature : null,
          humidity: Number.isFinite(humidity) ? humidity : null,
          soilMoisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
          createdAt,
          source: 'socket',
        });

        try {
          const token = String(loadAuth()?.token || '').trim();
          if (!token) return;
          if (createdAt <= (lastIngestTsRef.current || 0)) return;
          lastIngestTsRef.current = createdAt;
          fetch(`${API_BASE_URL}/sensors/ingest-auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              deviceId: 'esp32',
              temperature: Number.isFinite(temperature) ? temperature : null,
              humidity: Number.isFinite(humidity) ? humidity : null,
              soilMoisture: Number.isFinite(soilMoisture) ? soilMoisture : null,
              createdAt,
            }),
          }).catch(() => {});
        } catch (_err) {
        }
      });

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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const done = window.localStorage.getItem('agrix_onboarding_done');
      if (done === '1') return;
      setShowOnboarding(true);
    } catch (_err) {}
  }, []);

  const collapseSidebar = () => {
    Animated.timing(sidebarTranslateY, {
      toValue: hiddenSidebarTranslateY,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const getInitials = (fullName) => {
    const parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const teamMembers = [
    {
      name: 'Zachary George Empeno',
      role: 'Project Leader',
      photoUri:
        'https://scontent.fmnl33-4.fna.fbcdn.net/v/t1.15752-9/618398485_916689408202901_5475509119032322907_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=9f807c&_nc_ohc=1tpfcsN0C6oQ7kNvwGvUPSE&_nc_oc=AdktMZAJ07eq--qBibO_nhRI9cUiubVDPenzizNeLo0AZ4Odhn4nNjabCztO91Cn-5DKmGE40kFOFnjUzfLp9gT7&_nc_zt=23&_nc_ht=scontent.fmnl33-4.fna&oh=03_Q7cD4QHj1cPV7myiov8P6hCJNQ9dv27kOYN3MrSmMroo8ySyCA&oe=69A2BD8F',
    },
    {
      name: 'Ralf Enzo Jamir',
      role: 'Documenter / Technical Writer',
      photoUri:
        'https://scontent.fmnl33-3.fna.fbcdn.net/v/t1.15752-9/622612544_25701136436206493_8147912640893512915_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=9f807c&_nc_ohc=rtQozUIkbg8Q7kNvwHlPmnI&_nc_oc=Adka_5_XEiFt-KUnF_4Rk8H_ARnwiDxnapCRHObp5QTTxY05vbttJAg1X90_aFgKEFgW44UZ784NSgNWx4RZedby&_nc_zt=23&_nc_ht=scontent.fmnl33-3.fna&oh=03_Q7cD4QHfV6y1j2GIu4ACAmKndcCLcz2_uOfwgSji7BqFc4E3lQ&oe=69A2AB99',
    },
    {
      name: 'Jose Gabriel Muyar',
      role: 'Lead Programmer',
      photoUri:
        'https://scontent.fmnl33-5.fna.fbcdn.net/v/t1.15752-9/616786250_877722314870243_5607786263582428274_n.png?_nc_cat=102&ccb=1-7&_nc_sid=9f807c&_nc_ohc=Wy0IYKGpT5UQ7kNvwFp-hi2&_nc_oc=Adkhd17jE-JFlh1c16xaW3Ne0H5ebeIOqzMsFdaqQX_dWDee1rhPGCv_pkQva6xMekCVYslAllZExAYc7FpJGDPv&_nc_zt=23&_nc_ht=scontent.fmnl33-5.fna&oh=03_Q7cD4QFWlIS3EFYkLHyHcIvwDn6HR41hYFI4s13hJeqWNTZj7w&oe=69A2B114',
    },
    {
      name: 'Zhane Gabriel Makalisang',
      role: 'System Analyst',
      photoUri:
        'https://scontent.fmnl33-2.fna.fbcdn.net/v/t1.15752-9/619996155_1534900844478008_1453407836970260487_n.png?_nc_cat=104&ccb=1-7&_nc_sid=9f807c&_nc_ohc=wKUiDMl7riEQ7kNvwG0w5XJ&_nc_oc=AdnepFLv77pnD55uYAe1lEouYAxtEp7PSVi6h8NH9LY_0XeA1CKdwsmSelhMONxrLTfAhgBcCgQDMcWM1NuisDWc&_nc_zt=23&_nc_ht=scontent.fmnl33-2.fna&oh=03_Q7cD4QHFyidUOfRhcPzwwrWXQ4bwfUdsciHrEhQmcGgwh5GCLA&oe=69A2A95A',
    },
  ];

  const TeamMemberCard = ({ member }) => {
    const [imageFailed, setImageFailed] = React.useState(false);
    const shouldShowImage = Boolean(member.photoUri) && !imageFailed;

    return (
      <HoverPressable
        key={member.name}
        style={styles.teamCard}
        hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.01 }] }}
      >
        {shouldShowImage ? (
          <Image
            source={{ uri: member.photoUri }}
            style={styles.teamPhoto}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.teamPhotoFallback}>
            <Text style={styles.teamInitials}>{getInitials(member.name)}</Text>
          </View>
        )}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName} numberOfLines={2}>
            {member.name}
          </Text>
          <Text style={styles.teamRole} numberOfLines={2}>
            {member.role}
          </Text>
        </View>
      </HoverPressable>
    );
  };

  const connected = isReadingFresh(latestReading, 5 * 60 * 1000);
  const liveConnected = isWeb ? connected : String(iotStatus || '') === 'online' && connected;
  const displayReading = liveConnected ? latestReading : null;
  const statusPill = useMemo(() => {
    if (isWeb) {
      const hasAnyReading = Boolean(latestReading);
      return {
        bg: liveConnected ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)',
        color: liveConnected ? theme.colors.brandDark : theme.colors.danger,
        label: liveConnected
          ? 'Connected'
          : apiStatus === 'checking'
            ? 'Checking…'
            : apiStatus !== 'ok'
              ? 'Offline'
              : hasAnyReading
                ? 'Disconnected'
                : 'No sensor data yet',
      };
    }

    const s = String(iotStatus || '');
    if (s === 'online') {
      return {
        bg: 'rgba(34,197,94,0.10)',
        color: theme.colors.brandDark,
        label: latestReading ? (connected ? 'Online' : 'Offline') : 'Online (waiting for data)',
      };
    }
    if (s === 'connecting') {
      return { bg: 'rgba(245,158,11,0.12)', color: theme.colors.warning, label: 'Connecting…' };
    }
    return { bg: 'rgba(239,68,68,0.08)', color: theme.colors.danger, label: 'Offline' };
  }, [isWeb, liveConnected, apiStatus, iotStatus, latestReading, connected]);
  const kpis = useMemo(() => {
    const fmt = (v, suffix) => {
      if (typeof v === 'number') return `${v.toFixed(1)}${suffix}`;
      if (apiStatus === 'checking') return 'Loading…';
      if (!liveConnected) return latestReading ? 'Disconnected' : 'No data yet';
      return 'No data yet';
    };
    return [
      { label: 'Temperature', value: fmt(displayReading?.temperature, '°C'), dot: theme.colors.brand },
      { label: 'Humidity', value: fmt(displayReading?.humidity, '%'), dot: theme.colors.accentTeal },
      { label: 'Bean Moisture', value: fmt(displayReading?.soilMoisture, '%'), dot: theme.colors.brandDark },
    ];
  }, [displayReading, apiStatus, liveConnected, latestReading]);

  const monitoringCapabilities = [
    { title: 'Real-time humidity and temperature', body: 'Monitor storage conditions continuously to reduce mold risk.' },
    { title: 'Bean moisture tracking', body: 'Track bean moisture levels to support safer storage decisions.' },
    { title: 'Threshold alerts', body: 'Receive notifications when readings exceed safe limits.' },
  ];

  const BodyWrapper = isWeb ? View : ScrollView;
  const bodyWrapperProps = isWeb
    ? { style: { flex: 1 } }
    : {
        ref: scrollRef,
        style: [{ flex: 1 }],
        contentContainerStyle: { flexGrow: 1 },
      };

  return (
    <SafeAreaView style={[styles.container, isDark && { backgroundColor: '#020617' }]}>
      <ScreenTransition type="slideRight">
        <Animated.View style={[styles.mainLayout, { opacity: fadeOpacity }]}>
          <View style={[styles.topNavbar, isDark && { backgroundColor: 'rgba(2, 6, 23, 0.85)', borderBottomColor: '#1F2937' }]}>
            <AgriXLogo
              onPress={() => navigation.reset({ index: 0, routes: [{ name: dashboardRouteName }] })}
              style={styles.navbarLogo}
              variant="navbar"
              scale={1}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HoverPressable
                style={[styles.hamburgerContainer, { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }]}
                onPress={openNotifications}
              >
                <Bell size={18} color={isDark ? '#E5E7EB' : theme.colors.brandDark} />
                {unreadCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 16,
                      paddingHorizontal: 4,
                      backgroundColor: theme.colors.danger,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{Math.min(99, unreadCount)}</Text>
                  </View>
                ) : null}
              </HoverPressable>
              <HoverPressable
                style={[styles.hamburgerContainer, { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }]}
                onPress={() => navigation.navigate('MyProfile')}
              >
                <User size={18} color={isDark ? '#E5E7EB' : theme.colors.brandDark} />
              </HoverPressable>
              <HoverPressable style={styles.hamburgerContainer} onPress={expandSidebar} onHoverIn={expandSidebar}>
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
              </HoverPressable>
            </View>
          </View>

          <Animated.View
            style={[
              styles.sidebar,
              isDark && { backgroundColor: 'rgba(2, 6, 23, 0.92)', borderColor: '#1F2937' },
              { transform: [{ translateY: sidebarTranslateY }] },
            ]}
            onMouseLeave={collapseSidebar}
            onMouseEnter={expandSidebar}
          >
            <View style={styles.sidebarContent}>
              <View style={styles.sidebarHeader}>
                <Text style={[styles.logoText, isDark && { color: '#4ADE80' }]} numberOfLines={1}>
                  AGRIX
                </Text>
                <Text style={[styles.subLogoText, isDark && { color: '#9CA3AF' }]} numberOfLines={1}>
                  Coffee Crop Tracker
                </Text>
              </View>

              <View style={styles.menuItems}>
                <HoverPressable style={styles.menuItem} onPress={() => navigateAndClose('MyProfile')}>
                  <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                    My Profile
                  </Text>
                </HoverPressable>
                {canAccessAdmin ? (
                  <>
                    <HoverPressable style={styles.menuItem} onPress={handleAdminDashboardPress}>
                      <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Admin Dashboard
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={styles.menuItem} onPress={handleAdminPress}>
                      <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        User Management
                      </Text>
                    </HoverPressable>
                  </>
                ) : null}
                {!canAccessAdmin ? (
                  <>
                    <HoverPressable
                      style={styles.menuItem}
                      onPress={() => {
                        navigation.navigate('DeviceSensors');
                        collapseSidebar();
                      }}
                    >
                      <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Device & Sensors
                      </Text>
                    </HoverPressable>
                    <HoverPressable style={styles.menuItem} onPress={openNotifications}>
                      <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
                        Notifications
                      </Text>
                    </HoverPressable>
                  </>
                ) : null}
                <HoverPressable style={styles.menuItem} onPress={toggleTheme}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {isDark ? <Moon size={16} color="#4ADE80" /> : <Sun size={16} color={theme.colors.brandDark} />}
                      <Text style={[styles.menuText, isDark && { color: '#E5E7EB' }]} numberOfLines={1}>
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

              <HoverPressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={[styles.menuText, { color: theme.colors.danger }]} numberOfLines={1}>
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

          {showOnboarding ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(15,23,42,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                zIndex: 999,
              }}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 620,
                  backgroundColor: 'rgba(255,255,255,0.96)',
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: 18,
                  ...theme.shadows.soft,
                  ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } : null),
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.text }}>
                  Quick start ({onboardingStep + 1}/4)
                </Text>
                <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, lineHeight: 18 }}>
                  {[
                    'Check the Dashboard cards for the latest humidity, temperature, soil pH, and soil moisture readings.',
                    'Use Monitoring to review sensor trends and thresholds.',
                    'Use Notifications for alerts. Acknowledge important updates and mute noisy categories for 1 hour.',
                    'Update your Profile anytime. Changes and verification steps will still notify you.',
                  ][onboardingStep]}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10, flexWrap: 'wrap' }}>
                  <HoverPressable
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: 'rgba(255,255,255,0.65)',
                    }}
                    onPress={() => {
                      try {
                        if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem('agrix_onboarding_done', '1');
                      } catch (_err) {}
                      setShowOnboarding(false);
                      setOnboardingStep(0);
                    }}
                  >
                    <Text style={{ fontWeight: '900', color: theme.colors.text }}>Skip</Text>
                  </HoverPressable>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <HoverPressable
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: 'rgba(255,255,255,0.65)',
                        opacity: onboardingStep === 0 ? 0.5 : 1,
                      }}
                      onPress={() => setOnboardingStep((s) => Math.max(0, s - 1))}
                    >
                      <Text style={{ fontWeight: '900', color: theme.colors.text }}>Back</Text>
                    </HoverPressable>
                    <HoverPressable
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: theme.colors.brand,
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.12)',
                      }}
                      onPress={() => {
                        if (onboardingStep < 3) {
                          setOnboardingStep((s) => Math.min(3, s + 1));
                          return;
                        }
                        try {
                          if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.setItem('agrix_onboarding_done', '1');
                        } catch (_err) {}
                        setShowOnboarding(false);
                        setOnboardingStep(0);
                      }}
                    >
                      <Text style={{ fontWeight: '900', color: '#fff' }}>{onboardingStep < 3 ? 'Next' : 'Done'}</Text>
                    </HoverPressable>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.contentBg, isDark && { backgroundColor: '#020617' }]}>
              <View style={styles.contentArea}>
                <BodyWrapper {...bodyWrapperProps}>
                  {canAccessAdmin ? (
                    <>
                      <View style={[styles.scrollContent, { flexGrow: 1 }]}>
                        <Text style={[styles.pageTitle, isDark && { color: '#F9FAFB' }]}>Admin Console</Text>
                        <Text style={[styles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                          Administrative workspace—system checks, operational shortcuts, and audit-friendly actions.
                        </Text>

                        <View style={styles.kpiRow}>
                          {[
                            {
                              label: 'API STATUS',
                              value: apiStatus === 'ok' ? 'Online' : apiStatus === 'down' ? 'Offline' : 'Checking…',
                              dot: apiStatus === 'ok' ? theme.colors.brand : theme.colors.danger,
                            },
                            { label: 'ACCESS CONTROL', value: 'Admin-only', dot: theme.colors.accentTeal },
                            {
                              label: 'AUDIT LOG',
                              value: adminActivity.length ? `${adminActivity.length} recent` : 'No events',
                              dot: theme.colors.brand,
                            },
                            { label: 'DATA EXPORTS', value: 'Available', dot: theme.colors.brand },
                          ].map((k) => (
                            <HoverPressable
                              key={k.label}
                              style={[styles.kpiCard, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}
                              hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.01 }] }}
                            >
                              <View style={styles.kpiTop}>
                                <Text style={[styles.kpiLabel, isDark && { color: '#9CA3AF' }]}>{k.label}</Text>
                                <View style={[styles.kpiDot, { backgroundColor: k.dot }]} />
                              </View>
                              <Text style={[styles.kpiValue, isDark && { color: '#F9FAFB' }]}>{k.value}</Text>
                            </HoverPressable>
                          ))}
                        </View>

                        <HoverPressable style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]} hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.005 }] }}>
                          <AgriXLogo variant="compact" style={styles.cardWatermark} />
                          <View style={styles.cardHeaderRow}>
                            <View style={styles.cardAccent} />
                            <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Admin shortcuts</Text>
                          </View>
                          <Text style={[styles.cardText, isDark && { color: '#9CA3AF' }]}>
                            Use these admin-only actions to manage the platform without exposing sensitive tools to standard users.
                          </Text>
                          <View style={styles.ctaRow}>
                            <HoverPressable style={styles.ctaButton} onPress={() => navigation.navigate('AdminDashboard')}>
                              <Text style={styles.ctaButtonText}>Open Admin Dashboard</Text>
                            </HoverPressable>
                            <HoverPressable style={styles.ctaButton} onPress={() => navigation.navigate('AdminUsers')}>
                              <Text style={styles.ctaButtonText}>Open User Management</Text>
                            </HoverPressable>
                            <HoverPressable style={styles.secondaryButton} onPress={() => navigation.navigate('MyProfile')}>
                              <Text style={styles.secondaryButtonText}>Open My Profile</Text>
                            </HoverPressable>
                          </View>
                        </HoverPressable>

                        <HoverPressable style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]} hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.005 }] }}>
                          <AgriXLogo variant="compact" style={styles.cardWatermark} />
                          <View style={styles.cardHeaderRow}>
                            <View style={[styles.cardAccent, { backgroundColor: theme.colors.accentTeal }]} />
                            <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Recent admin activity</Text>
                          </View>
                          {adminActivity.length ? (
                            <View style={styles.bulletList}>
                              {adminActivity.map((e) => (
                                <Text key={e.id} style={[styles.bulletPoint, isDark && { color: '#9CA3AF' }]} numberOfLines={1}>
                                  • {e.message || e.type} ({new Date(e.at).toLocaleString()})
                                </Text>
                              ))}
                            </View>
                          ) : (
                            <Text style={[styles.cardText, isDark && { color: '#9CA3AF' }]}>No admin actions recorded yet.</Text>
                          )}
                        </HoverPressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.scrollContent, { flexGrow: 1 }]}>
                        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                          <HoverPressable
                            style={dashboardView === 'overview' ? styles.ctaButton : styles.secondaryButton}
                            onPress={() => setDashboardView('overview')}
                          >
                            <Text style={dashboardView === 'overview' ? styles.ctaButtonText : styles.secondaryButtonText}>
                              Overview
                            </Text>
                          </HoverPressable>
                          <HoverPressable
                            style={dashboardView === 'monitoring' ? styles.ctaButton : styles.secondaryButton}
                            onPress={() => setDashboardView('monitoring')}
                          >
                            <Text style={dashboardView === 'monitoring' ? styles.ctaButtonText : styles.secondaryButtonText}>
                              Monitoring
                            </Text>
                          </HoverPressable>
                        </View>
                        {dashboardView === 'monitoring' ? (
                          <FarmerDashboard user={user} navigation={navigation} />
                        ) : (
                          <>
                            <Text style={[styles.pageTitle, isDark && { color: '#F9FAFB' }]}>Dashboard</Text>
                            <Text style={[styles.pageSubtitle, isDark && { color: '#9CA3AF' }]}>
                              Track storage and field conditions in one place—real-time readings and alerts.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                              <View
                                style={{
                                  paddingVertical: 6,
                                  paddingHorizontal: 10,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  borderColor: theme.colors.border,
                                  backgroundColor: statusPill.bg,
                                }}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '900', color: statusPill.color }}>
                                  {statusPill.label}
                                </Text>
                              </View>
                              {latestReading?.createdAt ? (
                                <View
                                  style={{
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: theme.colors.border,
                                    backgroundColor: 'rgba(15,23,42,0.04)',
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: '900', color: theme.colors.textMuted }}>
                                    Last reading: {new Date(latestReading.createdAt).toLocaleString()}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.kpiRow}>
                              {kpis.map((k) => (
                                <HoverPressable
                                  key={k.label}
                                  style={[styles.kpiCard, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]}
                                  hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.01 }] }}
                                >
                                  <View style={styles.kpiTop}>
                                    <Text style={[styles.kpiLabel, isDark && { color: '#9CA3AF' }]}>{k.label}</Text>
                                    <View style={[styles.kpiDot, { backgroundColor: k.dot }]} />
                                  </View>
                                  <Text style={[styles.kpiValue, isDark && { color: '#F9FAFB' }]}>{k.value}</Text>
                                </HoverPressable>
                              ))}
                            </View>

                            <View style={styles.grid2Col}>
                              <HoverPressable style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]} hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.005 }] }}>
                                <View style={styles.cardHeaderRow}>
                                  <View style={styles.cardAccent} />
                                  <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Purpose</Text>
                                </View>
                                <Text style={[styles.cardText, isDark && { color: '#9CA3AF' }]}>
                                  AgriX monitors humidity, temperature, soil pH, and soil moisture to help prevent post-harvest mold growth and
                                  support better farm decisions.
                                </Text>
                                <View style={styles.bulletList}>
                                  {monitoringCapabilities.map((c) => (
                                    <View key={c.title} style={styles.bulletRow}>
                                      <View style={styles.bulletDot} />
                                      <Text style={[styles.bulletText, isDark && { color: '#9CA3AF' }]}>
                                        <Text style={{ fontWeight: '600' }}>{c.title}:</Text> {c.body}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </HoverPressable>

                              <HoverPressable style={[styles.card, isDark && { backgroundColor: 'rgba(15, 23, 42, 0.85)', borderColor: '#1F2937' }]} hoverStyle={{ transform: [{ translateY: -6 }, { scale: 1.005 }] }}>
                                <View style={styles.cardHeaderRow}>
                                  <View style={[styles.cardAccent, { backgroundColor: theme.colors.accentTeal }]} />
                                  <Text style={[styles.cardTitle, isDark && { color: '#F9FAFB' }]}>Alerts</Text>
                                </View>
                                <Text style={[styles.cardText, isDark && { color: '#9CA3AF' }]}>
                                  Set safe thresholds for storage conditions. When readings exceed limits, AgriX will surface alerts and updates
                                  in Notifications.
                                </Text>
                                <View style={styles.ctaRow}>
                                  <HoverPressable style={styles.ctaButton} onPress={openNotifications}>
                                    <Text style={styles.ctaButtonText}>Open Notifications</Text>
                                  </HoverPressable>
                                  <HoverPressable style={styles.secondaryButton} onPress={() => navigation.navigate('MyProfile')}>
                                    <Text style={styles.secondaryButtonText}>Open Profile</Text>
                                  </HoverPressable>
                                </View>
                              </HoverPressable>
                            </View>

                          </>
                        )}
                      </View>
                    </>
                  )}
                  <AppFooter bottomFill={24} />
                </BodyWrapper>
            </View>
          </View>
        </Animated.View>
      </ScreenTransition>
    </SafeAreaView>
  );
}
