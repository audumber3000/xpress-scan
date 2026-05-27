import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Edit2 } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { UserAvatar } from '../../../../shared/components/UserAvatar';

interface ProfileHeaderProps {
  name: string;
  role: string;
  clinic: string;
  /** Firebase photoURL — Google / Apple profile picture */
  photoURL?: string | null;
  /** Email used as seed for the DiceBear fallback avatar */
  avatarSeed?: string | null;
  onEditPress: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  role,
  clinic,
  photoURL,
  avatarSeed,
  onEditPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Avatar with Edit Button */}
      <View style={styles.avatarContainer}>
        <UserAvatar
          size={120}
          photoURL={photoURL}
          seed={avatarSeed || name}
          name={name}
          fallbackBg="#6B9B9E"
          fallbackColor="#FFFFFF"
        />
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
