import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

// ─── Tooth SVG ────────────────────────────────────────────────────────────────
// Molar silhouette: crown + two roots, viewBox 0 0 40 58

const TOOTH_PATH =
  'M8,4 Q4,4 4,8 L4,28 Q4,34 8,34 Q9,42 9,48 Q9,54 13,54 Q17,54 17,48 Q17,42 20,42 Q23,42 23,48 Q23,54 27,54 Q31,54 31,48 Q31,42 32,34 Q36,34 36,28 L36,8 Q36,4 32,4 Z';

interface ToothProps {
  size?: number;
  color?: string;
  opacity?: number;
  rotate?: number;
  style?: object;
}

const Tooth: React.FC<ToothProps> = ({
  size = 36,
  color = '#2a276e',
  opacity = 0.13,
  rotate = 0,
  style,
}) => {
  const h = size * (58 / 40); // keep aspect ratio
  return (
    <Svg
      width={size}
      height={h}
      viewBox="0 0 40 58"
      style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]}
    >
      <Path d={TOOTH_PATH} fill={color} opacity={opacity} />
    </Svg>
  );
};

// ─── Decorative tooth positions ───────────────────────────────────────────────

const TEETH = [
  { top: H * 0.10, left: W * 0.06,  size: 44, rotate: -18, opacity: 0.12 },
  { top: H * 0.08, left: W * 0.74,  size: 36, rotate:  14, opacity: 0.10 },
  { top: H * 0.30, left: W * 0.85,  size: 30, rotate:  22, opacity: 0.09 },
  { top: H * 0.62, left: W * 0.04,  size: 34, rotate: -10, opacity: 0.10 },
  { top: H * 0.74, left: W * 0.80,  size: 40, rotate:  16, opacity: 0.11 },
  { top: H * 0.84, left: W * 0.30,  size: 28, rotate:  -8, opacity: 0.08 },
];

// ─── Sync messages ────────────────────────────────────────────────────────────

const SYNC_MESSAGES = [
  'Syncing patients...',
  'Syncing appointments...',
  'Syncing reports...',
  'Syncing inventory...',
  'Syncing lab orders...',
  'Syncing charts...',
  'Syncing staff...',
];

const CYCLE_MS = 1800;

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ConnectingScreen = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        setMsgIdx(prev => (prev + 1) % SYNC_MESSAGES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    }, CYCLE_MS);

    return () => clearInterval(interval);
  }, []);

  const rotate = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Decorative background teeth */}
      {TEETH.map((t, i) => (
        <Tooth
          key={i}
          size={t.size}
          rotate={t.rotate}
          opacity={t.opacity}
          style={{ position: 'absolute', top: t.top, left: t.left }}
        />
      ))}

      {/* Sync icon */}
      <LinearGradient
        colors={['#4a4694', '#2a276e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.circle}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <RefreshCw size={72} color="#fff" strokeWidth={1.8} />
        </Animated.View>
      </LinearGradient>

      {/* Cycling text */}
      <Animated.Text style={[s.message, { opacity: fadeAnim }]}>
        {SYNC_MESSAGES[msgIdx]}
      </Animated.Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 36,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2a276e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 12,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.2,
  },
});
