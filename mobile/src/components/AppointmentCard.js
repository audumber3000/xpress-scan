import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const AppointmentCard = ({ name, time, treatment, status = 'confirmed', duration, onPress }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'pending':
        return { bgColor: '#fef3c7', textColor: '#d97706' };
      case 'cancelled':
        return { bgColor: '#fee2e2', textColor: '#dc2626' };
      default:
        return { bgColor: '#dcfce7', textColor: '#16a34a' };
    }
  };

  const statusStyle = getStatusStyle();

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.details}>
            <Text style={styles.detailText}>{time}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.detailText}>{treatment}</Text>
            {duration && (
              <>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.durationText}>⏱ {duration}</Text>
              </>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bgColor }]}>
          <Text style={[styles.statusText, { color: statusStyle.textColor }]}>
            {status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 16,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    color: '#6b7280',
    fontSize: 14,
  },
  dot: {
    color: '#9ca3af',
    marginHorizontal: 8,
  },
  durationText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default AppointmentCard;
