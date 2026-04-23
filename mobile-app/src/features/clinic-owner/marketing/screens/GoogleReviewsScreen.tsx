import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, RefreshCw, Search, MapPin, CheckCircle2 } from 'lucide-react-native';
import Svg, { Path, Rect, Line, G } from 'react-native-svg';
import { colors } from '../../../../shared/constants/colors';
import { GearLoader } from '../../../../shared/components/GearLoader';
import {
  googleReviewsApiService,
  GooglePlaceStatus,
  GoogleReview,
  ReviewsResponse,
  Competitor,
  CompetitorsResponse,
} from '../../../../services/api/google-reviews.api';

// ─── Google G logo ────────────────────────────────────────────────────────────
const GoogleGLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
    <Path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
    <Path fill="#FBBC04" d="M24 46c5.5 0 10.6-1.9 14.6-5.1l-6.8-5.5C29.8 37.1 27 38 24 38c-5.5 0-10.2-3.6-11.8-8.7l-7 5.4C8.5 41.9 15.7 46 24 46z"/>
    <Path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.4-2.4 4.5-4.6 5.9l6.8 5.5C43 36.2 46 30.8 46 24c0-1.3-.2-2.7-.5-4z"/>
  </Svg>
);

// ─── Not-linked illustration ───────────────────────────────────────────────────
const NotLinkedIllustration: React.FC = () => (
  <Svg width={120} height={100} viewBox="0 0 120 100">
    {/* Phone-ish frame */}
    <Rect x="30" y="8" width="60" height="80" rx="10" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="2" />
    {/* Screen */}
    <Rect x="38" y="20" width="44" height="52" rx="4" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
    {/* Google G centered on screen */}
    <G transform="translate(47, 29) scale(0.54)">
      <Path fill="#D1D5DB" d="M44.5 20H24v8.5h11.7C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
    </G>
    {/* Broken link chain */}
    <G transform="translate(43, 60)">
      <Rect x="0" y="0" width="10" height="6" rx="3" fill="none" stroke="#9CA3AF" strokeWidth="1.5" />
      <Line x1="10" y1="3" x2="14" y2="3" stroke="#D1D5DB" strokeWidth="1.5" strokeDasharray="2 2" />
      <Rect x="14" y="0" width="10" height="6" rx="3" fill="none" stroke="#9CA3AF" strokeWidth="1.5" />
    </G>
    {/* Bottom home bar */}
    <Rect x="52" y="88" width="16" height="3" rx="1.5" fill="#D1D5DB" />
  </Svg>
);

// ─── Star renderer ─────────────────────────────────────────────────────────────
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <Path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={filled ? '#FBBF24' : '#E5E7EB'}
              stroke={filled ? '#F59E0B' : '#D1D5DB'}
              strokeWidth="1"
            />
          </Svg>
        );
      })}
    </View>
  );
}

// ─── Rating bar (summary breakdown) ───────────────────────────────────────────
function RatingBar({ label, pct, count }: { label: string; pct: number; count: number }) {
  return (
    <View style={s.ratingBarRow}>
      <Text style={s.ratingBarLabel}>{label}</Text>
      <View style={s.ratingBarTrack}>
        <View style={[s.ratingBarFill, { width: `${Math.max(pct, 2)}%` }]} />
      </View>
      <Text style={s.ratingBarCount}>{count}</Text>
    </View>
  );
}

// ─── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: GoogleReview }) {
  const initials = review.author_name?.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const date = review.review_time
    ? new Date(review.review_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={s.reviewCard}>
      <View style={s.reviewCardHeader}>
        <View style={s.reviewAvatar}>
          <Text style={s.reviewAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.reviewAuthor} numberOfLines={1}>{review.author_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <StarRow rating={review.rating} size={12} />
            {date ? <Text style={s.reviewDate}>{date}</Text> : null}
          </View>
        </View>
        <View style={[s.ratingBadge, { backgroundColor: review.rating >= 4 ? '#E6F9F1' : review.rating === 3 ? '#FFFBEB' : '#FEE2E2' }]}>
          <Text style={[s.ratingBadgeText, { color: review.rating >= 4 ? colors.success : review.rating === 3 ? colors.warning : colors.error }]}>
            {'★'.repeat(review.rating)}
          </Text>
        </View>
      </View>
      {!!review.text && (
        <Text style={s.reviewText} numberOfLines={4}>{review.text}</Text>
      )}
    </View>
  );
}

// ─── Competitor row ────────────────────────────────────────────────────────────
function CompetitorRow({ competitor, rank }: { competitor: Competitor; rank: number }) {
  const isUs = competitor.is_our_clinic;
  return (
    <View style={[s.competitorRow, isUs && s.competitorRowUs]}>
      <View style={[s.competitorRank, isUs && s.competitorRankUs]}>
        <Text style={[s.competitorRankText, isUs && s.competitorRankTextUs]}>#{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.competitorName, isUs && s.competitorNameUs]} numberOfLines={1}>
            {competitor.name}
          </Text>
          {isUs && (
            <View style={s.youBadge}>
              <Text style={s.youBadgeText}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={s.competitorAddress} numberOfLines={1}>{competitor.address}</Text>
        {competitor.badges && competitor.badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {competitor.badges.slice(0, 3).map((badge, i) => (
              <Text key={i} style={s.badge}>{badge}</Text>
            ))}
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="1" />
          </Svg>
          <Text style={s.competitorRating}>{competitor.rating?.toFixed(1)}</Text>
        </View>
        <Text style={s.competitorCount}>{competitor.review_count} reviews</Text>
        {typeof competitor.review_gap === 'number' && !isUs && competitor.review_gap > 0 && (
          <Text style={s.velocityText}>+{competitor.review_gap} ahead</Text>
        )}
      </View>
    </View>
  );
}

// ─── Link clinic panel ────────────────────────────────────────────────────────
function LinkClinicPanel({ onLinked }: { onLinked: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ place_id: string; name: string; address: string; description?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live autocomplete — fires 350ms after user stops typing (same as web debounce)
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await googleReviewsApiService.searchPlaces(text.trim());
      setResults(res);
      setSearching(false);
    }, 350);
  };

  const handleLink = async (placeId: string) => {
    setLinking(placeId);
    const ok = await googleReviewsApiService.linkPlace(placeId);
    if (ok) {
      setLinked(true);
      setTimeout(onLinked, 1400);
    } else {
      setLinking(null);
    }
  };

  if (linked) {
    return (
      <View style={s.notLinkedContainer}>
        <CheckCircle2 size={56} color={colors.success} strokeWidth={1.5} />
        <Text style={s.notLinkedTitle}>Clinic linked!</Text>
        <Text style={s.notLinkedSub}>Fetching your reviews now…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.linkPanel} keyboardShouldPersistTaps="handled">
        <NotLinkedIllustration />
        <Text style={s.notLinkedTitle}>Link your clinic to Google</Text>
        <Text style={s.notLinkedSub}>
          Type your clinic name to search Google Places. Suggestions appear automatically as you type.
        </Text>

        {/* Autocomplete search bar */}
        <View style={s.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Clinic name + city…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Live suggestions dropdown */}
        {results.length > 0 && (
          <View style={s.resultsList}>
            {results.map((r, idx) => (
              <TouchableOpacity
                key={r.place_id}
                style={[s.resultRow, idx === results.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleLink(r.place_id)}
                disabled={!!linking}
                activeOpacity={0.7}
              >
                <View style={s.resultIcon}>
                  <MapPin size={15} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.resultName}>{r.name}</Text>
                  <Text style={s.resultAddress} numberOfLines={1}>
                    {r.description || r.address}
                  </Text>
                </View>
                {linking === r.place_id
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <ChevronRight size={16} color={colors.gray300} />
                }
              </TouchableOpacity>
            ))}
          </View>
        )}

        {results.length === 0 && !searching && query.length >= 2 && (
          <Text style={s.noResults}>No results — try adding your city name</Text>
        )}

        <Text style={s.poweredBy}>Powered by Google Places</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export const GoogleReviewsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [status, setStatus] = useState<GooglePlaceStatus | null>(null);
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [competitorsData, setCompetitorsData] = useState<CompetitorsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'reviews' | 'competitors'>('reviews');
  const [competitorScope, setCompetitorScope] = useState<'5km' | 'city'>('5km');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = useCallback(async () => {
    const s = await googleReviewsApiService.getStatus();
    setStatus(s);
    return s;
  }, []);

  const loadReviews = useCallback(async (rating?: number) => {
    const data = await googleReviewsApiService.getReviews(1, 30, rating);
    setReviewsData(data);
  }, []);

  const loadCompetitors = useCallback(async (scope: '5km' | 'city') => {
    const data = await googleReviewsApiService.getCompetitors(scope);
    setCompetitorsData(data);
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    const s = await loadStatus();
    if (s.linked) {
      await Promise.all([loadReviews(), loadCompetitors('5km')]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { initialLoad(); }, []);

  useEffect(() => {
    if (!status?.linked) return;
    if (activeTab === 'competitors') {
      setTabLoading(true);
      loadCompetitors(competitorScope).finally(() => setTabLoading(false));
    }
  }, [competitorScope, activeTab]);

  useEffect(() => {
    if (!status?.linked || activeTab !== 'reviews') return;
    setTabLoading(true);
    loadReviews(ratingFilter).finally(() => setTabLoading(false));
  }, [ratingFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await initialLoad();
    setRefreshing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    await googleReviewsApiService.syncReviews();
    await initialLoad();
    setSyncing(false);
  };

  const handleTabChange = async (tab: 'reviews' | 'competitors') => {
    setActiveTab(tab);
    if (!status?.linked) return;
    setTabLoading(true);
    if (tab === 'reviews') await loadReviews(ratingFilter);
    else await loadCompetitors(competitorScope);
    setTabLoading(false);
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <Header navigation={navigation} onSync={handleSync} syncing={syncing} />
        <View style={s.center}><GearLoader text="Loading reviews..." /></View>
      </SafeAreaView>
    );
  }

  // ── Not linked ──
  if (!status?.linked) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <Header navigation={navigation} onSync={handleSync} syncing={syncing} />
        <LinkClinicPanel onLinked={initialLoad} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Header navigation={navigation} onSync={handleSync} syncing={syncing} />

      {/* Clinic status banner */}
      <View style={s.statusBanner}>
        <View style={s.googleLogoWrap}><GoogleGLogo size={28} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.bannerName} numberOfLines={1}>{status.place_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StarRow rating={status.current_rating ?? 0} size={13} />
            <Text style={s.bannerRating}>{status.current_rating?.toFixed(1)}</Text>
            <Text style={s.bannerCount}>• {status.total_review_count} reviews</Text>
          </View>
        </View>
        {reviewsData?.summary && (
          <View style={s.excellentBadge}>
            <Text style={s.excellentPct}>{reviewsData.summary.excellent_pct}%</Text>
            <Text style={s.excellentLabel}>Excellent</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {(['reviews', 'competitors'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabItem, activeTab === tab && s.tabItemActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'reviews' ? 'Reviews' : 'Competitors'}
            </Text>
            {activeTab === tab && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {tabLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {activeTab === 'reviews' ? (
            <ReviewsTab
              reviewsData={reviewsData}
              ratingFilter={ratingFilter}
              onFilterChange={setRatingFilter}
            />
          ) : (
            <CompetitorsTab
              competitorsData={competitorsData}
              scope={competitorScope}
              onScopeChange={setCompetitorScope}
            />
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Header sub-component ──────────────────────────────────────────────────────
function Header({ navigation, onSync, syncing }: { navigation: any; onSync: () => void; syncing: boolean }) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <ChevronLeft size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>Google Reviews</Text>
      <TouchableOpacity style={s.syncBtn} onPress={onSync} disabled={syncing}>
        {syncing
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <RefreshCw size={18} color="#FFFFFF" />
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────
function ReviewsTab({
  reviewsData,
  ratingFilter,
  onFilterChange,
}: {
  reviewsData: ReviewsResponse | null;
  ratingFilter: number | undefined;
  onFilterChange: (r: number | undefined) => void;
}) {
  const sum = reviewsData?.summary;

  return (
    <>
      {/* Summary breakdown */}
      {sum && (
        <View style={s.card}>
          <Text style={s.cardSectionTitle}>RATING BREAKDOWN</Text>
          <RatingBar label="Excellent (4-5★)" pct={sum.excellent_pct} count={sum.excellent} />
          <RatingBar label="Good (3★)" pct={sum.good_pct} count={sum.good} />
          <RatingBar label="Poor (1-2★)" pct={sum.bad_pct} count={sum.bad} />
        </View>
      )}

      {/* Rating filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {[undefined, 5, 4, 3, 2, 1].map((r) => (
          <TouchableOpacity
            key={r ?? 'all'}
            style={[s.filterPill, ratingFilter === r && s.filterPillActive]}
            onPress={() => onFilterChange(r)}
          >
            <Text style={[s.filterPillText, ratingFilter === r && s.filterPillTextActive]}>
              {r === undefined ? 'All' : `${r}★`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Review list */}
      {!reviewsData?.reviews?.length ? (
        <EmptyState icon="⭐" title="No reviews yet" subtitle="Reviews will appear here once synced from Google." />
      ) : (
        <View style={s.reviewList}>
          {reviewsData.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </View>
      )}
    </>
  );
}

// ─── Competitors tab ──────────────────────────────────────────────────────────
function CompetitorsTab({
  competitorsData,
  scope,
  onScopeChange,
}: {
  competitorsData: CompetitorsResponse | null;
  scope: '5km' | 'city';
  onScopeChange: (s: '5km' | 'city') => void;
}) {
  return (
    <>
      {/* Scope filter */}
      <View style={s.scopeRow}>
        {(['5km', 'city'] as const).map((sc) => (
          <TouchableOpacity
            key={sc}
            style={[s.scopePill, scope === sc && s.scopePillActive]}
            onPress={() => onScopeChange(sc)}
          >
            <Text style={[s.scopePillText, scope === sc && s.scopePillTextActive]}>
              {sc === '5km' ? '📍 5 km Radius' : '🏙 Entire City'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cache indicator */}
      {competitorsData?.from_cache && (
        <View style={s.cacheHint}>
          <Text style={s.cacheHintText}>
            📦 Cached — last synced {competitorsData.synced_at
              ? new Date(competitorsData.synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : ''}
          </Text>
        </View>
      )}

      {!competitorsData?.competitors?.length ? (
        <EmptyState icon="🏥" title="No competitors found" subtitle="We couldn't find any clinics in this area yet." />
      ) : (
        <View style={s.competitorList}>
          {competitorsData.competitors
            .map((c, i) => <CompetitorRow key={c.place_id} competitor={c} rank={i + 1} />)}
        </View>
      )}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{subtitle}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    height: 56,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  syncBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  googleLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  bannerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  bannerRating: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  bannerCount: { fontSize: 12, color: colors.textMuted },
  excellentBadge: { alignItems: 'center', backgroundColor: '#E6F9F1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  excellentPct: { fontSize: 18, fontWeight: '800', color: colors.success },
  excellentLabel: { fontSize: 9, fontWeight: '700', color: colors.success, letterSpacing: 0.5 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabItemActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, backgroundColor: colors.primary, borderRadius: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16 },

  // Rating breakdown card
  card: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  ratingBarLabel: { width: 110, fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  ratingBarTrack: { flex: 1, height: 8, backgroundColor: colors.gray100, borderRadius: 4, overflow: 'hidden' },
  ratingBarFill: { height: 8, backgroundColor: colors.success, borderRadius: 4 },
  ratingBarCount: { width: 24, fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },

  // Filter pills
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.gray100 },
  filterPillActive: { backgroundColor: colors.primaryBg },
  filterPillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterPillTextActive: { color: colors.primary },

  // Reviews
  reviewList: { paddingHorizontal: 16, gap: 10 },
  reviewCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  reviewDate: { fontSize: 11, color: colors.textMuted, marginLeft: 4 },
  reviewText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  ratingBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  ratingBadgeText: { fontSize: 10, fontWeight: '800' },

  // Scope filter
  scopeRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  scopePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  scopePillActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  scopePillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  scopePillTextActive: { color: colors.primary },

  // Cache hint
  cacheHint: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.warningBadgeBg,
    borderRadius: 8,
  },
  cacheHintText: { fontSize: 12, color: '#92400E', fontWeight: '500' },

  // Competitors
  competitorList: { paddingHorizontal: 16, gap: 8 },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  competitorRowUs: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBgLight,
  },
  competitorRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competitorRankUs: { backgroundColor: colors.primary },
  competitorRankText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  competitorRankTextUs: { color: '#FFFFFF' },
  competitorName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  competitorNameUs: { color: colors.primary },
  competitorAddress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  youBadge: { backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  youBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  badge: {
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  competitorRating: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  competitorCount: { fontSize: 11, color: colors.textMuted },
  velocityText: { fontSize: 11, color: colors.error, fontWeight: '600' },

  // Not linked
  notLinkedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  notLinkedTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  notLinkedSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  webHint: {
    backgroundColor: colors.primaryBgLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  webHintText: { fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'center' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

  // Link clinic panel
  linkPanel: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    width: '100%',
    marginTop: 20,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  searchBtn: { fontSize: 13, fontWeight: '700', color: colors.primary },
  resultsList: {
    width: '100%',
    marginTop: 14,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorColor,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  resultAddress: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  noResults: { fontSize: 13, color: colors.textMuted, marginTop: 16, textAlign: 'center' },
  poweredBy: { fontSize: 11, color: colors.gray300, marginTop: 20, textAlign: 'center' },
});
