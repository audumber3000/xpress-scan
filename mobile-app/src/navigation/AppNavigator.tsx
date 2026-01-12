import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

// Import screens
import { GetStartedScreen } from '../screens/GetStartedScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ClinicOwnerTabNavigator } from './ClinicOwnerTabNavigator';
import { ReceptionistHomeScreen } from '../screens/ReceptionistHomeScreen';
import { AllTransactionsScreen } from '../screens/ClinicOwner/AllTransactionsScreen';
import { PatientDetailsScreen } from '../screens/ClinicOwner/PatientDetailsScreen';

export type RootStackParamList = {
  GetStarted: undefined;
  Login: undefined;
  Signup: undefined;
  ClinicOwnerTabs: undefined;
  ReceptionistHome: undefined;
  AllTransactions: undefined;
  PatientDetails: { patientId: string };
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
