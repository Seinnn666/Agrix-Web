import * as React from 'react';
import { Alert, AppState, ScrollView, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { clearAuth, loadAuth, startWebAuthSync } from './src/lib/authApi';
import { clearAdminAuth, loadAdminAuth } from './src/lib/adminApi';
import ConfirmDialog from './src/components/ConfirmDialog';
import { isNotificationMuted, subscribeNotifications } from './src/lib/notifications';

// Keep the initial signed-out view in the entry bundle.
import LandingScreen from './src/screens/LandingScreen';

// Defer screens not needed on the Landing Page. Expo splits the async imports
// into web chunks; wrappers stay stable across navigation rerenders.
function deferredScreen(importModule) {
  const Component = React.lazy(importModule);
  return function DeferredScreen(props) {
    return (
      <React.Suspense fallback={<View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />}>
        <Component {...props} />
      </React.Suspense>
    );
  };
}

const SignInScreen = deferredScreen(() => import('./src/screens/SignInScreen'));
const SignUpScreen = deferredScreen(() => import('./src/screens/SignUpScreen'));
const DashboardScreen = deferredScreen(() => import('./src/screens/DashboardScreen'));
const MyProfileScreen = deferredScreen(() => import('./src/screens/MyProfileScreen'));
const VerifyRegistrationScreen = deferredScreen(() => import('./src/screens/VerifyRegistrationScreen'));
const ForgotPasswordScreen = deferredScreen(() => import('./src/screens/ForgotPasswordScreen'));
const ResetPasswordScreen = deferredScreen(() => import('./src/screens/ResetPasswordScreen'));
const AdminUsersScreen = deferredScreen(() => import('./src/screens/AdminUsersScreen'));
const AdminDashboardScreen = deferredScreen(() => import('./src/screens/AdminDashboardScreen'));
const AdminProfileScreen = deferredScreen(() => import('./src/screens/AdminProfileScreen'));
const DeviceSensorsScreen = deferredScreen(() => import('./src/screens/DeviceSensorsScreen'));
const ReadingsTimelineScreen = deferredScreen(() => import('./src/screens/ReadingsTimelineScreen'));
const SnapshotsScreen = deferredScreen(() => import('./src/screens/SnapshotsScreen'));
const AlertHistoryScreen = deferredScreen(() => import('./src/screens/AlertHistoryScreen'));
const NotificationsScreen = deferredScreen(() => import('./src/screens/NotificationsScreen'));

const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined';
const Stack = IS_WEB ? createStackNavigator() : createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    try {
      console.error(error);
      console.error(errorInfo);
    } catch (_err) {
    }
  }

  render() {
    const { error, errorInfo } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#b00020' }}>
            App crashed while rendering.
          </Text>
          <Text style={{ fontSize: 14, color: '#333', marginBottom: 10 }}>
            {String(error?.message || error)}
          </Text>
          <ScrollView style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {String(errorInfo?.componentStack || '')}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function safeGetItem(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || '';
    }
  } catch (_err) {
  }
  return '';
}

function safeSetItem(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, String(value || ''));
    }
  } catch (_err) {
  }
}

function computeInitialRoute() {
  const { token: userToken, user } = loadAuth();
  const { token: adminToken } = loadAdminAuth();
  const last = safeGetItem('agrix_last_route');
  // An admin session always opens at its control panel; stale sub-page history
  // must not strand an administrator on a user-facing route after reload.
  const isAdmin = Boolean(user?.isAdmin) || String(user?.role || '').trim().toLowerCase() === 'admin' || Boolean(adminToken);
  if (isAdmin) return 'AdminDashboard';
  const isAuthed = Boolean(userToken) || Boolean(adminToken) || Boolean(user?.isAdmin);
  if (!isAuthed) return last === 'AdminLogin' ? 'SignIn' : 'Landing';
  if (last === 'AdminLogin') return 'Dashboard';

  const allowed = new Set([
    'Dashboard',
    'FarmerDashboard',
    'FarmOwnerDashboard',
    'MyProfile',
    'DeviceSensors',
    'ReadingsTimeline',
    'GraphHistory',
    'Snapshots',
    'AlertHistory',
    'AdminDashboard',
    'AdminUsers',
    'Notifications',
    'Notification',
  ]);
  if (['AdminDashboard', 'AdminUsers', 'AdminProfile'].includes(last)) return 'Dashboard';
  if (last && allowed.has(last) && last !== 'Landing' && last !== 'SignIn' && last !== 'SignUp') {
    if (last === 'FarmerDashboard' || last === 'FarmOwnerDashboard') return 'Dashboard';
    return last;
  }
  return 'Dashboard';
}

export default function App() {
  const markActivityRef = React.useRef(() => {});
  const inactivityLogoutStartedRef = React.useRef(false);
  const [sessionPopup, setSessionPopup] = React.useState({ visible: false, title: '', message: '' });
  const stackScreenOptions =
    IS_WEB
      ? { headerShown: false, cardStyle: { backgroundColor: '#FFFFFF' } }
      : { headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' }, animation: 'fade' };
  const slideFromRightOptions = IS_WEB ? undefined : { animation: 'slide_from_right' };
  const [notificationPopup, setNotificationPopup] = React.useState({ visible: false, title: '', message: '' });
  const queueRef = React.useRef([]);

  React.useEffect(() => {
    if (IS_WEB && typeof window !== 'undefined') {
      try {
        window.__AGRIX_APP_BOOTED__ = true;
      } catch (_err) {
      }
    }
  }, []);

  React.useEffect(() => {
    if (!IS_WEB) return;
    const stop = startWebAuthSync();
    return stop;
  }, []);

  React.useEffect(() => {
    const openNext = () => {
      setNotificationPopup((prev) => {
        if (prev.visible) return prev;
        const next = queueRef.current.shift();
        if (!next) return prev;
        return {
          visible: true,
          title: next.title || 'Farm update',
          message: next.message || 'A farm update is available.',
        };
      });
    };
    const unsubscribe = subscribeNotifications((payload) => {
      if (payload?.type !== 'added' || !payload?.notification) return;
      const { token: adminToken } = loadAdminAuth();
      const { user } = loadAuth();
      if (adminToken || user?.isAdmin || String(user?.role || '').trim().toLowerCase() === 'admin') return;
      if (isNotificationMuted(payload.notification.key)) return;
      queueRef.current.push(payload.notification);
      openNext();
    });
    return unsubscribe;
  }, []);

  const closeNotificationPopup = React.useCallback(() => {
    setNotificationPopup({ visible: false, title: '', message: '' });
    setTimeout(() => {
      setNotificationPopup((prev) => {
        if (prev.visible) return prev;
        const next = queueRef.current.shift();
        if (!next) return prev;
        return {
          visible: true,
          title: next.title || 'Farm update',
          message: next.message || 'A farm update is available.',
        };
      });
    }, 10);
  }, []);

  React.useEffect(() => {
    const rememberEnabled = safeGetItem('agrix_remember_me') === '1';
    // A two-minute timeout revoked Supabase sessions during ordinary use,
    // which made opening Profile appear to log the user out.
    const inactivityMs = rememberEnabled ? 8 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const inactivityLabel = rememberEnabled ? '8 hours' : '30 minutes';
    const lastActivityRef = { current: Date.now() };

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    markActivityRef.current = markActivity;

    const logoutForInactivity = () => {
      if (inactivityLogoutStartedRef.current) return;
      inactivityLogoutStartedRef.current = true;
      const { token: activeAdminToken } = loadAdminAuth();
      const { user: activeUser } = loadAuth();
      const adminSession = Boolean(activeAdminToken) || Boolean(activeUser?.isAdmin) || String(activeUser?.role || '').trim().toLowerCase() === 'admin';
      clearAuth();
      clearAdminAuth();
      if (navigationRef.isReady()) {
        navigationRef.resetRoot({ index: 0, routes: [{ name: adminSession ? 'SignIn' : 'Landing' }] });
      }
      setTimeout(() => {
        if (IS_WEB) {
          setSessionPopup({
            visible: true,
            title: 'Session expired',
            message: `You have been inactive for ${inactivityLabel}.`,
          });
          return;
        }
        try {
          Alert.alert('Session expired', `You have been inactive for ${inactivityLabel}.`);
        } catch (_err) {
        }
      }, 150);
    };

    const check = () => {
      const { token } = loadAuth();
      const { token: adminToken } = loadAdminAuth();
      if (!token && !adminToken) {
        inactivityLogoutStartedRef.current = false;
        markActivity();
        return;
      }
      if (Date.now() - lastActivityRef.current >= inactivityMs) {
        logoutForInactivity();
      }
    };

    const intervalId = setInterval(check, 1000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') markActivity();
    });

    let removeWebListeners = () => {};
    if (IS_WEB && typeof window !== 'undefined') {
      const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
      removeWebListeners = () => {
        events.forEach((evt) => window.removeEventListener(evt, markActivity));
      };
    }

    return () => {
      clearInterval(intervalId);
      appStateSub?.remove?.();
      removeWebListeners();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={IS_WEB ? { minHeight: '100vh' } : { flex: 1 }}>
        <AppErrorBoundary>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              try {
                if (!IS_WEB) return;
                if (typeof window === 'undefined') return;
                const url = new URL(window.location.href);
                const resetToken = String(url.searchParams.get('resetToken') || '').trim();
                if (!resetToken) return;
                navigationRef.resetRoot({ index: 0, routes: [{ name: 'ResetPassword', params: { resetToken } }] });
              } catch (_err) {
              }
              try {
                if (!IS_WEB) return;
                if (typeof window === 'undefined') return;
                const url = new URL(window.location.href);
                const hash = String(url.hash || '').replace(/^#/, '');
                const params = new URLSearchParams(hash);
                const type = String(params.get('type') || '').trim().toLowerCase();
                const accessToken = String(params.get('access_token') || '').trim();
                if (type !== 'recovery' || !accessToken) return;
                navigationRef.resetRoot({ index: 0, routes: [{ name: 'ResetPassword' }] });
              } catch (_err) {
              }
            }}
            onStateChange={() => {
              markActivityRef.current();
              try {
                const route = navigationRef.getCurrentRoute();
                const name = route?.name ? String(route.name) : '';
                if (!name) return;
                if (IS_WEB && typeof document !== 'undefined') {
                  document.title = name === 'Landing' ? 'AgriX' : `AgriX - ${name}`;
                }
                const { token: userToken, user } = loadAuth();
                const { token: adminToken } = loadAdminAuth();
                const isAuthed = Boolean(userToken) || Boolean(adminToken) || Boolean(user?.isAdmin) || String(user?.role || '').trim().toLowerCase() === 'admin';
                if (!isAuthed) return;
                safeSetItem('agrix_last_route', name);
              } catch (_err) {
              }
            }}
          >
            <Stack.Navigator
              screenOptions={stackScreenOptions}
              initialRouteName={computeInitialRoute()}
            >
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="SignIn" component={SignInScreen} options={slideFromRightOptions} />
              <Stack.Screen name="SignUp" component={SignUpScreen} options={slideFromRightOptions} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={slideFromRightOptions} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={slideFromRightOptions} />
              <Stack.Screen name="VerifyRegistration" component={VerifyRegistrationScreen} options={slideFromRightOptions} />
              <Stack.Screen
                name="FarmerDashboard"
                component={DashboardScreen}
                options={slideFromRightOptions}
              />
              <Stack.Screen
                name="FarmOwnerDashboard"
                component={DashboardScreen}
                options={slideFromRightOptions}
              />
              <Stack.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={slideFromRightOptions}
              />
              <Stack.Screen name="MyProfile" component={MyProfileScreen} options={slideFromRightOptions} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} options={slideFromRightOptions} />
              <Stack.Screen name="Notification" component={NotificationsScreen} options={slideFromRightOptions} />
              <Stack.Screen name="DeviceSensors" component={DeviceSensorsScreen} options={slideFromRightOptions} />
              <Stack.Screen name="ReadingsTimeline" component={ReadingsTimelineScreen} options={slideFromRightOptions} />
              <Stack.Screen
                name="GraphHistory"
                component={ReadingsTimelineScreen}
                initialParams={{ mode: 'graphs' }}
                options={slideFromRightOptions}
              />
              <Stack.Screen name="Snapshots" component={SnapshotsScreen} options={slideFromRightOptions} />
              <Stack.Screen name="AlertHistory" component={AlertHistoryScreen} options={slideFromRightOptions} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={slideFromRightOptions} />
              <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={slideFromRightOptions} />
              <Stack.Screen name="AdminProfile" component={AdminProfileScreen} options={slideFromRightOptions} />
            </Stack.Navigator>
          </NavigationContainer>
        </AppErrorBoundary>
        <ConfirmDialog
          visible={sessionPopup.visible}
          title={sessionPopup.title}
          message={sessionPopup.message}
          confirmText="OK"
          cancelText={null}
          onConfirm={() => setSessionPopup({ visible: false, title: '', message: '' })}
          onCancel={() => setSessionPopup({ visible: false, title: '', message: '' })}
        />
        <ConfirmDialog
          visible={notificationPopup.visible}
          title={notificationPopup.title}
          message={notificationPopup.message}
          confirmText="View notifications"
          cancelText="Close"
          onConfirm={() => {
            closeNotificationPopup();
            if (navigationRef.isReady()) {
              const { token: adminToken } = loadAdminAuth();
              const { user } = loadAuth();
              navigationRef.navigate('Notifications', { audience: adminToken || user?.isAdmin || String(user?.role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user' });
            }
          }}
          onCancel={closeNotificationPopup}
        />
      </View>
    </SafeAreaProvider>
  );
}
