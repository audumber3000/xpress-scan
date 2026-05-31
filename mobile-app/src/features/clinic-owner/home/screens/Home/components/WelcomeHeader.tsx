import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Wallet, Users, CalendarDays, UserCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../../../../shared/utils/currency';
import { UserAvatar } from '../../../../../../shared/components/UserAvatar';
import { IS_PURCHASE_UI_ENABLED } from '../../../../../../shared/constants/platform';

interface WelcomeHeaderProps {
  userName: string;
  clinicName?: string;
  onNotificationPress: () => void;
  dailyRevenue: number;
  totalPatients: number;
  totalAppointments: number;
  totalChecking: number;
  onClinicPress?: () => void;
  onProfilePress?: () => void;
  loading?: boolean;
  subscriptionPlan?: 'free' | 'professional';
  isTrial?: boolean;
  trialDaysRemaining?: number | null;
  onUpgradePress?: () => void;
  onPlanPress?: () => void;
  /** Firebase photoURL (Google / Apple profile picture) */
  photoURL?: string | null;
  /** Email used as seed for the DiceBear fallback avatar */
  avatarSeed?: string | null;
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
  totalAppointments,
  totalChecking,
  onClinicPress,
  onProfilePress,
  loading = false,
  subscriptionPlan = 'free',
  isTrial = false,
  trialDaysRemaining = null,
  onUpgradePress,
  onPlanPress,
  photoURL,
  avatarSeed,
}) => {
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
            style={styles.avatarBorder}
            onPress={onProfilePress}
            activeOpacity={0.8}
          >
            <UserAvatar
              size={44}
              photoURL={photoURL}
              seed={avatarSeed || userName}
              name={userName}
              fallbackBg="rgba(255,255,255,0.25)"
              fallbackColor="#FFFFFF"
            />
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
            {isTrial ? (
              <TouchableOpacity
                style={styles.trialBadge}
                onPress={onPlanPress}
                activeOpacity={0.8}
              >
                <Text style={styles.trialBadgeText}>
                  🕐 Trial
                  {/* Suppress trial countdown on iOS — Apple reviewers can read
                      "X days left" as steering toward an external purchase. */}
                  {!IS_PURCHASE_UI_ENABLED
                    ? ''
                    : typeof trialDaysRemaining === 'number'
                    ? ` · ${trialDaysRemaining}d left`
                    : ''}
                </Text>
              </TouchableOpacity>
            ) : subscriptionPlan === 'professional' ? (
              <TouchableOpacity
                style={styles.proBadge}
                onPress={onPlanPress}
                activeOpacity={0.8}
              >
                <Text style={styles.proBadgeText}>
                  ✦ PRO
                  {!IS_PURCHASE_UI_ENABLED
                    ? ''
                    : typeof trialDaysRemaining === 'number'
                    ? ` · ${trialDaysRemaining}d left`
                    : ''}
                </Text>
              </TouchableOpacity>
            ) : IS_PURCHASE_UI_ENABLED ? (
              <TouchableOpacity
                style={styles.upgradeBadge}
                onPress={onUpgradePress}
                activeOpacity={0.8}
              >
                <Text style={styles.upgradeBadgeText}>⚡ Upgrade</Text>
              </TouchableOpacity>
            ) : null}
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

        {/* Stats Cards — 2x2 grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statTopRow}>
              <Wallet size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />
              <Text style={styles.statLabel}>REVENUE</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {getCurrencySymbol()}{dailyRevenue.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statTopRow}>
              <Users size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />
              <Text style={styles.statLabel}>PATIENTS</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {totalPatients.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statTopRow}>
              <CalendarDays size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />
              <Text style={styles.statLabel}>APPOINTMENTS</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {totalAppointments.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statTopRow}>
              <UserCheck size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />
              <Text style={styles.statLabel}>CHECKING</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {totalChecking.toLocaleString()}
            </Text>
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
  avatarBorder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
  proBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  proBadgeText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trialBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  trialBadgeText: {
    color: '#BFDBFE',
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
