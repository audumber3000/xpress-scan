import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Mail, HelpCircle, ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { colors } from '../../../shared/constants/colors';

const VIOLET = '#2E2A85';

export const HelpSupportScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={VIOLET} />
      
      <ScreenHeader
        variant="primary"
        title="Help and support"
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <TouchableOpacity 
            style={[styles.infoRow, styles.infoRowBorder]} 
            onPress={() => Linking.openURL('https://wa.me/9194954078777')}
            activeOpacity={0.7}
          >
            <View style={styles.infoRowIcon}>
              <MessageSquare size={18} color={VIOLET} strokeWidth={2} />
            </View>
            <Text style={styles.infoRowLabel}>WhatsApp</Text>
            <Text style={styles.infoRowValue}>(chat with us)</Text>
            <ChevronRight size={16} color="#9CA3AF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.infoRow} 
            onPress={() => Linking.openURL('mailto:support@molarplus.com')}
            activeOpacity={0.7}
          >
            <View style={styles.infoRowIcon}>
              <Mail size={18} color={VIOLET} strokeWidth={2} />
            </View>
            <Text style={styles.infoRowLabel}>Email</Text>
            <Text style={styles.infoRowValue}>(send email)</Text>
            <ChevronRight size={16} color="#9CA3AF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.footerBox}>
          <Text style={styles.footerText}>We typically respond within 24 hours.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingTop: 10,
  },
  infoCard: { 
    backgroundColor: '#FFFFFF', 
    marginHorizontal: 16, 
    marginTop: 14, 
    borderRadius: 16, 
    ...Platform.select({ 
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }, 
      android: { elevation: 2 } 
    }) 
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 18 
  },
  infoRowBorder: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  infoRowIcon: { 
    width: 32, 
    alignItems: 'center' 
  },
  infoRowLabel: { 
    fontSize: 14, 
    color: '#111827', 
    fontWeight: '600', 
    flex: 1 
  },
  infoRowValue: { 
    fontSize: 13, 
    color: '#9CA3AF', 
    fontWeight: '500' 
  },
  footerBox: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
