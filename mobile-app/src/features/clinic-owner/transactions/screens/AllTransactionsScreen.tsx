import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { showAlert } from '../../../../shared/components/alertService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../app/AppNavigator';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { colors } from '../../../../shared/constants/colors';
import { transactionsApiService, Transaction, LedgerItem } from '../../../../services/api/transactions.api';

interface AllTransactionsScreenProps {}

export const AllTransactionsScreen: React.FC<AllTransactionsScreenProps> = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<'payments' | 'ledger'>('payments');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'payments') {
        const data = await transactionsApiService.getTransactions();
        setTransactions(data);
      } else {
        const data = await transactionsApiService.getLedger();
        setLedgerItems(data);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      showAlert('Error', `Failed to load data: ${err.message}`);
      if (activeTab === 'payments') setTransactions([]);
      else setLedgerItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'payments') {
        const data = await transactionsApiService.getTransactions();
        setTransactions(data);
      } else {
        const data = await transactionsApiService.getLedger();
        setLedgerItems(data);
      }
    } catch (err: any) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.trim().split(/\s+/);
    if (names.length > 1 && names[0][0] && names[1][0]) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return (name || '??').substring(0, 2).toUpperCase();
  };

  const handleItemPress = (item: Transaction | LedgerItem) => {
    if ('type' in item && item.type === 'expense') {
      navigation.navigate('ExpenseDetails', { expenseId: item.id });
    } else {
      navigation.navigate('InvoiceDetails', { invoiceId: item.id });
    }
  };

  const renderTab = (tab: 'payments' | 'ledger', label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
      {activeTab === tab && <View style={styles.activeTabIndicator} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        title="All Transactions"
        titleIcon={<Receipt size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />


      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('payments', 'Payments (Patients)')}
        {renderTab('ledger', 'Ledger (All Transactions)')}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <GearLoader text={`Loading ${activeTab}...`} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
            {activeTab === 'payments' ? (
              transactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🧾</Text>
                  <Text style={styles.emptyTitle}>No transactions found</Text>
                  <Text style={styles.emptySubtitle}>Patient payments will appear here once invoices are created.</Text>
                </View>
              ) : (
                transactions.map((transaction, index) => {
                  const s = transaction.status.toLowerCase();
                  const statusBgColor = s === 'completed' ? '#E6F9F1' : s === 'success' ? '#EFF6FF' : '#FFFBEB';
                  const statusTextColor = s === 'completed' ? '#10B981' : s === 'success' ? '#3B82F6' : '#F59E0B';
                  const statusLabel = s === 'completed' ? 'PAID' : s === 'success' ? 'UNVERIFIED' : 'PENDING';
                  const initials = getInitials(transaction.patientName || '??');
                  return (
                    <View key={transaction.id}>
                      <TouchableOpacity style={styles.rowContent} activeOpacity={0.7} onPress={() => handleItemPress(transaction)}>
                        <View style={styles.avatarContainer}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={[styles.iconIndicator, { backgroundColor: '#10B981' }]}>
                            <ArrowDownLeft size={10} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.itemTitle}>{transaction.patientName}</Text>
                          <Text style={styles.itemSubtitle}>{transaction.time || '10:30 AM'} • {transaction.treatment || 'Treatment'}</Text>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text style={styles.itemAmount}>₹{transaction.amount.toLocaleString()}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                            <Text style={[styles.statusText, { color: statusTextColor }]}>{statusLabel}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {index < transactions.length - 1 && <View style={styles.separator} />}
                    </View>
                  );
                })
              )
            ) : (
              ledgerItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>No ledger entries found</Text>
                  <Text style={styles.emptySubtitle}>All income and expenses will appear here.</Text>
                </View>
              ) : (
                ledgerItems.map((item, index) => {
                  const isExpense = item.type === 'expense';
                  const indicatorColor = isExpense ? '#EF4444' : '#10B981';
                  const initials = getInitials(item.entityName || '??');
                  return (
                    <View key={`${item.type}-${item.id}`}>
                      <TouchableOpacity style={styles.rowContent} activeOpacity={0.7} onPress={() => handleItemPress(item)}>
                        <View style={styles.avatarContainer}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                          </View>
                          <View style={[styles.iconIndicator, { backgroundColor: indicatorColor }]}>
                            {isExpense ? <ArrowUpRight size={10} color="#FFFFFF" strokeWidth={3} /> : <ArrowDownLeft size={10} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.entityName || 'General'}</Text>
                          <View style={styles.row}>
                            <View style={[styles.typeBadge, { backgroundColor: isExpense ? '#FEE2E2' : '#E0F2FE' }]}>
                              <Text style={[styles.typeBadgeText, { color: isExpense ? '#B91C1C' : '#0369A1' }]}>{item.type.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.itemSubtitle}>{item.date} • {item.category}</Text>
                          </View>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text style={[styles.itemAmount, { color: isExpense ? '#B91C1C' : '#10B981' }]}>{isExpense ? '-' : '+'}₹{item.amount.toLocaleString()}</Text>
                          <Text style={styles.paymentMethodText}>{item.payment_method || 'Cash'}</Text>
                        </View>
                      </TouchableOpacity>
                      {index < ledgerItems.length - 1 && <View style={styles.separator} />}
                    </View>
                  );
                })
              )
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    height: 60,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  backButton: { width: 40, alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', position: 'relative' },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: colors.primary, fontWeight: '600' },
  activeTabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  listContent: { padding: 15, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  itemContainer: { paddingVertical: 12 },
  rowContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  iconIndicator: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  transactionInfo: { flex: 1, marginLeft: 15 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  transactionRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 82 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  typeBadgeText: { fontSize: 9, fontWeight: '700' },
  paymentMethodText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
