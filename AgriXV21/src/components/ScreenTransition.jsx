import React from 'react';
import { Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export default function ScreenTransition({ children, style, type = 'slideRight', duration = 260 }) {
  const isWeb = Platform.OS === 'web';
  const progress = React.useRef(new Animated.Value(isWeb ? 1 : 0)).current;
  const { width } = useWindowDimensions();

  useFocusEffect(
    React.useCallback(() => {
      // Skip the initial fade/slide on web so content can paint immediately.
      if (isWeb) return undefined;
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [duration, progress, isWeb])
  );

  const distance = Math.min(48, Math.max(24, width * 0.08));

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [type === 'slideLeft' ? -distance : distance, 0],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  const transform =
    type === 'fadeUp'
      ? [{ translateY }]
      : type === 'fade'
        ? []
        : [{ translateX }];

  return (
    <Animated.View
      style={[
        Platform.OS === 'web' ? { width: '100%', minHeight: '100vh' } : { flex: 1 },
        isWeb ? null : { opacity, transform },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

