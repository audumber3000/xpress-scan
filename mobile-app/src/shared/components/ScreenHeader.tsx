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
  titleIcon?: React.ReactNode;
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
  titleIcon,
}) => {
  const bgColor = backgroundColor || (variant === 'admin' ? '#FFFFFF' : '#FFFFFF');
  const txtColor = textColor || (variant === 'admin' ? '#111827' : '#111827');
  const icnColor = iconColor || (variant === 'admin' ? adminColors.primary : colors.primary);

  return (
    <View style={[styles.header, { backgroundColor: bgColor }]}>
      {onBackPress && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={icnColor} />
        </TouchableOpacity>
      )}

      <View style={[styles.titleContainer, !onBackPress && { marginLeft: 0 }]}>
        <View style={styles.headerTitleRow}>
          {titleIcon && <View style={styles.titleIconContainer}>{titleIcon}</View>}
          <Text style={[styles.headerTitle, { color: txtColor }]}>{title}</Text>
        </View>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      {rightComponent && (
        <View style={styles.rightContainer}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginLeft: -10, // Adjust to bring icon closer to edge
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconContainer: {
    marginRight: 8,
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
