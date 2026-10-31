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

export default function AdminDashboardScreen({ navigation }) {
  const [error, setError] = useState('');
  const [data, setData] = useState({ metrics: null, recentUsers: [] });
  const [logoutVisible, setLogoutVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [adminUnread, setAdminUnread] = useState(() => getAdminActivityUnreadCount() + getUnreadAdminNotificationsCount());

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
      navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
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
        clearAdminAuth();
        navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
        return;
      }
      if (err?.code === 'FORBIDDEN') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
        return;
      }
      setError(err?.message || 'Failed to load admin dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Responsive sidebar handling
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const confirmEndAdminSession = () => {
    setLogoutVisible(false);
    clearAdminAuth();
    navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
  };

  const Sidebar = () => (
    <View style={[styles.sidebar, isMobile && { position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 200 }]}>
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

        <HoverPressable style={styles.menuItem} onPress={() => navigation.navigate('AdminProfile')}>
          <Settings size={20} color={theme.colors.textMuted} />
          <Text style={styles.menuText}>Settings & Profile</Text>
        </HoverPressable>
      </View>

      <View style={styles.sidebarFooter}>
        <HoverPressable 
          style={{ flexDirection: 'row', alignItems: 'center' }} 
          onPress={() => setLogoutVisible(true)}
        >
          <LogOut size={20} color={theme.colors.danger} />
          <Text style={{ color: theme.colors.danger, marginLeft: 12, fontWeight: '600' }}>Logout</Text>
        </HoverPressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isMobile && sidebarOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={() => setSidebarOpen(false)} 
        />
      )}

      <View style={styles.mainLayout}>
        {sidebarOpen && <Sidebar />}

        <View style={styles.contentArea}>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isMobile && (
                <HoverPressable onPress={() => setSidebarOpen(!sidebarOpen)} style={styles.mobileMenuButton}>
                  <Menu size={24} color={theme.colors.text} />
                </HoverPressable>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <HoverPressable style={styles.actionButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] })}>
                  <Text style={styles.actionButtonText}>Back</Text>
                </HoverPressable>
                <Text style={styles.pageTitle}>Overview</Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
               <AgriXLogo onPress={() => navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] })} variant="navbar" scale={0.9} />
               <HoverPressable style={styles.actionButton} onPress={load}>
                 <Text style={styles.actionButtonText}>Refresh Data</Text>
               </HoverPressable>
               <View style={{ width: 1, height: 24, backgroundColor: theme.colors.border }} />
               <HoverPressable style={styles.actionButton} onPress={() => navigation.navigate('Notifications', { audience: 'admin' })}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                   <Bell size={20} color={theme.colors.textMuted} />
                   {adminUnread > 0 ? <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>{adminUnread}</Text> : null}
                 </View>
               </HoverPressable>
               <HoverPressable style={styles.actionButton} onPress={() => navigation.navigate('AdminProfile')}>
                 <User size={20} color={theme.colors.textMuted} />
               </HoverPressable>
               <HoverPressable style={styles.actionButton} onPress={() => setSidebarOpen((v) => !v)}>
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
                <Text style={[styles.headerCell, { flex: 1.5 }]}>Role</Text>
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
                      <Text style={{ fontWeight: '600', color: theme.colors.text }}>{user.name || 'Unnamed'}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textMuted }}>{user.email}</Text>
                    </View>
                    <View style={[styles.cell, { flex: 1.5 }]}>
                      <Text style={{ fontSize: 13, color: theme.colors.text }}>
                        {String(user.role || '').toLowerCase() === 'farm_owner'
                          ? 'Farm Owner'
                          : user.isAdmin || String(user.role || '').toLowerCase() === 'admin'
                            ? 'Administrator'
                            : 'Farmer'}
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
                        {new Date(user.createdAt).toLocaleDateString()}
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
