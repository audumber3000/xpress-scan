import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { toast } from '../../../../shared/components/toastService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Save, FileText, Stethoscope, ClipboardCheck, Upload, X, Check,
} from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { adminApiService } from '../../../../services/api/admin.api';
import { FeatureLock } from '../../../../shared/components/FeatureLock';

const TABS = [
  { id: 'invoice',      label: 'Invoices',       icon: FileText,       defaultColor: '#FF9800' },
  { id: 'prescription', label: 'Prescriptions',  icon: Stethoscope,    defaultColor: '#2a276e' },
  { id: 'consent',      label: 'Consent Forms',  icon: ClipboardCheck, defaultColor: '#2a276e' },
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
  consent:      { template_id: 'classic',       logo_url: '', primary_color: '#2a276e', footer_text: '' , gst_number: '' },
};

interface TemplatesScreenProps {
  navigation: any;
}

export const TemplatesScreen: React.FC<TemplatesScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabId>('invoice');
  const [configs, setConfigs] = useState<Configs>({ ...DEFAULT_CONFIGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [variants, setVariants] = useState<Record<TabId, Array<{ id: string; name: string; description: string; thumbnail: string }>>>({
    invoice: [],
    prescription: [],
    consent: [],
  });

  // Backend mounts /static next to /api/v1; strip the api path to get the host root.
  const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/v1\/?$/, '');
  const thumbUrl = (path: string) => path?.startsWith('http') ? path : `${apiBase}${path}`;

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

  // One-time fetch of variant catalogs for both categories.
  useEffect(() => {
    Promise.all([
      adminApiService.getTemplateVariants('invoice'),
      adminApiService.getTemplateVariants('prescription'),
      adminApiService.getTemplateVariants('consent'),
    ]).then(([inv, rx, cons]) => {
      setVariants({ invoice: inv, prescription: rx, consent: cons });
    }).catch(() => {});
  }, []);

  // Debounced preview refresh: rebuild HTML 350 ms after the user stops editing.
  // Uses a request token so a slow earlier request can't overwrite a newer one.
  useEffect(() => {
    if (loading) return;
    const cfg = configs[activeTab];
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      const html = await adminApiService.previewTemplate({
        category: activeTab,
        template_id: cfg.template_id,
        primary_color: cfg.primary_color,
        footer_text: cfg.footer_text,
        logo_url: cfg.logo_url || null,
      });
      if (!cancelled) {
        if (html) setPreviewHtml(html);
        setPreviewLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [activeTab, configs, loading]);

  const updateField = (field: keyof TabConfig, value: string) => {
    setConfigs(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));
  };

  const handlePickLogo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        toast.error('Logo must be under 5 MB');
        return;
      }

      setUploadingLogo(true);
      const file = {
        uri: asset.uri,
        name: asset.name || 'logo',
        type: asset.mimeType || 'image/png',
      };
      const res = await adminApiService.uploadTemplateLogo(activeTab, file);
      if (res?.logo_url) {
        updateField('logo_url', res.logo_url);
        toast.success('Logo uploaded — remember to save changes');
      } else {
        toast.error('Upload failed. Try a different image.');
      }
    } catch (e) {
      console.error('[Templates] Logo pick error:', e);
      toast.error('Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    updateField('logo_url', '');
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

          {/* ── Layout (variant picker) ── */}
          {(variants[activeTab]?.length ?? 0) > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Layout</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}
              >
                {variants[activeTab].map((v) => {
                  const isActive = cfg.template_id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.variantCard, isActive && styles.variantCardActive]}
                      onPress={() => updateField('template_id', v.id)}
                      activeOpacity={0.85}
                    >
                      {isActive && (
                        <View style={styles.variantCheck}>
                          <Check size={11} color="#fff" />
                        </View>
                      )}
                      <Image
                        source={{ uri: thumbUrl(v.thumbnail) }}
                        style={styles.variantThumb}
                        resizeMode="cover"
                      />
                      <Text style={styles.variantName} numberOfLines={1}>{v.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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

            {/* Logo */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Clinic Logo</Text>
              {cfg.logo_url ? (
                <View style={styles.logoRow}>
                  <Image source={{ uri: cfg.logo_url }} style={styles.logoPreview} resizeMode="contain" />
                  <View style={styles.logoActions}>
                    <TouchableOpacity
                      style={[styles.logoActionBtn, uploadingLogo && { opacity: 0.5 }]}
                      onPress={handlePickLogo}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo
                        ? <ActivityIndicator size="small" color={adminColors.primary} />
                        : <Upload size={14} color={adminColors.primary} />}
                      <Text style={styles.logoActionText}>Replace</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.logoActionBtnDanger}
                      onPress={handleRemoveLogo}
                      disabled={uploadingLogo}
                    >
                      <X size={14} color="#DC2626" />
                      <Text style={styles.logoActionTextDanger}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.logoUploadTile, uploadingLogo && { opacity: 0.6 }]}
                  onPress={handlePickLogo}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color={adminColors.primary} />
                  ) : (
                    <Upload size={20} color={adminColors.primary} />
                  )}
                  <Text style={styles.logoUploadTitle}>
                    {uploadingLogo ? 'Uploading…' : 'Tap to upload logo'}
                  </Text>
                  <Text style={styles.logoUploadHint}>PNG or JPEG, up to 5 MB</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.fieldHint}>Used in the {activeTab} PDF header. Leave empty to fall back to the clinic-wide logo.</Text>
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
            <View style={styles.previewHeaderBar}>
              <Text style={[styles.cardTitle, { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }]}>Live Preview</Text>
              {previewLoading && <ActivityIndicator size="small" color={adminColors.primary} />}
            </View>
            <View style={styles.previewWebViewWrap}>
              {previewHtml ? (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: previewHtml }}
                  scalesPageToFit
                  showsVerticalScrollIndicator={false}
                  style={styles.previewWebView}
                  injectedJavaScript={'document.body.style.zoom="0.5";true;'}
                  scrollEnabled
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <ActivityIndicator size="small" color={adminColors.primary} />
                  <Text style={styles.previewPlaceholderText}>Building preview…</Text>
                </View>
              )}
            </View>
            <Text style={styles.fieldHint}>
              Rendered with sample data using the same engine as your real PDFs.
            </Text>
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

  // Logo upload
  logoUploadTile:       { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 22, backgroundColor: '#F9FAFB', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 12 },
  logoUploadTitle:      { fontSize: 13, fontWeight: '600' as const, color: '#111827' },
  logoUploadHint:       { fontSize: 11, color: '#9CA3AF' },
  logoRow:              { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPreview:          { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  logoActions:          { flex: 1, gap: 8 },
  logoActionBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, backgroundColor: '#fff' },
  logoActionText:       { fontSize: 12, fontWeight: '600' as const, color: adminColors.primary },
  logoActionBtnDanger:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, backgroundColor: '#FEF2F2' },
  logoActionTextDanger: { fontSize: 12, fontWeight: '600' as const, color: '#DC2626' },

  // Real PDF preview (WebView-based)
  previewHeaderBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  previewWebViewWrap:      { height: 380, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  previewWebView:          { flex: 1, backgroundColor: '#fff' },
  previewPlaceholder:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  previewPlaceholderText:  { fontSize: 12, color: '#6B7280' },

  // Preview (legacy skeleton — kept for tab/badge styles still referenced)
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
