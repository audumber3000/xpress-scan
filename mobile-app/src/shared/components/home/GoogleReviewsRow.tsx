import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import type { GooglePlaceStatus } from '../../../services/api/google-reviews.api';

const GoogleGLogo: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
    <Path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
    <Path fill="#FBBC04" d="M24 46c5.5 0 10.6-1.9 14.6-5.1l-6.8-5.5C29.8 37.1 27 38 24 38c-5.5 0-10.2-3.6-11.8-8.7l-7 5.4C8.5 41.9 15.7 46 24 46z"/>
    <Path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.4-2.4 4.5-4.6 5.9l6.8 5.5C43 36.2 46 30.8 46 24c0-1.3-.2-2.7-.5-4z"/>
  </Svg>
);

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Svg key={i} width={13} height={13} viewBox="0 0 24 24">
          <Path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={i < Math.round(rating) ? '#FBBF24' : '#E5E7EB'}
            stroke={i < Math.round(rating) ? '#F59E0B' : '#D1D5DB'}
            strokeWidth="1"
          />
        </Svg>
      ))}
    </View>
  );
}

interface GoogleReviewsRowProps {
  status: GooglePlaceStatus | null;
  loading?: boolean;
  cityRank?: number | null;
  onPress: () => void;
}

export const GoogleReviewsRow: React.FC<GoogleReviewsRowProps> = ({
  status,
  loading = false,
  cityRank,
  onPress,
}) => {
  if (loading) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.card, { opacity: 0.4 }]}>
          <View style={styles.logoBox} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 14, width: '60%', backgroundColor: colors.gray200, borderRadius: 4 }} />
            <View style={{ height: 11, width: '40%', backgroundColor: colors.gray100, borderRadius: 4 }} />
          </View>
        </View>
      </View>
    );
  }

  const linked = status?.linked ?? false;

  return (
    <TouchableOpacity style={styles.wrapper} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, !linked && styles.cardUnlinked]}>
        {/* Google G logo box */}
        <View style={styles.logoBox}>
          <GoogleGLogo size={30} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          {linked ? (
            <>
              <Text style={styles.clinicName} numberOfLines={1}>
                {status?.place_name ?? 'My Clinic'}
              </Text>
              <View style={styles.starsRow}>
                <StarRow rating={status?.current_rating ?? 0} />
                <Text style={styles.ratingNum}>{status?.current_rating?.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>· {status?.total_review_count} reviews</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.clinicName}>Google Reviews</Text>
              <Text style={styles.linkHint}>Tap to link your clinic →</Text>
            </>
          )}
        </View>

        {linked && cityRank != null ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{cityRank}</Text>
            <Text style={styles.rankLabel}>city</Text>
          </View>
        ) : (
          <ChevronRight size={16} color={colors.gray400} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  cardUnlinked: {
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
  },
  logoBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  clinicName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  linkHint: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  rankBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 16,
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
