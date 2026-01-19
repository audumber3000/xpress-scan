import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';

interface StaffMemberCardProps {
  staff: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    isOnline?: boolean;
  };
  onPress: () => void;
}

export const StaffMemberCard: React.FC<StaffMemberCardProps> = ({ staff, onPress }) => {
  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {staff.avatar ? (
          <Image source={{ uri: staff.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(staff.name)}</Text>
          </View>
        )}
        {staff.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{staff.name}</Text>
        <Text style={styles.role}>{staff.role}</Text>
      </View>

      <ChevronRight size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: adminColors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: adminColors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  role: {
    fontSize: 13,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
