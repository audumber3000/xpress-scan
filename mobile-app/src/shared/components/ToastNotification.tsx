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

const CONFIG: Record<ToastType, {
  bg: string; border: string; iconBg: string; Icon: any; iconColor: string; textColor: string;
}> = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', iconBg: '#10B981', Icon: CheckCircle2, iconColor: '#fff', textColor: '#065F46' },
  error:   { bg: '#FEF2F2', border: '#FECACA', iconBg: '#EF4444', Icon: AlertCircle,  iconColor: '#fff', textColor: '#991B1B' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', iconBg: '#F59E0B', Icon: AlertTriangle,iconColor: '#fff', textColor: '#92400E' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', iconBg: '#3B82F6', Icon: Info,         iconColor: '#fff', textColor: '#1E40AF' },
};

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  visible, message, type, duration, onHide,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 280,
      useNativeDriver: true,
    }).start(() => onHide());
  }, [translateY, onHide]);

  useEffect(() => {
    if (visible) {
      // Slide down
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 11,
        useNativeDriver: true,
      }).start();

      // Auto-hide after duration
      timerRef.current = setTimeout(hide, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration, hide, translateY]);

  if (!visible) return null;

  const cfg = CONFIG[type];
  const { Icon } = cfg;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top + 8, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        {/* Icon */}
        <View style={[styles.iconBox, { backgroundColor: cfg.iconBg }]}>
          <Icon size={16} color={cfg.iconColor} strokeWidth={2.5} />
        </View>

        {/* Message */}
        <Text style={[styles.message, { color: cfg.textColor }]} numberOfLines={2}>
          {message}
        </Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: cfg.border }]} />

        {/* Close */}
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={16} color={cfg.textColor} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  divider: {
    width: 1,
    height: 18,
    borderRadius: 1,
  },
});
