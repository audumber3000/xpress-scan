import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Shield, Check, Lock, ChevronRight, X, UserCircle2, Mail, Users, UserCheck } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService, StaffMember } from '../../../../services/api/admin.api';
import { GearLoader } from '../../../../shared/components/GearLoader';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PermissionsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [userPerms, setUserPerms] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const init = async () => {
    setLoading(true);
    try {
      const [members, availableRoles] = await Promise.all([
        adminApiService.getStaff(),
        adminApiService.getRoles()
      ]);
      setStaff(members);
      setRoles(availableRoles);
      if (members.length > 0) {
        handleStaffSelect(members[0]);
      }
    } catch (err) {
      console.error('❌ [PERMS] Init error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const handleStaffSelect = async (member: StaffMember) => {
    setSelectedStaff(member);
    try {
      const perms = await adminApiService.getUserPermissions(member.id);
      setUserPerms(perms);
    } catch (err) {
      console.error('❌ [PERMS] Fetch error:', err);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      const success = await adminApiService.updateUserRole(selectedStaff.id, newRole);
      if (success) {
        setIsModalVisible(false);
        // Update local state roles to avoid fetch if possible, but simpler to just re-fetch
        const updatedStaff = staff.map(s => s.id === selectedStaff.id ? { ...s, role: newRole } : s);
        setStaff(updatedStaff);
        setSelectedStaff({ ...selectedStaff, role: newRole });
        handleStaffSelect({ ...selectedStaff, role: newRole });
        Alert.alert('Success', `Role updated to ${newRole.toUpperCase()}`);
      } else {
        Alert.alert('Error', 'Failed to update role');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <GearLoader text="Syncing access controls..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Access Control</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Staff Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT STAFF MEMBER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffTray}>
            {staff.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.staffBtn, selectedStaff?.id === m.id && styles.staffBtnActive]}
                onPress={() => handleStaffSelect(m)}
              >
                <View style={[styles.staffAvatar, selectedStaff?.id === m.id && { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.staffInitial, selectedStaff?.id === m.id && { color: adminColors.primary }]}>
                    {m.name.charAt(0)}
                  </Text>
                </View>
                <Text style={[styles.staffNameShort, selectedStaff?.id === m.id && { color: adminColors.primary, fontWeight: 'bold' }]} numberOfLines={1}>
                  {m.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Account Info */}
        <View style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <View style={styles.roleIconBox}>
              <Shield size={24} color={adminColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{selectedStaff?.name}</Text>
              <Text style={styles.accountEmail}>{selectedStaff?.email}</Text>
            </View>
            <TouchableOpacity style={styles.changeRoleBtn} onPress={() => setIsModalVisible(true)}>
              <Text style={styles.changeRoleText}>CHANGE ROLE</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.roleBadgeBox}>
            <View style={[styles.roleBadge, { backgroundColor: '#E0F2F2' }]}>
              <Text style={[styles.roleBadgeText, { color: adminColors.primary }]}>
                {(selectedStaff?.role || 'staff').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Permissions Visualization */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVE PERMISSIONS</Text>
          <View style={styles.permsGrid}>
            {userPerms?.permissions && Object.keys(userPerms.permissions).length > 0 ? Object.entries(userPerms.permissions).map(([module, actions]: [string, any]) => (
              <View key={module} style={styles.permRow}>
                <View style={styles.permModule}>
                  <Text style={styles.moduleName}>{module.toUpperCase()}</Text>
                </View>
                <View style={styles.actionCluster}>
                  {actions.map((act: string) => (
                    <View key={act} style={styles.actionChip}>
                      <Check size={10} color="#10B981" />
                      <Text style={styles.actionText}>{act.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )) : (
              <View style={styles.emptyPerms}>
                <Lock size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>No manual overrides active.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Permissions are inherited from the assigned role. To modify individual access, use the web management portal.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Role Picker Bottom Tray */}
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
              <Text style={styles.trayTitle}>Assign System Role</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.trayContent}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleOption, selectedStaff?.role === r.value && styles.roleOptionActive]}
                  onPress={() => handleUpdateRole(r.value)}
                  disabled={saving}
                >
                  <View style={[styles.roleCheck, selectedStaff?.role === r.value && styles.roleCheckActive]}>
                    {selectedStaff?.role === r.value && <Check size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleLabel}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.description}</Text>
                  </View>
                  <ChevronRight size={18} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 40 }} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  content: { flex: 1 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionLabel: { fontSize: 11, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1, marginBottom: 16 },
  staffTray: { gap: 16, paddingRight: 20 },
  staffBtn: { alignItems: 'center', gap: 8, width: 70 },
  staffBtnActive: { opacity: 1 },
  staffAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F3F4F6' },
  staffInitial: { fontSize: 18, fontWeight: 'bold', color: '#4F46E5' },
  staffNameShort: { fontSize: 11, color: '#6B7280' },
  accountCard: { margin: 20, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  accountName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  accountEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  changeRoleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  changeRoleText: { fontSize: 10, fontWeight: 'bold', color: adminColors.primary },
  roleBadgeBox: { marginTop: 16, flexDirection: 'row' },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  roleBadgeText: { fontSize: 10, fontWeight: 'bold' },
  permsGrid: { gap: 12 },
  permRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  permModule: { marginBottom: 8 },
  moduleName: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },
  actionCluster: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  actionText: { fontSize: 9, fontWeight: 'bold', color: '#166534' },
  emptyPerms: { alignItems: 'center', padding: 40, backgroundColor: '#FFFFFF', borderRadius: 20, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
  disclaimer: { margin: 20, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12 },
  disclaimerText: { fontSize: 11, color: '#92400E', lineHeight: 16, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomTray: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  trayHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  trayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  trayTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  closeBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },
  trayContent: { padding: 24, gap: 12 },
  roleOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', gap: 16 },
  roleOptionActive: { backgroundColor: '#F0F9FF', borderColor: '#0EA5E9' },
  roleCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  roleCheckActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  roleLabel: { fontSize: 15, fontWeight: 'bold', color: '#344054' },
  roleDesc: { fontSize: 12, color: '#667085', marginTop: 2 },
});
