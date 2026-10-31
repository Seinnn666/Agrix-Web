import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HoverPressable from '../components/HoverPressable';
import ConfirmDialog from '../components/ConfirmDialog';
import ScreenTransition from '../components/ScreenTransition';
import { clearAdminAuth, deleteAdminUser, hasAdminPanelAccess, listAdminUsers, loadAdminAuth, updateAdminUser } from '../lib/adminApi';
import { logAdminActivity } from '../lib/adminActivity';
import { validateAddress, validateDateOfBirth, validateEmail, validateGender, validateName } from '../lib/validation';
import AdminUsersList from '../components/admin/AdminUsersList';
import AdminUserEditModal from '../components/admin/AdminUserEditModal';
import { adminUsersStyles as styles } from '../components/admin/adminUsersStyles';

function confirmDeleteUser(email, onConfirm) {
  const msg = `Delete user ${email || ''}? This cannot be undone.`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const ok = window.confirm(msg);
    if (ok) onConfirm();
    return;
  }
  onConfirm();
}

function confirmRoleChange(email, toAdmin, onConfirm) {
  const label = toAdmin ? 'promote' : 'remove admin from';
  const msg = `Confirm: ${label} ${email || ''}?`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const ok = window.confirm(msg);
    if (ok) onConfirm();
    return;
  }
  onConfirm();
}

export default function AdminUsersScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: 'rather_not_say',
    role: 'farmer',
  });
  const [logoutVisible, setLogoutVisible] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = async ({ nextPage, nextQ } = {}) => {
    try {
      setError('');
      setStatus('loading');
      const p = nextPage || page;
      const query = typeof nextQ === 'string' ? nextQ : q;
      const data = await listAdminUsers({ page: p, pageSize, q: query });
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setStatus('ready');
    } catch (err) {
      if (err?.code === 'SESSION_EXPIRED' || err?.code === 'UNAUTHORIZED') {
        clearAdminAuth();
        navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
        return;
      }
      if (err?.code === 'FORBIDDEN') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
        return;
      }
      setStatus('error');
      setError(err?.message || 'Failed to load users');
    }
  };

  useEffect(() => {
    if (!hasAdminPanelAccess()) {
      navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
      return;
    }
    load();
  }, []);

  useEffect(() => {
    load();
  }, [page]);

  const visibleItems = useMemo(() => items, [items]);

  const startEdit = (u) => {
    setEditing(u);
    const role = String(u?.role || '').trim().toLowerCase();
    setDraft({
      firstName: String(u?.firstName || ''),
      lastName: String(u?.lastName || ''),
      email: String(u?.email || ''),
      phone: String(u?.phone || ''),
      address: String(u?.address || ''),
      dateOfBirth: String(u?.dateOfBirth || ''),
      gender: String(u?.gender || 'rather_not_say'),
      role: role === 'admin' || role === 'farm_owner' || role === 'farmer' ? role : u?.isAdmin ? 'admin' : 'farmer',
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setError('');
  };

  const saveEdit = async () => {
    if (!editing?.id) return;

    const fn = validateName(draft.firstName, 'First name');
    if (!fn.ok) {
      setError(fn.message);
      return;
    }
    const ln = validateName(draft.lastName, 'Last name');
    if (!ln.ok) {
      setError(ln.message);
      return;
    }
    const em = validateEmail(draft.email);
    if (!em.ok) {
      setError('Invalid email address');
      return;
    }
    // Phone validation is optional or checked by backend, but we can do basic check
    if (draft.phone && draft.phone.length < 5) {
      setError('Phone number is too short');
      return;
    }
    if (draft.address) {
      const ad = validateAddress(draft.address);
      if (!ad.ok) {
        setError(ad.message);
        return;
      }
    }
    if (draft.dateOfBirth) {
      const dob = validateDateOfBirth(draft.dateOfBirth);
      if (!dob.ok) {
        setError(dob.message);
        return;
      }
    }
    const gn = validateGender(draft.gender);
    if (!gn.ok) {
      setError(gn.message);
      return;
    }

    const nextRoleRaw = String(draft.role || '').trim().toLowerCase();
    const nextRole =
      nextRoleRaw === 'admin' || nextRoleRaw === 'farmer' || nextRoleRaw === 'farm_owner' || nextRoleRaw === 'farm owner'
        ? nextRoleRaw === 'farm owner'
          ? 'farm_owner'
          : nextRoleRaw
        : '';
    if (!nextRole) {
      setError('Role must be: admin, farm_owner, or farmer');
      return;
    }

    try {
      setError('');
      setStatus('saving');
      const data = await updateAdminUser(editing.id, {
        firstName: fn.value,
        lastName: ln.value,
        email: em.value,
        phone: draft.phone,
        address: draft.address ? validateAddress(draft.address).value : '',
        dateOfBirth: draft.dateOfBirth ? validateDateOfBirth(draft.dateOfBirth).value : '',
        gender: gn.value,
        role: nextRole,
      });
      const updated = data?.user;
      setItems((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      logAdminActivity({
        type: 'user_update',
        message: `Updated user ${updated?.email || editing?.email || ''}`,
      });
      setEditing(null);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Failed to update user');
    }
  };

  const handleDelete = async (u) => {
    if (!u?.id) return;
    confirmDeleteUser(u.email, async () => {
      try {
        setError('');
        setStatus('deleting');
        await deleteAdminUser(u.id);
        setItems((prev) => prev.filter((x) => x.id !== u.id));
        setTotal((t) => Math.max(0, t - 1));
        logAdminActivity({ type: 'user_delete', message: `Deleted user ${u?.email || ''}` });
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err?.message || 'Failed to delete user');
      }
    });
  };

  const handleToggleAdmin = async (u) => {
    if (!u?.id) return;
    const next = !u.isAdmin;
    confirmRoleChange(u.email, next, async () => {
      try {
        setError('');
        setStatus('saving');
        const nextRole = next ? 'admin' : String(u?.role || '') === 'farm_owner' ? 'farm_owner' : 'farmer';
        const data = await updateAdminUser(u.id, { role: nextRole, isAdmin: next });
        const updated = data?.user;
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        if (editing?.id === updated.id) setEditing(updated);
        logAdminActivity({
          type: 'admin_access_change',
          message: `${next ? 'Promoted' : 'Removed admin from'} ${updated?.email || u?.email || ''}`,
        });
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err?.message || 'Failed to update admin access');
      }
    });
  };

  const backToDashboard = () => {
    navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
  };

  const endAdminSession = () => {
    setLogoutVisible(true);
  };
  const confirmEndAdminSession = () => {
    setLogoutVisible(false);
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
  };

  const hasAdminSession = Boolean(loadAdminAuth().token);

  const runSearch = () => {
    const nextQ = String(q || '').trim();
    setPage(1);
    load({ nextPage: 1, nextQ });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>User Management</Text>
        <View style={styles.topBarActions}>
          <HoverPressable style={styles.backButton} onPress={backToDashboard}>
            <Text style={styles.backText}>Back</Text>
          </HoverPressable>
          <HoverPressable style={styles.refreshButton} onPress={() => load()}>
            <Text style={styles.refreshText}>Refresh</Text>
          </HoverPressable>
          {hasAdminSession ? (
            <HoverPressable style={styles.logoutButton} onPress={endAdminSession}>
              <Text style={styles.logoutText}>End Admin Session</Text>
            </HoverPressable>
          ) : null}
        </View>
      </View>
      <ConfirmDialog
        visible={logoutVisible}
        title="End admin session"
        message="Are you sure you want to log out of the admin session?"
        confirmText="Log out"
        cancelText="Cancel"
        destructive
        onCancel={() => setLogoutVisible(false)}
        onConfirm={confirmEndAdminSession}
      />

      <View style={styles.filtersRow}>
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search by email or name"
          autoCapitalize="none"
          onSubmitEditing={runSearch}
        />
        <HoverPressable style={styles.searchButton} onPress={runSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </HoverPressable>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <AdminUsersList
        isCompact={isCompact}
        items={visibleItems}
        status={status}
        onEdit={startEdit}
        onDelete={handleDelete}
        onToggleAdmin={handleToggleAdmin}
      />

      <View style={styles.pagination}>
        <HoverPressable
          style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
          disabled={page <= 1}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
        >
          <Text style={styles.pageButtonText}>Previous</Text>
        </HoverPressable>
        <Text style={styles.pageText}>
          Page {page} of {totalPages}
        </Text>
        <HoverPressable
          style={[styles.pageButton, page >= totalPages && styles.pageButtonDisabled]}
          disabled={page >= totalPages}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <Text style={styles.pageButtonText}>Next</Text>
        </HoverPressable>
      </View>

      <AdminUserEditModal
        user={editing}
        draft={draft}
        setDraft={setDraft}
        onSave={saveEdit}
        onCancel={cancelEdit}
        isSaving={status === 'saving'}
        error={error}
      />
    </SafeAreaView>
  );
}
