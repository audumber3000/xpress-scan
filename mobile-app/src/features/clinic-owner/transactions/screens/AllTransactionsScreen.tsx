import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpRight, ArrowDownLeft, ChevronLeft } from 'lucide-react-native';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { colors } from '../../../../shared/constants/colors';
import { transactionsApiService, Transaction } from '../../../../services/api/transactions.api';

interface AllTransactionsScreenProps {
  navigation: any;
}

export const AllTransactionsScreen: React.FC<AllTransactionsScreenProps> = ({ navigation }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      console.log('🔄 [TRANSACTIONS] Loading transactions...');
      const data = await transactionsApiService.getTransactions();
      setTransactions(data);
      console.log('✅ [TRANSACTIONS] Loaded', data.length, 'transactions');
    } catch (err: any) {
      console.error('❌ [TRANSACTIONS] Load error:', err);
      // Alert the user
      const { Alert } = require('react-native');
      Alert.alert('Error', `Failed to load transactions: ${err.message}`);
      // Set empty data on error to prevent infinite loading
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 [TRANSACTIONS] Refreshing transactions...');
      const data = await transactionsApiService.getTransactions();
      setTransactions(data);
      console.log('✅ [TRANSACTIONS] Refreshed', data.length, 'transactions');
    } catch (err: any) {
      console.error('❌ [TRANSACTIONS] Refresh error:', err);
      // Set empty data on error to prevent infinite loading
      setTransactions([]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <GearLoader text="Loading transactions..." />
        </View>
      ) : (
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
          <View style={styles.transactionsList}>
            {transactions.map((transaction) => {
              const statusBgColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
                ? '#E6F9F1'
                : '#FFFBEB';
              const statusTextColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
                ? '#10B981'
                : '#F59E0B';

              return (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.iconCircle}>
                    <ArrowDownLeft size={24} color="#2E2A85" strokeWidth={2.5} />
                  </View>

                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionName}>{transaction.patientName}</Text>
                    <Text style={styles.transactionDate}>
                      {transaction.time || '10:30 AM'} • {transaction.treatment || 'Treatment'}
                    </Text>
                  </View>

                  <View style={styles.transactionRight}>
                    <Text style={styles.transactionAmount}>
                      ${transaction.amount.toLocaleString()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                      <Text style={[styles.statusText, { color: statusTextColor }]}>
                        {transaction.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {transactions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#2E2A85',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
