import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import {
  Plus, Eye, FileText, Receipt, ChevronRight,
  X, Check, Trash2,
} from 'lucide-react-native';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';
import { patientsApiService } from '../../../../services/api/patients.api';
import { colors } from '../../../../shared/constants/colors';

interface BillingTabProps {
  patientId: string;
  patientPhone?: string;
}

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'finalized':   return { bg: '#DBEAFE', text: '#1E40AF' };
    case 'partially_paid': return { bg: '#FEF3C7', text: '#B45309' };
    case 'paid_verified':
    case 'paid':        return { bg: '#D1FAE5', text: '#065F46' };
    case 'paid_unverified': return { bg: '#DBEAFE', text: '#1E40AF' };
    case 'draft':       return { bg: '#F3F4F6', text: '#4B5563' };
    default:            return { bg: '#F9FAFB', text: '#6B7280' };
  }
};

export const BillingTab: React.FC<BillingTabProps> = ({ patientId, patientPhone }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingWA, setSendingWA] = useState<string | null>(null);

  // Create invoice modal
  const [showCreate, setShowCreate] = useState(false);
  const [lineItems, setLineItems] = useState<{ description: string; quantity: string; unit_price: string }[]>([
    { description: '', quantity: '1', unit_price: '' },
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await patientsApiService.getInvoices(patientId);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('❌ fetchInvoices:', e);
    }
  }, [patientId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchInvoices();
      setLoading(false);
    })();
  }, [fetchInvoices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const handleSendWhatsApp = async (invoiceId: string) => {
    setSendingWA(invoiceId);
    try {
      await patientsApiService.sendInvoiceWhatsApp(invoiceId);
      toast.success('Invoice sent via WhatsApp.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send invoice.');
    } finally {
      setSendingWA(null);
    }
  };

  const handleCreate = async () => {
    const validItems = lineItems.filter(li => li.description.trim() && li.unit_price.trim());
    if (validItems.length === 0) {
      toast.error('Add at least one line item with description and price.');
      return;
    }
    setCreating(true);
    try {
      await patientsApiService.createInvoice({
        patient_id: parseInt(patientId),
        line_items: validItems.map(li => ({
          description: li.description,
          quantity: parseInt(li.quantity) || 1,
          unit_price: parseFloat(li.unit_price) || 0,
        })),
        notes: invoiceNotes,
        status: 'draft',
      });
      toast.success('Invoice created successfully.');
      setShowCreate(false);
      setLineItems([{ description: '', quantity: '1', unit_price: '' }]);
      setInvoiceNotes('');
      fetchInvoices();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invoice.');
    } finally {
      setCreating(false);
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { description: '', quantity: '1', unit_price: '' }]);
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    setLineItems(prev => prev.map((li, i) => i === index ? { ...li, [field]: value } : li));
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const calcTotal = (inv: any) => {
    return parseFloat(inv.total || 0).toLocaleString('en-IN');
  };

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Billing History</Text>
          <Text style={s.headerSub}>View and manage patient invoices</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
          <Plus size={16} color="#fff" />
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Invoice List */}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {invoices.length === 0 ? (
          <View style={s.emptyState}>
            <Receipt size={40} color="#D1D5DB" />
            <Text style={s.emptyTitle}>No invoices yet</Text>
            <Text style={s.emptySubtitle}>Create a new invoice to get started.</Text>
          </View>
        ) : invoices.map((inv: any) => {
          const st = getStatusStyle(inv.status);
          return (
            <TouchableOpacity key={inv.id} style={s.invoiceCard} activeOpacity={0.7} onPress={() => setSelectedInvoice(inv)}>
              <View style={s.invoiceTop}>
                <Text style={s.invoiceNum}>{inv.invoice_number || `#${inv.id}`}</Text>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.text }]}>{inv.status?.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.invoiceDesc} numberOfLines={1}>
                {inv.line_items?.[0]?.description || 'Dental Services'}
                {inv.line_items?.length > 1 ? ` (+${inv.line_items.length - 1})` : ''}
              </Text>
              <View style={s.invoiceBottom}>
                <Text style={s.invoiceDate}>{fmtDate(inv.created_at)}</Text>
                <Text style={s.invoiceAmount}>₹{calcTotal(inv)}</Text>
              </View>
              <View style={s.invoiceActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => setSelectedInvoice(inv)}>
                  <Eye size={16} color="#6B7280" />
                </TouchableOpacity>
                {inv.status !== 'draft' && (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleSendWhatsApp(inv.id.toString())}
                    disabled={sendingWA === inv.id.toString()}
                  >
                    <WhatsAppIcon size={18} />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Create Invoice Modal ─── */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Create Invoice</Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {lineItems.map((li, i) => (
                <View key={i} style={s.lineItemRow}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <TextInput style={s.fieldInput} placeholder="Description *" placeholderTextColor="#9CA3AF" value={li.description}
                      onChangeText={v => updateLineItem(i, 'description', v)} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[s.fieldInput, { flex: 1, marginBottom: 0 }]} placeholder="Qty" placeholderTextColor="#9CA3AF"
                        value={li.quantity} onChangeText={v => updateLineItem(i, 'quantity', v)} keyboardType="number-pad" />
                      <TextInput style={[s.fieldInput, { flex: 1, marginBottom: 0 }]} placeholder="Price (₹)" placeholderTextColor="#9CA3AF"
                        value={li.unit_price} onChangeText={v => updateLineItem(i, 'unit_price', v)} keyboardType="numeric" />
                    </View>
                  </View>
                  {lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeLineItem(i)} style={{ padding: 6 }}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={s.addLineBtn} onPress={addLineItem}>
                <Plus size={14} color={colors.primary} />
                <Text style={s.addLineText}>Add Line Item</Text>
              </TouchableOpacity>

              <TextInput style={[s.fieldInput, { marginTop: 12 }]} placeholder="Notes (optional)" placeholderTextColor="#9CA3AF"
                value={invoiceNotes} onChangeText={setInvoiceNotes} multiline />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.confirmBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Invoice Detail Modal ─── */}
      <Modal visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={s.sheetTitle}>Invoice Details</Text>
              <TouchableOpacity onPress={() => setSelectedInvoice(null)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedInvoice && (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{selectedInvoice.invoice_number || `#${selectedInvoice.id}`}</Text>
                  <View style={[s.statusBadge, { backgroundColor: getStatusStyle(selectedInvoice.status).bg }]}>
                    <Text style={[s.statusText, { color: getStatusStyle(selectedInvoice.status).text }]}>
                      {selectedInvoice.status?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Created {fmtDate(selectedInvoice.created_at)}</Text>

                {(selectedInvoice.line_items || []).map((li: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#111827' }}>{li.description}</Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Qty: {li.quantity}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>₹{(li.unit_price * (li.quantity || 1)).toLocaleString('en-IN')}</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, marginTop: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Total</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>₹{calcTotal(selectedInvoice)}</Text>
                </View>

                {selectedInvoice.notes ? (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 12, fontStyle: 'italic' }}>{selectedInvoice.notes}</Text>
                ) : null}
              </ScrollView>
            )}

            {selectedInvoice?.status !== 'draft' && (
              <TouchableOpacity
                style={[s.confirmBtn, { marginTop: 16, flexDirection: 'row', gap: 8 }]}
                onPress={() => { handleSendWhatsApp(selectedInvoice.id.toString()); setSelectedInvoice(null); }}
              >
                <WhatsAppIcon size={18} />
                <Text style={s.confirmBtnText}>Send via WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyState: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  // Invoice card
  invoiceCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  invoiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invoiceNum: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  invoiceDesc: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  invoiceBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceDate: { fontSize: 12, color: '#9CA3AF' },
  invoiceAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  invoiceActions: { flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  fieldInput: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#111827', marginBottom: 10 },
  lineItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addLineText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
