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
  Alert
} from 'react-native';
import { 
  ChevronLeft, 
  Receipt, 
  User, 
  Phone, 
  Calendar, 
  CreditCard, 
  FileText, 
  Download, 
  Share2,
  CheckCircle2,
  Clock,
  AlertCircle,
  IndianRupee
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../shared/constants/colors';
import { transactionsApiService } from '../../../../services/api/transactions.api';

interface InvoiceDetailsScreenProps {
  route: any;
  navigation: any;
}

export const InvoiceDetailsScreen: React.FC<InvoiceDetailsScreenProps> = ({ route, navigation }) => {
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      const data = await transactionsApiService.getInvoice(invoiceId);
      setInvoice(data);
    } catch (error: any) {
      console.error('Error fetching invoice details:', error);
      Alert.alert('Error', 'Failed to load invoice details: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid_verified': return colors.success;
      case 'paid_unverified': return colors.warning;
      case 'draft': return colors.gray500;
      case 'cancelled': return colors.error;
      default: return colors.primary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid_verified': return <CheckCircle2 size={16} color={colors.success} />;
      case 'paid_unverified': return <Clock size={16} color={colors.warning} />;
      default: return <AlertCircle size={16} color={colors.gray500} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Fetching invoice # {invoiceId}...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={colors.gray300} />
        <Text style={styles.errorText}>Invoice not found.</Text>
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
        <Text style={styles.headerTitle}>Invoice Details</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => Alert.alert('Export', 'Coming soon: PDF Export')}>
          <Download size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status & ID Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.invoiceNumber}>#{invoice.invoice_number || 'INV-TEMP'}</Text>
              <Text style={styles.dateLabel}>
                {new Date(invoice.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '15' }]}>
              {getStatusIcon(invoice.status)}
              <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                {invoice.status?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{invoice.total?.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('WhatsApp', 'Sending invoice PDF...')}>
            <Share2 size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>Share via WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Patient Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Patient Information</Text>
          </View>
          <View style={styles.patientCard}>
            <Text style={styles.patientName}>{invoice.patient_name || 'Generic Patient'}</Text>
            {invoice.patient_phone && (
              <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${invoice.patient_phone}`)}>
                <Phone size={14} color={colors.gray500} />
                <Text style={styles.patientPhone}>{invoice.patient_phone}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.infoRow}>
              <Receipt size={14} color={colors.gray500} />
              <Text style={styles.patientId}>ID: {invoice.patient_id || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Services & Items</Text>
          </View>
          {invoice.line_items?.map((item: any, index: number) => (
            <View key={item.id || index} style={styles.lineItem}>
              <View style={styles.lineItemMain}>
                <Text style={styles.lineItemName}>{item.description}</Text>
                <Text style={styles.lineItemQty}>Qty: {item.quantity}</Text>
              </View>
              <Text style={styles.lineItemPrice}>₹{item.amount?.toLocaleString('en-IN')}</Text>
            </View>
          ))}
          
          {/* Detailed Calc */}
          <View style={styles.calcContainer}>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Subtotal</Text>
              <Text style={styles.calcValue}>₹{invoice.subtotal?.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Discount ({invoice.discount_amount > 0 ? invoice.discount_type : 'None'})</Text>
              <Text style={[styles.calcValue, { color: colors.error }]}>-₹{invoice.discount_amount?.toLocaleString('en-IN') || '0'}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Tax</Text>
              <Text style={styles.calcValue}>₹{(invoice.tax || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.calcRow, styles.finalRow]}>
              <Text style={styles.finalLabel}>Total Paid</Text>
              <Text style={styles.finalValue}>₹{invoice.total?.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Payment Details</Text>
          </View>
          <View style={styles.paymentCard}>
            <DetailRow label="Mode" value={invoice.payment_mode || 'Cash'} />
            <DetailRow label="UTR / Transaction ID" value={invoice.utr || 'N/A'} />
            <DetailRow 
              label="Paid Date" 
              value={invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }) : 'N/A'} 
            />
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string, value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailRowLabel}>{label}</Text>
    <Text style={styles.detailRowValue}>{value}</Text>
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
    paddingVertical: 12,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  invoiceNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  dateLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray500,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  actionRow: {
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  patientPhone: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  patientId: {
    fontSize: 13,
    color: colors.gray500,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginLeft: 4,
  },
  lineItemMain: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  lineItemQty: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  lineItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  calcContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: 16,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 13,
    color: colors.gray500,
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  finalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: 0,
  },
  finalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  finalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailRowLabel: {
    fontSize: 13,
    color: colors.gray500,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    marginLeft: 4,
  },
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  notesText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  }
});
