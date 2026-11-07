import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearAdminAuth, getAdminProfile, updateAdminProfile } from '../lib/adminApi';
import { clearAuth } from '../lib/authApi';
import HoverPressable from '../components/HoverPressable';
import AppFooter from '../components/AppFooter';
import DateOfBirthPicker from '../components/DateOfBirthPicker';

import { theme } from '../ui/theme';
import { validateActiveEmail } from '../lib/validation';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
    paddingTop: 80,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.soft,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    fontFamily: Platform.OS === 'web' ? 'Segoe UI, sans-serif' : undefined,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  mainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    marginHorizontal: 20,
    borderRadius: theme.radius.card,
    padding: 32,
    marginBottom: 40,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -10,
  },
  col: {
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  col12: { width: '100%' },
  col6: { width: '50%', minWidth: 300 },
  
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: theme.radius.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  inputWrapperActive: {
    borderColor: theme.colors.brand,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  inputWrapperError: {
    borderColor: theme.colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: '100%',
  },
  readOnlyText: {
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: theme.radius.input,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  errorBox: {
    backgroundColor: theme.colors.errorBg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
    padding: 12,
    marginBottom: 24,
    borderRadius: 4,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  fieldError: {
    marginTop: 6,
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  editButton: {
    backgroundColor: theme.colors.brand,
    ...theme.shadows.soft,
  },
  saveButton: {
    backgroundColor: theme.colors.brand,
    ...theme.shadows.soft,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  textWhite: { color: theme.colors.surface },
  textDark: { color: theme.colors.text },

  // Gender selector
  genderContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  genderOptionActive: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.brandLight,
  },
  genderText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'capitalize',
  },
  genderTextActive: {
    color: theme.colors.brandDark,
  },
});

export default function AdminProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminProfile();
      setUser(data);
      resetForm(data);
    } catch (err) {
      if (err?.code === 'UNAUTHORIZED' || err?.code === 'SESSION_EXPIRED' || err?.code === 'FORBIDDEN') {
        await clearAuth();
        clearAdminAuth();
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (data) => {
    setFormData({
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
      gender: data.gender || 'rather_not_say',
    });
  };

  const age = useMemo(() => {
    if (!user?.dateOfBirth) return 'N/A';
    const dob = new Date(user.dateOfBirth);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }, [user]);

  const handleSave = async () => {
    const emailValidation = validateActiveEmail(formData.email);
    if (!emailValidation.ok) {
      setFieldErrors({ email: emailValidation.message });
      setError('');
      return;
    }
    setFieldErrors({});
    try {
      setError('');
      setSaving(true);

      // Simple Name Validation
      if (formData.firstName.trim().length < 2) throw new Error('First Name is too short');
      if (formData.lastName.trim().length < 2) throw new Error('Last Name is too short');

      // Phone validation
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (formData.phone && (cleanPhone.length < 7 || cleanPhone.length > 15)) {
         throw new Error('Invalid phone number length');
      }

      const patch = { ...formData };
      
      const updated = await updateAdminProfile(patch);
      setUser(updated);
      setIsEditing(false);
    } catch (err) {
      if (err?.fieldErrors?.email) {
        setFieldErrors({ email: err.fieldErrors.email });
        setError('');
        return;
      }
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = (text) => {
    // 1. Remove all non-numeric characters except leading '+'
    let val = text.replace(/[^0-9+]/g, '');
    
    // 2. Ensure '+' is only at the beginning
    if (val.includes('+')) {
      const hasPlus = val.startsWith('+');
      val = val.replace(/\+/g, '');
      if (hasPlus) val = '+' + val;
    }

    // 3. Determine Max Length based on Country Code
    let limit = 15; // Default E.164 max length
    
    if (val.startsWith('+63')) {
      limit = 13; // +63 9xx xxx xxxx
    } else if (val.startsWith('+1')) {
      limit = 12; // +1 xxx xxx xxxx
    } else if (val.startsWith('+44')) {
      limit = 13; // +44 7xxx xxx xxx
    } else if (val.startsWith('+91')) {
      limit = 13; // +91 9xxx xxx xxx
    } else if (val.startsWith('+61')) {
      limit = 12; // +61 4xx xxx xxx
    } else if (val.startsWith('09')) {
      // Philippines local format fallback
      limit = 11; 
    }

    if (val.length > limit) {
      val = val.slice(0, limit);
    }

    setFormData((prev) => ({ ...prev, phone: val }));
  };

  const handleFieldChange = (key, text) => {
    setFormData((prev) => ({ ...prev, [key]: text }));
    if (key === 'email') {
      const validation = validateActiveEmail(text);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (!text.trim() || validation.ok) delete next.email;
        else next.email = validation.message;
        return next;
      });
    }
  };

  const renderInput = (label, key, placeholder, widthStyle = styles.col6, keyboardType = 'default', customOnChange = null) => {
    const isEdit = isEditing;
    const value = formData[key];
    const maxLength = key === 'firstName' || key === 'lastName' ? 35 : undefined;

    return (
      <View style={[styles.col, widthStyle]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isEdit ? (
          <>
            <View style={[styles.inputWrapper, styles.inputWrapperActive, fieldErrors[key] && styles.inputWrapperError]}>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={customOnChange || ((text) => handleFieldChange(key, text))}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted}
                keyboardType={keyboardType}
                autoCapitalize={key === 'email' ? 'none' : undefined}
                autoComplete={key === 'email' ? 'email' : undefined}
                onBlur={key === 'email' ? () => {
                  const validation = validateActiveEmail(formData.email);
                  setFieldErrors((prev) => ({ ...prev, ...(validation.ok ? { email: undefined } : { email: validation.message }) }));
                } : undefined}
                maxLength={maxLength}
              />
            </View>
            {!!fieldErrors[key] && <Text style={styles.fieldError}>{fieldErrors[key]}</Text>}
          </>
        ) : (
          <Text style={styles.readOnlyText}>{user?.[key] || 'Not set'}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Admin Portal</Text>
          <HoverPressable style={styles.backButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] })}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </HoverPressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.mainCard}>
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>My Profile</Text>
              {!isEditing && (
                  <HoverPressable 
                    style={[styles.button, styles.editButton]} 
                    onPress={() => setIsEditing(true)}
                  >
                    <Text style={[styles.buttonText, styles.textWhite]}>Edit Profile</Text>
                  </HoverPressable>
                )}
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.grid}>
                {renderInput('First Name', 'firstName', 'Enter first name')}
                {renderInput('Last Name', 'lastName', 'Enter last name')}
                
                {renderInput('Email Address', 'email', 'name@example.com', styles.col6, 'email-address')}
                {renderInput('Phone Number', 'phone', '+63 9...', styles.col6, 'phone-pad', handlePhoneChange)}
                
                {renderInput('Address', 'address', 'Full address', styles.col12)}

                {/* DOB and Age */}
                <View style={[styles.col, styles.col6]}>
                   <Text style={styles.fieldLabel}>Date of Birth</Text>
                   {isEditing ? (
                     <DateOfBirthPicker
                        value={formData.dateOfBirth}
                        onChange={(text) => setFormData({ ...formData, dateOfBirth: text })}
                     />
                   ) : (
                     <Text style={styles.readOnlyText}>{user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : 'Not set'}</Text>
                   )}
                </View>

                <View style={[styles.col, styles.col6]}>
                  <Text style={styles.fieldLabel}>Age</Text>
                  <Text style={[styles.readOnlyText, { 
                    backgroundColor: theme.colors.brandLight, 
                    borderColor: theme.colors.brand, 
                    color: theme.colors.brandDark 
                  }]}>
                    {age} Years Old
                  </Text>
                </View>

                {/* Gender */}
                <View style={[styles.col, styles.col12]}>
                  <Text style={styles.fieldLabel}>Sex</Text>
                  {isEditing ? (
                    <View style={styles.genderContainer}>
                      {['male', 'female', 'rather_not_say'].map((g) => (
                        <TouchableOpacity
                          key={g}
                          onPress={() => setFormData({ ...formData, gender: g })}
                          style={[
                            styles.genderOption,
                            formData.gender === g && styles.genderOptionActive
                          ]}
                        >
                          <Text style={[
                            styles.genderText,
                            formData.gender === g && styles.genderTextActive
                          ]}>
                            {g.replace(/_/g, ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.readOnlyText, { textTransform: 'capitalize' }]}>
                      {user?.gender ? user.gender.replace(/_/g, ' ') : 'Not set'}
                    </Text>
                  )}
                </View>
              </View>

              {isEditing && (
                <View style={[styles.actionButtons, { marginTop: 32 }]}>
                  <HoverPressable 
                    style={[styles.button, styles.cancelButton]} 
                    onPress={() => { setIsEditing(false); resetForm(user); setError(''); }}
                  >
                    <Text style={[styles.buttonText, styles.textDark]}>Cancel</Text>
                  </HoverPressable>
                  <HoverPressable 
                    style={[styles.button, styles.saveButton]} 
                    onPress={handleSave} 
                    disabled={saving}
                  >
                    <Text style={[styles.buttonText, styles.textWhite]}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </HoverPressable>
                </View>
              )}
          </View>
        </ScrollView>
        <AppFooter />
      </SafeAreaView>
    </View>
  );
}
