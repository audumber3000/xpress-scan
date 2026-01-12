import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bell } from 'lucide-react-native';
import { colors } from '../constants/colors';

interface ScreenHeaderProps {
  title: string;
  showBackButton?: boolean;
  showNotification?: boolean;
  onBackPress?: () => void;
  onNotificationPress?: () => void;
  rightComponent?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showBackButton = false,
  showNotification = true,
  onBackPress,
  onNotificationPress,
  rightComponent,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          {showBackButton ? (
            <TouchableOpacity style={styles.iconButton} onPress={onBackPress}>
              <ChevronLeft size={24} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
          
          <Text style={styles.title}>{title}</Text>
          
          {rightComponent ? (
            rightComponent
          ) : showNotification ? (
            <TouchableOpacity style={styles.iconButton} onPress={onNotificationPress}>
              <Bell size={24} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
});
