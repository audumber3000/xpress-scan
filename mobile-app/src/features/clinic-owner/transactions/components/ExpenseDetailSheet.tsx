import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
  Linking
} from 'react-native';
import { X, Calendar, Tag, IndianRupee, CreditCard, User, Building, FileText, ExternalLink } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { transactionsApiService } from '../../../../services/api/transactions.api';

interface ExpenseDetailSheetProps {
  isVisible: boolean;
  expenseId: string | null;
  onClose: () => void;
}

export const ExpenseDetailSheet: React.FC<ExpenseDetailSheetProps> = ({
  isVisible,
  expenseId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [expense, setExpense] = useState<any>(null);
  const [shouldRender, setShouldRender] = useState(isVisible);

  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      if (expenseId) {
        fetchExpenseDetails(expenseId);
      }
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
        setExpense(null);
      });
    }
  }, [isVisible, expenseId]);

  const fetchExpenseDetails = async (id: string) => {
    try {
      setLoading(true);
      const data = await transactionsApiService.getExpense(id);
      setExpense(data);
    } catch (error) {
      console.error('Error fetching expense details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleViewBill = () => {
    if (expense?.bill_file_url) {
      Linking.openURL(expense.bill_file_url);
    }
  };

  if (!shouldRender) return null;

  return (
    <Animated.View 
      style={[
        styles.rootContainer,
        { opacity: opacityAnim }
      ]}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Expense Details</Text>
                <Text style={styles.headerSubtitle}>ID: {expenseId}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loaderText}>Loading details...</Text>
              </View>
            ) : expense ? (
              <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
                {/* Amount Section */}
                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Total Amount</Text>
                  <View style={styles.amountRow}>
                    <IndianRupee size={28} color={colors.white} />
                    <Text style={styles.amountText}>{expense.amount?.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{expense.category?.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Primary Info */}
                <View style={styles.section}>
                  <DetailItem 
                    icon={<Calendar size={20} color={colors.gray500} />}
                    label="Date"
                    value={new Date(expense.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  />
                  <DetailItem 
                    icon={<CreditCard size={20} color={colors.gray500} />}
                    label="Payment Method"
                    value={expense.payment_method || 'Not specified'}
                  />
                </View>

                {/* Vendor & Creator */}
                <View style={styles.section}>
                  <DetailItem 
                    icon={<Building size={20} color={colors.gray500} />}
                    label="Vendor"
                    value={expense.vendor_name || 'Generic Vendor'}
                  />
                  <DetailItem 
                    icon={<User size={20} color={colors.gray500} />}
                    label="Recorded By"
                    value={expense.creator_name || 'System'}
                  />
                </View>

                {/* Notes */}
                {expense.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Notes</Text>
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesText}>{expense.notes}</Text>
                    </View>
                  </View>
                )}

                {/* Bill Attachment */}
                {expense.bill_file_url && (
                  <TouchableOpacity style={styles.billButton} onPress={handleViewBill}>
                    <View style={styles.billIconContainer}>
                      <FileText size={24} color={colors.primary} />
                    </View>
                    <View style={styles.billTextContainer}>
                      <Text style={styles.billTitle}>View Attached Bill</Text>
                      <Text style={styles.billSubtitle}>Click to open in browser</Text>
                    </View>
                    <ExternalLink size={20} color={colors.gray400} />
                  </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Could not load expense details.</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <View style={styles.detailItem}>
    <View style={styles.detailIcon}>{icon}</View>
    <View style={styles.detailTextContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  rootContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: Dimensions.get('window').height * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetContent: {
    backgroundColor: '#F9FAFB',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  loaderContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: colors.gray500,
    fontSize: 14,
  },
  detailsScroll: {
    padding: 20,
  },
  amountCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  detailTextContent: {
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginLeft: 4,
  },
  notesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  billButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 8,
  },
  billIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(46, 42, 133, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  billTextContainer: {
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
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: colors.gray500,
  }
});
