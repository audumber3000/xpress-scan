import React, { useEffect, useState } from 'react';
import { ToastNotification } from '../shared/components/ToastNotification';
import {
  registerToastHandler,
  unregisterToastHandler,
  ToastOptions,
} from '../shared/components/toastService';

interface ToastProviderProps {
  children: React.ReactNode;
}

const DEFAULT_DURATION = 3000;

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    registerToastHandler((options) => {
      // If a toast is already visible, hide it first then show new one
      setVisible(false);
      setTimeout(() => {
        setToast(options);
        setVisible(true);
      }, toast ? 120 : 0);
    });
    return () => unregisterToastHandler();
  }, []);

  const handleHide = () => {
    setVisible(false);
    setTimeout(() => setToast(null), 300);
  };

  return (
    <>
      {children}
      {toast && (
        <ToastNotification
          visible={visible}
          message={toast.message}
          type={toast.type}
          duration={toast.duration ?? DEFAULT_DURATION}
          onHide={handleHide}
        />
      )}
    </>
  );
};
