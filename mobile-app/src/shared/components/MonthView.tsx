import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../constants/colors';
import { Appointment } from '../../services/api/appointments.api';

interface MonthViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  selectedDate,
  appointments,
  onDateSelect,
  onMonthChange,
}) => {
  const getMonthCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: any[] = [];
    
    // Add empty days for alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ type: 'empty' });
    }
    
    const today = new Date();
    
    // Add actual days with appointment checking
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = today.toDateString() === date.toDateString();
      
      // Check if this day has appointments
      const dayAppointments = appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        return appointmentDate.toDateString() === date.toDateString();
      });
      
      const hasAppointments = dayAppointments.length > 0;
      
      days.push({
        type: 'day',
        day,
        date,
        isToday,
        hasAppointments,
        appointmentCount: dayAppointments.length
      });
    }
    
    return days;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Finished':
        return '#10B981';
      case 'Encounter':
        return '#F59E0B';
      case 'Registered':
        return '#6B7280';
      case 'Cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Month Calendar View */}
      <View style={styles.monthCalendarContainer}>
        {/* Month Header with Navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity 
            style={styles.monthNavButton}
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setMonth(newDate.getMonth() - 1);
              onMonthChange(newDate);
            }}
          >
            <ChevronLeft size={24} color={colors.gray700} />
          </TouchableOpacity>
          
          <Text style={styles.monthHeaderText}>
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          
          <TouchableOpacity 
            style={styles.monthNavButton}
            onPress={() => {
              const newDate = new Date(selectedDate);
              newDate.setMonth(newDate.getMonth() + 1);
              onMonthChange(newDate);
            }}
          >
            <ChevronRight size={24} color={colors.gray700} />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {getMonthCalendarDays().map((dayInfo, index) => (
            <View key={index} style={styles.calendarDay}>
              {dayInfo.type === 'empty' ? (
                <View style={styles.emptyDay} />
              ) : (
                <TouchableOpacity
                  style={[
                    styles.dayCircle,
                    dayInfo.isToday && styles.dayCircleToday,
                    dayInfo.hasAppointments && styles.dayCircleWithAppointments
                  ]}
                  onPress={() => onDateSelect(dayInfo.date)}
                >
                  <Text style={[
                    styles.dayNumber,
                    dayInfo.isToday && styles.dayNumberToday,
                    dayInfo.hasAppointments && styles.dayNumberWithAppointments
                  ]}>
                    {dayInfo.day}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Selected Day Appointments */}
      <View style={styles.selectedDayAppointments}>
        <View style={styles.selectedDayHeader}>
          <Text style={styles.selectedDayTitle}>
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
        </View>
        
        <View style={styles.appointmentsList}>
          {appointments.length > 0 ? (
            appointments.map((appointment) => (
              <View key={appointment.id} style={styles.timeSlot}>
                <Text style={styles.timeLabel}>
                  {new Date(`1970-01-01T${appointment.startTime}`).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
                <View style={styles.appointmentCard}>
                  <View style={styles.appointmentContent}>
                    <Text style={styles.patientName}>{appointment.patientName}</Text>
                    <Text style={styles.appointmentTime}>
                      {appointment.startTime} › {appointment.endTime}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(appointment.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                      {appointment.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noAppointmentsContainer}>
              <Text style={styles.noAppointmentsText}>
                {selectedDate.toDateString() === new Date().toDateString() 
                  ? "You have no appointments today" 
                  : `No appointments on ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
                }
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  monthCalendarContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  monthHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  calendarDay: {
    width: '13%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDay: {
    flex: 1,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleToday: {
    backgroundColor: colors.primary,
  },
  dayCircleWithAppointments: {
    backgroundColor: '#D1FAE5', // Light green background
    borderWidth: 1,
    borderColor: '#10B981', // Green border
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },
  dayNumberToday: {
    color: colors.white,
    fontWeight: '600',
  },
  dayNumberWithAppointments: {
    color: '#065F46', // Dark green text
    fontWeight: '500',
  },
  selectedDayAppointments: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  selectedDayHeader: {
    marginBottom: 16,
  },
  selectedDayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
  },
  appointmentsList: {
    flex: 1,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeLabel: {
    width: 60,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray500,
  },
  appointmentCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentContent: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 12,
    color: colors.gray500,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noAppointmentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noAppointmentsText: {
    fontSize: 16,
    color: colors.gray500,
    textAlign: 'center',
  },
});
