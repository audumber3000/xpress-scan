import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, StatusBar, StyleSheet } from 'react-native';
import { Calendar, Users, FileText, ClipboardList, Phone, MessageSquare } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { useAuth } from '../../../app/AuthContext';

type ReceptionistHomeScreenProps = NativeStackScreenProps<RootStackParamList, 'ReceptionistHome'>;

interface MenuCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  onPress: () => void;
}

export const ReceptionistHomeScreen: React.FC<ReceptionistHomeScreenProps> = ({ navigation }) => {
  const { logout, backendUser } = useAuth();

  const menuCards: MenuCard[] = [
    {
      id: '1',
      title: 'Appointments',
      icon: <Calendar size={32} color="#8B5CF6" />,
      bgColor: '#F5F3FF',
      onPress: () => {},
    },
    {
      id: '2',
      title: 'Patients',
      icon: <Users size={32} color="#3B82F6" />,
      bgColor: '#EFF6FF',
      onPress: () => {},
    },
    {
      id: '3',
      title: 'Reports',
      icon: <FileText size={32} color="#10B981" />,
      bgColor: '#F0FDF4',
      onPress: () => {},
    },
    {
      id: '4',
      title: 'Tasks',
      icon: <ClipboardList size={32} color="#F59E0B" />,
      bgColor: '#FFFBEB',
      onPress: () => {},
    },
    {
      id: '5',
      title: 'Calls',
      icon: <Phone size={32} color="#EC4899" />,
      bgColor: '#FDF2F8',
      onPress: () => {},
    },
    {
      id: '6',
      title: 'Messages',
      icon: <MessageSquare size={32} color="#14B8A6" />,
      bgColor: '#F0FDFA',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reception Desk</Text>
        
        <View style={styles.headerContent}>
          <View style={styles.headerInfo}>
            <Text style={styles.welcomeText}>
              Welcome, {backendUser?.name || 'Receptionist'}!
            </Text>
            {backendUser?.clinic && (
              <Text style={styles.clinicText}>
                {backendUser.clinic.name}
              </Text>
            )}
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
  },
  welcomeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  clinicText: {
    color: '#C4B5FD',
    fontSize: 14,
  },
  profileCircle: {
    width: 64,
    height: 64,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEmoji: {
    fontSize: 32,
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
    width: '50%',
    padding: 8,
  },
  card: {
    aspectRatio: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
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
