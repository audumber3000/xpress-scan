import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, Users, User } from 'lucide-react-native';
import { ClinicOwnerHomeScreen } from '../features/clinic-owner/home/screens/Home';
import { AppointmentsScreen } from '../features/clinic-owner/appointments/screens/AppointmentsScreen';
import { PatientsScreen } from '../features/clinic-owner/patients/screens/PatientsScreen';
import { ProfileScreen } from '../features/clinic-owner/profile/screens/ProfileScreen';
import { AdminHubScreen } from '../features/admin/hub/screens/AdminHubScreen';
import { CustomTabBar } from './CustomTabBar';
import { useAuth } from './AuthContext';

export type ClinicOwnerTabParamList = {
  Home: undefined;
  Appointments: undefined;
  Admin?: undefined;
  Patients: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<ClinicOwnerTabParamList>();

export const ClinicOwnerTabNavigator = () => {
  const { backendUser } = useAuth();
  // Show Admin: true = always. For role-based: !backendUser || backendUser?.role === 'clinic_owner'
  const isAdmin = true;

  return (
    <Tab.Navigator
      id="clinic-owner-tabs"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={ClinicOwnerHomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminHubScreen}
          options={{
            tabBarIcon: () => null,
          }}
        />
      )}
      <Tab.Screen
        name="Patients"
        component={PatientsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
