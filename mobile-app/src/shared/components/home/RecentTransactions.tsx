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
import { Transaction } from '../../../services/api/transactions.api';
import { AppSkeleton } from '../Skeleton';

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
  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };


  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.transactionsList}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.transactionCard}>
                <AppSkeleton width={60} height={60} radius={30} />
                <View style={[styles.transactionInfo, { marginLeft: 16 }]}>
                  <AppSkeleton width={120} height={18} radius={4} />
                  <View style={{ height: 8 }} />
                  <AppSkeleton width={80} height={14} radius={4} />
                </View>
                <View style={styles.transactionRight}>
                  <AppSkeleton width={60} height={18} radius={4} />
                  <View style={{ height: 8 }} />
                  <AppSkeleton width={50} height={14} radius={4} />
                </View>
              </View>
            ))}
          </>
        ) : transactions.length > 0 ? (
          transactions.slice(0, 5).map((transaction) => {
            const statusColor = getStatusColor(transaction.status);
            const statusBgColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
              ? '#E6F9F1'
              : '#FFFBEB';
            const statusTextColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
              ? '#10B981'
              : '#F59E0B';

            return (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.iconCircle}>
                  <ArrowDownLeft size={28} color="#2E2A85" strokeWidth={2.5} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>
                    {transaction.patientName || transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {transaction.time || '10:30 AM'} • {transaction.treatment || 'Treatment'}
                  </Text>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={styles.transactionAmount}>
                    {formatAmount(transaction.amount)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                    <Text style={[styles.statusText, { color: statusTextColor }]}>
                      {transaction.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No recent transactions</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 16,
    color: '#2E2A85',
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  transactionsList: {
    gap: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEEFC',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
