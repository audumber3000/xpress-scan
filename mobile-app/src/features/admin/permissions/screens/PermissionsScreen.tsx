import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, AlertTriangle, FileText, Edit, Trash2, Lock } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';

interface PermissionsScreenProps {
  navigation: any;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ navigation }) => {
  const [selectedRole, setSelectedRole] = useState('Dentist');
  const [permissions, setPermissions] = useState({
    viewRecords: true,
    editClinicalData: true,
    deleteRecords: false,
    viewInvoices: false,
    processPayments: false,
  });

  const roles = ['Owner', 'Dentist', 'Staff'];

  const togglePermission = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color={adminColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions</Text>
        <TouchableOpacity>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Role Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT ROLE</Text>
          <View style={styles.roleSelector}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  selectedRole === role && styles.roleButtonActive,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Text style={[
                  styles.roleText,
                  selectedRole === role && styles.roleTextActive,
                ]}>
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Role Description */}
        <View style={styles.infoBox}>
          <AlertTriangle size={20} color={adminColors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>DENTIST ROLE SELECTED</Text>
            <Text style={styles.infoText}>
              Focused on clinical workflows, patient records, and treatment planning. Limited access to financial data.
            </Text>
          </View>
        </View>

        {/* Patient Module */}
        <View style={styles.moduleSection}>
          <View style={styles.moduleHeader}>
            <Text style={styles.moduleTitle}>Patient Module</Text>
            <Text style={styles.actionsCount}>3 ACTIONS</Text>
          </View>

          <View style={styles.permissionsList}>
            <View style={styles.permissionItem}>
              <View style={styles.permissionLeft}>
                <View style={[styles.permissionIcon, { backgroundColor: '#E0F2F2' }]}>
                  <FileText size={20} color={adminColors.primary} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionName}>View Records</Text>
                  <Text style={styles.permissionDesc}>Access all clinical charts and medical history</Text>
                </View>
              </View>
              <Switch
                value={permissions.viewRecords}
                onValueChange={() => togglePermission('viewRecords')}
                trackColor={{ false: '#E5E7EB', true: adminColors.primaryLight }}
                thumbColor={permissions.viewRecords ? adminColors.primary : '#9CA3AF'}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.permissionItem}>
              <View style={styles.permissionLeft}>
                <View style={[styles.permissionIcon, { backgroundColor: '#E0F2F2' }]}>
                  <Edit size={20} color={adminColors.primary} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionName}>Edit Clinical Data</Text>
                  <Text style={styles.permissionDesc}>Modify treatment plans and soap notes</Text>
                </View>
              </View>
              <Switch
                value={permissions.editClinicalData}
                onValueChange={() => togglePermission('editClinicalData')}
                trackColor={{ false: '#E5E7EB', true: adminColors.primaryLight }}
                thumbColor={permissions.editClinicalData ? adminColors.primary : '#9CA3AF'}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.permissionItem}>
              <View style={styles.permissionLeft}>
                <View style={[styles.permissionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Trash2 size={20} color="#EF4444" />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionName}>Delete Records</Text>
                  <View style={styles.warningBadge}>
                    <AlertTriangle size={12} color="#F59E0B" />
                    <Text style={styles.warningText}>HIGH RISK ACTION</Text>
                  </View>
                </View>
              </View>
              <Switch
                value={permissions.deleteRecords}
                onValueChange={() => togglePermission('deleteRecords')}
                trackColor={{ false: '#E5E7EB', true: adminColors.primaryLight }}
                thumbColor={permissions.deleteRecords ? adminColors.primary : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Billing & Finance */}
        <View style={styles.moduleSection}>
          <View style={styles.moduleHeader}>
            <Text style={styles.moduleTitle}>Billing & Finance</Text>
            <Text style={styles.actionsCount}>2 ACTIONS</Text>
          </View>

          <View style={styles.permissionsList}>
            <View style={styles.permissionItem}>
              <View style={styles.permissionLeft}>
                <View style={[styles.permissionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <FileText size={20} color="#9CA3AF" />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionName}>View Invoices</Text>
                  <Text style={styles.permissionDesc}>See patient billing history and balances</Text>
                </View>
              </View>
              <Switch
                value={permissions.viewInvoices}
                onValueChange={() => togglePermission('viewInvoices')}
                trackColor={{ false: '#E5E7EB', true: adminColors.primaryLight }}
                thumbColor={permissions.viewInvoices ? adminColors.primary : '#9CA3AF'}
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.permissionItem}>
              <View style={styles.permissionLeft}>
                <View style={[styles.permissionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Edit size={20} color="#9CA3AF" />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionName}>Process Payments</Text>
                  <Text style={styles.permissionDesc}>Accept credit cards and cash payments</Text>
                </View>
              </View>
              <Switch
                value={permissions.processPayments}
                onValueChange={() => togglePermission('processPayments')}
                trackColor={{ false: '#E5E7EB', true: adminColors.primaryLight }}
                thumbColor={permissions.processPayments ? adminColors.primary : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Admin Tools */}
        <View style={styles.moduleSection}>
          <View style={styles.moduleHeader}>
            <Text style={styles.moduleTitle}>Admin Tools</Text>
            <Text style={[styles.actionsCount, { color: '#9CA3AF' }]}>LOCKED</Text>
          </View>

          <View style={styles.lockedBox}>
            <Lock size={32} color="#D1D5DB" />
            <Text style={styles.lockedTitle}>Restricted Access</Text>
            <Text style={styles.lockedText}>Admin tools can only be modified by the Owner role.</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: adminColors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  roleTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: adminColors.primaryLight,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: adminColors.primary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  moduleSection: {
    marginTop: 24,
  },
  moduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  actionsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: adminColors.primary,
    letterSpacing: 0.5,
  },
  permissionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 72,
  },
  lockedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 6,
  },
  lockedText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
