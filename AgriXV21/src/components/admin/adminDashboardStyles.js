import { Platform, StyleSheet } from 'react-native';
import { theme } from '../../ui/theme';

export const adminDashboardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    ...Platform.select({
      web: { minHeight: '100vh' },
    }),
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  // Sidebar Styles
  sidebar: {
    width: 260,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 24,
    display: 'flex',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  sidebarHeader: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.brandDark,
    letterSpacing: -0.5,
  },
  subLogoText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '700',
  },
  menuItems: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: theme.colors.brandLight,
  },
  menuText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  menuTextActive: {
    color: theme.colors.brandDark,
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  
  // Main Content Area
  contentArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  topHeader: {
    height: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
      },
    }),
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  
  // Dashboard Content
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 64,
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: -1,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    lineHeight: 24,
    maxWidth: 800,
  },
  
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 40,
  },
  metricCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: theme.radius.card,
    padding: 24,
    ...theme.shadows.soft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -1,
  },
  metricTrend: {
    fontSize: 14,
    color: theme.colors.brand,
    marginTop: 8,
    fontWeight: '600',
  },
  
  // Recent Activity Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  viewAllLink: {
    fontSize: 14,
    color: theme.colors.brand,
    fontWeight: '700',
  },
  recentTable: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: theme.radius.card,
    padding: 8,
    ...theme.shadows.soft,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: {
    justifyContent: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.brandDark,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  userDate: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  
  // Mobile Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 150,
  },
  mobileMenuButton: {
    marginRight: 16,
    padding: 8,
  },
});
