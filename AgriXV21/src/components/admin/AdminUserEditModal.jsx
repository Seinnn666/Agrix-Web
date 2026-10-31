import React from 'react';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';
import HoverPressable from '../HoverPressable';
import DateOfBirthPicker from '../DateOfBirthPicker';
import { theme } from '../../ui/theme';
import { adminUsersStyles as styles } from './adminUsersStyles';

export default function AdminUserEditModal({ user, draft, setDraft, onSave, onCancel, isSaving, error }) {
  if (!user) return null;

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
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
      limit = 11; 
    }

    if (val.length > limit) {
      val = val.slice(0, limit);
    }
    
    setDraft((prev) => ({ ...prev, phone: val }));
  };

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <HoverPressable style={styles.modalBackdrop} onPress={onCancel} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit User</Text>
          <Text style={styles.modalSubtitle}>{user.email}</Text>

          <ScrollView style={{ maxHeight: 500, marginTop: 10 }}>
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Role</Text>
              <View style={styles.roleRow}>
                {[
                  { value: 'farmer', label: 'Farmer' },
                  { value: 'farm_owner', label: 'Farm Owner' },
                  { value: 'admin', label: 'Admin' },
                ].map((opt) => {
                  const active = String(draft.role || 'farmer') === opt.value;
                  return (
                    <HoverPressable
                      key={opt.value}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => handleChange('role', opt.value)}
                    >
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{opt.label}</Text>
                    </HoverPressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Email</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.email}
                onChangeText={(v) => handleChange('email', v)}
                placeholder="Email"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>First Name</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.firstName}
                onChangeText={(v) => handleChange('firstName', v)}
                placeholder="First Name"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={35}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Last Name</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.lastName}
                onChangeText={(v) => handleChange('lastName', v)}
                placeholder="Last Name"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={35}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Phone</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.phone}
                onChangeText={handlePhoneChange}
                placeholder="Phone"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.address}
                onChangeText={(v) => handleChange('address', v)}
                placeholder="Address"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Date of Birth</Text>
              <DateOfBirthPicker
                value={draft.dateOfBirth}
                onChange={(v) => handleChange('dateOfBirth', v)}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Gender</Text>
              <TextInput
                style={styles.modalInput}
                value={draft.gender}
                onChangeText={(v) => handleChange('gender', v)}
                placeholder="male, female, other, rather_not_say"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <HoverPressable style={styles.modalCancel} onPress={onCancel} disabled={isSaving}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </HoverPressable>
            <HoverPressable style={styles.modalSave} onPress={onSave} disabled={isSaving}>
              <Text style={styles.modalSaveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </HoverPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
