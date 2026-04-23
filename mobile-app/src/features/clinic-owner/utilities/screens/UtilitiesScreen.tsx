import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlaskConical, Package, FileText } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { tabStyles } from '../../../../shared/constants/theme';
import { LabTab } from '../tabs/LabTab';
import { InventoryTab } from '../tabs/InventoryTab';
import { ConsentFormsTab } from '../tabs/ConsentFormsTab';
import { FeatureLock } from '../../../../shared/components/FeatureLock';

type TabKey = 'lab' | 'inventory' | 'consent';

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: 'lab',       label: 'Lab',           icon: FlaskConical },
  { key: 'inventory', label: 'Inventory',     icon: Package },
  { key: 'consent',   label: 'Consent Forms', icon: FileText },
];

export const UtilitiesScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const initialSearchTab = route?.params?.initialTab as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(initialSearchTab || 'lab');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        variant="primary"
        title="Utilities"
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
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
        <FeatureLock
          featureName="Utilities"
          description="Lab orders, inventory management, and consent forms are Professional plan features. Upgrade to access them."
        >
          {activeTab === 'lab'       && <LabTab />}
          {activeTab === 'inventory' && <InventoryTab />}
          {activeTab === 'consent'   && <ConsentFormsTab />}
        </FeatureLock>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabContent: { flex: 1 },
});
