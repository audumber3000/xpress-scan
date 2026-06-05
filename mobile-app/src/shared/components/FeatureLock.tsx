import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Zap } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../app/AuthContext';
import { IS_PURCHASE_UI_ENABLED, MARKETING_SITE_TEXT } from '../constants/platform';
import { getSubscriptionPricing } from '../utils/pricing';

interface FeatureLockProps {
  children: React.ReactNode;
  featureName: string;
  description?: string;
}

export const FeatureLock: React.FC<FeatureLockProps> = ({
  children,
  featureName,
  description,
}) => {
  const { backendUser } = useAuth();
  const navigation = useNavigation<any>();
  const pricing = getSubscriptionPricing(backendUser?.clinic);

  const plan = backendUser?.clinic?.subscription_plan as string | undefined;
  const isPro = plan === 'professional' || plan === 'professional_annual';
  // Trial users get full access to premium features for the duration of the trial.
  const isTrial = !!backendUser?.clinic?.is_trial;
  const isLocked = !isPro && !isTrial;

  if (!isLocked) return <>{children}</>;

  return (
    <View style={s.wrapper}>
      {/* Dimmed content underneath */}
      <View style={s.dimmedContent} pointerEvents="none">
        {children}
      </View>

      {/* Lock overlay */}
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Lock icon */}
          <LinearGradient
            colors={['#F59E0B', '#EA580C']}
            style={s.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Lock size={28} color="#fff" strokeWidth={2.5} />
          </LinearGradient>

          <Text style={s.title}>{featureName}</Text>
          {IS_PURCHASE_UI_ENABLED ? (
            <>
              <Text style={s.body}>
                {description ||
                  `${featureName} is a premium feature. Upgrade to Professional to streamline your clinic workflow.`}
              </Text>

              <TouchableOpacity
                style={s.btn}
                onPress={() => navigation.navigate('Purchase')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#2E2A85', '#4338CA']}
                  style={s.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Zap size={16} color="#fff" fill="#fff" />
                  <Text style={s.btnText}>Upgrade to Pro</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={s.hint}>Starting at {pricing.symbol}{pricing.monthly} / month</Text>
            </>
          ) : (
            // iOS: no in-app upgrade CTA. Plain text mentioning the website.
            <Text style={s.body}>
              {description
                ? `${description} Manage your plan from your clinic account on ${MARKETING_SITE_TEXT}.`
                : `${featureName} is included with the MolarPlus Professional plan. Manage your plan from your clinic account on ${MARKETING_SITE_TEXT}.`}
            </Text>
          )}
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
  btn: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
