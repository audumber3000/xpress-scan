import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, RefreshControl, Dimensions } from 'react-native';
import { useAuth } from '../../../../../app/AuthContext';
import { transactionsApiService, Transaction } from '../../../../../services/api/transactions.api';
import { analyticsApiService, Analytics } from '../../../../../services/api/analytics.api';
import { RecentTransactions } from '../../../../../shared/components/home/RecentTransactions';
import { NotificationsScreen } from '../NotificationsScreen';
import {
  WelcomeHeaderBackground,
  WelcomeHeaderTopPart,
  WelcomeHeaderBottomPocket
} from './components/WelcomeHeader';
import { PatientVisitsSection } from './components/PatientVisitsSection';
import { RevenueSection } from './components/RevenueSection';
import { ErrorBanner } from './components/ErrorBanner';
import { GoogleReviewsRow } from '../../../../../shared/components/home/GoogleReviewsRow';
import { googleReviewsApiService, GooglePlaceStatus } from '../../../../../services/api/google-reviews.api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
}

export const ClinicOwnerHomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, backendUser, setIsClinicSwitcherVisible } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Last 7 Days' | 'This Month'>('Today');
  const [apiPeriod, setApiPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | 'All'>('1D');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [googleStatus, setGoogleStatus] = useState<GooglePlaceStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [cityRank, setCityRank] = useState<number | null>(null);

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
    loadAnalytics(newApiPeriod);
  }, [selectedPeriod]);

  const loadTransactions = async () => {
    try {
      const clinicId = backendUser?.clinic?.id;
      const transactionsData = await transactionsApiService.getTransactions(5, clinicId);
      setTransactions(transactionsData);
    } catch (err) {
      setTransactions([]);
    }
  };

  const loadAnalytics = async (periodOverride?: '1D' | '1W' | '1M' | '3M' | '6M' | 'All') => {
    try {
      setAnalyticsLoading(true);
      const clinicId = backendUser?.clinic?.id;
      const periodToUse = periodOverride || apiPeriod;
      const analyticsData = await analyticsApiService.getAnalytics(periodToUse, clinicId);
      setAnalytics(analyticsData);
    } catch (err) {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadGoogleStatus = async () => {
    setGoogleLoading(true);
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
    setGoogleLoading(false);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadAnalytics(), loadTransactions(), loadGoogleStatus()]);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } catch (err) {
      // handled in loadData
    } finally {
      setRefreshing(false);
    }
  };

  const dailyRevenue = analytics?.dailyRevenue || 0;
  const totalPatients = analytics?.totalPatients || 0;

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
            tintColor="#FFFFFF"
            colors={['#2E2A85']}
            progressBackgroundColor="#F3F4F6"
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
          subscriptionPlan={backendUser?.clinic?.subscription_plan}
          isTrial={backendUser?.clinic?.is_trial}
          trialDaysRemaining={backendUser?.clinic?.trial_days_remaining}
          onUpgradePress={() => navigation.navigate('Purchase')}
          onPlanPress={() => navigation.navigate('Subscription')}
        />

        {/* Part 2: Tiny Rounded Bottom component */}
        <WelcomeHeaderBottomPocket />

        {/* Swipeable chart cards overlapping Part 2 */}
        <View style={styles.chartWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActivePage(page);
            }}
          >
            <View style={{ width: SCREEN_WIDTH }}>
              <PatientVisitsSection
                analytics={analytics}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={analyticsLoading}
              />
            </View>
            <View style={{ width: SCREEN_WIDTH }}>
              <RevenueSection
                analytics={analytics}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                loading={analyticsLoading}
              />
            </View>
          </ScrollView>
          {/* Pagination dots */}
          <View style={styles.dots}>
            <View style={[styles.dot, activePage === 0 && styles.dotActive]} />
            <View style={[styles.dot, activePage === 1 && styles.dotActive]} />
          </View>
        </View>

        <ErrorBanner error={error} onRetry={loadData} />

        <GoogleReviewsRow
          status={googleStatus}
          loading={googleLoading}
          cityRank={cityRank}
          onPress={() => navigation.navigate('GoogleReviews')}
        />

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
    marginTop: -80,
    zIndex: 5,
    elevation: 2,
    marginBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#2E2A85',
  },
});
