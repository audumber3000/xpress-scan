import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Download an authenticated export URL to a temp file and open the OS share
 * sheet (which offers Save to Files, Print, WhatsApp, Mail, …). This is the
 * mobile equivalent of the web's file download — the server builds the PDF/CSV,
 * we just fetch it with the auth token and hand it to the share sheet.
 *
 * expo-file-system, expo-sharing and expo-print are required lazily, not at the
 * top of the module. A top-level import would run at app boot; on a binary that
 * predates these native modules (e.g. an older dev build), that throws
 * "Cannot find native module" and takes the whole app down. Deferring the
 * require to the moment of export means the rest of the app runs regardless,
 * and only the export action reports that a newer build is needed.
 */
export async function exportDaySheet(url: string, filename: string, format: 'csv' | 'pdf'): Promise<void> {
  let FileSystem: typeof import('expo-file-system/legacy');
  let Sharing: typeof import('expo-sharing');
  try {
    FileSystem = require('expo-file-system/legacy');
    Sharing = require('expo-sharing');
  } catch {
    throw new Error('Export needs the latest app build. Please update the app, then try again.');
  }

  const token = await AsyncStorage.getItem('access_token');
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory available');
  const fileUri = `${dir}${filename}`;

  const res = await FileSystem.downloadAsync(url, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Export failed (HTTP ${res.status})`);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(res.uri, {
    mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
    dialogTitle: filename,
    UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}
