import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

interface AdminModuleCardProps {
  icon: LucideIcon;
  iconColor: string;
  backgroundColor: string;
  title: string;
  onPress: () => void;
}

export const AdminModuleCard: React.FC<AdminModuleCardProps> = ({
  icon: Icon,
  iconColor,
  backgroundColor,
  title,
  onPress,
}) => {
  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon size={24} color={iconColor} strokeWidth={2.5} />
        </View>
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
