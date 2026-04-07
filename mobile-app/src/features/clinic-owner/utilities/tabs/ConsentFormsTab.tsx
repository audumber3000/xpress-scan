import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, StyleSheet, Share, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X, Send, Link } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import {
  utilitiesApiService,
  ConsentTemplate, ConsentTemplateCreate,
} from '../../../../services/api/utilities.api';
import { patientsApiService, Patient } from '../../../../services/api/patients.api';
import { useAuth } from '../../../../app/AuthContext';
import { styles } from './sharedStyles';
import { SwipeableRow } from './SwipeableRow';
import { getInitials } from './helpers';

const WEB_BASE_URL = 'https://www.molarplus.com';

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyText}>No consent templates found</Text>
    <Text style={styles.emptySubtext}>Tap + to add one</Text>
  </View>
);

export const ConsentFormsTab: React.FC = () => {
  const { backendUser } = useAuth();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionTemplate, setActionTemplate] = useState<ConsentTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<ConsentTemplate | null>(null);
  const [form, setForm] = useState<ConsentTemplateCreate>({ name: '', content: '' });
  const [editForm, setEditForm] = useState<Partial<ConsentTemplateCreate>>({});

  // Send link state
  const [sendTemplate, setSendTemplate] = useState<ConsentTemplate | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const d = await utilitiesApiService.getConsentTemplates();
    setTemplates(d);
    setLoading(false);
  };
  useFocusEffect(useCallback(() => {
    load();
    patientsApiService.getPatients().then(setPatients);
  }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (id: number) => Alert.alert('Delete Template', 'Remove this consent template?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await utilitiesApiService.updateConsentTemplate(id, { is_active: false });
      setTemplates(p => p.filter(t => t.id !== id));
    }},
  ]);

  const toggleActive = async (t: ConsentTemplate) => {
    const updated = await utilitiesApiService.updateConsentTemplate(t.id, { is_active: !t.is_active });
    if (updated) {
      setTemplates(p => p.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
      setActionTemplate(prev => prev?.id === t.id ? { ...prev, is_active: !prev.is_active } : prev);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      Alert.alert('Required', 'Name and content are required');
      return;
    }
    setSaving(true);
    const created = await utilitiesApiService.createConsentTemplate(form);
    setSaving(false);
    if (created) {
      setTemplates(p => [created, ...p]);
      setShowCreate(false);
      setForm({ name: '', content: '' });
    } else {
      Alert.alert('Error', 'Failed to create consent template.');
    }
  };

  const handleUpdate = async () => {
    if (!editTemplate) return;
    setSaving(true);
    const updated = await utilitiesApiService.updateConsentTemplate(editTemplate.id, editForm);
    setSaving(false);
    if (updated) {
      setTemplates(p => p.map(t => t.id === editTemplate.id ? updated : t));
      setEditTemplate(null);
    } else {
      Alert.alert('Error', 'Failed to update template.');
    }
  };

  const handleGenerateLink = async (patient: Patient) => {
    if (!sendTemplate || !backendUser?.clinic?.id) {
      Alert.alert('Error', 'Clinic information not available.');
      return;
    }
    setGenerating(true);
    const result = await utilitiesApiService.generateConsentLink({
      patientId: parseInt(patient.id),
      patientName: patient.name,
      phone: patient.phone || '',
      templateId: sendTemplate.id,
      templateName: sendTemplate.name,
      content: sendTemplate.content,
      clinicId: parseInt(backendUser.clinic.id),
    });
    setGenerating(false);
    if (result) {
      setGeneratedLink(`${WEB_BASE_URL}${result.signUrl}`);
    } else {
      Alert.alert('Error', 'Failed to generate link. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: generatedLink, url: generatedLink });
    } catch {}
  };

  const handleWhatsApp = async () => {
    const msg = encodeURIComponent(`Please sign the consent form: ${generatedLink}`);
    const url = `whatsapp://send?text=${msg}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to use this option.');
    }
  };

  const closeSendModal = () => {
    setSendTemplate(null);
    setPatientSearch('');
    setGeneratedLink('');
    setGenerating(false);
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    (p.phone || '').includes(patientSearch)
  );

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  return (
    <>
      <ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {templates.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>{templates.length} template{templates.length !== 1 ? 's' : ''}</Text>
            <View style={[styles.summaryPill, { backgroundColor: '#E6F9F1' }]}>
              <Text style={[styles.summaryPillText, { color: '#10B981' }]}>{templates.filter(t => t.is_active).length} Active</Text>
            </View>
          </View>
        )}

        <View style={styles.listBlock}>
          {templates.length === 0 ? <EmptyState /> : templates.map((t, index) => (
            <View key={t.id}>
              <SwipeableRow
                onEdit={() => { setEditForm({ name: t.name, content: t.content }); setEditTemplate(t); }}
                onDelete={() => handleDelete(t.id)}
              >
                <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setActionTemplate(t)}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(t.name)}</Text>
                    </View>
                    <View style={[styles.indicator, { backgroundColor: t.is_active ? '#10B981' : '#9CA3AF' }]} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{t.name}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>{t.content}</Text>
                  </View>
                  <TouchableOpacity
                    style={localStyles.sendBtn}
                    onPress={() => setSendTemplate(t)}
                    activeOpacity={0.8}
                  >
                    <Send size={13} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={localStyles.sendBtnText}>Send</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </SwipeableRow>
              {index < templates.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </View>

        {templates.length > 0 && (
          <Text style={styles.hintText}>← Swipe left to edit or delete  •  Tap to view content</Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Action tray: content viewer + toggle ── */}
      <Modal visible={!!actionTemplate} animationType="slide" transparent onRequestClose={() => setActionTemplate(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionTemplate(null)}>
          <View style={[styles.actionSheet, { maxHeight: '75%' }]}>
            <View style={styles.actionSheetHandle} />
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{actionTemplate?.name}</Text>
              <View style={[styles.badge, {
                backgroundColor: actionTemplate?.is_active ? '#E6F9F1' : '#F3F4F6',
                alignSelf: 'flex-start', marginTop: 4,
              }]}>
                <Text style={[styles.badgeText, { color: actionTemplate?.is_active ? '#10B981' : '#6B7280' }]}>
                  {actionTemplate?.is_active ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            </View>
            <Text style={styles.actionSheetSectionLabel}>Content</Text>
            <ScrollView style={{ maxHeight: 180, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.consentFullText}>{actionTemplate?.content}</Text>
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={styles.consentTrayActions}>
              <TouchableOpacity
                style={[styles.consentTrayToggle, { backgroundColor: actionTemplate?.is_active ? '#FEE2E2' : '#E6F9F1' }]}
                onPress={() => actionTemplate && toggleActive(actionTemplate)}
              >
                <Text style={[styles.consentTrayToggleText, { color: actionTemplate?.is_active ? '#B91C1C' : '#10B981' }]}>
                  {actionTemplate?.is_active ? 'Deactivate' : 'Activate'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.actionSheetCloseBtn} onPress={() => setActionTemplate(null)}>
              <Text style={styles.actionSheetCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Send modal: patient picker → link ── */}
      <Modal visible={!!sendTemplate} animationType="slide" transparent onRequestClose={closeSendModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, localStyles.sendModalSheet]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.modalTitle}>Send Consent</Text>
                <Text style={localStyles.sendModalSub} numberOfLines={1}>{sendTemplate?.name}</Text>
              </View>
              <TouchableOpacity onPress={closeSendModal}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {generatedLink ? (
              // Step 2 – link ready
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
                <View style={localStyles.linkReadyIcon}>
                  <Link size={28} color="#2E2A85" strokeWidth={2} />
                </View>
                <Text style={localStyles.linkReadyTitle}>Link Ready</Text>
                <Text style={localStyles.linkReadySub}>
                  Share this secure link with the patient to collect their digital signature. Valid for 5 minutes.
                </Text>
                <View style={localStyles.linkBox}>
                  <Text style={localStyles.linkText} selectable numberOfLines={3}>{generatedLink}</Text>
                </View>
                <View style={localStyles.actionRow}>
                  <TouchableOpacity style={[localStyles.shareBtn, { flex: 1 }]} onPress={handleShare} activeOpacity={0.85}>
                    <Send size={15} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={localStyles.shareBtnText}>Share / Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[localStyles.whatsappBtn, { flex: 1 }]} onPress={handleWhatsApp} activeOpacity={0.85}>
                    <Text style={localStyles.whatsappIcon}>{'\u{1F4AC}'}</Text>
                    <Text style={localStyles.shareBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={localStyles.closeLinkBtn} onPress={closeSendModal}>
                  <Text style={localStyles.closeLinkText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              // Step 1 – patient search
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Search patient by name or phone…"
                    value={patientSearch}
                    onChangeText={setPatientSearch}
                  />
                </View>
                {generating ? (
                  <ActivityIndicator style={{ marginVertical: 48 }} color={colors.primary} />
                ) : (
                  <ScrollView
                    style={localStyles.patientList}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredPatients.length === 0 ? (
                      <View style={[styles.emptyState, { paddingVertical: 36 }]}>
                        <Text style={styles.emptyText}>No patients found</Text>
                      </View>
                    ) : filteredPatients.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={localStyles.patientRow}
                        onPress={() => handleGenerateLink(p)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.avatar, localStyles.patientAvatar]}>
                          <Text style={[styles.avatarText, { fontSize: 13 }]}>{getInitials(p.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{p.name}</Text>
                          <Text style={styles.rowSubtitle}>{p.phone || 'No phone'}</Text>
                        </View>
                        <Send size={15} color="#C4C4C4" strokeWidth={2} />
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: 20 }} />
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal visible={!!editTemplate} animationType="slide" transparent onRequestClose={() => setEditTemplate(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Template</Text>
              <TouchableOpacity onPress={() => setEditTemplate(null)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Template Name *</Text>
              <TextInput style={styles.input} value={editForm.name || ''} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
                multiline value={editForm.content || ''}
                onChangeText={v => setEditForm(p => ({ ...p, content: v }))}
              />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleUpdate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Create modal ── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Consent Template</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Template Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. General Consent, Extraction Consent" value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} />
              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.input, { height: 160, textAlignVertical: 'top' }]}
                placeholder="Type the full consent text here…"
                multiline value={form.content}
                onChangeText={v => setForm(p => ({ ...p, content: v }))}
              />
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Create Template</Text>}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const localStyles = StyleSheet.create({
  sendModalSheet: {
    height: '78%',
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#2E2A85', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  sendBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  sendModalSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  patientList: { flex: 1 },
  patientAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  linkReadyIcon: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  linkReadyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  linkReadySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  linkBox: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },
  linkText: {
    fontSize: 12, color: '#374151', lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#2E2A85', borderRadius: 14, paddingVertical: 14,
  },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  whatsappIcon: { fontSize: 16 },
  closeLinkBtn: { alignItems: 'center', paddingVertical: 10 },
  closeLinkText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
