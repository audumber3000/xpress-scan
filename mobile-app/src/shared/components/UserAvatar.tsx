import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { generateAvatarUrl } from '../utils/avatar';
import { getInitials } from '../utils/initials';
import { colors } from '../constants/colors';

interface UserAvatarProps {
  size: number;
  /** Firebase photoURL (Google / Apple sign-in profile picture) */
  photoURL?: string | null;
  /** Deterministic seed for DiceBear fallback — usually the user's email */
  seed?: string | null;
  /** Display name used to render initials behind the SVG until it loads */
  name?: string | null;
  /** Optional override for the initials-fallback background colour */
  fallbackBg?: string;
  /** Optional override for the initials-fallback text colour */
  fallbackColor?: string;
  /** Outer wrapper style (border, margin, etc.) */
  style?: any;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  size,
  photoURL,
  seed,
  name,
  fallbackBg = colors.primarySubtle,
  fallbackColor = colors.primary,
  style,
}) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [svgFailed, setSvgFailed] = useState(false);

  const initials = getInitials(name, 'DR');
  const initialsFontSize = Math.round(size * 0.4);

  const wrapperStyle = [
    styles.wrapper,
    { width: size, height: size, borderRadius: size / 2, backgroundColor: fallbackBg },
    style,
  ];

  // Initials sit underneath so the avatar circle is never empty mid-load
  const initialsLayer = (
    <Text style={[styles.initials, { color: fallbackColor, fontSize: initialsFontSize }]}>
      {initials}
    </Text>
  );

  if (photoURL && !photoFailed) {
    return (
      <View style={wrapperStyle}>
        {initialsLayer}
        <Image
          source={{ uri: photoURL }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          onError={() => setPhotoFailed(true)}
        />
      </View>
    );
  }

  if (seed && !svgFailed) {
    return (
      <View style={wrapperStyle}>
        {initialsLayer}
        <View style={[StyleSheet.absoluteFill, styles.svgWrap]}>
          <SvgUri
            uri={generateAvatarUrl(seed, size)}
            width={size}
            height={size}
            onError={() => setSvgFailed(true)}
          />
        </View>
      </View>
    );
  }

  return <View style={wrapperStyle}>{initialsLayer}</View>;
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  svgWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
