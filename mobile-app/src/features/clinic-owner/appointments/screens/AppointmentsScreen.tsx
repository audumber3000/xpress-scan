import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Calendar as CalendarIcon, SlidersHorizontal } from 'lucide-react-native';
import { appointmentsApiService, Appointment } from '../../../../services/api/appointments.api';
import { colors } from '../../../../shared/constants/colors';
import { WeekDaysView } from '../components/WeekDaysView';
import { MonthCalendarView } from '../components/MonthCalendarView';
import { MonthNavigationHeader } from '../components/MonthNavigationHeader';
import { AppointmentsList } from '../components/AppointmentsList';
import { AppSkeleton } from '../../../../shared/components/Skeleton';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';

interface AppointmentsScreenProps {
  navigation: any;
}

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({ navigation }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'Week' | 'Month'>('Week');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadAppointments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await appointmentsApiService.getAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDays = () => {
    const weekDays = [];
    const startOfWeek = new Date(selectedDate);
    // Find Monday of the current week (start of week)
    const day = selectedDate.getDay(); // Sun = 0, Mon = 1, ...
    const diff = (day === 0 ? -6 : 1) - day;
    startOfWeek.setDate(selectedDate.getDate() + diff);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  const getMonthCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Alignment for week starting Mon (1)
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    // Previous month filler
    for (let i = 0; i < offset; i++) {
      days.push({ day: 0, currentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = formatLocalDate(date);
      const hasAppointments = appointments.some(apt => apt.date === dateStr);
      const isSelected = selectedDate.toDateString() === date.toDateString();

      days.push({
        day: i,
        currentMonth: true,
        hasAppointments,
        isSelected,
        date
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  const filteredAppointments = appointments.filter(apt => {
    const selectedDateStr = formatLocalDate(selectedDate);
    return apt.date === selectedDateStr;
  });

  const handleAppointmentPress = (appointment: any) => {
    navigation.navigate('AppointmentDetails', { appointment });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Appointments"
        titleIcon={<CalendarIcon size={22} color="#111827" />}
        rightComponent={
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('SearchAppointments')}
            >
              <Search size={22} color="#6B7280" />
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
          loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <AppSkeleton show={true} width="100%" height={320} radius={16} />
            </View>
          ) : (
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
          )
        ) : (
          loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <AppSkeleton show={true} width="100%" height={100} radius={16} />
            </View>
          ) : (
            <WeekDaysView
              weekDays={getWeekDays()}
              onDateSelect={setSelectedDate}
            />
          )
        )}

        {loading ? (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <AppSkeleton show={true} width="100%" height={80} radius={16} />
            <View style={{ height: 12 }} />
            <AppSkeleton show={true} width="100%" height={80} radius={16} />
          </View>
        ) : (
          <View style={styles.listWrapper}>
            <AppointmentsList
              appointments={filteredAppointments}
              selectedDate={selectedDate}
              onAppointmentPress={handleAppointmentPress}
            />
          </View>
        )}
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
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#2E2A85',
  },
  listWrapper: {
    paddingTop: 8,
    paddingBottom: 40,
  },
});
