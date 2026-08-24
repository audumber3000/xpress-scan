import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react-native';
import { ToastType } from './toastService';

interface ToastNotificationProps {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  onHide: () => void;
}

/**
 * One dark card, four accent colours.
 *
 * The previous version was a pastel-tinted panel: mint background, mint border,
 * a hard-cornered filled square holding the icon, a vertical hairline divider
 * and a close button, all in the same hue. That palette-per-state approach
 * dates a UI badly, and at four states it meant four different-looking toasts
 * competing with whatever screen was already on show.
 *
 * Dark surface, white text, and colour used only where it carries meaning: the
 * icon. It reads the same against every screen in the app, and the state is
 * still legible at a glance because the icon is both a shape and a colour.
 */
const CONFIG: Record<ToastType, { Icon: any; accent: string }> = {
  success: { Icon: CheckCircle2,  accent: '#34D399' },
  error:   { Icon: AlertCircle,   accent: '#F87171' },
  warning: { Icon: AlertTriangle, accent: '#FBBF24' },
  info:    { Icon: Info,          accent: '#60A5FA' },
};

const SURFACE = '#16181D';

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  visible, message, type, duration, onHide,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  // Scale and fade alongside the slide. A bare vertical slide is the thing that
  // most makes a toast feel like it belongs to an older phone.
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 220, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [translateY, opacity, scale, onHide]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, tension: 70, friction: 11, useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1, tension: 80, friction: 10, useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();

      // Auto-hide after duration
      timerRef.current = setTimeout(hide, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration, hide, translateY, scale, opacity]);

  if (!visible) return null;

  const cfg = CONFIG[type];
  const { Icon } = cfg;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 10, transform: [{ translateY }, { scale }], opacity },
      ]}
      pointerEvents="box-none"
    >
      {/* The whole card dismisses. A 16px X is a poor target on a control that
          is already leaving on its own, so the X stays as a visual affordance
          but the tap area is the entire toast. */}
      <TouchableOpacity
        style={styles.card}
        onPress={hide}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${message}. Tap to dismiss.`}
      >
        <Icon size={19} color={cfg.accent} strokeWidth={2.5} />

        {/* Three lines, not two. The branch-gate message clipped mid-sentence
            at two, and a truncated explanation is worse than none. */}
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>

        <X size={15} color="rgba(255,255,255,0.38)" strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    // Generously rounded. The old 12 against a full-width bar read as a
    // rectangle with the corners filed off rather than a rounded card.
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    // Wide and soft, not tight and dark: a small blur radius with high opacity
    // is the other half of what made this look a decade old.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#F3F4F6',
    letterSpacing: 0.1,
  },
});
