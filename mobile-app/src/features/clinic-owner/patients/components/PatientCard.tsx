import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Alert } from 'react-native';
import { Phone, Trash2 } from 'lucide-react-native';

interface PatientCardProps {
  patient: {
    id: string;
    name: string;
    phone: string;
    status: 'Active' | 'Inactive';
    lastVisit: string;
    initials: string;
    avatarColor: string;
  };
  onPress: () => void;
  onPhonePress: () => void;
  onDelete: () => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, onPress, onPhonePress, onDelete }) => {
  const isActive = patient.status === 'Active';
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        lastOffset.current = (translateX as any)._value || 0;
      },
      onPanResponderMove: (_, gestureState) => {
        const newOffset = lastOffset.current + gestureState.dx;
        if (newOffset <= 0 && newOffset >= -100) {
          translateX.setValue(newOffset);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -60;
        const targetValue = shouldOpen ? -90 : 0;

        Animated.spring(translateX, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      },
    })
  ).current;

  const handleDelete = () => {
    Alert.alert(
      'Delete Patient',
      `Are you sure you want to delete ${patient.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            onDelete();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Delete Button */}
      <Animated.View
        style={[
          styles.deleteButton,
          {
            transform: [{
              translateX: translateX.interpolate({
                inputRange: [-90, 0],
                outputRange: [0, 90],
                extrapolate: 'clamp',
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.deleteButtonInner}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>DELETE</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Patient Row */}
      <Animated.View
        style={[
          styles.row,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.rowContent}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: patient.avatarColor }]}>
            <Text style={styles.avatarText}>{patient.initials}</Text>
          </View>

          {/* Patient Info */}
          <View style={styles.patientInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#9CA3AF' }]} />
            </View>
            <Text style={styles.statusText}>
              {patient.status} • {patient.phone}
            </Text>
            <Text style={styles.lastVisit}>Last visit: {patient.lastVisit}</Text>
          </View>

          {/* Phone Icon */}
          <TouchableOpacity
            style={styles.phoneButton}
            onPress={(e) => {
              e.stopPropagation();
              onPhonePress();
            }}
            activeOpacity={0.6}
          >
            <Phone size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Border */}
      <View style={styles.separator} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonInner: {
    backgroundColor: '#EF4444',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: '#FFFFFF',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  patientInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  lastVisit: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  phoneButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 82,
  },
});
