import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../constants/colors';
import { adminColors } from '../constants/adminColors';

interface ScreenHeaderProps {
  title: string;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
  variant?: 'default' | 'admin';
  subtitle?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBackPress,
  rightComponent,
  backgroundColor,
  textColor,
  iconColor,
  variant = 'default',
  subtitle,
}) => {
  const bgColor = backgroundColor || (variant === 'admin' ? '#FFFFFF' : '#FFFFFF');
  const txtColor = textColor || (variant === 'admin' ? '#111827' : '#111827');
  const icnColor = iconColor || (variant === 'admin' ? adminColors.primary : colors.primary);

  return (
    <View style={[styles.header, { backgroundColor: bgColor }]}>
      {onBackPress ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={icnColor} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backButton} />
      )}

      <View style={styles.titleContainer}>
        <Text style={[styles.headerTitle, { color: txtColor }]}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      {rightComponent ? (
        <View style={styles.rightContainer}>
          {rightComponent}
        </View>
      ) : (
        <View style={styles.backButton} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  rightContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
