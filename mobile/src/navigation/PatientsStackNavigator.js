import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientsScreen from '../screens/PatientsScreen';
import PatientFileScreen from '../screens/PatientFileScreen';
import AddPatientScreen from '../screens/AddPatientScreen';

const Stack = createNativeStackNavigator();

const PatientsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PatientsList" component={PatientsScreen} />
      <Stack.Screen name="PatientFile" component={PatientFileScreen} />
      <Stack.Screen name="AddPatient" component={AddPatientScreen} />
    </Stack.Navigator>
  );
};

export default PatientsStackNavigator;
