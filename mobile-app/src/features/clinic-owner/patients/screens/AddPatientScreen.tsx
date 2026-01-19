import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Alert,
  Modal,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../../../app/AuthContext';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { colors } from '../../../../shared/constants/colors';
import { patientsApiService } from '../../../../services/api/patients.api';
import { treatmentApiService } from '../../../../services/api/treatment.api';

interface AddPatientScreenProps {
  visible: boolean;
  onClose: () => void;
  onPatientAdded: () => void;
}

export const AddPatientScreen: React.FC<AddPatientScreenProps> = ({
  visible,
  onClose,
  onPatientAdded,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const slideAnim = new Animated.Value(300);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    village: '',
    phone: '',
    referredBy: '',
    treatmentType: '',
    notes: '',
    paymentType: 'Cash',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [treatmentTypes, setTreatmentTypes] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [referringDoctors, setReferringDoctors] = useState<Array<{ id: number; name: string }>>([]);
  const [showTreatmentDropdown, setShowTreatmentDropdown] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
      
      // Load dropdown data
      loadDropdownData();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  const loadDropdownData = async () => {
    try {
      const [treatments, doctors] = await Promise.all([
        treatmentApiService.getTreatmentTypes(),
        treatmentApiService.getReferringDoctors(),
      ]);
      setTreatmentTypes(treatments);
      setReferringDoctors(doctors);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Patient name is required';
    }

    if (!formData.age.trim() || isNaN(Number(formData.age)) || Number(formData.age) < 0 || Number(formData.age) > 150) {
      newErrors.age = 'Valid age is required (0-150)';
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }

    if (!formData.village.trim()) {
      newErrors.village = 'Village is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.treatmentType.trim()) {
      newErrors.treatmentType = 'Treatment type is required';
    }
    
    // referred_by is optional, so no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 [PATIENT] Creating new patient...');
      
      const ageNumber = Number(formData.age);
      console.log('🔢 [PATIENT] Age conversion:', formData.age, '->', ageNumber, 'type:', typeof ageNumber);
      
      const patientData = {
        name: formData.name.trim(),
        age: ageNumber,
        gender: formData.gender,
        village: formData.village.trim(),
        phone: formData.phone.trim(),
        referred_by: formData.referredBy.trim() || 'None',
        treatment_type: formData.treatmentType.trim() || 'General Consultation',
        notes: formData.notes.trim() || null,
        payment_type: formData.paymentType,
      };

      console.log('📋 [PATIENT] Patient data being sent:', JSON.stringify(patientData, null, 2));
      await patientsApiService.createPatient(patientData);
      console.log('✅ [PATIENT] Patient created successfully');
      
      Alert.alert(
        'Success',
        'Patient registered successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              onPatientAdded();
              handleClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ [PATIENT] Create error:', error);
      Alert.alert(
        'Error',
        'Failed to register patient. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      onClose();
      // Reset form
      setFormData({
        name: '',
        age: '',
        gender: '',
        village: '',
        phone: '',
        referredBy: '',
        treatmentType: '',
        notes: '',
        paymentType: 'Cash',
      });
      setErrors({});
    });
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={colors.gray700} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Register New Patient</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Form Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <GearLoader text="Registering patient..." />
              </View>
            ) : (
              <View style={styles.form}>
                {/* Patient Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Patient Name *</Text>
                  <TextInput
                    style={[styles.input, errors.name && styles.inputError]}
                    value={formData.name}
                    onChangeText={(value) => updateFormData('name', value)}
                    placeholder="Enter patient name"
                    placeholderTextColor={colors.gray400}
                  />
                  {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                </View>

                {/* Age */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Age *</Text>
                  <TextInput
                    style={[styles.input, errors.age && styles.inputError]}
                    value={formData.age}
                    onChangeText={(value) => updateFormData('age', value)}
                    placeholder="Enter age"
                    placeholderTextColor={colors.gray400}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
                </View>

                {/* Gender */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Gender *</Text>
                  <View style={styles.genderContainer}>
                    {['Male', 'Female', 'Other'].map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        style={[
                          styles.genderOption,
                          formData.gender === gender && styles.genderOptionSelected
                        ]}
                        onPress={() => updateFormData('gender', gender)}
                      >
                        <Text style={[
                          styles.genderText,
                          formData.gender === gender && styles.genderTextSelected
                        ]}>
                          {gender}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
                </View>

                {/* Village */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Village *</Text>
                  <TextInput
                    style={[styles.input, errors.village && styles.inputError]}
                    value={formData.village}
                    onChangeText={(value) => updateFormData('village', value)}
                    placeholder="Enter village"
                    placeholderTextColor={colors.gray400}
                  />
                  {errors.village && <Text style={styles.errorText}>{errors.village}</Text>}
                </View>

                {/* Phone Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    style={[styles.input, errors.phone && styles.inputError]}
                    value={formData.phone}
                    onChangeText={(value) => updateFormData('phone', value)}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.gray400}
                    keyboardType="phone-pad"
                  />
                  {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                </View>

                {/* Referred By */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Referred By (Doctor)</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.dropdownInput]}
                    onPress={() => setShowDoctorDropdown(true)}
                  >
                    <Text style={[styles.dropdownText, !formData.referredBy && styles.placeholderText]}>
                      {formData.referredBy || 'Select referring doctor (optional)'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Treatment Type */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Treatment Type *</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.dropdownInput, errors.treatmentType && styles.inputError]}
                    onPress={() => setShowTreatmentDropdown(true)}
                  >
                    <Text style={[styles.dropdownText, !formData.treatmentType && styles.placeholderText]}>
                      {formData.treatmentType || 'Select treatment type'}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                  {errors.treatmentType && <Text style={styles.errorText}>{errors.treatmentType}</Text>}
                </View>

                {/* Payment Type */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Payment Type</Text>
                  <View style={styles.paymentContainer}>
                    {['Cash', 'Card', 'Insurance'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.paymentOption,
                          formData.paymentType === type && styles.paymentOptionSelected
                        ]}
                        onPress={() => updateFormData('paymentType', type)}
                      >
                        <Text style={[
                          styles.paymentText,
                          formData.paymentType === type && styles.paymentTextSelected
                        ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.notes}
                    onChangeText={(value) => updateFormData('notes', value)}
                    placeholder="Enter additional notes"
                    placeholderTextColor={colors.gray400}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity 
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.submitButtonContent}>
                      <GearLoader size={20} color={colors.white} />
                      <Text style={styles.submitButtonText}>Registering...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitButtonText}>Register Patient</Text>
                  )}
                </TouchableOpacity>

                <View style={{ height: 20 }} />
              </View>
            )}
          </ScrollView>

        {/* Treatment Type Dropdown Modal */}
        <Modal
          visible={showTreatmentDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTreatmentDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowTreatmentDropdown(false)}
          >
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Select Treatment Type</Text>
                <TouchableOpacity onPress={() => setShowTreatmentDropdown(false)}>
                  <Text style={styles.dropdownClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.dropdownList}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    updateFormData('treatmentType', 'General Consultation');
                    setShowTreatmentDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>General Consultation</Text>
                  <Text style={styles.dropdownItemPrice}>₹2000</Text>
                </TouchableOpacity>
                {treatmentTypes.length === 0 ? (
                  <View style={styles.dropdownItem}>
                    <Text style={[styles.dropdownItemText, styles.placeholderText]}>No treatment types available</Text>
                  </View>
                ) : (
                  treatmentTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        updateFormData('treatmentType', type.name);
                        setShowTreatmentDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{type.name}</Text>
                      <Text style={styles.dropdownItemPrice}>₹{type.price}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Referring Doctor Dropdown Modal */}
        <Modal
          visible={showDoctorDropdown}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDoctorDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowDoctorDropdown(false)}
          >
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Select Referring Doctor</Text>
                <TouchableOpacity onPress={() => setShowDoctorDropdown(false)}>
                  <Text style={styles.dropdownClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.dropdownList}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    updateFormData('referredBy', 'None');
                    setShowDoctorDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>None</Text>
                </TouchableOpacity>
                {referringDoctors.length === 0 ? (
                  <View style={styles.dropdownItem}>
                    <Text style={[styles.dropdownItemText, styles.placeholderText]}>No referring doctors available</Text>
                  </View>
                ) : (
                  referringDoctors.map((doctor) => (
                    <TouchableOpacity
                      key={doctor.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        updateFormData('referredBy', doctor.name);
                        setShowDoctorDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{doctor.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: colors.gray900,
    flex: 1,
  },
  placeholderText: {
    color: colors.gray400,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.gray400,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  genderText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  genderTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  paymentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  paymentTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: colors.primaryDark || colors.primary,
    opacity: 0.8,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  dropdownClose: {
    fontSize: 18,
    color: colors.gray500,
    width: 30,
    height: 30,
    textAlign: 'center',
    lineHeight: 30,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownItemText: {
    fontSize: 16,
    color: colors.gray900,
    flex: 1,
  },
  dropdownItemPrice: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
