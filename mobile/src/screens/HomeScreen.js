import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Users, Calendar, DollarSign, TrendingUp } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import StatCard from '../components/StatCard';
import AppointmentCard from '../components/AppointmentCard';

// Simple chart component
const SimpleAreaChart = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const height = 150;
  
  return (
    <View style={styles.chartContainer}>
      <View style={[styles.chartBars, { height }]}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 30);
          return (
            <View key={index} style={styles.barWrapper}>
              <View 
                style={{ 
                  height: barHeight, 
                  width: '60%', 
                  backgroundColor: '#1d8a99',
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }} 
              />
              <Text style={styles.barLabel}>{item.month}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const HomeScreen = () => {
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const revenueData = [
    { month: 'Jan', value: 4500 },
    { month: 'Feb', value: 5000 },
    { month: 'Mar', value: 4800 },
    { month: 'Apr', value: 6000 },
    { month: 'May', value: 7000 },
    { month: 'Jun', value: 6800 },
  ];

  const appointments = [
    { id: 1, name: 'Sarah Johnson', time: '09:00 AM', treatment: 'Cleaning', status: 'confirmed' },
    { id: 2, name: 'Michael Brown', time: '10:30 AM', treatment: 'Root Canal', status: 'confirmed' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Dashboard" subtitle={dateString} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Stats Row 1 */}
        <View style={styles.statsRow}>
          <StatCard title="Today's Patients" value="24" icon={Users} />
          <StatCard title="Appointments" value="8" icon={Calendar} iconColor="#3b82f6" />
        </View>

        {/* Stats Row 2 */}
        <View style={[styles.statsRow, { marginTop: 12 }]}>
          <StatCard title="Revenue" value="$3,240" icon={DollarSign} iconColor="#16a34a" />
          <StatCard title="Growth" value="+12%" icon={TrendingUp} iconColor="#1d8a99" />
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Revenue Overview</Text>
          <SimpleAreaChart data={revenueData} />
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.appointmentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <Text style={styles.viewAllLink}>View All</Text>
          </View>
          
          {appointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              name={apt.name}
              time={apt.time}
              treatment={apt.treatment}
              status={apt.status}
            />
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
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  chartContainer: {
    marginTop: 16,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 8,
  },
  appointmentsSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  sectionHeader: {
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
  viewAllLink: {
    color: '#16a34a',
    fontSize: 14,
  },
});

export default HomeScreen;
