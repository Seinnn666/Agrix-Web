import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

export default function HoverPressable({ style, hoverStyle, pressedStyle, ...props }) {
  return (
    <Pressable
      {...props}
      style={({ hovered, pressed }) =>
        StyleSheet.flatten([
          Platform.OS === 'web' && typeof props.onPress === 'function' ? { cursor: 'pointer' } : null,
          style,
          Platform.OS === 'web' && hovered && (hoverStyle || { opacity: 0.9, transform: [{ scale: 1.02 }] }),
          pressed && (pressedStyle || { opacity: 0.75 }),
        ])
      }
    />
  );
}

