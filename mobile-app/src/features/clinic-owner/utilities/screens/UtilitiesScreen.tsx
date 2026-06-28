import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlaskConical, Package, FileText, Plus } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { tabStyles } from '../../../../shared/constants/theme';
import { LabTab } from '../tabs/LabTab';
import { InventoryTab } from '../tabs/InventoryTab';
import { ConsentFormsTab } from '../tabs/ConsentFormsTab';
import type { UtilityTabHandle } from '../utilityTab';

type TabKey = 'lab' | 'inventory' | 'consent';

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: 'lab',       label: 'Lab',           icon: FlaskConical },
  { key: 'inventory', label: 'Inventory',     icon: Package },
  { key: 'consent',   label: 'Consent Forms', icon: FileText },
];

export const UtilitiesScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const initialSearchTab = route?.params?.initialTab as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(initialSearchTab || 'lab');

  const labRef = useRef<UtilityTabHandle>(null);
  const inventoryRef = useRef<UtilityTabHandle>(null);
  const consentRef = useRef<UtilityTabHandle>(null);

  const handleAdd = () => {
    const ref = activeTab === 'lab' ? labRef : activeTab === 'inventory' ? inventoryRef : consentRef;
    ref.current?.openCreate();
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        topInset
        title="Utilities"
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        rightComponent={
          <TouchableOpacity onPress={handleAdd} style={styles.headerAddBtn}>
            <Plus color={colors.white} size={22} />
          </TouchableOpacity>
        }
      />
      <View style={tabStyles.container}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={tabStyles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon size={15} color={active ? colors.primary : colors.textMuted} strokeWidth={active ? 2.5 : 2} />
                <Text style={[tabStyles.tabText, active && tabStyles.activeTabText]}>{tab.label}</Text>
              </View>
              {active && <View style={tabStyles.indicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabContent}>
        <>
          {activeTab === 'lab'       && <LabTab ref={labRef} />}
          {activeTab === 'inventory' && <InventoryTab ref={inventoryRef} />}
          {activeTab === 'consent'   && <ConsentFormsTab ref={consentRef} />}
        </>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabContent: { flex: 1 },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
