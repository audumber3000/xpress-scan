import React, { useState, useRef } from 'react';
import {
  TextInput,
  ActivityIndicator,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  Alert,
  Image
} from 'react-native';
import { toast } from '../../../shared/components/toastService';

import {
  ChevronRight,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { signInWithGoogle, signInWithApple, resetPassword } from '../../../services/auth/authService';
import { authApiService } from '../../../services/api/auth.api';
import { AuthInput } from '../components/AuthInput';
import { useAuth } from '../../../app/AuthContext';
import { colors } from '../../../shared/constants/colors';
import { spacing } from '../../../shared/constants/theme';
import { GoogleIcon } from '../../../shared/components/icons/GoogleIcon';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LastLoginCard } from '../components/LastLoginCard';
import type { LastLoginProvider } from '../../../services/auth/lastLogin';
import { IS_SIGNUP_ENABLED, MARKETING_SITE_TEXT } from '../../../shared/constants/platform';

const { width } = Dimensions.get('window');

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [viewMode, setViewMode] = useState<'gateway' | 'email' | 'forgot'>('gateway');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resetPreview, setResetPreview] = useState<{
    found: boolean;
    name?: string;
    clinic_name?: string | null;
    has_password?: boolean;
  } | null>(null);
  const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  const passwordInputRef = useRef<TextInput>(null);
  const { signInEmail, setAppleFullName } = useAuth();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { user, error } = await signInWithGoogle();
      if (error) {
        if (error.includes('User does not exist')) {
          if (IS_SIGNUP_ENABLED) {
            Alert.alert('Register Required', 'User does not exist. Please register first to continue.', [
              { text: 'Register', onPress: () => navigation.navigate('GetStarted') },
              { text: 'Cancel', style: 'cancel' }
            ]);
          } else {
            // iOS: cannot direct user to in-app registration. Tell them to
            // set up a clinic on the web instead.
            Alert.alert(
              'No clinic found',
              `We couldn't find a clinic linked to that account. Please set up your clinic on ${MARKETING_SITE_TEXT} and then sign in here.`,
              [{ text: 'OK', style: 'cancel' }]
            );
          }
        } else {
          toast.error(error || 'Login failed');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const { user, appleFullName, error } = await signInWithApple();
      if (error) {
        if (error === 'Sign in was cancelled') return;
        if (error.includes('User does not exist')) {
          if (IS_SIGNUP_ENABLED) {
            Alert.alert('Register Required', 'User does not exist. Please register first to continue.', [
              { text: 'Register', onPress: () => navigation.navigate('GetStarted') },
              { text: 'Cancel', style: 'cancel' }
            ]);
          } else {
            // iOS: cannot direct user to in-app registration. Tell them to
            // set up a clinic on the web instead.
            Alert.alert(
              'No clinic found',
              `We couldn't find a clinic linked to that account. Please set up your clinic on ${MARKETING_SITE_TEXT} and then sign in here.`,
              [{ text: 'OK', style: 'cancel' }]
            );
          }
        } else {
          toast.error(error);
        }
        return;
      }
      // Apple only returns fullName on the very first authorization for an
      // Apple ID. For login (existing user) it'll be null — that's expected.
      if (appleFullName) setAppleFullName(appleFullName);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.warning('Please enter your email or username and password');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signInEmail(email, password);
      if (error) {
        if (error.includes('User does not exist')) {
          if (IS_SIGNUP_ENABLED) {
            Alert.alert('Register Required', 'User does not exist. Please register first to continue.', [
              { text: 'Register', onPress: () => setViewMode('gateway') },
              { text: 'Cancel', style: 'cancel' }
            ]);
          } else {
            Alert.alert(
              'No clinic found',
              `We couldn't find a clinic linked to that account. Please set up your clinic on ${MARKETING_SITE_TEXT} and then sign in here.`,
              [{ text: 'OK', style: 'cancel' }]
            );
          }
        } else {
          toast.error(error || 'Login failed');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueLast = (provider: LastLoginProvider) => {
    if (provider === 'google') return handleGoogleLogin();
    if (provider === 'apple') return handleAppleLogin();
    setViewMode('email');
  };

  const openForgot = () => {
    setResetEmail(email.includes('@') ? email : '');
    setResetSent(false);
    setResetPreview(null);
    setViewMode('forgot');
  };

  // Step 1: confirm the account exists and show whose it is before sending.
  const handleLookup = async () => {
    if (!isValidEmail(resetEmail)) {
      setResetPreview({ found: false });
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await authApiService.accountPreview(resetEmail.trim());
      setResetPreview(preview);
    } catch {
      setResetPreview({ found: false });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 2: actually send the reset link for the confirmed account.
  const handleSendReset = async () => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(resetEmail.trim());
      if (error) {
        toast.error(error);
      } else {
        setResetSent(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderGateway = () => (
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
        <Text style={styles.title}>Login</Text>

        {IS_SIGNUP_ENABLED ? (
          <TouchableOpacity
            style={styles.subtitleRow}
            onPress={() => navigation.navigate('GetStarted')}
          >
            <Text style={styles.subtitleText}>New here? </Text>
            <Text style={styles.linkText}>Register here</Text>
            <ChevronRight size={16} color={colors.info} style={styles.chevron} />
          </TouchableOpacity>
        ) : (
          // iOS: no in-app registration. Plain, non-tappable copy that
          // mentions the website without a CTA verb. Apple forbids buttons
          // or links that direct users to external purchase mechanisms.
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitleText}>
              Don't have a clinic yet? Visit{' '}
              <Text style={styles.subtitleSiteText}>{MARKETING_SITE_TEXT}</Text>
              {' '}to set one up.
            </Text>
          </View>
        )}
      </View>

      {/* Last-login one-tap shortcut, if any */}
      <LastLoginCard variant="login" onContinue={handleContinueLast} isLoading={isLoading} />

      {/* Auth Pills — three full-width horizontal buttons.
          Apple gets its own native HIG button (iOS only); Google and
          Email use matching custom pills sized to the same dimensions. */}
      <View style={styles.cardsContainer}>
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={26}
            style={styles.applePill}
            onPress={handleAppleLogin}
          />
        )}

        <TouchableOpacity
          style={styles.providerPill}
          onPress={handleGoogleLogin}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <GoogleIcon size={22} />
              <Text style={styles.providerPillText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.providerPill}
          onPress={() => setViewMode('email')}
          activeOpacity={0.85}
        >
          <Mail size={22} color={colors.gray900} />
          <Text style={styles.providerPillText}>Continue with Email</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderEmailForm = () => (
    <ScrollView 
      style={styles.content}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <TouchableOpacity 
        style={[styles.iconCircle, { width: 56, height: 56, marginBottom: 32 }]}
        onPress={() => setViewMode('gateway')}
      >
        <ArrowLeft size={24} color={colors.gray900} />
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: 32, marginBottom: 8 }]}>Welcome back</Text>
      <Text style={styles.formSubtitle}>Log in with your email or username.</Text>

      <AuthInput
        label="Email or Username"
        placeholder="doctor@molarplus.com or reception1"
        value={email}
        onChangeText={setEmail}
        keyboardType={email.includes('@') ? 'email-address' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      <AuthInput
        label="Password"
        placeholder="Enter your password"
        isPassword
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={openForgot} style={styles.forgotRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginBtn}
        onPress={handleEmailLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginBtnText}>Login</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderForgotForm = () => {
    const account = resetPreview?.found ? resetPreview : null;
    const notFound = resetPreview != null && !resetPreview.found;

    // Phase 3 — link sent.
    if (resetSent) {
      return (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <TouchableOpacity
            style={[styles.iconCircle, { width: 56, height: 56, marginBottom: 32 }]}
            onPress={() => setViewMode('email')}
          >
            <ArrowLeft size={24} color={colors.gray900} />
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: 32, marginBottom: 8 }]}>Check your inbox</Text>
          <Text style={styles.formSubtitle}>
            We've sent a password reset link to {resetEmail.trim()}. Open it to set a new password.
          </Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => setViewMode('email')}>
            <Text style={styles.loginBtnText}>Back to login</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity
          style={[styles.iconCircle, { width: 56, height: 56, marginBottom: 32 }]}
          onPress={() => (account ? setResetPreview(null) : setViewMode('email'))}
        >
          <ArrowLeft size={24} color={colors.gray900} />
        </TouchableOpacity>

        <Text style={[styles.title, { fontSize: 32, marginBottom: 8 }]}>Reset password</Text>
        <Text style={styles.formSubtitle}>
          {account
            ? 'We found your account. Confirm it below to get a reset link.'
            : "Enter your account email and we'll find your account."}
        </Text>

        {/* Step 2 — confirm the matched account */}
        {account ? (
          <>
            <View style={styles.accountCard}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {(account.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName} numberOfLines={1}>{account.name || 'Your account'}</Text>
                {!!account.clinic_name && (
                  <Text style={styles.accountClinic} numberOfLines={1}>{account.clinic_name}</Text>
                )}
                <Text style={styles.accountEmail} numberOfLines={1}>{resetEmail.trim()}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleSendReset} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Send reset link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.useDifferentRow} onPress={() => setResetPreview(null)}>
              <Text style={styles.useDifferentText}>Use a different email</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Step 1 — enter email */
          <>
            <AuthInput
              label="Email address"
              placeholder="doctor@molarplus.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={resetEmail}
              onChangeText={(t) => { setResetEmail(t); if (resetPreview) setResetPreview(null); }}
              isValid={isValidEmail(resetEmail)}
              errorText="Enter a valid email address"
            />

            {notFound && (
              <Text style={styles.noticeText}>
                We couldn't find an account with that email. Double-check it, or register a new clinic.
              </Text>
            )}

            <TouchableOpacity style={styles.loginBtn} onPress={handleLookup} disabled={previewLoading}>
              {previewLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Find my account</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {viewMode === 'gateway'
          ? renderGateway()
          : viewMode === 'forgot'
          ? renderForgotForm()
          : renderEmailForm()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: spacing[7],
    paddingTop: 40,
    paddingBottom: 60,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: spacing[7],
    paddingTop: 60,
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
  subtitleSiteText: {
    fontSize: 16,
    color: colors.gray900,
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray500,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.gray900,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 28,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  accountClinic: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 1,
  },
  accountEmail: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  noticeText: {
    fontSize: 13,
    color: colors.gray500,
    marginBottom: 16,
    lineHeight: 19,
  },
  useDifferentRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  useDifferentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
