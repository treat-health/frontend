import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    UserPlus,
    Calendar,
    BarChart2,
    TrendingUp,
    Clock,
    ChevronRight,
    Activity
} from 'lucide-react';
import api from '../../../lib/api';
import type { ApiResponse } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import './AdminDashboard.css';

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    pendingInvites: number;
    totalAppointments: number;
    upcomingAppointments: number;
    todayAppointments: number;
}

interface RecentUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
}

/**
 * Admin Dashboard - Overview and quick actions for administrators
 */
export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        activeUsers: 0,
        pendingInvites: 0,
        totalAppointments: 0,
        upcomingAppointments: 0,
        todayAppointments: 0,
    });
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user: currentUser } = useAuthStore();

    // Filter out current user from recent users
    const filteredRecentUsers = useMemo(() =>
        recentUsers.filter(user => user.id !== currentUser?.id),
        [recentUsers, currentUser?.id]
    );

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // Fetch users to calculate stats
            const usersResponse = await api.get<ApiResponse<{ users: RecentUser[]; pagination: { total: number } }>>('/users?limit=5&sortBy=createdAt&sortOrder=desc');

            if (usersResponse.data.success && usersResponse.data.data) {
                const { users, pagination } = usersResponse.data.data;
                setRecentUsers(users);
                // Subtract 1 from total to exclude current user
                const otherUsersCount = Math.max(0, pagination.total - 1);
                setStats(prev => ({
                    ...prev,
                    totalUsers: otherUsersCount,
                    activeUsers: otherUsersCount, // Simplified for now
                }));
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatRole = (role: string) => {
        return role.replaceAll('_', ' ').toLowerCase().replaceAll(/\b\w/g, c => c.toUpperCase());
    };

    let recentUsersContent;
    if (isLoading) {
        recentUsersContent = (
            <div className="loading-placeholder">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-row">
                        <div className="skeleton-avatar" />
                        <div className="skeleton-text" />
                    </div>
                ))}
            </div>
        );
    } else if (filteredRecentUsers.length === 0) {
        recentUsersContent = (
            <div className="empty-state-mini">
                <Users size={32} />
                <p>No other users yet</p>
            </div>
        );
    } else {
        recentUsersContent = (
            <div className="user-list">
                {filteredRecentUsers.map((user) => (
                    <div key={user.id} className="user-row">
                        <div className="user-avatar-sm">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user.firstName} {user.lastName}</span>
                            <span className="user-meta">{user.email}</span>
                        </div>
                        <span className={`role-badge role-${user.role.toLowerCase()}`}>
                            {formatRole(user.role)}
                        </span>
                    </div>
                ))}
            </div>
        );
    }



    return (
        <div className="admin-dashboard">
            {/* Welcome Section */}
            <div className="dashboard-welcome">
                <div className="welcome-content">
                    <h1>Welcome to Admin Dashboard</h1>
                    <p>Monitor your platform, manage users, and view key metrics</p>
                </div>
                <div className="welcome-actions">
                    <Link to="/admin/sessions?create=1" className="btn btn-primary">
                        <Calendar size={18} />
                        Schedule Session
                    </Link>
                    <Link to="/admin/users" className="btn btn-primary">
                        <UserPlus size={18} />
                        Add New User
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon users">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{isLoading ? '...' : stats.totalUsers}</span>
                        <span className="stat-label">Total Users</span>
                    </div>
                    <div className="stat-trend positive">
                        <TrendingUp size={14} />
                        <span>+12%</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon active">
                        <Activity size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{isLoading ? '...' : stats.activeUsers}</span>
                        <span className="stat-label">Active Users</span>
                    </div>
                    <div className="stat-trend positive">
                        <TrendingUp size={14} />
                        <span>+5%</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon pending">
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.pendingInvites}</span>
                        <span className="stat-label">Pending Invites</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon appointments">
                        <Calendar size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.todayAppointments}</span>
                        <span className="stat-label">Today's Sessions</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                {/* Recent Users */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h2>
                            <Users size={20} />
                            Recent Users
                        </h2>
                        <Link to="/admin/users" className="card-link">
                            View All <ChevronRight size={16} />
                        </Link>
                    </div>
                    <div className="card-body">
                        {recentUsersContent}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h2>
                            <BarChart2 size={20} />
                            Quick Actions
                        </h2>
                    </div>
                    <div className="card-body">
                        <div className="quick-actions">
                            <Link to="/admin/users" className="quick-action">
                                <div className="action-icon users">
                                    <Users size={20} />
                                </div>
                                <div className="action-content">
                                    <span className="action-title">Manage Users</span>
                                    <span className="action-desc">View, edit, and manage all users</span>
                                </div>
                                <ChevronRight size={18} />
                            </Link>
                            <Link to="/admin/sessions" className="quick-action">
                                <div className="action-icon appointments">
                                    <Calendar size={20} />
                                </div>
                                <div className="action-content">
                                    <span className="action-title">Sessions</span>
                                    <span className="action-desc">View and manage schedules</span>
                                </div>
                                <ChevronRight size={18} />
                            </Link>
                            <Link to="/reports" className="quick-action">
                                <div className="action-icon reports">
                                    <BarChart2 size={20} />
                                </div>
                                <div className="action-content">
                                    <span className="action-title">Reports</span>
                                    <span className="action-desc">Analytics and insights</span>
                                </div>
                                <ChevronRight size={18} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
