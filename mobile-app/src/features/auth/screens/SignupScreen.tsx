import React, { useState, useRef, useEffect } from 'react';
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
  Alert,
  Modal,
  FlatList,
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
  Users,
  Globe,
  Search,
  X,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { signUpWithEmail } from '../../../services/auth/authService';
import { authApiService } from '../../../services/api/auth.api';
import { detectCountryAsync, flagEmoji } from '../../../shared/utils/detectCountry';
import { colors } from '../../../shared/constants/colors';
import { AuthInput } from '../components/AuthInput';
import { useAuth } from '../../../app/AuthContext';
import { getApiBaseUrl } from '../../../config/api.config';

interface CountryOption {
  code: string;
  name: string;
  currency_symbol: string;
  currency_code: string;
  phone_code: string;
}

const { width } = Dimensions.get('window');

type SignupScreenProps = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { refreshBackendUser, authProvider, user: firebaseUser, appleFullName } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Personal Details
  // For Apple sign-up, pre-fill the name from Apple's first-time-only
  // AuthenticationServices response so we never re-prompt the user
  // (App Store guideline 4 — required by Apple Review).
  const [fullName, setFullName] = useState(appleFullName || '');
  const [personalPhone, setPersonalPhone] = useState('');
  const [specialty, setSpecialty] = useState('');

  // Step 2: Clinic Setup
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Load the supported-country list and auto-detect the user's country (still changeable).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/clinics/countries`);
        if (res.ok) setCountries(await res.json());
      } catch {
        /* offline — picker just shows the detected code */
      }
      const detected = await detectCountryAsync();
      setCountry(detected);
    })();
  }, []);

  // Step 3: Practice Metrics
  const [numberOfChairs, setNumberOfChairs] = useState('1');
  const [clinicCategory, setClinicCategory] = useState('General Dentistry');

  // Step 4: Account Security
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  // Reveals inline field errors once the user tries to advance / submit.
  const [triedNext, setTriedNext] = useState(false);

  // Per-field validity (mirrors the web's ValidatedInput checks).
  const isNonEmpty = (s: string) => s.trim().length > 0;
  const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  const pwLongEnough = password.length >= 8;
  const pwMatches = confirmPassword.length > 0 && password === confirmPassword;

  // Refs for navigation
  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  const totalSteps = 4;

  const handleNextStep = () => {
    // Validation for each step
    if (step === 1) {
      if (!isNonEmpty(fullName) || !isNonEmpty(personalPhone) || !isNonEmpty(specialty)) {
        setTriedNext(true);
        setError('Please fill in the required fields to continue.');
        return;
      }
    } else if (step === 2) {
      if (!isNonEmpty(clinicName) || !isNonEmpty(clinicAddress)) {
        setTriedNext(true);
        setError('Please fill in the required fields to continue.');
        return;
      }
    } else if (step === 3) {
      if (!numberOfChairs) {
        setTriedNext(true);
        setError('Please specify your clinic capacity.');
        return;
      }
    }

    setError('');
    setTriedNext(false);
    setStep(step + 1);
  };

  const handleBackStep = () => {
    if (step > 1) {
      setError('');
      setTriedNext(false);
      setStep(step - 1);
    }
  };

  const isSocialAuth = authProvider === 'google' || authProvider === 'apple';

  const handleFinalSubmit = async () => {
    if (!isSocialAuth) {
      if (!isValidEmail(email) || !pwLongEnough || password !== confirmPassword) {
        setTriedNext(true);
        if (!isValidEmail(email)) setError('Please enter a valid email address.');
        else if (!pwLongEnough) setError('Password must be at least 8 characters.');
        else setError('Passwords do not match.');
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
        clinic_email: (authProvider === 'google' || authProvider === 'apple')
          ? (firebaseUser?.email || '')
          : email,
        specialization: specialty,
        number_of_chairs: parseInt(numberOfChairs) || 1,
        full_name: fullName,
        category: clinicCategory,
        country: country || (await detectCountryAsync()),
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
      <Text style={styles.stepTitle}>Your details</Text>
      <Text style={styles.stepSubtitle}>Tell us a bit about yourself.</Text>

      <AuthInput
        label="Full Name"
        placeholder="Dr. Rajesh Kumar"
        value={fullName}
        onChangeText={setFullName}
        isValid={isNonEmpty(fullName)}
        errorText="Full name is required"
        forceShowError={triedNext}
      />
      <AuthInput
        label="Personal Mobile"
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
        value={personalPhone}
        onChangeText={setPersonalPhone}
        isValid={isNonEmpty(personalPhone)}
        errorText="Mobile number is required"
        forceShowError={triedNext}
      />
      <AuthInput
        label="Degree / Specialty"
        placeholder="BDS, MDS (Orthodontics)"
        value={specialty}
        onChangeText={setSpecialty}
        isValid={isNonEmpty(specialty)}
        errorText="Degree / specialty is required"
        forceShowError={triedNext}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your clinic</Text>
      <Text style={styles.stepSubtitle}>Where your practice is based.</Text>

      <AuthInput
        label="Clinic Brand Name"
        placeholder="MolarPlus Dental Care"
        value={clinicName}
        onChangeText={setClinicName}
        isValid={isNonEmpty(clinicName)}
        errorText="Clinic name is required"
        forceShowError={triedNext}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Country</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => setCountryModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectText, { color: country ? '#111827' : '#9CA3AF' }]}>
            {country
              ? `${flagEmoji(country)}  ${countries.find((c) => c.code === country)?.name || country}`
              : 'Select country'}
          </Text>
          <ChevronDown size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Full Address</Text>
        <View style={[styles.selectField, styles.textArea, triedNext && !isNonEmpty(clinicAddress) && styles.fieldError]}>
          <TextInput
            style={[styles.selectText, { flex: 1, textAlignVertical: 'top' }]}
            placeholder="Suite 405, MG Road, Pune..."
            placeholderTextColor="#9CA3AF"
            multiline
            value={clinicAddress}
            onChangeText={setClinicAddress}
          />
        </View>
        {triedNext && !isNonEmpty(clinicAddress) && (
          <Text style={styles.fieldErrorText}>Clinic address is required</Text>
        )}
      </View>

      <AuthInput
        label="Clinic Phone (Optional)"
        placeholder="Leave blank to use personal"
        keyboardType="phone-pad"
        value={clinicPhone}
        onChangeText={setClinicPhone}
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Your practice</Text>
      <Text style={styles.stepSubtitle}>A few details to tailor your setup.</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Number of Dental Chairs</Text>
        <View style={styles.chipRow}>
          {['1', '2', '3', '4+'].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.selectorChip, numberOfChairs === val && styles.selectorChipActive]}
              onPress={() => setNumberOfChairs(val)}
            >
              <Text style={[styles.selectorText, numberOfChairs === val && styles.selectorTextActive]}>
                {val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Clinic Focus Area</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => {
            const areas = ['General Dentistry', 'Pediatric', 'Orthodontics', 'Cosmetic', 'Implants'];
            const idx = areas.indexOf(clinicCategory);
            setClinicCategory(areas[(idx + 1) % areas.length]);
          }}
        >
          <Text style={styles.selectText}>{clinicCategory}</Text>
          <ChevronDown size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{isSocialAuth ? 'Confirm & finish' : 'Account security'}</Text>
      <Text style={styles.stepSubtitle}>
        {isSocialAuth ? 'Review and create your clinic.' : 'Set the password for your account.'}
      </Text>

      {isSocialAuth ? (
        <View style={styles.socialAuthInfo}>
          <View style={styles.socialAuthBadge}>
            <Check size={20} color={colors.success} />
            <Text style={styles.socialAuthText}>
              {authProvider === 'apple' ? 'Linked with Apple' : 'Linked with Google'}
            </Text>
          </View>
          <Text style={styles.socialAuthSubtext}>
            {authProvider === 'apple'
              ? `No password needed. Your account is secured by Sign in with Apple${firebaseUser?.email ? ` (${firebaseUser.email})` : ''}.`
              : `No separate password is required. You can continue to use your Google account (${firebaseUser?.email}) to access MolarPlus.`}
          </Text>
        </View>
      ) : (
        <>
          <AuthInput
            label="Official Email"
            placeholder="doctor@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            isValid={isValidEmail(email)}
            errorText="Enter a valid email address"
            forceShowError={triedNext}
          />
          <AuthInput
            label="Secure Password"
            placeholder="Min. 8 characters"
            isPassword
            value={password}
            onChangeText={setPassword}
            isValid={pwLongEnough}
            errorText="Use at least 8 characters"
            forceShowError={triedNext}
          />
          <AuthInput
            label="Confirm Password"
            placeholder="Repeat password"
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isValid={pwMatches}
            errorText="Passwords do not match"
            forceShowError={triedNext}
          />

          {(password.length > 0 || confirmPassword.length > 0) && (
            <View style={styles.pwReqs}>
              <View style={styles.pwReqRow}>
                <Check size={14} color={pwLongEnough ? '#10B981' : '#D1D5DB'} />
                <Text style={[styles.pwReqText, pwLongEnough && styles.pwReqTextMet]}>
                  At least 8 characters
                </Text>
              </View>
              <View style={styles.pwReqRow}>
                <Check size={14} color={pwMatches ? '#10B981' : '#D1D5DB'} />
                <Text style={[styles.pwReqText, pwMatches && styles.pwReqTextMet]}>
                  Passwords match
                </Text>
              </View>
            </View>
          )}
        </>
      )}
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
                <Text style={styles.actionButtonText}>
                  {step === totalSteps ? 'Create account' : 'Continue'}
                </Text>
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

      {/* Country picker */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select country</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <Search size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country"
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={countries.filter((c) =>
                c.name.toLowerCase().includes(countrySearch.trim().toLowerCase())
              )}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              renderItem={({ item }) => {
                const selected = item.code === country;
                return (
                  <TouchableOpacity
                    style={styles.countryRow}
                    onPress={() => {
                      setCountry(item.code);
                      setCountrySearch('');
                      setCountryModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.countryFlag}>{flagEmoji(item.code)}</Text>
                    <Text style={styles.countryName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.countryCur}>{item.currency_symbol}</Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
    borderRadius: 12,
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
    borderRadius: 20,
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
  pwReqs: {
    marginTop: 2,
    marginBottom: 4,
    gap: 6,
  },
  pwReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pwReqText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  pwReqTextMet: {
    color: '#059669',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  selectText: {
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  fieldError: {
    borderColor: '#FCA5A5',
  },
  fieldErrorText: {
    marginTop: 5,
    fontSize: 12,
    color: '#EF4444',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  _legacyActionButton: {
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
    fontSize: 16,
    fontWeight: '700',
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
  // Country picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryFlag: {
    fontSize: 22,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  countryCur: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});

