import { Calendar, MessageSquare, FileText, Users } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Link } from 'react-router-dom';

/**
 * Dashboard Page Component
 */
export default function DashboardPage() {
    const { user } = useAuthStore();

    return (
        <div className="page-content">
            {/* Welcome Card */}
            <div className="card" style={{
                background: 'var(--gradient-bg)',
                color: 'white',
                marginBottom: 'var(--spacing-xl)',
            }}>
                <h2 style={{ color: 'white', marginBottom: 'var(--spacing-sm)' }}>
                    Welcome back, {user?.firstName}! 👋
                </h2>
                <p style={{ opacity: 0.9 }}>
                    Your wellness journey continues. Here's an overview of your progress.
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-xl)',
            }}>
                {[
                    { label: 'Upcoming Sessions', value: '3', icon: Calendar, color: 'var(--primary-500)' },
                    { label: 'Unread Messages', value: '5', icon: MessageSquare, color: 'var(--accent-500)' },
                    { label: 'Resources Viewed', value: '12', icon: FileText, color: 'var(--success-500)' },
                    { label: 'Days Active', value: '28', icon: Users, color: 'var(--warning-500)' },
                ].map((stat) => (
                    <div key={stat.label} className="card" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-lg)',
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: 'var(--radius-lg)',
                            background: `${stat.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: stat.color,
                        }}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{stat.label}</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: 'var(--spacing-xl)',
            }}>
                {/* Upcoming Sessions */}
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Upcoming Sessions</h3>
                    {[
                        { title: 'Individual Therapy', time: 'Tomorrow, 10:00 AM', therapist: 'Dr. Sarah Johnson' },
                        { title: 'Group Session: Anxiety', time: 'Wed, 2:00 PM', therapist: 'Dr. Michael Chen' },
                        { title: 'Check-in Call', time: 'Fri, 11:30 AM', therapist: 'Care Coordinator' },
                    ].map((session, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 'var(--spacing-md) 0',
                            borderBottom: i < 2 ? '1px solid var(--gray-100)' : 'none',
                        }}>
                            <div>
                                <p style={{ fontWeight: 500 }}>{session.title}</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                                    {session.therapist}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--primary-600)' }}>
                                    {session.time}
                                </p>
                                <button className="btn btn-sm btn-primary" style={{ marginTop: 'var(--spacing-xs)' }}>
                                    Join
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        <button className="btn btn-secondary w-full">
                            <Calendar size={18} />
                            Schedule Appointment
                        </button>
                        <Link to="/messages" className="btn btn-secondary w-full">
                            <MessageSquare size={18} />
                            Message Therapist
                        </Link>
                        <button className="btn btn-secondary w-full">
                            <FileText size={18} />
                            View Resources
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
