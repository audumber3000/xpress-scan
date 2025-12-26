import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiUrl, checkServerStatus, isTauri } from '../tauri';

const ApiContext = createContext();

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

export const ApiProvider = ({ children }) => {
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshStatus = async () => {
    try {
      const status = await checkServerStatus();
      setServerStatus(status);
      setApiUrl(status.api_url);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to check server status');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const url = await getApiUrl();
        setApiUrl(url);
        
        if (isTauri()) {
          await refreshStatus();
        }
      } catch (err) {
        console.error('Failed to initialize API context:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Poll server status every 30 seconds if in Tauri
    let interval;
    if (isTauri()) {
      interval = setInterval(refreshStatus, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const value = {
    apiUrl,
    serverStatus,
    loading,
    error,
    refreshStatus,
    isTauriApp: isTauri(),
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

export default ApiContext;
