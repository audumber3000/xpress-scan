import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

const ConnectivityBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsVisible(true);
      // Auto-hide after 3 seconds when back online
      setTimeout(() => {
        setIsVisible(false);
        setWasOffline(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!wasOffline && isOnline) return null;

  const bgClass = isOnline ? 'bg-emerald-500' : 'bg-red-500';
  const Icon = isOnline ? Wifi : WifiOff;
  const message = isOnline 
    ? "Back online! Your connection has been restored." 
    : "You're currently offline. Your work will sync when you're back.";

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[9999] transform transition-transform duration-500 ease-in-out ${
        isVisible || !isOnline ? 'translate-y-0' : '-translate-y-full'
      } ${bgClass} text-white py-2 px-4 shadow-lg`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <Icon size={18} className="animate-pulse" />
        <span className="text-sm font-medium tracking-wide">
          {message}
        </span>
      </div>
    </div>
  );
};

export default ConnectivityBanner;
