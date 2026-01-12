import React from 'react';
import { TouchableOpacity, Text, Animated, View, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

interface ToggleProps {
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  backgroundColor?: string;
  activeColor?: string;
  textColor?: string;
  activeTextColor?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  options,
  selectedValue,
  onValueChange,
  backgroundColor = '#F3F4F6',
  activeColor = '#6C4CF3',
  textColor = '#6B7280',
  activeTextColor = '#FFFFFF',
}) => {
  const selectedIndex = options.findIndex(option => option.value === selectedValue);
  const toggleWidth = 100 / options.length;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Sliding Indicator */}
      <Animated.View
        style={[
          styles.slider,
          {
            backgroundColor: activeColor,
            width: `${toggleWidth}%`,
            left: `${selectedIndex * toggleWidth}%`,
          },
        ]}
      />
      
      {/* Toggle Options */}
      {options.map((option, index) => (
        <TouchableOpacity
          key={option.value}
          style={styles.option}
          onPress={() => onValueChange(option.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.optionText,
              {
                color: selectedValue === option.value ? activeTextColor : textColor,
                fontWeight: selectedValue === option.value ? '600' : '500',
              },
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    position: 'relative',
    minHeight: 40,
  },
  slider: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 17,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    zIndex: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
