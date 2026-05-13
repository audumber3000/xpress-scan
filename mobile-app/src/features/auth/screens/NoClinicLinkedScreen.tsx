import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Building2, LogOut } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';
import { MARKETING_SITE_TEXT } from '../../../shared/constants/platform';
import { useAuth } from '../../../app/AuthContext';

// Shown on iOS when an authenticated user signs in but has no clinic linked
// to their account. Under Path A (App Store guideline 3.1.3(b) Multiplatform
// Services exemption) the iOS build is sign-in-only — new clinic onboarding
// happens on the website. We do not expose a tappable link or button to the
// website here: Apple forbids any CTA that could be read as steering users
// toward an external purchasing mechanism (3.1.1).
export const NoClinicLinkedScreen: React.FC = () => {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.content}>
        <Image
          source={require('../../../../assets/icon.png')}
          style={styles.appLogo}
          resizeMode="contain"
        />

        <View style={styles.iconBubble}>
          <Building2 size={36} color={colors.primary} strokeWidth={2.2} />
        </View>

        <Text style={styles.title}>No clinic linked yet</Text>

        <Text style={styles.body}>
          Your account isn't linked to a MolarPlus clinic.
        </Text>

        <Text style={styles.body}>
          To set up your clinic, please visit{' '}
          <Text style={styles.siteText}>{MARKETING_SITE_TEXT}</Text> on the web,
          create your clinic profile there, and then sign back in to this app.
        </Text>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => logout()}
          activeOpacity={0.85}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  appLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 8,
  },
  iconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gray900,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.gray600,
    textAlign: 'center',
    fontWeight: '500',
  },
  siteText: {
    fontWeight: '700',
    color: colors.gray900,
  },
  logoutBtn: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
