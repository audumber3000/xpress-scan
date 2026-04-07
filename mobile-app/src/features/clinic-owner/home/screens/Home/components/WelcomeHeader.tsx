import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Bookmark, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../../../shared/constants/colors';

interface WelcomeHeaderProps {
  userName: string;
  clinicName?: string;
  onNotificationPress: () => void;
  dailyRevenue: number;
  totalPatients: number;
  onClinicPress?: () => void;
  onProfilePress?: () => void;
  loading?: boolean;
  subscriptionPlan?: 'free' | 'professional';
  onUpgradePress?: () => void;
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

// 2. Part One: Compact greeting row + stats cards
export const WelcomeHeaderTopPart: React.FC<WelcomeHeaderProps> = ({
  userName,
  clinicName,
  onNotificationPress,
  dailyRevenue,
  totalPatients,
  onClinicPress,
  onProfilePress,
  loading = false,
  subscriptionPlan = 'free',
  onUpgradePress,
}) => {
  // Derive initials for avatar
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <LinearGradient
      colors={['#2E2A85', '#393399']}
      style={styles.topPartContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <SafeAreaView edges={['top']}>
        {/* Compact greeting row */}
        <View style={styles.headerContent}>
          {/* Left: Avatar */}
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={onProfilePress}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>{initials || 'DR'}</Text>
          </TouchableOpacity>

          {/* Center: Name + Clinic */}
          <View style={styles.nameBlock}>
            <Text style={styles.hiText} numberOfLines={1}>
              Hi, {userName}
            </Text>
            <TouchableOpacity
              style={styles.clinicRow}
              onPress={onClinicPress}
              activeOpacity={0.7}
            >
              <Text style={styles.clinicText} numberOfLines={1}>
                {clinicName || 'My Clinic'}
              </Text>
              <ChevronDown size={14} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {/* Right: actions */}
          <View style={styles.rightActions}>
            {subscriptionPlan !== 'professional' && (
              <TouchableOpacity
                style={styles.upgradeBadge}
                onPress={onUpgradePress}
                activeOpacity={0.8}
              >
                <Text style={styles.upgradeBadgeText}>⚡ PRO</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Bookmark size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onNotificationPress}
              activeOpacity={0.7}
            >
              <View style={styles.notificationDot} />
              <Bell size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>REVENUE</Text>
            <Text style={styles.statValue}>₹{dailyRevenue.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>PATIENTS</Text>
            <Text style={styles.statValue}>{totalPatients.toLocaleString()}</Text>
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
    elevation: 80,
    backgroundColor: '#2E2A85',
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  // Avatar circle (tappable → profile)
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Name + clinic block
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  hiText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  clinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  clinicText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    flexShrink: 1,
  },
  // Right action icons
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upgradeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  upgradeBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#2E2A85',
    zIndex: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
