import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { GearLoader } from '../../components/GearLoader';
import { colors } from '../../constants/colors';
import LinearGradient from 'react-native-linear-gradient';
import { apiService, Analytics, Transaction } from '../../services/api/apiService';
import { NotificationsScreen } from './NotificationsScreen';
import { PatientVisitsChart } from '../../components/home/PatientVisitsChart';
import { RecentTransactions } from '../../components/home/RecentTransactions';

interface HomeScreenProps {
  navigation: any;
}

export const ClinicOwnerHomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<'Week' | 'Month' | 'Year'>('Month');
  const [apiPeriod, setApiPeriod] = useState<'1W' | '1M' | '3M' | '6M' | 'All'>('1M');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Doctor';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getFormattedDate = () => {
    const date = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  useEffect(() => {
    loadData();
  }, []); // Only load on mount

  useEffect(() => {
    // Update apiPeriod when selectedPeriod changes, then load analytics
    const periodMapping: Record<string, '1W' | '1M' | '3M' | '6M' | 'All'> = {
      'Week': '1W',
      'Month': '1M', 
      'Year': '6M'
    };
    
    const newApiPeriod = periodMapping[selectedPeriod] || '1M';
    setApiPeriod(newApiPeriod);
    
    // Only reload analytics when period changes, not transactions
    loadAnalytics();
  }, [selectedPeriod]);

  const loadTransactions = async () => {
    try {
      console.log('💰 [HOME] Loading transactions...');
      const transactionsData = await apiService.getTransactions(5);
      console.log('💰 [HOME] Transactions loaded:', transactionsData.length, 'items');
      setTransactions(transactionsData);
    } catch (err: any) {
      console.error('❌ [HOME] Transactions load error:', err);
      setTransactions([]);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      console.log('📊 [HOME] Loading analytics...');
      
      const analyticsData = await apiService.getAnalytics(apiPeriod);
      console.log('📊 [HOME] Analytics loaded:', analyticsData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('❌ [HOME] Analytics load error:', err);
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🏠 [HOME] Loading dashboard data...');
      
      // Load both analytics and transactions
      await Promise.all([
        loadAnalytics(),
        loadTransactions()
      ]);

      setError(null);
    } catch (err: any) {
      console.error('❌ [HOME] Load error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      console.log('🔄 [HOME] Refreshing dashboard data...');
      
      // Refresh both analytics and transactions
      await Promise.all([
        loadAnalytics(),
        loadTransactions()
      ]);

      setError(null);
    } catch (err: any) {
      console.error('❌ [HOME] Refresh error:', err);
      // Set empty data on error to prevent infinite loading
      setAnalytics(null);
      setTransactions([]);
    } finally {
      setRefreshing(false);
    }
  };

  // Process chart data based on selected period
  const getChartData = () => {
    // Always provide labels regardless of data availability
    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearLabels = ['2021', '2022', '2023', '2024'];

    if (!analytics) return { data: [], labels: weekLabels, hasData: false };

    // Use the existing patientVisits data from analytics
    const patientVisitsData = analytics.patientVisits || [];
    
    // If no patientVisits data at all, show empty state with correct labels for selected period
    if (patientVisitsData.length === 0) {
      let labels = weekLabels;
      switch (selectedPeriod) {
        case 'Week':
          labels = weekLabels;
          break;
        case 'Month':
          labels = monthLabels;
          break;
        case 'Year':
          labels = yearLabels;
          break;
      }
      return { 
        data: [], 
        labels: labels,
        hasData: false 
      };
    }
    
    switch (selectedPeriod) {
      case 'Week':
        // For week view, use last 7 days from patientVisits data or whatever we have
        const weeklyData = patientVisitsData.slice(-7).length >= 7 
          ? patientVisitsData.slice(-7) 
          : patientVisitsData.slice(-Math.max(0, patientVisitsData.length));
        return {
          data: weeklyData,
          labels: weekLabels,
          hasData: weeklyData.length > 0 && weeklyData.some(v => v > 0)
        };
      case 'Month':
        // For month view, use patientVisits data (should be 12 months)
        const monthlyData = patientVisitsData.length >= 12 
          ? patientVisitsData.slice(0, 12)
          : patientVisitsData.slice(0, Math.min(12, patientVisitsData.length));
        return {
          data: monthlyData,
          labels: monthLabels,
          hasData: monthlyData.length > 0 && monthlyData.some(v => v > 0)
        };
      case 'Year':
        // For year view, aggregate existing data
        const yearlyData = patientVisitsData.length >= 12 
          ? [
              patientVisitsData.slice(0, 3).reduce((a, b) => a + b, 0), // 2021
              patientVisitsData.slice(3, 6).reduce((a, b) => a + b, 0), // 2022  
              patientVisitsData.slice(6, 9).reduce((a, b) => a + b, 0), // 2023
              patientVisitsData.slice(9, 12).reduce((a, b) => a + b, 0), // 2024
            ]
          : [
              patientVisitsData.slice(0, Math.min(3, patientVisitsData.length)).reduce((a, b) => a + b, 0),
              patientVisitsData.slice(3, Math.min(6, patientVisitsData.length)).reduce((a, b) => a + b, 0),
              patientVisitsData.slice(6, 9, Math.min(12, patientVisitsData.length)).reduce((a, b) => a + b, 0),
              patientVisitsData.slice(9, Math.min(12, patientVisitsData.length)).reduce((a, b) => a + b, 0),
            ];
        return {
          data: yearlyData,
          labels: yearLabels,
          hasData: yearlyData.length > 0 && yearlyData.some(v => v > 0)
        };
      default:
        return { data: [], labels: weekLabels, hasData: false };
    }
  };

  const chartData = getChartData();
  const maxVisits = chartData.data.length > 0 ? Math.max(...chartData.data) : 100;
  
  // Use real analytics data for metrics when available
  const totalVisits = analytics?.totalVisits || 0;
  const percentageChange = analytics?.percentageChange || '+0%';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      
      {/* Custom Gradient Header */}
      <LinearGradient
        colors={['#5B4FC7', '#6B5DD3', '#8B7AE6', '#A89BF0', '#C4B5F7', '#D4C8FA']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.dateText}>{getFormattedDate()}</Text>
              <Text style={styles.greetingText}>{getGreeting()},</Text>
              <Text style={styles.nameText}>Dr. {userName}!</Text>
            </View>
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
              activeOpacity={0.8}
            >
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>3</Text>
              </View>
              <Bell size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.gray100}
            />
          }
        >
        {/* Patient Visits Chart Component */}
        <PatientVisitsChart
          chartData={chartData}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={loadData}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Transactions Component */}
        <RecentTransactions
          transactions={transactions}
          onViewAll={() => navigation.navigate('AllTransactions')}
          loading={loading}
        />

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Notifications Screen */}
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
    backgroundColor: colors.gray50,
  },
  headerGradient: {
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  greetingText: {
    fontSize: 16,
    color: colors.white,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  notificationCount: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  chartSection: {
    backgroundColor: colors.white,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  chartValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gray900,
    marginRight: 8,
  },
  chartChange: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 24,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 180,
    marginBottom: 12,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingRight: 12,
    paddingVertical: 4,
  },
  yAxisLabel: {
    fontSize: 11,
    color: colors.gray400,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.gray200,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginLeft: 40,
  },
  xAxisLabel: {
    fontSize: 11,
    color: colors.gray500,
    flex: 1,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: colors.gray500,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 40,
  },
  // Interactive chart styles
  barTooltip: {
    position: 'absolute',
    top: -30,
    left: '50%',
    transform: [{ translateX: -30 }],
    backgroundColor: colors.gray900,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  barTooltipText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  emptyChartContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 4,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
  },
  errorContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
