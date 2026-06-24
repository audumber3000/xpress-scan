import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { FileText, Image as ImageIcon, Plus, File, ExternalLink } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { patientsApiService, XrayFile } from '../../../../services/api/patients.api';
import { UploadProgressBar, type UploadPhase } from '../../../../shared/components/UploadProgressBar';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { format } from 'date-fns';

interface FilesViewProps {
  patientId: string;
}

// Unified document shape from GET /documents/patient/{id} — the same source the
// web Files tab uses, so anything uploaded from a Case Paper shows up here too.
// `file_path` is a direct (R2) URL usable as an <Image> src or to open.
interface UnifiedDoc {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  created_at: string;
  category?: string; // 'document' | 'report'
  case_paper_id?: number | null;
  uploader_name?: string;
}

const cleanExt = (t?: string) => (t || '').replace(/^\./, '').toLowerCase();
const isImageType = (t?: string) => /^(png|jpe?g|webp|gif|bmp)$/.test(cleanExt(t));
const isPdfType = (t?: string) => /pdf/.test(cleanExt(t));
const isHttp = (u?: string) => /^https?:\/\//i.test(u || '');

export const FilesView: React.FC<FilesViewProps> = ({ patientId }) => {
  const [files, setFiles] = useState<UnifiedDoc[]>([]);
  const [xrays, setXrays] = useState<XrayFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('uploading');
  const [uploadingName, setUploadingName] = useState<string | undefined>(undefined);
  // Pre-resolved authenticated download URLs for X-rays (still token-signed).
  const [xrayUrls, setXrayUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFiles();
  }, [patientId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const [docs, xrayFiles] = await Promise.all([
        patientsApiService.getPatientDocuments(patientId),
        patientsApiService.getXrays(patientId),
      ]);
      setFiles(Array.isArray(docs) ? docs : []);
      setXrays(xrayFiles);

      // X-rays still need token-signed URLs to render/open.
      const xrayEntries = await Promise.all(
        xrayFiles.map(async (x) => [
          x.id,
          await patientsApiService.getXrayDownloadUrl(patientId, x.id),
        ] as const),
      );
      setXrayUrls(Object.fromEntries(xrayEntries));
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const openUrl = async (url?: string) => {
    if (!url || !isHttp(url)) {
      toast.error('File is not available to open.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error('Error opening file:', error);
      toast.error('Could not open file.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploading(true);
        setUploadProgress(0);
        setUploadPhase('uploading');
        setUploadingName(asset.name);

        const fileToUpload = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        };

        // Upload to the unified document store (same as web / case papers) so it
        // lands alongside everything else and shows up in this list.
        await patientsApiService.uploadDocument(patientId, fileToUpload, undefined, (fraction) => {
          setUploadProgress(fraction);
          setUploadPhase(fraction >= 1 ? 'processing' : 'uploading');
        });
        toast.success('File uploaded successfully');
        loadFiles();
      }
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Failed to pick or upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadPhase('uploading');
      setUploadingName(undefined);
    }
  };

  const getDocIcon = (item: UnifiedDoc) => {
    if (isPdfType(item.file_type)) return <FileText size={24} color="#EF4444" />;
    if (isImageType(item.file_type)) return <ImageIcon size={24} color="#3B82F6" />;
    return <File size={24} color="#6B7280" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Provenance tags shown on each document row.
  const renderTags = (item: UnifiedDoc) => {
    const ext = cleanExt(item.file_type);
    return (
      <View style={styles.tagsRow}>
        {!!ext && (
          <View style={[styles.tag, styles.tagType]}>
            <Text style={[styles.tagText, styles.tagTypeText]}>{ext}</Text>
          </View>
        )}
        {item.case_paper_id ? (
          <View style={[styles.tag, styles.tagSource]}>
            <Text style={[styles.tagText, styles.tagSourceText]}>Case Paper</Text>
          </View>
        ) : (
          <View style={[styles.tag, styles.tagUpload]}>
            <Text style={[styles.tagText, styles.tagUploadText]}>Uploaded</Text>
          </View>
        )}
        {item.category === 'report' && (
          <View style={[styles.tag, styles.tagReport]}>
            <Text style={[styles.tagText, styles.tagReportText]}>Report</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFileItem = (item: UnifiedDoc) => {
    const showThumb = isImageType(item.file_type) && isHttp(item.file_path);
    const size = formatFileSize(item.file_size);
    return (
      <TouchableOpacity style={styles.fileCard} onPress={() => openUrl(item.file_path)} activeOpacity={0.7}>
        {showThumb ? (
          <Image source={{ uri: item.file_path }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.fileIconContainer}>{getDocIcon(item)}</View>
        )}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.file_name}</Text>
          <Text style={styles.fileMeta}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}{size ? ` • ${size}` : ''}
          </Text>
          {renderTags(item)}
        </View>
        <View style={styles.actionButton}>
          <ExternalLink size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderXrayItem = (item: XrayFile) => {
    const url = xrayUrls[item.id];
    return (
      <TouchableOpacity style={styles.fileCard} onPress={() => openUrl(url)} activeOpacity={0.7}>
        {url ? (
          <Image source={{ uri: url }} style={styles.xrayThumb} resizeMode="cover" />
        ) : (
          <View style={styles.fileIconContainer}><ImageIcon size={24} color="#8B5CF6" /></View>
        )}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.file_name}</Text>
          <Text style={styles.fileMeta}>
            {format(new Date(item.capture_date || item.created_at), 'MMM d, yyyy')}
            {item.file_size ? ` • ${formatFileSize(item.file_size)}` : ''}
          </Text>
          <View style={styles.tagsRow}>
            <View style={[styles.tag, styles.tagXray]}>
              <Text style={[styles.tagText, styles.tagXrayText]}>X-ray</Text>
            </View>
            {!!item.image_type && (
              <View style={[styles.tag, styles.tagType]}>
                <Text style={[styles.tagText, styles.tagTypeText]}>{item.image_type}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.actionButton}>
          <ExternalLink size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Patient Documents</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handlePickDocument}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add File</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {uploading && (
        <UploadProgressBar progress={uploadProgress} phase={uploadPhase} label={uploadingName} />
      )}

      {files.length === 0 && xrays.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No documents uploaded yet.</Text>
          <Text style={styles.emptySubtext}>Upload PDFs, images, or X-rays.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {files.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Documents</Text>
              {files.map((item, i) => (
                <View key={item.id || `file-${i}`}>{renderFileItem(item)}</View>
              ))}
            </>
          )}

          {xrays.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, files.length > 0 && { marginTop: 12 }]}>X-Rays</Text>
              {xrays.map((item, i) => (
                <View key={item.id || `xray-${i}`}>{renderXrayItem(item)}</View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  xrayThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tagType: { backgroundColor: '#F3F4F6' },
  tagTypeText: { color: '#6B7280' },
  tagSource: { backgroundColor: '#EEF2FF' },
  tagSourceText: { color: colors.primary },
  tagUpload: { backgroundColor: '#ECFDF5' },
  tagUploadText: { color: '#059669' },
  tagReport: { backgroundColor: '#FEF3C7' },
  tagReportText: { color: '#B45309' },
  tagXray: { backgroundColor: '#F3E8FF' },
  tagXrayText: { color: '#7C3AED' },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
