import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatCard = ({ title, value, icon: Icon, iconColor = '#16a34a' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={20} color={iconColor} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: '#6b7280',
    fontSize: 12,
  },
  value: {
    color: '#111827',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  iconContainer: {
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 8,
  },
});

export default StatCard;
