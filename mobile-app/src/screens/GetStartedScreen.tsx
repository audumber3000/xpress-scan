import React from 'react';
import { View, Text, SafeAreaView, StatusBar, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type GetStartedScreenProps = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

export const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.illustrationContainer}>
            <View style={styles.toothCircle}>
              <Text style={styles.toothEmoji}>🦷</Text>
            </View>
            <View style={styles.badgeLeft}>
              <Text style={styles.badgeText}>Your Smile</Text>
            </View>
            <View style={styles.badgeRight}>
              <Text style={styles.badgeText}>Your Confidence</Text>
            </View>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              Smile Brightly{'\n'}With Confidence!
            </Text>
            <Text style={styles.subtitle}>
              Good oral health is the key to overall well-being
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => navigation.navigate('Signup')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Continue with Guest</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationContainer: {
    width: '100%',
    maxHeight: 384,
    aspectRatio: 1,
    backgroundColor: '#F3E8FF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  toothCircle: {
    width: 192,
    height: 192,
    backgroundColor: '#ffffff',
    borderRadius: 96,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toothEmoji: {
    fontSize: 60,
  },
  badgeLeft: {
    position: 'absolute',
    top: 80,
    left: 40,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeRight: {
    position: 'absolute',
    bottom: 128,
    right: 40,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 18,
  },
});
