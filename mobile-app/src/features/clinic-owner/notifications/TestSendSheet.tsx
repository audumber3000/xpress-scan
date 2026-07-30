import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { X, Send, Loader as Loader2 } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';
import { getCurrencySymbol } from '../../../shared/utils/currency';
import { toast } from '../../../shared/components/toastService';
import { CHANNELS, CHANNEL_META, EVENT_LABELS, EVENT_AUDIENCE, getChannelCost, previewRender, ChannelKey } from './constants';
import { notificationsApi } from './notifications.api';

interface Props {
  visible: boolean;
  eventType: string | null;
  defaultChannel?: string;
  walletBalance: number;
  onClose: () => void;
  onSent: (newBalance: number) => void;
}

export const TestSendSheet: React.FC<Props> = ({ visible, eventType, defaultChannel, walletBalance, onClose, onSent }) => {
  const [channel, setChannel] = useState<ChannelKey>('whatsapp');
  const [recipient, setRecipient] = useState('');
  const [templates, setTemplates] = useState<Record<string, { content: string; variables: string[] }>>({});
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [sending, setSending] = useState(false);
  const cur = getCurrencySymbol();

  useEffect(() => {
    if (!visible || !eventType) return;
    setChannel(((defaultChannel as ChannelKey) || 'whatsapp'));
    setRecipient('');
    setLoadingTpl(true);
    notificationsApi.getTemplates()
      .then((t) => setTemplates(t as any))
      .finally(() => setLoadingTpl(false));
  }, [visible, eventType, defaultChannel]);

  if (!eventType) return null;

  const audience = EVENT_AUDIENCE[eventType] || 'patient';
  const tpl = templates[eventType];
  const cost = getChannelCost(channel, eventType);
  const isEmail = channel === 'email';
  const preview = tpl?.content ? previewRender(tpl.content, cur) : null;
  const canSend = !sending && !!recipient && walletBalance >= cost && channel !== 'sms';

  const handleSend = async () => {
    if (!recipient) { toast.error('Enter a recipient'); return; }
    setSending(true);
    try {
      const res = await notificationsApi.templateTestSend(eventType, channel, recipient);
      toast.success(`Sent! ${cur}${(res.cost ?? 0).toFixed(2)} deducted.`);
      onSent(res.new_balance ?? walletBalance);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{EVENT_LABELS[eventType] || eventType}</Text>
                <View style={[styles.badge, {
                  backgroundColor: audience === 'doctor' ? '#EFF6FF' : audience === 'owner' ? '#F5F3FF' : '#ECFDF5',
                }]}>
                  <Text style={[styles.badgeText, {
                    color: audience === 'doctor' ? '#2563EB' : audience === 'owner' ? '#7C3AED' : '#059669',
                  }]}>
                    {audience === 'doctor' ? '👨‍⚕️ Doctor' : audience === 'owner' ? '🤖 Auto' : '🧑‍🦷 Patient'}
                  </Text>
                </View>
              </View>
              <Text style={styles.subtitle}>Preview template &amp; send a test</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}><X size={20} color={colors.gray500} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            {/* Channel picker */}
            <Text style={styles.label}>Send via</Text>
            <View style={styles.channelRow}>
              {CHANNELS.map((c) => {
                const meta = CHANNEL_META[c];
                const on = channel === c;
                const locked = c === 'sms';
                return (
                  <TouchableOpacity
                    key={c}
                    disabled={locked}
                    onPress={() => setChannel(c)}
                    style={[styles.channelBtn, on && styles.channelBtnOn, locked && { opacity: 0.4 }]}
                  >
                    <meta.Icon size={14} color={on ? colors.primary : colors.gray500} />
                    <Text style={[styles.channelBtnText, on && { color: colors.primary }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Template preview */}
            <Text style={styles.label}>Template preview</Text>
            {loadingTpl ? (
              <View style={styles.previewLoading}><Loader2 size={18} color={colors.gray300} /></View>
            ) : preview ? (
              <View style={styles.previewBox}><Text style={styles.previewText}>{preview}</Text></View>
            ) : (
              <View style={styles.noTplBox}>
                <Text style={styles.noTplText}>No template for this event. A generic fallback will be sent.</Text>
              </View>
            )}

            {/* Recipient */}
            <Text style={styles.label}>{isEmail ? 'Recipient email' : 'Recipient phone (with country code)'}</Text>
            <TextInput
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              placeholder={isEmail ? 'doctor@clinic.com' : '919876543210'}
              placeholderTextColor={colors.gray400}
              keyboardType={isEmail ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
            />

            {/* Cost vs balance */}
            <View style={styles.costBox}>
              <View>
                <Text style={styles.costLabel}>Cost of this test</Text>
                <Text style={styles.costValue}>{cur}{cost.toFixed(2)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.costLabel}>Wallet balance</Text>
                <Text style={[styles.costValue, walletBalance < cost && { color: '#EF4444' }]}>{cur}{walletBalance.toFixed(2)}</Text>
              </View>
            </View>
            {walletBalance < cost && (
              <Text style={styles.insufficient}>Insufficient balance. Top up from the Overview tab.</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={[styles.sendBtn, !canSend && { opacity: 0.5 }]} onPress={handleSend} disabled={!canSend} activeOpacity={0.85}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Send size={14} color="#fff" /><Text style={styles.sendBtnText}>Send Test — {cur}{cost.toFixed(2)}</Text></>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  label: { fontSize: 11, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  channelRow: { flexDirection: 'row', gap: 8 },
  channelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB' },
  channelBtnOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  channelBtnText: { fontSize: 12, fontWeight: '600', color: colors.gray500 },

  previewLoading: { height: 80, backgroundColor: '#F9FAFB', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  previewBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  previewText: { fontSize: 12, color: colors.gray700, lineHeight: 19 },
  noTplBox: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 14 },
  noTplText: { fontSize: 12, color: '#B45309' },

  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },

  costBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.primaryBg, borderRadius: 12, padding: 14, marginTop: 14 },
  costLabel: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
  costValue: { fontSize: 17, fontWeight: '700', color: colors.gray800, marginTop: 2 },
  insufficient: { fontSize: 12, color: '#DC2626', marginTop: 8 },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, marginTop: 16 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
