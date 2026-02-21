import { create } from 'zustand';
import api from '../lib/api';
import { messaging, getToken, onMessage, VAPID_KEY } from '../lib/firebase';
import toast from 'react-hot-toast';

interface NotificationState {
    unreadCount: number;
    pushRegistered: boolean;
    fetchUnreadCount: () => Promise<void>;
    incrementUnreadCount: () => void;
    markAllRead: () => void;
    initializePushNotifications: () => Promise<void>;
    requestPushPermission: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    unreadCount: 0,
    pushRegistered: false,

    fetchUnreadCount: async () => {
        try {
            const res = await api.get('/notifications/unread-count');
            set({ unreadCount: res.data.data?.unread || res.data.data?.count || res.data.unread || res.data.count || 0 });
        } catch (error) {
            console.error('[NotificationStore] Failed to fetch unread count', error);
        }
    },

    incrementUnreadCount: () => {
        set((state) => ({ unreadCount: state.unreadCount + 1 }));
    },

    markAllRead: () => {
        set({ unreadCount: 0 });
    },

    initializePushNotifications: async () => {
        if (get().pushRegistered) return;
        if (!messaging) {
            console.warn('[NotificationStore] Firebase messaging not supported or initialized');
            return;
        }

        try {
            // Only initialize automatically if we already have permission.
            // Avoids prompting on load which gets blocked by browsers.
            if (Notification.permission === 'granted') {
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    await api.post('/notifications/devices', {
                        token,
                        platform: 'WEB',
                        deviceName: navigator.userAgent
                    });

                    set({ pushRegistered: true });
                    console.log('[NotificationStore] Push notifications registered successfully');

                    // Listen for foreground messages
                    onMessage(messaging, (payload) => {
                        toast(payload.notification?.title || 'New Notification', {
                            icon: '🔔',
                            position: 'top-right'
                        });
                        get().fetchUnreadCount();
                    });
                }
            }
        } catch (error) {
            console.error('[NotificationStore] Failed to initialize push notifications', error);
        }
    },

    requestPushPermission: async () => {
        if (!messaging) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await get().initializePushNotifications();
                toast.success('Push notifications enabled!');
            } else {
                toast.error('Notification permission denied');
            }
        } catch (error) {
            console.error('[NotificationStore] Failed to request permission', error);
        }
    }
}));
