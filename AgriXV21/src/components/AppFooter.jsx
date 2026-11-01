import React, { useState } from 'react';
import { Platform, Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Facebook, Instagram, Linkedin, Twitter, X } from './Icons';
import { landingStyles as styles } from './landing/landingStyles';
import AgriXLogo from './AgriXLogo';

export default function AppFooter({
  bleedX = 0,
  bottomFill = 0,
  fillHeight = false,
  style,
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });

  const go = (key) => {
    if (typeof onScrollToSection === 'function') {
      onScrollToSection(key);
      return;
    }
    if (navigation?.navigate) {
      navigation.navigate('Landing');
    }
  };

  const openSocial = (url) => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  const openPolicy = (type) => {
    if (type === 'terms') {
      setModalContent({
        title: 'Terms of Use',
        body: `Welcome to AgriX. By accessing our platform, you agree to these terms.\n\n1. Usage: You agree to use AgriX for lawful coffee monitoring and research purposes.\n\n2. Account: You are responsible for maintaining the confidentiality of your account credentials.\n\n3. Data: We collect sensor data to provide dashboards and insights. Your project data remains yours.\n\n4. Liability: AgriX provides data-driven insights but is not liable for decisions made based on this data.\n\n5. Termination: We reserve the right to terminate accounts that violate these terms.\n\nLast Updated: 2026-02-01`
      });
    } else {
      setModalContent({
        title: 'Privacy Policy',
        body: `Your privacy is important to us.\n\n1. Information Collection: We collect personal info (name, email) and project data (site, notes, sensor readings).\n\n2. Usage: We use this data to provide monitoring dashboards, history, and alerts.\n\n3. Sharing: We do not sell your personal data to third parties. We may share aggregated, anonymized data for research.\n\n4. Security: We employ industry-standard security measures to protect your data.\n\n5. Rights: You have the right to access, correct, or delete your data at any time.`
      });
    }
    setModalVisible(true);
  };

  return (
    <View
      style={[
        styles.footer,
        fillHeight ? { flexGrow: 1 } : null,
        bleedX ? { marginLeft: -bleedX, marginRight: -bleedX } : null,
        Platform.OS === 'web' ? { width: '100%' } : null,
        style,
      ]}
    >
      <View style={styles.footerContent}>
        <View style={styles.footerSection}>
          <AgriXLogo variant="compact" style={{ marginBottom: 16 }} />
          <Text style={styles.footerTagline}>Coffee monitoring for CvSU.</Text>
        </View>
        <View style={styles.footerSection}>
          <Text style={styles.footerHeading}>Follow Us</Text>
          <View style={styles.socialIcons}>
            <TouchableOpacity onPress={() => openSocial('https://facebook.com')}>
              <Facebook color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openSocial('https://twitter.com')}>
              <Twitter color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openSocial('https://instagram.com')}>
              <Instagram color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openSocial('https://linkedin.com')}>
              <Linkedin color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.footerBottom}>
        <Text style={styles.footerBottomText}>&copy; 2026 AgriX. All rights reserved.</Text>
        <View style={styles.footerBottomLinks}>
           <TouchableOpacity onPress={() => openPolicy('terms')}>
             <Text style={styles.footerBottomLink}>Terms of Use</Text>
           </TouchableOpacity>
           <Text style={{color: '#666'}}>|</Text>
           <TouchableOpacity onPress={() => openPolicy('privacy')}>
             <Text style={styles.footerBottomLink}>Privacy Policy</Text>
           </TouchableOpacity>
        </View>
      </View>
      
      {bottomFill ? <View style={{ height: bottomFill }} /> : null}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalContent.title}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <X color="#333" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalBody}>{modalContent.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
