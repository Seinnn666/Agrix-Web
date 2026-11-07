import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import ScreenTransition from '../components/ScreenTransition';
import AppFooter from '../components/AppFooter';
import HoverPressable from '../components/HoverPressable';
import { resetPassword, validateResetToken } from '../lib/authApi';
import { getPasswordStrength, validatePassword } from '../lib/validation';
import { theme } from '../ui/theme';

function readResetTokenFromUrl() {
  try {
    if (Platform.OS !== 'web') return '';
    const url = new URL(window.location.href);
    return String(url.searchParams.get('resetToken') || '').trim();
  } catch (_err) {
    return '';
  }
}

export default function ResetPasswordScreen({ navigation, route }) {
  const tokenFromRoute = String(route?.params?.resetToken || '').trim();
  const token = useMemo(() => tokenFromRoute || readResetTokenFromUrl(), [tokenFromRoute]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(token ? 'checking' : 'invalid');
  const [canRetryValidation, setCanRetryValidation] = useState(false);
  const passwordChecks = useMemo(() => getPasswordStrength(password), [password]);
  const passwordStrength = useMemo(() => {
    const score = passwordChecks.score;
    const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
    const color = score <= 1 ? theme.colors.danger : score === 4 ? '#22C55E' : '#F59E0B';
    return { label, color, progress: score / 4 };
  }, [passwordChecks.score]);

  useEffect(() => {
    let active = true;
    if (route?.params?.linkError) {
      setTokenStatus('invalid');
      return () => { active = false; };
    }
    if (!token) {
      setTokenStatus('invalid');
      return () => { active = false; };
    }
    setIsCheckingToken(true);
    setTokenStatus('checking');
    setCanRetryValidation(false);
    setError('');
    validateResetToken(token).then(() => {
      if (active) {
        setTokenStatus('valid');
        setCanRetryValidation(false);
      }
    }).catch((err) => {
      if (!active) return;
      if (err?.code === 'RESET_EXPIRED') setTokenStatus('expired');
      else if (err?.code === 'RESET_USED') setTokenStatus('used');
      else if (err?.code === 'RESET_INVALID') setTokenStatus('invalid');
      else setTokenStatus('error');
      setCanRetryValidation(err?.code === 'API_NETWORK_ERROR' || Number(err?.status) >= 500);
    }).finally(() => {
      if (active) setIsCheckingToken(false);
    });
    return () => { active = false; };
  }, [token, route?.params?.linkError]);

  const retryValidation = async () => {
    if (!token || isCheckingToken) return;
    setIsCheckingToken(true);
    setTokenStatus('checking');
    setCanRetryValidation(false);
    try {
      await validateResetToken(token);
      setTokenStatus('valid');
    } catch (err) {
      if (err?.code === 'RESET_EXPIRED') setTokenStatus('expired');
      else if (err?.code === 'RESET_USED') setTokenStatus('used');
      else if (err?.code === 'RESET_INVALID') setTokenStatus('invalid');
      else setTokenStatus('error');
      setCanRetryValidation(err?.code === 'API_NETWORK_ERROR' || Number(err?.status) >= 500);
    } finally {
      setIsCheckingToken(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setSuccess('');
      setFieldErrors({});
      setIsSubmitting(true);

      if (tokenStatus !== 'valid' || !token) {
        return;
      }

      const confirm = String(confirmPassword || '');
      const nextErrors = {};
      if (!password) nextErrors.password = 'Password is required';
      if (!confirm) nextErrors.confirmPassword = 'Confirm password is required';
      if (Object.keys(nextErrors).length) {
        setFieldErrors(nextErrors);
        return;
      }

      const pwd = validatePassword(password);
      if (!pwd.ok) {
        setFieldErrors({ password: pwd.message });
        setError('Please fix the highlighted fields');
        return;
      }

      if (password !== confirm) {
        setFieldErrors((s) => ({ ...s, confirmPassword: 'Passwords do not match' }));
        setError('Please fix the highlighted fields');
        return;
      }

      await resetPassword({ token, password: pwd.value, confirmPassword: confirm });

      if (Platform.OS === 'web') {
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.delete('type');
          window.history.replaceState({}, '', url.toString());
        } catch (_err) {
        }
      }

      setSuccess('Password reset successful. Redirecting to Sign In…');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] }), 900);
    } catch (err) {
      if (err?.code === 'RESET_EXPIRED') { setTokenStatus('expired'); return; }
      if (err?.code === 'RESET_USED') { setTokenStatus('used'); return; }
      if (err?.code === 'RESET_INVALID' || err?.code === 'RESET_EXPIRED_OR_USED') { setTokenStatus('invalid'); return; }
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        setError('Please fix the highlighted fields');
        return;
      }
      setError('We couldn’t reset your password. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tokenStatusMessage = {
    expired: 'This reset link has expired. Please request a new one.',
    used: 'This reset link has already been used. Please request a new one.',
    invalid: 'This reset link is invalid. Please request a new one.',
    error: 'We couldn’t verify this reset link. Check your connection and try again.',
  }[tokenStatus];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTransition type="slideRight">
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <AgriXLogo onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })} variant="header" scale={1} />
          </View>

          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Choose a new password to continue.</Text>

              {tokenStatus === 'checking' && <Text style={styles.helperText}>Checking reset link…</Text>}
              {!!tokenStatusMessage && (
                <View>
                  <Text style={styles.errorText}>{tokenStatusMessage}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text style={styles.linkText}>Request a new reset link</Text>
                  </TouchableOpacity>
                  {canRetryValidation && (
                    <TouchableOpacity onPress={retryValidation} disabled={isCheckingToken}>
                      <Text style={styles.linkText}>{isCheckingToken ? 'Trying again…' : 'Try again'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {tokenStatus === 'valid' && <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="New password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
                    <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Minimum 8 characters, include letters, numbers, and 1+ special character.</Text>
                <View style={styles.strengthTrack}>
                  <View style={[styles.strengthFill, { width: `${passwordStrength.progress * 100}%`, backgroundColor: passwordStrength.color }]} />
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>Strength: {passwordStrength.label}</Text>
                <View style={styles.checklist}>
                  {passwordChecks.checks.map((check) => (
                    <View key={check.key} style={styles.checkRow}>
                      <View style={[styles.checkDot, check.ok && styles.checkDotOk]} />
                      <Text style={[styles.checkText, check.ok && styles.checkTextOk]}>{check.label}</Text>
                    </View>
                  ))}
                </View>
                {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, fieldErrors.confirmPassword && styles.inputError]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="off"
                    textContentType="newPassword"
                    accessibilityLabel="Confirm password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    {...(Platform.OS === 'web' ? {
                      onPaste: (event) => event.preventDefault(),
                      onCopy: (event) => event.preventDefault(),
                      onCut: (event) => event.preventDefault(),
                      onDrop: (event) => event.preventDefault(),
                      onContextMenu: (event) => event.preventDefault(),
                      onDragStart: (event) => event.preventDefault(),
                      onDragOver: (event) => event.preventDefault(),
                      onKeyDown: (event) => {
                        const key = String(event?.key || '').toLowerCase();
                        if ((event.ctrlKey || event.metaKey) && ['v', 'c', 'x'].includes(key)) event.preventDefault();
                      },
                    } : {})}
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((v) => !v)}>
                    <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {!!fieldErrors.confirmPassword && <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>}
              </View>

              <HoverPressable
                style={[styles.primaryButton, (isSubmitting || isCheckingToken) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || isCheckingToken}
                accessibilityRole="button"
                accessibilityLabel="Reset password"
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Resetting…' : isCheckingToken ? 'Checking link…' : 'Reset Password'}</Text>
              </HoverPressable>

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!success && <Text style={styles.successText}>{success}</Text>}
              </>}

              <View style={styles.footerLinks}>
                <Text style={styles.footerText}>Back to </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <AppFooter bleedX={20} bottomFill={24} />
        </ScrollView>
      </ScreenTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 70,
  },
  header: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    padding: 20,
    marginTop: 20,
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
    borderRadius: theme.radius.sm,
    padding: theme.space.md,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'transparent',
    padding: 4,
  },
  passwordToggleText: {
    color: theme.colors.brand,
    fontWeight: '800',
  },
  helperText: {
    marginTop: 8,
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  strengthTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 999 },
  strengthText: { marginTop: 5, fontSize: 12, fontWeight: '800' },
  checklist: { marginTop: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  checkDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9CA3AF', marginRight: 7 },
  checkDotOk: { backgroundColor: '#22C55E' },
  checkText: { color: '#6B7280', fontSize: 12 },
  checkTextOk: { color: '#15803D' },
  fieldError: {
    marginTop: 6,
    color: theme.colors.danger,
    fontWeight: '800',
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
  errorText: {
    marginTop: 12,
    color: theme.colors.danger,
    textAlign: 'center',
    fontWeight: '800',
  },
  successText: {
    marginTop: 12,
    color: '#15803D',
    textAlign: 'center',
    fontWeight: '800',
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

