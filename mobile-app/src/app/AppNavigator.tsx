import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// Import screens
import { OnboardingScreen, ONBOARDING_KEY } from '../features/auth/screens/OnboardingScreen';
import { GetStartedScreen } from '../features/auth/screens/GetStartedScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { SignupScreen } from '../features/auth/screens/SignupScreen';
import { ClinicOwnerTabNavigator } from './ClinicOwnerTabNavigator';
import { ReceptionistHomeScreen } from '../features/receptionist/screens/ReceptionistHomeScreen';
import { ReceptionistProfileScreen } from '../features/receptionist/screens/ReceptionistProfileScreen';
import { HelpSupportScreen } from '../features/receptionist/screens/HelpSupportScreen';
import { NotificationsScreen } from '../features/clinic-owner/home/screens/NotificationsScreen';
import { PatientsScreen } from '../features/clinic-owner/patients/screens/PatientsScreen';
import { UtilitiesScreen } from '../features/clinic-owner/utilities/screens/UtilitiesScreen';
import { AllTransactionsScreen } from '../features/clinic-owner/transactions/screens/AllTransactionsScreen';
import { InvoiceDetailsScreen } from '../features/clinic-owner/transactions/screens/InvoiceDetailsScreen';
import { ExpenseDetailsScreen } from '../features/clinic-owner/transactions/screens/ExpenseDetailsScreen';
import { PatientDetailsScreen } from '../features/clinic-owner/patients/screens/PatientDetailsScreen';
import { AppointmentsScreen } from '../features/clinic-owner/appointments/screens/AppointmentsScreen';
import { AppointmentDetailsScreen } from '../features/clinic-owner/appointments/screens/AppointmentDetailsScreen';
import { SearchAppointmentsScreen } from '../features/clinic-owner/appointments/screens/SearchAppointmentsScreen';
import { AttendanceScreen } from '../features/admin/attendance/screens/AttendanceScreen';
import { StaffManagementScreen } from '../features/admin/staff/screens/StaffManagementScreen';
import { TreatmentsPricingScreen } from '../features/admin/treatments/screens/TreatmentsPricingScreen';
import { PermissionsScreen } from '../features/admin/permissions/screens/PermissionsScreen';
import { ClinicSettingsScreen } from '../features/admin/settings/screens/ClinicSettingsScreen';
import { SubscriptionScreen } from '../features/admin/subscription/screens/SubscriptionScreen';
import { PurchaseScreen } from '../features/admin/subscription/screens/PurchaseScreen';
import { ProfileScreen } from '../features/clinic-owner/profile/screens/ProfileScreen';
import { ClinicInformationScreen } from '../features/clinic-owner/profile/screens/ClinicInformationScreen';
import { NotificationSettingsScreen } from '../features/clinic-owner/profile/screens/NotificationSettingsScreen';
import { ConnectingScreen } from '../shared/components/ConnectingScreen';
import { AddAppointmentScreen } from '../features/clinic-owner/appointments/screens/AddAppointmentScreen';
import { ConnectivityBanner } from '../shared/components/ConnectivityBanner';
import { PracticeSettingsScreen } from '../features/admin/practice-settings/screens/PracticeSettingsScreen';
import { TemplatesScreen } from '../features/admin/templates/screens/TemplatesScreen';
import { TeamScreen } from '../features/admin/team/screens/TeamScreen';
import { GoogleReviewsScreen } from '../features/clinic-owner/marketing/screens/GoogleReviewsScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  GetStarted: undefined;
  Login: undefined;
  Signup: undefined;
  ClinicOwnerTabs: undefined;
  ReceptionistHome: undefined;
  ReceptionistProfile: undefined;
  HelpSupport: undefined;
  Notifications: undefined;
  AllTransactions: undefined;
  Profile: undefined;
  PatientDetails: { patientId: string };
  AppointmentDetails: { appointment: any };
  SearchAppointments: undefined;
  Attendance: undefined;
  StaffManagement: undefined;
  TreatmentsPricing: undefined;
  Permissions: undefined;
  ClinicSettings: undefined;
  Subscription: undefined;
  Purchase: undefined;
  ClinicInformation: undefined;
  NotificationSettings: undefined;
  AddAppointment: undefined;
  InvoiceDetails: { invoiceId: string };
  ExpenseDetails: { expenseId: string };
  PracticeSettings: { category: string; backendKey: string; label: string };
  Templates: undefined;
  Team: { initialTab?: 'staff' | 'attendance' | 'permissions' } | undefined;
  Patients: undefined;
  Appointments: undefined;
  Utilities: { initialTab?: 'lab' | 'inventory' | 'consent' } | undefined;
  GoogleReviews: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, backendUser } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setHasSeenOnboarding(val === 'true');
    });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      console.log('🔐 [AppNavigator] Auth State:', {
        isAuthenticated,
        role: backendUser?.role,
        email: backendUser?.email
      });
    }
  }, [isAuthenticated, isLoading, backendUser]);

  if (isLoading || hasSeenOnboarding === null || (isAuthenticated && !backendUser)) {
    return <ConnectingScreen />;
  }

  const getInitialRoute = () => {
    if (!isAuthenticated) {
      if (!hasSeenOnboarding) return 'Onboarding';
      return 'Login';
    }
    if (backendUser?.role === 'clinic_owner' && !backendUser?.clinic?.id) {
      return 'Signup';
    }
    if (backendUser?.role === 'receptionist') return 'ReceptionistHome';
    return 'ClinicOwnerTabs';
  };

  return (
    <>
      <ConnectivityBanner />
      <NavigationContainer>
        <Stack.Navigator
          id="root"
          screenOptions={{
            headerShown: false,
          }}
          initialRouteName={getInitialRoute()}
        >
          {isAuthenticated ? (
            backendUser?.role === 'clinic_owner' && !backendUser?.clinic?.id ? (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="GetStarted" component={GetStartedScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
              </>
            ) : backendUser?.role === 'receptionist' ? (
              <>
                <Stack.Screen name="ReceptionistHome" component={ReceptionistHomeScreen} />
                <Stack.Screen name="ReceptionistProfile" component={ReceptionistProfileScreen} />
                <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
                <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
                <Stack.Screen name="SearchAppointments" component={SearchAppointmentsScreen} />
                <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
                <Stack.Screen name="Patients" component={PatientsScreen} />
                <Stack.Screen name="Appointments" component={AppointmentsScreen} />
                <Stack.Screen name="Utilities" component={UtilitiesScreen} />
                <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
                <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
                <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="ClinicOwnerTabs" component={ClinicOwnerTabNavigator} />
                <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
                <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
                <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
                <Stack.Screen name="SearchAppointments" component={SearchAppointmentsScreen} />
                <Stack.Screen name="Attendance" component={AttendanceScreen} />
                <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
                <Stack.Screen name="TreatmentsPricing" component={TreatmentsPricingScreen} />
                <Stack.Screen name="Permissions" component={PermissionsScreen} />
                <Stack.Screen name="ClinicSettings" component={ClinicSettingsScreen} />
                <Stack.Screen name="Subscription" component={SubscriptionScreen} />
                <Stack.Screen name="Purchase" component={PurchaseScreen} />
                <Stack.Screen name="ClinicInformation" component={ClinicInformationScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                <Stack.Screen name="ReceptionistHome" component={ReceptionistHomeScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
                <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
                <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
                <Stack.Screen name="PracticeSettings" component={PracticeSettingsScreen} />
                <Stack.Screen name="Templates" component={TemplatesScreen} />
                <Stack.Screen name="Team" component={TeamScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="GoogleReviews" component={GoogleReviewsScreen} />
              </>
            )
          ) : (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="GetStarted" component={GetStartedScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};
