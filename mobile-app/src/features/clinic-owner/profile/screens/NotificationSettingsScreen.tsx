import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
  Linking, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Smartphone, Mail, MessageSquare, Bell, Wallet, CheckCircle2,
  XCircle, ChevronRight, Save,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { showAlert } from '../../../../shared/components/alertService';
import { checkNotificationPermissions } from '../../../../services/notifications/permissions';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/colors';
import { BaseApiService } from '../../../../services/api/base.api';

const EVENT_LABELS: Record<string, string> = {
  appointment_confirmation: 'Appointment Confirmation',
  invoice_notification:     'Invoice Sent',
  prescription_notification:'Prescription Sent',
  appointment_reminder:     'Appointment Reminder',
  google_review:            'Google Review Request',
  consent_form:             'Consent Form',
  daily_report:             'Daily Report',
};

const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', color: '#25D366', bg: '#E8FFF1', Icon: Smartphone },
  email:    { label: 'Email',    color: '#0EA5E9', bg: '#E0F2FE', Icon: Mail },
  sms:      { label: 'SMS',     color: '#F59E0B', bg: '#FEF3C7', Icon: MessageSquare },
};

class NotifApiService extends BaseApiService {
  async getChannelStatus() {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/channel-status`, { headers: h });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  async getPreferences() {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/preferences`, { headers: h });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }
  async savePreferences(preferences: any[]) {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/preferences`, {
        method: 'PUT', headers: h, body: JSON.stringify({ preferences }),
      });
      return r.ok;
    } catch { return false; }
  }
  async getWallet() {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/wallet`, { headers: h });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  async getStats() {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/notification-admin/stats`, { headers: h });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
}

const notifApi = new NotifApiService();

interface Preference {
  event_type: string;
  channels: string[];
  is_enabled: boolean;
}

interface NotificationSettingsScreenProps {
  navigation: any;
}

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [channelStatus, setChannelStatus] = useState<any>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const saveAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      checkNotificationPermissions().then((s) => setPushEnabled(s.granted));
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cs, prefs, w, st] = await Promise.all([
        notifApi.getChannelStatus(),
        notifApi.getPreferences(),
        notifApi.getWallet(),
        notifApi.getStats(),
      ]);
      setChannelStatus(cs);
      setPreferences(prefs);
      setWallet(w);
      setStats(st);
    } catch (e) {
      console.error('Load notif settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventEnabled = (eventType: string) => {
    setPreferences(prev => prev.map(p =>
      p.event_type === eventType ? { ...p, is_enabled: !p.is_enabled } : p
    ));
  };

  const toggleEventChannel = (eventType: string, channel: string) => {
    setPreferences(prev => prev.map(p => {
      if (p.event_type !== eventType) return p;
      const has = p.channels.includes(channel);
      const next = has ? p.channels.filter(c => c !== channel) : [...p.channels, channel];
      return { ...p, channels: next.length > 0 ? next : [channel] };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await notifApi.savePreferences(preferences);
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

  const fmt = (n: number) => `₹${n?.toFixed(2) ?? '0.00'}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Notification Settings" onBackPress={() => navigation.goBack()} variant="admin" />
        <View style={styles.center}><ActivityIndicator size="large" color={adminColors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notification Settings" onBackPress={() => navigation.goBack()} variant="admin" />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Wallet + Stats Banner */}
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.banner}>
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconWrap}>
              <Wallet size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.bannerLabel}>Wallet Balance</Text>
              <Text style={styles.bannerValue}>{fmt(wallet?.balance ?? 0)}</Text>
            </View>
          </View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerRight}>
            {(['whatsapp', 'email', 'sms'] as const).map(ch => (
              <View key={ch} style={styles.statChip}>
                <Text style={styles.statNum}>{stats?.[ch]?.sent ?? 0}</Text>
                <Text style={styles.statLabel}>{CHANNEL_META[ch].label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Channel Status Cards */}
        <Text style={styles.sectionTitle}>CHANNEL STATUS</Text>
        <View style={styles.channelRow}>
          {(['whatsapp', 'email', 'sms'] as const).map(ch => {
            const meta = CHANNEL_META[ch];
            const configured = channelStatus?.[ch]?.configured ?? false;
            return (
              <View key={ch} style={[styles.channelCard, { backgroundColor: meta.bg }]}>
                <View style={[styles.channelIconWrap, { backgroundColor: meta.color + '22' }]}>
                  <meta.Icon size={18} color={meta.color} />
                </View>
                <Text style={[styles.channelName, { color: meta.color }]}>{meta.label}</Text>
                <View style={styles.channelStatus}>
                  {configured
                    ? <CheckCircle2 size={14} color="#10B981" />
                    : <XCircle size={14} color="#EF4444" />}
                  <Text style={[styles.channelStatusText, { color: configured ? '#10B981' : '#EF4444' }]}>
                    {configured ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Push Notifications */}
        <Text style={styles.sectionTitle}>DEVICE PUSH</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={[styles.prefIcon, { backgroundColor: colors.primaryBg }]}>
              <Bell size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Push Notifications</Text>
              <Text style={styles.prefSub}>App alerts on your device</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={() => Linking.openSettings()}
              trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
              thumbColor={pushEnabled ? colors.primary : '#9CA3AF'}
            />
          </View>
          <TouchableOpacity style={styles.openSettings} onPress={() => Linking.openSettings()}>
            <Text style={styles.openSettingsText}>Open device settings</Text>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Per-event Preferences */}
        <Text style={styles.sectionTitle}>EVENT PREFERENCES</Text>
        <Text style={styles.sectionHint}>Choose which channels each event uses</Text>

        {preferences.map((pref) => {
          const label = EVENT_LABELS[pref.event_type] ?? pref.event_type.replace(/_/g, ' ');
          return (
            <View key={pref.event_type} style={[styles.card, !pref.is_enabled && styles.cardDisabled]}>
              <View style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prefTitle, !pref.is_enabled && { color: '#9CA3AF' }]}>{label}</Text>
                </View>
                <Switch
                  value={pref.is_enabled}
                  onValueChange={() => toggleEventEnabled(pref.event_type)}
                  trackColor={{ false: '#E5E7EB', true: colors.primaryBg }}
                  thumbColor={pref.is_enabled ? colors.primary : '#9CA3AF'}
                />
              </View>
              {pref.is_enabled && (
                <View style={styles.channelChips}>
                  {(['whatsapp', 'email', 'sms'] as const).map(ch => {
                    const meta = CHANNEL_META[ch];
                    const selected = pref.channels.includes(ch);
                    return (
                      <TouchableOpacity
                        key={ch}
                        onPress={() => toggleEventChannel(pref.event_type, ch)}
                        style={[styles.chip, selected && { backgroundColor: meta.color + '18', borderColor: meta.color }]}
                        activeOpacity={0.7}
                      >
                        <meta.Icon size={12} color={selected ? meta.color : '#9CA3AF'} />
                        <Text style={[styles.chipText, selected && { color: meta.color }]}>{meta.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save FAB */}
      <View style={styles.fabWrap}>
        <Animated.Text style={[styles.savedText, {
          opacity: saveAnim,
          transform: [{ translateY: saveAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }]}>Saved!</Animated.Text>
        <TouchableOpacity style={styles.fab} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Save size={18} color="#fff" /><Text style={styles.fabText}>Save Changes</Text></>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F9FAFB' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },

  banner:        { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' },
  bannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bannerIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  bannerLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  bannerValue:   { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 1 },
  bannerDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 14 },
  bannerRight:   { flexDirection: 'row', gap: 10 },
  statChip:      { alignItems: 'center' },
  statNum:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  statLabel:     { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 1 },

  sectionTitle:  { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, paddingHorizontal: 20, marginTop: 20, marginBottom: 8 },
  sectionHint:   { fontSize: 12, color: '#6B7280', paddingHorizontal: 20, marginTop: -4, marginBottom: 8 },

  channelRow:    { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  channelCard:   { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  channelIconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  channelName:   { fontSize: 11, fontWeight: '700' },
  channelStatus: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  channelStatusText: { fontSize: 10, fontWeight: '600' },

  card:          { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  cardDisabled:  { opacity: 0.6 },
  prefRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefIcon:      { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  prefTitle:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  prefSub:       { fontSize: 12, color: '#6B7280', marginTop: 1 },
  openSettings:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 4 },
  openSettingsText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  channelChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  chipText:      { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  fabWrap:       { position: 'absolute', bottom: 24, left: 20, right: 20, alignItems: 'center' },
  fab:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: adminColors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, shadowColor: adminColors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  savedText:     { fontSize: 13, fontWeight: '600', color: adminColors.primary, marginBottom: 6 },
});
