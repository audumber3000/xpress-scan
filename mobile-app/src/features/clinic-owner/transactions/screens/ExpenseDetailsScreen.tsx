import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  Dimensions
} from 'react-native';
import { 
  ChevronLeft, 
  Calendar, 
  Tag, 
  IndianRupee, 
  CreditCard, 
  User, 
  Building, 
  FileText, 
  ExternalLink,
  AlertCircle
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../shared/constants/colors';
import { transactionsApiService } from '../../../../services/api/transactions.api';

interface ExpenseDetailsScreenProps {
  route: any;
  navigation: any;
}

export const ExpenseDetailsScreen: React.FC<ExpenseDetailsScreenProps> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<any>(null);

  useEffect(() => {
    fetchExpenseDetails();
  }, [expenseId]);

  const fetchExpenseDetails = async () => {
    try {
      setLoading(true);
      const data = await transactionsApiService.getExpense(expenseId);
      setExpense(data);
    } catch (error: any) {
      console.error('Error fetching expense details:', error);
      Alert.alert('Error', 'Failed to load expense details: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewBill = () => {
    if (expense?.bill_file_url) {
      Linking.openURL(expense.bill_file_url);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Fetching expense details...</Text>
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={colors.gray300} />
        <Text style={styles.errorText}>Expense not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Custom Header with Safe Area Handling */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Details</Text>
        <View style={styles.headerButtonPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Amount Card - Navy Theme */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Expense Amount</Text>
          <View style={styles.amountRow}>
            <IndianRupee size={28} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.amountText}>{expense.amount?.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{expense.category?.toUpperCase() || 'GENERAL'}</Text>
          </View>
        </View>

        {/* Details Sections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Tag size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>General Information</Text>
          </View>
          <View style={styles.card}>
            <DetailItem 
              icon={<Calendar size={18} color={colors.gray500} />}
              label="Date"
              value={new Date(expense.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            />
            <View style={styles.divider} />
            <DetailItem 
              icon={<CreditCard size={18} color={colors.gray500} />}
              label="Payment Method"
              value={expense.payment_method || 'Not specified'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Vendor & Origin</Text>
          </View>
          <View style={styles.card}>
            <DetailItem 
              icon={<Building size={18} color={colors.gray500} />}
              label="Vendor Name"
              value={expense.vendor_name || 'Generic Vendor'}
            />
            <View style={styles.divider} />
            <DetailItem 
              icon={<User size={18} color={colors.gray500} />}
              label="Recorded By"
              value={expense.creator_name || 'System'}
            />
          </View>
        </View>

        {expense.notes && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Notes & Remarks</Text>
            </View>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          </View>
        )}

        {/* Bill Attachment */}
        {expense.bill_file_url && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.billButton} onPress={handleViewBill}>
              <View style={styles.billIconContainer}>
                <FileText size={24} color={colors.primary} />
              </View>
              <View style={styles.billTextContent}>
                <Text style={styles.billTitle}>View Original Bill</Text>
                <Text style={styles.billSubtitle}>Click to open attachment</Text>
              </View>
              <ExternalLink size={20} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <View style={styles.detailItem}>
    <View style={styles.detailIconContainer}>{icon}</View>
    <View style={styles.detailTextContainer}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loaderText: {
    marginTop: 16,
    color: colors.gray500,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.gray500,
    marginTop: 12,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerButtonPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  amountCard: {
    backgroundColor: '#2E2A85', // Navy theme matching MolarPlus
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#2E2A85',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    marginLeft: 4,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 16,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  notesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  billButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  billIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  billTextContent: {
    flex: 1,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  billSubtitle: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 2,
  }
});
