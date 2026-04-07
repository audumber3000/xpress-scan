import React from 'react';
import { AuthProvider } from './src/app/AuthContext';
import { AlertProvider } from './src/app/AlertProvider';
import { AppNavigator } from './src/app/AppNavigator';
import { ErrorBoundary } from './src/shared/components/ErrorBoundary';
import { ClinicSwitcherSheet } from './src/shared/components/ClinicSwitcherSheet';
import { useAuth } from './src/app/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClinicInfo } from './src/services/api/auth.api';

import { usePushNotifications } from './src/hooks/usePushNotifications';

import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AppContent() {
  const { 
    isAuthenticated, 
    backendUser, 
    isClinicSwitcherVisible, 
    setIsClinicSwitcherVisible,
    refreshBackendUser,
    switchBranch
  } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <AppNavigator />
      {isAuthenticated && backendUser?.role === 'clinic_owner' && (
        <ClinicSwitcherSheet
          isVisible={isClinicSwitcherVisible}
          onClose={() => setIsClinicSwitcherVisible(false)}
          onClinicSelected={async (clinic: ClinicInfo) => {
            try {
              await switchBranch(clinic.id);
              setIsClinicSwitcherVisible(false);
            } catch (error) {
              console.error('Error switching branch:', error);
            }
          }}
        />
      )}
    </View>
  );
}

export default function App() {
  const { expoPushToken } = usePushNotifications();

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AlertProvider>
            <AppContent />
          </AlertProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
