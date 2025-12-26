import React from 'react';
import { Server, Database, Wifi, WifiOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';

const ServerStatus = () => {
  const { serverStatus, loading, error, refreshStatus, isTauriApp } = useApi();

  if (!isTauriApp) {
    return null;
  }

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 flex items-center space-x-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-600">Checking status...</span>
      </div>
    );
  }

  if (!serverStatus) {
    return null;
  }

  const isServer = serverStatus.mode === 'server';
  const isConnected = serverStatus.all_services_running || serverStatus.backend_running;

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <div className="flex items-center space-x-3">
        {/* Mode indicator */}
        <div className={`p-2 rounded-lg ${isServer ? 'bg-indigo-100' : 'bg-green-100'}`}>
          {isServer ? (
            <Server className="w-4 h-4 text-indigo-600" />
          ) : (
            <Wifi className="w-4 h-4 text-green-600" />
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase">
            {isServer ? 'Server Mode' : 'Client Mode'}
          </span>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-sm text-green-700">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="text-sm text-red-700">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={refreshStatus}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Refresh status"
        >
          <Loader2 className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </button>
      </div>

      {/* Server details for server mode */}
      {isServer && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">PostgreSQL</span>
            {serverStatus.postgres_running ? (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" /> Running
              </span>
            ) : (
              <span className="text-red-600 flex items-center">
                <XCircle className="w-3 h-3 mr-1" /> Stopped
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Backend API</span>
            {serverStatus.backend_running ? (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" /> Running
              </span>
            ) : (
              <span className="text-red-600 flex items-center">
                <XCircle className="w-3 h-3 mr-1" /> Stopped
              </span>
            )}
          </div>
        </div>
      )}

      {/* Server IP for client mode */}
      {!isServer && serverStatus.server_ip && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Server IP</span>
            <span className="font-mono text-gray-700">{serverStatus.server_ip}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ServerStatus;
