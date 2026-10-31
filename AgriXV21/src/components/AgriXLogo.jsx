import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../ui/theme';

const logoSource = require('../../assets/agrix-mark.png');

const variants = {
  compact: {
    width: 40,
    height: 40,
  },
  header: {
    width: 48,
    height: 48,
  },
  navbar: {
    width: 44,
    height: 44,
  },
};

export default function AgriXLogo({ onPress, style, variant = 'header', scale = 1 }) {
  const v = variants[variant] ?? variants.header;
  const s = Number(scale);
  const safeScale = Number.isFinite(s) && s > 0 ? s : 1;
  const Wrapper = onPress ? TouchableOpacity : View;
  const [imageFailed, setImageFailed] = React.useState(false);
  const width = Math.round(v.width * safeScale);
  const height = Math.round(v.height * safeScale);
  const fallbackFontSize = Math.max(16, Math.round(v.height * safeScale * 0.58));

  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.container,
        style,
        onPress && Platform.OS === 'web' ? styles.webPointer : null,
      ]}
    >
      {imageFailed ? (
        <Text style={[styles.fallbackText, { fontSize: fallbackFontSize }]}>AgriX</Text>
      ) : (
        <Image
          source={logoSource}
          style={[styles.logoImage, { width, height }]}
          resizeMode="contain"
          accessibilityRole="image"
          aria-label="AgriX"
          onError={() => setImageFailed(true)}
        />
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  webPointer: {
    cursor: 'pointer',
  },
  logoImage: {
    backgroundColor: 'transparent',
    tintColor: undefined,
    maxWidth: '100%',
  },
  fallbackText: {
    color: theme.colors.brandDark,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

