import React from 'react';
import { AuthProvider } from './src/app/AuthContext';
import { AlertProvider } from './src/app/AlertProvider';
import { AppNavigator } from './src/app/AppNavigator';

import { usePushNotifications } from './src/hooks/usePushNotifications';

export default function App() {
  const { expoPushToken } = usePushNotifications();

  return (
    <AuthProvider>
      <AlertProvider>
        <AppNavigator />
      </AlertProvider>
    </AuthProvider>
  );
}
