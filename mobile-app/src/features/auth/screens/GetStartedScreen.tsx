import React from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Dimensions,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image
} from 'react-native';
import { toast } from '../../../shared/components/toastService';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChevronRight,
  Mail
} from 'lucide-react-native';
import { RootStackParamList } from '../../../app/AppNavigator';
import { colors } from '../../../shared/constants/colors';
import { signInWithGoogle, signInWithApple } from '../../../services/auth/authService';
import { GoogleIcon } from '../../../shared/components/icons/GoogleIcon';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../../app/AuthContext';
import { LastLoginCard } from '../components/LastLoginCard';
import type { LastLoginProvider } from '../../../services/auth/lastLogin';

type GetStartedScreenProps = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

const { width } = Dimensions.get('window');

export const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ navigation }) => {
  const { setAppleFullName } = useAuth();

  const handleGoogleRegister = async () => {
    try {
      const { user, error } = await signInWithGoogle('clinic_owner');
      if (error) toast.error(error || 'Registration failed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAppleRegister = async () => {
    try {
      const { user, appleFullName, error } = await signInWithApple('clinic_owner');
      if (error) {
        if (error !== 'Sign in was cancelled') toast.error(error);
        return;
      }
      // Persist Apple's first-time-only name into context so SignupScreen
      // can pre-fill it without re-prompting (App Store guideline 4).
      if (appleFullName) setAppleFullName(appleFullName);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleContinueLast = (provider: LastLoginProvider) => {
    if (provider === 'google') return handleGoogleRegister();
    if (provider === 'apple') return handleAppleRegister();
    navigation.navigate('Login');
  };

  // 2/3 of total horizontal width (with 28 padding on each side)
  const googleCardWidth = (width - 56) * 2 / 3;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Icon & Title */}
        <View style={styles.header}>
          <Image
            source={require('../../../../assets/icon.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Register</Text>
          
          <TouchableOpacity 
            style={styles.subtitleRow}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.subtitleText}>Got an account? </Text>
            <Text style={styles.linkText}>Log in here</Text>
            <ChevronRight size={16} color={colors.info} style={styles.chevron} />
          </TouchableOpacity>
        </View>

        {/* Last-login one-tap shortcut for returning users */}
        <LastLoginCard variant="register" onContinue={handleContinueLast} />

        {/* Auth Cards */}
        <View style={styles.cardsContainer}>
          {/* Row 1: Large Google Square (2/3 width) */}
          <TouchableOpacity 
            style={[styles.googleCard, { width: googleCardWidth, height: googleCardWidth }]}
            onPress={handleGoogleRegister}
          >
            <View style={styles.googleIconContainer}>
              <GoogleIcon size={48} />
            </View>
            <View style={styles.cardLabelContainer}>
              <Text style={styles.withText}>with</Text>
              <Text style={styles.providerName}>Google</Text>
            </View>
          </TouchableOpacity>

          {/* Row 2: Apple (iOS only — official Apple HIG button) and Email */}
          <View style={styles.horizontalRow}>
            {Platform.OS === 'ios' && (
              <View style={styles.appleButtonWrapper}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={24}
                  style={styles.appleButton}
                  onPress={handleAppleRegister}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.smallCard}
              onPress={() => navigation.navigate('Signup')}
            >
              <Mail size={24} color="#EF4444" />
              <View style={styles.smallCardLabels}>
                <Text style={styles.withTextSmall}>with</Text>
                <Text style={styles.providerNameSmall}>Email</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 60,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  header: {
    marginBottom: 48,
  },
  appLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.gray900,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: colors.gray500,
    fontWeight: '500',
  },
  linkText: {
    fontSize: 16,
    color: colors.info,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 4,
    marginTop: 2,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  googleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  googleIconContainer: {
    width: 48,
    height: 48,
  },
  cardLabelContainer: {
    marginTop: 'auto',
  },
  withText: {
    fontSize: 14,
    color: colors.gray500,
    fontWeight: '500',
  },
  providerName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.gray900,
  },
  horizontalRow: {
    flexDirection: 'row',
    gap: 16,
  },
  smallCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    aspectRatio: 1, // Small square
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  appleButtonWrapper: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  appleButton: {
    width: '100%',
    height: '100%',
  },
  smallCardLabels: {
    marginTop: 'auto',
  },
  withTextSmall: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: '500',
  },
  providerNameSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
  },
});
