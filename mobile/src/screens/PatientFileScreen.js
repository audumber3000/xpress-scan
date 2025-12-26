import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  User, 
  FileText,
  Pill,
  Plus,
  X,
  Edit3,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react-native';
import ProfessionalDentalChart, { CONDITION_LABELS, TOOTH_NAMES } from '../components/ProfessionalDentalChart';

const PatientFileScreen = ({ route, navigation }) => {
  const { patient, isNewPatient } = route.params || {};
  
  // Calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Patient basic info - use passed data or defaults for existing patients
  const [patientInfo] = useState({
    id: patient?.id || 1,
    name: patient?.name || 'Sarah Johnson',
    phone: patient?.phone || '+1 (555) 123-4567',
    email: patient?.email || 'sarah.j@email.com',
    dob: patient?.dob || '1985-03-15',
    age: calculateAge(patient?.dob) || 39,
    gender: patient?.gender || 'Female',
    address: patient?.address || '123 Main St, New York, NY 10001',
    insurance: patient?.insurance || 'Delta Dental PPO',
    allergies: patient?.allergies || ['Penicillin', 'Latex'],
    medicalConditions: patient?.medicalConditions || ['Hypertension'],
    emergencyContact: patient?.emergencyContact || 'John Johnson - +1 (555) 987-6543',
  });

  // Dental chart state - new format with surfaces
  // Format: { toothNum: { status: 'present', surfaces: { M: 'cavity', O: 'filling_amalgam', ... } } }
  const [teethData, setTeethData] = useState(
    isNewPatient ? {} : {
      3: { status: 'present', surfaces: { O: 'filling_amalgam', M: 'filling_amalgam' } },
      14: { status: 'present', surfaces: { O: 'cavity', D: 'cavity' } },
      19: { status: 'present', surfaces: { O: 'crown', M: 'crown', D: 'crown', B: 'crown', L: 'crown' } },
      30: { status: 'rootCanal', surfaces: { O: 'filling_composite' } },
      17: { status: 'missing', surfaces: {} },
      1: { status: 'implant', surfaces: {} },
    }
  );
  const [selectedTooth, setSelectedTooth] = useState(null);

  // Treatment notes for each tooth - empty for new patients
  const [toothNotes, setToothNotes] = useState(
    isNewPatient ? {} : {
      3: 'Amalgam filling placed on 2024-06-15 (MO surfaces)',
      14: 'Cavity detected on OD surfaces, treatment scheduled',
      19: 'Full porcelain crown placed on 2024-01-20',
      30: 'Root canal completed on 2023-11-10, composite restoration',
      17: 'Extracted due to impaction on 2024-12-01',
      1: 'Implant placed on 2023-06-15',
    }
  );

  // Prescriptions - empty for new patients
  const [prescriptions, setPrescriptions] = useState(
    isNewPatient ? [] : [
      {
        id: 1,
        medication: 'Amoxicillin 500mg',
        dosage: '1 capsule 3 times daily',
        duration: '7 days',
        date: '2024-12-01',
        status: 'active',
        notes: 'Take with food. For post-extraction infection prevention.',
      },
      {
        id: 2,
        medication: 'Ibuprofen 400mg',
        dosage: '1 tablet every 6 hours as needed',
        duration: '5 days',
        date: '2024-12-01',
        status: 'active',
        notes: 'For pain management after procedure.',
      },
    ]
  );

  // Treatment history - empty for new patients
  const [treatmentHistory, setTreatmentHistory] = useState(
    isNewPatient ? [] : [
      {
        id: 1,
        date: '2024-12-01',
        procedure: 'Tooth Extraction',
        tooth: 17,
        dentist: 'Dr. Smith',
        notes: 'Lower left wisdom tooth extracted due to impaction.',
        cost: 350,
      },
      {
        id: 2,
        date: '2024-06-15',
        procedure: 'Filling',
        tooth: 3,
        dentist: 'Dr. Smith',
        notes: 'Amalgam filling on upper right first molar.',
        cost: 180,
      },
    ]
  );

  // Upcoming appointments - empty for new patients
  const [appointments, setAppointments] = useState(
    isNewPatient ? [] : [
      {
        id: 1,
        date: '2024-12-15',
        time: '10:00 AM',
        procedure: 'Cavity Treatment',
        tooth: 14,
        status: 'scheduled',
      },
      {
        id: 2,
        date: '2025-01-10',
        time: '2:30 PM',
        procedure: 'Regular Checkup',
        tooth: null,
        status: 'scheduled',
      },
    ]
  );

  // Modal states
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newPrescription, setNewPrescription] = useState({
    medication: '',
    dosage: '',
    duration: '',
    notes: '',
  });
  const [newNote, setNewNote] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('chart');

  const handleToothSelect = (toothNum) => {
    setSelectedTooth(toothNum === selectedTooth ? null : toothNum);
  };

  // Handle surface condition change (for the 5-surface grid)
  const handleSurfaceConditionChange = (toothNum, surface, condition) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          surfaces: {
            ...toothData.surfaces,
            [surface]: condition,
          },
        },
      };
    });
  };

  // Handle tooth status change (missing, implant, etc.)
  const handleToothStatusChange = (toothNum, status) => {
    setTeethData(prev => {
      const toothData = prev[toothNum] || { status: 'present', surfaces: {} };
      return {
        ...prev,
        [toothNum]: {
          ...toothData,
          status: status,
        },
      };
    });
  };

  const handleAddPrescription = () => {
    if (!newPrescription.medication || !newPrescription.dosage) {
      Alert.alert('Error', 'Please fill in medication and dosage');
      return;
    }
    
    const prescription = {
      id: Date.now(),
      ...newPrescription,
      date: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    
    setPrescriptions(prev => [prescription, ...prev]);
    setNewPrescription({ medication: '', dosage: '', duration: '', notes: '' });
    setShowPrescriptionModal(false);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedTooth) return;
    
    setToothNotes(prev => ({
      ...prev,
      [selectedTooth]: newNote,
    }));
    setNewNote('');
    setShowNoteModal(false);
  };

  const tabs = [
    { id: 'chart', label: 'Dental Chart', icon: FileText },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'info', label: 'Patient Info', icon: User },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>{patientInfo.name}</Text>
            {isNewPatient && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>
            {isNewPatient ? 'Start adding dental records' : 'Patient File'}
          </Text>
        </View>
        <TouchableOpacity style={styles.editButton}>
          <Edit3 size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Quick Info Bar */}
      <View style={styles.quickInfo}>
        <View style={styles.quickInfoItem}>
          <Phone size={14} color="#6b7280" />
          <Text style={styles.quickInfoText}>{patientInfo.phone}</Text>
        </View>
        <View style={styles.quickInfoItem}>
          <Calendar size={14} color="#6b7280" />
          <Text style={styles.quickInfoText}>{patientInfo.age} yrs</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={activeTab === tab.id ? '#16a34a' : '#6b7280'} />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Dental Chart Tab */}
        {activeTab === 'chart' && (
          <View>
            <ProfessionalDentalChart
              teethData={teethData}
              selectedTooth={selectedTooth}
              onToothSelect={handleToothSelect}
              onSurfaceConditionChange={handleSurfaceConditionChange}
              onToothStatusChange={handleToothStatusChange}
              editable={true}
            />

            {/* Tooth Notes */}
            {selectedTooth && (
              <View style={styles.notesSection}>
                <View style={styles.noteHeader}>
                  <Text style={styles.sectionTitle}>Notes for Tooth #{selectedTooth}</Text>
                  <TouchableOpacity 
                    style={styles.addNoteButton}
                    onPress={() => {
                      setNewNote(toothNotes[selectedTooth] || '');
                      setShowNoteModal(true);
                    }}
                  >
                    <Edit3 size={16} color="#16a34a" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.noteText}>
                  {toothNotes[selectedTooth] || 'No notes for this tooth yet. Tap to add.'}
                </Text>
              </View>
            )}

            {/* Conditions Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Teeth with Conditions</Text>
              {Object.entries(teethData).filter(([_, data]) => 
                data.status !== 'present' || Object.keys(data.surfaces || {}).some(s => data.surfaces[s] !== 'none')
              ).length > 0 ? (
                Object.entries(teethData)
                  .filter(([_, data]) => data.status !== 'present' || Object.keys(data.surfaces || {}).length > 0)
                  .map(([tooth, data]) => (
                    <TouchableOpacity 
                      key={tooth}
                      style={styles.summaryItem}
                      onPress={() => setSelectedTooth(parseInt(tooth))}
                    >
                      <View style={styles.summaryLeft}>
                        <Text style={styles.summaryTooth}>Tooth #{tooth}</Text>
                        <Text style={styles.summaryName}>{TOOTH_NAMES[tooth] || 'Unknown'}</Text>
                        {data.status !== 'present' && (
                          <Text style={styles.summaryStatus}>Status: {data.status}</Text>
                        )}
                      </View>
                      <View style={styles.surfaceSummary}>
                        {Object.entries(data.surfaces || {}).filter(([_, c]) => c !== 'none').map(([surface, condition]) => (
                          <View key={surface} style={[styles.surfaceBadge, { backgroundColor: getSurfaceColor(condition) }]}>
                            <Text style={styles.surfaceBadgeText}>{surface}</Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ))
              ) : (
                <Text style={styles.emptyText}>No conditions recorded yet. Tap on teeth to add.</Text>
              )}
            </View>
          </View>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Prescriptions</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowPrescriptionModal(true)}
              >
                <Plus size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {prescriptions.map((rx) => (
              <View key={rx.id} style={styles.prescriptionCard}>
                <View style={styles.prescriptionHeader}>
                  <View style={styles.prescriptionTitle}>
                    <Pill size={18} color="#16a34a" />
                    <Text style={styles.medicationName}>{rx.medication}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    rx.status === 'active' ? styles.statusActive : styles.statusCompleted
                  ]}>
                    <Text style={[
                      styles.statusText,
                      rx.status === 'active' ? styles.statusTextActive : styles.statusTextCompleted
                    ]}>
                      {rx.status === 'active' ? 'Active' : 'Completed'}
                    </Text>
                  </View>
                </View>
                <View style={styles.prescriptionDetails}>
                  <Text style={styles.dosageText}>{rx.dosage}</Text>
                  <Text style={styles.durationText}>Duration: {rx.duration}</Text>
                  <Text style={styles.dateText}>Prescribed: {rx.date}</Text>
                  {rx.notes && (
                    <Text style={styles.rxNotes}>{rx.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View>
            {/* Upcoming Appointments */}
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            {appointments.map((apt) => (
              <View key={apt.id} style={styles.appointmentCard}>
                <View style={styles.appointmentDate}>
                  <Calendar size={16} color="#16a34a" />
                  <Text style={styles.appointmentDateText}>{apt.date}</Text>
                  <Text style={styles.appointmentTime}>{apt.time}</Text>
                </View>
                <Text style={styles.appointmentProcedure}>{apt.procedure}</Text>
                {apt.tooth && (
                  <Text style={styles.appointmentTooth}>Tooth #{apt.tooth}</Text>
                )}
              </View>
            ))}

            {/* Treatment History */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Treatment History</Text>
            {treatmentHistory.map((treatment) => (
              <View key={treatment.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyDate}>{treatment.date}</Text>
                  <Text style={styles.historyCost}>${treatment.cost}</Text>
                </View>
                <Text style={styles.historyProcedure}>{treatment.procedure}</Text>
                <Text style={styles.historyTooth}>
                  Tooth #{treatment.tooth} - {TOOTH_NAMES[treatment.tooth]}
                </Text>
                <Text style={styles.historyDentist}>By {treatment.dentist}</Text>
                <Text style={styles.historyNotes}>{treatment.notes}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Patient Info Tab */}
        {activeTab === 'info' && (
          <View>
            <View style={styles.infoCard}>
              <Text style={styles.infoSectionTitle}>Personal Information</Text>
              <InfoRow icon={User} label="Full Name" value={patientInfo.name} />
              <InfoRow icon={Calendar} label="Date of Birth" value={patientInfo.dob} />
              <InfoRow icon={User} label="Gender" value={patientInfo.gender} />
              <InfoRow icon={Phone} label="Phone" value={patientInfo.phone} />
              <InfoRow icon={Mail} label="Email" value={patientInfo.email} />
              <InfoRow icon={MapPin} label="Address" value={patientInfo.address} />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoSectionTitle}>Medical Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Insurance</Text>
                <Text style={styles.infoValue}>{patientInfo.insurance}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Allergies</Text>
                <View style={styles.tagContainer}>
                  {patientInfo.allergies.map((allergy, idx) => (
                    <View key={idx} style={styles.allergyTag}>
                      <AlertCircle size={12} color="#dc2626" />
                      <Text style={styles.allergyText}>{allergy}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Medical Conditions</Text>
                <View style={styles.tagContainer}>
                  {patientInfo.medicalConditions.map((condition, idx) => (
                    <View key={idx} style={styles.conditionTag}>
                      <Text style={styles.conditionTagText}>{condition}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emergency Contact</Text>
                <Text style={styles.infoValue}>{patientInfo.emergencyContact}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Prescription Modal */}
      <Modal
        visible={showPrescriptionModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Prescription</Text>
              <TouchableOpacity onPress={() => setShowPrescriptionModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Medication name"
              value={newPrescription.medication}
              onChangeText={(text) => setNewPrescription(prev => ({ ...prev, medication: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Dosage (e.g., 1 tablet twice daily)"
              value={newPrescription.dosage}
              onChangeText={(text) => setNewPrescription(prev => ({ ...prev, dosage: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Duration (e.g., 7 days)"
              value={newPrescription.duration}
              onChangeText={(text) => setNewPrescription(prev => ({ ...prev, duration: text }))}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Notes"
              value={newPrescription.notes}
              onChangeText={(text) => setNewPrescription(prev => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={3}
            />
            
            <TouchableOpacity style={styles.saveButton} onPress={handleAddPrescription}>
              <Text style={styles.saveButtonText}>Add Prescription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        visible={showNoteModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Note for Tooth #{selectedTooth}
              </Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter notes about this tooth..."
              value={newNote}
              onChangeText={setNewNote}
              multiline
              numberOfLines={5}
            />
            
            <TouchableOpacity style={styles.saveButton} onPress={handleAddNote}>
              <Text style={styles.saveButtonText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoLabelContainer}>
      <Icon size={16} color="#6b7280" />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const getSurfaceColor = (condition) => {
  const colors = {
    none: '#ffffff',
    cavity: '#ef4444',
    filling_amalgam: '#71717a',
    filling_composite: '#fef9c3',
    filling_gold: '#fbbf24',
    crown: '#f97316',
    sealant: '#ec4899',
    decay: '#991b1b',
    fracture: '#7c3aed',
  };
  return colors[condition] || colors.none;
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  newBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
  },
  newBadgeText: {
    color: '#78350f',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  quickInfo: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  quickInfoText: {
    marginLeft: 6,
    color: '#4b5563',
    fontSize: 14,
  },
  tabContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#dcfce7',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#16a34a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#16a34a',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addNoteButton: {
    padding: 4,
  },
  noteText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  summarySection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryTooth: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  summaryName: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  summaryStatus: {
    fontSize: 11,
    color: '#f97316',
    marginTop: 2,
    fontWeight: '500',
  },
  surfaceSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  surfaceBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d4d4d4',
  },
  surfaceBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  conditionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conditionBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  prescriptionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prescriptionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusCompleted: {
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextCompleted: {
    color: '#6b7280',
  },
  prescriptionDetails: {
    marginLeft: 26,
  },
  dosageText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  rxNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  appointmentDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  appointmentTime: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 12,
  },
  appointmentProcedure: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  appointmentTooth: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  historyCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  historyProcedure: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  historyTooth: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  historyDentist: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  historyNotes: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    marginLeft: 22,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginLeft: 22,
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  allergyText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 4,
    fontWeight: '500',
  },
  conditionTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  conditionTagText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PatientFileScreen;
