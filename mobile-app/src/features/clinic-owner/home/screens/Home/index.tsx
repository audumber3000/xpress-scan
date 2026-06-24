import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, RefreshControl, Dimensions, Animated } from 'react-native';
import { useAuth } from '../../../../../app/AuthContext';
import { transactionsApiService, Transaction } from '../../../../../services/api/transactions.api';
import { analyticsApiService, Analytics } from '../../../../../services/api/analytics.api';
import { appointmentsApiService, Appointment } from '../../../../../services/api/appointments.api';
import { RecentTransactions } from '../../../../../shared/components/home/RecentTransactions';
import { NotificationsScreen } from '../NotificationsScreen';
import {
  WelcomeHeaderBackground,
  WelcomeHeaderTopPart,
  WelcomeHeaderStats
} from './components/WelcomeHeader';
import { MetricChartCard } from '../../../../../shared/components/home/MetricChartCard';
import { getCurrencySymbol } from '../../../../../shared/utils/currency';
import { ErrorBanner } from './components/ErrorBanner';
import { GetStartedChecklist } from './components/GetStartedChecklist';
import { googleReviewsApiService, GooglePlaceStatus } from '../../../../../services/api/google-reviews.api';
import { colors } from '../../../../../shared/constants/colors';
import { RightNowStrip } from './components/RightNowStrip';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DOT_INACTIVE_WIDTH = 8;
const DOT_ACTIVE_WIDTH = 24;

const PaginationDot: React.FC<{ active: boolean }> = ({ active }) => {
  const width = useRef(new Animated.Value(active ? DOT_ACTIVE_WIDTH : DOT_INACTIVE_WIDTH)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: active ? DOT_ACTIVE_WIDTH : DOT_INACTIVE_WIDTH,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [active, width]);
  return (
    <Animated.View
      style={[styles.dot, { width, backgroundColor: active ? colors.primary : '#D1D5DB' }]}
    />
  );
};

const ChartPage: React.FC<{
  index: number;
  scrollX: Animated.Value;
  children: React.ReactNode;
}> = ({ index, scrollX, children }) => {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.96, 1, 0.96],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.72, 1, 0.72],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.chartPage, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

type Period = 'Today' | 'Last 7 Days' | 'This Month';

// Build x-axis labels for the selected period.
function periodLabels(period: Period, length: number): string[] {
  if (period === 'Today') {
    return [new Date().toLocaleDateString('en-US', { weekday: 'short' })];
  }
  if (period === 'Last 7 Days') {
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return labels;
  }
  // This Month → weekly buckets
  return Array.from({ length }, (_, i) => `W${i + 1}`);
}

// The real per-bucket series the backend gives us (appointments / visits per bucket).
function visitsSeries(analytics: Analytics | null, period: Period) {
  const data = analytics?.patientVisits || [];
  return {
    data,
    labels: periodLabels(period, data.length),
    hasData: data.length > 0 && data.some((v) => v > 0),
  };
}

// Revenue: scale the visit series so its total matches the period revenue.
function revenueSeries(analytics: Analytics | null, period: Period) {
  const visits = analytics?.patientVisits || [];
  const total = visits.reduce((s, v) => s + v, 0);
  const revenue = analytics?.dailyRevenue || 0;
  const factor = total > 0 ? revenue / total : 0;
  const data = visits.map((v) => Math.round(v * factor));
  return {
    data,
    labels: periodLabels(period, data.length),
    hasData: data.length > 0 && revenue > 0,
  };
}

// Turn a signed "+5%" / "-3%" / "+0%" into a badge with the right colour.
function changeBadge(pct: string): { text: string; tone: 'positive' | 'negative' | 'neutral' } {
  const isZero = /^[+-]?0(\.0+)?%$/.test(pct);
  return {
    text: pct,
    tone: isZero ? 'neutral' : pct.startsWith('-') ? 'negative' : 'positive',
  };
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function appointmentDateTime(appointment: Appointment) {
  const [hour = '0', minute = '0'] = appointment.startTime.split(':');
  const date = new Date(`${appointment.date}T00:00:00`);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
}

function formatAppointmentTime(appointment: Appointment) {
  return appointmentDateTime(appointment).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getNextAppointmentTime(appointments: Appointment[]) {
  const now = new Date();
  const inactiveStatuses = new Set(['cancelled', 'finished', 'rejected']);
  const next = appointments
    .filter((appointment) => !inactiveStatuses.has(String(appointment.status).toLowerCase()))
    .map((appointment) => ({ appointment, startsAt: appointmentDateTime(appointment) }))
    .filter(({ startsAt }) => startsAt >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  return next ? formatAppointmentTime(next.appointment) : null;
}

interface HomeScreenProps {
  navigation: any;
}

export const ClinicOwnerHomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, backendUser, setIsClinicSwitcherVisible } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Last 7 Days' | 'This Month'>('Today');
  const [apiPeriod, setApiPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | 'All'>('1D');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [googleStatus, setGoogleStatus] = useState<GooglePlaceStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [cityRank, setCityRank] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const firstName = (backendUser?.name || user?.displayName || 'Doctor').split(' ')[0];
  const role = backendUser?.role;
  const userName = (role === 'clinic_owner' || role === 'doctor') ? `Dr. ${firstName}` : firstName;

  // Global Sync: Load data whenever the active clinic changes or period changes
  useEffect(() => {
    loadData();
  }, [backendUser?.clinic?.id]);

  useEffect(() => {
    const periodMapping: Record<string, '1D' | '1W' | '1M' | '3M' | '6M' | 'All'> = {
      'Today': '1D',
      'Last 7 Days': '1W',
      'This Month': '1M',
    };
    const newApiPeriod = periodMapping[selectedPeriod] || '1D';
    setApiPeriod(newApiPeriod);
    loadAnalytics(newApiPeriod, true);
  }, [selectedPeriod]);

  const loadTransactions = async (preserveExisting = false) => {
    try {
      const clinicId = backendUser?.clinic?.id;
      const transactionsData = await transactionsApiService.getTransactions(100, clinicId);
      setTransactions(transactionsData);
    } catch (err) {
      if (!preserveExisting) setTransactions([]);
    }
  };

  const loadAnalytics = async (
    periodOverride?: '1D' | '1W' | '1M' | '3M' | '6M' | 'All',
    preserveExisting = true,
  ) => {
    try {
      setAnalyticsLoading(true);
      const clinicId = backendUser?.clinic?.id;
      const periodToUse = periodOverride || apiPeriod;
      const analyticsData = await analyticsApiService.getAnalytics(periodToUse, clinicId);
      setAnalytics(analyticsData);
    } catch (err) {
      if (!preserveExisting) setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadTodayAppointments = async (preserveExisting = false) => {
    try {
      const today = localDateString(new Date());
      const appointments = await appointmentsApiService.getAppointments(today, today);
      setTodayAppointments(appointments);
    } catch (err) {
      if (!preserveExisting) setTodayAppointments([]);
    }
  };

  const loadGoogleStatus = async (preserveExisting = false) => {
    setGoogleLoading(true);
    try {
      const [s, competitors] = await Promise.all([
        googleReviewsApiService.getStatus(),
        googleReviewsApiService.getCompetitors('city'),
      ]);
      setGoogleStatus(s);
      if (competitors?.competitors?.length) {
        const idx = competitors.competitors.findIndex(c => c.is_our_clinic);
        setCityRank(idx >= 0 ? idx + 1 : null);
      } else {
        setCityRank(null);
      }
    } catch (err) {
      if (!preserveExisting) {
        setGoogleStatus({ linked: false });
        setCityRank(null);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const loadData = async (options?: { preserveExisting?: boolean }) => {
    const preserveExisting = options?.preserveExisting ?? false;
    try {
      if (!preserveExisting) setLoading(true);
      await Promise.all([
        loadAnalytics(undefined, preserveExisting),
        loadTransactions(preserveExisting),
        loadTodayAppointments(preserveExisting),
        loadGoogleStatus(preserveExisting),
      ]);
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      if (!preserveExisting) setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData({ preserveExisting: true });
    } catch (err) {
      // handled in loadData
    } finally {
      setRefreshing(false);
    }
  };

  const dailyRevenue = analytics?.dailyRevenue || 0;
  const totalPatients = analytics?.totalPatients || 0;
  const totalAppointments = analytics?.appointments || 0;
  const totalChecking = analytics?.checking || 0;
  const nextAppointmentTime = getNextAppointmentTime(todayAppointments);
  const unpaidInvoicesCount = transactions.filter(
    (transaction) => transaction.status === 'pending' || transaction.type === 'pending',
  ).length;
  const reviewCount = googleStatus?.linked ? googleStatus.total_review_count ?? null : null;
  const showInitialSkeletons = loading && !analytics;

  // Contextual nudges → take the user straight to the action.
  const goToInvoice = () => navigation.navigate('Patients');
  const goToPatient = () => navigation.navigate('Patients');
  const goToAppointment = () => navigation.navigate('AddAppointment');

  // Onboarding checklist — disappears once the clinic is up and running.
  const checklistSteps = [
    { key: 'patient', label: 'Register your first patient', done: totalPatients > 0, onPress: goToPatient },
    { key: 'appointment', label: 'Schedule an appointment', done: totalAppointments > 0, onPress: goToAppointment },
    // "Has ever invoiced" — not today's revenue, so established clinics aren't nagged.
    { key: 'invoice', label: 'Create your first invoice', done: transactions.length > 0 || dailyRevenue > 0, onPress: goToInvoice },
  ];

  // Chart series for the carousel.
  const visits = visitsSeries(analytics, selectedPeriod);
  const revenue = revenueSeries(analytics, selectedPeriod);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Layer 1: Global backdrop */}
      <WelcomeHeaderBackground />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]} 
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.gray100}
            title="Refreshing clinic data..."
            titleColor={colors.textSecondary}
          />
        }
      >
        {/* Layer 3: Sticky Opaque Part 1 */}
        <WelcomeHeaderTopPart
          userName={userName}
          clinicName={backendUser?.clinic?.name || ''}
          onNotificationPress={() => setShowNotifications(true)}
          onClinicPress={() => setIsClinicSwitcherVisible(true)}
          onProfilePress={() => navigation.navigate('Profile')}
          dailyRevenue={dailyRevenue}
          totalPatients={totalPatients}
          totalAppointments={totalAppointments}
          totalChecking={totalChecking}
          subscriptionPlan={backendUser?.clinic?.subscription_plan}
          isTrial={backendUser?.clinic?.is_trial}
          trialDaysRemaining={backendUser?.clinic?.trial_days_remaining}
          onUpgradePress={() => navigation.navigate('Purchase')}
          onPlanPress={() => navigation.navigate('Subscription')}
          photoURL={user?.photoURL}
          avatarSeed={user?.email || backendUser?.email}
          onAddInvoice={goToInvoice}
          onAddPatient={goToPatient}
          onAddAppointment={goToAppointment}
        />

        {/* KPI cards — scroll away with content; only the greeting above stays sticky */}
        <WelcomeHeaderStats
          dailyRevenue={dailyRevenue}
          totalPatients={totalPatients}
          totalAppointments={totalAppointments}
          totalChecking={totalChecking}
          loading={showInitialSkeletons}
          onAddInvoice={goToInvoice}
          onAddPatient={goToPatient}
          onAddAppointment={goToAppointment}
        />

        <RightNowStrip
          waitingCount={totalChecking}
          nextAppointmentTime={nextAppointmentTime}
          unpaidInvoicesCount={unpaidInvoicesCount}
          reviewCount={reviewCount}
          reviewsLinked={!!googleStatus?.linked}
          reviewRating={googleStatus?.current_rating ?? null}
          loading={showInitialSkeletons}
          refreshing={refreshing || analyticsLoading}
          lastUpdatedAt={lastUpdatedAt}
          onWaitingPress={() => navigation.navigate('Appointments')}
          onAppointmentsPress={() => navigation.navigate('Appointments')}
          onInvoicesPress={() => navigation.navigate('AllTransactions')}
          onReviewsPress={() => navigation.navigate('GoogleReviews')}
          onConnectReviewsPress={() => navigation.navigate('GoogleReviews')}
        />

        {/* Swipeable chart cards on the plain screen background (no purple behind) */}
        <View style={styles.chartWrapper}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true },
            )}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActivePage(page);
            }}
          >
            <ChartPage index={0} scrollX={scrollX}>
              <MetricChartCard
                title="New Patients"
                value={totalPatients.toLocaleString()}
                badge={changeBadge(analytics?.patientsChange || '+0%')}
                chartType="line"
                color="#E08A3C"
                data={visits.data}
                labels={visits.labels}
                hasData={visits.hasData}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={showInitialSkeletons}
                refreshing={refreshing || analyticsLoading}
                lastUpdatedAt={lastUpdatedAt}
                emptyMessage="No new patients yet today"
                unitLabel="patient"
              />
            </ChartPage>
            <ChartPage index={1} scrollX={scrollX}>
              <MetricChartCard
                title="Appointments"
                value={totalAppointments.toLocaleString()}
                badge={changeBadge(analytics?.appointmentsChange || '+0%')}
                chartType="bar"
                color="#E5484D"
                data={visits.data}
                labels={visits.labels}
                hasData={visits.hasData}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={showInitialSkeletons}
                refreshing={refreshing || analyticsLoading}
                lastUpdatedAt={lastUpdatedAt}
                emptyMessage="No appointments yet today"
                unitLabel="appointment"
              />
            </ChartPage>
            <ChartPage index={2} scrollX={scrollX}>
              <MetricChartCard
                title="Revenue"
                value={`${getCurrencySymbol()}${dailyRevenue.toLocaleString('en-IN')}`}
                badge={changeBadge(analytics?.revenueChange || '+0%')}
                chartType="line"
                color="#2E9E5B"
                data={revenue.data}
                labels={revenue.labels}
                hasData={revenue.hasData}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={showInitialSkeletons}
                refreshing={refreshing || analyticsLoading}
                lastUpdatedAt={lastUpdatedAt}
                emptyMessage="No revenue yet today"
                unitLabel="revenue"
                formatInspectValue={(amount) => `${getCurrencySymbol()}${amount.toLocaleString('en-IN')}`}
              />
            </ChartPage>
            <ChartPage index={3} scrollX={scrollX}>
              <MetricChartCard
                title="Patient Visits"
                value={totalAppointments.toLocaleString()}
                badge={changeBadge(analytics?.appointmentsChange || '+0%')}
                chartType="bar"
                color="#6B63C9"
                data={visits.data}
                labels={visits.labels}
                hasData={visits.hasData}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={showInitialSkeletons}
                refreshing={refreshing || analyticsLoading}
                lastUpdatedAt={lastUpdatedAt}
                emptyMessage="No visits yet today"
                unitLabel="visit"
              />
            </ChartPage>
          </Animated.ScrollView>
          {/* Pagination dots */}
          <View style={styles.carouselHint}>
            <Text style={styles.swipeHintText}>Swipe for more insights</Text>
            <View style={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <PaginationDot key={i} active={activePage === i} />
              ))}
            </View>
          </View>
        </View>

        <ErrorBanner error={error} onRetry={loadData} />

        {/* Onboarding only: a clinic that has any financial activity (or revenue
            today) is operational, so the checklist gets out of the way. */}
        {!loading && transactions.length === 0 && dailyRevenue === 0 && (
          <GetStartedChecklist steps={checklistSteps} dismissKey={backendUser?.clinic?.id} />
        )}

        <RecentTransactions
          transactions={transactions}
          onViewAll={() => navigation.navigate('AllTransactions')}
          loading={loading}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <NotificationsScreen
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
  },
  chartWrapper: {
    marginTop: 16,
    zIndex: 5,
    elevation: 2,
    marginBottom: 8,
  },
  chartPage: {
    width: SCREEN_WIDTH,
  },
  carouselHint: {
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  swipeHintText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
