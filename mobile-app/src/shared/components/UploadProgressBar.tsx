import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../constants/colors';

export type UploadPhase = 'uploading' | 'processing';

interface UploadProgressBarProps {
  /** Byte progress 0..1. */
  progress: number;
  /** 'uploading' shows %, 'processing' shows an indeterminate shimmer. */
  phase?: UploadPhase;
  /** Optional label, e.g. the file name or "Uploading 1 of 3". */
  label?: string;
}

const TRACK_WIDTH_PCT = 100;

/**
 * Mobile-styled upload progress bar. While bytes are in flight it shows a smooth
 * determinate fill with a live percentage; once bytes hit 100% but the server is
 * still working (e.g. pushing to storage) it switches to an indeterminate
 * shimmer instead of parking at a misleading 100%.
 */
export function UploadProgressBar({ progress, phase = 'uploading', label }: UploadProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const widthAnim = React.useRef(new Animated.Value(pct)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = React.useState(0);

  // Animate the determinate fill toward the latest percentage.
  React.useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  // Drive the indeterminate shimmer loop only while processing.
  React.useEffect(() => {
    if (phase !== 'processing') return;
    shimmerAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, shimmerAnim]);

  const isProcessing = phase === 'processing';
  const shimmerWidth = trackWidth * 0.4;
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, trackWidth],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label} numberOfLines={1}>
          {isProcessing ? 'Processing…' : label || 'Uploading…'}
        </Text>
        {!isProcessing && <Text style={styles.pct}>{pct}%</Text>}
      </View>

      <View
        style={styles.track}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {isProcessing ? (
          <Animated.View
            style={[
              styles.shimmer,
              { width: shimmerWidth, transform: [{ translateX: shimmerTranslate }] },
            ]}
          />
        ) : (
          <Animated.View
            style={[
              styles.fill,
              {
                width: widthAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', `${TRACK_WIDTH_PCT}%`],
                }),
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
  },
  pct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  shimmer: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    opacity: 0.85,
  },
});
