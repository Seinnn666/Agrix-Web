import React, { useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import AgriXLogo from '../components/AgriXLogo';
import { registerUser } from '../lib/authApi';
import { getPasswordStrength, getPhoneRules, normalizePhoneInput, validateSignUpForm } from '../lib/validation';
import HoverPressable from '../components/HoverPressable';
import ScreenTransition from '../components/ScreenTransition';
import DateOfBirthPicker from '../components/DateOfBirthPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { theme } from '../ui/theme';
import AppFooter from '../components/AppFooter';
import { Moon, Sun } from '../components/Icons';

export default function SignUpScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('rather_not_say');
  const [countryCode, setCountryCode] = useState('+63');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [themeMode, setThemeMode] = useState('light');
  const isDark = themeMode === 'dark';
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const [infoDialog, setInfoDialog] = useState({ visible: false, title: '', message: '' });

  const passwordChecks = useMemo(() => getPasswordStrength(password), [password]);

  const passwordStrength = useMemo(() => {
    const score = Number(passwordChecks.score || 0);
    const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
    const progress = Math.max(0, Math.min(1, score / 4));
    const weak = isDark ? '#F87171' : theme.colors.danger;
    const mid = isDark ? '#FBBF24' : '#F59E0B';
    const strong = isDark ? '#4ADE80' : '#22C55E';
    const color = score <= 1 ? weak : score === 4 ? strong : mid;
    return { score, label, progress, color };
  }, [passwordChecks.score, isDark]);

  const openInfo = (type) => {
    if (type === 'email') {
      setInfoDialog({
        visible: true,
        title: 'Why verify your email?',
        message: 'We use your email to send your verification code and password reset link. This helps keep your account secure.',
      });
      return;
    }
    setInfoDialog({
      visible: true,
      title: 'Why add a phone number?',
      message: 'Your phone number helps with account recovery and security checks. We do not share it.',
    });
  };

  const countryOptions = useMemo(
    () => [
      { label: 'United States (+1)', value: '+1' },
      { label: 'United Kingdom (+44)', value: '+44' },
      { label: 'Philippines (+63)', value: '+63' },
      { label: 'India (+91)', value: '+91' },
      { label: 'Australia (+61)', value: '+61' },
      { label: 'Canada (+1)', value: '+1' },
    ],
    []
  );

  const phoneRules = useMemo(() => getPhoneRules(countryCode), [countryCode]);

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
  };

  const currentFormValues = () => ({
    firstName, lastName, address, dateOfBirth, gender, countryCode, phoneNumber,
    phone: normalizePhoneInput(countryCode, phoneNumber).e164, email, password, confirmPassword,
  });

  const validateFieldOnBlur = (field) => {
    const result = validateSignUpForm(currentFormValues());
    const message = result.fieldErrors[field];
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const handleCreateAccount = async () => {
    try {
      setError('');
      setFieldErrors({});
      setIsSubmitting(true);

      const phone = normalizePhoneInput(countryCode, phoneNumber).e164;

      const validation = validateSignUpForm({
        firstName,
        lastName,
        address,
        dateOfBirth,
        gender,
        countryCode,
        phoneNumber,
        phone,
        email,
        password,
        confirmPassword,
      });
      if (!validation.ok) {
        setFieldErrors(validation.fieldErrors);
        setError('');
        return;
      }

      const data = await registerUser(validation.sanitized);
      if (data?.requiresVerification === false) {
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'VerifyRegistration',
            params: {
              email: data.email || validation.sanitized.email,
              otpSent: data.otpSent,
              otpError: data.otpError,
            },
          },
        ],
      });
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
        const firstError = Object.values(err.fieldErrors || {})[0];
        setError(firstError || 'Please fix the highlighted fields');
        return;
      }
      setError(err?.message || 'Registration failed');
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

  React.useEffect(() => {
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

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('agrix_theme', themeMode);
      }
    } catch (_err) {
    }
  }, [themeMode]);

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

  const blockClipboardProps =
    Platform.OS === 'web'
      ? {
          onPaste: (e) => e.preventDefault(),
          onCopy: (e) => e.preventDefault(),
          onCut: (e) => e.preventDefault(),
          onContextMenu: (e) => e.preventDefault(),
          onDrop: (e) => e.preventDefault(),
          onDragStart: (e) => e.preventDefault(),
          onDragOver: (e) => e.preventDefault(),
          onKeyDown: (e) => {
            const key = String(e?.key || e?.nativeEvent?.key || '').toLowerCase();
            const ctrl = Boolean(e?.ctrlKey || e?.nativeEvent?.ctrlKey);
            const meta = Boolean(e?.metaKey || e?.nativeEvent?.metaKey);
            const shift = Boolean(e?.shiftKey || e?.nativeEvent?.shiftKey);
            const blocked =
              (ctrl || meta) && (key === 'v' || key === 'c' || key === 'x' || key === 'insert') ||
              (shift && key === 'insert');
            if (!blocked) return;
            e?.preventDefault?.();
            e?.stopPropagation?.();
          },
          onPasteCapture: (e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
          },
          onCopyCapture: (e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
          },
          onCutCapture: (e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
          },
        }
      : {};

  const shouldBlockMultiCharInsert = (prevValue, nextValue) => {
    if (Platform.OS !== 'web') return false;
    const prev = String(prevValue ?? '');
    const next = String(nextValue ?? '');
    if (next.length <= prev.length) return false;
    if (prev === next) return false;

    let start = 0;
    const minLen = Math.min(prev.length, next.length);
    while (start < minLen && prev[start] === next[start]) start += 1;

    let endPrev = prev.length - 1;
    let endNext = next.length - 1;
    while (endPrev >= start && endNext >= start && prev[endPrev] === next[endNext]) {
      endPrev -= 1;
      endNext -= 1;
    }

    const inserted = endNext - start + 1;
    return inserted > 1;
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
                <HoverPressable
                  onPress={() => navigation.navigate('SignIn')}
                  style={styles.navItem}
                  hoverStyle={
                    Platform.OS === 'web'
                      ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
                      : null
                  }
                  pressedStyle={{ opacity: 0.7 }}
                >
                  <Text style={[styles.navLink, styles.navAccent, isDark && { color: '#4ADE80' }]}>Login</Text>
                </HoverPressable>
                <Text style={[styles.navLink, styles.navActive, isDark && { color: '#4ADE80' }]}>Register</Text>
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
                Create an <Text style={[styles.titleAccent, isDark && { color: '#4ADE80' }]}>Account</Text>
              </Text>

              <View style={[styles.row, isCompact && styles.rowCompact]}>
                <View style={[styles.inputGroup, styles.halfInput, isCompact && styles.fullInput]}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>First Name *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                      fieldErrors.firstName && styles.inputError,
                    ]}
                    value={firstName}
                    onChangeText={(v) => { clearFieldError('firstName'); setFirstName(String(v || '').replace(/\d/g, '')); }}
                    onBlur={() => validateFieldOnBlur('firstName')}
                    maxLength={35}
                    autoComplete="given-name"
                    textContentType="givenName"
                  />
                  {!!fieldErrors.firstName && <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>}
                </View>
                <View style={[styles.inputGroup, styles.halfInput, isCompact && styles.fullInput]}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Last Name *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                      fieldErrors.lastName && styles.inputError,
                    ]}
                    value={lastName}
                    onChangeText={(v) => { clearFieldError('lastName'); setLastName(String(v || '').replace(/\d/g, '')); }}
                    onBlur={() => validateFieldOnBlur('lastName')}
                    maxLength={35}
                    autoComplete="family-name"
                    textContentType="familyName"
                  />
                  {!!fieldErrors.lastName && <Text style={styles.fieldError}>{fieldErrors.lastName}</Text>}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Address *</Text>
                <TextInput
                  style={[
                    styles.input,
                    isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                    fieldErrors.address && styles.inputError,
                  ]}
                  value={address}
                  onChangeText={(v) => { clearFieldError('address'); setAddress(v); }}
                  onBlur={() => validateFieldOnBlur('address')}
                />
                {!!fieldErrors.address && <Text style={styles.fieldError}>{fieldErrors.address}</Text>}
              </View>

              <View style={[styles.row, isCompact && styles.rowCompact]}>
                <View style={[styles.inputGroup, styles.halfInput, isCompact && styles.fullInput]}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Date of Birth *</Text>
                  <DateOfBirthPicker
                    value={dateOfBirth}
                    onChange={(v) => { clearFieldError('dateOfBirth'); setDateOfBirth(v); }}
                    error={fieldErrors.dateOfBirth}
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfInput, isCompact && styles.fullInput]}>
                  <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Gender *</Text>
                  <View style={styles.pillRow}>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'male' && styles.pillSelected]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={[styles.pillText, gender === 'male' && styles.pillTextSelected]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'female' && styles.pillSelected]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={[styles.pillText, gender === 'female' && styles.pillTextSelected]}>Female</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'rather_not_say' && styles.pillSelected]}
                      onPress={() => setGender('rather_not_say')}
                    >
                      <Text style={[styles.pillText, gender === 'rather_not_say' && styles.pillTextSelected]}>
                        Rather not to say
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {!!fieldErrors.gender && <Text style={styles.fieldError}>{fieldErrors.gender}</Text>}
                </View>
              </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Phone Number *</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryWrap}>
                <TouchableOpacity
                  style={[
                    styles.countryButton,
                    isDark && { backgroundColor: '#020617', borderColor: '#374151' },
                    fieldErrors.phone && styles.inputError,
                  ]}
                  onPress={() => setIsCountryOpen((v) => !v)}
                >
                  <Text style={styles.countryButtonText}>{countryCode}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.phoneInput,
                  isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                  fieldErrors.phone && styles.inputError,
                ]}
                value={phoneNumber}
                onChangeText={(v) => {
                  clearFieldError('phone');
                  const digits = String(v || '').replace(/\D/g, '');
                  if (countryCode === '+63') {
                    let next = digits;
                    if (next && next[0] !== '0') next = `0${next}`;
                    if (next.length >= 2 && next[0] === '0' && next[1] !== '9') {
                      next = `09${next.slice(2)}`;
                    }
                    setPhoneNumber(next.slice(0, phoneRules.maxLength));
                    return;
                  }
                  setPhoneNumber(digits.slice(0, phoneRules.maxLength));
                }}
                onBlur={() => validateFieldOnBlur('phone')}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder={phoneRules.placeholder}
                maxLength={phoneRules.maxLength}
              />
            </View>
            {isCountryOpen && (
              <View style={styles.countryDropdown}>
                <Text style={styles.countryDropdownTitle}>Select country code</Text>
                <ScrollView style={styles.countryDropdownScroll}>
                  {countryOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.countryOption,
                        opt.value === countryCode && styles.countryOptionSelected,
                      ]}
                      onPress={() => {
                        setCountryCode(opt.value);
                        setPhoneNumber('');
                        setIsCountryOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.countryOptionText,
                          opt.value === countryCode && styles.countryOptionTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {!!fieldErrors.phone && <Text style={styles.fieldError}>{fieldErrors.phone}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Email Address *</Text>
            <TextInput
              style={[
                styles.input,
                isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                fieldErrors.email && styles.inputError,
              ]}
              value={email}
              onChangeText={(v) => { clearFieldError('email'); setEmail(v); }}
              onBlur={() => validateFieldOnBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Password *</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                  fieldErrors.password && styles.inputError,
                ]}
                value={password}
                onChangeText={(text) => { clearFieldError('password'); setPassword(text); }}
                onBlur={() => validateFieldOnBlur('password')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text style={[styles.passwordToggleText, isDark && { color: '#4ADE80' }]}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.strengthWrap}>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: `${passwordStrength.progress * 100}%`, backgroundColor: passwordStrength.color }]} />
              </View>
              <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                Strength: {passwordStrength.label}
              </Text>
              <View style={styles.checklist}>
                {passwordChecks.checks.map((c) => (
                  <View key={c.key} style={styles.checkRow}>
                    <View style={[styles.checkDot, c.ok && styles.checkDotOk]} />
                    <Text style={[styles.checkText, c.ok && styles.checkTextOk, isDark && { color: c.ok ? '#A7F3D0' : '#9CA3AF' }]}>{c.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isDark && { color: '#E5E7EB' }]}>Confirm Password *</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  isDark && { backgroundColor: '#020617', borderColor: '#374151', color: '#F9FAFB' },
                  fieldErrors.confirmPassword && styles.inputError,
                ]}
                value={confirmPassword}
                onChangeText={(text) => { clearFieldError('confirmPassword'); setConfirmPassword((prev) => (shouldBlockMultiCharInsert(prev, text) ? prev : text)); }}
                onBlur={() => validateFieldOnBlur('confirmPassword')}
                secureTextEntry={!showConfirmPassword}
                autoComplete="off"
                textContentType="newPassword"
                {...blockClipboardProps}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword((v) => !v)}
              >
                <Text style={[styles.passwordToggleText, isDark && { color: '#4ADE80' }]}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
            {!!fieldErrors.confirmPassword && (
              <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
            )}
          </View>

          <HoverPressable
            style={[
              styles.createButton,
              isSubmitting && styles.buttonDisabled,
              isDark && { backgroundColor: '#15803D' },
            ]}
            onPress={handleCreateAccount}
            disabled={isSubmitting}
          >
            <Text style={styles.createButtonText}>{isSubmitting ? 'Creating…' : 'Create Account'}</Text>
          </HoverPressable>

          {!!error && (
            <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{error}</Text>
          )}
            </View>
          </View>
              </View>

          <AppFooter bottomFill={8} />
          <ConfirmDialog
            visible={infoDialog.visible}
            title={infoDialog.title}
            message={infoDialog.message}
            confirmText="OK"
            cancelText={null}
            onConfirm={() => setInfoDialog({ visible: false, title: '', message: '' })}
            onCancel={() => setInfoDialog({ visible: false, title: '', message: '' })}
          />
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
  pagePadding: {
    flexGrow: 1,
    padding: 20,
  },
  pageBody: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    maxWidth: 600,
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
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 40,
  },
  titleAccent: {
    color: theme.colors.brand,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowCompact: {
    flexDirection: 'column',
  },
  halfInput: {
    width: '48%',
  },
  fullInput: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
    position: 'relative',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  whyLink: {
    position: 'absolute',
    right: 0,
    top: 0,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  whyLinkText: {
    color: theme.colors.brand,
    fontWeight: '900',
    fontSize: 13,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  helperText: {
    marginTop: 6,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  strengthWrap: {
    marginTop: 10,
  },
  strengthTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  strengthFill: {
    height: '100%',
    backgroundColor: theme.colors.brand,
  },
  strengthText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
  },
  checklist: {
    marginTop: 10,
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  checkDotOk: {
    backgroundColor: theme.colors.brand,
  },
  checkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  checkTextOk: {
    color: theme.colors.brandDark,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  countryWrap: {
    position: 'relative',
  },
  countryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
  },
  countryDropdown: {
    marginTop: 10,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  countryDropdownTitle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countryDropdownScroll: {
    maxHeight: 220,
  },
  countryOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  countryOptionSelected: {
    backgroundColor: theme.colors.brandLight,
  },
  countryOptionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  countryOptionTextSelected: {
    color: theme.colors.brandDark,
    fontWeight: '800',
  },
  phoneInput: {
    flex: 1,
  },
  createButton: {
    backgroundColor: theme.colors.brandDark,
    paddingVertical: 15,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
  },
  pillSelected: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.brand,
  },
  pillText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 12,
  },
  pillTextSelected: {
    color: '#fff',
  },
  copyright: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginTop: 40,
  },
});
