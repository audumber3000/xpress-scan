import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Edit2 } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';

interface ProfileHeaderProps {
  name: string;
  role: string;
  clinic: string;
  avatarUrl?: string;
  onEditPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  role,
  clinic,
  avatarUrl,
  onEditPress,
}) => {
  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Avatar with Edit Button */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={onEditPress}
          activeOpacity={0.7}
        >
          <Edit2 size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Name and Role */}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.role}>{role}</Text>
      <Text style={styles.clinic}>{clinic}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6B9B9E',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  role: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  clinic: {
    fontSize: 15,
    color: '#6B7280',
  },
});
