import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Multicolor Google "G" logo. */
export const GoogleGLogo: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
    <Path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 6 1.1 8.1 3l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
    <Path fill="#FBBC04" d="M24 46c5.5 0 10.6-1.9 14.6-5.1l-6.8-5.5C29.8 37.1 27 38 24 38c-5.5 0-10.2-3.6-11.8-8.7l-7 5.4C8.5 41.9 15.7 46 24 46z"/>
    <Path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.4-2.4 4.5-4.6 5.9l6.8 5.5C43 36.2 46 30.8 46 24c0-1.3-.2-2.7-.5-4z"/>
  </Svg>
);

/** Row of 5 stars filled to `rating` (gold), with adjustable size. */
export const StarRow: React.FC<{ rating: number; size?: number; gap?: number }> = ({
  rating,
  size = 13,
  gap = 2,
}) => (
  <View style={{ flexDirection: 'row', gap }}>
    {Array.from({ length: 5 }, (_, i) => (
      <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
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
