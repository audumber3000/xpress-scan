import { Platform, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────
// PALETTE  (raw tokens — do not use directly in screens)
// ─────────────────────────────────────────────
const palette = {
  // Brand – Navy / Indigo
  navy50:  '#EEEDF8',
  navy100: '#CCCBE9',
  navy200: '#9997D4',
  navy300: '#6663BF',
  navy400: '#4a4694',   // primaryLight
  navy500: '#2E2A85',   // used in headers/screen
  navy600: '#2a276e',   // PRIMARY
  navy700: '#1a1548',   // primaryDark
  navyBg:  '#e8e7f5',   // primaryBg
  navyBgLight: '#f3f2f9', // primaryBgLight
  navySubtle: '#F3F4FE', // avatar bg, avatar border tint

  // Admin – Teal
  teal400: '#4AAEB5',
  teal500: '#2D9596',   // adminColors.primary
  teal600: '#1F6B6C',   // adminColors.primaryDark
  tealBg:  '#E0F2F2',   // adminColors.primaryLight

  // Semantic
  green400:  '#34D399',
  green500:  '#10B981',  // success
  greenBg:   '#D1FAE5',  // successLight
  greenBg2:  '#E6F9F1',  // badge bg for completed/success

  yellow400: '#FCD34D',
  yellow500: '#F59E0B',  // warning
  yellowBg:  '#FEF3C7',  // warningLight
  yellowBg2: '#FFFBEB',  // badge bg for pending

  red400:    '#F87171',
  red500:    '#EF4444',  // error
  redBg:     '#FEE2E2',  // errorLight
  redDark:   '#B91C1C',

  blue400:   '#60A5FA',
  blue500:   '#3B82F6',  // info
  blueBg:    '#DBEAFE',  // infoLight
  blueLight: '#E0F2FE',
  blueDark:  '#0369A1',

  // Greyscale
  white:     '#FFFFFF',
  black:     '#000000',
  gray50:    '#F9FAFB',  // screen bg
  gray100:   '#F3F4F6',  // separator, tag bg
  gray200:   '#E5E7EB',  // borders
  gray300:   '#D1D5DB',
  gray400:   '#9CA3AF',  // muted text, icons inactive
  gray500:   '#6B7280',  // subtitle, placeholder
  gray600:   '#4B5563',
  gray700:   '#374151',
  gray800:   '#1F2937',
  gray900:   '#111827',  // primary text

  // Module accent colors (admin hub)
  orange500:  '#FF8C42',  // attendance
  orangeBg:   '#FFF4E6',
  pink500:    '#FF6B9D',  // staff
  pinkBg:     '#FFE8F0',
  cyan400:    '#4ECDC4',  // treatments
  cyanBg:     '#E0F7F5',
  purple500:  '#6B7FFF',  // subscription
  purpleBg:   '#E8ECFF',
  amber400:   '#FFB84D',  // settings / late
  amberBg:    '#FFF8E6',
  sky400:     '#5DADE2',  // permissions
  skyBg:      '#E8F4F9',
};

// ─────────────────────────────────────────────
// SEMANTIC COLOR TOKENS  (use these in screens)
// ─────────────────────────────────────────────
export const colors = {
  // Brand
  primary:        palette.navy600,
  primaryLight:   palette.navy400,
  primaryDark:    palette.navy700,
  primaryBg:      palette.navyBg,
  primaryBgLight: palette.navyBgLight,
  primarySubtle:  palette.navySubtle,

  // Admin brand
  admin:          palette.teal500,
  adminLight:     palette.tealBg,
  adminDark:      palette.teal600,

  // Status
  success:        palette.green500,
  successLight:   palette.greenBg,
  successBadgeBg: palette.greenBg2,

  warning:        palette.yellow500,
  warningLight:   palette.yellowBg,
  warningBadgeBg: palette.yellowBg2,

  error:          palette.red500,
  errorLight:     palette.redBg,
  errorDark:      palette.redDark,

  info:           palette.blue500,
  infoLight:      palette.blueBg,
  infoDark:       palette.blueDark,
  infoFill:       palette.blueLight,

  // Text
  textPrimary:    palette.gray900,
  textSecondary:  palette.gray600,
  textMuted:      palette.gray400,
  textInverse:    palette.white,
  textLink:       palette.navy600,

  // Surfaces
  screenBg:       palette.gray50,
  cardBg:         palette.white,
  inputBg:        palette.gray50,
  separatorColor: palette.gray100,
  borderColor:    palette.gray200,

  // Tab / nav
  tabActive:      palette.navy600,
  tabInactive:    palette.gray400,

  // Neutrals re-export
  white: palette.white,
  black: palette.black,
  gray50: palette.gray50,
  gray100: palette.gray100,
  gray200: palette.gray200,
  gray300: palette.gray300,
  gray400: palette.gray400,
  gray500: palette.gray500,
  gray600: palette.gray600,
  gray700: palette.gray700,
  gray800: palette.gray800,
  gray900: palette.gray900,

  // Module accents (Admin Hub)
  attendance:   palette.orange500,
  attendanceBg: palette.orangeBg,
  staff:        palette.pink500,
  staffBg:      palette.pinkBg,
  treatments:   palette.cyan400,
  treatmentsBg: palette.cyanBg,
  subscription: palette.purple500,
  subscriptionBg: palette.purpleBg,
  settings:     palette.amber400,
  settingsBg:   palette.amberBg,
  permissions:  palette.sky400,
  permissionsBg: palette.skyBg,
} as const;

// ─────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────
export const typography = {
  // Size scale
  size: {
    xs:   9,   // badge labels, micro text
    sm:   11,  // secondary meta
    base: 13,  // subtitle / caption
    md:   14,  // tab labels, body text
    lg:   16,  // list item titles, body primary
    xl:   18,  // screen header title
    '2xl': 20, // push header (transactions), modal title
    '3xl': 24, // large stat values
    '4xl': 28, // hero numbers
  },

  // Weight
  weight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  lineHeight: {
    tight:  1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Letter spacing
  tracking: {
    tight:  -0.3,
    normal: 0,
    wide:   0.3,
    wider:  0.5,   // badge caps
    widest: 1.0,
  },
} as const;

// ─────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────
export const spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,   // standard horizontal padding
  5:  20,   // wide horizontal padding (transaction rows)
  6:  24,
  7:  28,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   12,
  xl:   16,
  '2xl': 20,
  '3xl': 24,
  pill:  999,  // fully rounded / circle
  // Screen-level header bottom curve
  headerBottom: 30,
} as const;

// ─────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────
export const shadows = {
  none: {},

  sm: Platform.select({
    ios: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
  }),

  md: Platform.select({
    ios: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  }),

  lg: Platform.select({
    ios: {
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),

  // Colored (e.g. FAB, primary buttons)
  brand: (color: string) => Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  }),
} as const;

// ─────────────────────────────────────────────
// ADMIN COLORS  (matches legacy adminColors.ts shape)
// ─────────────────────────────────────────────
export const adminColors = {
  primary:      palette.teal500,
  primaryLight: palette.tealBg,
  primaryDark:  palette.teal600,

  attendance:   palette.orange500,
  attendanceBg: palette.orangeBg,

  staff:    palette.pink500,
  staffBg:  palette.pinkBg,

  treatments:   palette.cyan400,
  treatmentsBg: palette.cyanBg,

  subscription:   palette.purple500,
  subscriptionBg: palette.purpleBg,

  settings:   palette.amber400,
  settingsBg: palette.amberBg,

  permissions:   palette.sky400,
  permissionsBg: palette.skyBg,

  present: palette.teal500,
  late:    palette.amber400,
  absent:  palette.red500,

  gradientStart: '#29828a',
  gradientEnd:   palette.teal600,
} as const;

// ─────────────────────────────────────────────
// COMPONENT TOKENS
// ─────────────────────────────────────────────

// — Header (Primary variant, curved bottom)
export const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingTop: 40,
    paddingBottom: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius:  radius.headerBottom,
    borderBottomRightRadius: radius.headerBottom,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.textInverse,
  },
  subtitle: {
    fontSize: typography.size.base,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// — Card
export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  separator: {
    height: 1,
    backgroundColor: colors.separatorColor,
    marginLeft: 82, // aligns with text after 50px avatar + 12px gap + 20px padding
  },
});

// — Tabs (underline style)
export const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorColor,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});

// — Avatar (initials circle)
export const avatarStyles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: spacing[3],
  },
  circle: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  // Small indicator badge (arrow / status dot on avatar)
  indicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// — Badge / Pill
export const badgeStyles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.wider,
  },
  // Preset variants
  success: { backgroundColor: colors.successBadgeBg },
  successText: { color: colors.success },
  warning: { backgroundColor: colors.warningBadgeBg },
  warningText: { color: colors.warning },
  error: { backgroundColor: colors.errorLight },
  errorText: { color: colors.errorDark },
  info: { backgroundColor: colors.infoFill },
  infoText: { color: colors.infoDark },
  primary: { backgroundColor: colors.primaryBgLight },
  primaryText: { color: colors.primary },
});

// — FAB (Floating Action Button)
export const fabStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 80,    // clears the tab bar (60 tab + 20 gap)
    right: spacing[5],
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
});

// — Search bar
export const searchStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorColor,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.size.md,
    color: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholder: {
    color: colors.textMuted,
  },
});

// — Empty state
export const emptyStateStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  text: {
    fontSize: typography.size.lg,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
});

// — Filter tabs (pill style)
export const filterTabStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  pill: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  pillActive: {
    backgroundColor: colors.primaryBg,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  pillTextActive: {
    color: colors.primary,
  },
});

// — Section header (inside scroll)
export const sectionStyles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },
});

// — Detail row (label + value, e.g. patient info fields)
export const detailRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorColor,
  },
  label: {
    width: 130,
    fontSize: typography.size.base,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  value: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold,
  },
});

// ─────────────────────────────────────────────
// STATUS HELPERS
// ─────────────────────────────────────────────

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export function getStatusColors(status: string): { bg: string; text: string } {
  const s = status.toLowerCase();

  if (['completed', 'paid', 'active', 'success', 'present', 'won'].includes(s)) {
    return { bg: colors.successBadgeBg, text: colors.success };
  }
  if (['pending', 'scheduled', 'late', 'partial', 'trial'].includes(s)) {
    return { bg: colors.warningBadgeBg, text: colors.warning };
  }
  if (['failed', 'overdue', 'cancelled', 'lost', 'absent', 'expired'].includes(s)) {
    return { bg: colors.errorLight, text: colors.errorDark };
  }
  if (['info', 'in_progress', 'demo'].includes(s)) {
    return { bg: colors.infoFill, text: colors.infoDark };
  }
  return { bg: colors.gray100, text: colors.textSecondary };
}

// ─────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────
export const layout = {
  screenHorizontalPadding: spacing[4],   // 16  standard
  screenHorizontalPaddingWide: spacing[5], // 20  wide rows
  tabBarHeight: 60,
  fabBottomOffset: 80,
  headerCurve: radius.headerBottom,      // 30
  listSeparatorIndent: 82,               // avatar (50) + gap (12) + left padding (20)
} as const;

// ─────────────────────────────────────────────
// DEFAULT EXPORT – single import convenience
// ─────────────────────────────────────────────
export const theme = {
  colors,
  adminColors,
  typography,
  spacing,
  radius,
  shadows,
  layout,
  getStatusColors,
} as const;

export default theme;
