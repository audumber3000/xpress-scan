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
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBackPress,
  rightComponent,
  backgroundColor,
  textColor,
  iconColor,
  variant = 'default',
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
      
      <Text style={[styles.headerTitle, { color: txtColor }]}>{title}</Text>
      
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'left',
  },
  rightContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
