import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { colors } from '../constants/colors';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
}

export interface CustomAlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onDismiss,
}) => {
  const handleButtonPress = (button: AlertButton) => {
    onDismiss();
    button.onPress?.();
  };

  const getButtonStyle = (button: AlertButton) => {
    if (button.style === 'destructive') {
      return styles.buttonDestructive;
    }
    if (button.style === 'cancel') {
      return styles.buttonCancel;
    }
    return styles.buttonPrimary;
  };

  const getButtonTextStyle = (button: AlertButton) => {
    if (button.style === 'destructive') {
      return styles.buttonTextDestructive;
    }
    if (button.style === 'cancel') {
      return styles.buttonTextCancel;
    }
    return styles.buttonTextPrimary;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button),
                  index < buttons.length - 1 && styles.buttonSpacing,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}
              >
                <Text style={getButtonTextStyle(button)}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.gray600,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonSpacing: {
    marginRight: 0,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonCancel: {
    backgroundColor: colors.gray100,
  },
  buttonDestructive: {
    backgroundColor: colors.errorLight,
  },
  buttonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  buttonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },
  buttonTextDestructive: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
});
