// Cloud Sync Utilities
// Handles syncing local data with remote cloud database

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let syncIntervalId = null;

// Get last sync time from localStorage
export const getLastSyncTime = () => {
  const timestamp = localStorage.getItem('last_sync_time');
  return timestamp ? parseInt(timestamp, 10) : null;
};

// Format time ago string (industry standard)
export const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Never synced';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  
  // Format as date for older syncs
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

// Check if cloud sync is enabled
export const isCloudSyncEnabled = () => {
  return localStorage.getItem('cloud_sync_enabled') === 'true';
};

// Enable/disable cloud sync
export const setCloudSyncEnabled = (enabled) => {
  localStorage.setItem('cloud_sync_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
};

// Get sync status
export const getSyncStatus = () => {
  const lastSync = getLastSyncTime();
  const enabled = isCloudSyncEnabled();
  const online = navigator.onLine;
  
  return {
    enabled,
    online,
    lastSync,
    lastSyncFormatted: formatTimeAgo(lastSync),
    canSync: enabled && online,
  };
};

// Sync data to cloud
export const syncToCloud = async () => {
  if (!isCloudSyncEnabled() || !navigator.onLine) {
    return { success: false, reason: 'Sync disabled or offline' };
  }
  
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return { success: false, reason: 'Not authenticated' };
    }
    
    // Get cloud API URL from environment or config
    const cloudApiUrl = import.meta.env.VITE_CLOUD_API_URL;
    if (!cloudApiUrl) {
      return { success: false, reason: 'Cloud API not configured' };
    }
    
    // TODO: Implement actual sync logic
    // This would:
    // 1. Get local changes since last sync
    // 2. Send to cloud API
    // 3. Receive cloud changes
    // 4. Merge and resolve conflicts
    // 5. Update local database
    
    // For now, simulate sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    localStorage.setItem('last_sync_time', Date.now().toString());
    
    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, reason: error.message };
  }
};

// Sync data from cloud (pull latest)
export const syncFromCloud = async () => {
  if (!isCloudSyncEnabled() || !navigator.onLine) {
    return { success: false, reason: 'Sync disabled or offline' };
  }
  
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return { success: false, reason: 'Not authenticated' };
    }
    
    // TODO: Implement actual pull logic
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true };
  } catch (error) {
    console.error('Sync from cloud error:', error);
    return { success: false, reason: error.message };
  }
};

// Start automatic sync interval
export const startAutoSync = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }
  
  if (isCloudSyncEnabled()) {
    syncIntervalId = setInterval(async () => {
      if (navigator.onLine) {
        await syncToCloud();
      }
    }, SYNC_INTERVAL);
  }
};

// Stop automatic sync
export const stopAutoSync = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
};

// Initialize sync on app start
export const initializeSync = () => {
  if (isCloudSyncEnabled()) {
    startAutoSync();
  }
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    if (isCloudSyncEnabled()) {
      syncToCloud();
    }
  });
};

export default {
  getLastSyncTime,
  formatTimeAgo,
  isCloudSyncEnabled,
  setCloudSyncEnabled,
  getSyncStatus,
  syncToCloud,
  syncFromCloud,
  startAutoSync,
  stopAutoSync,
  initializeSync,
};
