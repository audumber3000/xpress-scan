import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Shield,
  AlertCircle,
  Heart,
  UserPlus,
} from 'lucide-react-native';

const AddPatientScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    insurance: '',
    insuranceId: '',
    allergies: '',
    medicalConditions: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Create the patient object
      const newPatient = {
        id: Date.now(), // Temporary ID, will be replaced by backend
        name: `${formData.firstName} ${formData.lastName}`,
        phone: formData.phone,
        email: formData.email,
        dob: formData.dateOfBirth,
        gender: formData.gender,
        address: `${formData.address}${formData.city ? ', ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''} ${formData.zipCode}`.trim(),
        insurance: formData.insurance,
        insuranceId: formData.insuranceId,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()).filter(a => a) : [],
        medicalConditions: formData.medicalConditions ? formData.medicalConditions.split(',').map(c => c.trim()).filter(c => c) : [],
        emergencyContact: formData.emergencyContactName && formData.emergencyContactPhone 
          ? `${formData.emergencyContactName} - ${formData.emergencyContactPhone}` 
          : '',
        notes: formData.notes,
        lastVisit: 'New Patient',
        createdAt: new Date().toISOString(),
      };

      // Navigate to Patient File with the new patient data
      // Replace current screen so back button goes to patients list
      navigation.replace('PatientFile', { 
        patient: newPatient,
        isNewPatient: true 
      });
    } else {
      Alert.alert('Error', 'Please fill in all required fields');
    }
  };

  const InputField = ({ 
    icon: Icon, 
    label, 
    field, 
    placeholder, 
    keyboardType = 'default',
    multiline = false,
    required = false,
  }) => (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Icon size={16} color="#6b7280" />
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
          errors[field] && styles.inputError,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={formData[field]}
        onChangeText={(value) => updateField(field, value)}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
      {errors[field] && (
        <Text style={styles.errorText}>{errors[field]}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Add New Patient</Text>
          <Text style={styles.headerSubtitle}>Enter patient details</Text>
        </View>
        <View style={styles.headerIcon}>
          <UserPlus size={24} color="#ffffff" />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <InputField
                icon={User}
                label="First Name"
                field="firstName"
                placeholder="John"
                required
              />
            </View>
            <View style={styles.halfWidth}>
              <InputField
                icon={User}
                label="Last Name"
                field="lastName"
                placeholder="Doe"
                required
              />
            </View>
          </View>

          <InputField
            icon={Phone}
            label="Phone Number"
            field="phone"
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
            required
          />

          <InputField
            icon={Mail}
            label="Email"
            field="email"
            placeholder="john.doe@email.com"
            keyboardType="email-address"
          />

          <InputField
            icon={Calendar}
            label="Date of Birth"
            field="dateOfBirth"
            placeholder="MM/DD/YYYY"
          />

          {/* Gender Selection */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <User size={16} color="#6b7280" />
              <Text style={styles.label}>Gender</Text>
            </View>
            <View style={styles.genderRow}>
              {genderOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    formData.gender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => updateField('gender', option)}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      formData.gender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <InputField
            icon={MapPin}
            label="Street Address"
            field="address"
            placeholder="123 Main Street"
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <InputField
                icon={MapPin}
                label="City"
                field="city"
                placeholder="New York"
              />
            </View>
            <View style={styles.quarterWidth}>
              <InputField
                icon={MapPin}
                label="State"
                field="state"
                placeholder="NY"
              />
            </View>
            <View style={styles.quarterWidth}>
              <InputField
                icon={MapPin}
                label="ZIP"
                field="zipCode"
                placeholder="10001"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Insurance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance Information</Text>
          
          <InputField
            icon={Shield}
            label="Insurance Provider"
            field="insurance"
            placeholder="Delta Dental PPO"
          />

          <InputField
            icon={Shield}
            label="Insurance ID"
            field="insuranceId"
            placeholder="ABC123456789"
          />
        </View>

        {/* Medical Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          
          <InputField
            icon={AlertCircle}
            label="Allergies"
            field="allergies"
            placeholder="Penicillin, Latex (separate with commas)"
            multiline
          />

          <InputField
            icon={Heart}
            label="Medical Conditions"
            field="medicalConditions"
            placeholder="Hypertension, Diabetes (separate with commas)"
            multiline
          />
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          
          <InputField
            icon={User}
            label="Contact Name"
            field="emergencyContactName"
            placeholder="Jane Doe"
          />

          <InputField
            icon={Phone}
            label="Contact Phone"
            field="emergencyContactPhone"
            placeholder="+1 (555) 987-6543"
            keyboardType="phone-pad"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          
          <InputField
            icon={User}
            label="Notes"
            field="notes"
            placeholder="Any additional information about the patient..."
            multiline
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <UserPlus size={20} color="#ffffff" />
          <Text style={styles.submitButtonText}>Add Patient</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#16a34a',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  headerIcon: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontWeight: '500',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  quarterWidth: {
    flex: 0.5,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  genderOptionSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  genderOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  genderOptionTextSelected: {
    color: '#16a34a',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AddPatientScreen;
