import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { PatientCard } from './PatientCard';

interface Patient {
  id: string;
  name: string;
  phone: string;
  status: 'Active' | 'Inactive';
  lastVisit: string;
  initials: string;
  avatarColor: string;
}

interface PatientsListProps {
  patients: Patient[];
  onPatientPress: (patient: Patient) => void;
  onPhonePress: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  emptyMessage?: string;
}

export const PatientsList: React.FC<PatientsListProps> = ({ 
  patients, 
  onPatientPress, 
  onPhonePress,
  onDelete,
  emptyMessage = 'No patients found'
}) => {
  if (patients.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={patients}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PatientCard
          patient={item}
          onPress={() => onPatientPress(item)}
          onPhonePress={() => onPhonePress(item)}
          onDelete={() => onDelete(item)}
        />
      )}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});
