import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../../shared/constants/colors';

interface FilterTab {
  label: string;
  count: number;
  value: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  selectedTab: string;
  onTabChange: (value: string) => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({ tabs, selectedTab, onTabChange }) => {
  return (
    <View style={styles.tabsContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.value}
          style={styles.tab}
          onPress={() => onTabChange(tab.value)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            selectedTab === tab.value && styles.tabTextActive
          ]}>
            {tab.label} ({tab.count})
          </Text>
          {selectedTab === tab.value && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  tab: {
    marginRight: 24,
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
