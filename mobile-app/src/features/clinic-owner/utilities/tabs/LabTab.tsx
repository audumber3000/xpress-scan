import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { showAlert } from '../../../../shared/components/alertService';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X, Check, Search, Calendar as CalendarIcon, User, Layers, Clock } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
import { colors } from '../../../../shared/constants/colors';
import {
  utilitiesApiService,
  LabOrder, LabOrderCreate, Vendor
} from '../../../../services/api/utilities.api';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { styles } from './sharedStyles';
import { SwipeableRow } from './SwipeableRow';
import { LAB_STATUSES, getLabStatusColors } from './helpers';
import { getCurrencySymbol } from '../../../../shared/utils/currency';

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyText}>No lab orders found</Text>
    <Text style={styles.emptySubtext}>Tap + to add one</Text>
  </View>
);

export const LabTab: React.FC = () => {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionOrder, setActionOrder] = useState<LabOrder | null>(null);
  const [editOrder, setEditOrder] = useState<LabOrder | null>(null);
  const [form, setForm] = useState<Partial<LabOrderCreate>>({ work_type: '', status: 'Draft', cost: 0, due_date: '' });
  const [editForm, setEditForm] = useState<Partial<LabOrderCreate>>({});
  const [filterBy, setFilterBy] = useState<'Draft' | 'Completed' | 'Overdue' | null>(null);

  // Selector state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [casePapers, setCasePapers] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingCasePapers, setLoadingCasePapers] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedCasePaper, setSelectedCasePaper] = useState<any | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const load = async () => {
    const [d, pData, vData] = await Promise.all([
      utilitiesApiService.getLabOrders(),
      patientsApiService.getPatients(),
      utilitiesApiService.getVendors(),
    ]);
    setOrders(d);
    setPatients(pData);
    setVendors(vData);
    setLoading(false);
  };
  
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Fetch case papers when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      const fetchCP = async () => {
        setLoadingCasePapers(true);
        const cp = await patientsApiService.getCasePapers(selectedPatient.id);
        setCasePapers(cp);
        setLoadingCasePapers(false);
      };
      fetchCP();
    } else {
      setCasePapers([]);
    }
  }, [selectedPatient]);

  const handleDelete = (id: number) => showAlert('Delete Lab Order', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await utilitiesApiService.deleteLabOrder(id);
      setOrders(p => p.filter(o => o.id !== id));
      toast.success('Lab order deleted');
    }},
  ]);

  const handleStatusChange = async (order: LabOrder, status: string) => {
    const updated = await utilitiesApiService.updateLabOrder(order.id, { status });
    if (updated) {
      setOrders(p => p.map(o => o.id === order.id ? { ...o, status } : o));
      setActionOrder(p => p?.id === order.id ? { ...p, status } : p);
    }
  };

  const handleCreate = async () => {
    if (!form.work_type?.trim()) { toast.warning('Work type is required'); return; }
    if (!selectedPatient) { toast.warning('Please select a patient'); return; }
    if (!selectedCasePaper) { toast.warning('Please select a visit (case paper)'); return; }
    if (!selectedVendor) { toast.warning('Please select a vendor (Lab)'); return; }
    if (!form.due_date) { toast.warning('Please select a due date'); return; }

    setSaving(true);
    const finalForm: LabOrderCreate = {
      ...form,
      patient_id: parseInt(selectedPatient.id),
      vendor_id: selectedVendor.id,
      case_paper_id: selectedCasePaper.id,
    } as LabOrderCreate;

    const created = await utilitiesApiService.createLabOrder(finalForm);
    setSaving(false);
    if (created) {
      setOrders(p => [created, ...p]);
      setShowCreate(false);
      resetForm();
      toast.success('Lab order created');
    } else {
      toast.error('Failed to create lab order.');
    }
  };

  const resetForm = () => {
    setForm({ work_type: '', status: 'Draft', cost: 0, due_date: '' });
    setSelectedPatient(null);
    setSelectedCasePaper(null);
    setSelectedVendor(null);
    setPatientSearch('');
  };

  const handleUpdate = async () => {
    if (!editOrder) return;
    setSaving(true);
    const updated = await utilitiesApiService.updateLabOrder(editOrder.id, editForm);
    setSaving(false);
    if (updated) {
      setOrders(p => p.map(o => o.id === editOrder.id ? updated : o));
      setEditOrder(null);
      toast.success('Lab order updated');
    } else {
      toast.error('Failed to update lab order.');
    }
  };

  const filteredPatients = patientSearch.trim() 
    ? patients.filter(p => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
        p.phone.includes(patientSearch)
      ).slice(0, 5)
    : [];

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  return (
    <>
      <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {orders.length > 0 && (() => {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const overdueCount = orders.filter(o =>
            o.due_date && o.status !== 'Completed' && new Date(o.due_date) <= today
          ).length;
          const pill = (key: typeof filterBy, bg: string, textColor: string, label: string) => {
            const active = filterBy === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.summaryPill, { backgroundColor: bg }, active && { borderWidth: 1.5, borderColor: textColor }]}
                onPress={() => setFilterBy(active ? null : key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.summaryPillText, { color: textColor }, active && { fontWeight: '700' }]}>{label}</Text>
              </TouchableOpacity>
            );
          };
          return (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
              {pill('Draft', '#F3F4F6', '#6B7280', `${orders.filter(o => o.status === 'Draft').length} Draft`)}
              {pill('Completed', '#E6F9F1', '#10B981', `${orders.filter(o => o.status === 'Completed').length} Done`)}
              {overdueCount > 0 && pill('Overdue', '#FEE2E2', '#DC2626', `⚠ ${overdueCount} Overdue`)}
            </View>
          );
        })()}

        <View style={styles.listBlock}>
          {(() => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const visible = filterBy === null ? orders : orders.filter(o => {
              if (filterBy === 'Overdue') return !!(o.due_date && o.status !== 'Completed' && new Date(o.due_date) <= today);
              return o.status === filterBy;
            });
            if (visible.length === 0) return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No {filterBy?.toLowerCase()} orders</Text>
                <Text style={styles.emptySubtext}>Tap the pill again to clear the filter</Text>
              </View>
            );
            return visible.map((order, index) => {
            const sc = getLabStatusColors(order.status);
            const isOverdue = !!(order.due_date && order.status !== 'Completed' && new Date(order.due_date) <= today);
            return (
              <View key={order.id}>
                <SwipeableRow
                  onEdit={() => {
                    setEditForm({
                      work_type: order.work_type, vendor_id: order.vendor_id,
                      patient_id: order.patient_id, tooth_number: order.tooth_number,
                      shade: order.shade, instructions: order.instructions,
                      cost: order.cost, status: order.status, due_date: order.due_date,
                    });
                    setEditOrder(order);
                  }}
                  onDelete={() => handleDelete(order.id)}
                >
                  <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setActionOrder(order)}>
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{order.work_type.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.indicator, { backgroundColor: sc.dot }]} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{order.work_type}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {order.patient_name || `Patient #${order.patient_id}`}
                        {order.vendor_name ? ` • ${order.vendor_name}` : ''}
                      </Text>
                      {order.due_date && (
                        <Text style={[styles.rowSubtitle, isOverdue && { color: '#DC2626', fontWeight: '600' }]} numberOfLines={1}>
                          {isOverdue ? '⚠ ' : ''}Due {new Date(order.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowValue}>{getCurrencySymbol()}{(order.cost ?? 0).toLocaleString()}</Text>
                      <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.badgeText, { color: sc.text }]}>{order.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </SwipeableRow>
                {index < visible.length - 1 && <View style={styles.separator} />}
              </View>
            );
          });
          })()}
        </View>

        {orders.length > 0 && (
          <Text style={styles.hintText}>← Swipe left to edit or delete  •  Tap for status options</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Action tray: status picker ── */}
      <Modal visible={!!actionOrder} animationType="slide" transparent onRequestClose={() => setActionOrder(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionOrder(null)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{actionOrder?.work_type}</Text>
              <Text style={styles.actionSheetSubtitle}>
                {actionOrder?.patient_name || `Patient #${actionOrder?.patient_id}`} • {getCurrencySymbol()}{(actionOrder?.cost ?? 0).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.actionSheetSectionLabel}>Change Status</Text>
            {LAB_STATUSES.map(status => {
              const sc = getLabStatusColors(status);
              const active = actionOrder?.status === status;
              return (
                <TouchableOpacity key={status}
                  style={[styles.statusOption, active && styles.statusOptionActive]}
                  onPress={() => actionOrder && handleStatusChange(actionOrder, status)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                  <Text style={[styles.statusOptionText, active && { color: '#2E2A85', fontWeight: '700' as const }]}>{status}</Text>
                  {active && <Check size={16} color="#2E2A85" strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.actionSheetCloseBtn} onPress={() => setActionOrder(null)}>
              <Text style={styles.actionSheetCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal visible={!!editOrder} animationType="slide" transparent onRequestClose={() => setEditOrder(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Lab Order</Text>
              <TouchableOpacity onPress={() => setEditOrder(null)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Work Type *</Text>
              <TextInput style={styles.input} value={editForm.work_type || ''} onChangeText={v => setEditForm(p => ({ ...p, work_type: v }))} />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Tooth #</Text>
                  <TextInput style={styles.input} value={editForm.tooth_number || ''} onChangeText={v => setEditForm(p => ({ ...p, tooth_number: v }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Shade</Text>
                  <TextInput style={styles.input} value={editForm.shade || ''} onChangeText={v => setEditForm(p => ({ ...p, shade: v }))} />
                </View>
              </View>
              <Text style={styles.inputLabel}>Instructions</Text>
              <TextInput style={[styles.input, styles.inputMulti]} multiline value={editForm.instructions || ''} onChangeText={v => setEditForm(p => ({ ...p, instructions: v }))} />
              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={editForm.due_date || ''} onChangeText={v => setEditForm(p => ({ ...p, due_date: v }))} placeholder="2024-04-10" />
              <Text style={styles.inputLabel}>Cost ({getCurrencySymbol()})</Text>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={editForm.cost?.toString() || ''} onChangeText={v => setEditForm(p => ({ ...p, cost: parseFloat(v) || 0 }))} />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleUpdate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Lab Order</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Work Type *</Text>
              <TextInput style={styles.input} placeholder="e.g. Crown, Bridge, Denture" value={form.work_type || ''} onChangeText={v => setForm(p => ({ ...p, work_type: v }))} />
              
              {/* Patient Selector */}
              <Text style={styles.inputLabel}>Select Patient *</Text>
              {!selectedPatient ? (
                <View>
                  <View style={styles.searchBox}>
                    <Search size={18} color="#94A3B8" />
                    <TextInput 
                      style={styles.searchField}
                      placeholder="Search by name or phone..."
                      value={patientSearch}
                      onChangeText={setPatientSearch}
                    />
                  </View>
                  {filteredPatients.map(p => (
                    <TouchableOpacity key={p.id} style={styles.searchResult} onPress={() => { setSelectedPatient(p); setPatientSearch(''); }}>
                      <User size={16} color={colors.primary} />
                      <Text style={styles.searchResultText}>{p.name} ({p.phone})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.selectedPill}>
                  <Text style={styles.selectedPillText}>{selectedPatient.name}</Text>
                  <TouchableOpacity onPress={() => { setSelectedPatient(null); setSelectedCasePaper(null); }}>
                    <X size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Case Paper Selector */}
              {selectedPatient && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Select Visit (Case Paper) *</Text>
                  {loadingCasePapers ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 10 }} />
                  ) : casePapers.length === 0 ? (
                    <Text style={styles.errorText}>No visits found for this patient.</Text>
                  ) : (
                    <View style={styles.optionsGrid}>
                      {casePapers.map(cp => {
                        const active = selectedCasePaper?.id === cp.id;
                        return (
                          <TouchableOpacity 
                            key={cp.id} 
                            style={[styles.optionItem, active && styles.optionItemActive]}
                            onPress={() => setSelectedCasePaper(cp)}
                          >
                            <CalendarIcon size={14} color={active ? '#FFFFFF' : colors.textPrimary} />
                            <Text style={[styles.optionText, active && styles.optionTextActive]}>
                              {new Date(cp.created_at).toLocaleDateString()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Vendor Selector */}
              <Text style={styles.inputLabel}>Select Vendor (Lab) *</Text>
              <View style={styles.optionsGrid}>
                {vendors.map(v => {
                  const active = selectedVendor?.id === v.id;
                  return (
                    <TouchableOpacity 
                      key={v.id} 
                      style={[styles.optionItem, active && styles.optionItemActive]}
                      onPress={() => setSelectedVendor(v)}
                    >
                      <Layers size={14} color={active ? '#FFFFFF' : colors.textPrimary} />
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Due Date Section */}
              <Text style={styles.inputLabel}>Set Due Date (Deadline) *</Text>
              <TouchableOpacity 
                style={styles.selectedPill} 
                onPress={() => setShowCalendar(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={[styles.selectedPillText, !form.due_date && { color: '#9CA3AF' }]}>
                    {form.due_date ? new Date(form.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select a date'}
                  </Text>
                </View>
                <CalendarIcon size={16} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Tooth #</Text>
                  <TextInput style={styles.input} placeholder="46" value={form.tooth_number || ''} onChangeText={v => setForm(p => ({ ...p, tooth_number: v }))} />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Shade</Text>
                  <TextInput style={styles.input} placeholder="A2" value={form.shade || ''} onChangeText={v => setForm(p => ({ ...p, shade: v }))} />
                </View>
              </View>

              <Text style={styles.inputLabel}>Instructions</Text>
              <TextInput style={[styles.input, styles.inputMulti]} placeholder="Special instructions…" multiline value={form.instructions || ''} onChangeText={v => setForm(p => ({ ...p, instructions: v }))} />
              
              <Text style={styles.inputLabel}>Cost ({getCurrencySymbol()})</Text>
              <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" value={form.cost?.toString() || ''} onChangeText={v => setForm(p => ({ ...p, cost: parseFloat(v) || 0 }))} />
              
              <TouchableOpacity style={[styles.saveBtn, (!selectedPatient || !selectedCasePaper || !selectedVendor || !form.due_date || saving) && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Create Lab Order</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* ── Calendar Modal ── */}
        <Modal visible={showCalendar} animationType="fade" transparent onRequestClose={() => setShowCalendar(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: 40 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Due Date</Text>
                <TouchableOpacity onPress={() => setShowCalendar(false)}>
                  <X size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={{ padding: 10 }}>
                <Calendar
                  onDayPress={(day: any) => {
                    setForm(p => ({ ...p, due_date: day.dateString }));
                    setShowCalendar(false);
                  }}
                  markedDates={{
                    [form.due_date || '']: { selected: true, selectedColor: colors.primary }
                  }}
                  theme={{
                    todayTextColor: colors.primary,
                    selectedDayBackgroundColor: colors.primary,
                    arrowColor: colors.primary,
                  }}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </View>
            </View>
          </View>
        </Modal>
      </Modal>
    </>
  );
};
