import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, StatusBar, StyleSheet } from 'react-native';
import { Home, FileText, Users, Calendar, ClipboardList, Heart, FileCheck, Shield } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../../app/AppNavigator';
import { useAuth } from '../../../../app/AuthContext';
import { AppSkeleton } from '../../../../shared/components/Skeleton';

type ClinicOwnerHomeScreenProps = NativeStackScreenProps<RootStackParamList, 'ClinicOwnerTabs'>;

interface MenuCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  onPress: () => void;
}

export const ClinicOwnerHomeScreen: React.FC<ClinicOwnerHomeScreenProps> = ({ navigation }) => {
  const { logout, backendUser, isLoading } = useAuth();

  const menuCards: MenuCard[] = [
    {
      id: '1',
      title: 'Visits',
      icon: <Home size={32} color="#F97316" />,
      bgColor: '#FFF7ED',
      onPress: () => { },
    },
    {
      id: '2',
      title: 'P&P Chart',
      icon: <FileText size={32} color="#EC4899" />,
      bgColor: '#FDF2F8',
      onPress: () => { },
    },
    {
      id: '3',
      title: 'About me',
      icon: <Users size={32} color="#10B981" />,
      bgColor: '#F0FDF4',
      onPress: () => { },
    },
    {
      id: '4',
      title: 'Detail',
      icon: <ClipboardList size={32} color="#8B5CF6" />,
      bgColor: '#F5F3FF',
      onPress: () => { },
    },
    {
      id: '5',
      title: 'Care package',
      icon: <Heart size={32} color="#3B82F6" />,
      bgColor: '#EFF6FF',
      onPress: () => { },
    },
    {
      id: '6',
      title: 'Communication',
      icon: <Calendar size={32} color="#F59E0B" />,
      bgColor: '#FFFBEB',
      onPress: () => { },
    },
    {
      id: '7',
      title: 'Documents',
      icon: <FileCheck size={32} color="#14B8A6" />,
      bgColor: '#F0FDFA',
      onPress: () => { },
    },
    {
      id: '8',
      title: 'Medical history',
      icon: <ClipboardList size={32} color="#8B5CF6" />,
      bgColor: '#FAF5FF',
      onPress: () => { },
    },
    {
      id: '9',
      title: 'OpenPass',
      icon: <Shield size={32} color="#3B82F6" />,
      bgColor: '#EFF6FF',
      onPress: () => { },
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {backendUser?.name || 'Clinic Owner'}
            </Text>
            <Text style={styles.headerSubtitle}>Location</Text>
            <Text style={styles.headerAddress}>
              {backendUser?.clinic?.name || 'Galway, Co. Galway, H91YY45'}
            </Text>
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Date of Birth</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>20/05/64</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileEmoji}>👤</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {menuCards.map((card) => (
            <View key={card.id} style={styles.cardWrapper}>
              <Pressable
                onPress={card.onPress}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: card.bgColor },
                  pressed && styles.cardPressed
                ]}
              >
                <View style={styles.cardIcon}>{card.icon}</View>
                <Text style={styles.cardTitle}>{card.title}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.logoutContainer}>
          <Pressable
            onPress={logout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#C4B5FD',
    fontSize: 14,
    marginBottom: 2,
  },
  headerAddress: {
    color: '#E9D5FF',
    fontSize: 12,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    backgroundColor: '#DDD6FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    color: '#5B21B6',
    fontSize: 12,
    fontWeight: '600',
  },
  profileCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#ffffff',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEmoji: {
    fontSize: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
  },
  cardWrapper: {
    width: '33.333%',
    padding: 8,
  },
  card: {
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardIcon: {
    marginBottom: 8,
  },
  cardTitle: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  logoutContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});
