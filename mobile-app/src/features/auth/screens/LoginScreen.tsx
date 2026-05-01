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
import { signInWithGoogle } from '../../../services/auth/authService';
import { useAuth } from '../../../app/AuthContext';
import { colors } from '../../../shared/constants/colors';
import { GoogleIcon } from '../../../shared/components/icons/GoogleIcon';
import { AppleIcon } from '../../../shared/components/icons/AppleIcon';

const { width } = Dimensions.get('window');

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [viewMode, setViewMode] = useState<'gateway' | 'email'>('gateway');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const passwordInputRef = useRef<TextInput>(null);
  const { signInEmail } = useAuth();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { user, error } = await signInWithGoogle();
      if (error) {
        if (error.includes('User does not exist')) {
          Alert.alert('Register Required', 'User does not exist. Please register first to continue.', [
            { text: 'Register', onPress: () => navigation.navigate('GetStarted') },
            { text: 'Cancel', style: 'cancel' }
          ]);
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

  const handleAppleLogin = () => {
    if (Platform.OS === 'android') {
      toast.info('Apple Sign-In is only supported on iOS devices.');
    } else {
      toast.info('Apple Sign-In for iOS is being finalized.');
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
          Alert.alert('Register Required', 'User does not exist. Please register first to continue.', [
            { text: 'Register', onPress: () => setViewMode('gateway') }, // or navigation.navigate('GetStarted')
            { text: 'Cancel', style: 'cancel' }
          ]);
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

  
  // 2/3 of total horizontal width (with 28 padding on each side)
  const googleCardWidth = (width - 56) * 2 / 3;

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
        
        <TouchableOpacity 
          style={styles.subtitleRow}
          onPress={() => navigation.navigate('GetStarted')}
        >
          <Text style={styles.subtitleText}>New here? </Text>
          <Text style={styles.linkText}>Register here</Text>
          <ChevronRight size={16} color={colors.info} style={styles.chevron} />
        </TouchableOpacity>
      </View>

      {/* Auth Cards */}
      <View style={styles.cardsContainer}>
        {/* Row 1: Large Google Square (2/3 width) */}
        <TouchableOpacity 
          style={[styles.googleCard, { width: googleCardWidth, height: googleCardWidth }]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <GoogleIcon size={48} />
              </View>
              <View style={styles.cardLabelContainer}>
                <Text style={styles.withText}>with</Text>
                <Text style={styles.providerName}>Google</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Row 2: Apple and Email horizontal */}
        <View style={styles.horizontalRow}>
          <TouchableOpacity 
            style={styles.smallCard}
            onPress={handleAppleLogin}
          >
            <AppleIcon size={24} color={colors.gray900} />
            <View style={styles.smallCardLabels}>
              <Text style={styles.withTextSmall}>with</Text>
              <Text style={styles.providerNameSmall}>Apple</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.smallCard}
            onPress={() => setViewMode('email')}
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

      <Text style={[styles.title, { fontSize: 36, marginBottom: 40 }]}>Login with Email or Username</Text>

      <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email or Username</Text>
          <View style={styles.inputWrapper}>
            <Mail size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="doctor@molarplus.com or reception1"
              value={email}
              onChangeText={setEmail}
              keyboardType={email.includes('@') ? 'email-address' : 'default'}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Lock size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              ref={passwordInputRef}
              style={[styles.input, { letterSpacing: 2 }]}
              placeholder="........"
              secureTextEntry={isPasswordHidden}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setIsPasswordHidden(!isPasswordHidden)}>
              {isPasswordHidden ? <EyeOff size={18} color={colors.gray400} /> : <Eye size={18} color={colors.gray400} />}
            </TouchableOpacity>
          </View>
        </View>

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
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {viewMode === 'gateway' ? renderGateway() : renderEmailForm()}
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
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 60,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: 28,
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
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
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
