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
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';

interface LayoutProps {
    children: React.ReactNode;
}

/**
 * Main application layout with sidebar navigation
 */
export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { totalUnread, isConnected } = useChatStore();
    const [showDropdown, setShowDropdown] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/messages', icon: MessageSquare, label: 'Messages', badge: totalUnread },
        { path: '/appointments', icon: Calendar, label: 'Appointments' },
        { path: '/clients', icon: Users, label: 'Clients' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    const getInitials = () => {
        if (!user) return '??';
        return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    };

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className={`app-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                {/* Logo */}
                <div className="sidebar-header">
                    <Link to="/dashboard" className="sidebar-logo">
                        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
                            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" fill="var(--primary-100)" />
                            <path
                                d="M20 8C20 8 10 14 10 22C10 28.075 14.925 33 21 33C27.075 33 32 28.075 32 22C32 14 20 8 20 8Z"
                                fill="var(--primary-500)"
                            />
                            <circle cx="20" cy="20" r="4" fill="white" />
                        </svg>
                        {sidebarOpen && <span>Treat Health</span>}
                    </Link>
                    <button
                        className="sidebar-toggle btn btn-icon btn-ghost"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
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
                            <span className="user-role">{user?.role}</span>
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

            {/* Main Content */}
            <div className="app-main">
                {/* Top Header */}
                <header className="app-header">
                    <div className="header-left">
                        <h1>{navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}</h1>
                    </div>
                    <div className="header-right">
                        <button className="btn btn-icon btn-ghost header-btn">
                            <Bell size={20} />
                            <span className="notification-dot" />
                        </button>
                        <div className="header-user" onClick={() => setShowDropdown(!showDropdown)}>
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
