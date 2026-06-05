import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Wallet, Users, CalendarDays, UserCheck, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../../../../shared/utils/currency';
import { UserAvatar } from '../../../../../../shared/components/UserAvatar';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';
import { IS_PURCHASE_UI_ENABLED } from '../../../../../../shared/constants/platform';
import { componentRadius } from '../../../../../../shared/constants/theme';

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
  /** Contextual nudge actions — fired when an empty KPI card is tapped */
  onAddInvoice?: () => void;
  onAddPatient?: () => void;
  onAddAppointment?: () => void;
}

// A single KPI tile. When `nudge` is provided the card becomes tappable and
// shows a contextual call-to-action instead of leaving a dead zero on screen.
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  nudge?: { text: string; actionable: boolean; onPress?: () => void };
}> = ({ icon, label, value, loading = false, nudge }) => {
  const tappable = !!nudge?.actionable && !!nudge.onPress;
  const Wrapper: any = tappable ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.statCard}
      {...(tappable ? { onPress: nudge!.onPress, activeOpacity: 0.7 } : {})}
    >
      <View style={styles.statTopRow}>
        {icon}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {loading ? (
        <View style={styles.statSkeletonWrap}>
          <AppSkeleton width="72%" height={28} radius={7} />
        </View>
      ) : (
        <Text
          style={styles.statValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {value}
        </Text>
      )}
      {!loading && nudge ? (
        <View style={styles.statNudgeRow}>
          <Text
            style={[styles.statNudge, !nudge.actionable && styles.statNudgeMuted]}
            numberOfLines={1}
          >
            {nudge.text}
          </Text>
          {nudge.actionable ? (
            <ArrowRight size={12} color="#C4B5FD" strokeWidth={2.5} />
          ) : null}
        </View>
      ) : null}
    </Wrapper>
  );
};

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
  onAddInvoice,
  onAddPatient,
  onAddAppointment,
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
      </SafeAreaView>
    </LinearGradient>
  );
};

interface WelcomeHeaderStatsProps {
  dailyRevenue: number;
  totalPatients: number;
  totalAppointments: number;
  totalChecking: number;
  loading?: boolean;
  onAddInvoice?: () => void;
  onAddPatient?: () => void;
  onAddAppointment?: () => void;
}

// 2b. Stats cards — live below the sticky greeting and scroll away with content.
export const WelcomeHeaderStats: React.FC<WelcomeHeaderStatsProps> = ({
  dailyRevenue,
  totalPatients,
  totalAppointments,
  totalChecking,
  loading = false,
  onAddInvoice,
  onAddPatient,
  onAddAppointment,
}) => {
  return (
    <LinearGradient
      colors={['#393399', '#4338CA']}
      style={styles.statsContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <View style={styles.statsGrid}>
        <StatCard
          icon={<Wallet size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="REVENUE"
          value={`${getCurrencySymbol()}${dailyRevenue.toLocaleString('en-IN')}`}
          loading={loading}
          nudge={dailyRevenue === 0 ? { text: 'Add first invoice', actionable: true, onPress: onAddInvoice } : undefined}
        />
        <StatCard
          icon={<Users size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="PATIENTS"
          value={totalPatients.toLocaleString()}
          loading={loading}
          nudge={totalPatients === 0 ? { text: 'Register a patient', actionable: true, onPress: onAddPatient } : undefined}
        />
        <StatCard
          icon={<CalendarDays size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="TODAY'S APTS."
          value={totalAppointments.toLocaleString()}
          loading={loading}
          nudge={totalAppointments === 0 ? { text: 'Schedule one', actionable: true, onPress: onAddAppointment } : undefined}
        />
        <StatCard
          icon={<UserCheck size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="CHECK-INS"
          value={totalChecking.toLocaleString()}
          loading={loading}
          nudge={totalChecking === 0 ? { text: 'Waiting room empty', actionable: false } : undefined}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  absoluteBackdrop: {
    // Only tall enough to back the status-bar / over-scroll bounce area.
    // The header paints its own purple, so this never sits behind the chart.
    ...StyleSheet.absoluteFillObject,
    height: 200,
    zIndex: -1,
  },
  topPartContainer: {
    zIndex: 1000,
    elevation: 80,
    backgroundColor: '#2E2A85',
  },
  statsContainer: {
    paddingTop: 4,
    paddingBottom: 24,
    backgroundColor: '#393399',
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
    borderRadius: componentRadius.pill, // 20 — badge pill
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
    borderRadius: componentRadius.pill, // 20 — badge pill
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
    // Amber, not blue — a trial counting down is urgency, and urgency reads amber.
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: componentRadius.pill, // 20 — badge pill
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  trialBadgeText: {
    color: '#FCD34D',
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
    borderRadius: componentRadius.statCard, // 10
    paddingVertical: 13,
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
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statSkeletonWrap: {
    opacity: 0.45,
  },
  statNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  statNudge: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: '#C4B5FD',
  },
  statNudgeMuted: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
});
