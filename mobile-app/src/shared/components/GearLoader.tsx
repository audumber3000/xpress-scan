import React, { useEffect, useState } from 'react';
import { View, Animated, Text, StyleSheet } from 'react-native';
import { Settings } from 'lucide-react-native';
import { colors } from '../constants/colors';

interface GearLoaderProps {
  size?: number;
  color?: string;
  text?: string;
  showText?: boolean;
}

export const GearLoader: React.FC<GearLoaderProps> = ({
  size = 48,
  color = colors.primary,
  text = 'Loading...',
  showText = true,
}) => {
  const spinValue = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Settings size={size} color={color} />
      </Animated.View>
      {showText && (
        <Text style={[styles.loadingText, { color: colors.gray600 }]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
});
