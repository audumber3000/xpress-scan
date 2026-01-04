import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PatientFileScreen from './PatientFileScreen';

// This is a wrapper that redirects to the existing PatientFileScreen
// We can customize it later if needed for employee-specific features
const PatientFilesScreen = (props) => {
  return <PatientFileScreen {...props} />;
};

export default PatientFilesScreen;

