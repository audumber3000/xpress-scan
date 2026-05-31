import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Phone, ChevronRight, X } from 'lucide-react-native';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { colors } from '../constants/colors';

interface ContactActionSheetProps {
  isVisible: boolean;
  onClose: () => void;
  /** Person being contacted — shown in the sheet header */
  name?: string;
  phone?: string;
  onCall: () => void;
  onWhatsApp: () => void;
}

/**
 * Bottom slide-up sheet offering "Call" and "WhatsApp" actions.
 * Animation/structure mirrors ClinicSwitcherSheet for a consistent feel.
 */
export const ContactActionSheet: React.FC<ContactActionSheetProps> = ({
  isVisible,
  onClose,
  name,
  phone,
  onCall,
  onWhatsApp,
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenHeight, duration: 250, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setShouldRender(false));
    }
  }, [isVisible, screenHeight]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: screenHeight, duration: 250, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleCall = () => {
    handleClose();
    // Defer the action until after the close animation so the OS prompt
    // doesn't fight the dismissing sheet.
    setTimeout(onCall, 220);
  };

  const handleWhatsApp = () => {
    handleClose();
    setTimeout(onWhatsApp, 220);
  };

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[styles.root, { opacity: opacityAnim, pointerEvents: isVisible ? 'auto' : 'none' } as any]}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity activeOpacity={1} style={styles.sheetContent}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {name || 'Contact'}
                </Text>
                {phone ? <Text style={styles.subtitle}>{phone}</Text> : null}
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <X size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Call */}
            <TouchableOpacity style={styles.option} onPress={handleCall} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(46,42,133,0.1)' }]}>
                <Phone size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Call</Text>
                <Text style={styles.optionSub}>Start a normal phone call</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity style={styles.option} onPress={handleWhatsApp} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
                <WhatsAppIcon size={36} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>WhatsApp</Text>
                <Text style={styles.optionSub}>Send a WhatsApp message</Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 100 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  optionSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});
