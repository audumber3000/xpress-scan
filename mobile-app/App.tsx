import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/app/AuthContext';
import { AppNavigator } from './src/app/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
