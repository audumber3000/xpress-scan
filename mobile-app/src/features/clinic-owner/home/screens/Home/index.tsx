import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, RefreshControl } from 'react-native';
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
import { ErrorBanner } from './components/ErrorBanner';
import { colors } from '../../../../../shared/constants/colors';

interface HomeScreenProps {
  navigation: any;
}

export const ClinicOwnerHomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'Week' | 'Month' | 'Year'>('Week');
  const [apiPeriod, setApiPeriod] = useState<'1W' | '1M' | '3M' | '6M' | 'All'>('1W');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Smith';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const periodMapping: Record<string, '1W' | '1M' | '3M' | '6M' | 'All'> = {
      'Week': '1W',
      'Month': '1M',
      'Year': '6M',
    };
    const newApiPeriod = periodMapping[selectedPeriod] || '1M';
    setApiPeriod(newApiPeriod);
    loadAnalytics();
  }, [selectedPeriod]);

  const loadTransactions = async () => {
    try {
      const transactionsData = await transactionsApiService.getTransactions(5);
      setTransactions(transactionsData);
    } catch (err) {
      setTransactions([]);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const analyticsData = await analyticsApiService.getAnalytics(apiPeriod);
      setAnalytics(analyticsData);
    } catch (err) {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadAnalytics(), loadTransactions()]);
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
      setAnalyticsLoading(true);
      setLoading(true);
      await Promise.all([loadAnalytics(), loadTransactions()]);
      setError(null);
    } catch (err) {
      setAnalytics(null);
      setTransactions([]);
    } finally {
      setRefreshing(false);
      setAnalyticsLoading(false);
      setLoading(false);
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
        stickyHeaderIndices={[0]} // Sticky Top Piece (UserInfo + Cards)
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
          onNotificationPress={() => setShowNotifications(true)}
          dailyRevenue={dailyRevenue}
          totalPatients={totalPatients}
        />

        {/* Part 2: Tiny Rounded Bottom component */}
        <WelcomeHeaderBottomPocket />

        {/* Graph card overlapping Part 2, sliding under Part 1 */}
        <View style={styles.chartWrapper}>
          <PatientVisitsSection
            analytics={analytics}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            loading={analyticsLoading}
          />
        </View>

        <ErrorBanner error={error} onRetry={loadData} />

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
    marginTop: -80, // Overlap the BottomPocket (Part 2)
    zIndex: 5,       // Above pocket but below TopPart
    elevation: 2,   // Below TopPart (80)
    marginBottom: 20,
  },
});
