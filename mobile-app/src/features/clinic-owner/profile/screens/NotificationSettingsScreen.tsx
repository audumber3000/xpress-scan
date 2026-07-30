import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Linking, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  BarChart3, MessageSquare, FileText, Plug, Bell, ChevronRight, Save, RefreshCw,
} from 'lucide-react-native';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { showAlert } from '../../../../shared/components/alertService';
import { toast } from '../../../../shared/components/toastService';
import { checkNotificationPermissions } from '../../../../services/notifications/permissions';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/colors';
import { useAuth } from '../../../../app/AuthContext';
import { notificationsApi, Preference, Wallet } from '../../notifications/notifications.api';
import { OverviewTab } from '../../notifications/tabs/OverviewTab';
import { PreferencesTab } from '../../notifications/tabs/PreferencesTab';
import { LogsTab } from '../../notifications/tabs/LogsTab';
import { IntegrationsTab } from '../../notifications/tabs/IntegrationsTab';
import { TestSendSheet } from '../../notifications/TestSendSheet';

type TabId = 'overview' | 'preferences' | 'logs' | 'channels';
const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'overview',    label: 'Overview',    Icon: BarChart3 },
  { id: 'preferences', label: 'Preferences', Icon: MessageSquare },
  { id: 'logs',        label: 'Logs',        Icon: FileText },
  { id: 'channels',    label: 'Integrations', Icon: Plug },
];

interface Props { navigation: any; }

export const NotificationSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { backendUser, refreshBackendUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const [channelStatus, setChannelStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, transactions: [] });
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [manualOn, setManualOn] = useState(!!backendUser?.clinic?.manual_whatsapp);

  const [testSheet, setTestSheet] = useState<{ open: boolean; eventType: string | null; channel?: string }>({ open: false, eventType: null });
  const saveAnim = useRef(new Animated.Value(0)).current;
  const pendingOrderId = useRef<string | null>(null);

  // ── Cashfree callback (lazy-required so an older build never crashes the screen)
  useEffect(() => {
    let CFPaymentGatewayService: any;
    try {
      ({ CFPaymentGatewayService } = require('react-native-cashfree-pg-sdk'));
    } catch {
      return; // SDK not in this build — top-up will surface a friendly message.
    }
    CFPaymentGatewayService.setCallback({
      onVerify: async (orderID: string) => {
        try {
          const res = await notificationsApi.verifyTopup(orderID);
          if (res.success) {
            toast.success('Wallet topped up!');
            const w = await notificationsApi.getWallet();
            setWallet(w);
          } else {
            toast.error('Payment not confirmed yet. If debited, it reflects within 24h.');
          }
        } catch {
          toast.error('Could not verify payment. Please refresh.');
        } finally {
          setToppingUp(false);
        }
      },
      onError: (err: any) => {
        setToppingUp(false);
        const msg = err?.message || 'Payment failed';
        if (msg !== 'Payment cancelled') toast.error(msg);
      },
    });
    return () => { try { CFPaymentGatewayService.removeCallback(); } catch {} };
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkNotificationPermissions().then((s) => setPushEnabled(s.granted));
      loadAll();
    }, [])
  );

  useEffect(() => { setManualOn(!!backendUser?.clinic?.manual_whatsapp); }, [backendUser]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cs, st, w, prefs] = await Promise.all([
        notificationsApi.getChannelStatus(),
        notificationsApi.getStats(),
        notificationsApi.getWallet(),
        notificationsApi.getPreferences(),
      ]);
      setChannelStatus(cs);
      setStats(st);
      setWallet(w);
      setPreferences(prefs);
    } finally {
      setLoading(false);
    }
  };

  // ── Preferences editing ──────────────────────────────────
  const toggleEnabled = (eventType: string) =>
    setPreferences((prev) => prev.map((p) => p.event_type === eventType ? { ...p, is_enabled: !p.is_enabled } : p));

  const toggleChannel = (eventType: string, channel: string) =>
    setPreferences((prev) => prev.map((p) => {
      if (p.event_type !== eventType) return p;
      const has = p.channels.includes(channel);
      const next = has ? p.channels.filter((c) => c !== channel) : [...p.channels, channel];
      return { ...p, channels: next.length > 0 ? next : [channel] };
    }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await notificationsApi.savePreferences(preferences);
    setSaving(false);
    if (ok) {
      Animated.sequence([
        Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(saveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      showAlert('Error', 'Failed to save preferences. Please try again.');
    }
  };

  // ── Wallet top-up (Cashfree) ─────────────────────────────
  const handleTopUp = async (amount: number) => {
    if (amount < 100) { toast.error('Minimum top-up is 100'); return; }
    setToppingUp(true);
    try {
      let CFSession: any, CFEnvironment: any, CFPaymentGatewayService: any;
      try {
        ({ CFPaymentGatewayService } = require('react-native-cashfree-pg-sdk'));
        ({ CFSession, CFEnvironment } = require('cashfree-pg-api-contract'));
      } catch {
        setToppingUp(false);
        toast.error('Payments need the latest app build. Please update the app.');
        return;
      }
      const res = await notificationsApi.topupWallet(amount);
      pendingOrderId.current = res.order_id;
      const session = new CFSession(res.payment_session_id, res.order_id, CFEnvironment.PRODUCTION);
      CFPaymentGatewayService.doWebPayment(session);
    } catch (e: any) {
      setToppingUp(false);
      toast.error(e?.message || 'Failed to start payment.');
    }
  };

  // ── Manual WhatsApp toggle ───────────────────────────────
  const handleToggleManual = async (value: boolean) => {
    setSavingManual(true);
    setManualOn(value); // optimistic
    const ok = await notificationsApi.setManualWhatsApp(value);
    if (ok) {
      await refreshBackendUser();
      toast.success(value ? 'Own-number WhatsApp turned on' : 'Turned off');
    } else {
      setManualOn(!value);
      toast.error('Could not update the setting');
    }
    setSavingManual(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Notifications" onBackPress={() => navigation.goBack()} variant="admin" />
        <View style={styles.center}><ActivityIndicator size="large" color={adminColors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        onBackPress={() => navigation.goBack()}
        variant="admin"
        rightComponent={
          <TouchableOpacity onPress={loadAll} style={styles.refreshHeaderBtn}>
            <RefreshCw size={18} color={adminColors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(({ id, label, Icon }) => {
          const on = activeTab === id;
          return (
            <TouchableOpacity key={id} style={[styles.tab, on && styles.tabOn]} onPress={() => setActiveTab(id)} activeOpacity={0.7}>
              <Icon size={15} color={on ? colors.primary : colors.gray400} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {activeTab === 'overview' && (
          <>
            {/* Device push (mobile-only bonus) */}
            <View style={styles.pushCard}>
              <View style={[styles.pushIcon, { backgroundColor: colors.primaryBg }]}>
                <Bell size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pushTitle}>Device Push Notifications</Text>
                <Text style={styles.pushSub}>App alerts on this device</Text>
              </View>
              <TouchableOpacity style={styles.pushSettingsBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.pushSettingsText}>{pushEnabled ? 'On' : 'Off'}</Text>
                <ChevronRight size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <OverviewTab stats={stats} channelStatus={channelStatus} wallet={wallet} toppingUp={toppingUp} onTopUp={handleTopUp} />
          </>
        )}

        {activeTab === 'preferences' && (
          <PreferencesTab
            preferences={preferences}
            onToggleEnabled={toggleEnabled}
            onToggleChannel={toggleChannel}
            onTest={(pref) => setTestSheet({ open: true, eventType: pref.event_type, channel: (pref as any).channels?.[0] })}
          />
        )}

        {activeTab === 'logs' && <LogsTab />}

        {activeTab === 'channels' && (
          <IntegrationsTab
            manualOn={manualOn}
            savingManual={savingManual}
            onToggleManual={handleToggleManual}
            onUpgrade={() => navigation.navigate('Subscription')}
          />
        )}

        <View style={{ height: activeTab === 'preferences' ? 96 : 24 }} />
      </ScrollView>

      {/* Save FAB — only on Preferences */}
      {activeTab === 'preferences' && (
        <View style={styles.fabWrap}>
          <Animated.Text style={[styles.savedText, {
            opacity: saveAnim,
            transform: [{ translateY: saveAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }]}>Saved!</Animated.Text>
          <TouchableOpacity style={styles.fab} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Save size={18} color="#fff" /><Text style={styles.fabText}>Save Changes</Text></>}
          </TouchableOpacity>
        </View>
      )}

      <TestSendSheet
        visible={testSheet.open}
        eventType={testSheet.eventType}
        defaultChannel={testSheet.channel}
        walletBalance={wallet.balance ?? 0}
        onClose={() => setTestSheet({ open: false, eventType: null })}
        onSent={(newBalance) => setWallet((w) => ({ ...w, balance: newBalance }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  refreshHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.gray400 },
  tabTextOn: { color: colors.primary, fontWeight: '700' },

  scroll: { padding: 16 },

  pushCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 16 },
  pushIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  pushTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  pushSub: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  pushSettingsBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pushSettingsText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  fabWrap: { position: 'absolute', bottom: 24, left: 20, right: 20, alignItems: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: adminColors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, shadowColor: adminColors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  savedText: { fontSize: 13, fontWeight: '600', color: adminColors.primary, marginBottom: 6 },
});
