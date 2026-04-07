import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, ChevronRight, Users, Clock, Shield, Search, Plus, X, Check,
} from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService, StaffMember } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';
import { format, startOfWeek, addWeeks, subWeeks, eachDayOfInterval, endOfWeek } from 'date-fns';

type Tab = 'staff' | 'attendance' | 'permissions';

const STAFF_FILTERS = ['All', 'Doctors', 'Receptionist', 'Inactive'];

const MODULES = [
  { key: 'dashboard',    label: 'Dashboard',    actions: ['read'] },
  { key: 'appointments', label: 'Appointments',  actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'patients',     label: 'Patients',      actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'finance',      label: 'Finance',       actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'inbox',        label: 'Inbox',         actions: ['read', 'write'] },
  { key: 'reports',      label: 'Reports',       actions: ['read'] },
  { key: 'lab',          label: 'Lab',           actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'consent',      label: 'Consent Forms', actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'marketing',    label: 'Marketing',     actions: ['read', 'write', 'edit'] },
  { key: 'staff',        label: 'Staff / Admin', actions: ['read', 'write', 'edit', 'delete'] },
];

const ALL_ACTIONS = ['read', 'write', 'edit', 'delete'] as const;

const ROLE_PRESETS: Record<string, Record<string, Record<string, boolean>>> = {
  doctor: {
    dashboard:    { read: true },
    appointments: { read: true, write: false, edit: true, delete: false },
    patients:     { read: true, write: false, edit: true, delete: false },
    finance:      { read: true, write: false, edit: false, delete: false },
    inbox:        { read: true, write: true },
    reports:      { read: true },
    lab:          { read: true, write: true, edit: true, delete: false },
    consent:      { read: true, write: true, edit: true, delete: false },
    marketing:    { read: false, write: false, edit: false },
    staff:        { read: false, write: false, edit: false, delete: false },
  },
  receptionist: {
    dashboard:    { read: true },
    appointments: { read: true, write: true, edit: true, delete: false },
    patients:     { read: true, write: true, edit: true, delete: false },
    finance:      { read: true, write: true, edit: false, delete: false },
    inbox:        { read: true, write: true },
    reports:      { read: false },
    lab:          { read: true, write: false, edit: false, delete: false },
    consent:      { read: true, write: true, edit: false, delete: false },
    marketing:    { read: false, write: false, edit: false },
    staff:        { read: false, write: false, edit: false, delete: false },
  },
};

const STATUS_COLORS: Record<string, string> = {
  on_time: '#10B981',
  late:    '#F59E0B',
  absent:  '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  on_time: 'On Time',
  late:    'Late',
  absent:  'Absent',
};

interface TeamScreenProps {
  navigation: any;
  route?: { params?: { initialTab?: Tab } };
}

export const TeamScreen: React.FC<TeamScreenProps> = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState<Tab>(route?.params?.initialTab || 'staff');

  // ── Staff tab state ──
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState('All');

  // ── Attendance tab state ──
  const [attLoading, setAttLoading] = useState(false);
  const [attData, setAttData] = useState<any>(null);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [attSearch, setAttSearch] = useState('');
  const [markModal, setMarkModal] = useState<{ emp: any; date: Date } | null>(null);
  const [markSaving, setMarkSaving] = useState(false);

  // ── Permissions tab state ──
  const [permsLoading, setPermsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [userPerms, setUserPerms] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleModal, setRoleModal] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  // Perm editor modal
  const [permModalUser, setPermModalUser] = useState<StaffMember | null>(null);
  const [permDraft, setPermDraft] = useState<Record<string, Record<string, boolean>>>({});
  const [permSaving, setPermSaving] = useState(false);

  // ── Load staff (shared across all tabs) ──
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const [members, availRoles] = await Promise.all([
        adminApiService.getStaff(),
        adminApiService.getRoles(),
      ]);
      setStaff(members);
      setRoles(availRoles);
      if (members.length > 0) {
        setSelectedMember(members[0]);
        loadUserPerms(members[0].id);
      }
    } catch (e) {
      console.error('❌ [Team] Staff load error:', e);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const loadUserPerms = async (userId: string) => {
    try {
      const p = await adminApiService.getUserPermissions(userId);
      setUserPerms(p);
    } catch (e) {
      console.error('❌ [Team] Perms load error:', e);
    }
  };

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const data = await adminApiService.getAttendanceForWeek(weekStr);
      setAttData(data);
    } catch (e) {
      console.error('❌ [Team] Attendance load error:', e);
    } finally {
      setAttLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => { if (activeTab === 'attendance') loadAttendance(); }, [activeTab, loadAttendance]);

  // ── Filtered staff ──
  const filteredStaff = useMemo(() => staff.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(staffSearch.toLowerCase());
    if (staffFilter === 'All') return matchSearch;
    if (staffFilter === 'Doctors') return matchSearch && (m.role === 'doctor' || m.role === 'dentist');
    if (staffFilter === 'Receptionist') return matchSearch && m.role === 'receptionist';
    if (staffFilter === 'Inactive') return matchSearch && !m.is_active;
    return matchSearch;
  }), [staff, staffSearch, staffFilter]);

  // ── Attendance helpers ──
  const weekDays = useMemo(() => eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }), [weekStart]);

  const filteredEmployees = useMemo(() => {
    if (!attData?.employees) return [];
    if (!attSearch) return attData.employees;
    return attData.employees.filter((e: any) =>
      e.name.toLowerCase().includes(attSearch.toLowerCase())
    );
  }, [attData, attSearch]);

  const handleMarkAttendance = async (status: string) => {
    if (!markModal) return;
    setMarkSaving(true);
    try {
      await adminApiService.markAttendance({
        user_id: markModal.emp.id,
        date: format(markModal.date, 'yyyy-MM-dd'),
        status,
      });
      setMarkModal(null);
      loadAttendance();
    } catch (e) {
      Alert.alert('Error', 'Failed to mark attendance');
    } finally {
      setMarkSaving(false);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedMember) return;
    setRoleSaving(true);
    try {
      const ok = await adminApiService.updateUserRole(selectedMember.id, newRole);
      if (ok) {
        const updated = staff.map(s => s.id === selectedMember.id ? { ...s, role: newRole } : s);
        setStaff(updated);
        setSelectedMember({ ...selectedMember, role: newRole });
        setRoleModal(false);
        Alert.alert('Updated', `Role changed to ${newRole}`);
      } else {
        Alert.alert('Error', 'Failed to update role');
      }
    } catch (e) {
      Alert.alert('Error', 'Unexpected error');
    } finally {
      setRoleSaving(false);
    }
  };

  const selectPermsMember = (m: StaffMember) => {
    setSelectedMember(m);
    setUserPerms(null);
    loadUserPerms(m.id);
  };

  const openPermModal = async (m: StaffMember) => {
    setPermModalUser(m);
    const p = await adminApiService.getUserPermissions(m.id).catch(() => null);
    const saved = p?.permissions || {};
    const draft: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(mod => {
      draft[mod.key] = {};
      mod.actions.forEach(a => { draft[mod.key][a] = saved[mod.key]?.[a] === true; });
    });
    setPermDraft(draft);
  };

  const applyPermPreset = (role: string) => {
    const preset = ROLE_PRESETS[role] || {};
    const draft: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(mod => {
      draft[mod.key] = {};
      mod.actions.forEach(a => { draft[mod.key][a] = preset[mod.key]?.[a] ?? false; });
    });
    setPermDraft(draft);
  };

  const togglePerm = (mod: string, action: string) => {
    setPermDraft(prev => ({ ...prev, [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] } }));
  };

  const savePerms = async () => {
    if (!permModalUser) return;
    setPermSaving(true);
    try {
      await adminApiService.updateStaffMember(permModalUser.id, { permissions: permDraft });
      Alert.alert('Saved', 'Permissions updated successfully.');
      setPermModalUser(null);
    } catch {
      Alert.alert('Error', 'Failed to save permissions.');
    } finally {
      setPermSaving(false);
    }
  };

  const attStats = useMemo(() => {
    if (!attData?.employees) return { onTime: 0, late: 0, absent: 0 };
    let onTime = 0, late = 0, absent = 0, total = 0;
    attData.employees.forEach((e: any) => {
      weekDays.forEach(d => {
        const rec = e.attendance?.[format(d, 'yyyy-MM-dd')];
        if (rec) {
          total++;
          if (rec.status === 'on_time') onTime++;
          else if (rec.status === 'late') late++;
          else if (rec.status === 'absent') absent++;
        }
      });
    });
    const t = total || 1;
    return { onTime: Math.round((onTime / t) * 100), late: Math.round((late / t) * 100), absent: Math.round((absent / t) * 100) };
  }, [attData, weekDays]);

  // ─────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────

  const renderStaffTab = () => (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search staff..."
          placeholderTextColor="#9CA3AF"
          value={staffSearch}
          onChangeText={setStaffSearch}
        />
      </View>
      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {STAFF_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, staffFilter === f && styles.filterChipActive]}
            onPress={() => setStaffFilter(f)}
          >
            <Text style={[styles.filterChipText, staffFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* List */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 10 }}>
        {filteredStaff.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No staff members found.</Text></View>
        ) : (
          filteredStaff.map(m => (
            <View key={m.id} style={styles.staffCard}>
              <View style={styles.staffAvatar}>
                <Text style={styles.staffInitial}>{m.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{m.name}</Text>
                <Text style={styles.staffRole}>{m.role.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.staffEmail} numberOfLines={1}>{m.email}</Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: m.is_active ? '#10B981' : '#D1D5DB' }]} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderAttendanceTab = () => (
    <View style={{ flex: 1 }}>
      {/* Week Nav */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekStart(prev => subWeeks(prev, 1))}>
          <ChevronLeft size={18} color={adminColors.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.weekLabel}>
            {format(weekStart, 'MMM d')} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </Text>
        </View>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekStart(prev => addWeeks(prev, 1))}>
          <ChevronRight size={18} color={adminColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'On Time', value: `${attStats.onTime}%`, color: '#10B981' },
          { label: 'Late',    value: `${attStats.late}%`,   color: '#F59E0B' },
          { label: 'Absent',  value: `${attStats.absent}%`, color: '#EF4444' },
        ].map(s => (
          <View key={s.label} style={[styles.statChip, { borderColor: s.color }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { marginHorizontal: 16, marginBottom: 8 }]}>
        <Search size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search employees..."
          placeholderTextColor="#9CA3AF"
          value={attSearch}
          onChangeText={setAttSearch}
        />
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        <View style={{ width: 110 }} />
        {weekDays.map(d => (
          <View key={d.toISOString()} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderDay}>{format(d, 'EEE')}</Text>
            <Text style={styles.dayHeaderDate}>{format(d, 'd')}</Text>
          </View>
        ))}
      </View>

      {attLoading ? (
        <View style={styles.center}><ActivityIndicator color={adminColors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {filteredEmployees.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No employees found.</Text></View>
          ) : filteredEmployees.map((emp: any) => (
            <View key={emp.id} style={styles.attRow}>
              <View style={styles.attEmpCell}>
                <View style={styles.attAvatar}>
                  <Text style={styles.staffInitial}>{emp.name?.charAt(0)}</Text>
                </View>
                <Text style={styles.attEmpName} numberOfLines={1}>{emp.name?.split(' ')[0]}</Text>
              </View>
              {weekDays.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const rec = emp.attendance?.[key];
                const statusColor = rec ? STATUS_COLORS[rec.status] || '#9CA3AF' : '#F3F4F6';
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.attCell, { backgroundColor: statusColor + (rec ? '20' : '') }]}
                    onPress={() => setMarkModal({ emp, date: d })}
                  >
                    {rec ? (
                      <View style={[styles.attDot, { backgroundColor: statusColor }]} />
                    ) : (
                      <Text style={styles.attDash}>–</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderPermissionsTab = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={styles.sectionLabel}>STAFF MEMBERS</Text>
      </View>
      {staff.map(m => {
        const initials = m.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <TouchableOpacity
            key={m.id}
            style={styles.permStaffRow}
            onPress={() => openPermModal(m)}
            activeOpacity={0.7}
          >
            <View style={styles.staffAvatar}>
              <Text style={styles.staffInitial}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{m.name}</Text>
              <Text style={styles.staffRole}>{m.role?.replace('_', ' ')}</Text>
            </View>
            <View style={styles.permEditBtn}>
              <Text style={styles.permEditBtnText}>Edit</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
      <SafeAreaView style={{ backgroundColor: adminColors.gradientStart }} edges={['top']}>
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Team</Text>
              <Text style={styles.headerSub}>{staff.length} member{staff.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => Alert.alert('Coming Soon', 'Staff onboarding via mobile is coming soon.')}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>

        </LinearGradient>
      </SafeAreaView>

      {/* Tab bar — simple underline style */}
      <View style={styles.tabBar}>
        {(['staff', 'attendance', 'permissions'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {staffLoading ? (
        <View style={styles.center}><GearLoader text="Loading team..." /></View>
      ) : (
        <>
          {activeTab === 'staff'       && renderStaffTab()}
          {activeTab === 'attendance'  && renderAttendanceTab()}
          {activeTab === 'permissions' && renderPermissionsTab()}
        </>
      )}

      {/* ── Permission Editor Modal ── */}
      <Modal visible={!!permModalUser} animationType="slide" transparent onRequestClose={() => setPermModalUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { maxHeight: '90%' }]}>
            <View style={styles.sheetHandle} />
            {/* User header */}
            {permModalUser && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={styles.staffAvatar}>
                  <Text style={styles.staffInitial}>{permModalUser.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{permModalUser.name}</Text>
                  <Text style={styles.staffRole}>{permModalUser.role?.replace('_', ' ')}</Text>
                </View>
                <TouchableOpacity onPress={() => setPermModalUser(null)} style={styles.closeBtn}>
                  <X size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}
            {/* Presets */}
            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>QUICK PRESETS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['doctor', 'receptionist'] as const).map(role => (
                  <TouchableOpacity
                    key={role}
                    style={styles.presetBtn}
                    onPress={() => applyPermPreset(role)}
                  >
                    <Text style={styles.presetBtnText}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* Permission matrix header */}
            <View style={styles.permMatrixHeader}>
              <Text style={[styles.permMatrixCell, { flex: 2, textAlign: 'left' }]}>MODULE</Text>
              {ALL_ACTIONS.map(a => (
                <Text key={a} style={styles.permMatrixCell}>{a.toUpperCase()}</Text>
              ))}
            </View>
            {/* Module rows */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {MODULES.map((mod, idx) => (
                <View key={mod.key} style={[styles.permMatrixRow, idx % 2 === 1 && { backgroundColor: '#F9FAFB' }]}>
                  <Text style={[styles.permModuleLabel, { flex: 2 }]}>{mod.label}</Text>
                  {ALL_ACTIONS.map(a => (
                    <View key={a} style={styles.permSwitchCell}>
                      {mod.actions.includes(a) ? (
                        <Switch
                          value={!!permDraft[mod.key]?.[a]}
                          onValueChange={() => togglePerm(mod.key, a)}
                          trackColor={{ false: '#E5E7EB', true: adminColors.primary + '60' }}
                          thumbColor={permDraft[mod.key]?.[a] ? adminColors.primary : '#D1D5DB'}
                          ios_backgroundColor="#E5E7EB"
                        />
                      ) : (
                        <Text style={{ color: '#E5E7EB', fontSize: 16 }}>—</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            {/* Footer */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.mCancel} onPress={() => setPermModalUser(null)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mSave, permSaving && { opacity: 0.6 }]}
                onPress={savePerms}
                disabled={permSaving}
              >
                {permSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Save Permissions</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark Attendance Modal */}
      <Modal visible={!!markModal} transparent animationType="slide" onRequestClose={() => setMarkModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMarkModal(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Mark Attendance — {markModal ? format(markModal.date, 'EEE, MMM d') : ''}
            </Text>
            <Text style={styles.sheetSub}>{markModal?.emp?.name}</Text>
            {markSaving ? (
              <ActivityIndicator color={adminColors.primary} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.statusBtns}>
                {(['on_time', 'late', 'absent'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusBtn, { backgroundColor: STATUS_COLORS[s] + '15', borderColor: STATUS_COLORS[s] }]}
                    onPress={() => handleMarkAttendance(s)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s], width: 10, height: 10 }]} />
                    <Text style={[styles.statusBtnText, { color: STATUS_COLORS[s] }]}>{STATUS_LABELS[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 24 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Role Picker Modal */}
      <Modal visible={roleModal} transparent animationType="slide" onRequestClose={() => setRoleModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRoleModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={styles.sheetTitle}>Assign System Role</Text>
              <TouchableOpacity onPress={() => setRoleModal(false)} style={styles.closeBtn}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {roleSaving ? (
              <ActivityIndicator color={adminColors.primary} />
            ) : (
              <View style={{ gap: 10 }}>
                {roles.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleOption, selectedMember?.role === r.value && styles.roleOptionActive]}
                    onPress={() => handleUpdateRole(r.value)}
                  >
                    <View style={[styles.roleCheck, selectedMember?.role === r.value && styles.roleCheckActive]}>
                      {selectedMember?.role === r.value && <Check size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleLabel}>{r.label}</Text>
                      {r.description && <Text style={styles.roleDesc}>{r.description}</Text>}
                    </View>
                    <ChevronRight size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 32 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F9FAFB' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:       { alignItems: 'center', padding: 40 },
  emptyText:   { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },

  // Header
  header:      { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  addBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Tab bar
  tabBar:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn:         { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: adminColors.primary },
  tabLabel:       { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  tabLabelActive: { color: adminColors.primary, fontWeight: '700' },

  // Search & filters
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, margin: 16, marginBottom: 8, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  filtersRow:  { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: adminColors.primary, borderColor: adminColors.primary },
  filterChipText:   { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // Staff cards
  staffCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  staffAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2F2', justifyContent: 'center', alignItems: 'center' },
  staffInitial: { fontSize: 18, fontWeight: '700', color: adminColors.primary },
  staffName:   { fontSize: 15, fontWeight: '700', color: '#111827' },
  staffRole:   { fontSize: 11, fontWeight: '600', color: '#6B7280', marginTop: 1 },
  staffEmail:  { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  statusDot:   { width: 8, height: 8, borderRadius: 4 },

  // Attendance
  weekNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  weekBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2F2', justifyContent: 'center', alignItems: 'center' },
  weekLabel:   { fontSize: 14, fontWeight: '700', color: '#111827' },
  statsRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  statChip:    { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, paddingVertical: 8 },
  statValue:   { fontSize: 15, fontWeight: '800' },
  statLabel:   { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  dayHeaders:  { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayHeaderDay:  { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  dayHeaderDate: { fontSize: 12, fontWeight: '700', color: '#111827', marginTop: 1 },
  attRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  attEmpCell:  { width: 110, flexDirection: 'row', alignItems: 'center', gap: 6 },
  attAvatar:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0F2F2', justifyContent: 'center', alignItems: 'center' },
  attEmpName:  { fontSize: 12, fontWeight: '600', color: '#111827', flex: 1 },
  attCell:     { flex: 1, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  attDot:      { width: 8, height: 8, borderRadius: 4 },
  attDash:     { fontSize: 14, color: '#D1D5DB' },

  // Permissions
  sectionLabel:       { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 12 },
  permStaffRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  permEditBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: adminColors.primary },
  permEditBtnText:    { fontSize: 12, fontWeight: '600', color: adminColors.primary },
  permMatrixHeader:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginBottom: 4 },
  permMatrixCell:     { flex: 1, fontSize: 9, fontWeight: '700', color: '#9CA3AF', textAlign: 'center', letterSpacing: 0.5 },
  permMatrixRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6 },
  permModuleLabel:    { fontSize: 13, fontWeight: '500', color: '#374151' },
  permSwitchCell:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  presetBtn:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#E0F2F2', borderWidth: 1, borderColor: adminColors.primary + '40' },
  presetBtnText:      { fontSize: 12, fontWeight: '600', color: adminColors.primary },
  // legacy (kept for role modal)
  accountCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  shieldBox:          { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E0F2F2', justifyContent: 'center', alignItems: 'center' },
  changeRoleBtn:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  changeRoleText:     { fontSize: 9, fontWeight: '800', color: adminColors.primary },
  roleBadge:          { alignSelf: 'flex-start', backgroundColor: '#E0F2F2', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  roleBadgeText:      { fontSize: 10, fontWeight: '700', color: adminColors.primary },
  noPerms:            { alignItems: 'center', padding: 32, gap: 12, backgroundColor: '#fff', borderRadius: 16 },
  noPermsText:        { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // Modals
  mCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' as const },
  mSave:   { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: adminColors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  sheetHandle:   { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:    { fontSize: 17, fontWeight: '700', color: '#111827' },
  sheetSub:      { fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 16 },
  statusBtns:    { gap: 12, marginTop: 8 },
  statusBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  statusBtnText: { fontSize: 15, fontWeight: '700' },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  roleOption:    { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', gap: 14 },
  roleOptionActive: { backgroundColor: '#F0F9FF', borderColor: adminColors.primary },
  roleCheck:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  roleCheckActive: { backgroundColor: adminColors.primary, borderColor: adminColors.primary },
  roleLabel:     { fontSize: 14, fontWeight: '700', color: '#111827' },
  roleDesc:      { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
