export const theme = {
  colors: {
    bg: '#F3F4F6', // Cool Gray 50 - Modern & Clean
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#111827', // Cool Gray 900 - High Contrast
    textMuted: '#6B7280', // Cool Gray 500
    brand: '#2E7D32', // Forest Green
    brandLight: '#E8F5E9',
    brandDark: '#1B5E20',
    accentCoffee: '#7A4A2B',
    accentTeal: '#00695C', // Deep Teal for satellite vibes
    border: '#E5E7EB', // Cool Gray 200
    danger: '#EF4444', // Red 500 - more modern than D32F2F
    overlayDark: 'rgba(17, 24, 39, 0.7)', // Darker, smoother overlay
    overlaySoft: 'rgba(255, 255, 255, 0.85)',
    // Add specific sidebar/nav colors if needed
    sidebarBg: '#FFFFFF',
    sidebarText: '#111827',
    sidebarActive: '#F3F4F6',
  },
  radius: {
    sm: 8,
    md: 12,
    card: 24, // Modern rounded corners
    input: 12,
    pill: 999,
  },
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 5,
    },
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48, // Increased for more breathing room
  },
  typography: {
    h1: 32,
    h2: 28,
    h3: 20,
    body: 16,
    small: 14,
    tiny: 12,
  },
};
