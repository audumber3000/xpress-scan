import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../../../../shared/constants/colors';

interface StatsCardsProps {
  dailyRevenue: number;
  totalAppointments: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ dailyRevenue, totalAppointments }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Daily Revenue</Text>
        <Text style={styles.value}>${dailyRevenue.toLocaleString()}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Appointments</Text>
        <Text style={styles.value}>{totalAppointments} Total</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: -30,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  label: {
    fontSize: 13,
    color: 'rgba(124, 58, 237, 0.8)',
    fontWeight: '500',
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
});
