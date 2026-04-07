import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { styles, SWIPE_W } from './sharedStyles';

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onEdit, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
    onPanResponderGrant: () => {
      lastOffset.current = (translateX as any)._value || 0;
    },
    onPanResponderMove: (_, gs) => {
      const v = lastOffset.current + gs.dx;
      if (v <= 0 && v >= -SWIPE_W) translateX.setValue(v);
    },
    onPanResponderRelease: (_, gs) => {
      const open = gs.dx < -55;
      Animated.spring(translateX, {
        toValue: open ? -SWIPE_W : 0,
        useNativeDriver: true, tension: 100, friction: 8,
      }).start();
    },
  })).current;

  const close = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity style={styles.editAction} onPress={() => { close(); onEdit(); }} activeOpacity={0.85}>
          <Pencil size={17} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteAction} onPress={() => { close(); onDelete(); }} activeOpacity={0.85}>
          <Trash2 size={17} color="#FFFFFF" />
          <Text style={styles.swipeActionText}>DELETE</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};
