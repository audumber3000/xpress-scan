import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import {
  ChevronLeft,
  ChevronRight,
  Receipt,
  Phone,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Send,
  MoreHorizontal,
  Plus,
  X,
  Wallet,
} from 'lucide-react-native';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../shared/constants/colors';
import { componentRadius } from '../../../../shared/constants/theme';
import { transactionsApiService } from '../../../../services/api/transactions.api';
import { getCurrencySymbol } from '../../../../shared/utils/currency';

interface InvoiceDetailsScreenProps {
  route: any;
  navigation: any;
}

const sym = getCurrencySymbol();
const money = (n: any) => `${sym}${Number(n || 0).toLocaleString('en-IN')}`;

// ── Status → presentation ────────────────────────────────────────────────
function statusMeta(status: string) {
  switch (status) {
    case 'draft':
      return { label: 'Draft', fg: '#B45309', bg: '#FEF3C7', icon: 'pencil' as const };
    case 'finalized':
      return { label: 'Finalized', fg: '#1E40AF', bg: '#DBEAFE', icon: 'none' as const };
    case 'partially_paid':
      return { label: 'Partial', fg: '#B45309', bg: '#FEF3C7', icon: 'none' as const };
    case 'paid_unverified':
    case 'paid_verified':
      return { label: 'Paid', fg: '#15803D', bg: '#DCFCE7', icon: 'check' as const };
    case 'cancelled':
      return { label: 'Cancelled', fg: '#B91C1C', bg: '#FEE2E2', icon: 'none' as const };
    default:
      return { label: status || '—', fg: colors.gray600, bg: colors.gray100, icon: 'none' as const };
  }
}

// Contextual guidance banner per state. Returns null when nothing useful to say.
function guidance(status: string, hasItems: boolean) {
  switch (status) {
    case 'draft':
      return {
        tone: 'amber',
        title: 'This invoice is a draft',
        body: hasItems
          ? 'Review the items below, then finalise to share it with the patient.'
          : 'Add services below, then mark as sent to share with the patient.',
      };
    case 'finalized':
    case 'partially_paid':
      return {
        tone: 'blue',
        title: 'Awaiting payment',
        body: 'Share the invoice with the patient, or record a payment once collected.',
      };
    case 'paid_unverified':
      return null; // paid is paid — nothing to action
    case 'cancelled':
      return { tone: 'red', title: 'This invoice was cancelled', body: 'It can no longer be edited or sent.' };
    default:
      return null;
  }
}

const TONE: Record<string, { bg: string; border: string; fg: string; sub: string }> = {
  amber: { bg: '#FFFBEB', border: '#FDE68A', fg: '#92400E', sub: '#B45309' },
  blue: { bg: '#EFF6FF', border: '#BFDBFE', fg: '#1E40AF', sub: '#1D4ED8' },
  teal: { bg: '#F0FDFA', border: '#99F6E4', fg: '#0F766E', sub: '#0D9488' },
  red: { bg: '#FEF2F2', border: '#FECACA', fg: '#B91C1C', sub: '#DC2626' },
};

export const InvoiceDetailsScreen: React.FC<InvoiceDetailsScreenProps> = ({ route, navigation }) => {
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPay, setShowPay] = useState(false);

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
      toast.error('Failed to load invoice: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!invoice?.id || busy) return;
    setBusy(true);
    try {
      await transactionsApiService.sendInvoiceViaWhatsApp(invoice.id);
      toast.success('Invoice sent via WhatsApp');
    } catch (error: any) {
      const msg = (error?.message || '').toLowerCase();
      toast.error(msg.includes('phone') ? 'Patient phone number is required to send via WhatsApp' : (error?.message || 'Failed to send invoice'));
    } finally {
      setBusy(false);
    }
  };

  const handleFinaliseAndSend = async () => {
    if (!invoice?.id || busy) return;
    if (!invoice.line_items?.length) {
      toast.error('Add at least one service before finalising');
      setShowAdd(true);
      return;
    }
    setBusy(true);
    try {
      await transactionsApiService.finalizeInvoice(invoice.id);
      try {
        await transactionsApiService.sendInvoiceViaWhatsApp(invoice.id);
        toast.success('Finalised and sent via WhatsApp');
      } catch {
        toast.success('Invoice finalised'); // finalised, but send may need a phone number
      }
      await fetchInvoiceDetails();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to finalise invoice');
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async (payload: { payment_mode: string; utr?: string | null; is_partial: boolean; amount_paid?: number | null }) => {
    try {
      const updated = await transactionsApiService.markInvoicePaid(invoice.id, payload);
      setShowPay(false);
      await fetchInvoiceDetails();
      toast.success(updated?.status === 'partially_paid' ? 'Partial payment recorded' : 'Payment recorded — invoice paid');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record payment');
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Fetching invoice…</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={colors.gray300} />
        <Text style={styles.errorText}>Invoice not found.</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status: string = invoice.status || 'draft';
  const isDraft = status === 'draft';
  const items: any[] = invoice.line_items || [];
  const hasItems = items.length > 0;
  const meta = statusMeta(status);
  const tip = guidance(status, hasItems);

  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid_amount || 0);
  const due = invoice.due_amount != null ? Number(invoice.due_amount) : Math.max(total - paid, 0);
  const settled = (status === 'paid_verified' || status === 'paid_unverified') && due <= 0;

  const name = invoice.patient_name || 'Patient';
  const initial = name.trim().charAt(0).toUpperCase() || 'P';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare} disabled={busy}>
            <Share2 size={19} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => toast.info('Coming soon: PDF export')}>
            <Download size={19} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumber}>#{invoice.invoice_number || 'INV-TEMP'}</Text>
              <Text style={styles.dateLabel}>
                {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
              {meta.icon === 'pencil' && <Pencil size={12} color={meta.fg} />}
              {meta.icon === 'check' && <CheckCircle2 size={12} color={meta.fg} />}
              <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryBottom}>
            <View>
              <Text style={styles.muted}>Grand total</Text>
              <Text style={styles.grandTotal}>{money(total)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.muted}>Balance due</Text>
              {settled ? (
                <Text style={styles.paidText}>Paid in full</Text>
              ) : (
                <>
                  <Text style={styles.dueText}>{money(due)} pending</Text>
                  <Text style={styles.dueHint}>{isDraft ? 'Add items to bill' : 'Awaiting payment'}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Contextual guidance */}
        {tip && (
          <View style={[styles.banner, { backgroundColor: TONE[tip.tone].bg, borderColor: TONE[tip.tone].border }]}>
            <AlertCircle size={18} color={TONE[tip.tone].sub} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: TONE[tip.tone].fg }]}>{tip.title}</Text>
              <Text style={[styles.bannerBody, { color: TONE[tip.tone].sub }]}>{tip.body}</Text>
            </View>
          </View>
        )}

        {/* Patient */}
        <Text style={styles.sectionLabel}>PATIENT</Text>
        <TouchableOpacity
          style={[styles.card, styles.patientRow]}
          activeOpacity={invoice.patient_id ? 0.7 : 1}
          onPress={() => invoice.patient_id && navigation.navigate('PatientDetails', { patientId: invoice.patient_id })}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{name}</Text>
            <View style={styles.patientMeta}>
              {!!invoice.patient_phone && (
                <TouchableOpacity style={styles.metaItem} onPress={() => Linking.openURL(`tel:${invoice.patient_phone}`)}>
                  <Phone size={13} color={colors.gray500} />
                  <Text style={styles.metaText}>{invoice.patient_phone}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.metaItem}>
                <Receipt size={13} color={colors.gray500} />
                <Text style={styles.metaText}>ID: {invoice.patient_id ?? 'N/A'}</Text>
              </View>
            </View>
          </View>
          {!!invoice.patient_id && <ChevronRight size={18} color={colors.gray400} />}
        </TouchableOpacity>

        {/* Services & items */}
        <Text style={styles.sectionLabel}>SERVICES &amp; ITEMS</Text>
        <View style={styles.card}>
          {hasItems ? (
            <View>
              {items.map((item, i) => (
                <View key={item.id || i} style={[styles.lineItem, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineItemName}>{item.description}</Text>
                    <Text style={styles.lineItemQty}>Qty: {item.quantity}</Text>
                  </View>
                  <Text style={styles.lineItemPrice}>{money(item.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Receipt size={22} color={colors.gray400} />
              </View>
              <Text style={styles.emptyTitle}>No services added yet</Text>
              <Text style={styles.emptySub}>Add treatments or items to this invoice</Text>
            </View>
          )}

          {isDraft && (
            <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
              <Plus size={18} color="#111827" />
              <Text style={styles.addItemText}>Add service or item</Text>
            </TouchableOpacity>
          )}

          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text style={styles.totalValue}>{money(invoice.subtotal)}</Text>
            </View>
            {Number(invoice.discount_amount) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Discount</Text>
                <Text style={[styles.totalValue, { color: colors.error }]}>-{money(invoice.discount_amount)}</Text>
              </View>
            )}
            {Number(invoice.tax) > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Tax</Text>
                <Text style={styles.totalValue}>{money(invoice.tax)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandValue}>{money(total)}</Text>
            </View>
          </View>
        </View>

        {/* Payment — only relevant fields */}
        <Text style={styles.sectionLabel}>PAYMENT</Text>
        <View style={styles.card}>
          <DetailRow label="Mode" value={invoice.payment_mode || 'Cash'} />
          <PaymentStatusRow status={status} due={due} />
          {!!invoice.utr && <DetailRow label="UTR / Txn ID" value={invoice.utr} />}
          {!!invoice.paid_at && (
            <DetailRow
              label="Paid on"
              value={new Date(invoice.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
          )}
        </View>

        {!!invoice.notes && (
          <>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <View style={[styles.card, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowMore(true)} activeOpacity={0.7}>
          <MoreHorizontal size={18} color="#374151" />
          <Text style={styles.moreText}>More</Text>
        </TouchableOpacity>
        {isDraft ? (
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={handleFinaliseAndSend} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={17} color="#FFFFFF" />}
            <Text style={styles.primaryText}>Finalise &amp; send</Text>
          </TouchableOpacity>
        ) : status === 'finalized' || status === 'partially_paid' ? (
          <TouchableOpacity style={[styles.primaryBtn, styles.payBtn]} onPress={() => setShowPay(true)} activeOpacity={0.85}>
            <Wallet size={17} color="#FFFFFF" />
            <Text style={styles.primaryText}>Mark as paid</Text>
          </TouchableOpacity>
        ) : status === 'cancelled' ? (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.gray300 }]} disabled>
            <Text style={[styles.primaryText, { color: colors.gray600 }]}>Cancelled</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.primaryBtn, styles.whatsappBtn, busy && { opacity: 0.6 }]} onPress={handleShare} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <WhatsAppIcon size={20} />}
            <Text style={styles.primaryText}>Share on WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>

      <AddItemModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={async (item) => {
          try {
            await transactionsApiService.addLineItem(invoice.id, item);
            setShowAdd(false);
            await fetchInvoiceDetails();
            toast.success('Item added');
          } catch (e: any) {
            toast.error(e?.message || 'Failed to add item');
          }
        }}
      />

      <MoreSheet
        visible={showMore}
        canShare={!isDraft}
        onClose={() => setShowMore(false)}
        onShare={() => { setShowMore(false); handleShare(); }}
        onDownload={() => { setShowMore(false); toast.info('Coming soon: PDF export'); }}
      />

      <MarkAsPaidModal
        visible={showPay}
        total={total}
        paid={paid}
        due={due}
        onClose={() => setShowPay(false)}
        onConfirm={handleMarkPaid}
      />
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const PaymentStatusRow = ({ status, due }: { status: string; due: number }) => {
  let text = 'Pending — not yet collected';
  let color = '#B45309';
  if (status === 'paid_verified' || status === 'paid_unverified') { text = 'Paid'; color = '#15803D'; }
  else if (status === 'partially_paid') { text = `Partially paid — ${money(due)} due`; color = '#B45309'; }
  else if (status === 'cancelled') { text = 'Cancelled'; color = colors.gray500; }
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Status</Text>
      <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
        <Text style={[styles.statusPillText, { color }]}>{text}</Text>
      </View>
    </View>
  );
};

// ── Add item modal ───────────────────────────────────────────────────────
const AddItemModal = ({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: { description: string; quantity: number; unit_price: number }) => void;
}) => {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setDescription(''); setQuantity('1'); setPrice(''); setSaving(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!description.trim() || !price.trim()) return;
    setSaving(true);
    await onAdd({
      description: description.trim(),
      quantity: parseInt(quantity) || 1,
      unit_price: parseFloat(price) || 0,
    });
    reset();
  };

  const valid = description.trim().length > 0 && parseFloat(price) > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add service or item</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={close}><X size={18} color="#111827" /></TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Root canal, Consultation"
            placeholderTextColor={colors.gray400}
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={quantity} onChangeText={setQuantity} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.inputLabel}>Unit price ({sym})</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.gray400}
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 20 }, !valid && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!valid || saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Plus size={17} color="#FFFFFF" />}
            <Text style={styles.primaryText}>Add to invoice</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── More action sheet ────────────────────────────────────────────────────
const MoreSheet = ({
  visible,
  canShare,
  onClose,
  onShare,
  onDownload,
}: {
  visible: boolean;
  canShare: boolean;
  onClose: () => void;
  onShare: () => void;
  onDownload: () => void;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {canShare && (
          <TouchableOpacity style={styles.moreAction} onPress={onShare}>
            <WhatsAppIcon size={20} />
            <Text style={styles.moreActionText}>Share via WhatsApp</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.moreAction} onPress={onDownload}>
          <Download size={20} color="#374151" />
          <Text style={styles.moreActionText}>Download PDF</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// ── Mark as paid modal ───────────────────────────────────────────────────
const PAY_MODES = ['UPI', 'Cash', 'Card', 'Net Banking'];

const MarkAsPaidModal = ({
  visible,
  total,
  paid,
  due,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  total: number;
  paid: number;
  due: number;
  onClose: () => void;
  onConfirm: (p: { payment_mode: string; utr?: string | null; is_partial: boolean; amount_paid?: number | null }) => Promise<void>;
}) => {
  const [mode, setMode] = useState('UPI');
  const [utr, setUtr] = useState('');
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setMode('UPI'); setUtr(''); setPartial(false); setAmount(''); setSaving(false); };
  const close = () => { reset(); onClose(); };

  const parsed = Number(amount || 0);
  const partialValid = !partial || (parsed > 0 && parsed < due);

  const submit = async () => {
    if (partial && (parsed <= 0 || parsed >= due)) {
      toast.error(`Partial amount must be between ${sym}1 and ${money(due)}`);
      return;
    }
    setSaving(true);
    try {
      await onConfirm({
        payment_mode: mode,
        utr: utr.trim() || null,
        is_partial: partial,
        amount_paid: partial ? parsed : null,
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Record payment</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={close}><X size={18} color="#111827" /></TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.paySummary}>
            <View style={styles.payRow}><Text style={styles.muted}>Invoice total</Text><Text style={styles.payVal}>{money(total)}</Text></View>
            {paid > 0 && <View style={styles.payRow}><Text style={styles.muted}>Already paid</Text><Text style={styles.payVal}>{money(paid)}</Text></View>}
            <View style={styles.payRow}><Text style={styles.muted}>Due now</Text><Text style={[styles.payVal, { color: '#D97706' }]}>{money(due)}</Text></View>
          </View>

          <Text style={styles.inputLabel}>Payment mode</Text>
          <View style={styles.modeRow}>
            {PAY_MODES.map((m) => {
              const active = mode === m;
              return (
                <TouchableOpacity key={m} style={[styles.modeChip, active && styles.modeChipActive]} onPress={() => setMode(m)} activeOpacity={0.7}>
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>UTR / reference (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="For UPI / bank transfers"
            placeholderTextColor={colors.gray400}
            value={utr}
            onChangeText={setUtr}
          />

          <View style={styles.partialRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partialLabel}>Partial payment</Text>
              <Text style={styles.partialHint}>Collecting less than the full due amount</Text>
            </View>
            <Switch
              value={partial}
              onValueChange={setPartial}
              trackColor={{ false: '#E5E7EB', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {partial && (
            <>
              <Text style={styles.inputLabel}>Amount received ({sym})</Text>
              <TextInput
                style={[styles.input, !partialValid && { borderColor: colors.error }]}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.gray400}
                value={amount}
                onChangeText={setAmount}
              />
              <Text style={styles.partialHint}>Must be less than {money(due)}</Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, styles.payBtn, { marginTop: 20 }, (saving || !partialValid) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={saving || !partialValid}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Wallet size={17} color="#FFFFFF" />}
            <Text style={styles.primaryText}>{partial ? 'Record partial payment' : 'Mark as fully paid'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loaderText: { marginTop: 16, color: colors.gray500, fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: colors.gray500, marginTop: 12, marginBottom: 24 },
  goBackBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: componentRadius.button },
  goBackText: { color: '#FFFFFF', fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  content: { flex: 1 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: componentRadius.carouselCard, padding: 16,
    borderWidth: 1, borderColor: '#EEF0F2', marginBottom: 16,
  },

  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNumber: { fontSize: 19, fontWeight: '800', color: '#111827' },
  dateLabel: { fontSize: 13, color: colors.gray500, marginTop: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: componentRadius.pill, gap: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F3F5', marginVertical: 16 },
  summaryBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  muted: { fontSize: 13, color: colors.gray500 },
  grandTotal: { fontSize: 30, fontWeight: '900', color: '#111827', marginTop: 2 },
  dueText: { fontSize: 18, fontWeight: '800', color: '#D97706', marginTop: 2 },
  dueHint: { fontSize: 12, color: '#D97706', marginTop: 1 },
  paidText: { fontSize: 18, fontWeight: '800', color: '#15803D', marginTop: 2 },

  banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: componentRadius.carouselCard, borderWidth: 1, marginBottom: 16 },
  bannerTitle: { fontSize: 14, fontWeight: '800' },
  bannerBody: { fontSize: 13, lineHeight: 19, marginTop: 3 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.gray500, letterSpacing: 0.6, marginBottom: 8, marginLeft: 2 },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySubtle, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  patientName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  patientMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: colors.gray500 },

  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  lineItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  lineItemQty: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  lineItemPrice: { fontSize: 15, fontWeight: '700', color: '#111827' },

  emptyState: { alignItems: 'center', paddingVertical: 22 },
  emptyIcon: { width: 52, height: 52, borderRadius: componentRadius.statCard, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 13, color: colors.gray500, marginTop: 3 },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: componentRadius.button,
    paddingVertical: 14, marginTop: 14,
  },
  addItemText: { fontSize: 15, fontWeight: '700', color: '#111827' },

  totalsBlock: { marginTop: 16, paddingTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  totalValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  grandRow: { borderTopWidth: 1, borderTopColor: '#F1F3F5', marginTop: 4, paddingTop: 12 },
  grandLabel: { fontSize: 16, fontWeight: '800', color: '#111827' },
  grandValue: { fontSize: 18, fontWeight: '900', color: colors.primary },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  detailLabel: { fontSize: 14, color: colors.gray500 },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: componentRadius.pill },
  statusPillText: { fontSize: 13, fontWeight: '700' },

  notesText: { fontSize: 13, color: '#92400E', lineHeight: 19 },

  actionBar: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F2',
  },
  moreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: componentRadius.bottomActionButton,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  moreText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: componentRadius.bottomActionButton,
  },
  whatsappBtn: { backgroundColor: '#25D366' },
  payBtn: { backgroundColor: '#15803D' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: componentRadius.button, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  inputRow: { flexDirection: 'row', gap: 12 },
  moreAction: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 8 },
  moreActionText: { fontSize: 16, fontWeight: '600', color: '#111827' },

  // mark as paid
  paySummary: { backgroundColor: '#F9FAFB', borderRadius: componentRadius.button, padding: 14, marginBottom: 6 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  payVal: { fontSize: 14, fontWeight: '700', color: '#111827' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: componentRadius.button, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  modeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  modeChipText: { fontSize: 14, fontWeight: '600', color: colors.gray500 },
  modeChipTextActive: { color: colors.primary },
  partialRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  partialLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  partialHint: { fontSize: 12, color: colors.gray500, marginTop: 2 },
});
