import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlaskConical, Package, FileText, ChevronRight, LayoutGrid, Receipt } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

type Section = 'inventory' | 'lab' | 'consent' | 'expenses';

const CARDS: { section: Section; title: string; subtitle: string; icon: React.FC<any>; iconBg: string; iconColor: string }[] = [
  { section: 'inventory', title: 'Inventory', subtitle: 'Stock, medication & vendors', icon: Package, iconBg: '#EEF0FF', iconColor: '#6366F1' },
  { section: 'lab', title: 'Lab', subtitle: 'Lab orders & tracking', icon: FlaskConical, iconBg: '#E0F7F5', iconColor: '#4ECDC4' },
  { section: 'consent', title: 'Consent Forms', subtitle: 'Templates & signed forms', icon: FileText, iconBg: '#FEF3C7', iconColor: '#F59E0B' },
  { section: 'expenses', title: 'Expenses', subtitle: 'What the clinic spent', icon: Receipt, iconBg: '#FEE2E2', iconColor: '#EF4444' },
];

export const UtilitiesScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  // Deep link: /utilities?initialTab=inventory jumps straight into a section.
  React.useEffect(() => {
    const it = route?.params?.initialTab as Section | undefined;
    if (it && ['inventory', 'lab', 'consent', 'expenses'].includes(it)) {
      navigation.navigate('UtilitySection', { section: it });
    }
  }, [route?.params?.initialTab]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title="Utilities"
        titleIcon={<LayoutGrid size={22} />}
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>CLINIC TOOLS</Text>
        <View style={styles.card}>
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <React.Fragment key={c.section}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => navigation.navigate('UtilitySection', { section: c.section })}>
                  <View style={[styles.iconWrap, { backgroundColor: c.iconBg }]}>
                    <Icon size={20} color={c.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.title}</Text>
                    <Text style={styles.rowSub}>{c.subtitle}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.gray300} />
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 120 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: colors.borderColor, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.separatorColor, marginLeft: 74 },
});
