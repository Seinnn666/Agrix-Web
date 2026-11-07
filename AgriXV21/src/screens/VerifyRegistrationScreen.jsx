import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import { resendVerification, saveAuth, verifyRegistration } from '../lib/authApi';
import { theme } from '../ui/theme';
import { formatCountdown, useCountdown } from '../hooks/useCountdown';

export default function VerifyRegistrationScreen({ navigation, route }) {
  const { userId, email, otpSent, otpError } = route?.params || {};
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [countdownAnnouncement, setCountdownAnnouncement] = useState('');
  const hiddenInputRef = useRef(null);
  const resendAnnouncedRef = useRef(false);
  const resendCountdown = useCountdown('agrix.verify-registration.resend.endAt');

  useEffect(() => {
    if (resendCountdown.remainingSeconds > 0) {
      setError(`Too many resend requests. Try again in ${formatCountdown(resendCountdown.remainingSeconds)}.`);
      if (!resendAnnouncedRef.current) {
        setCountdownAnnouncement(`Too many resend requests. Try again in ${formatCountdown(resendCountdown.remainingSeconds)}.`);
        resendAnnouncedRef.current = true;
      }
    } else if (resendAnnouncedRef.current) {
      setError((current) => (current.startsWith('Too many resend requests.') ? '' : current));
      setCountdownAnnouncement('You can request a new code now.');
      resendAnnouncedRef.current = false;
    }
  }, [resendCountdown.remainingSeconds]);

  const resolvedEmail = useMemo(() => {
    return String(email || '').trim();
  }, [email]);

  const otp = useMemo(() => digits.join(''), [digits]);

  const focusInput = () => {
    if (hiddenInputRef.current && typeof hiddenInputRef.current.focus === 'function') {
      hiddenInputRef.current.focus();
    }
  };

  const handleChangeOtp = (value) => {
    const raw = String(value || '').replace(/\D/g, '').slice(0, 6);
    const next = new Array(6).fill('');
    for (let i = 0; i < raw.length; i += 1) next[i] = raw[i];
    setDigits(next);
  };

  const handleVerify = async () => {
    try {
      setError('');
      setStatus('');
      setIsSubmitting(true);
      if (!userId) {
        setError('Missing verification details. Please register again.');
        return;
      }
      if (otp.length !== 6) {
        setError('Please enter the 6-digit code.');
        return;
      }
      const data = await verifyRegistration({ userId, email: resolvedEmail, code: otp });
      if (Platform.OS === 'web') {
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      saveAuth(data.token, data.user);
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (err) {
      if (err?.code === 'OTP_LOCKED' && typeof err?.retryAfterSeconds === 'number') {
        setError('Too many attempts. Please try again later.');
        return;
      }
      setError(err?.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      setError('');
      setStatus('');
      if (resendCountdown.remainingSeconds > 0) return;
      if (!userId) {
        setError('Missing verification details. Please register again.');
        return;
      }
      setIsSubmitting(true);
      await resendVerification({ userId, email: resolvedEmail });
      setStatus('Code resent. Please check your email.');
    } catch (err) {
      if ((err?.code === 'OTP_RESEND_LIMIT' || err?.status === 429) && typeof err?.retryAfterSeconds === 'number') {
        resendCountdown.startCountdown(err.retryAfterSeconds);
        return;
      }
      setError(err?.message || 'Failed to resend');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ImageBackground
        source={{
          uri: 'https://scontent.fmnl33-4.fna.fbcdn.net/v/t1.15752-9/610301853_1633812481404887_4043848288952962201_n.jpg?stp=dst-jpg_s552x414_tt6&_nc_cat=106&ccb=1-7&_nc_sid=0024fc&_nc_ohc=VVrO414b8SEQ7kNvwFDKEEA&_nc_oc=AdnVenaEB2CvH9T2kUvGCUd-d46Wlr4xUWDRlIVSbOtKQwOT8GoFUEDmZ8Hbk7It0Hn84dxsozzSA8A9QCMTdsML&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fmnl33-4.fna&oh=03_Q7cD4QFgdM6xlAjbsq_NXqozxXZVTuyKQUl_9dPkKPyy-8Yfpw&oe=69A2F126',
        }}
        resizeMode="cover"
        style={styles.bg}
      >
        <View style={styles.overlay} />
        <View style={styles.outer}>
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <AgriXLogo variant="compact" scale={1} />
            </View>

            {!!resolvedEmail ? <Text style={styles.emailText}>{resolvedEmail}</Text> : null}
            <Text style={styles.title}>Approve Sign in Request</Text>
            <Text style={styles.subtitle}>
              {otpSent === false
                ? 'We couldn’t send the code automatically. Tap Resend Code to try again.'
                : 'An OTP code has been sent to your registered email. Please enter the 6-digit code below to continue.'}
            </Text>
            {otpSent === false ? (
              <Text style={styles.noticeText}>
                {String(otpError?.message || otpError?.code || 'Email delivery failed')}
              </Text>
            ) : null}

            <Pressable style={styles.otpRow} onPress={focusInput}>
              {digits.map((d, idx) => (
                <View key={`otp-box-${idx}`} style={styles.otpBox}>
                  <Text style={styles.otpDigit}>{d || ''}</Text>
                </View>
              ))}
            </Pressable>

            <TextInput
              ref={hiddenInputRef}
              value={otp}
              onChangeText={handleChangeOtp}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              caretHidden
              style={styles.hiddenInput}
              accessibilityLabel="One-time code"
            />

            <View style={styles.resendBox}>
              <Text style={styles.resendHint}>Didn’t receive a sign-in request?</Text>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResend}
                disabled={isSubmitting || resendCountdown.remainingSeconds > 0}
              >
                <Text style={styles.resendText}>
                  {resendCountdown.remainingSeconds > 0 ? `Resend in ${formatCountdown(resendCountdown.remainingSeconds)}` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Verify code and continue"
            >
              <Text style={styles.primaryButtonText}>{isSubmitting ? 'Verifying…' : 'Verify & Continue'}</Text>
            </TouchableOpacity>

            {!!status && <Text style={styles.statusText}>{status}</Text>}
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <Text
              accessibilityLiveRegion="polite"
              {...(Platform.OS === 'web' ? { 'aria-live': 'polite' } : {})}
              style={styles.screenReaderOnly}
            >
              {countdownAnnouncement}
            </Text>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })}
            >
              <Text style={styles.backText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  outer: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { minHeight: '100vh' },
      default: null,
    }),
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  emailText: {
    textAlign: 'center',
    color: theme.colors.brandDark,
    fontWeight: '800',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.brandDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  noticeText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
    ...Platform.select({
      web: { cursor: 'text' },
      default: null,
    }),
  },
  otpBox: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    lineHeight: 24,
    ...Platform.select({
      android: { includeFontPadding: false },
      default: null,
    }),
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    left: -9999,
  },
  resendBox: {
    backgroundColor: 'rgba(47,125,50,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  resendHint: {
    color: theme.colors.textMuted,
    marginBottom: 6,
    fontWeight: '700',
  },
  resendButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resendText: {
    color: theme.colors.brand,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    backgroundColor: theme.colors.brand,
    paddingVertical: 14,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: theme.colors.surface,
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
  backLink: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    color: theme.colors.textMuted,
    fontWeight: '800',
  },
});

