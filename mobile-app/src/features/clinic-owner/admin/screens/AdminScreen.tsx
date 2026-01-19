import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { colors } from '../../../../shared/constants/colors';

interface AdminScreenProps {
  navigation: any;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Admin" showBackButton={false} showNotification={false} />
      <View style={styles.content}>
        <Text style={styles.placeholder}>Clinic administration</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  placeholder: {
    fontSize: 16,
    color: colors.gray500,
  },
});
