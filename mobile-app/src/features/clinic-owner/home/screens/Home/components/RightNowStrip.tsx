import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CalendarClock, FileWarning, UserRoundCheck } from 'lucide-react-native';
import { colors } from '../../../../../../shared/constants/colors';
import { AppSkeleton } from '../../../../../../shared/components/Skeleton';
import { GoogleGLogo, StarRow } from '../../../../../../shared/components/home/GoogleBits';

interface RightNowStripProps {
  waitingCount: number;
  nextAppointmentTime?: string | null;
  unpaidInvoicesCount: number;
  reviewCount?: number | null;
  reviewsLinked?: boolean;
  reviewRating?: number | null;
  loading?: boolean;
  refreshing?: boolean;
  lastUpdatedAt?: Date | null;
  onWaitingPress?: () => void;
  onAppointmentsPress?: () => void;
  onInvoicesPress?: () => void;
  onReviewsPress?: () => void;
  onConnectReviewsPress?: () => void;
}

const formatLastUpdated = (date?: Date | null) => {
  if (!date) return 'Not updated yet';
  return `Updated ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const plural = (count: number, singular: string, pluralText = `${singular}s`) => {
  return count === 1 ? singular : pluralText;
};

const LiveItem: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
  loading?: boolean;
  onPress?: () => void;
}> = ({ icon, value, label, loading = false, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || loading}
      style={({ pressed }) => [
        styles.item,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.itemText}>
        {loading ? (
          <>
            <AppSkeleton width={54} height={17} radius={4} />
            <View style={{ height: 5 }} />
            <AppSkeleton width={82} height={12} radius={4} />
          </>
        ) : (
          <>
            <Text style={styles.itemValue} numberOfLines={1}>{value}</Text>
            <Text style={styles.itemLabel} numberOfLines={1}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

// Connection-aware Google reviews slot: rating + stars when linked, a dashed
// "Connect" CTA when the clinic hasn't linked its Google Business profile yet.
const ReviewsItem: React.FC<{
  linked: boolean;
  rating?: number | null;
  reviewCount: number;
  loading?: boolean;
  onPress?: () => void;
  onConnect?: () => void;
}> = ({ linked, rating, reviewCount, loading = false, onPress, onConnect }) => {
  if (loading) {
    return (
      <View style={styles.item}>
        <View style={styles.iconWrap}>
          <AppSkeleton width={20} height={20} radius={10} />
        </View>
        <View style={styles.itemText}>
          <AppSkeleton width={54} height={17} radius={4} />
          <View style={{ height: 5 }} />
          <AppSkeleton width={82} height={12} radius={4} />
        </View>
      </View>
    );
  }

  if (!linked) {
    return (
      <Pressable
        onPress={onConnect}
        disabled={!onConnect}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <View style={styles.connectBox}>
          <GoogleGLogo size={18} />
          <Text style={styles.connectText} numberOfLines={1}>Connect</Text>
          <Text style={styles.connectSubText} numberOfLines={1}>Google Reviews</Text>
        </View>
      </Pressable>
    );
  }

  const r = typeof rating === 'number' ? rating : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={styles.iconWrap}><GoogleGLogo size={18} /></View>
      <View style={styles.itemText}>
        <Text style={styles.itemValue} numberOfLines={1}>{r.toFixed(1)}</Text>
        <View style={styles.reviewStars}><StarRow rating={r} size={9} gap={1} /></View>
        <Text style={styles.itemLabel} numberOfLines={1}>{reviewCount} Google reviews</Text>
      </View>
    </Pressable>
  );
};

export const RightNowStrip: React.FC<RightNowStripProps> = ({
  waitingCount,
  nextAppointmentTime,
  unpaidInvoicesCount,
  reviewCount,
  reviewsLinked = false,
  reviewRating,
  loading = false,
  refreshing = false,
  lastUpdatedAt,
  onWaitingPress,
  onAppointmentsPress,
  onInvoicesPress,
  onReviewsPress,
  onConnectReviewsPress,
}) => {
  const reviews = typeof reviewCount === 'number' ? reviewCount : 0;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.liveDot, refreshing && styles.liveDotRefreshing]} />
          <Text style={styles.title}>Right Now</Text>
        </View>
        <Text style={styles.updatedText}>
          {refreshing ? 'Refreshing clinic data...' : formatLastUpdated(lastUpdatedAt)}
        </Text>
      </View>

      <View style={styles.strip}>
        <LiveItem
          icon={<UserRoundCheck size={18} color={colors.primary} strokeWidth={2.4} />}
          value={`${waitingCount}`}
          label={`${plural(waitingCount, 'patient')} waiting`}
          loading={loading}
          onPress={onWaitingPress}
        />
        <View style={styles.separator} />
        <LiveItem
          icon={<CalendarClock size={18} color={colors.primary} strokeWidth={2.4} />}
          value={nextAppointmentTime || 'None'}
          label="next appointment"
          loading={loading}
          onPress={onAppointmentsPress}
        />
        <View style={styles.separator} />
        <LiveItem
          icon={<FileWarning size={18} color="#F59E0B" strokeWidth={2.4} />}
          value={`${unpaidInvoicesCount}`}
          label={`${plural(unpaidInvoicesCount, 'invoice')} unpaid`}
          loading={loading}
          onPress={onInvoicesPress}
        />
        <View style={styles.separator} />
        <ReviewsItem
          linked={reviewsLinked}
          rating={reviewRating}
          reviewCount={reviews}
          loading={loading}
          onPress={onReviewsPress}
          onConnect={onConnectReviewsPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveDotRefreshing: {
    backgroundColor: colors.warning,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  updatedText: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
  },
  item: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    opacity: 0.65,
  },
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  itemText: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemValue: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reviewStars: {
    marginTop: 1,
    alignItems: 'center',
  },
  connectBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
  },
  connectText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  connectSubText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderColor,
    marginVertical: 8,
  },
});
