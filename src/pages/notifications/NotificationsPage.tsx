import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStore, type AppNotification } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';

function getNotificationTargetPath(notification: AppNotification, role?: string): string {
    if (notification.type === 'NEW_MESSAGE') {
        const conversationId = (notification.data as any)?.conversationId;
        return conversationId ? `/messages?conversationId=${encodeURIComponent(conversationId)}` : '/messages';
    }

    if (notification.appointmentId) {
        if (role === 'ADMIN' || role === 'PROGRAM_DIRECTOR') return '/admin/sessions';
        if (role === 'THERAPIST') return '/therapist/appointments';
        return '/appointments';
    }

    return '/dashboard';
}

function formatNotificationTime(value: string) {
    const date = new Date(value);
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const {
        notifications,
        unreadCount,
        isLoadingNotifications,
        isLoadingMoreNotifications,
        hasMoreNotifications,
        fetchNotifications,
        loadMoreNotifications,
        markAsRead,
        markAllRead,
    } = useNotificationStore();

    useEffect(() => {
        fetchNotifications(20, 0, false);
    }, [fetchNotifications]);

    const handleNotificationClick = async (notification: AppNotification) => {
        if (!notification.readAt) {
            await markAsRead(notification.id);
        }
        navigate(getNotificationTargetPath(notification, user?.role));
    };

    return (
        <div className="page-content" style={{ maxWidth: 980 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bell size={22} />
                    <h2 style={{ margin: 0 }}>Notifications</h2>
                    {unreadCount > 0 && (
                        <span className="nav-badge" style={{ marginLeft: 4 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </div>

                <button className="btn btn-secondary" onClick={() => markAllRead()}>
                    <CheckCheck size={16} style={{ marginRight: 6 }} />
                    Mark all as read
                </button>
            </div>

            {isLoadingNotifications && (
                <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--gray-500)' }}>
                    Loading notifications...
                </div>
            )}

            {!isLoadingNotifications && notifications.length === 0 && (
                <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--gray-500)' }}>
                    You have no notifications yet.
                </div>
            )}

            {!isLoadingNotifications && notifications.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {notifications.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            style={{
                                width: '100%',
                                border: 'none',
                                textAlign: 'left',
                                padding: '14px 16px',
                                background: n.readAt ? 'transparent' : 'var(--primary-50)',
                                borderBottom: '1px solid var(--gray-100)',
                                cursor: 'pointer',
                            }}
                            title={n.body}
                        >
                            <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: 4 }}>{n.title}</div>
                            <div style={{ color: 'var(--gray-600)', marginBottom: 6 }}>{n.body}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{formatNotificationTime(n.sentAt)}</div>
                        </button>
                    ))}
                </div>
            )}

            {!isLoadingNotifications && notifications.length > 0 && hasMoreNotifications && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <button className="btn btn-secondary" onClick={loadMoreNotifications} disabled={isLoadingMoreNotifications}>
                        {isLoadingMoreNotifications ? 'Loading...' : 'Load more'}
                    </button>
                </div>
            )}
        </div>
    );
}
