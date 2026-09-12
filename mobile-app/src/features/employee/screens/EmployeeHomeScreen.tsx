import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Calendar, Clock, ClipboardList, CreditCard, FileText, FlaskConical, HelpCircle,
  Package, Settings2, Stethoscope, User, Users, Wallet,
} from 'lucide-react-native';
import { useAuth } from '../../../app/AuthContext';
import { colors } from '../../../shared/constants/colors';
import { resolveUserPhoto } from '../../../shared/utils/avatar';
import {
  WelcomeHeaderBackground,
  WelcomeHeaderTopPart,
  WelcomeHeaderStats,
} from '../../clinic-owner/home/screens/Home/components/WelcomeHeader';
import { Period } from '../../../shared/components/home/PeriodFilter';
import { analyticsApiService, Analytics } from '../../../services/api/analytics.api';
import { utilitiesApiService } from '../../../services/api/utilities.api';
import { can } from '../permissions';
import { ModuleGrid, ModuleItem } from '../components/ModuleGrid';

/**
 * Home for everybody who is not the clinic owner.
 *
 * The same screen the owner opens, with the same greeting bar and the same four
 * figures on the same indigo block, and a menu underneath instead of the charts.
 * Staff had their own pastel grid before, which read as a different product.
 *
 * The only two differences are the ones that have to be there: the plan chip
 * belongs to the owner, and every tile below is gated by the same rule the
 * server uses (see ../permissions), so a menu item never leads to a 403.
 */
/** A shift is today or it was yesterday. The longer ranges are the owner's. */
const STAFF_PERIODS: Period[] = ['today', 'yesterday'];

export const EmployeeHomeScreen: React.FC<any> = ({ navigation }) => {
  const { user, backendUser } = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lowStock, setLowStock] = useState(0);
  const [overdueLabs, setOverdueLabs] = useState(0);

  const seesMoney = can(backendUser, 'view', 'billing');
  const seesAppointments = can(backendUser, 'view', 'appointments');
  const seesPatients = can(backendUser, 'view', 'patients');
  const seesInventory = can(backendUser, 'view', 'inventory');
  const seesLab = can(backendUser, 'view', 'lab');

  const load = useCallback(async () => {
    const [stats, inventory, labs] = await Promise.all([
      analyticsApiService.getAnalytics(period).catch(() => null),
      seesInventory ? utilitiesApiService.getInventory().catch(() => []) : Promise.resolve([]),
      seesLab ? utilitiesApiService.getLabOrders().catch(() => []) : Promise.resolve([]),
    ]);
    if (stats) setAnalytics(stats);

    setLowStock((inventory || []).filter((i: any) => i.quantity <= i.min_stock_level).length);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    setOverdueLabs((labs || []).filter((o: any) => {
      if (String(o.status || '').toLowerCase() === 'completed' || !o.due_date) return false;
      const due = new Date(o.due_date);
      return !isNaN(due.getTime()) && due < startOfToday;
    }).length);

    setLoading(false);
  }, [period, seesInventory, seesLab]);

  useEffect(() => { load(); }, [load]);

  // Coming back from a tile should show what changed while it was open.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const menu: ModuleItem[] = [
    seesAppointments && {
      key: 'appointments', label: 'Appointments', Icon: Calendar,
      onPress: () => navigation.navigate('Appointments'),
    },
    seesPatients && {
      key: 'patients', label: 'Patients', Icon: Users,
      onPress: () => navigation.navigate('Patients'),
    },
    seesMoney && {
      key: 'billing', label: 'Billing', Icon: CreditCard,
      onPress: () => navigation.navigate('AllTransactions'),
    },
    seesInventory && {
      key: 'inventory', label: 'Inventory', Icon: Package, badge: lowStock,
      onPress: () => navigation.navigate('Utilities', { initialTab: 'inventory' }),
    },
    seesLab && {
      key: 'lab', label: 'Lab work', Icon: FlaskConical, badge: overdueLabs,
      onPress: () => navigation.navigate('Utilities', { initialTab: 'lab' }),
    },
    can(backendUser, 'view', 'consent') && {
      key: 'consent', label: 'Consent forms', Icon: FileText,
      onPress: () => navigation.navigate('Utilities', { initialTab: 'consent' }),
    },
    { key: 'clock', label: 'Clock in / out', Icon: Clock, onPress: () => navigation.navigate('ClockIn') },
    {
      key: 'attendance', label: 'My attendance', Icon: ClipboardList,
      onPress: () => navigation.navigate('EmployeeAttendance'),
    },

    // Delegated Control Center screens. Empty for most people, and the server
    // checks every one of them again. A doctor who was given one of these kept
    // it through the Control Center tab, which they no longer have.
    can(backendUser, 'view', 'users') && {
      key: 'team', label: 'Team', Icon: Users,
      onPress: () => navigation.navigate('Team', { initialTab: 'staff' }),
    },
    can(backendUser, 'view', 'attendance') && {
      key: 'team-attendance', label: 'Team attendance', Icon: ClipboardList,
      onPress: () => navigation.navigate('Attendance'),
    },
    can(backendUser, 'edit', 'billing') && {
      key: 'pricing', label: 'Treatments', Icon: Stethoscope,
      onPress: () => navigation.navigate('TreatmentsPricing'),
    },
    seesMoney && {
      key: 'expenses', label: 'Expenses', Icon: Wallet,
      onPress: () => navigation.navigate('UtilitySection', { section: 'expenses' }),
    },
    can(backendUser, 'edit', 'settings') && {
      key: 'templates', label: 'Documents', Icon: Settings2,
      onPress: () => navigation.navigate('Templates'),
    },

    { key: 'profile', label: 'Settings', Icon: User, onPress: () => navigation.navigate('Profile') },
    { key: 'help', label: 'Help', Icon: HelpCircle, onPress: () => navigation.navigate('HelpSupport') },
  ].filter(Boolean) as ModuleItem[];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#2E2A85" translucent={false} />
      <WelcomeHeaderBackground />

      <WelcomeHeaderTopPart
        userName={backendUser?.name || 'there'}
        clinicName={backendUser?.clinic?.name}
        photoURL={resolveUserPhoto(backendUser, user)}
        avatarSeed={user?.email || backendUser?.email}
        onProfilePress={() => navigation.navigate('Profile')}
        onNotificationPress={() => navigation.navigate('Inbox')}
        showPlanChip={false}
        loading={loading}
        dailyRevenue={analytics?.dailyRevenue || 0}
        totalPatients={analytics?.totalPatients || 0}
        totalAppointments={analytics?.appointments || 0}
        totalChecking={analytics?.checking || 0}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <WelcomeHeaderStats
          analytics={analytics}
          loading={loading}
          period={period}
          onPeriodChange={setPeriod}
          periods={STAFF_PERIODS}
          onAddInvoice={seesMoney ? () => navigation.navigate('AllTransactions') : undefined}
          onAddPatient={seesPatients ? () => navigation.navigate('Patients') : undefined}
          onAddAppointment={seesAppointments ? () => navigation.navigate('AddAppointment') : undefined}
          onOutstandingPress={seesMoney
            ? () => navigation.navigate('AllTransactions', { tab: 'payments', filter: 'unpaid' })
            : undefined}
          onAppointmentsPress={seesAppointments ? () => navigation.navigate('Appointments') : undefined}
        />

        <ModuleGrid items={menu} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  body: { flex: 1 },
  // The stats block paints its own indigo, so the scroll view must not show the
  // page background above it while the list bounces.
  bodyContent: { paddingBottom: 40, backgroundColor: colors.screenBg },
});

export default EmployeeHomeScreen;
