import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EmployeeHomeScreen from '../screens/EmployeeHomeScreen';
import PatientsStackNavigator from './PatientsStackNavigator';
import CalendarScreen from '../screens/CalendarScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import EmployeeSettingsScreen from '../screens/EmployeeSettingsScreen';
import PatientFilesScreen from '../screens/PatientFilesScreen';

const Stack = createNativeStackNavigator();

const EmployeeStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="EmployeeHome" component={EmployeeHomeScreen} />
      <Stack.Screen name="Patients" component={PatientsStackNavigator} />
      <Stack.Screen name="Appointments" component={CalendarScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="PatientFiles" component={PatientFilesScreen} />
      <Stack.Screen name="Settings" component={EmployeeSettingsScreen} />
    </Stack.Navigator>
  );
};

export default EmployeeStackNavigator;

