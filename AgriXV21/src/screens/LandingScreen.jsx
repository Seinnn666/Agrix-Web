import React from 'react';
import { View } from 'react-native';
import LandingContent from '../components/landing/LandingContent';

export default function LandingScreen({ navigation }) {
  return (
    <View style={{ flex: 1 }}>
      <LandingContent navigation={navigation} />
    </View>
  );
}
