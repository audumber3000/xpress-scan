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
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={[
                  styles.transactionIcon,
                  { backgroundColor: transaction.type === 'visit' ? colors.successLight : colors.infoLight }
                ]}>
                  {transaction.type === 'visit' ? (
                    <ArrowUpRight size={20} color={colors.success} />
                  ) : (
                    <ArrowDownLeft size={20} color={colors.info} />
                  )}
                </View>
                
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>{transaction.patientName}</Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>

                <View style={styles.transactionRight}>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'visit' ? colors.success : colors.info }
                  ]}>
                    ${transaction.amount}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: transaction.status === 'completed' ? colors.successLight : colors.warningLight }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: transaction.status === 'completed' ? colors.success : colors.warning }
                    ]}>
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {transactions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions found</Text>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  transactionsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray500,
  },
});
