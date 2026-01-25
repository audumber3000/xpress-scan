import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, MoreVertical, X, UserCircle2, Clock, CheckCircle2, History, TrendingUp, ChevronRight } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AttendanceScreenProps {
  navigation: any;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ navigation }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const weekStr = format(currentWeekStart, 'yyyy-MM-dd');
      const response = await adminApiService.getAttendanceForWeek(weekStr);
      setData(response);
    } catch (err) {
      console.error('❌ [ATTENDANCE] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [currentWeekStart]);

  const stats = useMemo(() => {
    if (!data?.employees) return { onTime: 0, late: 0, absent: 0 };
    let onTime = 0, late = 0, absent = 0;
    data.employees.forEach((emp: any) => {
      Object.values(emp.attendance || {}).forEach((record: any) => {
        if (record.status === 'on_time') onTime++;
        else if (record.status === 'late') late++;
        else if (record.status === 'absent') absent++;
      });
    });
    return { onTime, late, absent };
  }, [data]);

  const handleStaffPress = (staff: any) => {
    setSelectedStaff(staff);
    setIsModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Attendance Hub</Text>
          <Text style={styles.headerSubtitle}>Week of {format(currentWeekStart, 'MMM dd')}</Text>
        </View>
        <TouchableOpacity style={styles.calendarBtn}>
          <Calendar size={20} color={adminColors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
          <Text style={styles.navText}>PREVIOUS WEEK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          <Text style={styles.todayText}>TODAY</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
          <Text style={styles.navText}>NEXT WEEK</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <GearLoader text="Syncing attendance records..." />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={[styles.statItem, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Text style={[styles.statVal, { color: '#3b82f6' }]}>{stats.onTime}</Text>
              <Text style={styles.statLabel}>ON TIME</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Text style={[styles.statVal, { color: '#f59e0b' }]}>{stats.late}</Text>
              <Text style={styles.statLabel}>LATE</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Text style={[styles.statVal, { color: '#ef4444' }]}>{stats.absent}</Text>
              <Text style={styles.statLabel}>ABSENT</Text>
            </View>
          </View>

          <View style={styles.staffGrid}>
            <Text style={styles.gridTitle}>STAFF BREAKDOWN</Text>
            {data?.employees?.map((emp: any) => (
              <TouchableOpacity
                key={emp.id}
                style={styles.staffRow}
                onPress={() => handleStaffPress(emp)}
              >
                <View style={styles.staffInfo}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarText}>{emp.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.staffName}>{emp.name}</Text>
                    <Text style={styles.staffRole}>{(emp.role || 'Staff').toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.statusPreview}>
                  <TrendingUp size={14} color="#10B981" />
                  <Text style={styles.previewText}>View History</Text>
                  <ChevronRight size={14} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Staff Details Modal - Bottom Tray */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.bottomTray}>
            <View style={styles.trayHandle} />
            <View style={styles.trayHeader}>
              <View style={styles.trayAvatar}>
                <Text style={styles.trayAvatarText}>{selectedStaff?.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trayTitle}>{selectedStaff?.name}</Text>
                <Text style={styles.traySubtitle}>{(selectedStaff?.role || 'Staff').toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.trayContent} showsVerticalScrollIndicator={false}>
              <View style={styles.historyHeading}>
                <History size={16} color="#9CA3AF" />
                <Text style={styles.historyTitle}>WEEKLY LOG</Text>
              </View>

              {Object.entries(selectedStaff?.attendance || {}).length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Clock size={40} color="#E5E7EB" />
                  <Text style={styles.emptyHistoryText}>No records for this week.</Text>
                </View>
              ) : (
                Object.entries(selectedStaff?.attendance || {}).map(([date, record]: [string, any]) => (
                  <View key={date} style={styles.historyRow}>
                    <View>
                      <Text style={styles.logDate}>{format(new Date(date), 'EEEE, MMM dd')}</Text>
                      {record.reason && <Text style={styles.logReason}>{record.reason}</Text>}
                    </View>
                    <View style={[
                      styles.logBadge,
                      { backgroundColor: record.status === 'on_time' ? '#D1FAE5' : record.status === 'late' ? '#FEF3C7' : '#FEE2E2' }
                    ]}>
                      <Text style={[
                        styles.logBadgeText,
                        { color: record.status === 'on_time' ? '#065F46' : record.status === 'late' ? '#92400E' : '#991B1B' }
                      ]}>
                        {record.status?.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  calendarBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  navText: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF' },
  todayBtn: { backgroundColor: adminColors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  todayText: { fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsBar: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statVal: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 10, fontWeight: '700', marginTop: 4, opacity: 0.7 },
  staffGrid: { paddingHorizontal: 20 },
  gridTitle: { fontSize: 11, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 12, letterSpacing: 1 },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  staffInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2F2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2D9596', fontWeight: 'bold', fontSize: 16 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  staffRole: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  statusPreview: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomTray: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.8 },
  trayHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  trayHeader: { flexDirection: 'row', alignItems: 'center', padding: 24, gap: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  trayAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E0F2F2', alignItems: 'center', justifyContent: 'center' },
  trayAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#2D9596' },
  trayTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  traySubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  closeBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  trayContent: { padding: 24 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  historyTitle: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  logDate: { fontSize: 14, fontWeight: '700', color: '#344054' },
  logReason: { fontSize: 12, color: '#667085', marginTop: 2 },
  logBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  logBadgeText: { fontSize: 10, fontWeight: 'bold' },
  emptyHistory: { alignItems: 'center', padding: 40, gap: 12 },
  emptyHistoryText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
});
