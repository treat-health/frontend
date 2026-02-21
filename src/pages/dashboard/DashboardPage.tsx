import { Calendar, MessageSquare, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Link } from 'react-router-dom';

/**
 * Dashboard Page Component
 */
import { useEffect, useState } from 'react';
import { schedulingService } from '../../services/scheduling.service';
import type { Appointment } from '../../services/scheduling.service';

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const data = await schedulingService.getMyAppointments(false);
            // Sort by earliest first
            const sorted = data.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            setAppointments(sorted.slice(0, 5)); // Show next 5
        } catch (error) {
            console.error('Failed to fetch appointments:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                    { label: 'Upcoming Sessions', value: appointments.length.toString(), icon: Calendar, color: 'var(--primary-500)' },
                    { label: 'Unread Messages', value: '5', icon: MessageSquare, color: 'var(--accent-500)' },
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
                    {isLoading ? (
                        <p>Loading sessions...</p>
                    ) : appointments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No upcoming sessions.</p>
                        </div>
                    ) : (
                        appointments.map((session) => (
                            <div key={session.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 'var(--spacing-md) 0',
                                borderBottom: '1px solid var(--gray-100)',
                            }}>
                                <div>
                                    <p style={{ fontWeight: 500 }}>{session.type.replace(/_/g, ' ')}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                                        with {session.therapist.firstName} {session.therapist.lastName}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--primary-600)' }}>
                                        {new Date(session.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                    {session.zoomJoinUrl && (
                                        <a href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" style={{ marginTop: 'var(--spacing-xs)', display: 'inline-block' }}>
                                            Join Zoom
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        <Link to="/appointments" className="btn btn-secondary w-full">
                            <Calendar size={18} />
                            My Appointments
                        </Link>
                        <Link to="/messages" className="btn btn-secondary w-full">
                            <MessageSquare size={18} />
                            Message Therapist
                        </Link>
                        <Link to="/settings" className="btn btn-secondary w-full">
                            <Settings size={18} />
                            Settings
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
