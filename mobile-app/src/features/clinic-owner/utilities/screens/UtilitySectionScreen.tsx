import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { tabStyles } from '../../../../shared/constants/theme';
import { LabTab } from '../tabs/LabTab';
import { InventoryTab } from '../tabs/InventoryTab';
import { MedicationTab } from '../tabs/MedicationTab';
import { VendorsTab } from '../tabs/VendorsTab';
import { ConsentFormsTab } from '../tabs/ConsentFormsTab';
import type { UtilityTabHandle } from '../utilityTab';

type Section = 'inventory' | 'lab' | 'consent';

const SECTION_TITLE: Record<Section, string> = {
  inventory: 'Inventory',
  lab: 'Lab',
  consent: 'Consent Forms',
};

// Each section's own sub-tabs. Web's inventory hub carries stock / medications /
// vendors; lab and consent are single lists for now.
const SECTION_TABS: Record<Section, { key: string; label: string }[]> = {
  inventory: [
    { key: 'stock', label: 'Stock' },
    { key: 'medication', label: 'Medication' },
    { key: 'vendors', label: 'Vendors' },
  ],
  lab: [{ key: 'orders', label: 'Orders' }],
  consent: [{ key: 'templates', label: 'Templates' }],
};

export const UtilitySectionScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const section: Section = route?.params?.section || 'inventory';
  const tabs = SECTION_TABS[section];
  const [active, setActive] = useState(tabs[0].key);

  const stockRef = useRef<UtilityTabHandle>(null);
  const medRef = useRef<UtilityTabHandle>(null);
  const vendorRef = useRef<UtilityTabHandle>(null);
  const labRef = useRef<UtilityTabHandle>(null);
  const consentRef = useRef<UtilityTabHandle>(null);

  const activeRef = useMemo(() => {
    if (active === 'stock') return stockRef;
    if (active === 'medication') return medRef;
    if (active === 'vendors') return vendorRef;
    if (active === 'orders') return labRef;
    return consentRef;
  }, [active]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title={SECTION_TITLE[section]}
        onBackPress={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity onPress={() => activeRef.current?.openCreate()} style={styles.headerAddBtn}>
            <Plus color={colors.white} size={22} />
          </TouchableOpacity>
        }
      />

      {tabs.length > 1 && (
        <View style={tabStyles.container}>
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <TouchableOpacity key={t.key} style={tabStyles.tab} onPress={() => setActive(t.key)} activeOpacity={0.7}>
                <Text style={[tabStyles.tabText, isActive && tabStyles.activeTabText]}>{t.label}</Text>
                {isActive && <View style={tabStyles.indicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.content}>
        {section === 'inventory' && active === 'stock' && <InventoryTab ref={stockRef} />}
        {section === 'inventory' && active === 'medication' && <MedicationTab ref={medRef} />}
        {section === 'inventory' && active === 'vendors' && <VendorsTab ref={vendorRef} />}
        {section === 'lab' && <LabTab ref={labRef} />}
        {section === 'consent' && <ConsentFormsTab ref={consentRef} />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1 },
  headerAddBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
});
