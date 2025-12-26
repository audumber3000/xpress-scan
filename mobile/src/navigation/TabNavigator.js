import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, Calendar, DollarSign, Settings } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import PatientsStackNavigator from './PatientsStackNavigator';
import CalendarScreen from '../screens/CalendarScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'normal',
          marginTop: 4,
        },
        tabBarIcon: ({ color }) => {
          let IconComponent;
          
          if (route.name === 'Home') {
            IconComponent = Home;
          } else if (route.name === 'Patients') {
            IconComponent = Users;
          } else if (route.name === 'Calendar') {
            IconComponent = Calendar;
          } else if (route.name === 'Payments') {
            IconComponent = DollarSign;
          } else if (route.name === 'Settings') {
            IconComponent = Settings;
          }
          
          return <IconComponent size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Patients" component={PatientsStackNavigator} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default TabNavigator;
