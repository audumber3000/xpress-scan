import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/app/AuthContext';
import { AppNavigator } from './src/app/AppNavigator';

import { usePushNotifications } from './src/hooks/usePushNotifications';

export default function App() {
  const { expoPushToken } = usePushNotifications();

  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
