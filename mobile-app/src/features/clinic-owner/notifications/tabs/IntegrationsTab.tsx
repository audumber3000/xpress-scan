import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Image } from 'react-native';
import { Smartphone, CheckCircle2, AlertTriangle, RefreshCw, Info } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { showAlert } from '../../../../shared/components/alertService';
import { notificationsApi, WareachStatus } from '../notifications.api';

interface Props {
  manualOn: boolean;
  savingManual: boolean;
  onToggleManual: (value: boolean) => void;
  /** Called after the number connects or disconnects, so the signed-in user's
   *  own_whatsapp_connected flag (which the WhatsApp buttons read) is refreshed. */
  onConnectionChange?: () => void;
  onUpgrade: () => void;
}

const POLL_MS = 4000;
// A code nobody has scanned in three minutes has nobody looking at it. Stop
// polling and let them ask for a fresh one. (WA Reach itself gives up after ten.)
const PAIRING_WINDOW_MS = 3 * 60 * 1000;

const displayPhone = (p?: string | null) => {
  const digits = String(p || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

/**
 * WhatsApp settings: manual sending, and the clinic's own number.
 *
 * A connected own number wins over manual mode, because the automated send
 * already goes out from that same number with the PDF attached. If the number
 * drops, patient messages keep going out from the MolarPlus number until it is
 * reconnected, so no patient misses one.
 */
export const IntegrationsTab: React.FC<Props> = ({ manualOn, savingManual, onToggleManual, onConnectionChange, onUpgrade }) => {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(true);
  const [available, setAvailable] = useState(true);
  // Older backends do not send `entitled`, and are treated as allowing it.
  const [entitled, setEntitled] = useState(true);
  const [status, setStatus] = useState<WareachStatus['status']>('disconnected');
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const pairingStartedAt = useRef<number | null>(null);
  const onChangeRef = useRef(onConnectionChange);
  onChangeRef.current = onConnectionChange;

  const connected = status === 'connected';

  const loadStatus = useCallback(async () => {
    const res = await notificationsApi.getWareachStatus();
    setIsPro(res.is_pro !== false);
    setAvailable(res.available !== false);
    setEntitled(res.entitled !== false);
    setStatus(res.status || 'disconnected');
    setPhone(res.phone_number || null);
    if (res.status === 'connecting') pairingStartedAt.current = Date.now();
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // While pairing, keep the QR fresh and watch for the scan.
  useEffect(() => {
    if (status !== 'connecting' || expired) return undefined;
    const timer = setInterval(async () => {
      if (pairingStartedAt.current && Date.now() - pairingStartedAt.current > PAIRING_WINDOW_MS) {
        setExpired(true);
        setQr(null);
        return;
      }
      const res = await notificationsApi.wareachQr().catch(() => null);
      if (!res) return;
      if (res.qr) setQr(res.qr);
      if (res.status && res.status !== 'connecting') {
        setStatus(res.status as WareachStatus['status']);
        setQr(null);
        if (res.status === 'connected') {
          const st = await notificationsApi.getWareachStatus().catch(() => null);
          setPhone(st?.phone_number || null);
          onChangeRef.current?.();
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, expired]);

  const handleConnect = async () => {
    setBusy(true);
    setActionError('');
    try {
      const res = await notificationsApi.wareachConnect();
      pairingStartedAt.current = Date.now();
      setExpired(false);
      setStatus((res.status as WareachStatus['status']) || 'connecting');
      setQr(res.qr || null);
      if (res.status === 'connected') onChangeRef.current?.();
    } catch (e: any) {
      setActionError(e?.message || 'Could not start the connection. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const disconnectNow = async () => {
    setBusy(true);
    setActionError('');
    try {
      await notificationsApi.wareachDisconnect();
      setStatus('disconnected'); setPhone(null); setQr(null); setExpired(false);
      onChangeRef.current?.();
    } catch (e: any) {
      setActionError(e?.message || 'Could not disconnect. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    showAlert(
      'Disconnect your WhatsApp number?',
      'Patient messages will go out from the MolarPlus number again, charged to your wallet as usual. You can reconnect any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: disconnectNow },
      ],
    );
  };

  const shownPhone = displayPhone(phone);

  return (
    <View style={{ gap: 16 }}>
      {/* Manual WhatsApp toggle */}
      <View style={styles.card}>
        <View style={styles.manualRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Send WhatsApp manually from my own number</Text>
            <Text style={styles.manualSub}>
              {connected
                ? `Paused while your number is connected below. Patient WhatsApp buttons send from ${shownPhone || 'your number'} automatically.`
                : 'When on, patient WhatsApp buttons (invoices, prescriptions) open WhatsApp with the message pre-filled so you send it from your own account. When off, messages send automatically.'}
            </Text>
          </View>
          <Switch
            value={manualOn && !connected}
            disabled={savingManual || connected}
            onValueChange={onToggleManual}
            trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
            thumbColor={manualOn && !connected ? colors.primary : '#9CA3AF'}
          />
        </View>
      </View>

      {/* Own number */}
      <View style={styles.card}>
        <View style={styles.waHead}>
          <View style={styles.waBadgeIcon}><Smartphone size={20} color="#15803D" /></View>
          <View style={{ flex: 1 }}>
            <View style={styles.waTitleRow}>
              <Text style={styles.cardTitle}>Your clinic's WhatsApp number</Text>
              <View style={styles.freePill}><Text style={styles.freePillText}>Free</Text></View>
            </View>
            <Text style={styles.manualSub}>
              Connect it once and every patient message goes out from it for free. Patients can reply to it directly.
            </Text>
          </View>
        </View>

        <View style={styles.waBody}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : !isPro ? (
            <View style={styles.upsell}>
              <Text style={styles.upsellTitle}>Not on your current plan.</Text>
              <Text style={styles.upsellText}>Upgrade to connect your own WhatsApp number and send patient messages for free.</Text>
              <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
                <Text style={styles.upgradeBtnText}>See plans</Text>
              </TouchableOpacity>
            </View>
          ) : connected ? (
            <View>
              <View style={styles.connectedRow}>
                <CheckCircle2 size={18} color="#15803D" />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
              <View style={styles.phoneRow}>
                <Smartphone size={15} color={colors.gray400} />
                <Text style={styles.phoneText}>{shownPhone || 'Your WhatsApp number'}</Text>
              </View>
              {entitled ? (
                <Text style={styles.freeNote}>
                  Patient WhatsApp now goes out from this number, free. If the phone ever drops off, messages go out from the MolarPlus number until you reconnect.
                </Text>
              ) : (
                <View style={[styles.failBox, { marginTop: 10, marginBottom: 0 }]}>
                  <AlertTriangle size={15} color="#B45309" />
                  <Text style={styles.failText}>
                    Paused. Your plan no longer includes sending from your own number, so patient messages are going out from the MolarPlus number. The clinic owner can add it back on the web, under Subscription.
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator size="small" color="#DC2626" /> : <Text style={styles.disconnectBtnText}>Disconnect</Text>}
              </TouchableOpacity>
              {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
            </View>
          ) : status === 'connecting' ? (
            <View style={styles.qrWrap}>
              <Text style={styles.qrTitle}>Scan to connect</Text>
              <Text style={styles.qrHint}>
                On the clinic's phone, open WhatsApp, go to Settings, Linked devices, Link a device, and scan this code.
              </Text>
              <View style={styles.qrBox}>
                {expired
                  ? <Text style={styles.expiredText}>This code expired.</Text>
                  : qr
                    ? <Image source={{ uri: qr }} style={styles.qrImg} resizeMode="contain" />
                    : <ActivityIndicator color={colors.gray300} />}
              </View>
              {expired ? (
                <TouchableOpacity style={[styles.connectBtn, { marginTop: 12, alignSelf: 'center' }]} onPress={handleConnect} disabled={busy} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={15} color="#fff" />}
                  <Text style={styles.connectBtnText}>Show a new code</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qrRefresh}>
                  <RefreshCw size={12} color={colors.gray400} />
                  <Text style={styles.qrRefreshText}>The code refreshes on its own</Text>
                </View>
              )}
              <TouchableOpacity onPress={disconnectNow} disabled={busy}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
              {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
            </View>
          ) : (
            <View>
              {!!shownPhone && (
                <View style={styles.failBox}>
                  <AlertTriangle size={15} color="#B45309" />
                  <Text style={styles.failText}>
                    {shownPhone} got disconnected. Patient messages are going out from the MolarPlus number until you reconnect it.
                  </Text>
                </View>
              )}
              {!available ? (
                <Text style={styles.disconnectedText}>
                  Connecting your own number isn't available right now. Patient messages keep going out from the MolarPlus number.
                </Text>
              ) : !entitled ? (
                <Text style={styles.disconnectedText}>
                  Sending from your own number is an add-on on your plan, and included with Pro. The clinic owner can add it on the web, under Subscription, Add-on Features.
                </Text>
              ) : (
                <>
                  <Text style={styles.disconnectedText}>Link your clinic's WhatsApp number to start sending patient messages from it, for free.</Text>
                  <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} disabled={busy} activeOpacity={0.85}>
                    {busy ? <ActivityIndicator size="small" color="#fff" /> : <Smartphone size={16} color="#fff" />}
                    <Text style={styles.connectBtnText}>{shownPhone ? 'Reconnect WhatsApp' : 'Connect your WhatsApp'}</Text>
                  </TouchableOpacity>
                  {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
                </>
              )}
            </View>
          )}
        </View>
        <View style={styles.tipRow}>
          <Info size={13} color={colors.gray400} />
          <Text style={styles.tipText}>
            Use the clinic's WhatsApp Business number rather than someone's personal one. WhatsApp can restrict numbers that send a lot of automated messages.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flexShrink: 1 },
  manualRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  manualSub: { fontSize: 12, color: colors.gray500, marginTop: 4, lineHeight: 17 },

  waHead: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  waBadgeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  waTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
  phoneText: { fontSize: 14, color: colors.gray700, fontWeight: '600' },
  freeNote: { fontSize: 12, color: colors.gray500, marginTop: 8, lineHeight: 17 },
  disconnectBtn: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 14, minWidth: 110, alignItems: 'center' },
  disconnectBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 8, lineHeight: 17 },

  qrWrap: { alignItems: 'center' },
  qrTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  qrHint: { fontSize: 12, color: colors.gray500, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 17 },
  qrBox: { width: 208, height: 208, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  qrImg: { width: '100%', height: '100%' },
  expiredText: { fontSize: 12, color: colors.gray500 },
  qrRefresh: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  qrRefreshText: { fontSize: 12, color: colors.gray400 },
  cancelLink: { fontSize: 12, color: colors.gray500, textDecorationLine: 'underline', marginTop: 12 },

  failBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  failText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  disconnectedText: { fontSize: 13, color: colors.gray600, marginBottom: 14, lineHeight: 18 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 13, alignSelf: 'flex-start', paddingHorizontal: 18 },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  tipRow: { flexDirection: 'row', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  tipText: { flex: 1, fontSize: 11, color: colors.gray500, lineHeight: 16 },
});
