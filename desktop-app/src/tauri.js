import { invoke } from '@tauri-apps/api/core';

// Check if running in Tauri environment
export const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
};

// App mode functions
export const getAppMode = async () => {
  if (!isTauri()) return 'client';
  return await invoke('get_app_mode');
};

export const setAppMode = async (mode) => {
  if (!isTauri()) return;
  return await invoke('set_app_mode', { mode });
};

// Server IP functions
export const getServerIp = async () => {
  if (!isTauri()) return null;
  return await invoke('get_server_ip');
};

export const setServerIp = async (ip) => {
  if (!isTauri()) return;
  return await invoke('set_server_ip', { ip });
};

// Server services functions
export const startServerServices = async () => {
  if (!isTauri()) return;
  return await invoke('start_server_services');
};

export const stopServerServices = async () => {
  if (!isTauri()) return;
  return await invoke('stop_server_services');
};

export const checkServerStatus = async () => {
  if (!isTauri()) {
    return {
      mode: 'client',
      server_ip: null,
      api_url: 'http://localhost:8000',
      postgres_running: false,
      backend_running: false,
      all_services_running: false,
    };
  }
  return await invoke('check_server_status');
};

// Get local IP address
export const getLocalIp = async () => {
  if (!isTauri()) return '127.0.0.1';
  return await invoke('get_local_ip');
};

// First run check
export const isFirstRun = async () => {
  if (!isTauri()) return false;
  return await invoke('is_first_run');
};

// Complete setup
export const completeSetup = async (mode, serverIp = null) => {
  if (!isTauri()) return;
  return await invoke('complete_setup', { mode, serverIp });
};

// Get API URL based on current configuration
export const getApiUrl = async () => {
  if (!isTauri()) {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  }
  
  const status = await checkServerStatus();
  return status.api_url;
};
