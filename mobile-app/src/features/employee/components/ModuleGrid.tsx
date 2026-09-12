import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../shared/constants/colors';

/**
 * Everything else this person may open, three across.
 *
 * One accent colour rather than a different pastel per tile: eight colours
 * carry no meaning and make the screen read as a toy. A badge is a count that
 * needs attention (low stock, overdue lab work), and earns the only red.
 */
export interface ModuleItem {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  badge?: number;
  onPress: () => void;
}

export const ModuleGrid: React.FC<{ title?: string; items: ModuleItem[] }> = ({ title, items }) => {
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.grid}>
        {items.map(({ key, label, Icon, badge, onPress }) => (
          <TouchableOpacity key={key} style={styles.tile} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.iconWrap}>
              <Icon size={22} color={colors.primary} strokeWidth={2} />
              {!!badge && badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={styles.label} numberOfLines={2}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 22, paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31.5%', aspectRatio: 1.05, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.borderColor,
    borderRadius: 14, paddingHorizontal: 6,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryBgLight,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.cardBg,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
});

export default ModuleGrid;
