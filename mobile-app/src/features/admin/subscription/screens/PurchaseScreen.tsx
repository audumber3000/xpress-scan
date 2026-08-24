import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Globe } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';
import { MARKETING_SITE_TEXT } from '../../../../shared/constants/platform';
import { SUPPORT_PHONE_RAW } from '../../../../shared/constants/support';
import { useAuth } from '../../../../app/AuthContext';

/**
 * There is no purchase in the app any more, on either platform.
 *
 * This file used to be a full native Cashfree checkout: plan selection, a promo
 * code field, order creation, payment verification and confetti. All of it is
 * gone. It sold a single ₹899 "professional" plan, which stopped existing when
 * the catalogue became Plus / Pro / Growth, and keeping it would have meant two
 * checkouts quoting different products — with the GST line, the coupon rules
 * and the never-show-an-Indian-clinic-dollars rule implemented twice.
 *
 * The screen and its route survive so that nothing which still navigates here
 * lands on a blank stack. Everything that used to point at it now points at the
 * Subscription screen instead; if you find a caller still coming here, send it
 * there rather than reviving this.
 *
 * `molarplus.com` stays plain text — not a link, not a button. The tappable
 * things on this screen are Back and WhatsApp support, neither of which is a
 * purchasing mechanism.
 */
export const PurchaseScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const clinicName = backendUser?.clinic?.name;

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        'Hi MolarPlus support, I would like help choosing a plan.',
        clinicName ? `Clinic: ${clinicName}` : null,
      ].filter(Boolean).join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <TouchableOpacity style={s.back} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <ChevronLeft size={22} color={colors.gray900} />
      </TouchableOpacity>

      <View style={s.body}>
        <View style={s.iconWrap}>
          <Globe size={26} color={colors.primary} />
        </View>

        <Text style={s.title}>Plans are managed on the web</Text>
        <Text style={s.text}>
          Sign in at {MARKETING_SITE_TEXT} from any browser, open Settings and then
          Subscription, and choose the plan you want. It applies to this app straight away.
        </Text>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.replace('Subscription')}
          activeOpacity={0.85}
        >
          <Text style={s.primaryText}>See your plan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
          <WhatsAppIcon size={18} />
          <Text style={s.supportText}>Message support on WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  back: {
    width: 40, height: 40, borderRadius: 12, marginLeft: 12, marginTop: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 60 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray900, letterSpacing: -0.4 },
  text: { fontSize: 14, lineHeight: 22, color: colors.gray600, marginTop: 10 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 26,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 14, paddingVertical: 14, marginTop: 10,
  },
  supportText: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
});
