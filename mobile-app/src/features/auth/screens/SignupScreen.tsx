import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Mail, Building2, Briefcase, ChevronDown, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { signUpWithEmail, signInWithGoogle } from '../../../services/auth/authService';
import { colors } from '../../../shared/constants/colors';

const { width } = Dimensions.get('window');

type SignupScreenProps = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [userRole, setUserRole] = useState('');

  // Step 2 Fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isConfirmPasswordHidden, setIsConfirmPasswordHidden] = useState(true);

  const emailInputRef = useRef<TextInput>(null);
  const clinicInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const handleNextStep = () => {
    if (!fullName || !email || !clinicName || !userRole) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSignUp = async () => {
    if (!password || !confirmPassword) {
      setError('Please set your password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Map UI role to backend role
      const backendRole = userRole === 'Clinic Owner' ? 'clinic_owner' :
        userRole === 'Dentist' ? 'doctor' :
          userRole === 'Receptionist' ? 'receptionist' : 'receptionist';

      const { user, error: signUpError } = await signUpWithEmail(email, password, backendRole);
      if (signUpError) {
        setError(signUpError);
      } else {
        // Here you would typically also save fullName, clinicName to the backend/profile
        console.log('User signed up, profile data:', { fullName, clinicName, userRole: backendRole });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Map UI role to backend role
      const backendRole = userRole === 'Clinic Owner' ? 'clinic_owner' :
        userRole === 'Dentist' ? 'doctor' :
          userRole === 'Receptionist' ? 'receptionist' : 'receptionist';

      const { user, error: signUpError } = await signInWithGoogle(backendRole);
      if (signUpError) {
        setError(signUpError);
      } else {
        // Successful Google sign up/in
        console.log('User signed up with Google with role:', backendRole);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputWrapper}>
          <User size={20} color={colors.gray400} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Dr. Sarah Johnson"
            placeholderTextColor={colors.gray400}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailInputRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Mail size={20} color={colors.gray400} style={styles.inputIcon} />
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder="sarah.j@clinic.com"
            placeholderTextColor={colors.gray400}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => clinicInputRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Clinic Name</Text>
        <View style={styles.inputWrapper}>
          <Building2 size={20} color={colors.gray400} style={styles.inputIcon} />
          <TextInput
            ref={clinicInputRef}
            style={styles.input}
            placeholder="Bright Smile Dental"
            placeholderTextColor={colors.gray400}
            value={clinicName}
            onChangeText={setClinicName}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>User Role</Text>
        <TouchableOpacity
          style={styles.inputWrapper}
          onPress={() => {
            // Simplified role selector for now
            const roles = ['Clinic Owner', 'Dentist', 'Receptionist'];
            const currentIndex = roles.indexOf(userRole);
            const nextIndex = (currentIndex + 1) % roles.length;
            setUserRole(roles[nextIndex]);
          }}
        >
          <Briefcase size={20} color={colors.gray400} style={styles.inputIcon} />
          <Text style={[styles.input, !userRole && { color: colors.gray400 }]}>
            {userRole || 'Select your role'}
          </Text>
          <ChevronDown size={20} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={handleNextStep}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          pressed && styles.buttonPressed
        ]}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or sign up with</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        onPress={handleGoogleSignUp}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.googleButton,
          pressed && styles.buttonPressed
        ]}
      >
        <View style={styles.googleButtonContent}>
          <View style={styles.googleIconPlaceholder}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>Sign up with Google</Text>
        </View>
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Set Password</Text>
        <View style={styles.inputWrapper}>
          <Lock size={20} color={colors.gray400} style={styles.inputIcon} />
          <TextInput
            ref={passwordInputRef}
            style={[styles.input, { letterSpacing: 2 }]}
            placeholder="........"
            placeholderTextColor={colors.gray400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={isPasswordHidden}
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
          />
          <TouchableOpacity onPress={() => setIsPasswordHidden(!isPasswordHidden)} style={styles.eyeIcon}>
            {isPasswordHidden ? (
              <EyeOff size={20} color={colors.gray400} />
            ) : (
              <Eye size={20} color={colors.gray400} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputWrapper}>
          <Lock size={20} color={colors.gray400} style={styles.inputIcon} />
          <TextInput
            ref={confirmPasswordInputRef}
            style={[styles.input, { letterSpacing: 2 }]}
            placeholder="........"
            placeholderTextColor={colors.gray400}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={isConfirmPasswordHidden}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
          />
          <TouchableOpacity onPress={() => setIsConfirmPasswordHidden(!isConfirmPasswordHidden)} style={styles.eyeIcon}>
            {isConfirmPasswordHidden ? (
              <EyeOff size={20} color={colors.gray400} />
            ) : (
              <Eye size={20} color={colors.gray400} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={handleSignUp}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
        )}
      </Pressable>

      <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to Account Details</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Progress Header */}
      <View style={[styles.progressHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.progressTextRow}>
          <Text style={styles.stepText}>STEP {step} OF 2</Text>
          <Text style={styles.stepLabel}>{step === 1 ? 'Account Details' : 'Security'}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: step === 1 ? '50%' : '100%' }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join our dental community and start managing your practice today.
            </Text>
          </View>

          {step === 1 ? renderStep1() : renderStep2()}

          <View style={styles.footerLegal}>
            <Text style={styles.legalText}>
              By clicking {step === 1 ? 'Continue' : 'Create Account'}, you agree to our{' '}
              <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Text>
          </View>

          <View style={styles.footerLinkRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  progressHeader: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.gray400,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.gray900,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray500,
    lineHeight: 22,
  },
  stepContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
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
  },
  eyeIcon: {
    padding: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: 16,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '600',
  },
  footerLegal: {
    marginTop: 20,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  legalText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray400,
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  footerText: {
    color: colors.gray500,
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.gray400,
    fontSize: 14,
  },
  googleButton: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  googleG: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: colors.gray900,
    fontSize: 16,
    fontWeight: '600',
  },
});

