import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Image, Modal,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { toast } from '../../../../shared/components/toastService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Save, Check, Maximize2, X } from 'lucide-react-native';
import { adminColors } from '../../../../shared/constants/adminColors';
import { componentRadius } from '../../../../shared/constants/theme';
import { adminApiService } from '../../../../services/api/admin.api';

const TABS = [
  { id: 'invoice',      label: 'Invoices',      hint: 'How your invoice PDFs look' },
  { id: 'prescription', label: 'Prescriptions', hint: 'How your prescription PDFs look' },
  { id: 'consent',      label: 'Consent forms', hint: 'How your consent forms look' },
] as const;

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
  prescription: { template_id: 'standard',      logo_url: '', primary_color: '#2a276e', footer_text: '', gst_number: '' },
  consent:      { template_id: 'classic',       logo_url: '', primary_color: '#2a276e', footer_text: '', gst_number: '' },
};

const PRESETS = [
  { name: 'Orange',   value: '#FF9800' },
  { name: 'Teal',     value: '#0D9488' },
  { name: 'Indigo',   value: '#4338CA' },
  { name: 'Charcoal', value: '#374151' },
];

// Sample data so the live preview is actually readable.
const SAMPLE: Record<TabId, { title: string; rows: [string, string][]; total: [string, string] | null }> = {
  invoice: {
    title: 'Invoice #INV-2026-0018',
    rows: [['Root canal treatment', '₹3,500'], ['X-Ray (digital)', '₹400'], ['Medicines', '₹280']],
    total: ['Total', '₹4,180'],
  },
  prescription: {
    title: 'Prescription',
    rows: [['Amoxicillin 500mg', '1-0-1 · 5 days'], ['Ibuprofen 400mg', 'SOS · after food'], ['Chlorhexidine rinse', '0-1-0 · 7 days']],
    total: null,
  },
  consent: {
    title: 'Consent — Extraction',
    rows: [['Procedure', 'Tooth extraction (#36)'], ['Risks explained', 'Yes'], ['Patient signature', '—']],
    total: null,
  },
};

const isLight = (hex: string) => {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165;
};

// SVG mini-document so the doctor can see Classic vs Compact differ at a glance.
const LayoutThumb: React.FC<{ accent: string; compact: boolean }> = ({ accent, compact }) => (
  <Svg viewBox="0 0 130 96" width="100%" height={104}>
    <Rect x={0} y={0} width={130} height={96} rx={6} fill="#FFFFFF" />
    {compact ? (
      <>
        <Rect x={12} y={12} width={56} height={7} rx={3.5} fill={accent} />
        <Rect x={104} y={10} width={16} height={16} rx={3} fill="#E5E7EB" />
        <Rect x={12} y={34} width={106} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={44} width={88} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={58} width={106} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={68} width={70} height={4} rx={2} fill="#E5E7EB" />
      </>
    ) : (
      <>
        <Rect x={12} y={12} width={106} height={9} rx={3} fill={accent} />
        <Rect x={12} y={30} width={92} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={40} width={106} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={50} width={78} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={12} y={60} width={98} height={4} rx={2} fill="#E5E7EB" />
        <Rect x={74} y={78} width={44} height={6} rx={3} fill={accent} />
      </>
    )}
  </Svg>
);

// One document-preview component, used both inline and full-size — so every
// tab (invoice / prescription / consent) renders with the exact same style.
const DocPreview: React.FC<{
  accent: string;
  clinicName: string;
  address?: string;
  gst?: string;
  sample: { title: string; rows: [string, string][]; total: [string, string] | null };
  footer?: string;
  large?: boolean;
}> = ({ accent, clinicName, address, gst, sample, footer, large }) => {
  const s = large ? docLarge : docSmall;
  return (
    <View style={[styles.doc, large && styles.docLargeOuter]}>
      <View style={[styles.docAccent, large && { height: 9 }, { backgroundColor: accent }]} />
      <View style={{ padding: large ? 24 : 16 }}>
        <Text style={s.clinic}>{clinicName}</Text>
        {(address || gst) ? (
          <Text style={s.meta} numberOfLines={1}>
            {address}{gst ? `${address ? ' · ' : ''}GST: ${gst}` : ''}
          </Text>
        ) : null}
        <Text style={s.title}>{sample.title}</Text>
        {sample.rows.map(([l, r], i) => (
          <View key={i} style={[styles.docRow, large && { paddingVertical: 11 }]}>
            <Text style={s.rowLabel} numberOfLines={1}>{l}</Text>
            <Text style={s.rowVal}>{r}</Text>
          </View>
        ))}
        {sample.total && (
          <View style={[styles.docRow, styles.docTotalRow, large && { paddingTop: 16 }]}>
            <Text style={s.totalLabel}>{sample.total[0]}</Text>
            <Text style={[s.totalVal, { color: accent }]}>{sample.total[1]}</Text>
          </View>
        )}
        {!!footer && <Text style={[styles.docFooter, large && { fontSize: 13, marginTop: 18 }]} numberOfLines={3}>{footer}</Text>}
      </View>
    </View>
  );
};

interface TemplatesScreenProps { navigation: any; }

export const TemplatesScreen: React.FC<TemplatesScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabId>('invoice');
  const [configs, setConfigs] = useState<Configs>({ ...DEFAULT_CONFIGS });
  const [clinicMeta, setClinicMeta] = useState<{ name: string; address: string }>({ name: 'Your Clinic', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fullVisible, setFullVisible] = useState(false);
  const [variants, setVariants] = useState<Record<TabId, Array<{ id: string; name: string; description: string; thumbnail: string }>>>({
    invoice: [], prescription: [], consent: [],
  });

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
        setClinicMeta({ name: meData.name || 'Your Clinic', address: meData.address || '' });
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

  useEffect(() => {
    Promise.all([
      adminApiService.getTemplateVariants('invoice'),
      adminApiService.getTemplateVariants('prescription'),
      adminApiService.getTemplateVariants('consent'),
    ]).then(([inv, rx, cons]) => setVariants({ invoice: inv, prescription: rx, consent: cons })).catch(() => {});
  }, []);

  // Build the real-PDF HTML (shown in the Full-size view), debounced.
  useEffect(() => {
    if (loading) return;
    const c = configs[activeTab];
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      const html = await adminApiService.previewTemplate({
        category: activeTab,
        template_id: c.template_id,
        primary_color: c.primary_color,
        footer_text: c.footer_text,
        logo_url: c.logo_url || null,
      });
      if (!cancelled) { if (html) setPreviewHtml(html); setPreviewLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [activeTab, configs, loading]);

  const updateField = (field: keyof TabConfig, value: string) => {
    setConfigs(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], [field]: value } }));
  };

  const handlePickLogo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg'], copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) { toast.error('Logo must be under 5 MB'); return; }
      setUploadingLogo(true);
      const res = await adminApiService.uploadTemplateLogo(activeTab, {
        uri: asset.uri, name: asset.name || 'logo', type: asset.mimeType || 'image/png',
      });
      if (res?.logo_url) { updateField('logo_url', res.logo_url); toast.success('Logo uploaded — remember to save'); }
      else toast.error('Upload failed. Try a different image.');
    } catch (e) {
      console.error('[Templates] Logo pick error:', e);
      toast.error('Could not upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const cfg = configs[activeTab];
    const ok = await adminApiService.saveTemplateConfig({
      category: activeTab, template_id: cfg.template_id, logo_url: cfg.logo_url,
      primary_color: cfg.primary_color, footer_text: cfg.footer_text,
      ...(activeTab === 'invoice' ? { gst_number: cfg.gst_number } : {}),
    });
    setSaving(false);
    if (ok) toast.success(`${TABS.find(t => t.id === activeTab)?.label} template saved!`);
    else toast.error('Failed to save. Try again.');
  };

  const cfg = configs[activeTab];
  const accent = cfg.primary_color || '#FF9800';
  const sample = SAMPLE[activeTab];
  const activeHint = TABS.find(t => t.id === activeTab)?.hint || '';
  const matchedPreset = PRESETS.find(p => p.value.toLowerCase() === accent.toLowerCase());

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={adminColors.gradientStart} />
      <SafeAreaView style={{ backgroundColor: adminColors.gradientStart }} edges={['top']}>
        <LinearGradient colors={[adminColors.gradientStart, adminColors.gradientEnd]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <ChevronLeft size={22} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Templates</Text>
              <Text style={styles.headerSub}>PDF & document design</Text>
            </View>
            <TouchableOpacity style={[styles.saveHeaderBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
              <Text style={styles.saveHeaderText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {TABS.map(t => (
              <TouchableOpacity key={t.id} style={styles.tabBtn} onPress={() => setActiveTab(t.id)} activeOpacity={0.8}>
                <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
                {activeTab === t.id && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </SafeAreaView>

      <>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={adminColors.primary} />
            <Text style={styles.loadingText}>Loading template settings...</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.tabHint}>{activeHint}</Text>

            {/* ── Layout ── */}
            {(variants[activeTab]?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionLabel}>LAYOUT</Text>
                <View style={styles.card}>
                  <View style={styles.layoutGrid}>
                    {variants[activeTab].map((v) => {
                      const isActive = cfg.template_id === v.id;
                      const compact = /compact|minimal|simple|slim/i.test(`${v.id} ${v.name} ${v.description}`);
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={[styles.layoutCard, isActive && styles.layoutCardActive]}
                          onPress={() => updateField('template_id', v.id)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.layoutThumbWrap}>
                            <LayoutThumb accent={accent} compact={compact} />
                          </View>
                          <View style={styles.layoutMetaRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.layoutName}>{v.name}</Text>
                              {!!v.description && <Text style={styles.layoutDesc} numberOfLines={2}>{v.description}</Text>}
                            </View>
                            {isActive && (
                              <View style={styles.layoutCheck}><Check size={13} color="#fff" strokeWidth={3} /></View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {/* ── Accent colour ── */}
            <Text style={styles.sectionLabel}>ACCENT COLOUR</Text>
            <View style={styles.card}>
              <View style={styles.swatchGrid}>
                {PRESETS.map(p => {
                  const selected = matchedPreset?.value === p.value;
                  const light = isLight(p.value);
                  return (
                    <TouchableOpacity
                      key={p.value}
                      style={[styles.swatch, { backgroundColor: p.value }, selected && styles.swatchSelected]}
                      onPress={() => updateField('primary_color', p.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.swatchText, { color: light ? '#1F2937' : '#FFFFFF' }]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.customRow}>
                <View style={[styles.customSwatch, { backgroundColor: accent }]} />
                <TextInput
                  style={styles.customInput}
                  placeholder="#FF9800"
                  placeholderTextColor="#9CA3AF"
                  value={accent}
                  onChangeText={v => updateField('primary_color', v)}
                  autoCapitalize="characters"
                />
                <Text style={[styles.customLabel, !matchedPreset && styles.customLabelActive]}>Custom</Text>
              </View>
            </View>

            {/* ── Clinic branding ── */}
            <Text style={styles.sectionLabel}>CLINIC BRANDING</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Clinic logo</Text>
              <TouchableOpacity
                style={[styles.logoTile, cfg.logo_url && styles.logoTileFilled, uploadingLogo && { opacity: 0.6 }]}
                onPress={handlePickLogo}
                disabled={uploadingLogo}
                activeOpacity={0.8}
              >
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={adminColors.primary} />
                ) : cfg.logo_url ? (
                  <>
                    <Image source={{ uri: cfg.logo_url }} style={styles.logoImg} resizeMode="contain" />
                    <Text style={styles.logoTitleOk}>Logo uploaded</Text>
                    <Text style={styles.logoSubOk}>Tap to replace</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.logoTitle}>Tap to upload logo</Text>
                    <Text style={styles.logoSub}>PNG or JPEG, up to 5 MB</Text>
                  </>
                )}
              </TouchableOpacity>

              {activeTab === 'invoice' && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.fieldLabel}>GST number</Text>
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

              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabel}>Footer / disclaimer</Text>
                <TextInput
                  style={[styles.fieldInput, styles.multiInput]}
                  placeholder="e.g. This is a computer generated document…"
                  placeholderTextColor="#9CA3AF"
                  value={cfg.footer_text}
                  onChangeText={v => updateField('footer_text', v)}
                  multiline numberOfLines={3} textAlignVertical="top"
                />
              </View>
            </View>

            {/* ── Live preview ── */}
            <Text style={styles.sectionLabel}>LIVE PREVIEW</Text>
            <View style={styles.card}>
              <View style={styles.previewHead}>
                <Text style={styles.previewTitle}>{TABS.find(t => t.id === activeTab)?.label.replace(/s$/, '')} preview</Text>
                <TouchableOpacity style={styles.fullBtn} onPress={() => setFullVisible(true)} activeOpacity={0.7}>
                  <Maximize2 size={15} color={adminColors.primary} />
                  <Text style={styles.fullBtnText}>Full size</Text>
                </TouchableOpacity>
              </View>

              {/* Native sample-data document */}
              <DocPreview
                accent={accent}
                clinicName={clinicMeta.name}
                address={clinicMeta.address}
                gst={activeTab === 'invoice' ? cfg.gst_number : ''}
                sample={sample}
                footer={cfg.footer_text}
              />
              <Text style={styles.previewHint}>Rendered with sample data · updates as you edit</Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </>

      {/* ── Full-size modal (real PDF engine) ── */}
      <Modal visible={fullVisible} animationType="slide" onRequestClose={() => setFullVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Full preview</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setFullVisible(false)}>
              <X size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          {previewHtml ? (
            <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />
          ) : (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={adminColors.primary} />
              <Text style={styles.loadingText}>Building preview…</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F3F4F6' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },
  body:        { padding: 16, paddingTop: 6 },

  // Header
  header:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  saveHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: componentRadius.button },
  saveHeaderText:{ fontSize: 15, fontWeight: '700', color: '#fff' },

  // Tabs
  tabRow:        { flexDirection: 'row', gap: 22 },
  tabBtn:        { paddingVertical: 12 },
  tabLabel:      { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabLabelActive:{ color: '#fff', fontWeight: '700' },
  tabUnderline:  { height: 3, borderRadius: 2, backgroundColor: '#fff', marginTop: 8 },

  tabHint:       { fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 4, marginLeft: 4 },
  sectionLabel:  { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  card:          { backgroundColor: '#fff', borderRadius: componentRadius.carouselCard, padding: 16, borderWidth: 1, borderColor: '#EEF0F2' },

  // Layout
  layoutGrid:        { flexDirection: 'row', gap: 12 },
  layoutCard:        { flex: 1, borderRadius: componentRadius.carouselCard, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff', overflow: 'hidden' },
  layoutCardActive:  { borderColor: adminColors.primary },
  layoutThumbWrap:   { backgroundColor: '#F9FAFB', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  layoutMetaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  layoutName:        { fontSize: 15, fontWeight: '700', color: '#111827' },
  layoutDesc:        { fontSize: 12, color: '#6B7280', marginTop: 2 },
  layoutCheck:       { width: 26, height: 26, borderRadius: 13, backgroundColor: adminColors.primary, justifyContent: 'center', alignItems: 'center' },

  // Accent colour
  swatchGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch:        { width: '47%', flexGrow: 1, height: 56, borderRadius: componentRadius.button, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchSelected:{ borderColor: '#111827' },
  swatchText:    { fontSize: 15, fontWeight: '700' },
  customRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  customSwatch:  { width: 48, height: 48, borderRadius: componentRadius.button, borderWidth: 1, borderColor: '#E5E7EB' },
  customInput:   { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: componentRadius.button, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: 1 },
  customLabel:   { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  customLabelActive: { color: adminColors.primary, fontWeight: '700' },

  // Branding
  fieldLabel:    { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldInput:    { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: componentRadius.button, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111827' },
  multiInput:    { minHeight: 84, textAlignVertical: 'top' },
  logoTile:      { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 26, borderRadius: componentRadius.carouselCard, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  logoTileFilled:{ borderStyle: 'solid', borderColor: adminColors.primary, backgroundColor: '#E7F6EE' },
  logoImg:       { width: 64, height: 40, marginBottom: 6 },
  logoTitle:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  logoSub:       { fontSize: 12, color: '#9CA3AF' },
  logoTitleOk:   { fontSize: 15, fontWeight: '700', color: '#15803D' },
  logoSubOk:     { fontSize: 13, color: '#15803D' },

  // Preview
  previewHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  previewTitle:  { fontSize: 16, fontWeight: '800', color: '#111827' },
  fullBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fullBtnText:   { fontSize: 14, fontWeight: '700', color: adminColors.primary },
  doc:           { borderRadius: componentRadius.button, borderWidth: 1, borderColor: '#EEF0F2', overflow: 'hidden', backgroundColor: '#fff' },
  docLargeOuter: { borderRadius: componentRadius.carouselCard, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  docAccent:     { height: 6, width: '100%' },
  docRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  docTotalRow:   { borderTopWidth: 1, borderTopColor: '#F1F3F5', marginTop: 4, paddingTop: 12 },
  docFooter:     { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 12, lineHeight: 15 },
  previewHint:   { fontSize: 12, color: '#9CA3AF', marginTop: 12, textAlign: 'center' },

  // Full modal
  modalHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalClose:  { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalBody:   { padding: 20 },
});

// Text scales for the document preview — small (inline) vs large (full-size).
const docSmall = StyleSheet.create({
  clinic:     { fontSize: 15, fontWeight: '800', color: '#111827' },
  meta:       { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  title:      { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 12, marginBottom: 6 },
  rowLabel:   { fontSize: 14, color: '#6B7280', flex: 1, marginRight: 12 },
  rowVal:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#111827' },
  totalVal:   { fontSize: 16, fontWeight: '800' },
});
const docLarge = StyleSheet.create({
  clinic:     { fontSize: 22, fontWeight: '800', color: '#111827' },
  meta:       { fontSize: 14, color: '#9CA3AF', marginTop: 3 },
  title:      { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 18, marginBottom: 8 },
  rowLabel:   { fontSize: 16, color: '#6B7280', flex: 1, marginRight: 14 },
  rowVal:     { fontSize: 16, fontWeight: '600', color: '#374151' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: '#111827' },
  totalVal:   { fontSize: 20, fontWeight: '800' },
});
