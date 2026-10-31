import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Platform, useWindowDimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AgriXLogo from '../components/AgriXLogo';
import { API_BASE_URL, clearAuth, getMe, loadAuth, saveAuth, updateMe, uploadAvatar, requestUpdateOtp, verifyUpdateOtp } from '../lib/authApi';
import { getPhoneRules, normalizePhoneInput, validateName, validateAddress, validateDateOfBirth } from '../lib/validation';
import { addNotification } from '../lib/notifications';
import HoverPressable from '../components/HoverPressable';
import DateOfBirthPicker from '../components/DateOfBirthPicker';
import { theme } from '../ui/theme';
import AppFooter from '../components/AppFooter';
import ConfirmDialog from '../components/ConfirmDialog';
import { User, Mail, Phone, MapPin, Calendar, Lock, Edit2, Camera, Sprout, Tractor, BarChart2, Check, X, Bell, Moon, Sun } from '../components/Icons';
import { getThemeMode, setThemeMode as setAppTheme, subscribeTheme } from '../lib/themePref';

// Simple Modal Component for OTP
function OtpUpdateModal({ 
  visible, onClose, step, type, value, onChangeValue, otp, onChangeOtp, onAction, error, loading,
  countryCode, setCountryCode, isCountryOpen, setIsCountryOpen, countryOptions, phoneRules
}) {
  if (!visible) return null;
  
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{step === 'request' ? `Update ${type === 'email' ? 'Email' : 'Phone'}` : 'Verify OTP'}</Text>
        
        {step === 'request' ? (
          <>
            <Text style={styles.modalText}>Enter your new {type === 'email' ? 'email address' : 'phone number'}. We will send you an OTP to verify.</Text>
            
            {type === 'email' ? (
              <TextInput
                style={styles.modalInput}
                value={value}
                onChangeText={onChangeValue}
                placeholder="New Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <View style={{ position: 'relative', zIndex: 10 }}>
                <View style={styles.phoneRow}>
                  <TouchableOpacity
                    style={styles.countryButton}
                    onPress={() => setIsCountryOpen(!isCountryOpen)}
                  >
                    <Text style={styles.countryButtonText}>{countryCode}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                    value={value}
                    onChangeText={(text) => {
                      // Only allow numbers
                      const digits = text.replace(/\D/g, '');
                      // Apply PH specific rule if +63
                      if (countryCode === '+63') {
                         let next = digits;
                         if (next && next[0] !== '0') next = `0${next}`;
                         if (next.length >= 2 && next[0] === '0' && next[1] !== '9') {
                           next = `09${next.slice(2)}`;
                         }
                         onChangeValue(next.slice(0, phoneRules?.maxLength || 11));
                         return;
                      }
                      onChangeValue(digits.slice(0, phoneRules?.maxLength || 15));
                    }}
                    placeholder={phoneRules?.placeholder || 'Phone Number'}
                    keyboardType="phone-pad"
                    maxLength={phoneRules?.maxLength || 15}
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
                            onChangeValue('');
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
              </View>
            )}
          </>
        ) : (
          <>
             <Text style={styles.modalText}>Enter the OTP sent to {value}.</Text>
             <TextInput
              style={styles.modalInput}
              value={otp}
              onChangeText={onChangeOtp}
              placeholder="Enter OTP"
              keyboardType="number-pad"
              maxLength={6}
            />
          </>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.modalActions}>
          <TouchableOpacity onPress={onClose} style={styles.modalBtnCancel} disabled={loading}>
            <Text style={styles.modalBtnTextCancel}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onAction} style={styles.modalBtnConfirm} disabled={loading}>
             <Text style={styles.modalBtnTextConfirm}>{loading ? 'Processing...' : (step === 'request' ? 'Send OTP' : 'Verify')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function MyProfileScreen({ navigation }) {
  const [user, setUser] = useState(() => loadAuth().user);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const pendingNavActionRef = useRef(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 980;
  const [themeMode, setThemeMode] = useState(() => getThemeMode());
  const isDark = themeMode === 'dark';
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const isThemeAnimatingRef = useRef(false);
  const hiddenSidebarTranslateY = -520;
  const sidebarTranslateY = useRef(new Animated.Value(hiddenSidebarTranslateY)).current;
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: 'rather_not_say',
  });
  const draftSaveTimerRef = useRef(null);
  const draftInitRef = useRef({ loaded: false });

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

  // OTP State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpStep, setOtpStep] = useState('request');
  const [otpType, setOtpType] = useState('email');
  const [otpValue, setOtpValue] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  
  // Phone OTP State
  const [countryCode, setCountryCode] = useState('+63');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  
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

  const avatarSrc = useMemo(() => {
    const url = String(user?.avatarUrl || '').trim();
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
  }, [user]);

  const fullName = useMemo(() => {
    const first = user?.firstName || '';
    const last = user?.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || 'User';
  }, [user]);

  function formatPhoneForDisplay(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+63') && /^\+639\d{9}$/.test(raw)) return `0${raw.slice(3)}`;
    if (raw.startsWith('+44') && raw.length > 3) return `0${raw.slice(3)}`;
    if (raw.startsWith('+61') && raw.length > 3) return `0${raw.slice(3)}`;
    return raw;
  }

  const displayPhone = useMemo(() => {
    return formatPhoneForDisplay(user?.phone);
  }, [user?.phone]);

  useEffect(() => {
    const { token, user: cachedUser } = loadAuth();
    if (!token) {
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
      return;
    }
    if (cachedUser) setUser(cachedUser);

    let cancelled = false;
    (async () => {
      try {
        setError('');
        setStatus('loading');
        const data = await getMe();
        if (cancelled) return;
        setUser(data.user);
        saveAuth(token, data.user);
        setDraft({
          firstName: data.user?.firstName || '',
          lastName: data.user?.lastName || '',
          email: data.user?.email || '',
          phone: formatPhoneForDisplay(data.user?.phone),
          address: data.user?.address || '',
          dateOfBirth: data.user?.dateOfBirth ? data.user.dateOfBirth.split('T')[0] : '',
          gender: data.user?.gender || 'rather_not_say',
        });
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err?.message || 'Failed to load profile');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  useEffect(() => {
    if (!user) return;
    if (isEditing) return;
    setDraft({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: formatPhoneForDisplay(user?.phone),
      address: user?.address || '',
      dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      gender: user?.gender || 'rather_not_say',
    });
    setDraftDirty(false);
  }, [user, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    if (draftInitRef.current.loaded) return;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem('agrix_profile_draft');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed?.userEmail && user?.email && String(parsed.userEmail) !== String(user.email)) return;
      if (parsed?.draft && typeof parsed.draft === 'object') {
        setDraft((prev) => ({ ...prev, ...parsed.draft }));
        setDraftDirty(true);
      }
    } catch (_err) {
    } finally {
      draftInitRef.current.loaded = true;
    }
  }, [isEditing, user?.email]);

  useEffect(() => {
    if (!isEditing) return;
    setDraftDirty(true);
    try {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    } catch (_err) {}
    draftSaveTimerRef.current = setTimeout(() => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(
          'agrix_profile_draft',
          JSON.stringify({ userEmail: user?.email || '', updatedAt: Date.now(), draft })
        );
      } catch (_err) {}
    }, 400);
    return () => {
      try {
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      } catch (_err) {}
    };
  }, [draft, isEditing, user?.email]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isEditing || !draftDirty) return;
      e.preventDefault();
      pendingNavActionRef.current = e.data.action;
      setLeaveVisible(true);
    });
    return unsub;
  }, [navigation, isEditing, draftDirty]);

  const openOtpModal = (type) => {
    setOtpType(type);
    setOtpStep('request');
    setOtpValue('');
    setOtpCode('');
    setOtpError('');
    setOtpModalVisible(true);
  };

  const handleRequestOtp = async () => {
    try {
      setOtpLoading(true);
      setOtpError('');
      // Basic validation
      if (!otpValue) throw new Error('Value is required');
      
      let finalValue = otpValue;
      if (otpType === 'phone') {
        finalValue = normalizePhoneInput(countryCode, otpValue).e164;
      }

      await requestUpdateOtp({ type: otpType, value: finalValue });
      addNotification({
        key: otpType === 'phone' ? 'profile:phone_otp_sent' : 'profile:email_otp_sent',
        title: 'Verification code sent',
        message: otpType === 'phone' ? 'A verification code was sent to your phone number.' : 'A verification code was sent to your email.',
        level: 'success',
      });
      setOtpStep('verify');
    } catch (err) {
      const message = err?.message || 'Failed to request verification code';
      setOtpError(message);
      addNotification({ key: 'profile:otp_request_failed', title: 'Verification request failed', message, level: 'error' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setOtpLoading(true);
      setOtpError('');
      const data = await verifyUpdateOtp({ otp: otpCode });
      setUser(data.user);
      const { token } = loadAuth();
      if (token) saveAuth(token, data.user);
      setOtpModalVisible(false);
      addNotification({
        key: otpType === 'phone' ? 'profile:phone_verified' : 'profile:email_verified',
        title: 'Verification complete',
        message: otpType === 'phone' ? 'Your phone number was verified successfully.' : 'Your email was verified successfully.',
        level: 'success',
      });
      // Refresh local draft
      setDraft(prev => ({
        ...prev,
        email: data.user.email,
        phone: formatPhoneForDisplay(data.user.phone)
      }));
    } catch (err) {
      const message = err?.message || 'Failed to verify code';
      setOtpError(message);
      addNotification({ key: 'profile:otp_verify_failed', title: 'Verification failed', message, level: 'error' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogout = () => {
    setLogoutVisible(true);
  };
  const confirmLogoutNow = () => {
    setLogoutVisible(false);
    clearAuth();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  };

  const handleChangePhoto = async () => {
    try {
      setError('');
      if (Platform.OS !== 'web' || typeof document === 'undefined') {
        setError('Profile photo upload is available on web for now');
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        try {
          const file = input.files && input.files[0];
          if (!file) return;
          const maxBytes = 5 * 1024 * 1024;
          if (typeof file.size === 'number' && file.size > maxBytes) {
            setStatus('error');
            setError('Image is too large (max 5MB)');
            return;
          }
          setStatus('uploading');
          const data = await uploadAvatar(file);
          setUser(data.user);
          const { token } = loadAuth();
          if (token) saveAuth(token, data.user);
          setStatus('ready');
          addNotification({
            key: 'profile:photo_updated',
            title: 'Profile photo updated',
            message: 'Your profile photo was updated successfully.',
            level: 'success',
          });
        } catch (err) {
          setStatus('error');
          const message = err?.message || 'Upload failed';
          setError(message);
          addNotification({ key: 'profile:photo_upload_failed', title: 'Photo upload failed', message, level: 'error' });
        }
      };
      input.click();
    } catch (err) {
      const message = err?.message || 'Upload failed';
      setError(message);
      addNotification({ key: 'profile:photo_upload_failed', title: 'Photo upload failed', message, level: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    try {
      setError('');
      
      // Validations
      const fNameVal = validateName(draft.firstName, 'First Name');
      if (!fNameVal.ok) {
        setError(fNameVal.message);
        return;
      }
      
      const lNameVal = validateName(draft.lastName, 'Last Name');
      if (!lNameVal.ok) {
        setError(lNameVal.message);
        return;
      }

      const addrVal = validateAddress(draft.address);
      if (!addrVal.ok) {
        setError(addrVal.message);
        return;
      }

      if (draft.dateOfBirth) {
         const dobVal = validateDateOfBirth(draft.dateOfBirth);
         if (!dobVal.ok) {
            setError(dobVal.message);
            return;
         }
      }

      setStatus('saving');
      // Email and Phone are handled separately via OTP
      const data = await updateMe({
        firstName: fNameVal.value,
        lastName: lNameVal.value,
        address: addrVal.value,
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
      });
      setUser(data.user);
      const { token } = loadAuth();
      if (token) saveAuth(token, data.user);
      setIsEditing(false);
      setStatus('ready');
      setDraftDirty(false);
      draftInitRef.current.loaded = false;
      try {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem('agrix_profile_draft');
      } catch (_err) {}
      addNotification({
        key: 'profile:updated',
        title: 'Profile updated',
        message: 'Your profile changes were saved successfully.',
        level: 'success',
      });
    } catch (err) {
      setStatus('error');
      const message = err?.message || 'Failed to update profile';
      setError(message);
      addNotification({ key: 'profile:update_failed', title: 'Profile update failed', message, level: 'error' });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraft({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: formatPhoneForDisplay(user?.phone),
      address: user?.address || '',
      dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      gender: user?.gender || 'rather_not_say',
    });
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

  const menuItems = [
    {
      label: 'Home',
      onPress: () => {
        navigation.navigate('Dashboard');
      },
    },
    ...(user?.isAdmin
      ? [{ label: 'Admin Dashboard', onPress: () => navigation.navigate('AdminDashboard') }]
      : [
          { label: 'Device & Sensors', onPress: () => navigation.navigate('DeviceSensors') },
          { label: 'Notifications', onPress: openNotifications },
        ]),
  ];

  function expandSidebar() {
    setIsSidebarOpen(true);
    Animated.timing(sidebarTranslateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }

  function collapseSidebar() {
    Animated.timing(sidebarTranslateY, {
      toValue: hiddenSidebarTranslateY,
      duration: 260,
      useNativeDriver: false,
    }).start(() => {
      setIsSidebarOpen(false);
    });
  }

  function toggleSidebar() {
    if (isSidebarOpen) collapseSidebar();
    else expandSidebar();
  }

  function handleMenuPress(item) {
    item.onPress();
    collapseSidebar();
  }

  return (
    <View style={[styles.bg, isDark && styles.bgDark]}>
      <Animated.View style={[styles.bgOverlay, { opacity: fadeOpacity }]}>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          <View style={styles.mainLayout}>
            {/* Top Navbar */}
            <View style={styles.topNavbar}>
              <AgriXLogo
                onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
                style={styles.navbarLogo}
                variant="navbar"
                scale={1}
              />
              <HoverPressable style={styles.hamburgerContainer} onPress={toggleSidebar} onHoverIn={expandSidebar}>
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
                <View style={[styles.hamburgerLine, isDark && { backgroundColor: '#4ADE80' }]} />
              </HoverPressable>
            </View>

            {/* Sidebar */}
            <Animated.View
              style={[
                styles.sidebar,
                isDark && { backgroundColor: 'rgba(2, 6, 23, 0.92)' },
                { transform: [{ translateY: sidebarTranslateY }] },
              ]}
              onMouseLeave={collapseSidebar}
              onMouseEnter={expandSidebar}
            >
              <View style={styles.sidebarContent}>
                <View style={styles.sidebarMenu}>
                  {menuItems.map((item) => (
                    <HoverPressable key={item.label} style={styles.sidebarItem} onPress={() => handleMenuPress(item)}>
                      <Text style={[styles.sidebarText, isDark && { color: '#E5E7EB' }]}>{item.label}</Text>
                    </HoverPressable>
                  ))}
                  <HoverPressable style={styles.sidebarItem} onPress={toggleTheme}>
                    <View style={styles.themeRow}>
                      <View style={styles.themeLeft}>
                        {isDark ? <Moon size={16} color="#4ADE80" /> : <Sun size={16} color="#fff" />}
                        <Text style={[styles.sidebarText, isDark && { color: '#E5E7EB' }]}>Dark mode</Text>
                      </View>
                      <View style={[styles.themeSwitch, isDark && styles.themeSwitchDark]}>
                        <View style={[styles.themeKnob, isDark && styles.themeKnobDark]} />
                      </View>
                    </View>
                  </HoverPressable>
                </View>
                <HoverPressable style={styles.sidebarItem} onPress={handleLogout}>
                  <Text style={[styles.sidebarText, isDark && { color: '#FCA5A5' }]}>Logout</Text>
                </HoverPressable>
              </View>
            </Animated.View>

            {/* Main Scroll Content */}
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              
              {/* Header Hero Section */}
              <View style={[styles.heroSection, isDark && styles.heroSectionDark]}>
                <View style={styles.heroContent}>
                  <TouchableOpacity
                    style={styles.heroAvatarBtn}
                    onPress={handleChangePhoto}
                  >
                    {avatarSrc ? (
                      <Image source={{ uri: avatarSrc }} style={styles.heroAvatarImg} />
                    ) : (
                      <View style={styles.heroAvatarPlaceholder}>
                         <User size={40} color={theme.colors.brandLight} />
                      </View>
                    )}
                    <View style={styles.heroAvatarBadge}>
                      <Camera size={14} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.heroText}>
                    <Text style={styles.heroName}>{fullName}</Text>
                    <Text style={styles.heroEmail}>{user?.email}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{user?.isAdmin ? 'Admin' : 'Member'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.contentContainer, isCompact && styles.contentContainerCompact]}>
                
                <View style={[styles.mainGrid, isCompact && styles.mainGridCompact]}>
                  {/* Left Column: Personal Details */}
                  <View style={[styles.detailsCard, isCompact && styles.detailsCardCompact, isDark && styles.cardDark]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.iconCircle, isDark && { backgroundColor: 'rgba(74,222,128,0.18)' }]}>
                          <User size={20} color={theme.colors.brand} />
                        </View>
                        <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]}>Personal Details</Text>
                      </View>
                      
                      {!isEditing ? (
                        <HoverPressable style={[styles.editBtn, isDark && styles.editBtnDark]} onPress={() => setIsEditing(true)}>
                           <Edit2 size={16} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                           <Text style={[styles.editBtnText, isDark && styles.mutedTextDark]}>Edit</Text>
                        </HoverPressable>
                      ) : (
                        <View style={styles.editActions}>
                          <HoverPressable style={styles.saveBtn} onPress={handleSaveProfile}>
                             <Check size={16} color="#fff" />
                             <Text style={styles.saveBtnText}>Save</Text>
                          </HoverPressable>
                          <HoverPressable style={styles.cancelBtn} onPress={handleCancelEdit}>
                             <X size={16} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                          </HoverPressable>
                        </View>
                      )}
                    </View>
                    
                    {!!error && <Text style={styles.errorText}>{error}</Text>}

                    <View style={[styles.fieldsGrid, isCompact && styles.fieldsGridCompact]}>
                       {/* Full Name */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <User size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Full Name</Text>
                          </View>
                          {isEditing ? (
                             <View style={styles.nameInputs}>
                                <TextInput
                                  style={[styles.input, isDark && styles.inputDark]}
                                  value={draft.firstName}
                                  onChangeText={(v) => setDraft(d => ({...d, firstName: v}))}
                                  placeholder="First"
                                  maxLength={35}
                                />
                                <TextInput
                                  style={[styles.input, isDark && styles.inputDark]}
                                  value={draft.lastName}
                                  onChangeText={(v) => setDraft(d => ({...d, lastName: v}))}
                                  placeholder="Last"
                                  maxLength={35}
                                />
                             </View>
                          ) : (
                             <Text style={[styles.fieldValue, isDark && styles.textDark]}>{fullName}</Text>
                          )}
                       </View>

                       {/* Email */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <Mail size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Email</Text>
                          </View>
                          <View style={styles.valueRow}>
                             <Text style={[styles.fieldValue, isDark && styles.textDark]} numberOfLines={1} ellipsizeMode="middle">{user?.email}</Text>
                             {isEditing && (
                               <TouchableOpacity onPress={() => openOtpModal('email')}>
                                 <Text style={styles.changeLink}>Change</Text>
                               </TouchableOpacity>
                             )}
                          </View>
                       </View>

                       {/* Phone */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <Phone size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Phone</Text>
                          </View>
                          <View style={styles.valueRow}>
                             <Text style={[styles.fieldValue, isDark && styles.textDark]}>{displayPhone || '—'}</Text>
                             {isEditing && (
                               <TouchableOpacity onPress={() => openOtpModal('phone')}>
                                 <Text style={styles.changeLink}>Change</Text>
                               </TouchableOpacity>
                             )}
                          </View>
                       </View>

                       {/* Address */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <MapPin size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Address</Text>
                          </View>
                          {isEditing ? (
                             <TextInput
                                style={[styles.input, isDark && styles.inputDark]}
                                value={draft.address}
                                onChangeText={(v) => setDraft(d => ({...d, address: v}))}
                                placeholder="Address"
                             />
                          ) : (
                             <Text style={[styles.fieldValue, isDark && styles.textDark]} numberOfLines={2}>{user?.address || '—'}</Text>
                          )}
                       </View>

                       {/* DOB */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <Calendar size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Date of Birth</Text>
                          </View>
                          {isEditing ? (
                             <DateOfBirthPicker
                                value={draft.dateOfBirth}
                                onChange={(v) => setDraft(d => ({...d, dateOfBirth: v}))}
                             />
                          ) : (
                             <Text style={[styles.fieldValue, isDark && styles.textDark]}>{user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : '—'}</Text>
                          )}
                       </View>

                       {/* Gender */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <User size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Gender</Text>
                          </View>
                          {isEditing ? (
                             <View style={styles.genderOptions}>
                               {['male', 'female', 'rather_not_say'].map(g => (
                                 <TouchableOpacity
                                   key={g}
                                   style={[
                                     styles.genderChip,
                                     isDark && styles.inputDark,
                                     draft.gender === g && styles.genderChipActive,
                                   ]}
                                   onPress={() => setDraft(d => ({...d, gender: g}))}
                                 >
                                   <Text style={[styles.genderChipText, isDark && styles.mutedTextDark, draft.gender === g && styles.genderChipTextActive]}>
                                      {g.replace(/_/g, ' ')}
                                    </Text>
                                 </TouchableOpacity>
                               ))}
                             </View>
                          ) : (
                             <Text style={[styles.fieldValue, { textTransform: 'capitalize' }, isDark && styles.textDark]}>
                               {user?.gender ? user.gender.replace(/_/g, ' ') : '—'}
                             </Text>
                          )}
                       </View>

                       {/* Password */}
                       <View style={styles.fieldItem}>
                          <View style={styles.fieldLabelRow}>
                             <Lock size={14} color={isDark ? '#9CA3AF' : theme.colors.textMuted} />
                             <Text style={[styles.fieldLabel, isDark && styles.mutedTextDark]}>Password</Text>
                          </View>
                          <Text style={[styles.fieldValue, isDark && styles.textDark]}>********</Text>
                       </View>
                    </View>
                    
                    {status === 'loading' && <Text style={[styles.statusText, isDark && styles.mutedTextDark]}>Updating profile...</Text>}
                    {status === 'saving' && <Text style={[styles.statusText, isDark && styles.mutedTextDark]}>Saving changes...</Text>}
                  </View>
                </View>

              </View>
              <AppFooter bottomFill={24} />
            </ScrollView>
          </View>
          
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
          <ConfirmDialog
            visible={leaveVisible}
            title="Discard changes?"
            message="You have unsaved profile changes. Do you want to discard them and leave this page?"
            confirmText="Discard & leave"
            cancelText="Stay"
            destructive
            onCancel={() => {
              pendingNavActionRef.current = null;
              setLeaveVisible(false);
            }}
            onConfirm={() => {
              setLeaveVisible(false);
              setIsEditing(false);
              setDraftDirty(false);
              draftInitRef.current.loaded = false;
              try {
                if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem('agrix_profile_draft');
              } catch (_err) {}
              const action = pendingNavActionRef.current;
              pendingNavActionRef.current = null;
              if (action) navigation.dispatch(action);
            }}
          />
          <OtpUpdateModal
            visible={otpModalVisible}
            onClose={() => setOtpModalVisible(false)}
            step={otpStep}
            type={otpType}
            value={otpValue}
            onChangeValue={setOtpValue}
            otp={otpCode}
            onChangeOtp={setOtpCode}
            onAction={otpStep === 'request' ? handleRequestOtp : handleVerifyOtp}
            error={otpError}
            loading={otpLoading}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            isCountryOpen={isCountryOpen}
            setIsCountryOpen={setIsCountryOpen}
            countryOptions={countryOptions}
            phoneRules={phoneRules}
          />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  bgDark: {
    backgroundColor: '#020617',
  },
  bgOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    position: 'relative',
  },
  topNavbar: {
    height: 72,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    zIndex: 300,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
      },
    }),
  },
  navbarLogo: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  hamburgerContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    padding: 5,
  },
  hamburgerLine: {
    height: 3,
    backgroundColor: '#fff',
    marginVertical: 3,
    borderRadius: 2,
    width: '100%',
  },
  sidebar: {
    width: 250,
    backgroundColor: theme.colors.brandDark,
    position: 'absolute',
    top: 72,
    right: 0,
    zIndex: 200,
    borderBottomLeftRadius: theme.radius.md,
    borderBottomRightRadius: theme.radius.md,
    ...theme.shadows.medium,
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 72,
        right: 0,
      },
    }),
  },
  sidebarContent: {
    width: 250,
    height: '100%',
    padding: theme.space.lg,
    justifyContent: 'space-between',
  },
  sidebarMenu: {
    paddingHorizontal: 0,
  },
  sidebarItem: {
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: theme.space.lg,
  },
  sidebarText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '500',
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
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)',
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
  
  // Hero Section
  heroSection: {
    backgroundColor: theme.colors.brand,
    paddingTop: 100,
    paddingBottom: 72,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroSectionDark: {
    backgroundColor: '#0B1220',
  },
  heroContent: {
    alignItems: 'center',
    gap: 16,
  },
  heroAvatarBtn: {
    position: 'relative',
    ...theme.shadows.medium,
    borderRadius: 60,
  },
  heroAvatarImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  heroAvatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.brandDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  heroAvatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: theme.colors.brandDark,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroText: {
    alignItems: 'center',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 10,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Main Content
  contentContainer: {
    padding: 32,
    marginTop: -48, // Overlap hero
  },
  contentContainerCompact: {
    padding: 16,
    marginTop: -32,
  },
  mainGrid: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  mainGridCompact: {
    flexDirection: 'column',
    gap: 24,
  },
  
  // Details Card
  detailsCard: {
    width: '100%',
    maxWidth: 920,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.radius.card,
    padding: 32,
    ...theme.shadows.medium,
    minHeight: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  detailsCardCompact: {
    width: '100%',
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardTitleDark: {
    color: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: '#1F2937',
  },
  mutedTextDark: {
    color: '#9CA3AF',
  },
  textDark: {
    color: '#F9FAFB',
  },
  inputDark: {
    backgroundColor: '#0B1220',
    borderColor: '#374151',
    color: '#F9FAFB',
  },
  editBtnDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
    borderColor: '#1F2937',
  },
  secondaryBtnDark: {
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
    borderColor: '#1F2937',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
  },
  fieldsGridCompact: {
    flexDirection: 'column',
    gap: 24,
  },
  fieldItem: {
    width: '45%',
    minWidth: 240,
    flexGrow: 1,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
    paddingLeft: 22,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 22,
  },
  changeLink: {
    fontSize: 13,
    color: theme.colors.brand,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    marginLeft: 22,
    color: theme.colors.text,
  },
  nameInputs: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 22,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginLeft: 22,
  },
  genderChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  genderChipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  genderChipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  genderChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statusText: {
    marginTop: 24,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },

  // Right Column
  widgetsColumn: {
    flex: 1,
    gap: 32,
    minWidth: 300,
  },
  widgetsColumnCompact: {
    width: '100%',
  },
  widgetCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: theme.radius.card,
    padding: 24,
    ...theme.shadows.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  statsList: {
    gap: 20,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 64,
  },
  placeholderText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    marginBottom: 16,
    fontWeight: '600',
  },
  
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalContent: {
    width: '90%',
    maxWidth: 440,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.radius.card,
    padding: 32,
    ...theme.shadows.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
  },
  modalText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    color: theme.colors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
  },
  modalBtnTextCancel: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  modalBtnConfirm: {
    backgroundColor: theme.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
  },
  modalBtnTextConfirm: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
  phoneRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  countryButton: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRightWidth: 0,
    borderTopLeftRadius: theme.radius.input,
    borderBottomLeftRadius: theme.radius.input,
    justifyContent: 'center',
  },
  countryButtonText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  countryDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: 250,
    maxHeight: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    zIndex: 100,
    ...theme.shadows.medium,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  countryDropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    padding: 10,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  countryDropdownScroll: {
    maxHeight: 180,
  },
  countryOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  countryOptionSelected: {
    backgroundColor: theme.colors.brandLight,
  },
  countryOptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  countryOptionTextSelected: {
    fontWeight: '600',
    color: theme.colors.brandDark,
  },
});
