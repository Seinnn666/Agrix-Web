import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import AgriXLogo from '../components/AgriXLogo';
import ScreenTransition from '../components/ScreenTransition';
import AppFooter from '../components/AppFooter';
import HoverPressable from '../components/HoverPressable';
import { forgotPassword } from '../lib/authApi';
import { validateEmail } from '../lib/validation';
import { theme } from '../ui/theme';
import { Moon, Sun } from '../components/Icons';
import { formatCountdown, useCountdown } from '../hooks/useCountdown';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdownAnnouncement, setCountdownAnnouncement] = useState('');
  const [themeMode, setThemeMode] = useState('light');
  const isDark = themeMode === 'dark';
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const countdownAnnouncedRef = useRef(false);
  const { remainingSeconds: resetLimitRemaining, startCountdown, clearCountdown } = useCountdown('agrix.forgot-password.reset-limit.endAt');

  useEffect(() => {
    if (resetLimitRemaining > 0) {
      setError(`Too many reset requests. Try again in ${formatCountdown(resetLimitRemaining)}.`);
      if (!countdownAnnouncedRef.current) {
        setCountdownAnnouncement(`Too many reset requests. Try again in ${formatCountdown(resetLimitRemaining)}.`);
        countdownAnnouncedRef.current = true;
      }
    } else if (countdownAnnouncedRef.current) {
      setError((current) => (current.startsWith('Too many reset requests.') ? '' : current));
      setCountdownAnnouncement('You can request a new reset link now.');
      countdownAnnouncedRef.current = false;
    }
  }, [resetLimitRemaining]);

  const helper = useMemo(() => {
    return isCompact
      ? 'Enter your email and we’ll send a password reset link.'
      : 'Enter your email and we’ll send you a password reset link if the account exists.';
  }, [isCompact]);

  const handleSend = async () => {
    if (resetLimitRemaining > 0) return;
    try {
      setError('');
      setStatus('');
      setIsSubmitting(true);
      const v = validateEmail(email);
      if (!v.ok) {
        setError('Email address is invalid');
        return;
      }
      await forgotPassword({ email: v.value });
      setStatus('If an account exists for this email, a reset link has been sent.');
    } catch (err) {
      if ((err?.code === 'RESET_LIMIT' || err?.status === 429) && typeof err?.retryAfterSeconds === 'number') {
        startCountdown(err.retryAfterSeconds);
        return;
      }
      setError(err?.message || 'Failed to send reset link');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('agrix_theme');
        if (stored === 'dark' || stored === 'light') {
          setThemeMode(stored);
        }
      }
    } catch (_err) {
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('agrix_theme', themeMode);
      }
    } catch (_err) {
    }
  }, [themeMode]);

  const handleGoLanding = () => {
    const action = CommonActions.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
    try {
      navigation.dispatch(action);
    } catch (_err) {}
    try {
      navigation.getParent?.()?.dispatch?.(action);
    } catch (_err) {}
  };

  const handleGoSection = (section) => {
    if (section === 'home') {
      handleGoLanding();
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(`${window.location.origin}/#agrix-section-${section}`);
      return;
    }
    handleGoLanding();
  };

  const ThemeToggleButton = () => (
    <HoverPressable
      onPress={() => {
        if (isThemeAnimatingRef.current) return;
        isThemeAnimatingRef.current = true;
        const next = isDark ? 'light' : 'dark';
        Animated.timing(fadeOpacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
          setThemeMode(next);
          Animated.timing(fadeOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => {
            isThemeAnimatingRef.current = false;
          });
        });
      }}
      style={[styles.themeToggle, isDark && { backgroundColor: '#020617' }]}
      hoverStyle={
        Platform.OS === 'web'
          ? {
              transform: [{ translateY: -4 }, { scale: 1.08 }],
              opacity: 1,
              backgroundColor: isDark ? '#020617' : '#E5E7EB',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }
          : null
      }
      pressedStyle={{ opacity: 0.85, transform: [{ scale: 0.96 }] }}
    >
      {isDark ? <Sun size={18} color="#FACC15" /> : <Moon size={18} color="#0F172A" />}
    </HoverPressable>
  );

  const NavItem = ({ label, onPress }) => (
    <HoverPressable
      onPress={onPress}
      style={styles.navItem}
      hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 } : null}
      pressedStyle={{ opacity: 0.7 }}
    >
      <Text style={[styles.navLink, isDark && { color: '#E5E7EB' }]}>{label}</Text>
    </HoverPressable>
  );

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop' }}
      style={styles.container}
      resizeMode="cover"
    >
      <Animated.View style={[styles.overlay, isDark && { backgroundColor: 'rgba(15,23,42,0.85)' }, { opacity: fadeOpacity }]}>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.navbar,
              { paddingTop: insets.top, height: 70 + insets.top },
              isDark && { backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomColor: 'rgba(15, 23, 42, 0.9)' },
            ]}
          >
            <View style={styles.navContainer}>
              <TouchableOpacity onPress={handleGoLanding}>
                <AgriXLogo variant="navbar" scale={1} />
              </TouchableOpacity>
              <View style={styles.navMenu}>
                <NavItem label="Home" onPress={() => handleGoSection('home')} />
                <ThemeToggleButton />
                <HoverPressable
                  onPress={() => navigation.navigate('SignIn')}
                  style={styles.navItem}
                  hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 } : null}
                  pressedStyle={{ opacity: 0.7 }}
                >
                  <Text style={[styles.navLink, styles.navActive, isDark && { color: '#4ADE80' }]}>Login</Text>
                </HoverPressable>
                <HoverPressable
                  onPress={() => navigation.navigate('SignUp')}
                  style={styles.navItem}
                  hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 } : null}
                  pressedStyle={{ opacity: 0.7 }}
                >
                  <Text style={[styles.navLink, styles.navAccent, isDark && { color: '#4ADE80' }]}>Register</Text>
                </HoverPressable>
              </View>
            </View>
          </View>

          <ScreenTransition type="slideRight">
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: 70 + insets.top }]} keyboardShouldPersistTaps="handled">
              <View style={styles.pagePadding}>
                <View style={styles.body}>
                  <View style={[styles.card, isDark && { backgroundColor: '#020617', borderColor: '#1F2937' }]}>
                    <Text style={[styles.title, isDark && { color: '#F9FAFB' }]}>Forgot Password</Text>
                    <Text style={[styles.subtitle, isDark && { color: '#9CA3AF' }]}>{helper}</Text>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Email Address</Text>
                      <TextInput
                        style={[
                          styles.input,
                          isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                          !!error && styles.inputError,
                        ]}
                        value={email}
                        onChangeText={(value) => {
                          setEmail(value);
                          if (resetLimitRemaining > 0) clearCountdown();
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        accessibilityLabel="Email address"
                      />
                    </View>

                    <HoverPressable
                      style={[styles.primaryButton, (isSubmitting || resetLimitRemaining > 0) && styles.buttonDisabled, isDark && { backgroundColor: '#15803D' }]}
                      onPress={handleSend}
                      disabled={isSubmitting || resetLimitRemaining > 0}
                      accessibilityRole="button"
                      accessibilityLabel="Send reset link"
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? 'Sending…' : resetLimitRemaining > 0 ? `Send Reset Link (${formatCountdown(resetLimitRemaining)})` : 'Send Reset Link'}
                      </Text>
                    </HoverPressable>

                    {!!status && <Text style={[styles.statusText, isDark && { color: '#A7F3D0' }]}>{status}</Text>}
                    {!!error && <Text style={styles.errorText}>{error}</Text>}
                    <Text
                      accessibilityLiveRegion="polite"
                      {...(Platform.OS === 'web' ? { 'aria-live': 'polite' } : {})}
                      style={styles.screenReaderOnly}
                    >
                      {countdownAnnouncement}
                    </Text>

                    <View style={styles.footerLinks}>
                      <Text style={[styles.footerText, isDark && { color: '#9CA3AF' }]}>Remembered your password? </Text>
                      <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                        <Text style={[styles.linkText, isDark && { color: '#4ADE80' }]}>Sign In</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <AppFooter bottomFill={24} />
            </ScrollView>
          </ScreenTransition>
        </SafeAreaView>
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlaySoft,
  },
  safeArea: {
    flex: 1,
  },
  navbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    justifyContent: 'center',
    zIndex: 50,
  },
  navContainer: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  navItem: {
    paddingVertical: 4,
    ...Platform.select({
      web: {
        transition: 'transform 0.25s cubic-bezier(0.22,0.61,0.36,1), opacity 0.25s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  navLink: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  navActive: {
    color: theme.colors.brand,
  },
  navAccent: {
    color: theme.colors.brandDark,
  },
  themeToggle: {
    padding: 8,
    borderRadius: 9999,
    backgroundColor: '#F3F4F6',
    ...Platform.select({
      web: {
        transition:
          'transform 0.3s cubic-bezier(0.22,0.61,0.36,1), ' +
          'background-color 0.3s cubic-bezier(0.22,0.61,0.36,1), ' +
          'box-shadow 0.3s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'stretch',
  },
  pagePadding: {
    flexGrow: 1,
    padding: 20,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    padding: 32,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  primaryButton: {
    backgroundColor: theme.colors.brand,
    paddingVertical: 14,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  statusText: {
    marginTop: 14,
    color: theme.colors.brandDark,
    textAlign: 'center',
    fontWeight: '800',
  },
  errorText: {
    marginTop: 12,
    color: theme.colors.danger,
    textAlign: 'center',
    fontWeight: '800',
  },
  screenReaderOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  footerLinks: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    color: theme.colors.textMuted,
  },
  linkText: {
    color: theme.colors.brand,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});

