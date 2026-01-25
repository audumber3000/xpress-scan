import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../../../shared/constants/colors';

interface WelcomeHeaderProps {
  userName: string;
  specialization?: string;
  onNotificationPress: () => void;
  dailyRevenue: number;
  totalPatients: number;
}

// 1. Background backdrop (lowest layer)
export const WelcomeHeaderBackground: React.FC = () => {
  return (
    <LinearGradient
      colors={['#2E2A85', '#4338CA']}
      style={styles.absoluteBackdrop}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    />
  );
};

// 2. Part One: Start from top and end right after the two cards (Revenue and Total Patients)
export const WelcomeHeaderTopPart: React.FC<WelcomeHeaderProps> = ({
  userName,
  specialization = 'Endo Dentist',
  onNotificationPress,
  dailyRevenue,
  totalPatients
}) => {
  return (
    <LinearGradient
      colors={['#2E2A85', '#393399']} // Solid matching purple
      style={styles.topPartContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView edges={['top']}>
        {/* User Info */}
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.textContainer}>
              <Text style={styles.welcomeText}>Welcome Back,</Text>
              <Text
                style={styles.nameText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Dr. {userName}
              </Text>
              <Text style={styles.specializationText}>{specialization}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <View style={styles.notificationDot} />
            <Bell size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards - Inside Part 1 */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>DAILY REVENUE</Text>
            <Text style={styles.statValue}>${dailyRevenue.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>APPOINTMENTS</Text>
            <Text style={styles.statValue}>{totalPatients.toLocaleString()} Total</Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// 3. Part Two: Tiny component joined to uper one with rounded corners at bottom
export const WelcomeHeaderBottomPocket: React.FC = () => {
  return (
    <LinearGradient
      colors={['#393399', '#4338CA']}
      style={styles.bottomPocket}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    />
  );
};

const styles = StyleSheet.create({
  absoluteBackdrop: {
    ...StyleSheet.absoluteFillObject,
    height: 450,
    zIndex: -1,
  },
  topPartContainer: {
    paddingBottom: 20,
    zIndex: 1000,
    elevation: 80, // Force surface above everything else on Android
    backgroundColor: '#2E2A85', // Solid fallback
  },
  bottomPocket: {
    height: 80,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    zIndex: 1,
    elevation: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    flex: 1,
    paddingLeft: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFFFFF',
    paddingRight: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 0,
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  specializationText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    marginTop: -2,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#2E2A85',
    zIndex: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
