import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  useWindowDimensions,
  Platform,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Tractor,
  Sprout,
  Droplets,
  Menu,
  X,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Sun,
  Moon,
} from '../Icons';
import { landingStyles as styles, colors } from './landingStyles';
import HoverPressable from '../HoverPressable';
import AppFooter from '../AppFooter';
import AgriXLogo from '../AgriXLogo';

export default function LandingContent({ navigation }) {
  const scrollRef = useRef(null);
  const sectionOffsetsRef = useRef({ home: 0, services: 0, about: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const isWeb = Platform.OS === 'web';
  const [theme, setTheme] = useState('light');
  const isDark = theme === 'dark';
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('agrix_theme');
        if (stored === 'dark' || stored === 'light') {
          setTheme(stored);
        }
      }
    } catch (_err) {
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('agrix_theme', theme);
      }
    } catch (_err) {
    }
  }, [theme]);

  const goTo = (screen) => {
    setIsMenuOpen(false);
    navigation?.navigate?.(screen);
  };
  const navbarOffset = Platform.OS === 'web' ? 70 + insets.top : 0;

  const scrollToY = (y) => {
    const node = scrollRef.current;
    if (!node) return;
    if (Platform.OS === 'web') {
      const webNode = node.getScrollableNode?.() ?? node;
      if (webNode && typeof webNode.scrollTo === 'function') {
        webNode.scrollTo({ top: y, behavior: 'smooth' });
        return;
      }
    }
    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ y, animated: true });
      return;
    }
    const responder = node.getScrollResponder?.();
    if (responder?.scrollTo) responder.scrollTo({ y, animated: true });
  };

  const handleScrollTo = (key) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.getElementById(`agrix-section-${key}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setIsMenuOpen(false);
        return;
      }
    }
    const targetY = sectionOffsetsRef.current[key];
    if (scrollRef.current && typeof targetY === 'number') {
      scrollToY(Math.max(0, targetY - navbarOffset));
      setIsMenuOpen(false);
    }
  };

  const onLayout = (key) => (event) => {
    sectionOffsetsRef.current[key] = event.nativeEvent.layout.y;
  };

  const NavItem = ({ label, target }) => (
    <HoverPressable
      onPress={() => handleScrollTo(target)}
      style={styles.navItem}
      hoverStyle={
        Platform.OS === 'web'
          ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
          : null
      }
      pressedStyle={{ opacity: 0.7 }}
    >
      <Text style={[styles.navLink, isDark && { color: '#E5E7EB' }]}>{label}</Text>
    </HoverPressable>
  );

  const ServiceCard = ({ Icon, title, desc, onPress }) => {
    const cardStyle = StyleSheet.flatten([
      styles.serviceCard,
      isDark && { backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#1F2937' },
    ]);
    const iconStyle = StyleSheet.flatten([
      styles.serviceIcon,
      isDark && { backgroundColor: '#020617' },
    ]);
    const titleStyle = StyleSheet.flatten([
      styles.serviceTitle,
      isDark && { color: '#E5E7EB' },
    ]);
    const textStyle = StyleSheet.flatten([
      styles.serviceText,
      isDark && { color: '#9CA3AF' },
    ]);

    return (
      <HoverPressable
        style={cardStyle}
        hoverStyle={{ transform: [{ translateY: -10 }] }}
        pressedStyle={{ opacity: 0.9 }}
        onPress={onPress}
      >
        <Icon size={60} color={isDark ? '#4ADE80' : '#4CAF50'} style={iconStyle} />
        <Text style={titleStyle}>{title}</Text>
        <Text style={textStyle}>{desc}</Text>
      </HoverPressable>
    );
  };

  const ThemeToggleButton = () => (
    <HoverPressable
      onPress={() => setTheme(isDark ? 'light' : 'dark')}
      style={[styles.themeToggle, isDark && { backgroundColor: '#020617' }]}
      hoverStyle={
        Platform.OS === 'web'
          ? {
              transform: [{ translateY: -4 }, { scale: 1.08 }],
              opacity: 1,
              backgroundColor: isDark ? '#020617' : '#E5E7EB',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }
          : null
      }
      pressedStyle={{ opacity: 0.85, transform: [{ scale: 0.96 }] }}
    >
      {isDark ? <Sun size={18} color="#FACC15" /> : <Moon size={18} color="#0F172A" />}
    </HoverPressable>
  );

  const services = [
    {
      id: 'esp32',
      Icon: Tractor,
      title: 'ESP32 Microcontroller Node',
      desc:
        'Acts as the controller for the coffee monitoring node, handling Wi‑Fi and Bluetooth communication for real-time data transmission from connected modules.',
      detail:
        'The ESP32 microcontroller is the core of the monitoring node. It coordinates data collection from connected sensors and modules, then streams readings and snapshots to the dashboard. This setup supports CvSU students and researchers by making coffee storage monitoring accessible, repeatable, and easy to review from both web and mobile.',
    },
    {
      id: 'ov2640',
      Icon: Sprout,
      title: 'OV2640 Camera Module',
      desc:
        'Provides visual verification of coffee storage conditions through periodic snapshots.',
      detail:
        'The OV2640 camera module adds a visual layer to coffee monitoring. Alongside sensor readings, snapshots help confirm storage conditions (e.g., condensation, container placement, and overall environment). This supports CvSU monitoring activities by pairing numeric data with visual evidence for reporting and review.',
    },
    {
      id: 'dht11',
      Icon: Droplets,
      title: 'Humidity and Temperature Sensing (DHT11)',
      desc:
        'Measures humidity and temperature inside coffee storage areas to help maintain stable conditions.',
      detail:
        'The DHT11 sensor continuously measures humidity and temperature inside the storage environment. AgriX uses these readings to power dashboards and alerts when conditions move outside your chosen ranges. This helps CvSU users observe storage patterns and keep conditions consistent over time.',
    },
    {
      id: 'soil',
      Icon: Sprout,
      title: 'Bean Moisture Monitoring',
      desc:
        'Monitors bean moisture to support storage observations and basic trend tracking.',
      detail:
        'Bean moisture monitoring extends the system to coffee storage, supporting observations and trend tracking. This module helps CvSU users collect baseline measurements and compare changes over time alongside storage metrics.',
    },
  ];

  const dataMaps = [
    { title: 'Temperature', body: 'Continuous tracking inside coffee storage areas.' },
    { title: 'Humidity', body: 'Monitoring to help keep storage conditions stable.' },
    { title: 'Real-time alerts', body: 'Notifies users when readings exceed configured thresholds.' },
    { title: 'Storage snapshots', body: 'Captures images via the OV2640 camera module for visual checks.' },
    { title: 'History and trends', body: 'Review past readings and patterns over time.' },
    { title: 'Field notes', body: 'Track observations alongside sensor data for CvSU activities.' },
  ];

  const PageContent = (
    <>
      {/* Hero Section */}
      <View
        nativeID="agrix-section-home"
        style={Platform.OS === 'web' ? { scrollMarginTop: navbarOffset } : null}
        onLayout={onLayout('home')}
      >
        <ImageBackground
          source={{
            uri: 'https://stonestreetcoffee.com/cdn/shop/articles/Coffee-beans-on-the-tree_1600x.jpg?v=1726238365',
          }}
          style={styles.hero}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>AgriX Coffee Monitoring</Text>
            <Text style={styles.heroText}>
              Real-time storage monitoring with snapshots and threshold alerts—built to support CvSU coffee projects.
            </Text>

            <View style={styles.heroBullets}>
              {[
                'Track storage temperature and humidity',
                'Verify conditions with camera snapshots',
                'Get alerts when thresholds are exceeded',
                'Review trends for reporting and review',
              ].map((t) => (
                <View key={t} style={styles.heroBulletRow}>
                  <View style={styles.heroBulletDot} />
                  <Text style={styles.heroBulletText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.heroActions}>
              <HoverPressable style={[styles.btn, styles.btnPrimary]} onPress={() => goTo('SignUp')}>
                <Text style={styles.btnPrimaryText}>Start Monitoring</Text>
              </HoverPressable>
              <HoverPressable style={[styles.btn, styles.heroBtnSecondary]} onPress={() => goTo('SignIn')}>
                <Text style={styles.heroBtnSecondaryText}>Sign in</Text>
              </HoverPressable>
            </View>

            <Text style={styles.heroTrust}>
              Real-time humidity/temp • Snapshot verification • Threshold alerts
            </Text>
          </View>
        </ImageBackground>
      </View>

      <View style={[styles.howSection, isDark && { backgroundColor: '#020617' }]}>
        <Text style={[styles.howTitle, isDark && { color: '#E5E7EB' }]}>How it works</Text>
        <View style={styles.howGrid}>
          {[
            {
              title: 'Sensor',
              body: 'Collect humidity and temperature data from the environment.',
            },
            {
              title: 'Dashboard',
              body: 'View readings, trends, and camera snapshots across web and mobile.',
            },
            {
              title: 'Alerts',
              body: 'Get notified when readings exceed safe thresholds.',
            },
          ].map((s) => (
            <View
              key={s.title}
              style={[
                styles.howCard,
                isDark && { backgroundColor: '#0B1220', borderColor: '#1F2937' },
              ]}
            >
              <Text style={[styles.howCardTitle, isDark && { color: '#E5E7EB' }]}>{s.title}</Text>
              <Text style={[styles.howCardText, isDark && { color: '#9CA3AF' }]}>{s.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Services Section */}
      <View
        nativeID="agrix-section-services"
        style={[
          styles.section,
          Platform.OS === 'web' ? { scrollMarginTop: navbarOffset } : null,
          isDark && { backgroundColor: '#020617' },
        ]}
        onLayout={onLayout('services')}
      >
        <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>Modules</Text>
        <View style={styles.servicesGrid}>
          {services.map((svc) => (
            <ServiceCard
              key={svc.id}
              Icon={svc.Icon}
              title={svc.title}
              desc={svc.desc}
              onPress={() => setSelectedService(svc)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isDark && { color: '#E5E7EB' }]}>Monitored Data</Text>
        <Text style={[styles.sectionLead, isDark && { color: '#9CA3AF' }]}>
          Data shown on the homepage reflects the core AgriX modules for CvSU: real-time monitoring, snapshots, and alerts for coffee storage and field observations.
        </Text>
          <View style={styles.mapGrid}>
          {dataMaps.map((m) => (
            <HoverPressable
              key={m.title}
              style={[
                styles.mapCard,
                isDark && { backgroundColor: '#020617', borderColor: '#1F2937' },
              ]}
              hoverStyle={{ transform: [{ translateY: -6 }] }}
            >
              <Text style={[styles.mapTitle, isDark && { color: '#E5E7EB' }]}>{m.title}</Text>
              <Text style={[styles.mapText, isDark && { color: '#9CA3AF' }]}>{m.body}</Text>
            </HoverPressable>
          ))}
        </View>
      </View>

      {/* About Section */}
      <View
        nativeID="agrix-section-about"
        style={[
          styles.section,
          styles.bgLight,
          isMobile ? { paddingTop: 48, paddingBottom: 72 } : null,
          Platform.OS === 'web' ? { scrollMarginTop: navbarOffset } : null,
          isDark && { backgroundColor: '#020617' },
        ]}
        onLayout={onLayout('about')}
      >
        <View style={[styles.aboutContainer, isMobile && { flexDirection: 'column', gap: 32 }]}>
          <View style={styles.aboutContent}>
            <Text style={[styles.aboutTitle, isDark && { color: '#E5E7EB' }]}>About the Project</Text>
            <Text style={[styles.aboutText, isDark && { color: '#9CA3AF' }]}>
              AgriX is a coffee monitoring platform designed to support CvSU by combining sensor data, snapshots, and dashboards for easy review.
            </Text>
            <Text style={[styles.aboutText, isDark && { color: '#9CA3AF' }]}>
              The goal is to make monitoring simple and consistent across web and mobile, so students, researchers, and project teams can track conditions and trends over time.
            </Text>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => goTo('SignUp')}>
              <Text style={styles.btnSecondaryText}>Create an Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <AppFooter />
    </>
  );

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#020617' }]}>
      <View
        style={[
          styles.navbar,
          { paddingTop: insets.top, height: 70 + insets.top },
          isDark && { backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottomColor: 'rgba(15, 23, 42, 0.9)' },
        ]}
      >
        <View style={styles.navContainer}>
          <AgriXLogo variant="navbar" scale={1} onPress={() => handleScrollTo('home')} />

          {isMobile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ThemeToggleButton />
              <TouchableOpacity
                style={styles.menuToggle}
                onPress={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X size={24} color={isDark ? colors.white : colors.textDark} />
                ) : (
                  <Menu size={24} color={isDark ? colors.white : colors.textDark} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.navMenu}>
              <NavItem label="Home" target="home" />
              <NavItem label="Modules" target="services" />
              <NavItem label="About" target="about" />
              <ThemeToggleButton />
              <HoverPressable
                onPress={() => goTo('SignIn')}
                style={styles.navItem}
                hoverStyle={
                  Platform.OS === 'web'
                    ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
                    : null
                }
                pressedStyle={{ opacity: 0.7 }}
              >
                <Text style={[styles.navLink, { color: colors.primary, fontWeight: '700' }]}>
                  Login
                </Text>
              </HoverPressable>
              <HoverPressable
                onPress={() => goTo('SignUp')}
                style={styles.navItem}
                hoverStyle={
                  Platform.OS === 'web'
                    ? { transform: [{ translateY: -3 }, { scale: 1.04 }], opacity: 1 }
                    : null
                }
                pressedStyle={{ opacity: 0.7 }}
              >
                <Text style={[styles.navLink, { color: colors.primary, fontWeight: '700' }]}>
                  Register
                </Text>
              </HoverPressable>
            </View>
          )}
        </View>

        {isMobile && isMenuOpen && (
          <View
            style={[
              styles.navMenuMobile,
              { top: 70 + insets.top },
              isDark && { backgroundColor: '#020617', borderBottomColor: '#1F2937' },
            ]}
          >
            <NavItem label="Home" target="home" />
            <NavItem label="Modules" target="services" />
            <NavItem label="About" target="about" />
            <TouchableOpacity style={styles.mobileNavItem} onPress={() => goTo('SignIn')}>
              <Text style={[styles.navLink, isDark && { color: '#E5E7EB' }]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileNavItem} onPress={() => goTo('SignUp')}>
              <Text style={[styles.navLink, isDark && { color: '#E5E7EB' }]}>Register</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isWeb ? (
        <View style={{ paddingTop: navbarOffset }}>
          {PageContent}
        </View>
      ) : (
        <ScrollView ref={scrollRef} style={{ flex: 1 }}>
          {PageContent}
        </ScrollView>
      )}
      <Modal
        visible={Boolean(selectedService)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedService(null)}
      >
        {selectedService && (
          <View
            style={[
              styles.modalOverlay,
              isDark && { backgroundColor: 'rgba(0,0,0,0.9)' },
            ]}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark ? '#020617' : colors.white,
                  borderColor: isDark ? '#1F2937' : colors.borderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    backgroundColor: isDark ? '#020617' : colors.white,
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? '#1F2937' : colors.borderColor,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 4,
                    paddingVertical: 4,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    isDark ? { color: '#F9FAFB' } : null,
                  ]}
                >
                  {selectedService.title}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedService(null)}
                  style={styles.modalCloseButton}
                >
                  <X size={20} color={isDark ? '#F9FAFB' : '#4B5563'} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <Text
                  style={[
                    styles.modalText,
                    isDark ? { color: '#D1D5DB' } : null,
                  ]}
                >
                  {selectedService.detail}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
