import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, LayoutChangeEvent, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Text as SvgText } from 'react-native-svg';
import { LocateFixed } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { attendanceApiService } from '../../../../services/api/attendance.api';
import { Fix } from '../../../../shared/utils/location';

/**
 * The clinic's geofence, and where you are standing against it.
 *
 * Real streets when we can get them: the server draws the clinic pin, the fence
 * and your position onto a Google map and sends back one picture. It is served
 * by our own endpoint because the Google key must not ship inside the app.
 *
 * When that is unavailable, and until it arrives, the component draws the same
 * three things itself. That fallback is not a placeholder to be deleted: it is
 * what a staff member sees in a basement with no signal, and it still answers
 * the only question the screen asks, which is whether they are inside the
 * circle and if not, how far and which way.
 *
 * The drawn dot is placed by the real bearing and distance from the clinic pin,
 * to scale with the fence. Somebody further out than the frame shows sits on
 * its edge in the right direction, rather than vanishing off it.
 */

export interface GeofenceMapProps {
  variant: 'hero' | 'card';
  hasFence: boolean;
  radiusM: number;
  /** Metres from the clinic pin, or null before the first fix. */
  distanceM: number | null;
  /** Compass bearing from the pin to you, or null before the first fix. */
  bearingDeg: number | null;
  inside: boolean | null;
  locating?: boolean;
  onLocate?: () => void;
  /** Laid over the top-left corner, e.g. a status chip. */
  overlay?: React.ReactNode;
  style?: any;
  /** Where the phone thinks it is, so the real map can mark it. */
  fix?: Fix | null;
}

// The fence and your dot are drawn in the app's brand navy; amber is kept for
// the one thing that is not brand, being outside the zone.
const NAVY = colors.primary;
const NAVY_DARK = colors.primaryDark;
const AMBER = '#D97706';

export const GeofenceMap: React.FC<GeofenceMapProps> = ({
  variant, hasFence, radiusM, distanceM, bearingDeg, inside, locating, onLocate, overlay, style, fix,
}) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // The real map, once the server has one for us.
  const [map, setMap] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  // Rounded, so drifting a few metres on a park bench does not fetch a new map
  // every second. Roughly 10 m, which is finer than the pin is drawn anyway.
  const fixKey = fix ? `${fix.latitude.toFixed(4)},${fix.longitude.toFixed(4)}` : '';

  useEffect(() => {
    if (!hasFence || mapFailed || !size.w) return;
    let alive = true;
    attendanceApiService
      .mapSource(fix || null, size.w, size.h)
      .then((source) => { if (alive) setMap(source); })
      .catch(() => { if (alive) setMapFailed(true); });
    return () => { alive = false; };
  }, [hasFence, mapFailed, size.w, size.h, fixKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const showDrawing = !mapReady;

  const hero = variant === 'hero';
  const { w, h } = size;
  const cx = w / 2;
  // The card carries a status chip across its top edge, so its circle sits a
  // little lower and smaller than the hero's, clear of the chip.
  const cy = hero ? h / 2 : h / 2 + 14;
  const fenceR = Math.min(w, h) * (hero ? 0.3 : 0.28);
  const edge = Math.min(w, h) / 2 - 14;

  // Where the person is, to scale with the fence and clamped to the frame.
  let you: { x: number; y: number } | null = null;
  if (hasFence && distanceM !== null && bearingDeg !== null && radiusM > 0) {
    const r = Math.min((distanceM / radiusM) * fenceR, edge);
    const a = (bearingDeg * Math.PI) / 180;
    you = { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  }
  const youColour = inside === false ? AMBER : NAVY;

  return (
    <View style={[hero ? styles.hero : styles.card, style]} onLayout={onLayout}>
      <LinearGradient
        colors={hero ? ['#FBF4DA', '#A9CFC9', '#7FB3B3', '#DCE7CB'] : ['#EEF1F3', '#DDE2E6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {!!map && !mapFailed && (
        <Image
          source={map}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoad={() => setMapReady(true)}
          // 404 when the clinic has no pin, 503 when the server has no key or
          // Google is unreachable. All three mean: draw it ourselves.
          onError={() => { setMapFailed(true); setMapReady(false); }}
        />
      )}

      {showDrawing && w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          {/* Contour lines: texture, not geography. */}
          {hero && [0.55, 0.8, 1.05, 1.3].map((k, i) => (
            <Ellipse
              key={i}
              cx={w * 0.72}
              cy={h * 0.18}
              rx={w * k}
              ry={h * k * 0.62}
              stroke="#FFFFFF"
              strokeOpacity={0.28}
              strokeWidth={1}
              fill="none"
            />
          ))}

          {hasFence && (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={fenceR}
                fill={hero ? NAVY : '#C9D0D5'}
                fillOpacity={hero ? 0.07 : 0.9}
                stroke={NAVY_DARK}
                strokeOpacity={0.85}
                strokeWidth={hero ? 1.5 : 2}
                strokeDasharray={hero ? '6 6' : undefined}
              />
              {/* The clinic pin */}
              <Circle cx={cx} cy={cy} r={hero ? 22 : 16} fill={NAVY_DARK} fillOpacity={0.12} />
              <Circle cx={cx} cy={cy} r={4} fill={NAVY_DARK} />
              <SvgText
                x={cx}
                y={cy + fenceR - 10}
                fontSize={11}
                fontWeight="600"
                fill={NAVY_DARK}
                fillOpacity={0.75}
                textAnchor="middle"
              >
                {`${radiusM} m`}
              </SvgText>
            </>
          )}

          {/* You */}
          {you && (
            <>
              <Circle cx={you.x} cy={you.y} r={16} fill={youColour} fillOpacity={0.18} />
              <Circle cx={you.x} cy={you.y} r={7} fill="#FFFFFF" stroke={youColour} strokeWidth={3} />
            </>
          )}
          {!hasFence && (
            <>
              <Circle cx={cx} cy={cy} r={22} fill={NAVY} fillOpacity={0.14} />
              <Circle cx={cx} cy={cy} r={7} fill="#FFFFFF" stroke={NAVY} strokeWidth={3} />
            </>
          )}
        </Svg>
      )}

      {!!overlay && <View style={styles.overlay}>{overlay}</View>}

      {onLocate && (
        <TouchableOpacity
          onPress={onLocate}
          disabled={locating}
          activeOpacity={0.8}
          style={[styles.locate, hero ? styles.locateHero : styles.locateCard]}
          accessibilityLabel="Find my location again"
        >
          {locating ? <ActivityIndicator size="small" color={NAVY} /> : <LocateFixed size={18} color="#1F2937" />}
        </TouchableOpacity>
      )}

      {hasFence && distanceM === null && !locating && (
        <View style={styles.hint}><Text style={styles.hintText}>Tap the target to find yourself</Text></View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { flex: 1, overflow: 'hidden' },
  card: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  overlay: { position: 'absolute', top: 12, left: 12 },
  locate: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locateHero: { top: 16, right: 16 },
  locateCard: { top: 10, right: 10 },
  hint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hintText: { fontSize: 11, color: '#374151', fontWeight: '600' },
});

export default GeofenceMap;
