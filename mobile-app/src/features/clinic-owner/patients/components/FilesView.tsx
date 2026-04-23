import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { toast } from '../../../../shared/components/toastService';
import { FileText, Image as ImageIcon, Plus, Trash2, File, ExternalLink } from 'lucide-react-native';
import { colors } from '../../../../shared/constants/colors';
import { patientsApiService, PatientFile, XrayFile } from '../../../../services/api/patients.api';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';

interface FilesViewProps {
  patientId: string;
}

export const FilesView: React.FC<FilesViewProps> = ({ patientId }) => {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [xrays, setXrays] = useState<XrayFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [patientId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const [patientFiles, xrayFiles] = await Promise.all([
        patientsApiService.getFiles(patientId),
        patientsApiService.getXrays(patientId)
      ]);
      setFiles(patientFiles);
      setXrays(xrayFiles);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploading(true);
        
        // Prepare file object for fetch/FormData
        const fileToUpload = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        };

        await patientsApiService.uploadFile(patientId, fileToUpload);
        toast.success('File uploaded successfully');
        loadFiles();
      }
    } catch (error) {
      console.error('Error picking document:', error);
      toast.error('Failed to pick or upload document');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={24} color="#EF4444" />;
      case 'image': return <ImageIcon size={24} color="#3B82F6" />;
      case 'xray': return <ImageIcon size={24} color="#8B5CF6" />;
      default: return <File size={24} color="#6B7280" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFileItem = ({ item }: { item: PatientFile }) => (
    <View style={styles.fileCard}>
      <View style={styles.fileIconContainer}>
        {getFileIcon(item.file_type)}
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.file_name}</Text>
        <Text style={styles.fileMeta}>
          {format(new Date(item.uploaded_at), 'MMM d, yyyy')} • {formatFileSize(item.file_size)}
        </Text>
      </View>
      <TouchableOpacity style={styles.actionButton}>
        <ExternalLink size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

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

      <FlatList
        data={files}
        keyExtractor={(item) => item.file_name}
        renderItem={renderFileItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No documents uploaded yet.</Text>
            <Text style={styles.emptySubtext}>Upload PDFs, images, or X-rays.</Text>
          </View>
        }
      />
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
    borderRadius: 12,
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
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
