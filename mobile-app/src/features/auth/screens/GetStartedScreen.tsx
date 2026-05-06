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

        {/* Auth Pills — three full-width horizontal buttons.
            Apple gets its native HIG button (iOS only); Google and Email
            use matching custom pills sized to the same dimensions. */}
        <View style={styles.cardsContainer}>
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={26}
              style={styles.applePill}
              onPress={handleAppleRegister}
            />
          )}

          <TouchableOpacity
            style={styles.providerPill}
            onPress={handleGoogleRegister}
            activeOpacity={0.85}
          >
            <GoogleIcon size={22} />
            <Text style={styles.providerPillText}>Sign up with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.providerPill}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.85}
          >
            <Mail size={22} color={colors.gray900} />
            <Text style={styles.providerPillText}>Sign up with Email</Text>
          </TouchableOpacity>
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
    gap: 12,
    marginBottom: 40,
  },
  applePill: {
    width: '100%',
    height: 52,
  },
  providerPill: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  providerPillText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray900,
  },
});
