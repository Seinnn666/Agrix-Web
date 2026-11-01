import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions, TouchableOpacity } from 'react-native';
import HoverPressable from '../components/HoverPressable';
import ConfirmDialog from '../components/ConfirmDialog';
import ScreenTransition from '../components/ScreenTransition';
import { clearAdminAuth, getAdminMetrics, hasAdminPanelAccess } from '../lib/adminApi';
import { adminDashboardStyles as styles } from '../components/admin/adminDashboardStyles';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  BarChart2,
  Menu,
  Bell,
  User,
} from '../components/Icons';
import AgriXLogo from '../components/AgriXLogo';
import { theme } from '../ui/theme';
import { getAdminActivityUnreadCount } from '../lib/adminActivity';
import { getUnreadAdminNotificationsCount } from '../lib/notifications';
import { useFocusEffect } from '@react-navigation/native';
import { clearAuth } from '../lib/authApi';

export default function AdminDashboardScreen({ navigation }) {
  const [error, setError] = useState('');
  const [data, setData] = useState({ metrics: null, recentUsers: [] });
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [adminUnread, setAdminUnread] = useState(() => getAdminActivityUnreadCount() + getUnreadAdminNotificationsCount());

  const formatJoinedDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '—';
  };

  useFocusEffect(React.useCallback(() => {
    setAdminUnread(getAdminActivityUnreadCount() + getUnreadAdminNotificationsCount());
  }, []));

  const metrics = data.metrics || {
    totalUsers: 0,
    totalAdmins: 0,
    emailVerified: 0,
    phoneVerified: 0,
  };

  const load = async () => {
    if (!hasAdminPanelAccess()) {
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
      return;
    }
    try {
      setError('');
      const res = await getAdminMetrics();
      setData({
        metrics: res?.metrics || null,
        recentUsers: Array.isArray(res?.recentUsers) ? res.recentUsers : [],
      });
    } catch (err) {
      if (err?.code === 'UNAUTHORIZED' || err?.code === 'SESSION_EXPIRED') {
        await clearAuth();
        clearAdminAuth();
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      if (err?.code === 'FORBIDDEN') {
        await clearAuth();
        clearAdminAuth();
        navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
        return;
      }
      setError(err?.message || 'Failed to load admin dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const confirmEndAdminSession = async () => {
    setLogoutVisible(false);
    await clearAuth();
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  };

  const navigateFromMenu = (routeName) => {
    setMenuOpen(false);
    navigation.navigate(routeName);
  };

  const Sidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.logoText}>AGRIX <Text style={{ color: theme.colors.brand }}>ADMIN</Text></Text>
        <Text style={styles.subLogoText}>Control Panel</Text>
      </View>

      <View style={styles.menuItems}>
        <HoverPressable style={[styles.menuItem, styles.menuItemActive]} onPress={() => {}}>
          <LayoutDashboard size={20} color={theme.colors.brand} />
          <Text style={[styles.menuText, styles.menuTextActive]}>Dashboard</Text>
        </HoverPressable>
        
        <HoverPressable style={styles.menuItem} onPress={() => navigation.navigate('AdminUsers')}>
          <Users size={20} color={theme.colors.textMuted} />
          <Text style={styles.menuText}>User Management</Text>
        </HoverPressable>

      </View>
    </View>
  );

  return (
    <View style={[styles.container, { position: 'relative' }]}>
      <View style={styles.mainLayout}>
        {!isMobile && <Sidebar />}

        <View style={styles.contentArea}>
          {/* Top Header */}
          <View style={[styles.topHeader, isMobile && { paddingHorizontal: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <HoverPressable style={styles.actionButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] })}>
                  <Text style={styles.actionButtonText}>Back</Text>
                </HoverPressable>
                <Text style={styles.pageTitle}>Overview</Text>
              </View>
            </View>
            
            <View style={[styles.headerActions, isMobile && { gap: 8 }]}>
               <AgriXLogo onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] })} variant="navbar" scale={0.9} />
               {!isMobile ? (
                 <>
                   <HoverPressable style={styles.actionButton} onPress={load}>
                     <Text style={styles.actionButtonText}>Refresh Data</Text>
                   </HoverPressable>
                   <View style={{ width: 1, height: 24, backgroundColor: theme.colors.border }} />
                 </>
               ) : null}
               <HoverPressable style={styles.actionButton} onPress={() => navigation.navigate('Notifications', { audience: 'admin' })}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                   <Bell size={20} color={theme.colors.textMuted} />
                   {adminUnread > 0 ? <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>{adminUnread}</Text> : null}
                 </View>
               </HoverPressable>
               {!isMobile ? (
                 <HoverPressable style={styles.actionButton} onPress={() => navigation.navigate('AdminProfile')} accessibilityLabel="My profile">
                   <User size={20} color={theme.colors.textMuted} />
                 </HoverPressable>
               ) : null}
               <HoverPressable
                 style={styles.actionButton}
                 onPress={() => setMenuOpen((open) => !open)}
                 accessibilityRole="button"
                 accessibilityLabel="Open admin menu"
                 accessibilityState={{ expanded: menuOpen }}
               >
                 <Menu size={20} color={theme.colors.textMuted} />
               </HoverPressable>
            </View>
          </View>

          <ScreenTransition type="slideRight" style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome back, Admin</Text>
              <Text style={styles.welcomeSubtitle}>
                Here's what's happening with your platform today. 
                Manage users, track growth, and ensure system health.
              </Text>
            </View>

            {!!error && (
              <View style={{ padding: 16, backgroundColor: theme.colors.dangerLight, borderRadius: 8, marginBottom: 20 }}>
                <Text style={{ color: theme.colors.danger, fontWeight: 'bold' }}>{error}</Text>
              </View>
            )}

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>Total Users</Text>
                  <Users size={20} color={theme.colors.brand} />
                </View>
                <Text style={styles.metricValue}>{metrics.totalUsers}</Text>
                <Text style={styles.metricTrend}>All registered accounts</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>Administrators</Text>
                  <Settings size={20} color={theme.colors.accentTeal} />
                </View>
                <Text style={styles.metricValue}>{metrics.totalAdmins}</Text>
                <Text style={[styles.metricTrend, { color: theme.colors.accentTeal }]}>System managers</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>Verified Emails</Text>
                  <BarChart2 size={20} color={theme.colors.brand} />
                </View>
                <Text style={styles.metricValue}>{metrics.emailVerified}</Text>
                <Text style={styles.metricTrend}>
                  {metrics.totalUsers > 0 
                    ? `${Math.round((metrics.emailVerified / metrics.totalUsers) * 100)}% verification rate` 
                    : '0% verification rate'}
                </Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>Verified Phones</Text>
                  <BarChart2 size={20} color={theme.colors.brand} />
                </View>
                <Text style={styles.metricValue}>{metrics.phoneVerified}</Text>
                <Text style={styles.metricTrend}>
                   {metrics.totalUsers > 0 
                    ? `${Math.round((metrics.phoneVerified / metrics.totalUsers) * 100)}% verification rate` 
                    : '0% verification rate'}
                </Text>
              </View>
            </View>

            {/* Recent Activity / Users */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Users</Text>
              <HoverPressable onPress={() => navigation.navigate('AdminUsers')}>
                <Text style={styles.viewAllLink}>View All Users →</Text>
              </HoverPressable>
            </View>

            <View style={styles.recentTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 2 }]}>User</Text>
                <Text style={[styles.headerCell, { flex: 1.5 }]}>Account</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Status</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>Joined</Text>
              </View>
              
              {data.recentUsers.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textMuted }}>No users found.</Text>
                </View>
              ) : (
                data.recentUsers.map((user) => (
                  <View key={user.id} style={styles.tableRow}>
                    <View style={[styles.cell, { flex: 2 }]}>
                      <Text style={{ fontWeight: '600', color: theme.colors.text }}>
                        {user.fullName || [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' ').trim() || user.name || 'Unnamed'}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>{user.email}</Text>
                    </View>
                    <View style={[styles.cell, { flex: 1.5 }]}>
                      <Text style={{ fontSize: 13, color: theme.colors.text }}>
                        {user.isAdmin || String(user.role || '').toLowerCase() === 'admin' ? 'Administrator' : 'User'}
                      </Text>
                    </View>
                    <View style={[styles.cell, { flex: 1 }]}>
                       <View style={{ 
                         flexDirection: 'row', 
                         alignItems: 'center', 
                         backgroundColor: user.emailVerified ? 'rgba(46, 125, 50, 0.1)' : 'rgba(0,0,0,0.05)',
                         alignSelf: 'flex-start',
                         paddingHorizontal: 8,
                         paddingVertical: 2,
                         borderRadius: 12
                       }}>
                         <View style={{ 
                           width: 6, 
                           height: 6, 
                           borderRadius: 3, 
                           backgroundColor: user.emailVerified ? theme.colors.brand : theme.colors.textMuted,
                           marginRight: 6
                         }} />
                         <Text style={{ 
                           fontSize: 12, 
                           fontWeight: '600', 
                           color: user.emailVerified ? theme.colors.brand : theme.colors.textMuted 
                         }}>
                           {user.emailVerified ? 'Verified' : 'Pending'}
                         </Text>
                       </View>
                    </View>
                    <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                      <Text style={{ fontSize: 13, color: theme.colors.textMuted }}>
                        {formatJoinedDate(user.createdAt || user.created_at || user.joinedAt || user.joined_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
          </ScreenTransition>
        </View>
      </View>

      {menuOpen ? (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close admin menu"
          />
          <View style={styles.userMenuDropdown}>
            {isMobile ? (
              <>
                <HoverPressable style={styles.dropdownItem} onPress={() => navigateFromMenu('AdminDashboard')}>
                  <LayoutDashboard size={18} color={theme.colors.textMuted} />
                  <Text style={styles.dropdownItemText}>Admin Dashboard</Text>
                </HoverPressable>
                <HoverPressable style={styles.dropdownItem} onPress={() => navigateFromMenu('AdminUsers')}>
                  <Users size={18} color={theme.colors.textMuted} />
                  <Text style={styles.dropdownItemText}>User Management</Text>
                </HoverPressable>
                <View style={styles.dropdownDivider} />
              </>
            ) : null}
            <HoverPressable style={styles.dropdownItem} onPress={() => navigateFromMenu('AdminProfile')}>
              <Settings size={18} color={theme.colors.textMuted} />
              <Text style={styles.dropdownItemText}>My Profile & Settings</Text>
            </HoverPressable>
            <View style={styles.dropdownDivider} />
            <HoverPressable
              style={styles.dropdownItem}
              onPress={() => { setMenuOpen(false); setLogoutVisible(true); }}
            >
              <LogOut size={18} color={theme.colors.danger} />
              <Text style={[styles.dropdownItemText, { color: theme.colors.danger }]}>Logout</Text>
            </HoverPressable>
          </View>
        </>
      ) : null}

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
    </View>
  );
}
