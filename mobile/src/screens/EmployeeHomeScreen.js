import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  Settings, 
  FileText, 
  Clock,
  MapPin,
  LogOut
} from 'lucide-react-native';
import * as Location from 'expo-location';

const EmployeeHomeScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    requestLocationPermission();
    checkClockStatus();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required for clock in/out');
        return;
      }
    } catch (error) {
      setLocationError('Failed to request location permission');
    }
  };

  const checkClockStatus = async () => {
    // TODO: Check with backend if user is currently clocked in
    // For now, using mock data
    setIsClockedIn(false);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required for clock in/out');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    } catch (error) {
      Alert.alert('Error', 'Failed to get location. Please try again.');
      return null;
    }
  };

  const handleClockIn = async () => {
    const currentLocation = await getCurrentLocation();
    if (!currentLocation) return;

    // TODO: Call backend API to clock in with location
    // For now, just show alert
    Alert.alert(
      'Clock In',
      `Location: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`,
      [{ text: 'OK' }]
    );
    
    setIsClockedIn(true);
  };

  const handleClockOut = async () => {
    const currentLocation = await getCurrentLocation();
    if (!currentLocation) return;

    // TODO: Call backend API to clock out with location
    Alert.alert(
      'Clock Out',
      `Location: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`,
      [{ text: 'OK' }]
    );
    
    setIsClockedIn(false);
  };

  const menuCards = [
    {
      id: 'patients',
      title: 'Patients',
      icon: Users,
      color: '#3b82f6',
      onPress: () => navigation.navigate('Patients'),
    },
    {
      id: 'appointments',
      title: 'Appointments',
      icon: Calendar,
      color: '#16a34a',
      onPress: () => navigation.navigate('Appointments'),
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: DollarSign,
      color: '#f59e0b',
      onPress: () => navigation.navigate('Payments'),
    },
    {
      id: 'patient-files',
      title: 'Patient Files',
      icon: FileText,
      color: '#8b5cf6',
      onPress: () => navigation.navigate('PatientFiles'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      color: '#6b7280',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'Employee'}</Text>
          <Text style={styles.role}>{user?.role || 'Staff'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <LogOut size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Clock In/Out Card */}
        <View style={styles.clockCard}>
          <View style={styles.clockHeader}>
            <Clock size={24} color={isClockedIn ? '#16a34a' : '#6b7280'} />
            <Text style={styles.clockTitle}>
              {isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </Text>
          </View>
          
          {locationError && (
            <Text style={styles.errorText}>{locationError}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.clockButton,
              isClockedIn ? styles.clockOutButton : styles.clockInButton
            ]}
            onPress={isClockedIn ? handleClockOut : handleClockIn}
          >
            <MapPin size={20} color="#ffffff" style={styles.clockIcon} />
            <Text style={styles.clockButtonText}>
              {isClockedIn ? 'Clock Out' : 'Clock In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          {menuCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <TouchableOpacity
                key={card.id}
                style={styles.menuCard}
                onPress={card.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${card.color}15` }]}>
                  <IconComponent size={32} color={card.color} />
                </View>
                <Text style={styles.menuCardTitle}>{card.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#6C4CF3',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  role: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  clockCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clockTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 12,
  },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  clockInButton: {
    backgroundColor: '#16a34a',
  },
  clockOutButton: {
    backgroundColor: '#ef4444',
  },
  clockIcon: {
    marginRight: 8,
  },
  clockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
});

export default EmployeeHomeScreen;

