import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, StyleSheet, Platform, RefreshControl, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell, Calendar, Users, FlaskConical,
  Package, FileText, UserCircle, Search,
  CreditCard, BarChart3, Megaphone,
  Briefcase, ArrowUpRight, TrendingUp, X,
  HelpCircle
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../app/AppNavigator';
import { useAuth } from '../../../app/AuthContext';
import { dashboardApiService, DashboardMetrics } from '../../../services/api/dashboard.api';
import { utilitiesApiService } from '../../../services/api/utilities.api';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceptionistHome'>;

const VIOLET       = '#2E2A85';

type SectionItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  nav: keyof RootStackParamList | null;
  params?: any;
  permissionKey: string | string[];
  theme: {
    bg: string;
    icon: string;
    text: string;
  };
};

const Patients = Users;

const MODULES: SectionItem[] = [
  { 
    id: 'appointments', 
    label: 'Appointments',  
    Icon: Calendar,        
    nav: 'Appointments', 
    permissionKey: 'appointments',
    theme: { bg: '#EEF2FF', icon: '#4F46E5', text: '#3730A3' }
  },
  { 
    id: 'patients',     
    label: 'Patients',      
    Icon: Patients,        
    nav: 'Patients',           
    permissionKey: 'patients',
    theme: { bg: '#FDF2F8', icon: '#DB2777', text: '#9D174D' }
  },
  { 
    id: 'billing',      
    label: 'Billing',       
    Icon: CreditCard,      
    nav: 'AllTransactions',    
    permissionKey: 'finance',
    theme: { bg: '#F0FDFA', icon: '#0D9488', text: '#115E59' }
  },
  { 
    id: 'inventory',    
    label: 'Inventory',     
    Icon: Package,         
    nav: 'Utilities',          
    permissionKey: 'inventory', 
    params: { initialTab: 'inventory' },
    theme: { bg: '#FEFCE8', icon: '#CA8A04', text: '#854D0E' }
  },
  { 
    id: 'consent',      
    label: 'Consent Forms', Icon: FileText,        
    nav: 'Utilities',          
    permissionKey: 'consent',   
    params: { initialTab: 'consent' },
    theme: { bg: '#F5F3FF', icon: '#7C3AED', text: '#5B21B6' }
  },
  { 
    id: 'labs',          
    label: 'Labs',          
    Icon: FlaskConical,    
    nav: 'Utilities',          
    permissionKey: 'lab',       
    params: { initialTab: 'lab' },
    theme: { bg: '#EFF6FF', icon: '#2563EB', text: '#1E40AF' }
  },
  { 
    id: 'reports',      
    label: 'Reports',       
    Icon: BarChart3,       
    nav: null,                 
    permissionKey: 'reports',
    theme: { bg: '#F8FAFC', icon: '#475569', text: '#1E293B' }
  },
  { 
    id: 'marketing',    
    label: 'Marketing',     
    Icon: Megaphone,       
    nav: null,                 
    permissionKey: 'marketing',
    theme: { bg: '#FFF7ED', icon: '#EA580C', text: '#9A3412' }
  },
  { 
    id: 'profile',      
    label: 'My Profile',    
    Icon: UserCircle,      
    nav: 'ReceptionistProfile',
    permissionKey: [], 
    theme: { bg: '#F9FAFB', icon: '#6B7280', text: '#374151' }
  },
  { 
    id: 'help',      
    label: 'Help and support',    
    Icon: HelpCircle,      
    nav: 'HelpSupport',
    permissionKey: [], 
    theme: { bg: '#F0F9FF', icon: '#0284C7', text: '#0369A1' }
  },
];

export const ReceptionistHomeScreen: React.FC<Props> = ({ navigation }) => {
  const { backendUser } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [overdueLabsCount, setOverdueLabsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [m, inv, labs] = await Promise.all([
        dashboardApiService.getMetrics('today'),
        utilitiesApiService.getInventory(),
        utilitiesApiService.getLabOrders()
      ]);
      
      if (m) setMetrics(m);
      
      // Calculate Low Stock Count
      const lowStock = inv.filter(item => item.quantity <= item.min_stock_level).length;
      setLowStockCount(lowStock);

      // Calculate Overdue Lab Orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdue = labs.filter(order => {
        if (order.status.toLowerCase() === 'completed') return false;
        if (!order.due_date) return false;
        try {
          const dueDate = new Date(order.due_date);
          return dueDate < today;
        } catch { return false; }
      }).length;
      setOverdueLabsCount(overdue);
    } catch (err) {
      console.error('❌ [ReceptionistHome] Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handlePatientSearch = () => {
    navigation.navigate('Patients' as any, { 
      initialSearchQuery: searchQuery,
      fromHomeSearch: true 
    });
    setSearchQuery('');
  };

  const initials = (backendUser?.name || 'R')
    .split(' ')
    .map((w: string) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const canAccess = (item: SectionItem) => {
    if (!item.permissionKey || (Array.isArray(item.permissionKey) && item.permissionKey.length === 0)) return true;
    if (backendUser?.role === 'clinic_owner') return true;
    const permissions = backendUser?.permissions || {};
    const keys = Array.isArray(item.permissionKey) ? item.permissionKey : [item.permissionKey];
    return keys.some(key => permissions[key]?.read || permissions[key]?.view);
  };

  const handleNav = (item: SectionItem) => {
    if (item.nav) {
      navigation.navigate(item.nav as any, item.params);
    } else {
      Alert.alert('Coming Soon', `${item.label} module is coming soon to the mobile app!`);
    }
  };

  // Helper to determine badge count for a specific module
  const getBadgeCount = (id: string) => {
    switch (id) {
      case 'appointments':
        return metrics?.appointments.value || 0;
      case 'inventory':
        return lowStockCount;
      case 'labs':
        return overdueLabsCount;
      default:
        return 0;
    }
  };

  const renderTile = (item: SectionItem) => {
    if (!canAccess(item)) return null;
    const { Icon, theme } = item;
    const badgeCount = getBadgeCount(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.tile, { backgroundColor: theme.bg }]}
        onPress={() => handleNav(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tileIconBox}>
          <Icon size={32} color={theme.icon} strokeWidth={2.2} />
          {badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tileLabel, { color: theme.text }]} numberOfLines={1}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={VIOLET} translucent />

      {/* ── Header ── */}
      <LinearGradient colors={['#2E2A85', '#393399']} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => navigation.navigate('ReceptionistProfile' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>{initials || 'RC'}</Text>
            </TouchableOpacity>

            <View style={styles.nameBlock}>
              <Text style={styles.hiText} numberOfLines={1}>
                Hi, {(backendUser?.name || 'Staff').split(' ')[0]}
              </Text>
              <Text style={styles.clinicText} numberOfLines={1}>
                {backendUser?.clinic?.name || 'Clinic'}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.iconBtn} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Bell size={20} color="#FFFFFF" strokeWidth={2} />
              <View style={styles.headerBadge} />
            </TouchableOpacity>
          </View>

          {/* 🔍 Simple Patient Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBarWrapper}>
              <Search size={22} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search patient by name or phone"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onFocus={handlePatientSearch}
                onChangeText={setSearchQuery}
                onSubmitEditing={handlePatientSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color="#94A3B8" style={styles.clearIcon} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Curved pocket ── */}
      <LinearGradient colors={['#393399', '#4338CA']} style={styles.pocket} />

      {/* ── Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={VIOLET} />
        }
      >
        <View style={styles.metricsRow}>
          <TouchableOpacity 
            style={[styles.metricCard, { marginRight: 12 }]} 
            onPress={() => navigation.navigate('Appointments' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.metricHeader}>
              <Calendar size={18} color="#4F46E5" strokeWidth={2.5} />
              <TrendingUp size={14} color="#10B981" strokeWidth={2.5} />
            </View>
            <Text style={styles.metricValue}>
              {metrics?.appointments.value || 0}
            </Text>
            <Text style={styles.metricLabel}>Today's Appointment</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.metricCard} 
            onPress={() => navigation.navigate('AllTransactions' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.metricHeader}>
              <TrendingUp size={18} color="#059669" strokeWidth={2.5} />
              <ArrowUpRight size={14} color="#10B981" strokeWidth={2.5} />
            </View>
            <Text style={styles.metricValue}>
              ₹{(metrics?.revenue.value || 0).toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Today's Revenue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tilesGrid}>
          {MODULES.map(renderTile)}
        </View>

        <Text style={styles.poweredBy}>Powered by MolarPlus</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingBottom: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  nameBlock: { flex: 1 },
  hiText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  clinicText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 2 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#393399',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: { marginRight: 12 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
    paddingVertical: 12,
  },
  clearIcon: { marginLeft: 10 },
  pocket: {
    height: 48,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
  },
  scroll: { flex: 1, marginTop: -30 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0 },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
  },
  tileIconBox: {
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 11, color: '#9CA3AF', fontWeight: '500',
    marginTop: 24, letterSpacing: 0.3,
  },
});
