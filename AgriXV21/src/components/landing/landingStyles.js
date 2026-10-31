import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const isCompact = width <= 480;

export const colors = {
  primary: '#2E7D32', // Forest Green - kept for brand consistency
  primaryDark: '#1B5E20',
  secondary: '#81C784',
  accent: '#00695C', // Teal for tech/satellite
  textDark: '#111827', // Darker, more modern gray (Cool Gray 900)
  textLight: '#4B5563', // Cool Gray 600
  textMuted: '#9CA3AF', // Cool Gray 400
  white: '#FFFFFF',
  lightBg: '#F3F4F6', // Cool Gray 50
  borderColor: '#E5E7EB', // Cool Gray 200
  surface: '#FFFFFF',
  surfaceHighlight: '#F9FAFB',
};

export const landingStyles = StyleSheet.create({
  // Global
  container: {
    flex: 1,
    backgroundColor: colors.white,
    ...Platform.select({
      web: {
        transition: 'background-color 0.25s ease, color 0.25s ease',
      },
    }),
  },
  section: {
    paddingVertical: 96, // Increased spacing
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        transition: 'background-color 0.25s ease, color 0.25s ease',
      },
    }),
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: 42, // Larger
    marginBottom: 16,
    color: colors.textDark,
    fontWeight: '800',
    letterSpacing: -1,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },
  sectionLead: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 20,
    lineHeight: 32,
    maxWidth: 760,
    alignSelf: 'center',
    marginBottom: 64,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 9999, // Pill shape
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    ...Platform.select({
      web: {
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 6px -1px rgba(46, 125, 50, 0.2), 0 2px 4px -1px rgba(46, 125, 50, 0.1)',
      },
      android: { elevation: 4 },
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    }),
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  bgLight: {
    backgroundColor: colors.lightBg,
    ...Platform.select({
      web: {
        transition: 'background-color 0.25s ease',
      },
    }),
  },
  highlight: {
    color: colors.primary,
  },

  // Navbar
  navbar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Glass-like
    height: 80,
    width: '100%',
    zIndex: 1000,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  navContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: -1,
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
  themeToggle: {
    padding: 8,
    borderRadius: 9999,
    backgroundColor: colors.lightBg,
    ...Platform.select({
      web: {
        transition:
          'transform 0.3s cubic-bezier(0.22,0.61,0.36,1), ' +
          'background-color 0.3s cubic-bezier(0.22,0.61,0.36,1), ' +
          'box-shadow 0.3s cubic-bezier(0.22,0.61,0.36,1)',
      },
    }),
  },
  navLink: {
    fontSize: 15,
    color: colors.textLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuToggle: {
    padding: 8,
  },
  navMenuMobile: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  mobileNavItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBg,
  },

  // Hero
  hero: {
    width: '100%',
    height: Math.min(height, 800), // Taller hero
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Slightly darker
    ...Platform.select({
      web: {
        transition: 'background-color 0.25s ease',
      },
    }),
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 1000,
  },
  heroTitle: {
    fontSize: 64,
    fontWeight: '900',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 72,
    letterSpacing: -2,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  heroText: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 34,
    maxWidth: 720,
    fontWeight: '500',
  },
  heroBullets: {
    width: '100%',
    maxWidth: 720,
    gap: 12,
    marginBottom: 28,
    alignSelf: 'center',
  },
  heroBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  heroBulletDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    marginTop: 7,
  },
  heroBulletText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    maxWidth: 560,
    textAlign: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    ...Platform.select({
      web: {
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
      },
      android: { elevation: 3 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 },
    }),
  },
  heroBtnSecondaryText: {
    color: colors.textDark,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  heroTrust: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  howSection: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 20,
  },
  howTitle: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '900',
    color: colors.textDark,
    letterSpacing: -0.8,
    marginBottom: 18,
  },
  howGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  howCard: {
    flexGrow: 1,
    minWidth: 260,
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderColor,
    padding: 18,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
      },
      android: { elevation: 3 },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 14 },
    }),
  },
  howCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  howCardText: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Services
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
  },
  serviceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    width: '100%',
    maxWidth: 360,
    padding: 40,
    borderRadius: 24,
    alignItems: 'flex-start', // Left align for modern feel
    borderWidth: 1,
    borderColor: colors.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.08)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      },
    }),
  },
  serviceIcon: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.lightBg, // Subtle background
    borderRadius: 16, // Squircle
    color: colors.primary,
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    color: colors.textDark,
    textAlign: 'left',
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },
  serviceText: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'left',
    lineHeight: 26,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },

  // Feature Grid (360 Workflow)
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
  },
  featureCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
    }),
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: colors.textDark,
  },
  featureText: {
    fontSize: 15,
    color: colors.textLight,
    lineHeight: 24,
  },

  // Data Maps
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
  },
  mapCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderColor,
    // Modern accent
    borderLeftWidth: 0,
    borderTopWidth: 4,
    borderTopColor: colors.accent,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      },
    }),
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: colors.textDark,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },
  mapText: {
    fontSize: 16,
    color: colors.textLight,
    lineHeight: 26,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },

  // CTA
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 64,
    flexWrap: 'wrap',
  },

  // About
  aboutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 80,
  },
  aboutImageContainer: {
    flex: 1,
    maxWidth: 500,
    alignItems: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
       web: { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
       ios: { shadowOpacity: 0.2, shadowRadius: 20 },
    }),
  },
  aboutImage: {
    width: '100%',
    height: 360,
  },
  aboutContent: {
    flex: 1,
    maxWidth: 600,
  },
  aboutTitle: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 32,
    color: colors.textDark,
    letterSpacing: -1,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },
  aboutText: {
    fontSize: 18,
    lineHeight: 30,
    color: colors.textLight,
    marginBottom: 32,
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      },
    }),
  },

  // Contact
  contactContainer: {
    width: '100%',
    alignItems: 'center',
  },
  contactForm: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.white,
    padding: 48,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.borderColor,
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  formGroup: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    color: colors.textDark,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    ...Platform.select({
       web: { outlineStyle: 'none' }, // We'd ideally add focus styles in the component
    }),
  },
  textArea: {
    height: 160,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    maxHeight: height - 160,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: 28,
    paddingVertical: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textDark,
  },
  modalCloseButton: {
    padding: 6,
  },
  modalBody: {
    marginTop: 4,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textLight,
  },

  // Footer
  footer: {
    backgroundColor: '#111827', // Darker cool gray
    paddingTop: isCompact ? 40 : 80,
    paddingBottom: isCompact ? 24 : 40,
    width: '100%',
  },
  footerContent: {
    flexDirection: isCompact ? 'column' : 'row',
    flexWrap: 'wrap',
    justifyContent: isCompact ? 'center' : 'space-between',
    maxWidth: 1280,
    alignSelf: 'center',
    paddingHorizontal: isCompact ? 16 : 24,
    width: '100%',
    gap: isCompact ? 24 : 40,
  },
  footerSection: {
    marginBottom: isCompact ? 16 : 40,
    minWidth: isCompact ? '100%' : 200,
  },
  footerLogoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -1,
  },
  footerTagline: {
    color: '#9CA3AF',
    fontSize: isCompact ? 13 : 15,
    maxWidth: isCompact ? 220 : 280,
    lineHeight: 22,
  },
  footerHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerLink: {
    color: '#D1D5DB',
    fontSize: 15,
    marginBottom: 16,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 20,
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: isCompact ? 24 : 40,
    paddingTop: isCompact ? 20 : 32,
    flexDirection: isCompact ? 'column' : 'row',
    justifyContent: isCompact ? 'center' : 'space-between',
    alignItems: 'center',
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: isCompact ? 16 : 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  footerBottomText: {
    color: '#6B7280',
    fontSize: 14,
  },
  footerBottomLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  footerBottomLink: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
      },
    }),
  },
  modalContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      android: { elevation: 16 },
      ios: { shadowOpacity: 0.3, shadowRadius: 24 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    backgroundColor: colors.surfaceHighlight,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textDark,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalScroll: {
    padding: 24,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 28,
    color: colors.textLight,
  },
});
