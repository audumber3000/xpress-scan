import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, Calendar, Clock, Building2, Star, ChevronRight } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { colors } from '../../../../shared/constants/theme';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { WhatsAppIcon } from '../../../../shared/components/icons/WhatsAppIcon';
import { BaseApiService } from '../../../../services/api/base.api';
import { useAuth } from '../../../../app/AuthContext';
import { IS_PLAN_PRICING_VISIBLE, MARKETING_SITE_TEXT } from '../../../../shared/constants/platform';
import { SUPPORT_PHONE_RAW } from '../../../../shared/constants/support';
import { planBadge } from '../../../../shared/utils/planBadge';
import { PlanDetailSheet } from '../components/PlanDetailSheet';
import {
  PLANS, PLAN_ORDER, INCLUDED_IN_EVERY_PLAN, resolvePlan, planLabel,
  billingCurrency, formatPrice, monthlyEquivalent, annualSavingPercent, PlanKey,
} from '../../../../shared/constants/plans';

/**
 * What plan this clinic is on, and what the plans are.
 *
 * Read-only by design. Subscriptions are bought on the website on BOTH
 * platforms (`IS_PURCHASE_UI_ENABLED`), so there is no plan selection, no promo
 * code field and no checkout here — see `shared/constants/platform.ts` for why
 * that is one rule rather than an iOS carve-out.
 *
 * The screen this replaces argued a free-vs-professional model that no longer
 * exists: it read `PLAN_META['free']`, so a Plus clinic was shown "Free" in a
 * grey gradient, and it offered an Upgrade button into a native checkout that
 * sold a plan the catalogue no longer contains.
 *
 * ## The current plan is `effective_plan`
 *
 * Not `plan_name`, and not `clinics.subscription_plan`. Those say what the
 * clinic last bought; `effective_plan` says what it can use today, and after an
 * expiry they differ. That exact mismatch is what had the web header showing
 * Plus while the page under it showed Pro.
 */

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

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

interface SubscriptionScreenProps {
  navigation: any;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const clinic = backendUser?.clinic;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sub, setSub] = useState<any>(null);
  // Which plan's detail sheet is open. Null means none.
  const [openPlan, setOpenPlan] = useState<PlanKey | null>(null);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    setSub(await subApi.getSubscription());
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Prices are only ever quoted in the clinic's own billing currency. An Indian
  // clinic must never be shown a dollar figure — the catalogue holds both, and
  // this is the only place that chooses.
  const currency = billingCurrency(clinic?.country);

  const currentName = clinic?.effective_plan || clinic?.subscription_plan || sub?.plan_name;
  const current = resolvePlan(currentName);
  const badge = planBadge(clinic);
  const clinicName = clinic?.name || 'My Clinic';

  const endsAt = clinic?.plan_ends_at || sub?.current_end || null;
  const left = daysUntil(endsAt);

  const openSupport = () => {
    const text = encodeURIComponent(
      [
        'Hi MolarPlus support, I have a question about my plan.',
        `Clinic: ${clinicName}`,
        `Plan: ${planLabel(currentName)}`,
      ].join('\n')
    );
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE_RAW}?text=${text}`).catch(() => {});
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminColors.primary} />
        }
      >
        {/* ── Current plan ── */}
        <View style={s.hero}>
          <View style={s.clinicRow}>
            <Building2 size={13} color={colors.gray500} />
            <Text style={s.clinicName} numberOfLines={1}>{clinicName}</Text>
          </View>

          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.planLabel}>{PLANS[current.key].label}</Text>
              <Text style={s.planTagline}>{PLANS[current.key].tagline}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Only shown when there is genuinely a date. A row reading "—" tells
              nobody anything and makes a healthy plan look unfinished. */}
          {(sub?.current_start || endsAt) && (
            <View style={s.dates}>
              {!!sub?.current_start && (
                <View style={s.dateItem}>
                  <Calendar size={13} color={colors.gray500} />
                  <View>
                    <Text style={s.dateLabel}>Started</Text>
                    <Text style={s.dateValue}>{fmtDate(sub.current_start)}</Text>
                  </View>
                </View>
              )}
              {!!endsAt && (
                <View style={s.dateItem}>
                  <Clock size={13} color={colors.gray500} />
                  <View>
                    <Text style={s.dateLabel}>
                      {left !== null && left > 0 ? 'Renews on' : 'Ended'}
                    </Text>
                    <Text style={[s.dateValue, left !== null && left <= 3 && { color: '#B45309' }]}>
                      {fmtDate(endsAt)}
                      {left !== null && left > 0 ? ` · ${left}d left` : ''}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── What this clinic has ── */}
        <Text style={s.sectionTitle}>WHAT YOUR PLAN INCLUDES</Text>
        <View style={s.card}>
          {PLANS[current.key].features.map((f, i) => (
            <View key={i} style={[s.featureRow, i > 0 && s.rowBorder]}>
              <CheckCircle2 size={16} color={adminColors.primary} />
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* ── The catalogue. Android only: a price list for plans that cannot be
             bought in the app reads as steering to an external purchase, which
             is the App Store line. iOS stops at its own plan, above. ── */}
        {IS_PLAN_PRICING_VISIBLE && (
          <>
            <Text style={s.sectionTitle}>ALL PLANS</Text>
            {PLAN_ORDER.map((key) => {
              const p = PLANS[key];
              const isCurrent = key === current.key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.planCard, isCurrent && { borderColor: adminColors.primary, borderWidth: 1.5 }]}
                  onPress={() => setOpenPlan(key)}
                  activeOpacity={0.75}
                >
                  <View style={s.planCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={s.planNameRow}>
                        <Text style={s.planCardName}>{p.label}</Text>
                        {p.popular && !isCurrent && (
                          <View style={s.popular}>
                            <Star size={9} color="#92400E" fill="#92400E" />
                            <Text style={s.popularText}>POPULAR</Text>
                          </View>
                        )}
                        {isCurrent && (
                          <View style={s.currentPill}>
                            <Text style={s.currentPillText}>YOUR PLAN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.planCardTagline}>{p.tagline}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.price}>{formatPrice(p.price[currency].monthly, currency)}</Text>
                      <Text style={s.priceUnit}>per month</Text>
                    </View>
                  </View>

                  <View style={s.planFeatures}>
                    {p.features.map((f, i) => (
                      <View key={i} style={s.planFeatureRow}>
                        <CheckCircle2 size={13} color={adminColors.primary} />
                        <Text style={s.planFeatureText}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {/* The yearly option, quoted per month.
                      This used to read "₹14,400 a year if you pay yearly",
                      which is the number people flinch at: it sits next to a
                      ₹1,500 monthly price and reads as ten times dearer until
                      you divide it yourself. Leading with ₹1,200 a month makes
                      the comparison the right way round, and the exact amount
                      that gets charged is on the line underneath so the
                      rounding hides nothing. */}
                  <View style={s.cardFooter}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.annualLead}>
                        or {formatPrice(monthlyEquivalent(key, currency), currency)} a month,
                        paid yearly
                      </Text>
                      <Text style={s.annualSub}>
                        {formatPrice(p.price[currency].annual, currency)} billed once a year.
                        You save {annualSavingPercent(key, currency)}%.
                      </Text>
                    </View>

                    {/* Says what tapping does. A price that opens something has
                        to admit it, or the tap reads as a buy button that
                        silently failed. */}
                    <View style={s.howRow}>
                      <Text style={s.howText}>
                        {isCurrent ? 'How to manage' : 'How to switch'}
                      </Text>
                      <ChevronRight size={13} color={adminColors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={s.sectionTitle}>IN EVERY PLAN</Text>
            <View style={s.card}>
              {INCLUDED_IN_EVERY_PLAN.map((f, i) => (
                <View key={i} style={[s.featureRow, i > 0 && s.rowBorder]}>
                  <CheckCircle2 size={16} color={adminColors.primary} />
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── How to change it ──
             `molarplus.com` is plain text: not a link, not a button, nothing
             tappable, on either platform. Naming the site is a statement of
             fact; making it tappable is a call to action steering to an
             external purchase. ── */}
        <Text style={s.sectionTitle}>CHANGING YOUR PLAN</Text>
        <View style={s.card}>
          <View style={s.manageBody}>
            <Text style={s.manageText}>
              Plans are chosen and paid for on the MolarPlus website. Sign in at{' '}
              {MARKETING_SITE_TEXT} from any browser, open Settings and then
              Subscription, and pick the one you want. It applies to this app straight away.
            </Text>
            <Text style={s.manageHint}>
              Prefer someone to walk you through it? Message us and we will sort it out with you.
            </Text>
          </View>

          <TouchableOpacity style={s.supportBtn} onPress={openSupport} activeOpacity={0.85}>
            <WhatsAppIcon size={18} />
            <Text style={s.supportText}>Message support on WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PlanDetailSheet
        planKey={openPlan}
        currency={currency}
        isCurrent={openPlan === current.key}
        clinicName={clinicName}
        onClose={() => setOpenPlan(null)}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E5E7EB',
  },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  clinicName: { fontSize: 12, color: colors.gray500, fontWeight: '600', flex: 1 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planLabel: { fontSize: 24, fontWeight: '800', color: '#111827', letterSpacing: -0.4 },
  planTagline: { fontSize: 12, color: colors.gray500, marginTop: 3, lineHeight: 18 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  dates: {
    flexDirection: 'row', gap: 14, marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  dateItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  dateValue: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 1 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1,
    paddingHorizontal: 20, marginTop: 24, marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16,
    paddingVertical: 4, borderWidth: 1, borderColor: '#E5E7EB',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  featureText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },

  planCard: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  planCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planCardName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  planCardTagline: { fontSize: 12, color: colors.gray500, marginTop: 3, lineHeight: 17 },
  popular: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  popularText: { fontSize: 8, fontWeight: '800', color: '#92400E', letterSpacing: 0.4 },
  currentPill: { backgroundColor: adminColors.primary, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 5 },
  currentPillText: { fontSize: 8, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
  price: { fontSize: 20, fontWeight: '800', color: '#111827' },
  priceUnit: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  planFeatures: { marginTop: 14, gap: 8 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  planFeatureText: { fontSize: 12.5, color: '#4B5563', flex: 1, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  annualLead: { fontSize: 12, color: '#374151', fontWeight: '700', lineHeight: 17 },
  annualSub: { fontSize: 10.5, color: '#9CA3AF', fontWeight: '600', lineHeight: 15, marginTop: 1 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  howText: { fontSize: 11.5, fontWeight: '800', color: adminColors.primary },

  manageBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 10 },
  manageText: { fontSize: 13, color: '#374151', lineHeight: 20, fontWeight: '500' },
  manageHint: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginHorizontal: 12, marginTop: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 13,
  },
  supportText: { fontSize: 14, fontWeight: '700', color: '#111827' },
});
