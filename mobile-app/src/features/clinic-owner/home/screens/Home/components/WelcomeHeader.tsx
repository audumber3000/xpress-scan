import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell, ChevronDown, Wallet, Users, CalendarDays, ArrowRight,
  ReceiptText, TrendingUp, TrendingDown,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../../../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../../../../shared/utils/currency';
import { UserAvatar } from '../../../../../../shared/components/UserAvatar';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';
import { planBadge } from '../../../../../../shared/utils/planBadge';
import { PeriodFilter, Period } from '../../../../../../shared/components/home/PeriodFilter';
import type { Analytics } from '../../../../../../services/api/analytics.api';
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
  // Any stored plan name; resolved through the catalogue rather than compared.
  subscriptionPlan?: string | null;
  isTrial?: boolean;
  trialDaysRemaining?: number | null;
  /** Where the plan stands: 'ok' | 'renewal_due' | 'trial_ended' | 'lapsed' | … */
  planState?: string | null;
  planStateDays?: number | null;
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

/**
 * The plan chip on the greeting bar, in the header's own colours.
 *
 * `shared/utils/planBadge` decides WHAT it says — one answer shared with the
 * Control Center strip and the Profile row, because three surfaces disagreeing
 * about which plan a clinic is on is precisely the bug that had the web header
 * saying Plus over a page saying Pro. This decides only how it looks against a
 * dark indigo gradient, where planBadge's pale-on-pale pairs would vanish.
 */
const planChip = (clinic: {
  subscriptionPlan?: string | null;
  isTrial?: boolean;
  trialDaysRemaining?: number | null;
  planState?: string | null;
  planStateDays?: number | null;
}) => {
  const badge = planBadge({
    effective_plan: clinic.subscriptionPlan,
    is_trial: clinic.isTrial,
    trial_days_remaining: clinic.trialDaysRemaining,
    plan_state: clinic.planState,
    plan_state_days: clinic.planStateDays,
  });

  const skin = badge.urgent
    ? { fill: 'rgba(239, 68, 68, 0.25)', border: '#F87171', text: '#FECACA' }
    : clinic.planState === 'renewal_due' || clinic.planState === 'grant_due'
    ? { fill: 'rgba(245, 158, 11, 0.22)', border: '#F59E0B', text: '#FCD34D' }
    : clinic.isTrial
    ? { fill: 'rgba(45, 212, 191, 0.20)', border: '#2DD4BF', text: '#99F6E4' }
    : { fill: 'rgba(255,255,255,0.14)', border: 'rgba(255,255,255,0.30)', text: '#FFFFFF' };

  return { ...skin, label: badge.label.toUpperCase() };
};

// A single KPI tile. When `nudge` is provided the card becomes tappable and
// shows a contextual call-to-action instead of leaving a dead zero on screen.
/**
 * The period-over-period badge.
 *
 * `invert` is what makes Outstanding behave: everywhere else a number going up
 * is good news and reads green, but money owed going up is the opposite. The
 * server already flags it (`outstanding.invert`) and the web dashboard honours
 * it; showing a rising debt in green would quietly congratulate somebody on
 * their worst week.
 */
const ChangeBadge: React.FC<{ change: string; invert?: boolean }> = ({ change, invert }) => {
  const value = parseFloat(change.replace('%', ''));
  if (!Number.isFinite(value) || value === 0) return null;

  const good = invert ? value < 0 : value > 0;
  const Arrow = value > 0 ? TrendingUp : TrendingDown;

  return (
    <View style={styles.statBadge}>
      <Arrow size={9} color={good ? '#6EE7B7' : '#FCA5A5'} strokeWidth={3} />
      <Text style={[styles.statBadgeText, { color: good ? '#6EE7B7' : '#FCA5A5' }]}>
        {change.replace('+', '')}
      </Text>
    </View>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  nudge?: { text: string; actionable: boolean; onPress?: () => void };
  /** The one line that makes the number mean something. Web calls it storyShort. */
  detail?: string;
  change?: string;
  invertChange?: boolean;
  onPress?: () => void;
}> = ({ icon, label, value, loading = false, nudge, detail, change, invertChange, onPress }) => {
  const tappable = (!!nudge?.actionable && !!nudge.onPress) || !!onPress;
  const Wrapper: any = tappable ? TouchableOpacity : View;
  const press = onPress || nudge?.onPress;
  return (
    <Wrapper
      style={styles.statCard}
      {...(tappable ? { onPress: press, activeOpacity: 0.7 } : {})}
    >
      {/* Label gets the whole row. The badge used to sit here too and pushed
          "TODAY'S APTS." into "TODAY'S AP…". It belongs beside the number
          anyway: the percentage describes the figure, not the heading. */}
      <View style={styles.statTopRow}>
        {icon}
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      {loading ? (
        <View style={styles.statSkeletonWrap}>
          <AppSkeleton width="72%" height={28} radius={7} />
        </View>
      ) : (
        <View style={styles.statValueRow}>
          <Text
            style={styles.statValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {value}
          </Text>
          {!!change && <ChangeBadge change={change} invert={invertChange} />}
        </View>
      )}
      {/* The detail line, or the nudge when the figure is zero and there is
          something better to say than "0". Never both: two lines of small text
          under a number in a tile this size is unreadable. */}
      {!loading && !nudge && !!detail ? (
        <Text style={styles.statDetail} numberOfLines={1}>{detail}</Text>
      ) : null}
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
  subscriptionPlan = null,
  isTrial = false,
  trialDaysRemaining = null,
  planState = null,
  planStateDays = null,
  onPlanPress,
  photoURL,
  avatarSeed,
  onAddInvoice,
  onAddPatient,
  onAddAppointment,
}) => {
  const chip = planChip({
    subscriptionPlan, isTrial, trialDaysRemaining, planState, planStateDays,
  });

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
            {/* One chip, always present, always naming the plan. It used to be
                three: a trial badge, a PRO badge, and an "⚡ Upgrade" button for
                everyone else — which after the migration meant every Plus
                clinic, i.e. every paying customer, was being told to upgrade
                from the plan they had just bought.

                It never sells anything now. Tapping opens the Subscription
                screen, which explains that plans are chosen on the web. */}
            <TouchableOpacity
              style={[styles.planChip, { borderColor: chip.border, backgroundColor: chip.fill }]}
              onPress={onPlanPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.planChipText, { color: chip.text }]}>{chip.label}</Text>
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
      </SafeAreaView>
    </LinearGradient>
  );
};

interface WelcomeHeaderStatsProps {
  /** The whole metrics payload. The four tiles read from it directly rather
   *  than having each figure threaded through as its own prop, which is what
   *  kept them limited to a bare number with no supporting detail. */
  analytics: Analytics | null;
  loading?: boolean;
  /** The one time range, for these four figures AND every chart below. */
  period: Period;
  onPeriodChange: (period: Period) => void;
  onAddInvoice?: () => void;
  onAddPatient?: () => void;
  onAddAppointment?: () => void;
  onOutstandingPress?: () => void;
  onAppointmentsPress?: () => void;
}

/** ₹68.4K rather than ₹68,430. Tiles this size cannot hold the long form. */
const compactMoney = (amount: number): string => {
  const sym = getCurrencySymbol();
  const n = Math.abs(amount);
  if (n >= 10000000) return `${sym}${(amount / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 100000) return `${sym}${(amount / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1000) return `${sym}${(amount / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sym}${Math.round(amount).toLocaleString('en-IN')}`;
};

/**
 * The dates the four figures actually cover, spelled out.
 *
 * The chip says "Today" or "7 days"; this says which days. Without it the
 * filter tells you the shape of the window but never where it is, which is the
 * question somebody looking at a revenue figure at 9am actually has.
 */
const rangeCaption = (period: Period): string => {
  const now = new Date();
  const d = (date: Date) =>
    date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (period === 'today') return d(now);

  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return d(y);
  }

  if (period === '7days') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return `${d(from)} to ${d(now)}`;
  }

  if (period === 'month') {
    return now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  return 'Everything so far';
};

// 2b. Stats cards — live below the sticky greeting and scroll away with content.
export const WelcomeHeaderStats: React.FC<WelcomeHeaderStatsProps> = ({
  analytics,
  loading = false,
  period,
  onPeriodChange,
  onAddInvoice,
  onAddPatient,
  onAddAppointment,
  onOutstandingPress,
  onAppointmentsPress,
}) => {
  const revenue = analytics?.dailyRevenue || 0;
  const billed = analytics?.billed || 0;
  const patients = analytics?.totalPatients || 0;
  const last30 = analytics?.patientsLast30Days || 0;
  const outstanding = analytics?.outstanding || 0;
  const unpaidCount = analytics?.outstandingInvoiceCount || 0;
  const appointments = analytics?.appointments || 0;
  const completed = analytics?.appointmentsCompleted || 0;
  const scheduled = analytics?.appointmentsScheduled || 0;

  return (
    <LinearGradient
      colors={['#393399', '#4338CA']}
      style={styles.statsContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {/* The one filter, in the corner of the block it governs.
          It used to live inside each chart card, below these numbers, which
          left the four figures with nothing on screen saying what window they
          counted. Same arrangement the web dashboard uses. */}
      <View style={styles.statsHead}>
        <Text style={styles.statsRange} numberOfLines={1}>{rangeCaption(period)}</Text>
        <PeriodFilter value={period} onChange={onPeriodChange} onDark />
      </View>

      {/* The same four the web dashboard shows, in the same order:
          revenue collected, total patients, outstanding, appointments.

          Outstanding replaces the old CHECK-INS tile. Check-ins were never a
          period figure worth a quarter of the dashboard, and they are already
          the first thing in the Right Now strip directly below, where "who is
          waiting" actually belongs. Money owed is the number a clinic owner
          opens the app to find, and it was on the web dashboard only. */}
      <View style={styles.statsGrid}>
        <StatCard
          icon={<Wallet size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="REVENUE"
          value={compactMoney(revenue)}
          change={analytics?.revenueChange}
          detail={billed > 0 ? `of ${compactMoney(billed)} billed` : undefined}
          loading={loading}
          nudge={revenue === 0 && billed === 0
            ? { text: 'Add first invoice', actionable: true, onPress: onAddInvoice }
            : undefined}
        />
        <StatCard
          icon={<Users size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="PATIENTS"
          value={patients.toLocaleString('en-IN')}
          change={analytics?.patientsChange}
          detail={last30 > 0 ? `+${last30.toLocaleString('en-IN')} in 30 days` : 'None in 30 days'}
          loading={loading}
          nudge={patients === 0
            ? { text: 'Register a patient', actionable: true, onPress: onAddPatient }
            : undefined}
        />
        <StatCard
          icon={<ReceiptText size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label="OUTSTANDING"
          value={compactMoney(outstanding)}
          change={analytics?.outstandingChange}
          invertChange
          detail={unpaidCount > 0
            ? `${unpaidCount} unpaid ${unpaidCount === 1 ? 'invoice' : 'invoices'}`
            : 'All settled'}
          loading={loading}
          onPress={onOutstandingPress}
        />
        <StatCard
          icon={<CalendarDays size={15} color="rgba(255,255,255,0.65)" strokeWidth={2.5} />}
          label={period === 'today' ? "TODAY'S APTS." : 'APPOINTMENTS'}
          value={appointments.toLocaleString('en-IN')}
          change={analytics?.appointmentsChange}
          detail={appointments > 0 ? `${completed} done, ${scheduled} booked` : undefined}
          loading={loading}
          nudge={appointments === 0
            ? { text: 'Schedule one', actionable: true, onPress: onAddAppointment }
            : undefined}
          onPress={appointments > 0 ? onAppointmentsPress : undefined}
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
  statsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  statsRange: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 0.2,
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
  planChip: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: componentRadius.pill, // 20 — badge pill
    borderWidth: 1,
    maxWidth: 120,
  },
  planChipText: {
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
    flexShrink: 1,
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
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statDetail: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.58)',
    marginTop: 3,
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
