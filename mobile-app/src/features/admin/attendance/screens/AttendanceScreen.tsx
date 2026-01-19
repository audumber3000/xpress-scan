import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, MoreVertical } from 'lucide-react-native';
import { WeekDaySelector } from '../components/WeekDaySelector';
import { StaffAttendanceCard } from '../components/StaffAttendanceCard';
import { adminColors } from '../../../../shared/constants/adminColors';

interface AttendanceScreenProps {
  navigation: any;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ navigation }) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(1);
  const [expandedCardId, setExpandedCardId] = useState<string | null>('1');

  const weekDays = [
    { dayName: 'MON', dayNumber: 23, isSelected: false },
    { dayName: 'TUE', dayNumber: 24, isSelected: true },
    { dayName: 'WED', dayNumber: 25, isSelected: false },
    { dayName: 'THU', dayNumber: 26, isSelected: false },
    { dayName: 'FRI', dayNumber: 27, isSelected: false },
    { dayName: 'SAT', dayNumber: 28, isSelected: false },
  ];

  const staffList = [
    {
      id: '1',
      name: 'Dr. Sarah Mitchell',
      role: 'Senior Dentist',
      checkIn: '09:15 AM',
      checkOut: undefined,
      status: 'late' as const,
      statusDots: 5,
    },
    {
      id: '2',
      name: 'James Wilson',
      role: 'Dental Hygienist',
      checkIn: '09:00 AM',
      checkOut: '05:00 PM',
      status: 'present' as const,
      statusDots: 5,
    },
    {
      id: '3',
      name: 'Maria Garcia',
      role: 'Receptionist',
      checkIn: '08:45 AM',
      checkOut: undefined,
      status: 'present' as const,
      statusDots: 5,
    },
    {
      id: '4',
      name: 'Robert Chen',
      role: 'Dental Assistant',
      checkIn: undefined,
      checkOut: undefined,
      status: 'absent' as const,
      statusDots: 3,
    },
  ];

  const handleDaySelect = (index: number) => {
    setSelectedDayIndex(index);
  };

  const handleCardPress = (id: string) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  const presentCount = staffList.filter(s => s.status === 'present').length;
  const lateCount = staffList.filter(s => s.status === 'late').length;
  const absentCount = staffList.filter(s => s.status === 'absent').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Calendar size={22} color={adminColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <MoreVertical size={22} color={adminColors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Week Day Selector */}
        <WeekDaySelector
          weekDays={weekDays}
          onDaySelect={handleDaySelect}
        />

        {/* Staff List Header */}
        <View style={styles.staffListHeader}>
          <Text style={styles.staffListTitle}>STAFF LIST • {staffList.length} ACTIVE</Text>
          <View style={styles.statusLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: adminColors.present }]} />
              <Text style={styles.legendText}>PRESENT</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: adminColors.late }]} />
              <Text style={styles.legendText}>LATE</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: adminColors.absent }]} />
              <Text style={styles.legendText}>ABSENT</Text>
            </View>
          </View>
        </View>

        {/* Staff Cards */}
        {staffList.map((staff) => (
          <StaffAttendanceCard
            key={staff.id}
            staff={staff}
            isExpanded={expandedCardId === staff.id}
            onPress={() => handleCardPress(staff.id)}
            onConfirmAttendance={staff.id === '1' ? () => {} : undefined}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  staffListHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  staffListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statusLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
});
