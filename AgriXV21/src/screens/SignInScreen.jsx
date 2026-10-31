import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import AgriXLogo from '../components/AgriXLogo';
import { loadAuth, loginUser, saveAuth } from '../lib/authApi';
import { validateSignInForm } from '../lib/validation';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import { theme } from '../ui/theme';
import { loginAdmin, saveAdminAuth } from '../lib/adminApi';
import AppFooter from '../components/AppFooter';
import { Moon, Sun } from '../components/Icons';

export default function SignInScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [themeMode, setThemeMode] = useState('light');
  const isDark = themeMode === 'dark';
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);

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
    if (Platform.OS !== 'web') return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        setRememberMe(window.localStorage.getItem('agrix_remember_me') === '1');
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

  const handleSignIn = async () => {
    try {
      setError('');
      setFieldErrors({});
      setIsSubmitting(true);

      const validation = validateSignInForm({ email, password });
      if (!validation.ok) {
        setFieldErrors(validation.fieldErrors);
        const firstError = Object.values(validation.fieldErrors || {})[0];
        setError(firstError || 'Please fix the highlighted fields');
        return;
      }

      if (Platform.OS === 'web') {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('agrix_remember_me', rememberMe ? '1' : '0');
          }
        } catch (_err) {
        }
      }

      const emailLower = String(validation.sanitized.email || '').toLowerCase();
      const isAdminEmail = emailLower === 'adminagrix@gmail.com' || emailLower === 'agrix.official@gmail.com';

      if (isAdminEmail) {
        const data = await loginAdmin({ username: validation.sanitized.email, password });
        saveAdminAuth(data.token, data.expiresAt);
        navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      } else {
        try {
          const { token, user } = await loginUser(validation.sanitized);
          saveAuth(token, user);
          navigation.reset({ index: 0, routes: [{ name: user?.isAdmin ? 'AdminDashboard' : 'Dashboard' }] });
        } catch (err) {
          if (Platform.OS === 'web' && err?.code === 'EMAIL_NOT_CONFIRMED') {
            setError('Please confirm your email address, then sign in again.');
            return;
          }
          if (Platform.OS === 'web' && err?.code === 'OTP_REQUIRED') {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'VerifyRegistration',
                  params: { userId: err.userId, email: err.email, otpSent: err.otpSent, otpError: err.otpError },
                },
              ],
            });
            return;
          }
          if (err?.code === 'EMAIL_NOT_VERIFIED') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'VerifyRegistration', params: { userId: err.userId, email: err.email } }],
            });
            return;
          }
          throw err;
        }
      }
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        const firstError = Object.values(err.fieldErrors || {})[0];
        setError(firstError || 'Please fix the highlighted fields');
        return;
      }
      setError(err?.message || 'Sign in failed');
     } finally {
      setIsSubmitting(false);
    }
  };

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
        Animated.timing(fadeOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }).start(() => {
          setThemeMode(next);
          Animated.timing(fadeOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
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
      hoverStyle={
        Platform.OS === 'web'
          ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
          : null
      }
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
                <Text style={[styles.navLink, styles.navActive, isDark && { color: '#4ADE80' }]}>Login</Text>
                <HoverPressable
                  onPress={() => navigation.navigate('SignUp')}
                  style={styles.navItem}
                  hoverStyle={
                    Platform.OS === 'web'
                      ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
                      : null
                  }
                  pressedStyle={{ opacity: 0.7 }}
                >
                  <Text style={[styles.navLink, styles.navAccent, isDark && { color: '#4ADE80' }]}>Register</Text>
                </HoverPressable>
              </View>
            </View>
          </View>

          <ScreenTransition type="slideRight">
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: 70 + insets.top }]}>
              <View style={styles.pagePadding}>

                <View style={styles.pageBody}>
                  <View
                    style={[
                      styles.formContainer,
                      isDark && { backgroundColor: '#020617', borderColor: '#1F2937' },
                    ]}
                  >
                <Text style={[styles.title, isDark && { color: '#F9FAFB' }]}>
                  Sign <Text style={[styles.titleAccent, isDark && { color: '#4ADE80' }]}>In</Text>
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Email Address</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                      fieldErrors.email && styles.inputError,
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                  {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Password</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                        fieldErrors.password && styles.inputError,
                      ]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      textContentType="password"
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword((v) => !v)}
                    >
                      <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
                </View>

                <View style={styles.authMetaRow}>
                  {Platform.OS === 'web' ? (
                    <HoverPressable
                      style={styles.rememberRow}
                      onPress={() => setRememberMe((v) => !v)}
                      hoverStyle={Platform.OS === 'web' ? { transform: [{ translateY: -2 }], opacity: 1 } : null}
                      pressedStyle={{ opacity: 0.85 }}
                    >
                      <View style={[styles.rememberBox, rememberMe && styles.rememberBoxChecked]}>
                        {rememberMe ? <View style={styles.rememberDot} /> : null}
                      </View>
                      <Text style={[styles.rememberText, isDark && { color: '#E5E7EB' }]}>Remember me</Text>
                    </HoverPressable>
                  ) : (
                    <Text style={[styles.sessionHint, isDark && { color: '#9CA3AF' }]}>
                      You’ll be logged out after inactivity.
                    </Text>
                  )}

                  <View style={{ flex: 1 }} />

                  <HoverPressable style={styles.forgotPassword} onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text style={[styles.forgotPasswordText, isDark && { color: '#4ADE80' }]}>
                      Forgot Password
                    </Text>
                  </HoverPressable>
                </View>
                <Text style={[styles.resetHint, isDark && { color: '#9CA3AF' }]}>We’ll email a reset link.</Text>
                {Platform.OS === 'web' ? (
                  <Text style={[styles.sessionHint, isDark && { color: '#9CA3AF' }]}>
                    {rememberMe
                      ? 'Remember me keeps you signed in longer on this device.'
                      : 'Session expires after 2 minutes of inactivity unless you enable Remember me.'}
                  </Text>
                ) : null}

                <HoverPressable
                  style={[
                    styles.signInButton,
                    isSubmitting && styles.buttonDisabled,
                    isDark && { backgroundColor: '#15803D' },
                  ]}
                  onPress={handleSignIn}
                  disabled={isSubmitting}
                >
                  <Text style={styles.signInButtonText}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
                </HoverPressable>
                {isSubmitting ? (
                  <Text style={[styles.submittingHint, isDark && { color: '#9CA3AF' }]}>Checking credentials…</Text>
                ) : null}

                {!!error && (
                  <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{error}</Text>
                )}
              </View>
            </View>
          </View>

          <AppFooter bottomFill={8} />
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
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'stretch',
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
  pagePadding: {
    flexGrow: 1,
    padding: 20,
  },
  pageBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 32,
    borderRadius: theme.radius.card,
    ...theme.shadows.medium,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  title: {
    fontSize: theme.typography.h1,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 40,
  },
  titleAccent: {
    color: theme.colors.brand,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 72,
  },
  passwordToggle: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  passwordToggleText: {
    color: theme.colors.brand,
    fontWeight: '800',
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  fieldError: {
    marginTop: 6,
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  authMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.22s cubic-bezier(0.22,0.61,0.36,1), opacity 0.22s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  rememberBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberBoxChecked: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.brandLight,
  },
  rememberDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: theme.colors.brandDark,
  },
  rememberText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  sessionHint: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: theme.colors.brand,
    fontWeight: 'bold',
  },
  resetHint: {
    marginBottom: 18,
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  submittingHint: {
    marginTop: -10,
    marginBottom: 10,
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: theme.colors.brandDark,
    paddingVertical: 15,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: theme.colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 12,
    color: theme.colors.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: theme.colors.text,
  },
  linkText: {
    color: theme.colors.brand,
    fontWeight: 'bold',
  },
  copyright: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 40,
  },
});
