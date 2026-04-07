import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Calendar as CalendarIcon, Plus, MapPin } from 'lucide-react-native';
import { appointmentsApiService, Appointment } from '../../../../services/api/appointments.api';
import { adminApiService, ClinicInfo } from '../../../../services/api/admin.api';
import { useAuth } from '../../../../app/AuthContext';
import { colors } from '../../../../shared/constants/colors';
import { WeekDaysView } from '../components/WeekDaysView';
import { MonthCalendarView } from '../components/MonthCalendarView';
import { MonthNavigationHeader } from '../components/MonthNavigationHeader';
import { AppointmentsList } from '../components/AppointmentsList';
import { AppSkeleton } from '../../../../shared/components/Skeleton';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { ClinicSwitcherSheet } from '../../../../shared/components/ClinicSwitcherSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppointmentsScreenProps {
  navigation: any;
}

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({ navigation }) => {
  const { backendUser, switchBranch } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'Week' | 'Month'>('Week');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showClinicSwitcher, setShowClinicSwitcher] = useState(false);

  useEffect(() => {
    // Load persisted view mode
    const loadPreferences = async () => {
      const savedViewMode = await AsyncStorage.getItem('appointments_view_mode');
      if (savedViewMode === 'Week' || savedViewMode === 'Month') {
        setViewMode(savedViewMode);
      }
    };
    loadPreferences();
    loadAppointments();
  }, [backendUser?.clinic?.id]);

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

  const toggleViewMode = async (mode: 'Week' | 'Month') => {
    setViewMode(mode);
    await AsyncStorage.setItem('appointments_view_mode', mode);
  };

  const handleClinicSelected = async (clinic: ClinicInfo) => {
    try {
      await switchBranch(clinic.id);
      setShowClinicSwitcher(false);
    } catch (error) {
      console.error('Error switching clinic:', error);
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
    const today = new Date();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      type: 'day' | 'empty';
      day: number;
      date: Date;
      isToday?: boolean;
      isSelected?: boolean;
      hasAppointments?: boolean;
    }> = [];

    // Alignment for week starting Mon (1)
    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    // Previous month filler (empty cells)
    for (let i = 0; i < offset; i++) {
      days.push({ type: 'empty', day: 0, date: new Date(0) });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = formatLocalDate(date);
      const hasAppointments = appointments.some(apt => apt.date === dateStr);
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isToday = date.toDateString() === today.toDateString();

      days.push({
        type: 'day',
        day: i,
        date,
        isToday,
        isSelected,
        hasAppointments,
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
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScreenHeader
        variant="primary"
        title="Appointments"
        onBackPress={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        rightComponent={
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButtonPrimary}
              onPress={() => navigation.navigate('SearchAppointments')}
            >
              <Search size={22} color={colors.white} />
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
            onPress={() => toggleViewMode('Week')}
          >
            <Text style={[styles.toggleText, viewMode === 'Week' && styles.toggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'Month' && styles.toggleButtonActive]}
            onPress={() => toggleViewMode('Month')}
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
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddAppointment')}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>

      <ClinicSwitcherSheet
        isVisible={showClinicSwitcher}
        onClose={() => setShowClinicSwitcher(false)}
        onClinicSelected={handleClinicSelected}
      />
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
  clinicSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
    maxWidth: 150,
  },
  clinicNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonPrimary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
