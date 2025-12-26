import React, { useState, useEffect } from 'react';
import { getSyncStatus, syncToCloud, formatTimeAgo } from '../utils/sync';

const SyncIndicator = () => {
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [syncing, setSyncing] = useState(false);

  // Update sync status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(getSyncStatus());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () => setSyncStatus(getSyncStatus());
    const handleOffline = () => setSyncStatus(getSyncStatus());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (syncing || !syncStatus.canSync) return;

    setSyncing(true);
    try {
      await syncToCloud();
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
    setSyncing(false);
  };

  // Don't show if cloud sync is not enabled
  if (!syncStatus.enabled) {
    return null;
  }

  return (
    <button
      onClick={handleManualSync}
      disabled={syncing || !syncStatus.online}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
        syncing 
          ? 'bg-blue-50 text-blue-600' 
          : syncStatus.online 
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' 
            : 'bg-yellow-50 text-yellow-600'
      }`}
      title={syncStatus.online ? 'Click to sync now' : 'Offline - sync paused'}
    >
      {/* Sync Icon */}
      <svg 
        className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
        />
      </svg>

      {/* Status Text */}
      <span>
        {syncing 
          ? 'Syncing...' 
          : syncStatus.online 
            ? syncStatus.lastSyncFormatted
            : 'Offline'
        }
      </span>

      {/* Status Dot */}
      <span 
        className={`w-2 h-2 rounded-full ${
          syncing 
            ? 'bg-blue-500 animate-pulse' 
            : syncStatus.online 
              ? 'bg-green-500' 
              : 'bg-yellow-500'
        }`} 
      />
    </button>
  );
};

export default SyncIndicator;
