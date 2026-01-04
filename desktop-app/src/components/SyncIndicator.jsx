import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSyncStatus, formatTimeAgo } from '../utils/sync';

const SyncIndicator = () => {
  const [syncStatus, setSyncStatus] = useState({
    enabled: true,
    online: navigator.onLine,
    lastSync: null,
    lastSyncFormatted: 'Never synced',
    canSync: true,
  });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const status = getSyncStatus();
      setSyncStatus(status);
    };

    // Initial status
    updateStatus();

    // Update status periodically
    const interval = setInterval(updateStatus, 30000); // Every 30 seconds

    // Listen for online/offline events
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!syncStatus.canSync || syncing) return;

    setSyncing(true);
    try {
      const { performIncrementalSync } = await import('../utils/sync');
      await performIncrementalSync();
      // Update status after sync
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error('Manual sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getIcon = () => {
    if (!syncStatus.online) {
      return <CloudOff className="w-4 h-4 text-gray-400" />;
    }
    if (syncing) {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (syncStatus.lastSync) {
      return <CheckCircle2 className="w-4 h-4 text-[#6C4CF3]" />;
    }
    return <Cloud className="w-4 h-4 text-gray-400" />;
  };

  const getText = () => {
    if (!syncStatus.online) {
      return 'Offline';
    }
    if (syncing) {
      return 'Syncing...';
    }
    if (syncStatus.lastSync) {
      return `Synced ${syncStatus.lastSyncFormatted}`;
    }
    return 'Not synced';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
      {getIcon()}
      <span className="text-sm text-gray-600">{getText()}</span>
      {syncStatus.online && !syncing && (
        <button
          onClick={handleManualSync}
          className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
          title="Sync now"
        >
          <RefreshCw className="w-3 h-3 text-gray-500" />
        </button>
      )}
    </div>
  );
};

export default SyncIndicator;
