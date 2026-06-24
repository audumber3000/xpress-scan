import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../../shared/constants/colors';

interface AuthInputProps extends TextInputProps {
  label?: string;
  /** Parent-computed validity for the current value. */
  isValid?: boolean;
  /** Message shown (red) when the field is invalid. */
  errorText?: string;
  /** Neutral helper text shown when there's no error. */
  hint?: string;
  /** Force the error to show (e.g. after a submit attempt), bypassing blur. */
  forceShowError?: boolean;
  /** Renders a show/hide eye toggle and masks input. */
  isPassword?: boolean;
}

/**
 * Clean, web-style auth input — mirrors the web app's ValidatedInput:
 * a simple labelled, bordered field that turns red with an inline message
 * once it's been touched (or a submit is attempted) and is invalid.
 * No cards, no leading icons — deliberately minimal.
 */
export const AuthInput: React.FC<AuthInputProps> = ({
  label,
  isValid = true,
  errorText,
  hint,
  forceShowError = false,
  isPassword = false,
  value,
  onBlur,
  ...rest
}) => {
  const [touched, setTouched] = useState(false);
  const [hidden, setHidden] = useState(true);

  const hasValue = !!(value && `${value}`.length > 0);
  const showError = (forceShowError || (touched && hasValue)) && !isValid;
  const showValid = touched && hasValue && isValid;

  const handleBlur = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setTouched(true);
    onBlur?.(e);
  };

  return (
    <View style={styles.group}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrap,
          showValid && styles.inputWrapValid,
          showError && styles.inputWrapError,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={isPassword ? hidden : rest.secureTextEntry}
          value={value}
          onBlur={handleBlur}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            {hidden ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
          </TouchableOpacity>
        )}
      </View>
      {showError && !!errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : !!hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  inputWrapValid: {
    borderColor: '#34D399',
  },
  inputWrapError: {
    borderColor: '#FCA5A5',
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: '#EF4444',
  },
  hintText: {
    marginTop: 5,
    fontSize: 12,
    color: '#9CA3AF',
  },
});
