import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Image } from 'react-native';
import { Smartphone, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { showAlert } from '../../../../shared/components/alertService';
import { toast } from '../../../../shared/components/toastService';
import { notificationsApi, WareachStatus } from '../notifications.api';

interface Props {
  manualOn: boolean;
  savingManual: boolean;
  onToggleManual: (value: boolean) => void;
  onUpgrade: () => void;
}

export const IntegrationsTab: React.FC<Props> = ({ manualOn, savingManual, onToggleManual, onUpgrade }) => {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [status, setStatus] = useState<WareachStatus['status']>('disconnected');
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await notificationsApi.getWareachStatus();
    setIsPro(!!res.is_pro);
    setStatus(res.status || 'disconnected');
    setPhone(res.phone_number || null);
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Poll for a fresh QR + status while pairing.
  useEffect(() => {
    if (status !== 'connecting') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const [qrRes, stRes] = await Promise.all([
          notificationsApi.wareachQr().catch(() => null),
          notificationsApi.getWareachStatus().catch(() => null),
        ]);
        if (qrRes?.qr) setQr(qrRes.qr);
        const s = stRes?.status || qrRes?.status;
        if (s && s !== 'connecting') {
          setStatus(s as WareachStatus['status']);
          setPhone(stRes?.phone_number || null);
          if (s === 'connected') { setQr(null); toast.success('WhatsApp connected!'); }
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await notificationsApi.wareachConnect();
      setStatus((res.status as WareachStatus['status']) || 'connecting');
      if (res.qr) setQr(res.qr);
    } catch (e: any) {
      toast.error(e?.message || 'Could not start the connection. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    showAlert(
      'Disconnect WhatsApp?',
      'Patient messages will go back to the standard (paid) channel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect', style: 'destructive', onPress: async () => {
            setBusy(true);
            try {
              await notificationsApi.wareachDisconnect();
              setStatus('disconnected'); setPhone(null); setQr(null);
              toast.success('WhatsApp disconnected.');
            } catch {
              toast.error('Could not disconnect. Please try again.');
            } finally { setBusy(false); }
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Manual WhatsApp toggle */}
      <View style={styles.card}>
        <View style={styles.manualRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Send WhatsApp from my own number</Text>
            <Text style={styles.manualSub}>
              When on, patient WhatsApp buttons (invoices, prescriptions) open WhatsApp with the message
              pre-filled so you send it from your own account. When off, messages send automatically from
              the MolarPlus number.
            </Text>
          </View>
          <Switch
            value={manualOn}
            disabled={savingManual}
            onValueChange={onToggleManual}
            trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
            thumbColor={manualOn ? colors.primary : '#9CA3AF'}
          />
        </View>
      </View>

      {/* WA Reach */}
      <View style={styles.card}>
        <View style={styles.waHead}>
          <View style={styles.waBadgeIcon}><Text style={styles.waBadgeText}>WA</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.waTitleRow}>
              <Text style={styles.cardTitle}>WA Reach</Text>
              <View style={styles.freePill}><Text style={styles.freePillText}>Free · Pro</Text></View>
            </View>
            <Text style={styles.manualSub}>
              Connect your clinic's own WhatsApp number to send patient messages for free.
            </Text>
          </View>
        </View>

        <View style={styles.waBody}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : !isPro ? (
            <View style={styles.upsell}>
              <Text style={styles.upsellTitle}>This is a Pro feature.</Text>
              <Text style={styles.upsellText}>Upgrade to Professional to connect your own WhatsApp number and send patient messages for free.</Text>
              <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
                <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'connected' ? (
            <View>
              <View style={styles.connectedRow}>
                <CheckCircle2 size={18} color="#15803D" />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
              <View style={styles.phoneRow}>
                <Smartphone size={15} color={colors.gray400} />
                <Text style={styles.phoneText}>{phone ? `+${phone}` : 'Your WhatsApp number'}</Text>
              </View>
              <Text style={styles.freeNote}>Patient WhatsApp now sends from your number — free.</Text>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect} disabled={busy} activeOpacity={0.85}>
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'connecting' ? (
            <View style={styles.qrWrap}>
              <Text style={styles.qrTitle}>Scan to connect</Text>
              <Text style={styles.qrHint}>Open WhatsApp → Settings → Linked devices → Link a device, then scan.</Text>
              <View style={styles.qrBox}>
                {qr ? <Image source={{ uri: qr }} style={styles.qrImg} resizeMode="contain" /> : <ActivityIndicator color={colors.gray300} />}
              </View>
              <View style={styles.qrRefresh}>
                <RefreshCw size={12} color={colors.gray400} />
                <Text style={styles.qrRefreshText}>Code refreshes automatically</Text>
              </View>
              <TouchableOpacity onPress={handleDisconnect} disabled={busy}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {status === 'failed' && (
                <View style={styles.failBox}>
                  <AlertTriangle size={15} color="#DC2626" />
                  <Text style={styles.failText}>Your WhatsApp got disconnected. Reconnect to keep sending from your own number.</Text>
                </View>
              )}
              <Text style={styles.disconnectedText}>Link your clinic's WhatsApp number to start sending patient messages from it, for free.</Text>
              <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <Smartphone size={16} color="#fff" />}
                <Text style={styles.connectBtnText}>{status === 'failed' ? 'Reconnect WhatsApp' : 'Connect your WhatsApp'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.poweredBy}>Powered by WA Reach</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  manualRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  manualSub: { fontSize: 12, color: colors.gray500, marginTop: 4, lineHeight: 17 },

  waHead: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  waBadgeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  waBadgeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  waTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  freePill: { backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  freePillText: { fontSize: 10, fontWeight: '700', color: '#15803D' },
  waBody: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14 },
  center: { alignItems: 'center', paddingVertical: 24 },

  upsell: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 14 },
  upsellTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  upsellText: { fontSize: 12, color: '#B45309', marginTop: 4, lineHeight: 17 },
  upgradeBtn: { backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', marginTop: 12 },
  upgradeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connectedText: { fontSize: 14, fontWeight: '700', color: '#15803D' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  phoneText: { fontSize: 14, color: colors.gray700 },
  freeNote: { fontSize: 12, color: colors.gray500, marginTop: 8 },
  disconnectBtn: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 14 },
  disconnectBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  qrWrap: { alignItems: 'center' },
  qrTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  qrHint: { fontSize: 12, color: colors.gray500, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  qrBox: { width: 208, height: 208, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  qrImg: { width: '100%', height: '100%' },
  qrRefresh: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  qrRefreshText: { fontSize: 12, color: colors.gray400 },
  cancelLink: { fontSize: 12, color: colors.gray500, textDecorationLine: 'underline', marginTop: 12 },

  failBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  failText: { flex: 1, fontSize: 13, color: '#B91C1C', lineHeight: 18 },
  disconnectedText: { fontSize: 13, color: colors.gray600, marginBottom: 14, lineHeight: 18 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 13, alignSelf: 'flex-start', paddingHorizontal: 18 },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  poweredBy: { fontSize: 11, color: colors.gray400, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
});
