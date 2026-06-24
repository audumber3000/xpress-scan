import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';
import { colors } from '../shared/constants/colors';
import { useNavigationState } from '@react-navigation/native';

const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Appointments: 'Appointments',
  Admin: 'Admin',
  Patients: 'Patients',
  Utilities: 'Utilities',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  const insets = useSafeAreaInsets();
  const { backendUser } = useAuth() || {};
  
  // Check if we're in admin section
  const currentRoute = useNavigationState(state => {
    const route = state?.routes[state.index];
    return route?.name;
  });
  
  const isInAdminSection = currentRoute === 'Attendance' || 
                          currentRoute === 'StaffManagement' || 
                          currentRoute === 'TreatmentsPricing' || 
                          currentRoute === 'Permissions' ||
                          currentRoute === 'ClinicSettings' ||
                          currentRoute === 'Subscription' ||
                          state.routes[state.index]?.name === 'Admin';

  const handleLayout = (e: LayoutChangeEvent) => {
    onHeightChange?.(e.nativeEvent.layout.height);
  };

  return (
    <View style={styles.outer} onLayout={handleLayout}>
      <View style={[styles.bar, { paddingBottom: 8 + insets.bottom }]}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const isAdminTab = route.name === 'Admin';

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            // Admin stays highlighted while any admin sub-screen is active.
            const active = isFocused || (isAdminTab && isInAdminSection);
            const iconColor = active ? colors.primary : colors.gray400;
            const label = TAB_LABELS[route.name] ?? route.name;

            const Icon = options.tabBarIcon;
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.regularTab}
                activeOpacity={0.7}
              >
                {Icon ? (
                  <View style={styles.iconWrap}>
                    {Icon({ focused: active, color: iconColor, size: 24 })}
                  </View>
                ) : null}
                <Text style={[styles.label, { color: iconColor }]} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { overflow: 'visible' },
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    overflow: 'visible',
  },
  regularTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  iconWrap: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
