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
import { 
  User, 
  Mail, 
  Building2, 
  Briefcase, 
  ChevronDown, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  Phone, 
  MapPin, 
  Stethoscope,
  ChevronRight,
  ArrowLeft,
  Users
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { signUpWithEmail } from '../../../services/auth/authService';
import { authApiService } from '../../../services/api/auth.api';
import { colors } from '../../../shared/constants/colors';
import { useAuth } from '../../../app/AuthContext';

const { width } = Dimensions.get('window');

type SignupScreenProps = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { refreshBackendUser, authProvider, user: firebaseUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Personal Details
  const [fullName, setFullName] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [specialty, setSpecialty] = useState('');

  // Step 2: Clinic Setup
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');

  // Step 3: Practice Metrics
  const [numberOfChairs, setNumberOfChairs] = useState('1');
  const [clinicCategory, setClinicCategory] = useState('General Dentistry');

  // Step 4: Account Security
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);

  // Refs for navigation
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const totalSteps = 4;

  const handleNextStep = () => {
    // Validation for each step
    if (step === 1) {
      if (!fullName || !personalPhone || !specialty) {
        setError('Please fill your details first, Dr.');
        return;
      }
    } else if (step === 2) {
      if (!clinicName || !clinicAddress) {
        setError('We need your clinic location to set up your practice.');
        return;
      }
    } else if (step === 3) {
      if (!numberOfChairs) {
        setError('Please specify your clinic capacity.');
        return;
      }
    }
    
    setError('');
    setStep(step + 1);
  };

  const handleBackStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinalSubmit = async () => {
    if (authProvider !== 'google') {
      if (!email || !password || password !== confirmPassword) {
        setError(password !== confirmPassword ? 'Passwords do not match' : 'Please complete all security fields');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Firebase Sign Up (Skip if already authenticated via Social)
      if (authProvider !== 'google' && authProvider !== 'apple') {
        const { user, error: signUpError } = await signUpWithEmail(email, password, 'clinic_owner');
        
        if (signUpError) {
          if (signUpError.includes('email-already-in-use')) {
            setError('This email is already in use. Try logging in with Google.');
          } else {
            setError(signUpError);
          }
          setIsLoading(false);
          return;
        }
      }

      // 2. Complete Onboarding with backend
      const onboardingData = {
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        clinic_phone: clinicPhone || personalPhone,
        clinic_email: authProvider === 'google' ? firebaseUser?.email || '' : email,
        specialization: specialty,
        number_of_chairs: parseInt(numberOfChairs) || 1,
        full_name: fullName,
        category: clinicCategory
      };

      const onboardingResult = await authApiService.completeOnboarding(onboardingData);
      
      if (onboardingResult.error) {
        console.warn('Backend onboarding partially failed:', onboardingResult.error);
        // We still let them in as user is created in Firebase and backend via OAuth hook
      }

      console.log('Signup and Onboarding complete!');
      
      // Refresh backend user to get the new clinic_id and trigger redirect
      await refreshBackendUser();
      
      // Navigation is handled by AuthContext state change in AppNavigator
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgress = () => (
    <View style={[styles.progressContainer, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.progressHeader}>
        <TouchableOpacity onPress={handleBackStep} disabled={step === 1}>
          <ArrowLeft size={24} color={step === 1 ? 'transparent' : colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.progressCounter}>Step {step} of {totalSteps}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationPlace}>
        <Stethoscope size={64} color={colors.primary} />
        <Text style={styles.dentistLine}>"A healthy smile starts with a great doctor. Let's get to know you!"</Text>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.cardTitle}>Professional Profile</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputWrapper}>
            <User size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Dr. Rajesh Kumar"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Personal Mobile</Text>
          <View style={styles.inputWrapper}>
            <Phone size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={personalPhone}
              onChangeText={setPersonalPhone}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Degree / Specialty</Text>
          <View style={styles.inputWrapper}>
            <Briefcase size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="BDS, MDS (Orthodontics)"
              value={specialty}
              onChangeText={setSpecialty}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationPlace}>
        <Building2 size={64} color={colors.primary} />
        <Text style={styles.dentistLine}>"Every clinic has a story. Tell us where the magic happens!"</Text>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.cardTitle}>Clinic Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clinic Brand Name</Text>
          <View style={styles.inputWrapper}>
            <Building2 size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="MolarPlus Dental Care"
              value={clinicName}
              onChangeText={setClinicName}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Address</Text>
          <View style={[styles.inputWrapper, { height: 80, alignItems: 'flex-start', paddingTop: 12 }]}>
            <MapPin size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              placeholder="Suite 405, MG Road, Pune..."
              multiline
              value={clinicAddress}
              onChangeText={setClinicAddress}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clinic Phone (Optional)</Text>
          <View style={styles.inputWrapper}>
            <Phone size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Leave blank to use personal"
              keyboardType="phone-pad"
              value={clinicPhone}
              onChangeText={setClinicPhone}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationPlace}>
        <Users size={64} color={colors.primary} />
        <Text style={styles.dentistLine}>"Growth matters! We'll help you manage your patient volume seamlessly."</Text>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.cardTitle}>Practice Insights</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Dental Chairs</Text>
          <View style={styles.row}>
            {['1', '2', '3', '4+'].map(val => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.selectorChip,
                  numberOfChairs === val && styles.selectorChipActive
                ]}
                onPress={() => setNumberOfChairs(val)}
              >
                <Text style={[
                  styles.selectorText,
                  numberOfChairs === val && styles.selectorTextActive
                ]}>{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clinic Focus Area</Text>
          <TouchableOpacity 
            style={styles.inputWrapper}
            onPress={() => {
              const areas = ['General Dentistry', 'Pediatric', 'Orthodontics', 'Cosmetic', 'Implants'];
              const idx = areas.indexOf(clinicCategory);
              setClinicCategory(areas[(idx + 1) % areas.length]);
            }}
          >
            <Check size={20} color={colors.primary} style={styles.inputIcon} />
            <Text style={styles.input}>{clinicCategory}</Text>
            <ChevronDown size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationPlace}>
        <Lock size={64} color={colors.primary} />
        <Text style={styles.dentistLine}>
          {authProvider === 'google' 
            ? "Your account is linked to Google. Your data is safe and secured by Google's world-class protection."
            : "Stay secure. Your clinical data is encrypted and protected with us."
          }
        </Text>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.cardTitle}>Account Security</Text>
        
        {authProvider === 'google' ? (
          <View style={styles.socialAuthInfo}>
            <View style={styles.socialAuthBadge}>
              <Check size={20} color={colors.success} />
              <Text style={styles.socialAuthText}>Linked with Google</Text>
            </View>
            <Text style={styles.socialAuthSubtext}>
              No separate password is required. You can continue to use your Google account ({firebaseUser?.email}) to access MolarPlus.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Official Email</Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="doctor@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Secure Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 characters"
                  secureTextEntry={isPasswordHidden}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setIsPasswordHidden(!isPasswordHidden)}>
                  {isPasswordHidden ? <EyeOff size={18} color={colors.gray400} /> : <Eye size={18} color={colors.gray400} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Check size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repeat password"
                  secureTextEntry={isPasswordHidden}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {renderProgress()}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
              ]}
              onPress={step === totalSteps ? handleFinalSubmit : handleNextStep}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.actionButtonText}>
                    {step === totalSteps ? 'Create My Clinic' : 'Continue'}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <TouchableOpacity 
              style={styles.alreadyHaveRow}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.alreadyHaveText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Log in</Text>
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
    backgroundColor: '#FFFFFF',
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressCounter: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepContent: {
    padding: 24,
  },
  illustrationPlace: {
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: colors.primary + '08',
    padding: 32,
    borderRadius: 30,
  },
  dentistLine: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.gray600,
    lineHeight: 22,
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 20,
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
    color: '#111827',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectorChip: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  selectorChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.gray600,
  },
  selectorTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    padding: 12,
    backgroundColor: colors.error + '10',
    marginHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + '20',
    marginTop: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: colors.primary,
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  alreadyHaveRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  alreadyHaveText: {
    color: colors.gray500,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  socialAuthInfo: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  socialAuthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '10',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    gap: 8,
  },
  socialAuthText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 15,
  },
  socialAuthSubtext: {
    color: colors.gray500,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});

