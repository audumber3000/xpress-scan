import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { Wallet, CreditCard, AlertCircle, CheckCircle2, XCircle } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../../shared/utils/currency';
import { CHANNELS, CHANNEL_META } from '../constants';
import type { Wallet as WalletType } from '../notifications.api';

interface Props {
  stats: any;
  channelStatus: any;
  wallet: WalletType;
  toppingUp: boolean;
  onTopUp: (amount: number) => void;
}

const PRESETS = [100, 500, 1000, 5000];

export const OverviewTab: React.FC<Props> = ({ stats, channelStatus, wallet, toppingUp, onTopUp }) => {
  const [amount, setAmount] = useState(500);
  const cur = getCurrencySymbol();
  const fmt = (n: number) => `${cur}${(n ?? 0).toFixed(2)}`;
  const balance = wallet?.balance ?? 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Channel stat cards */}
      <View style={styles.statRow}>
        {CHANNELS.map((ch) => {
          const meta = CHANNEL_META[ch];
          const data = stats?.[ch] || { sent: 0, total_cost: 0 };
          const configured = channelStatus?.[ch]?.configured ?? false;
          return (
            <View key={ch} style={styles.statCard}>
              <View style={styles.statHead}>
                <View style={[styles.statIcon, { backgroundColor: meta.bg }]}>
                  <meta.Icon size={18} color={meta.color} />
                </View>
                <View style={[styles.pill, { backgroundColor: configured ? '#DCFCE7' : '#FEE2E2' }]}>
                  {configured ? <CheckCircle2 size={10} color="#15803D" /> : <XCircle size={10} color="#DC2626" />}
                  <Text style={[styles.pillText, { color: configured ? '#15803D' : '#DC2626' }]}>
                    {configured ? 'Active' : 'Not set'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statLabel}>{meta.label} sent</Text>
              <Text style={styles.statValue}>{(data.sent ?? 0).toLocaleString()}</Text>
              <View style={styles.statFoot}>
                <Text style={styles.statFootLabel}>Spend</Text>
                <Text style={styles.statFootValue}>{fmt(data.total_cost)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Wallet balance + top-up */}
      <View style={styles.card}>
        <View style={styles.walletHead}>
          <View style={styles.walletIcon}><Wallet size={20} color={colors.primary} /></View>
          <View>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletValue}>{fmt(balance)}</Text>
          </View>
        </View>

        {wallet?.last_topup_at && (
          <Text style={styles.lastTopup}>
            Last top-up: {new Date(wallet.last_topup_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        )}

        {balance < 100 && (
          <View style={styles.lowBalance}>
            <AlertCircle size={14} color="#DC2626" />
            <Text style={styles.lowBalanceText}>Low balance — top up to keep sending</Text>
          </View>
        )}

        <View style={styles.addFunds}>
          <View style={styles.addFundsHead}>
            <CreditCard size={13} color={colors.gray400} />
            <Text style={styles.addFundsTitle}>Add Funds</Text>
          </View>
          <View style={styles.presetRow}>
            {PRESETS.map((amt) => (
              <TouchableOpacity
                key={amt}
                onPress={() => setAmount(amt)}
                style={[styles.preset, amount === amt && styles.presetOn]}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, amount === amt && styles.presetTextOn]}>{cur}{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            value={String(amount)}
            onChangeText={(v) => setAmount(Number(v.replace(/[^0-9]/g, '')) || 0)}
            placeholder={`Custom amount (min ${cur}100)`}
            placeholderTextColor={colors.gray400}
          />
          <TouchableOpacity
            style={[styles.topUpBtn, (toppingUp || amount < 100) && { opacity: 0.6 }]}
            onPress={() => onTopUp(amount)}
            disabled={toppingUp || amount < 100}
            activeOpacity={0.85}
          >
            {toppingUp
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.topUpBtnText}>Add {cur}{amount} via Cashfree</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent top-ups */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent Top-ups</Text>
        {wallet?.transactions && wallet.transactions.length > 0 ? (
          wallet.transactions.map((txn) => (
            <View key={txn.id} style={styles.txnRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnDesc}>{txn.description || 'Wallet Top-up'}</Text>
                <Text style={styles.txnDate}>
                  {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txnAmount, { color: txn.transaction_type === 'credit' ? '#16A34A' : '#EF4444' }]}>
                  {txn.transaction_type === 'credit' ? '+' : '-'}{fmt(txn.amount)}
                </Text>
                <Text style={[styles.txnStatus, {
                  color: txn.status === 'completed' ? '#16A34A' : txn.status === 'pending' ? '#F59E0B' : '#EF4444',
                }]}>{txn.status}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyTxn}>
            <Wallet size={22} color={colors.gray300} />
            <Text style={styles.emptyTxnText}>No transactions yet</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  pillText: { fontSize: 9, fontWeight: '700' },
  statLabel: { fontSize: 10, color: colors.gray400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 2 },
  statFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  statFootLabel: { fontSize: 10, color: colors.gray400 },
  statFootValue: { fontSize: 12, fontWeight: '700', color: colors.gray700 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  walletHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryBg, justifyContent: 'center', alignItems: 'center' },
  walletLabel: { fontSize: 11, color: colors.gray400, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  walletValue: { fontSize: 26, fontWeight: '800', color: '#111827' },
  lastTopup: { fontSize: 12, color: colors.gray400, marginTop: 10 },
  lowBalance: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 12 },
  lowBalanceText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },

  addFunds: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 12, padding: 12, backgroundColor: '#FAFAFA', marginTop: 14 },
  addFundsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  addFundsTitle: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  presetRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  preset: { flex: 1, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', alignItems: 'center' },
  presetOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  presetText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  presetTextOn: { color: colors.primary },
  amountInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 10 },
  topUpBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  topUpBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  txnDesc: { fontSize: 13, fontWeight: '600', color: colors.gray800 },
  txnDate: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: '700' },
  txnStatus: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  emptyTxn: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FAFAFA' },
  emptyTxnText: { fontSize: 13, color: colors.gray400 },
});
