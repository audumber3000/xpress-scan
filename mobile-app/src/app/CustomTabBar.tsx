import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Shield } from 'lucide-react-native';
import { colors } from '../shared/constants/colors';
import { adminColors } from '../shared/constants/adminColors';
import { useNavigationState } from '@react-navigation/native';

const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Appointments: 'Appointments',
  Admin: 'Admin',
  Patients: 'Patients',
  Profile: 'Profile',
};

export function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const safeInsets = useSafeAreaInsets();
  const bottomInset = insets?.bottom ?? safeInsets.bottom;
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  
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
    <View style={[styles.outer, { paddingBottom: bottomInset }]} onLayout={handleLayout}>
      <View style={styles.bar}>
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

            const iconColor = isFocused ? colors.primary : colors.gray400;
            const label = TAB_LABELS[route.name] ?? route.name;

            if (isAdminTab) {
              const adminButtonColor = isInAdminSection ? adminColors.primary : colors.primary;
              const adminShadowColor = isInAdminSection ? adminColors.primary : colors.primary;
              
              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.adminTabWrapper}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.adminButton, 
                    { backgroundColor: adminButtonColor },
                    Platform.select({
                      ios: {
                        shadowColor: adminShadowColor,
                      },
                    }),
                  ]}>
                    <Shield size={26} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
              );
            }

            const Icon = options.tabBarIcon;
            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.regularTab}
                activeOpacity={0.7}
              >
                {Icon ? (
                  <View style={styles.iconWrap}>
                    {Icon({ focused: isFocused, color: iconColor, size: 24 })}
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
  outer: { overflow: 'visible'},
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
    paddingBottom: 2,
  },
  iconWrap: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  adminTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
    overflow: 'visible',
  },
  adminButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    transform: [{ translateY: -14 }],
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
});
