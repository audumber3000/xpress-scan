import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Award, Zap, Gift, CreditCard, Calendar, Clock, CheckCircle2, ArrowRight, RefreshCw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { adminColors } from '../../../../shared/constants/adminColors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { BaseApiService } from '../../../../services/api/base.api';

const PLAN_META: Record<string, { label: string; color: string; bg: string; Icon: any; gradient: [string, string] }> = {
  free:         { label: 'Free',         color: '#6B7280', bg: '#F3F4F6', Icon: Gift,  gradient: ['#374151', '#6B7280'] },
  professional: { label: 'Professional', color: '#2D9596', bg: '#E0F2F2', Icon: Award, gradient: ['#1F6B72', '#2D9596'] },
  enterprise:   { label: 'Enterprise',   color: '#7C3AED', bg: '#EDE9FE', Icon: Zap,   gradient: ['#5B21B6', '#7C3AED'] },
};

const PLAN_FEATURES: Record<string, string[]> = {
  free:         ['Basic dental charting', 'Patient management', 'Simple reporting', 'Up to 250 patients'],
  professional: ['Unlimited patients', 'Advanced analytics', 'WhatsApp notifications', 'Multi-clinic support', 'Priority support', 'Billing & invoicing'],
  enterprise:   ['Everything in Professional', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee', 'Advanced security'],
};

class SubApiService extends BaseApiService {
  async getSubscription() {
    try {
      const h = await this.getAuthHeaders();
      const r = await this.fetchWithTimeout(`${this.baseURL}/subscriptions`, { headers: h });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
}

const subApi = new SubApiService();

interface SubscriptionScreenProps {
  navigation: any;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sub, setSub] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadSub();
    }, [])
  );

  const loadSub = async () => {
    setLoading(true);
    const data = await subApi.getSubscription();
    setSub(data);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); loadSub(); };

  const plan = sub?.plan_name || 'free';
  const meta = PLAN_META[plan] || PLAN_META.free;
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.free;
  const isFree = plan === 'free';
  const days = daysUntil(sub?.current_end);
  const status = sub?.status || 'active';

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      active:    { bg: '#D1FAE5', text: '#065F46', label: 'Active' },
      cancelled: { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
      paused:    { bg: '#FEF3C7', text: '#92400E', label: 'Paused' },
      expired:   { bg: '#F3F4F6', text: '#374151', label: 'Expired' },
    };
    const c = map[status] || map.active;
    return (
      <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{c.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <ScreenHeader title="Subscription" onBackPress={() => navigation.goBack()} variant="admin" />
        <View style={s.center}><ActivityIndicator size="large" color={adminColors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScreenHeader title="Subscription" onBackPress={() => navigation.goBack()} variant="admin" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />}
      >
        {/* Plan Hero Card */}
        <LinearGradient colors={meta.gradient} style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.planIconWrap}>
              <meta.Icon size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.planLabel}>{meta.label} Plan</Text>
              <Text style={s.planSub}>{isFree ? 'Free forever · No payment needed' : `via ${sub?.provider || 'MolarPlus'}`}</Text>
            </View>
            <StatusBadge status={status} />
          </View>

          {/* Billing Period */}
          {!isFree && (sub?.current_start || sub?.current_end) && (
            <View style={s.billingRow}>
              <View style={s.billingItem}>
                <Calendar size={13} color="rgba(255,255,255,0.7)" />
                <View>
                  <Text style={s.billingItemLabel}>Started</Text>
                  <Text style={s.billingItemValue}>{fmtDate(sub?.current_start)}</Text>
                </View>
              </View>
              <View style={s.billingDivider} />
              <View style={s.billingItem}>
                <Clock size={13} color="rgba(255,255,255,0.7)" />
                <View>
                  <Text style={s.billingItemLabel}>
                    {days !== null && days > 0 ? 'Renews in' : 'Expires'}
                  </Text>
                  <Text style={[s.billingItemValue, days !== null && days <= 7 && days > 0 && { color: '#FCD34D' }]}>
                    {days !== null
                      ? (days > 0 ? `${days} days` : (days === 0 ? 'Today' : 'Expired'))
                      : fmtDate(sub?.current_end)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Features */}
        <Text style={s.sectionTitle}>WHAT'S INCLUDED</Text>
        <View style={s.card}>
          {features.map((f, i) => (
            <View key={i} style={[s.featureRow, i < features.length - 1 && s.featureRowBorder]}>
              <CheckCircle2 size={16} color={adminColors.primary} />
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Upgrade / Manage CTA */}
        {isFree ? (
          <>
            <Text style={s.sectionTitle}>UPGRADE YOUR PLAN</Text>
            <TouchableOpacity style={s.upgradeCta} onPress={() => navigation.navigate('Purchase')} activeOpacity={0.85}>
              <LinearGradient colors={['#1F6B72', '#2D9596']} style={s.upgradeGradient}>
                <View style={s.upgradeLeft}>
                  <Award size={22} color="#fff" />
                  <View>
                    <Text style={s.upgradeTitle}>Go Professional</Text>
                    <Text style={s.upgradePrice}>₹1,200 / month</Text>
                  </View>
                </View>
                <ArrowRight size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.sectionTitle}>MANAGE</Text>
            <View style={s.card}>
              {sub?.provider_subscription_id && (
                <View style={s.manageRow}>
                  <CreditCard size={16} color="#6B7280" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.manageLabel}>Subscription ID</Text>
                    <Text style={s.manageValue} numberOfLines={1}>{sub.provider_subscription_id}</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={s.refreshBtn}
                onPress={onRefresh}
                activeOpacity={0.75}
              >
                <RefreshCw size={15} color={adminColors.primary} />
                <Text style={s.refreshBtnText}>Refresh Subscription Status</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F9FAFB' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard:      { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 20 },
  heroTop:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  planIconWrap:  { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' },
  planLabel:     { fontSize: 20, fontWeight: '800', color: '#fff' },
  planSub:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  billingRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, gap: 12 },
  billingItem:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  billingDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  billingItemLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  billingItemValue: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 1 },

  sectionTitle:  { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },

  card:          { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  featureText:   { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },

  upgradeCta:    { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  upgradeGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  upgradeLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeTitle:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  upgradePrice:  { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  manageRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  manageLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  manageValue:   { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 1 },
  refreshBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13, justifyContent: 'center' },
  refreshBtnText:{ fontSize: 14, fontWeight: '600', color: adminColors.primary },
});
