import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import ScreenTransition from '../components/ScreenTransition';
import AppFooter from '../components/AppFooter';
import HoverPressable from '../components/HoverPressable';
import { resetPassword, saveAuth } from '../lib/authApi';
import { validatePassword } from '../lib/validation';
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setError('');
      setFieldErrors({});
      setIsSubmitting(true);

      if (Platform.OS !== 'web' && !token) {
        setError('Reset link is missing or invalid.');
        return;
      }

      const pwd = validatePassword(password);
      if (!pwd.ok) {
        setFieldErrors({ password: pwd.message });
        setError('Please fix the highlighted fields');
        return;
      }

      const confirm = String(confirmPassword || '');
      if (!confirm) {
        setFieldErrors((s) => ({ ...s, confirmPassword: 'Confirm password is required' }));
        setError('Please fix the highlighted fields');
        return;
      }
      if (password !== confirm) {
        setFieldErrors((s) => ({ ...s, confirmPassword: 'Passwords do not match' }));
        setError('Please fix the highlighted fields');
        return;
      }

      const data = await resetPassword({ token, password: pwd.value });
      saveAuth(data.token, data.user);

      if (Platform.OS === 'web') {
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.delete('resetToken');
          url.searchParams.delete('type');
          window.history.replaceState({}, '', url.toString());
        } catch (_err) {
        }
      }

      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      if (err?.code === 'RESET_INVALID') {
        setError('This reset link is invalid or expired. Please request a new one.');
        return;
      }
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        setError('Please fix the highlighted fields');
        return;
      }
      setError(err?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
                    <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Minimum 8 characters, include letters, numbers, and 1+ special character.</Text>
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
                    autoComplete="new-password"
                    textContentType="newPassword"
                    accessibilityLabel="Confirm password"
                  />
                  <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((v) => !v)}>
                    <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {!!fieldErrors.confirmPassword && <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>}
              </View>

              <HoverPressable
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Reset password"
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Resetting…' : 'Reset Password'}</Text>
              </HoverPressable>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

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

