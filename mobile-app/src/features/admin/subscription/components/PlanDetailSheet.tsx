import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2, Copy, Check, X } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/theme';
import { adminColors } from '../../../../shared/constants/adminColors';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';
import { SUPPORT_PHONE_RAW } from '../../../../shared/constants/support';
import { WEB_APP_HOST, WEB_SUBSCRIPTION_URL } from '../../../../shared/constants/platform';
import {
  PLANS, PlanKey, Currency, formatPrice, monthlyEquivalent, annualSavingPercent,
} from '../../../../shared/constants/plans';

/**
 * What one plan costs, and exactly how to get onto it.
 *
 * Opened by tapping a plan on the Subscription screen. Plans are bought on the
 * website, so the honest thing to do when somebody taps a price is explain the
 * route rather than either doing nothing or pretending there is a checkout.
 *
 * ## Instructions, not a link
 *
 * This is the shape Spotify uses on iOS: say plainly that the purchase happens
 * elsewhere, name where, and stop. Nothing here opens a browser. The address is
 * text, and the button next to it copies that text to the clipboard.
 *
 * Copying is deliberately not opening. The string sits on the clipboard until
 * the person decides to paste it somewhere, which makes the navigation theirs.
 * `Linking.openURL` on the same string would make it ours, and that is the line
 * App Store guideline 3.1.1 draws. WhatsApp support IS opened directly, because
 * customer support is not a purchasing mechanism.
 *
 * ## Why it can afford to name app.molarplus.com
 *
 * The Subscription screen only shows the plan cards that open this sheet when
 * `IS_PLAN_PRICING_VISIBLE` is true, which is Android. On iOS there is nothing
 * to tap and this never mounts.
 */

interface Props {
  planKey: PlanKey | null;
  currency: Currency;
  /** True when this is the plan the clinic is already on. */
  isCurrent: boolean;
  clinicName?: string | null;
  onClose: () => void;
}

export const PlanDetailSheet: React.FC<Props> = ({
  planKey, currency, isCurrent, clinicName, onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Reset between openings, so a sheet reopened after a copy does not start out
  // claiming it has already copied something.
  useEffect(() => { setCopied(false); }, [planKey]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!planKey) return null;
  const plan = PLANS[planKey];

  const copyLink = async () => {
    await Clipboard.setStringAsync(WEB_SUBSCRIPTION_URL);
    setCopied(true);
  };

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        `Hi MolarPlus support, I would like to move to the ${plan.label} plan.`,
        clinicName ? `Clinic: ${clinicName}` : null,
      ].filter(Boolean).join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`).catch(() => {});
  };

  const steps = [
    'Open a browser on this phone or on a computer.',
    `Go to ${WEB_APP_HOST} and sign in with this same account.`,
    `Open Settings, then Subscription, and pick ${plan.label}.`,
    'Come back here and pull down to refresh. It applies straight away.',
  ];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        {/* Tapping the dimmed area closes, the way every other sheet in the app
            behaves. Nothing here is a decision that needs confirming. */}
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.grabber} />

          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <View style={s.nameRow}>
                <Text style={s.name}>{plan.label}</Text>
                {isCurrent && (
                  <View style={s.currentPill}>
                    <Text style={s.currentPillText}>YOUR PLAN</Text>
                  </View>
                )}
              </View>
              <Text style={s.tagline}>{plan.tagline}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.close} activeOpacity={0.7}>
              <X size={18} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Both ways of paying, both quoted PER MONTH.
                The yearly column used to show the raw annual total, which is
                the number that scares people: ₹14,400 next to ₹1,500 reads as
                ten times the price until you do the division. Quoting both per
                month makes the cheaper option look cheaper, which is what it
                is. The exact yearly charge sits underneath, because a rounded
                per-month figure must never be the only number on screen. */}
            <View style={s.priceRow}>
              <View style={s.priceCol}>
                <Text style={s.priceColLabel}>PAY MONTHLY</Text>
                <Text style={s.price}>{formatPrice(plan.price[currency].monthly, currency)}</Text>
                <Text style={s.priceUnit}>a month</Text>
              </View>

              <View style={s.priceDivider} />

              <View style={s.priceCol}>
                <View style={s.yearlyHead}>
                  <Text style={s.priceColLabel}>PAY YEARLY</Text>
                  <View style={s.savePill}>
                    <Text style={s.savePillText}>
                      SAVE {annualSavingPercent(plan.key, currency)}%
                    </Text>
                  </View>
                </View>
                <Text style={[s.price, { color: adminColors.primary }]}>
                  {formatPrice(monthlyEquivalent(plan.key, currency), currency)}
                </Text>
                <Text style={s.priceUnit}>a month</Text>
              </View>
            </View>

            <Text style={s.priceNote}>
              Paying yearly means one charge of{' '}
              {formatPrice(plan.price[currency].annual, currency)} instead of twelve
              of {formatPrice(plan.price[currency].monthly, currency)}.
            </Text>

            <Text style={s.section}>WHAT YOU GET</Text>
            {plan.features.map((f, i) => (
              <View key={i} style={s.featureRow}>
                <CheckCircle2 size={14} color={adminColors.primary} />
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}

            {/* The instructions. No step here is a button, on purpose. */}
            <Text style={s.section}>
              {isCurrent ? 'MANAGING THIS PLAN' : `HOW TO SWITCH TO ${plan.label.toUpperCase()}`}
            </Text>
            <Text style={s.lede}>
              Plans are chosen and paid for on the MolarPlus website, not in the app.
              It takes about a minute.
            </Text>

            {steps.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}

            <View style={s.linkBox}>
              <Text style={s.linkLabel}>The page you need</Text>
              {/* Selectable so it can be copied by hand as well, but never a
                  link. Nothing about this opens a browser. */}
              <Text style={s.linkValue} selectable numberOfLines={1}>
                {WEB_SUBSCRIPTION_URL}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[s.copyBtn, copied && s.copyBtnDone]}
            onPress={copyLink}
            activeOpacity={0.85}
          >
            {copied
              ? <Check size={17} color="#065F46" />
              : <Copy size={17} color="#FFFFFF" />}
            <Text style={[s.copyText, copied && s.copyTextDone]}>
              {copied ? 'Copied. Paste it into any browser.' : 'Copy the link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
            <WhatsAppIcon size={17} />
            <Text style={s.supportText}>Ask us to set it up for you</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: colors.gray200,
    alignSelf: 'center', marginBottom: 14,
  },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 22, fontWeight: '800', color: colors.gray900, letterSpacing: -0.4 },
  currentPill: {
    backgroundColor: adminColors.primary, paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 5,
  },
  currentPillText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
  tagline: { fontSize: 12.5, color: colors.gray500, marginTop: 3, lineHeight: 18 },
  close: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.gray50,
    alignItems: 'center', justifyContent: 'center',
  },

  priceRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 14,
    paddingHorizontal: 15, paddingVertical: 13, marginTop: 16,
  },
  priceCol: { flex: 1, gap: 1 },
  priceColLabel: { fontSize: 9.5, fontWeight: '800', color: colors.gray400, letterSpacing: 0.6 },
  priceDivider: { width: 1, backgroundColor: colors.gray200, marginHorizontal: 14 },
  yearlyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savePill: {
    backgroundColor: '#D1FAE5', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4,
  },
  savePillText: { fontSize: 8, fontWeight: '800', color: '#065F46', letterSpacing: 0.3 },
  price: { fontSize: 23, fontWeight: '800', color: colors.gray900, marginTop: 3 },
  priceUnit: { fontSize: 11, color: colors.gray400, fontWeight: '600' },
  priceNote: {
    fontSize: 11.5, lineHeight: 17, color: colors.gray500, fontWeight: '600',
    marginTop: 8, paddingHorizontal: 2,
  },

  section: {
    fontSize: 10.5, fontWeight: '800', color: colors.gray400, letterSpacing: 0.9,
    marginTop: 20, marginBottom: 9,
  },
  lede: { fontSize: 13, lineHeight: 20, color: colors.gray600, marginBottom: 12 },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 7 },
  featureText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.gray700 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 12 },
  stepNum: {
    width: 21, height: 21, borderRadius: 11, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  stepText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: colors.gray700 },

  linkBox: {
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginTop: 4,
  },
  linkLabel: { fontSize: 10.5, fontWeight: '700', color: colors.gray400, letterSpacing: 0.5 },
  linkValue: { fontSize: 13, fontWeight: '700', color: colors.gray900, marginTop: 3 },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: adminColors.primary, borderRadius: 14, paddingVertical: 15,
    marginTop: 16,
  },
  copyBtnDone: { backgroundColor: '#D1FAE5' },
  copyText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF' },
  copyTextDone: { color: '#065F46' },

  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 14, paddingVertical: 14,
    marginTop: 9,
  },
  supportText: { fontSize: 13.5, fontWeight: '700', color: colors.gray900 },
});
