import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2 } from 'lucide-react-native';
import { useAuth } from '../../app/AuthContext';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { MARKETING_SITE_TEXT } from '../constants/platform';
import { SUPPORT_PHONE_RAW } from '../constants/support';
import { planAllowsBranches } from '../constants/plans';

interface FeatureLockProps {
  children: React.ReactNode;
  featureName?: string;
  description?: string;
}

/**
 * FeatureLock — multi-branch upgrade gate.
 *
 * Every plan carries the full clinical suite, so this wraps the "Add branch"
 * flow only. Plus covers one location and sees the overlay; Pro and Growth pass
 * straight through.
 *
 * The test is the plan's branch allowance, NOT its name. It used to be
 * `plan === 'professional'`, which would have locked multi-branch for every Pro
 * customer the moment the plans were renamed — taking a feature away from
 * exactly the people paying for it.
 */
export const FeatureLock: React.FC<FeatureLockProps> = ({
  children,
  featureName = 'Multiple branches',
  description,
}) => {
  const { backendUser } = useAuth();

  // `effective_plan` is what the clinic can use today. `subscription_plan` is
  // what it last bought, and after an expiry those differ — gating on the
  // second would hand branch creation to a clinic whose plan has stopped.
  const clinic = backendUser?.clinic;
  const plan = (clinic?.effective_plan || clinic?.subscription_plan) as string | undefined;
  // Until the plan is positively known, treat it as allowed rather than locked:
  // a wrongly-shown overlay on a plan that permits branches is a support call,
  // and this renders while /auth/me is still in flight.
  const isLocked = plan ? !planAllowsBranches(plan) : false;

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        'Hi MolarPlus support, I would like to add another branch.',
        clinic?.name ? `Clinic: ${clinic.name}` : null,
      ].filter(Boolean).join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`).catch(() => {});
  };

  if (!isLocked) return <>{children}</>;

  return (
    <View style={s.wrapper}>
      {/* Dimmed content underneath */}
      <View style={s.dimmedContent} pointerEvents="none">
        {children}
      </View>

      {/* Upgrade overlay */}
      <View style={s.overlay}>
        <View style={s.card}>
          <LinearGradient
            colors={['#2E2A85', '#4338CA']}
            style={s.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Building2 size={28} color="#fff" strokeWidth={2.5} />
          </LinearGradient>

          <Text style={s.title}>Add more branches</Text>

          {/* No upgrade button on either platform, and `molarplus.com` is plain
              text rather than a link. The copy no longer says "free forever":
              Plus is a paid plan that happens to cover one location, and
              telling a paying customer their plan is free is both wrong and
              the fastest way to make the next invoice a surprise. */}
          <Text style={s.body}>
            {description ||
              `Your plan covers one clinic location. Running several branches from one login is part of Pro, which is chosen on ${MARKETING_SITE_TEXT} from any browser.`}
          </Text>

          <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
            <WhatsAppIcon size={17} />
            <Text style={s.supportText}>Ask us about Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  dimmedContent: {
    flex: 1,
    opacity: 0.12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(249,250,251,0.6)',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 13,
  },
  supportText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
});
