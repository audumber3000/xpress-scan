import React from 'react';
import { View, Text, StatusBar, Pressable, StyleSheet, ImageBackground, Dimensions, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { RootStackParamList } from '../../../app/AppNavigator';
import { colors } from '../../../shared/constants/colors';

type GetStartedScreenProps = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

const { width } = Dimensions.get('window');

export const GetStartedScreen: React.FC<GetStartedScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require('../../../../assets/getstarted_picture.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(42, 39, 110, 0.6)', 'rgba(42, 39, 110, 0.95)']}
          style={styles.gradient}
          locations={[0.45, 0.7, 1]}
        >
          <SafeAreaView style={styles.content}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                Supporting <Text style={styles.highlight}>dentistry</Text>{'\n'}beyond the chair !
              </Text>
              <Text style={styles.subtitle}>
                Less Stress. More Smiles.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              {/* Primary "Swipe/Get Started" Button */}
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <View style={styles.iconContainer}>
                  <ChevronRight size={24} color={colors.white} />
                </View>
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    width: '100%',
  },
  textContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '400', // Regular weight for the main text
    color: colors.white,
    marginBottom: 12,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  highlight: {
    fontWeight: '800', // Bold/Heavy weight for "dentistry"
    color: colors.white, // Keep it white
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray100,
    fontWeight: '500',
    opacity: 0.9,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary, // Changed to primary brand color
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', // Add subtle border for contrast against gradient
  },
  primaryButtonText: {
    color: colors.white, // Changed to white
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  iconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
