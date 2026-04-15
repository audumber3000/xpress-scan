import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Calendar,
  TrendingUp,
  Bell,
  ArrowRight,
  Mail,
  MessageCircle,
  MessageSquare,
} from 'lucide-react-native';
import { RootStackParamList } from '../../../app/AppNavigator';

const { width: W, height: H } = Dimensions.get('window');
const ILLUS_H = H * 0.56;

export const ONBOARDING_KEY = '@molarplus:onboarding_v1';

export type OnboardingProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chip {
  label: string;
  top: number;
  left?: number;
  right?: number;
  dot: string;
}

interface Slide {
  id: string;
  gradient: [string, string, string];
  icon: React.ReactNode;
  dotColor: string;
  chips: Chip[];
  title: string;
  subtitle: string;
  notificationMode?: boolean;
}

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    id: '1',
    gradient: ['#1a1548', '#2E2A85', '#4a4694'],
    icon: <Calendar size={44} color="#2a276e" strokeWidth={1.5} />,
    dotColor: '#2a276e',
    chips: [
      { label: '9 AM · Root Canal',  top: ILLUS_H * 0.13, left: W * 0.05,  dot: '#4ade80' },
      { label: '12 Appts Today',     top: ILLUS_H * 0.37, right: W * 0.04, dot: '#60a5fa' },
      { label: 'Zero Conflicts',     top: ILLUS_H * 0.70, left: W * 0.15,  dot: '#fbbf24' },
    ],
    title: 'Smart\nScheduling',
    subtitle:
      'Book and manage all your clinic appointments in seconds. Patients, timings, and treatments — perfectly organised.',
  },
  {
    id: '2',
    gradient: ['#1a1548', '#2E2A85', '#4a4694'],
    icon: <TrendingUp size={44} color="#2a276e" strokeWidth={1.5} />,
    dotColor: '#2a276e',
    chips: [
      { label: '₹ 48,500 Today',    top: ILLUS_H * 0.12, right: W * 0.06, dot: '#4ade80' },
      { label: '+18% This Month',   top: ILLUS_H * 0.39, left: W * 0.04,  dot: '#a78bfa' },
      { label: '22 Invoices Done',  top: ILLUS_H * 0.68, right: W * 0.08, dot: '#fbbf24' },
    ],
    title: 'Know Your\nRevenue',
    subtitle:
      'Track payments, generate instant invoices, and get real-time financial insights — straight from your pocket.',
  },
  {
    id: '3',
    gradient: ['#1a1548', '#2E2A85', '#4a4694'],
    icon: <Bell size={40} color="#2a276e" strokeWidth={1.5} />,
    dotColor: '#2a276e',
    notificationMode: true,
    chips: [
      { label: 'Hi Priya! Appt tomorrow at 10 AM', top: ILLUS_H * 0.07,  right: W * 0.03, dot: '#25D366' },
      { label: 'Reminder: Your visit is today',     top: ILLUS_H * 0.68,  right: W * 0.04, dot: '#EA4335' },
      { label: 'Confirmed: Slot at 10 AM ✓',        top: ILLUS_H * 0.78,  left: W * 0.04,  dot: '#3b82f6' },
    ],
    title: 'Auto\nReminders',
    subtitle:
      'Send appointment reminders via WhatsApp, Email, and SMS automatically — zero manual effort.',
  },
];

// ─── Default illustration (rings + single centre icon) ────────────────────────

const DECORATIVE_DOTS = [
  { x: W * 0.08, y: ILLUS_H * 0.08, s: 5, o: 0.25 },
  { x: W * 0.88, y: ILLUS_H * 0.15, s: 4, o: 0.18 },
  { x: W * 0.06, y: ILLUS_H * 0.82, s: 6, o: 0.20 },
  { x: W * 0.92, y: ILLUS_H * 0.78, s: 4, o: 0.15 },
  { x: W * 0.52, y: ILLUS_H * 0.06, s: 5, o: 0.22 },
  { x: W * 0.75, y: ILLUS_H * 0.91, s: 3, o: 0.18 },
];

function FloatingChips({ chips }: { chips: Chip[] }) {
  return (
    <>
      {chips.map((chip, i) => (
        <View
          key={`chip-${i}`}
          style={{
            position: 'absolute',
            top: chip.top,
            left: chip.left,
            right: chip.right,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderRadius: 22,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            gap: 8,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: chip.dot }} />
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '600' }}>
            {chip.label}
          </Text>
        </View>
      ))}
    </>
  );
}

function ScatteredDots() {
  return (
    <>
      {DECORATIVE_DOTS.map((d, i) => (
        <View
          key={`decot-${i}`}
          style={{
            position: 'absolute',
            width: d.s,
            height: d.s,
            borderRadius: d.s / 2,
            backgroundColor: `rgba(255,255,255,${d.o})`,
            top: d.y,
            left: d.x,
          }}
        />
      ))}
    </>
  );
}

const DefaultIllustration: React.FC<{ slide: Slide }> = ({ slide }) => {
  const cx = W / 2;
  const cy = ILLUS_H * 0.48;

  return (
    <View style={{ width: W, height: ILLUS_H, overflow: 'hidden' }}>
      {[260, 196, 132].map((size, i) => (
        <View
          key={`ring-${i}`}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${0.07 + i * 0.06})`,
            top: cy - size / 2,
            left: cx - size / 2,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: 'rgba(255,255,255,0.96)',
          top: cy - 48,
          left: cx - 48,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        }}
      >
        {slide.icon}
      </View>
      <FloatingChips chips={slide.chips} />
      <ScatteredDots />
    </View>
  );
};

// ─── Notification illustration (WhatsApp / Gmail / SMS orbit) ─────────────────

// Platform badge positions: WhatsApp at top, Gmail bottom-right, SMS bottom-left
// Orbit radius 110, centre at (W/2, ILLUS_H * 0.45)
const CY_NOTIF = ILLUS_H * 0.45;
const ORBIT_R  = 110;
const SIN60    = Math.sin((60 * Math.PI) / 180); // 0.866
const COS60    = Math.cos((60 * Math.PI) / 180); // 0.5
const BADGE_R  = 28; // half of 56

const PLATFORMS = [
  {
    color: '#25D366',
    shadowColor: '#25D366',
    icon: <MessageCircle size={26} color="#fff" strokeWidth={2} />,
    label: 'WhatsApp',
    // top of screen
    top:  CY_NOTIF - ORBIT_R - BADGE_R,
    left: W / 2 - BADGE_R,
  },
  {
    color: '#EA4335',
    shadowColor: '#EA4335',
    icon: <Mail size={26} color="#fff" strokeWidth={2} />,
    label: 'Gmail',
    // bottom-right
    top:  CY_NOTIF + ORBIT_R * SIN60 - BADGE_R,
    left: W / 2 + ORBIT_R * COS60 - BADGE_R,
  },
  {
    color: '#3b82f6',
    shadowColor: '#1d4ed8',
    icon: <MessageSquare size={26} color="#fff" strokeWidth={2} />,
    label: 'SMS',
    // bottom-left
    top:  CY_NOTIF + ORBIT_R * SIN60 - BADGE_R,
    left: W / 2 - ORBIT_R * COS60 - BADGE_R,
  },
];

const NotificationIllustration: React.FC<{ slide: Slide }> = ({ slide }) => {
  const cx = W / 2;

  return (
    <View style={{ width: W, height: ILLUS_H, overflow: 'hidden' }}>
      {/* Concentric rings */}
      {[260, 196, 132].map((size, i) => (
        <View
          key={`ring-${i}`}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${0.07 + i * 0.06})`,
            top: CY_NOTIF - size / 2,
            left: cx - size / 2,
          }}
        />
      ))}

      {/* Dashed connection lines from centre to each platform badge */}
      {PLATFORMS.map((p, i) => {
        const badgeCx = p.left + BADGE_R;
        const badgeCy = p.top  + BADGE_R;
        const dx = badgeCx - cx;
        const dy = badgeCy - CY_NOTIF;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              width: len - 38, // stop just before centre icon (r=38)
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.18)',
              top: CY_NOTIF,
              left: cx + 38,
              transformOrigin: 'left center',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* Centre bell */}
      <View
        style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(255,255,255,0.96)',
          top: CY_NOTIF - 40,
          left: cx - 40,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        }}
      >
        {slide.icon}
      </View>

      {/* Platform badges */}
      {PLATFORMS.map((p, i) => (
        <View key={`badge-${i}`}>
          {/* Outer glow ring */}
          <View
            style={{
              position: 'absolute',
              width: 68,
              height: 68,
              borderRadius: 34,
              backgroundColor: p.color,
              opacity: 0.2,
              top: p.top - 6,
              left: p.left - 6,
            }}
          />
          {/* Badge */}
          <View
            style={{
              position: 'absolute',
              width: BADGE_R * 2,
              height: BADGE_R * 2,
              borderRadius: BADGE_R,
              backgroundColor: p.color,
              top: p.top,
              left: p.left,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 8,
              shadowColor: p.shadowColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
            }}
          >
            {p.icon}
          </View>
          {/* Label below badge */}
          <Text
            style={{
              position: 'absolute',
              top: p.top + BADGE_R * 2 + 5,
              left: p.left + BADGE_R - 28,
              width: 56,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 10,
              fontWeight: '600',
            }}
          >
            {p.label}
          </Text>
        </View>
      ))}

      {/* Message chips */}
      <FloatingChips chips={slide.chips} />
      <ScatteredDots />
    </View>
  );
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const Illustration: React.FC<{ slide: Slide }> = ({ slide }) =>
  slide.notificationMode
    ? <NotificationIllustration slide={slide} />
    : <DefaultIllustration slide={slide} />;

// ─── Screen ───────────────────────────────────────────────────────────────────

export const OnboardingScreen: React.FC<OnboardingProps> = ({ navigation }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.replace('Login');
  };

  const goNext = () => {
    if (activeIdx < SLIDES.length - 1) {
      const next = activeIdx + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIdx(next);
    } else {
      finish();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIdx(viewableItems[0].index);
    }
  }).current;

  const isLast = activeIdx === SLIDES.length - 1;
  const slide  = SLIDES[activeIdx];

  return (
    <View style={s.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={{ width: W, height: ILLUS_H }}
          >
            <Illustration slide={item} />
          </LinearGradient>
        )}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        bounces={false}
        style={{ height: ILLUS_H, flexGrow: 0 }}
      />

      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={finish} activeOpacity={0.75}>
          <Text style={s.skipTxt}>Skip</Text>
        </TouchableOpacity>
      )}

      <View style={s.card}>
        <View>
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.subtitle}>{slide.subtitle}</Text>
        </View>

        <View style={s.footer}>
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  s.dot,
                  i === activeIdx
                    ? [s.dotActive, { backgroundColor: slide.dotColor }]
                    : s.dotOff,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: slide.gradient[1] }]}
            onPress={goNext}
            activeOpacity={0.82}
          >
            <Text style={s.btnTxt}>{isLast ? 'Get Started' : 'Next'}</Text>
            <ArrowRight size={17} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 58,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 10,
  },
  skipTxt: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: Platform.OS === 'android' ? 32 : 48,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 23,
    marginTop: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
  dotOff: {
    width: 8,
    backgroundColor: '#D1D5DB',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#1a1548',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  btnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
