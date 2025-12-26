import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import AppointmentCard from '../components/AppointmentCard';

const CalendarScreen = () => {
  const [selectedDate, setSelectedDate] = useState(3);
  const [currentMonth] = useState('December 2025');

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const generateCalendarDays = () => {
    const days = [];
    days.push({ day: 28, isCurrentMonth: false });
    days.push({ day: 29, isCurrentMonth: false });
    days.push({ day: 30, isCurrentMonth: false });
    for (let i = 1; i <= 31; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    days.push({ day: 1, isCurrentMonth: false });
    return days;
  };

  const calendarDays = generateCalendarDays();

  const appointments = [
    { id: 1, name: 'Sarah Johnson', time: '09:00 AM', treatment: 'Cleaning', duration: '30 min', status: 'confirmed' },
    { id: 2, name: 'Michael Brown', time: '10:00 AM', treatment: 'Root Canal', duration: '90 min', status: 'confirmed' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Calendar" subtitle="5 appointments today" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Text style={styles.monthText}>{currentMonth}</Text>
            <View style={styles.navButtons}>
              <TouchableOpacity style={styles.navButton}>
                <ChevronLeft size={20} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navButton}>
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekDaysRow}>
            {weekDays.map((day) => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.slice(0, 35).map((item, index) => {
              const isSelected = item.isCurrentMonth && item.day === selectedDate;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.dayCell}
                  onPress={() => item.isCurrentMonth && setSelectedDate(item.day)}
                >
                  <View style={[styles.dayCircle, isSelected && styles.selectedDay]}>
                    <Text style={[
                      styles.dayText,
                      !item.isCurrentMonth && styles.otherMonthDay,
                      isSelected && styles.selectedDayText
                    ]}>
                      {item.day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <TouchableOpacity style={styles.addButton}>
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {appointments.map((apt) => (
            <View key={apt.id} style={styles.appointmentRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{apt.time.split(' ')[0]}</Text>
                <Text style={styles.timePeriod}>{apt.time.split(' ')[1]}</Text>
              </View>
              <View style={styles.appointmentCardWrapper}>
                <AppointmentCard
                  name={apt.name}
                  time={apt.time}
                  treatment={apt.treatment}
                  duration={apt.duration}
                  status={apt.status}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  calendarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 18,
  },
  navButtons: {
    flexDirection: 'row',
  },
  navButton: {
    padding: 8,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDay: {
    backgroundColor: '#16a34a',
  },
  dayText: {
    fontSize: 14,
    color: '#374151',
  },
  otherMonthDay: {
    color: '#d1d5db',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scheduleSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 4,
  },
  appointmentRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timeColumn: {
    width: 64,
    paddingTop: 16,
  },
  timeText: {
    color: '#111827',
    fontWeight: '500',
    fontSize: 14,
  },
  timePeriod: {
    color: '#6b7280',
    fontSize: 12,
  },
  appointmentCardWrapper: {
    flex: 1,
  },
});

export default CalendarScreen;
