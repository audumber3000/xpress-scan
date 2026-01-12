import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Transaction } from '../../services/api/apiService';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll: () => void;
  loading?: boolean;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  onViewAll,
  loading = false,
}) => {
  const getTransactionIcon = (type: string) => {
    return type === 'payment' ? ArrowUpRight : ArrowDownLeft;
  };

  const getTransactionColor = (type: string) => {
    return type === 'payment' ? colors.success : colors.error;
  };

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.transactionsList}
        showsVerticalScrollIndicator={false}
      >
        {transactions.length > 0 ? (
          transactions.slice(0, 5).map((transaction) => {
            const Icon = getTransactionIcon(transaction.type);
            const color = getTransactionColor(transaction.type);
            
            return (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={[styles.transactionIcon, { backgroundColor: `${color}20` }]}>
                  <Icon size={24} color={color} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[styles.transactionAmount, { color }]}>
                    {formatAmount(transaction.amount)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.statusText, { color }]}>
                      {transaction.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No recent transactions</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.gray500,
  },
  transactionsList: {
    maxHeight: 300,
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
  emptyText: {
    fontSize: 15,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 40,
  },
});
