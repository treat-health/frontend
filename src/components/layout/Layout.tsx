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
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { getSocket } from '../../lib/socket';
import BrandLogo from '../common/BrandLogo';
import '../../styles/layout.css';

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
                { path: '/admin/users', icon: Users, label: 'User Management' },
                { path: '/admin/sessions', icon: Calendar, label: 'Sessions' },
                { path: '/clients', icon: UserPlus, label: 'Clients' },
                { path: '/reports', icon: BarChart2, label: 'Reports' },
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

/**
 * Main application layout with role-based sidebar navigation
 */
export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { totalUnread, isConnected, initializeSocket } = useChatStore();
    const { unreadCount, fetchUnreadCount, incrementUnreadCount, initializePushNotifications } = useNotificationStore();
    const [showDropdown, setShowDropdown] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark') {
            setIsDarkMode(true);
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDarkMode ? 'dark' : 'light';
        setIsDarkMode(!isDarkMode);
        document.documentElement.setAttribute('data-theme', newTheme);
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
                socket.on('notification:new', () => {
                    incrementUnreadCount();
                });
                clearInterval(checkSocketInterval);
            }
        }, 1000);

        return () => {
            clearInterval(checkSocketInterval);
            const socket = getSocket();
            if (socket) socket.off('notification:new');
        };
    }, [user, fetchUnreadCount, incrementUnreadCount, initializeSocket, initializePushNotifications]);

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
        return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
                className={`sidebar-floating-toggle ${!sidebarOpen ? 'collapsed' : ''}`}
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
                        <button className="btn btn-icon btn-ghost header-btn" onClick={toggleTheme} title="Toggle Dark Mode">
                            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button className="btn btn-icon btn-ghost header-btn" style={{ position: 'relative' }}>
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
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        <div
                            className="header-user"
                            onClick={() => setShowDropdown(!showDropdown)}
                            role="button"
                            tabIndex={0}
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
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="app-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
