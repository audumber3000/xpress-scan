import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Save, FileText, Stethoscope, ClipboardCheck, Image as ImageIcon,
} from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService } from '../../../../services/api/admin.api';
import { FeatureLock } from '../../../../shared/components/FeatureLock';

const TABS = [
  { id: 'invoice',      label: 'Invoices',       icon: FileText,      defaultColor: '#FF9800' },
  { id: 'prescription', label: 'Prescriptions',  icon: Stethoscope,   defaultColor: '#2a276e' },
  { id: 'consent',      label: 'Consent Forms',  icon: ClipboardCheck, defaultColor: '#10B981' },
];

type TabId = 'invoice' | 'prescription' | 'consent';

interface TabConfig {
  template_id: string;
  logo_url: string;
  primary_color: string;
  footer_text: string;
  gst_number: string;
}

type Configs = Record<TabId, TabConfig>;

const DEFAULT_CONFIGS: Configs = {
  invoice:      { template_id: 'modern_orange', logo_url: '', primary_color: '#FF9800', footer_text: '', gst_number: '' },
  prescription: { template_id: 'standard',      logo_url: '', primary_color: '#2a276e', footer_text: '' , gst_number: '' },
  consent:      { template_id: 'standard',      logo_url: '', primary_color: '#10B981', footer_text: '', gst_number: '' },
};

interface TemplatesScreenProps {
  navigation: any;
}

export const TemplatesScreen: React.FC<TemplatesScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabId>('invoice');
  const [configs, setConfigs] = useState<Configs>({ ...DEFAULT_CONFIGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [configData, meData] = await Promise.all([
        adminApiService.getTemplateConfigs(),
        adminApiService.getClinicInfo(),
      ]);
      const next = { ...DEFAULT_CONFIGS };
      if (meData) {
        next.invoice.gst_number  = (meData as any).gst_number  || '';
        next.invoice.logo_url    = (meData as any).logo_url    || '';
        next.invoice.template_id = (meData as any).invoice_template || 'modern_orange';
      }
      (configData || []).forEach((cfg: any) => {
        const key = cfg.category as TabId;
        if (next[key]) {
          next[key] = {
            ...next[key],
            template_id:   cfg.template_id    || next[key].template_id,
            logo_url:      cfg.logo_url        || '',
            primary_color: cfg.primary_color   || next[key].primary_color,
            footer_text:   cfg.footer_text     || '',
          };
        }
      });
      setConfigs(next);
    } catch (e) {
      console.error('❌ [Templates] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (field: keyof TabConfig, value: string) => {
    setConfigs(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    const cfg = configs[activeTab];
    const ok = await adminApiService.saveTemplateConfig({
      category:      activeTab,
      template_id:   cfg.template_id,
      logo_url:      cfg.logo_url,
      primary_color: cfg.primary_color,
      footer_text:   cfg.footer_text,
      ...(activeTab === 'invoice' ? { gst_number: cfg.gst_number } : {}),
    });
    setSaving(false);
    if (ok) {
      toast.success(`${TABS.find(t => t.id === activeTab)?.label} template saved!`);
    } else {
      toast.error('Failed to save. Try again.');
    }
  };

  const cfg = configs[activeTab];

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
              <Text style={styles.headerTitle}>Templates</Text>
              <Text style={styles.headerSub}>PDF & Document design</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveHeaderBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Save size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>

        </LinearGradient>
      </SafeAreaView>

      <FeatureLock
        featureName="Templates"
        description="Customising PDF templates for invoices, prescriptions and consent forms is a Professional plan feature."
      >
      <View style={{ flex: 1 }}>
      {/* Tab bar — simple underline style */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.id as TabId)}
          >
            <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={adminColors.primary} />
          <Text style={styles.loadingText}>Loading template settings...</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ── Branding & Info ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Branding & Info</Text>

            {/* Accent Color */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Primary Accent Color</Text>
              <View style={styles.colorRow}>
                <View style={[styles.colorSwatch, { backgroundColor: cfg.primary_color }]} />
                <TextInput
                  style={[styles.fieldInput, { flex: 1, fontFamily: 'monospace' }]}
                  placeholder="#FF9800"
                  placeholderTextColor="#9CA3AF"
                  value={cfg.primary_color}
                  onChangeText={v => updateField('primary_color', v)}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Logo URL */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Logo URL</Text>
              <View style={styles.iconInputRow}>
                <ImageIcon size={16} color="#9CA3AF" />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  placeholder="https://example.com/logo.png"
                  placeholderTextColor="#9CA3AF"
                  value={cfg.logo_url}
                  onChangeText={v => updateField('logo_url', v)}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Text style={styles.fieldHint}>Leave blank to use the global clinic logo.</Text>
            </View>

            {/* GST — Invoice only */}
            {activeTab === 'invoice' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Clinic GST Number</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="29GGGGG1314R9Z6"
                  placeholderTextColor="#9CA3AF"
                  value={cfg.gst_number}
                  onChangeText={v => updateField('gst_number', v)}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {/* Footer text */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Footer / Disclaimer</Text>
              <TextInput
                style={[styles.fieldInput, styles.multiInput]}
                placeholder="e.g. This is a computer generated document. No signature required."
                placeholderTextColor="#9CA3AF"
                value={cfg.footer_text}
                onChangeText={v => updateField('footer_text', v)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ── Live Preview ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Preview</Text>
            <View style={styles.previewDoc}>
              <View style={[styles.previewAccent, { backgroundColor: cfg.primary_color }]} />
              <View style={styles.previewBody}>
                {/* Header row */}
                <View style={styles.previewHeaderRow}>
                  <View style={[styles.previewLogo, { backgroundColor: `${cfg.primary_color}20` }]}>
                    {cfg.logo_url ? (
                      <Text style={{ fontSize: 8, color: '#9CA3AF' }} numberOfLines={1}>IMG</Text>
                    ) : (
                      <ImageIcon size={14} color={cfg.primary_color} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.previewLine} />
                    <View style={[styles.previewLine, { width: '60%', opacity: 0.5 }]} />
                  </View>
                  <View style={[styles.previewBadge, { backgroundColor: `${cfg.primary_color}20` }]}>
                    <View style={[styles.previewLine, { width: 40, backgroundColor: cfg.primary_color }]} />
                  </View>
                </View>
                {/* Content area */}
                <View style={styles.previewContent}>
                  <View style={styles.previewLines}>
                    <View style={styles.previewLine} />
                    <View style={[styles.previewLine, { width: '80%' }]} />
                    <View style={[styles.previewLine, { width: '60%' }]} />
                  </View>
                </View>
                {/* Footer */}
                <View style={styles.previewFooter}>
                  <Text style={styles.previewFooterText} numberOfLines={2}>
                    {cfg.footer_text || 'Footer/Disclaimer text will appear here.'}
                  </Text>
                  <View style={[styles.previewFooterStamp, { borderColor: cfg.primary_color }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Save size={18} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>
            }
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
      </View>
      </FeatureLock>
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F9FAFB' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: '#6B7280' },
  body:         { padding: 16, gap: 16 },

  // Header
  header:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  saveHeaderBtn:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // Tab bar
  tabBar:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tabBtn:         { flex: 1, paddingVertical: 13, alignItems: 'center' as const, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: adminColors.primary },
  tabLabel:       { fontSize: 13, fontWeight: '500' as const, color: '#6B7280' },
  tabLabelActive: { color: adminColors.primary, fontWeight: '700' as const },

  // Cards
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },

  // Fields
  field:        { marginBottom: 16 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput:   { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  multiInput:   { minHeight: 80, textAlignVertical: 'top' },
  fieldHint:    { fontSize: 11, color: '#9CA3AF', marginTop: 5, fontStyle: 'italic' },
  colorRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorSwatch:  { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  iconInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 2 },

  // Preview
  previewDoc:        { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  previewAccent:     { height: 5, width: '100%' },
  previewBody:       { padding: 16, gap: 12 },
  previewHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewLogo:       { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  previewLine:       { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', width: '100%' },
  previewBadge:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  previewContent:    { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  previewLines:      { gap: 6 },
  previewFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  previewFooterText: { flex: 1, fontSize: 9, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 13 },
  previewFooterStamp:{ width: 48, height: 28, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed' },

  // Save
  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: adminColors.primary, borderRadius: 14, paddingVertical: 15 },
  saveBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
