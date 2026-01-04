import React, { useState, useEffect } from 'react';
import { isWindows, isMac, initializeTwain, disconnectTwain, getTwainStatus } from '../../utils/twain';

const TwainConnector = ({ onConnected, onDisconnected, onError }) => {
  const [status, setStatus] = useState('checking'); // checking, connected, disconnected, error, unavailable
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const statusInfo = await getTwainStatus();
      
      if (!statusInfo.available) {
        setStatus('unavailable');
        setMessage(statusInfo.message);
        return;
      }

      if (statusInfo.connected) {
        setStatus('connected');
        setMessage('TWAIN driver connected');
        if (onConnected) onConnected();
      } else {
        setStatus('disconnected');
        setMessage('TWAIN driver not connected');
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Error checking status: ${error.message}`);
      if (onError) onError(error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setStatus('checking');
    setMessage('Connecting to TWAIN driver...');

    try {
      const result = await initializeTwain();
      setStatus('connected');
      setMessage(result.message || 'TWAIN driver connected');
      if (onConnected) onConnected();
    } catch (error) {
      setStatus('error');
      setMessage(`Connection failed: ${error.message}`);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectTwain();
      setStatus('disconnected');
      setMessage('TWAIN driver disconnected');
      if (onDisconnected) onDisconnected();
    } catch (error) {
      setStatus('error');
      setMessage(`Disconnect failed: ${error.message}`);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  if (isMac()) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              X-ray feature is not supported on macOS
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Please use the Windows version of the desktop app to access X-ray features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isWindows()) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600">
          TWAIN driver connection is only available on Windows.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            status === 'connected' ? 'bg-[#6C4CF3]' :
            status === 'error' ? 'bg-red-500' :
            status === 'checking' ? 'bg-yellow-500 animate-pulse' :
            'bg-gray-400'
          }`}></div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              TWAIN Driver Status
            </p>
            <p className="text-xs text-gray-600">{message}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {status === 'connected' ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading || status === 'unavailable'}
              className="px-3 py-1.5 text-sm bg-[#6C4CF3] hover:bg-[#5b3dd9] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwainConnector;

