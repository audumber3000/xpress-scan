import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './AuthContext';

// Import screens
import { GetStartedScreen } from '../features/auth/screens/GetStartedScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { SignupScreen } from '../features/auth/screens/SignupScreen';
import { ClinicOwnerTabNavigator } from './ClinicOwnerTabNavigator';
import { ReceptionistHomeScreen } from '../features/receptionist/screens/ReceptionistHomeScreen';
import { AllTransactionsScreen } from '../features/clinic-owner/transactions/screens/AllTransactionsScreen';
import { PatientDetailsScreen } from '../features/clinic-owner/patients/screens/PatientDetailsScreen';
import { AppointmentDetailsScreen } from '../features/clinic-owner/appointments/screens/AppointmentDetailsScreen';
import { AttendanceScreen } from '../features/admin/attendance/screens/AttendanceScreen';
import { StaffManagementScreen } from '../features/admin/staff/screens/StaffManagementScreen';
import { TreatmentsPricingScreen } from '../features/admin/treatments/screens/TreatmentsPricingScreen';
import { PermissionsScreen } from '../features/admin/permissions/screens/PermissionsScreen';
import { ClinicSettingsScreen } from '../features/admin/settings/screens/ClinicSettingsScreen';
import { SubscriptionScreen } from '../features/admin/subscription/screens/SubscriptionScreen';

export type RootStackParamList = {
  GetStarted: undefined;
  Login: undefined;
  Signup: undefined;
  ClinicOwnerTabs: undefined;
  ReceptionistHome: undefined;
  AllTransactions: undefined;
  PatientDetails: { patientId: string };
  AppointmentDetails: { appointment: any };
  Attendance: undefined;
  StaffManagement: undefined;
  TreatmentsPricing: undefined;
  Permissions: undefined;
  ClinicSettings: undefined;
  Subscription: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, backendUser } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName={isAuthenticated ? 'ClinicOwnerTabs' : 'GetStarted'}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="ClinicOwnerTabs" component={ClinicOwnerTabNavigator} />
            <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
            <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
            <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
            <Stack.Screen name="TreatmentsPricing" component={TreatmentsPricingScreen} />
            <Stack.Screen name="Permissions" component={PermissionsScreen} />
            <Stack.Screen name="ClinicSettings" component={ClinicSettingsScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
            <Stack.Screen name="ReceptionistHome" component={ReceptionistHomeScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="GetStarted" component={GetStartedScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
