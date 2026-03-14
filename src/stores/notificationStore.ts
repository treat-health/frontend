import { create } from 'zustand';
import api from '../lib/api';
import { messaging, getToken, onMessage, VAPID_KEY } from '../lib/firebase';
import toast from 'react-hot-toast';

export interface AppNotification {
    id: string;
    userId?: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sentAt: string;
    readAt: string | null;
    appointmentId?: string | null;
    groupSessionId?: string | null;
    createdAt?: string;
}

interface NotificationState {
    unreadCount: number;
    pushRegistered: boolean;
    notifications: AppNotification[];
    isLoadingNotifications: boolean;
    isLoadingMoreNotifications: boolean;
    notificationLimit: number;
    notificationOffset: number;
    hasMoreNotifications: boolean;
    fetchUnreadCount: () => Promise<void>;
    incrementUnreadCount: () => void;
    fetchNotifications: (limit?: number, offset?: number, append?: boolean) => Promise<void>;
    loadMoreNotifications: () => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    addRealtimeNotification: (payload?: Partial<AppNotification> & { message?: string }) => void;
    initializePushNotifications: () => Promise<void>;
    requestPushPermission: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    unreadCount: 0,
    pushRegistered: false,
    notifications: [],
    isLoadingNotifications: false,
    isLoadingMoreNotifications: false,
    notificationLimit: 20,
    notificationOffset: 0,
    hasMoreNotifications: true,

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

    fetchNotifications: async (limit = 20, offset = 0, append = false) => {
        set({
            isLoadingNotifications: !append,
            isLoadingMoreNotifications: append,
        });
        try {
            const res = await api.get('/notifications', {
                params: { limit, offset }
            });
            const list = (res.data?.data || []) as AppNotification[];

            set((state) => ({
                notifications: append ? [...state.notifications, ...list] : list,
                isLoadingNotifications: false,
                isLoadingMoreNotifications: false,
                notificationLimit: limit,
                notificationOffset: offset,
                hasMoreNotifications: list.length >= limit,
            }));
        } catch (error) {
            console.error('[NotificationStore] Failed to fetch notifications', error);
            set({ isLoadingNotifications: false, isLoadingMoreNotifications: false });
        }
    },

    loadMoreNotifications: async () => {
        const { isLoadingMoreNotifications, hasMoreNotifications, notificationLimit, notificationOffset } = get();
        if (isLoadingMoreNotifications || !hasMoreNotifications) return;

        const nextOffset = notificationOffset + notificationLimit;
        await get().fetchNotifications(notificationLimit, nextOffset, true);
    },

    markAsRead: async (notificationId: string) => {
        try {
            await api.post(`/notifications/${notificationId}/read`);
            set((state) => {
                const updated = state.notifications.map((n) =>
                    n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
                );
                const unreadCount = Math.max(
                    0,
                    state.unreadCount - (state.notifications.some(n => n.id === notificationId && !n.readAt) ? 1 : 0)
                );
                return { notifications: updated, unreadCount };
            });
        } catch (error) {
            console.error('[NotificationStore] Failed to mark notification as read', error);
        }
    },

    markAllRead: async () => {
        try {
            await api.post('/notifications/read-all');
            set((state) => ({
                unreadCount: 0,
                notifications: state.notifications.map((n) =>
                    n.readAt ? n : { ...n, readAt: new Date().toISOString() }
                )
            }));
        } catch (error) {
            console.error('[NotificationStore] Failed to mark all as read', error);
        }
    },

    addRealtimeNotification: (payload) => {
        const now = new Date().toISOString();
        const id = payload?.id || `realtime-${Date.now()}`;

        const notification: AppNotification = {
            id,
            type: payload?.type || 'SYSTEM_ANNOUNCEMENT',
            title: payload?.title || 'New Notification',
            body: payload?.body || payload?.message || 'You have a new notification',
            data: payload?.data,
            sentAt: payload?.sentAt || now,
            readAt: payload?.readAt ?? null,
            appointmentId: payload?.appointmentId ?? null,
            groupSessionId: payload?.groupSessionId ?? null,
        };

        set((state) => {
            const exists = state.notifications.some((n) => n.id === id);
            return {
                notifications: exists ? state.notifications : [notification, ...state.notifications].slice(0, 50),
                unreadCount: state.unreadCount + 1,
                notificationOffset: 0,
            };
        });
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
