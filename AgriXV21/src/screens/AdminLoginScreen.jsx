import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import { theme } from '../ui/theme';
import { loginAdmin, saveAdminAuth } from '../lib/adminApi';

export default function AdminLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdminSignIn = async () => {
    try {
      setError('');
      setIsSubmitting(true);
      if (!String(username || '').trim() || !String(password || '').trim()) {
        setError('Username and password are required');
        return;
      }
      const data = await loginAdmin({ username, password });
      saveAdminAuth(data.token, data.expiresAt);
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
    } catch (err) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop' }}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenTransition type="slideRight">
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.header}>
                <AgriXLogo onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })} variant="header" scale={1} />
              </View>

              <View style={styles.formContainer}>
                <Text style={styles.title}>Admin Login</Text>
                <Text style={styles.subtitle}>Authorized administrators only.</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="AdminAgriX@gmail.com"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="Password"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
                      <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <HoverPressable
                  style={[styles.signInButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleAdminSignIn}
                  disabled={isSubmitting}
                >
                  <Text style={styles.signInButtonText}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text>
                </HoverPressable>

                {!!error && <Text style={styles.errorText}>{error}</Text>}
              </View>
            </ScrollView>
          </ScreenTransition>
        </SafeAreaView>
      </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Light overlay to keep it clean
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  formContainer: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    padding: 32,
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
    fontSize: 34,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 32,
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
    ...theme.shadows.soft,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 72,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  passwordToggleText: {
    color: theme.colors.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: theme.colors.brandDark,
    paddingVertical: 16,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    marginTop: 12,
    ...theme.shadows.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: theme.colors.surface,
    fontSize: 17,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 16,
    color: theme.colors.danger,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
});

