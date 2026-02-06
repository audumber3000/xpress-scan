import React, { useEffect, useState } from 'react';
import { CustomAlertModal } from '../shared/components/CustomAlertModal';
import {
  registerAlertHandler,
  unregisterAlertHandler,
  AlertOptions,
} from '../shared/components/alertService';

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const visible = alert !== null;

  useEffect(() => {
    registerAlertHandler((options) => setAlert(options));
    return () => unregisterAlertHandler();
  }, []);

  const handleDismiss = () => setAlert(null);

  return (
    <>
      {children}
      <CustomAlertModal
        visible={visible}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons ?? [{ text: 'OK' }]}
        onDismiss={handleDismiss}
      />
    </>
  );
};
