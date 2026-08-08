import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Headset, Phone, Clock, ChevronRight } from 'lucide-react-native';
import { WhatsAppIcon } from '../../../../shared/components/WhatsAppIcon';
import { colors } from '../../../../shared/constants/theme';
import {
  SUPPORT_PHONE, isSupportOnline, supportResponseTime, supportWhatsAppLink,
} from '../../../../shared/constants/support';

/**
 * Support contact for the Control Center. Mirrors the web header's card: the
 * number, how long a reply takes, and one tap through to WhatsApp.
 *
 * The dot is not decoration — a green pill promising a 5-minute reply at 2am
 * would be a worse experience than saying plainly that nobody is at the desk.
 */
export const SupportCard: React.FC<{ clinicName?: string | null }> = ({ clinicName }) => {
  // Re-checked on a timer: the app can sit open across the 9pm boundary.
  const [online, setOnline] = useState(isSupportOnline);
  useEffect(() => {
    const id = setInterval(() => setOnline(isSupportOnline()), 60_000);
    return () => clearInterval(id);
  }, []);

  const openWhatsApp = () => Linking.openURL(supportWhatsAppLink(clinicName));
  const call = () => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Headset size={20} color={colors.primary} />
          <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.warning }]} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Talk to support</Text>
            <View style={[styles.pill, online ? styles.pillOn : styles.pillOff]}>
              <View style={[styles.pillDot, { backgroundColor: online ? colors.success : colors.warning }]} />
              <Text style={[styles.pillText, { color: online ? colors.success : colors.warning }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <Text style={styles.sub}>
            {online ? "We're here to help you out." : 'Leave a message — the team picks it up when they’re back.'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.row} onPress={call} activeOpacity={0.7}>
        <Phone size={16} color={colors.textMuted} />
        <Text style={styles.phone}>{SUPPORT_PHONE}</Text>
        <ChevronRight size={15} color={colors.borderColor} />
      </TouchableOpacity>

      <View style={styles.row}>
        <Clock size={16} color={colors.textMuted} />
        <Text style={styles.replyText}>
          Usually replies in <Text style={styles.replyStrong}>{supportResponseTime(online)}</Text>
        </Text>
      </View>

      <TouchableOpacity style={styles.waBtn} onPress={openWhatsApp} activeOpacity={0.85}>
        <WhatsAppIcon size={19} color="#fff" />
        <Text style={styles.waText}>Click to chat</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.borderColor, gap: 12,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryBgLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    position: 'absolute', bottom: 0, right: 0, width: 11, height: 11,
    borderRadius: 6, borderWidth: 2, borderColor: colors.cardBg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1,
  },
  pillOn: { backgroundColor: colors.successLight, borderColor: colors.successLight },
  pillOff: { backgroundColor: colors.warningLight, borderColor: colors.warningLight },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: '800' },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phone: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  replyText: { fontSize: 13, color: colors.textMuted },
  replyStrong: { fontWeight: '700', color: colors.textSecondary },

  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 12, marginTop: 2,
  },
  waText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
