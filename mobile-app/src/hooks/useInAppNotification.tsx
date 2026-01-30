import { useState, useCallback } from 'react';

export interface NotificationData {
    id: string;
    title: string;
    body: string;
    type?: 'default' | 'success' | 'warning' | 'error' | 'info';
    onPress?: () => void;
    duration?: number;
}

export function useInAppNotification() {
    const [notification, setNotification] = useState<NotificationData | null>(null);

    const show = useCallback((data: Omit<NotificationData, 'id'>) => {
        const id = Date.now().toString();
        setNotification({
            id,
            ...data,
        });
    }, []);

    const hide = useCallback(() => {
        setNotification(null);
    }, []);

    return {
        notification,
        show,
        hide,
    };
}
