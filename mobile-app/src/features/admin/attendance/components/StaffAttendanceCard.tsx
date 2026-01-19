import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChevronDown, UserCheck } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';

interface StaffAttendanceCardProps {
  staff: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
    checkIn?: string;
    checkOut?: string;
    status: 'present' | 'late' | 'absent';
    statusDots: number;
  };
  isExpanded?: boolean;
  onPress: () => void;
  onConfirmAttendance?: () => void;
}

export const StaffAttendanceCard: React.FC<StaffAttendanceCardProps> = ({
  staff,
  isExpanded = false,
  onPress,
  onConfirmAttendance,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return adminColors.present;
      case 'late':
        return adminColors.late;
      case 'absent':
        return adminColors.absent;
      default:
        return '#D1D5DB';
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const statusColor = getStatusColor(staff.status);

  return (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.header}
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
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{staff.name}</Text>
          <Text style={styles.role}>{staff.role}</Text>
        </View>

        <View style={styles.statusDots}>
          {Array.from({ length: 7 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: index < staff.statusDots ? statusColor : '#E5E7EB' },
              ]}
            />
          ))}
        </View>

        <ChevronDown 
          size={20} 
          color="#9CA3AF" 
          style={[styles.chevron, isExpanded && styles.chevronUp]}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {staff.status === 'late' && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>LATE (15M)</Text>
            </View>
          )}

          <View style={styles.shiftDetails}>
            <Text style={styles.shiftTitle}>SHIFT DETAILS — TODAY</Text>
            
            <View style={styles.timeRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>CHECK-IN</Text>
                <View style={styles.timeValue}>
                  <Text style={styles.timeIcon}>→</Text>
                  <Text style={styles.timeText}>{staff.checkIn || '---'}</Text>
                </View>
              </View>

              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>CHECK-OUT</Text>
                <View style={styles.timeValue}>
                  <Text style={styles.timeIcon}>←</Text>
                  <Text style={styles.timeText}>{staff.checkOut || '---'}</Text>
                </View>
              </View>
            </View>
          </View>

          {onConfirmAttendance && (
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={onConfirmAttendance}
              activeOpacity={0.8}
            >
              <UserCheck size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Confirm Attendance</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: adminColors.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: adminColors.primary,
    fontWeight: '500',
  },
  statusDots: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chevron: {
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: adminColors.late,
    letterSpacing: 0.5,
  },
  shiftDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  shiftTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 24,
  },
  timeColumn: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeIcon: {
    fontSize: 18,
    color: adminColors.primary,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: adminColors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
