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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { AppSkeleton } from '../Skeleton';
import { getCurrencySymbol } from '../../utils/currency';

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
    if (!name) return '??';
    const names = name.trim().split(/\s+/);
    if (names.length > 1 && names[0][0] && names[1][0]) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return (name || '??').substring(0, 2).toUpperCase();
  };

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleItemPress = (transaction: Transaction) => {
    navigation.navigate('InvoiceDetails', { invoiceId: transaction.id });
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
    return `${getCurrencySymbol()}${amount.toLocaleString()}`;
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
              <View key={i} style={styles.skeletonItem}>
                <AppSkeleton width={50} height={50} radius={25} />
                <View style={[styles.transactionInfo, { marginLeft: 12 }]}>
                  <AppSkeleton width={120} height={18} radius={4} />
                  <View style={{ height: 8 }} />
                  <AppSkeleton width={80} height={14} radius={4} />
                </View>
                <View style={styles.transactionRight}>
                  <AppSkeleton width={60} height={18} radius={4} />
                </View>
              </View>
            ))}
          </>
        ) : transactions.length > 0 ? (
          transactions.slice(0, 5).map((transaction, index) => {
            const statusBgColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
              ? '#E6F9F1'
              : '#FFFBEB';
            const statusTextColor = transaction.status.toLowerCase() === 'completed' || transaction.status.toLowerCase() === 'success'
              ? '#10B981'
              : '#F59E0B';
            
            const initials = getInitials(transaction.patientName || '??');

            return (
              <View key={transaction.id} style={styles.container}>
                <TouchableOpacity 
                  style={styles.rowContent} 
                  activeOpacity={0.7}
                  onPress={() => handleItemPress(transaction)}
                >
                  {/* Avatar with initials and small arrow indicator */}
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.iconIndicator}>
                      <ArrowDownLeft size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  </View>

                  {/* Transaction Info */}
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionName} numberOfLines={1}>
                      {transaction.patientName || transaction.description}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {transaction.time || '10:30 AM'} • {transaction.treatment || 'Treatment'}
                    </Text>
                  </View>

                  {/* Right Side: Amount and Status */}
                  <View style={styles.transactionRight}>
                    <Text style={styles.transactionAmount}>
                      {formatAmount(transaction.amount)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                      <Text style={[styles.statusText, { color: statusTextColor }]}>
                        {(transaction.status || 'pending').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {/* Separator - don't show after last item */}
                {index < Math.min(transactions.length, 5) - 1 && (
                  <View style={styles.separator} />
                )}
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
    paddingHorizontal: 0, // Fill width to match patient list
    marginTop: 32,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2E2A85',
    fontWeight: '600',
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    backgroundColor: '#FFFFFF',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E2A85',
  },
  iconIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginRight: 8,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '600',
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 82, // Alignment with text (avatar width 50 + margin 12 + padding 20)
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
});
