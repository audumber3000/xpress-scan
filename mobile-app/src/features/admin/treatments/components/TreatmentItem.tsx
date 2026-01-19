import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Edit2, LucideIcon } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';

interface TreatmentItemProps {
  treatment: {
    id: string;
    name: string;
    description: string;
    price: string;
    icon: LucideIcon;
  };
  onEdit: () => void;
}

export const TreatmentItem: React.FC<TreatmentItemProps> = ({ treatment, onEdit }) => {
  const Icon = treatment.icon;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon size={24} color={adminColors.primary} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name}>{treatment.name}</Text>
        <Text style={styles.description}>{treatment.description}</Text>
      </View>

      <Text style={styles.price}>{treatment.price}</Text>

      <TouchableOpacity 
        style={styles.editButton}
        onPress={onEdit}
        activeOpacity={0.7}
      >
        <Edit2 size={18} color={adminColors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: adminColors.primary,
    marginRight: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
