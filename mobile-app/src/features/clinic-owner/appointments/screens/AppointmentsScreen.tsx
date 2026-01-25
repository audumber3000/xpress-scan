import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { appointmentsApiService, Appointment } from '../../../../services/api/appointments.api';
import { colors } from '../../../../shared/constants/colors';
import { WeekDaysView } from '../components/WeekDaysView';
import { MonthCalendarView } from '../components/MonthCalendarView';
import { MonthNavigationHeader } from '../components/MonthNavigationHeader';
import { AppointmentsList } from '../components/AppointmentsList';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface AppointmentsScreenProps {
  navigation: any;
}

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({ navigation }) => {
  const [viewMode, setViewMode] = useState<'Week' | 'Month'>('Month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      // Fetch for a window around the selected date so we have data for calendar indicators
      const dateFrom = new Date(selectedDate);
      dateFrom.setDate(dateFrom.getDate() - 15);
      const dateTo = new Date(selectedDate);
      dateTo.setDate(dateTo.getDate() + 15);

      const dateFromStr = formatLocalDate(dateFrom);
      const dateToStr = formatLocalDate(dateTo);

      console.log(`🔄 [APPOINTMENTS] Fetching from ${dateFromStr} to ${dateToStr}`);
      const data = await appointmentsApiService.getAppointments(dateFromStr, dateToStr);
      setAppointments(data);
      console.log(`✅ [APPOINTMENTS] Received ${data.length} appointments`);
    } catch (err: any) {
      console.error('Error loading appointments:', err);
      const { Alert } = require('react-native');
      Alert.alert('Error', `Failed to load appointments: ${err.message}`);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const getMonthCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: any[] = [];
    const today = new Date();

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({
        type: 'empty',
        day: prevMonthDay.getDate(),
        date: prevMonthDay
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = today.toDateString() === date.toDateString();
      const isSelected = selectedDate.toDateString() === date.toDateString();

      const dateStr = formatLocalDate(date);
      const hasAppointments = appointments.some(apt => apt.date === dateStr);

      days.push({
        type: 'day',
        day,
        date,
        isToday,
        isSelected,
        hasAppointments,
      });
    }

    return days;
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const weekDays = [];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const isSelected = selectedDate.toDateString() === date.toDateString();

      const dateStr = formatLocalDate(date);
      const hasAppointments = appointments.some(apt => apt.date === dateStr);

      weekDays.push({
        date,
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        isSelected,
        hasAppointments,
      });
    }

    return weekDays;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  const filteredAppointments = appointments.filter(apt => {
    // Compare YYYY-MM-DD strings to avoid timezone issues with new Date(str)
    const selectedDateStr = formatLocalDate(selectedDate);
    return apt.date === selectedDateStr;
  });

  console.log(`[APPOINTMENTS] Total: ${appointments.length}, Filtered (for ${formatLocalDate(selectedDate)}): ${filteredAppointments.length}`);
  if (appointments.length > 0 && filteredAppointments.length === 0) {
    console.log('[APPOINTMENTS] First item date:', appointments[0].date);
  }

  const handleAppointmentPress = (appointment: any) => {
    navigation.navigate('AppointmentDetails', { appointment });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Appointments"
        rightComponent={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton}>
              <Search size={22} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <SlidersHorizontal size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* View Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'Week' && styles.toggleButtonActive]}
            onPress={() => setViewMode('Week')}
          >
            <Text style={[styles.toggleText, viewMode === 'Week' && styles.toggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'Month' && styles.toggleButtonActive]}
            onPress={() => setViewMode('Month')}
          >
            <Text style={[styles.toggleText, viewMode === 'Month' && styles.toggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'Month' ? (
          <>
            <MonthNavigationHeader
              currentMonth={currentMonth}
              onPrevMonth={() => navigateMonth('prev')}
              onNextMonth={() => navigateMonth('next')}
            />
            <MonthCalendarView
              calendarDays={getMonthCalendar()}
              onDateSelect={setSelectedDate}
            />
          </>
        ) : (
          <WeekDaysView
            weekDays={getWeekDays()}
            onDateSelect={setSelectedDate}
          />
        )}

        <AppointmentsList
          appointments={filteredAppointments}
          selectedDate={selectedDate}
          onAppointmentPress={handleAppointmentPress}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
});
