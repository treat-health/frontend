import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    MessageSquare,
    Calendar,
    Users,
    Settings,
    LogOut,
    Bell,
    ChevronDown,
    Shield,
    UserPlus,
    BarChart2,
    ChevronLeft,
    ChevronRight,
    Sun,
    Moon,
    HelpCircle,
    Sparkles,
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { getSocket } from '../../lib/socket';
import BrandLogo from '../common/BrandLogo';
import HelpWizard from '../common/HelpWizard';
import '../../styles/layout.css';
import type { AppNotification } from '../../stores/notificationStore';

interface LayoutProps {
    children: React.ReactNode;
}

interface NavItem {
    path: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
}

/**
 * Get navigation items based on user role
 */
function getNavItemsForRole(role: string, totalUnread: number): NavItem[] {
    const baseItems: NavItem[] = [
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: totalUnread },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    switch (role) {
        case 'ADMIN':
        case 'PROGRAM_DIRECTOR':
            return [
                { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { path: '/admin/issues', icon: HelpCircle, label: 'Issue Management' },
                { path: '/admin/users', icon: Users, label: 'User Management' },
                { path: '/admin/sessions', icon: Calendar, label: 'Sessions' },
                { path: '/clients', icon: UserPlus, label: 'Clients' },
                { path: '/reports', icon: BarChart2, label: 'Reports' },
                { path: '/admin/feedback', icon: Sparkles, label: 'Program Feedback' },
                ...baseItems,
            ];

        case 'THERAPIST':
            return [
                { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { path: '/therapist/clients', icon: Users, label: 'My Clients' },
                { path: '/therapist/appointments', icon: Calendar, label: 'Appointments' },
                ...baseItems,
            ];

        case 'CARE_COORDINATOR':
            return [
                { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { path: '/clients', icon: Users, label: 'Clients' },
                { path: '/appointments', icon: Calendar, label: 'Appointments' },
                ...baseItems,
            ];

        case 'CLIENT':
        default:
            return [
                { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { path: '/appointments', icon: Calendar, label: 'My Appointments' },
                ...baseItems,
            ];
    }
}

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

    return '/notifications';
}

/**
 * Main application layout with role-based sidebar navigation
 */
export default function Layout({ children }: Readonly<LayoutProps>) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { totalUnread, isConnected, initializeSocket } = useChatStore();
    const {
        unreadCount,
        notifications,
        isLoadingNotifications,
        fetchUnreadCount,
        fetchNotifications,
        markAsRead,
        markAllRead,
        addRealtimeNotification,
        initializePushNotifications
    } = useNotificationStore();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showHelpWizard, setShowHelpWizard] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const notificationPanelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark') {
            setIsDarkMode(true);
            document.documentElement.dataset.theme = 'dark';
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = isDarkMode ? 'light' : 'dark';
        setIsDarkMode(!isDarkMode);
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
    };

    const navItems = useMemo(() =>
        getNavItemsForRole(user?.role || 'CLIENT', totalUnread),
        [user?.role, totalUnread]
    );

    // Initial fetch of unread notifications & socket listener
    useEffect(() => {
        if (!user) return;

        // Initialize Chat Socket globally so user stays "Online" on all pages
        initializeSocket();

        fetchUnreadCount();
        initializePushNotifications();

        // A small polling interval to reliably attach the socket listener after chatStore init
        const checkSocketInterval = setInterval(() => {
            const socket = getSocket();
            if (socket && socket.connected) {
                // Remove before adding to avoid duplicates
                socket.off('notification:new');
                socket.on('notification:new', (payload) => {
                    addRealtimeNotification(payload);
                });
                clearInterval(checkSocketInterval);
            }
        }, 1000);

        return () => {
            clearInterval(checkSocketInterval);
            const socket = getSocket();
            if (socket) socket.off('notification:new');
        };
    }, [user, fetchUnreadCount, addRealtimeNotification, initializeSocket, initializePushNotifications]);

    useEffect(() => {
        const onDocumentMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (notificationPanelRef.current && !notificationPanelRef.current.contains(target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', onDocumentMouseDown);
        return () => document.removeEventListener('mousedown', onDocumentMouseDown);
    }, []);

    const handleBellClick = async () => {
        const nextOpen = !showNotifications;
        setShowNotifications(nextOpen);
        if (nextOpen) {
            await fetchNotifications(20, 0);
            if (unreadCount > 0) {
                await markAllRead();
            }
        }
    };

    const formatNotificationTime = (value: string) => {
        const date = new Date(value);
        return date.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleNotificationClick = async (notification: AppNotification) => {
        if (!notification.readAt) {
            await markAsRead(notification.id);
        }
        setShowNotifications(false);
        navigate(getNotificationTargetPath(notification, user?.role));
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const getInitials = () => {
        if (!user) return '??';
        return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    };

    const getRoleBadge = () => {
        if (user?.role === 'ADMIN' || user?.role === 'PROGRAM_DIRECTOR') {
            return <Shield size={14} className="role-icon" />;
        }
        return null;
    };

    const formatRole = (role: string) => {
        return role.replaceAll('_', ' ').toLowerCase().replaceAll(/\b\w/g, c => c.toUpperCase());
    };

    const getPageTitle = () => {
        const currentNav = navItems.find(n => location.pathname.startsWith(n.path));
        return currentNav?.label || 'Dashboard';
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className={`app-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                {/* Logo */}
                <div className="sidebar-header">
                    <Link to="/dashboard" className="sidebar-logo">
                        <BrandLogo size="sm" />
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            {sidebarOpen && (
                                <>
                                    <span>{item.label}</span>
                                    {item.badge && item.badge > 0 && (
                                        <span className="nav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                                    )}
                                </>
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Connection Status */}
                {sidebarOpen && (
                    <div className="sidebar-status">
                        <span className={`status-dot ${isConnected ? 'online' : ''}`} />
                        <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
                    </div>
                )}

                {/* User */}
                <div className="sidebar-user">
                    <div className="user-avatar">{getInitials()}</div>
                    {sidebarOpen && (
                        <div className="user-info">
                            <span className="user-name">{user?.firstName} {user?.lastName}</span>
                            <span className="user-role">
                                {getRoleBadge()}
                                {formatRole(user?.role || '')}
                            </span>
                        </div>
                    )}
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* Floating Toggle Button */}
            <button
                className={`sidebar-floating-toggle ${sidebarOpen ? '' : 'collapsed'}`}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Main Content */}
            <div className="app-main">
                {/* Top Header */}
                <header className="app-header">
                    <div className="header-left">
                        <h1>{getPageTitle()}</h1>
                    </div>
                    <div className="header-right">
                        {user?.role !== 'ADMIN' && user?.role !== 'PROGRAM_DIRECTOR' && (
                            <button className="btn btn-icon btn-ghost header-btn" onClick={() => setShowHelpWizard(true)} title="Help & Support">
                                <HelpCircle size={20} />
                            </button>
                        )}
                        <button className="btn btn-icon btn-ghost header-btn" onClick={toggleTheme} title="Toggle Dark Mode">
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="notification-menu" ref={notificationPanelRef}>
                            <button
                                className="btn btn-icon btn-ghost header-btn"
                                style={{ position: 'relative' }}
                                onClick={handleBellClick}
                                aria-label="Open notifications"
                                aria-expanded={showNotifications}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="notification-badge" style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        backgroundColor: 'var(--primary-color)',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        borderRadius: '50%',
                                        width: '16px',
                                        height: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="notification-panel">
                                    <div className="notification-panel-header">
                                        <h4>Notifications</h4>
                                        <button
                                            className="dropdown-item"
                                            style={{ width: 'auto', padding: '4px 8px' }}
                                            onClick={async () => {
                                                await markAllRead();
                                            }}
                                        >
                                            Mark all read
                                        </button>
                                    </div>

                                    <div className="notification-panel-list">
                                        {isLoadingNotifications && (
                                            <div className="notification-empty">Loading notifications...</div>
                                        )}

                                        {!isLoadingNotifications && notifications.length === 0 && (
                                            <div className="notification-empty">No notifications yet</div>
                                        )}

                                        {!isLoadingNotifications && notifications.map((n) => (
                                            <button
                                                key={n.id}
                                                className={`notification-item ${n.readAt ? '' : 'unread'}`}
                                                onClick={() => handleNotificationClick(n)}
                                                title={n.body}
                                            >
                                                <div className="notification-item-title">{n.title}</div>
                                                <div className="notification-item-body">{n.body}</div>
                                                <div className="notification-item-time">{formatNotificationTime(n.sentAt)}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="notification-panel-footer">
                                        <button
                                            className="dropdown-item"
                                            onClick={() => {
                                                setShowNotifications(false);
                                                navigate('/notifications');
                                            }}
                                        >
                                            View all notifications
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="header-user"
                            onClick={() => setShowDropdown(!showDropdown)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    setShowDropdown(!showDropdown);
                                }
                            }}
                        >
                            <div className="user-avatar small">{getInitials()}</div>
                            <span>{user?.firstName}</span>
                            <ChevronDown size={16} />

                            {showDropdown && (
                                <div className="dropdown-menu">
                                    <Link to="/settings" className="dropdown-item">
                                        <Settings size={16} />
                                        Settings
                                    </Link>
                                    <button className="dropdown-item" onClick={handleLogout}>
                                        <LogOut size={16} />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="app-content">
                    {children}
                </main>
            </div>

            {/* Help & Support Wizard */}
            <HelpWizard isOpen={showHelpWizard} onClose={() => setShowHelpWizard(false)} />
        </div>
    );
}
