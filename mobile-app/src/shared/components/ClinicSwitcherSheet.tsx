import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Dimensions,
  Image
} from 'react-native';
import { X, Plus, Check, MapPin, Building } from 'lucide-react-native';
import { useAuth } from '../../app/AuthContext';
import { ClinicInfo } from '../../services/api/auth.api';

interface ClinicSwitcherSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onClinicSelected: (clinic: ClinicInfo) => void;
}

// Temporary mapping for demo images if none provided by API
const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=2670&auto=format&fit=crop', // Modern Clinic 1
  'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=2670&auto=format&fit=crop', // Modern Clinic 2
  'https://images.unsplash.com/photo-1590105577767-e21a1067899f?q=80&w=2670&auto=format&fit=crop', // Modern Clinic 3
];

export const ClinicSwitcherSheet: React.FC<ClinicSwitcherSheetProps> = ({
  isVisible,
  onClose,
  onClinicSelected
}) => {
  const { backendUser, refreshBackendUser } = useAuth();
  const clinics = backendUser?.clinics || [];
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicAddress, setNewClinicAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);

  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [isVisible, screenHeight]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleAddBranch = async () => {
    if (!newClinicName.trim()) {
      Alert.alert('Error', 'Branch name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      Alert.alert('Success', 'Branch added successfully');
      setIsAdding(false);
      setNewClinicName('');
      setNewClinicAddress('');
      await refreshBackendUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to add branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderClinicItem = ({ item, index }: { item: ClinicInfo, index: number }) => {
    const isSelected = backendUser?.clinic?.id === item.id;
    const branchImage = item.imageUrl || DEMO_IMAGES[index % DEMO_IMAGES.length];

    return (
      <TouchableOpacity
        style={[styles.clinicItem, isSelected && styles.selectedClinicItem]}
        onPress={() => {
          onClinicSelected(item);
          handleClose();
        }}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: branchImage }} 
            style={styles.branchImage} 
            resizeMode="cover"
          />
        </View>
        <View style={styles.clinicDetails}>
          <Text style={[styles.clinicName, isSelected && styles.selectedText]}>
            {item.name}
          </Text>
          {item.address && (
            <Text style={[styles.clinicAddress, isSelected && styles.selectedTextSecondary]}>
              <MapPin size={12} color={isSelected ? 'rgba(255,255,255,0.7)' : '#6B7280'} /> {item.address}
            </Text>
          )}
        </View>
        {isSelected ? (
          <View style={styles.checkContainer}>
            <Check size={18} color="#2E2A85" />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.rootContainer,
        { opacity: opacityAnim, pointerEvents: isVisible ? 'auto' : 'none' } as any
      ]}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <TouchableOpacity activeOpacity={1} style={styles.sheetContent}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>
                  {isAdding ? 'Add New Branch' : 'Select Branch'}
                </Text>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <X size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              {isAdding ? (
                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Branch Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter branch name"
                      value={newClinicName}
                      onChangeText={setNewClinicName}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter branch address"
                      value={newClinicAddress}
                      onChangeText={setNewClinicAddress}
                    />
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setIsAdding(false)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.submitButton]}
                      onPress={handleAddBranch}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>Add Branch</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <FlatList
                  data={clinics}
                  renderItem={(info) => renderClinicItem({ item: info.item, index: info.index })}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  ListFooterComponent={
                    <TouchableOpacity
                      style={styles.addClinicButton}
                      onPress={() => setIsAdding(true)}
                    >
                      <Plus size={20} color="#2E2A85" />
                      <Text style={styles.addClinicText}>Add New Branch</Text>
                    </TouchableOpacity>
                  }
                />
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 100,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  clinicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  selectedClinicItem: {
    backgroundColor: '#2E2A85',
    borderColor: '#2E2A85',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginRight: 16,
  },
  branchImage: {
    width: '100%',
    height: '100%',
  },
  clinicDetails: {
    flex: 1,
  },
  clinicName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  clinicAddress: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 16,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  selectedTextSecondary: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addClinicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#2E2A85',
    borderStyle: 'dashed',
    borderRadius: 16,
    marginTop: 8,
    backgroundColor: 'rgba(46, 42, 133, 0.05)',
  },
  addClinicText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#2E2A85',
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#2E2A85',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
