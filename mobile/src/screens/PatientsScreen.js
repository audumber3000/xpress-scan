import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, Phone, Mail, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';

const PatientCard = ({ name, phone, email, lastVisit, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.patientCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.patientCardContent}>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{name}</Text>
          <View style={styles.contactRow}>
            <Phone size={14} color="#6b7280" />
            <Text style={styles.contactText}>{phone}</Text>
          </View>
          <View style={styles.contactRow}>
            <Mail size={14} color="#6b7280" />
            <Text style={styles.contactText}>{email}</Text>
          </View>
        </View>
        <View style={styles.lastVisitContainer}>
          <Text style={styles.lastVisitLabel}>Last Visit</Text>
          <Text style={styles.lastVisitDate}>{lastVisit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const PatientsScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const patients = [
    { id: 1, name: 'Sarah Johnson', phone: '+1 (555) 123-4567', email: 'sarah.j@email.com', lastVisit: 'Nov 28, 2025' },
    { id: 2, name: 'Michael Brown', phone: '+1 (555) 234-5678', email: 'm.brown@email.com', lastVisit: 'Nov 25, 2025' },
    { id: 3, name: 'Emily Davis', phone: '+1 (555) 345-6789', email: 'emily.d@email.com', lastVisit: 'Nov 22, 2025' },
    { id: 4, name: 'James Wilson', phone: '+1 (555) 456-7890', email: 'j.wilson@email.com', lastVisit: 'Nov 20, 2025' },
    { id: 5, name: 'Lisa Anderson', phone: '+1 (555) 567-8901', email: 'lisa.a@email.com', lastVisit: 'Nov 18, 2025' },
    { id: 6, name: 'David Martinez', phone: '+1 (555) 678-9012', email: 'd.martinez@email.com', lastVisit: 'Nov 15, 2025' },
  ];

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <Text style={styles.headerSubtitle}>{patients.length} total patients</Text>
        
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredPatients.map((patient) => (
          <PatientCard
            key={patient.id}
            name={patient.name}
            phone={patient.phone}
            email={patient.email}
            lastVisit={patient.lastVisit}
            onPress={() => navigation.navigate('PatientFile', { patient })}
          />
        ))}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AddPatient')}
      >
        <Plus size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  searchBar: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#374151',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  patientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  patientCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  contactText: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 8,
  },
  lastVisitContainer: {
    alignItems: 'flex-end',
  },
  lastVisitLabel: {
    color: '#9ca3af',
    fontSize: 12,
  },
  lastVisitDate: {
    color: '#4b5563',
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    backgroundColor: '#16a34a',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default PatientsScreen;
