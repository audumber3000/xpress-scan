import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Import screens
import { OnboardingScreen, ONBOARDING_KEY } from '../features/auth/screens/OnboardingScreen';
import { GetStartedScreen } from '../features/auth/screens/GetStartedScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { SignupScreen } from '../features/auth/screens/SignupScreen';
import { NoClinicLinkedScreen } from '../features/auth/screens/NoClinicLinkedScreen';
import { IS_SIGNUP_ENABLED } from '../shared/constants/platform';
import { VerifyContactScreen } from '../features/auth/screens/VerifyContactScreen';
import { ClinicOwnerTabNavigator } from './ClinicOwnerTabNavigator';
import { ReceptionistHomeScreen } from '../features/receptionist/screens/ReceptionistHomeScreen';
import { ReceptionistProfileScreen } from '../features/receptionist/screens/ReceptionistProfileScreen';
import { HelpSupportScreen } from '../features/receptionist/screens/HelpSupportScreen';
import { NotificationsScreen } from '../features/clinic-owner/home/screens/NotificationsScreen';
import InboxScreen from '../features/clinic-owner/notifications/screens/InboxScreen';
import { PatientsScreen } from '../features/clinic-owner/patients/screens/PatientsScreen';
import { UtilitiesScreen } from '../features/clinic-owner/utilities/screens/UtilitiesScreen';
import { UtilitySectionScreen } from '../features/clinic-owner/utilities/screens/UtilitySectionScreen';
import { AllTransactionsScreen } from '../features/clinic-owner/transactions/screens/AllTransactionsScreen';
import { OffersScreen } from '../features/admin/offers/screens/OffersScreen';
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
import { AuditLogScreen } from '../features/admin/security/screens/AuditLogScreen';
import { VerificationScreen } from '../features/admin/security/screens/VerificationScreen';
import { ClockInScreen } from '../features/admin/attendance/screens/ClockInScreen';
import { TeamScreen } from '../features/admin/team/screens/TeamScreen';
import { GoogleReviewsScreen } from '../features/clinic-owner/marketing/screens/GoogleReviewsScreen';
import { TabletWebAppScreen } from '../features/tablet/screens/TabletWebAppScreen';
import { IS_TABLET } from '../shared/utils/device';

export type RootStackParamList = {
  Onboarding: undefined;
  GetStarted: undefined;
  Login: undefined;
  Signup: undefined;
  NoClinicLinked: undefined;
  ClinicOwnerTabs: undefined;
  ReceptionistHome: undefined;
  ReceptionistProfile: undefined;
  HelpSupport: undefined;
  Notifications: undefined;
  /** The staff member's own notification inbox (not the messaging console). */
  Inbox: undefined;
  /** Openable pre-filtered from a dashboard tile, e.g. Outstanding →
   *  { tab: 'payments', filter: 'unpaid' }. Both optional: opened without
   *  params the screen behaves exactly as it always did. */
  AllTransactions: { tab?: 'collections' | 'payments' | 'ledger'; filter?: string } | undefined;
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
  VerifyContact: undefined;
  Offers: undefined;
  ClinicInformation: undefined;
  NotificationSettings: undefined;
  AddAppointment: undefined;
  InvoiceDetails: { invoiceId: string };
  ExpenseDetails: { expenseId: string };
  PracticeSettings: { category: string; backendKey: string; label: string };
  Templates: undefined;
  AuditLog: undefined;
  Verification: undefined;
  ClockIn: undefined;
  Team: { initialTab?: 'staff' | 'attendance' | 'permissions' } | undefined;
  Patients: undefined;
  Appointments: undefined;
  Utilities: { initialTab?: 'lab' | 'inventory' | 'consent' } | undefined;
  UtilitySection: { section: 'inventory' | 'lab' | 'consent' };
  GoogleReviews: undefined;
  TabletWebApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, backendUser } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  // Initialize push notifications (requests permission + registers token with backend)
  const { expoPushToken } = usePushNotifications();

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
      // iOS has no Onboarding/GetStarted/Signup screens registered (Path A,
      // sign-in-only). Always land on Login.
      if (!IS_SIGNUP_ENABLED) return 'Login';
      if (!hasSeenOnboarding) return 'Onboarding';
      return 'Login';
    }
    if (backendUser?.role === 'clinic_owner' && !backendUser?.clinic?.id) {
      // On iOS we don't expose new-clinic registration (App Store 3.1.3(b)
      // multiplatform-services exemption). Send the user to a sign-in-only
      // dead-end screen that tells them to set up their clinic on the web.
      return IS_SIGNUP_ENABLED ? 'Signup' : 'NoClinicLinked';
    }
    // Signup verification is the last step of creating a clinic and it blocks.
    // Arriving here with it outstanding means the app was killed mid-step, so
    // finish it. Server-computed and false for every clinic that predates the
    // check, so no existing customer is ever caught by this.
    if (backendUser?.role === 'clinic_owner' && backendUser?.clinic?.security_verification_required) {
      return 'VerifyContact';
    }
    // Tablets get the responsive web app in a WebView instead of the native tabs.
    if (IS_TABLET) return 'TabletWebApp';
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
              IS_SIGNUP_ENABLED ? (
                <>
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="GetStarted" component={GetStartedScreen} />
                  <Stack.Screen name="Signup" component={SignupScreen} />
                </>
              ) : (
                // iOS path: user is signed in but has no clinic. Show only the
                // sign-in-only dead-end screen — no signup, no GetStarted.
                <>
                  <Stack.Screen name="NoClinicLinked" component={NoClinicLinkedScreen} />
                </>
              )
            ) : backendUser?.role === 'clinic_owner'
                && backendUser?.clinic?.security_verification_required ? (
              // Nothing else is reachable until the contacts are verified. It is
              // a whole stack rather than a modal so there is no back gesture
              // out of it and no tab bar behind it — the clinic exists but is
              // not finished being set up.
              //
              // Applies on iOS too. Clinics are not created there, but one made
              // on Android and abandoned mid-step can be signed into from an
              // iPhone, and leaving that person permanently unverified with no
              // route out would be worse than showing them the step.
              <>
                <Stack.Screen name="VerifyContact" component={VerifyContactScreen} />
              </>
            ) : IS_TABLET ? (
              // Tablet shell: the responsive web app in a WebView. Login stays
              // native (branches above); only the post-login surface is web.
              <>
                <Stack.Screen name="TabletWebApp" component={TabletWebAppScreen} />
              </>
            ) : backendUser?.role === 'receptionist' ? (
              <>
                <Stack.Screen name="ReceptionistHome" component={ReceptionistHomeScreen} />
                <Stack.Screen name="ReceptionistProfile" component={ReceptionistProfileScreen} />
                {/* Registered here as well as in the owner stack. Clocking on is
                    for everybody who works a shift, and a receptionist is the
                    likeliest person to do it, but this stack did not carry the
                    screen — so the profile row would have thrown rather than
                    navigated. */}
                <Stack.Screen name="ClockIn" component={ClockInScreen} />
                <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                {/* The inbox proper. NotificationsScreen above is the
                    outbound patient-messaging console, which is a
                    different thing that happens to share the word. */}
                <Stack.Screen name="Inbox" component={InboxScreen} />
                <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
                <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
                <Stack.Screen name="SearchAppointments" component={SearchAppointmentsScreen} />
                <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
                <Stack.Screen name="Patients" component={PatientsScreen} />
                <Stack.Screen name="Appointments" component={AppointmentsScreen} />
                <Stack.Screen name="Utilities" component={UtilitiesScreen} />
                <Stack.Screen name="UtilitySection" component={UtilitySectionScreen} />
                <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
                <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
                <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="ClinicOwnerTabs" component={ClinicOwnerTabNavigator} />
                <Stack.Screen name="UtilitySection" component={UtilitySectionScreen} />
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
                <Stack.Screen name="Offers" component={OffersScreen} />
                <Stack.Screen name="Purchase" component={PurchaseScreen} />
                <Stack.Screen name="ClinicInformation" component={ClinicInformationScreen} />
                <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                <Stack.Screen name="ReceptionistHome" component={ReceptionistHomeScreen} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                {/* The inbox proper. NotificationsScreen above is the
                    outbound patient-messaging console, which is a
                    different thing that happens to share the word. */}
                <Stack.Screen name="Inbox" component={InboxScreen} />
                <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
                <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
                <Stack.Screen name="ExpenseDetails" component={ExpenseDetailsScreen} />
                <Stack.Screen name="PracticeSettings" component={PracticeSettingsScreen} />
                <Stack.Screen name="Templates" component={TemplatesScreen} />
                <Stack.Screen name="AuditLog" component={AuditLogScreen} />
                <Stack.Screen name="Verification" component={VerificationScreen} />
                <Stack.Screen name="ClockIn" component={ClockInScreen} />
                <Stack.Screen name="Team" component={TeamScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="GoogleReviews" component={GoogleReviewsScreen} />
              </>
            )
          ) : IS_SIGNUP_ENABLED ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="GetStarted" component={GetStartedScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
            </>
          ) : (
            // iOS: sign-in-only. No Onboarding (which sells the product),
            // no GetStarted (which is the registration entry point), and no
            // SignupScreen. Login screen is the only entry.
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};
