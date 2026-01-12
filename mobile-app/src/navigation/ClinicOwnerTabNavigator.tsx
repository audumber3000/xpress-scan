import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, Users, User } from 'lucide-react-native';
import { ClinicOwnerHomeScreen } from '../screens/ClinicOwner/HomeScreen';
import { AppointmentsScreen } from '../screens/ClinicOwner/AppointmentsScreen';
import { PatientsScreen } from '../screens/ClinicOwner/PatientsScreen';
import { ProfileScreen } from '../screens/ClinicOwner/ProfileScreen';

export type ClinicOwnerTabParamList = {
  Home: undefined;
  Appointments: undefined;
  Patients: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<ClinicOwnerTabParamList>();

export const ClinicOwnerTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#9333EA',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
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
