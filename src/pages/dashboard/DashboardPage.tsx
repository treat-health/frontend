import { Calendar, MessageSquare, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { Link } from 'react-router-dom';

/**
 * Dashboard Page Component
 */
import { useEffect, useState } from 'react';
import { schedulingService } from '../../services/scheduling.service';
import type { Appointment } from '../../services/scheduling.service';
import { quoteService } from '../../services/quote.service';
import type { HealthQuote } from '../../services/quote.service';
import './DashboardPage.css';

const getSessionDisplayTitle = (session: Pick<Appointment, 'title' | 'type'>) =>
    session.title?.trim() || session.type.replaceAll('_', ' ');

const isUpcomingAppointment = (appointment: Appointment) => {
    const terminalStates = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
    return !terminalStates.includes(appointment.status);
};

const DEFAULT_QUOTE: HealthQuote = {
    text: 'Your health is an investment, not an expense.',
    author: 'Unknown',
};

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { totalUnread, fetchUnreadMessagesCount } = useChatStore();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quote, setQuote] = useState<HealthQuote>(DEFAULT_QUOTE);
    const [isQuoteLoading, setIsQuoteLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
        fetchTodayQuote();
        fetchUnreadMessagesCount();
    }, [fetchUnreadMessagesCount]);

    const fetchAppointments = async () => {
        try {
            setIsLoading(true);
            const data = await schedulingService.getMyAppointments(false);
            // Sort by earliest first
            const sorted = data
                .filter(isUpcomingAppointment)
                .sort((a: Appointment, b: Appointment) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            setAppointments(sorted.slice(0, 5)); // Show next 5
        } catch (error) {
            console.error('Failed to fetch appointments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    let upcomingSessionsContent;

    if (isLoading) {
        upcomingSessionsContent = <p>Loading sessions...</p>;
    } else if (appointments.length === 0) {
        upcomingSessionsContent = (
            <div className="text-center py-8 text-gray-500">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming sessions.</p>
            </div>
        );
    } else {
        upcomingSessionsContent = appointments.map((session) => (
            <div key={session.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--spacing-md) 0',
                borderBottom: '1px solid var(--gray-100)',
            }}>
                <div>
                    <p className="dashboard-session-title">{getSessionDisplayTitle(session)}</p>
                    <p className="dashboard-session-subtitle">
                        {session.type.replaceAll('_', ' ')}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                        with {session.therapist.firstName} {session.therapist.lastName}
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p className="dashboard-session-time">
                        {new Date(session.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {(session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS') && (
                        <Link to={`/sessions/${session.id}/room`} className="btn btn-sm btn-primary" style={{ marginTop: 'var(--spacing-xs)', display: 'inline-block' }}>
                            Join Session
                        </Link>
                    )}
                </div>
            </div>
        ));
    }

    const fetchTodayQuote = async () => {
        try {
            const todayQuote = await quoteService.getTodayQuote();
            setQuote(todayQuote);
        } catch (error) {
            console.error('Failed to fetch quote of the day:', error);
            setQuote(DEFAULT_QUOTE);
        } finally {
            setIsQuoteLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div className="card dashboard-hero-card">
                <div className="dashboard-hero-copy">
                    <h2 className="dashboard-hero-title">
                        Welcome back, {user?.firstName}! 👋
                    </h2>
                    <p className="dashboard-hero-subtitle">
                        Your wellness journey continues. Here's an overview of your progress.
                    </p>
                </div>
                <div className="dashboard-hero-quote-shell">
                    {isQuoteLoading ? (
                        <div className="dashboard-hero-quote-loading">
                            <div className="dashboard-hero-quote-loading-line" />
                            <div className="dashboard-hero-quote-loading-line short" />
                        </div>
                    ) : (
                        <div className="dashboard-hero-quote">
                            <p className="dashboard-hero-quote-text">
                                {quote.text}
                            </p>
                            <p className="dashboard-hero-quote-author">
                                — {quote.author}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-xl)',
            }}>
                {[
                    { label: 'Upcoming Sessions', value: appointments.length.toString(), icon: Calendar, color: 'var(--primary-500)' },
                    { label: 'Unread Messages', value: totalUnread.toString(), icon: MessageSquare, color: 'var(--accent-500)', to: '/messages' },
                ].map((stat) => {
                    const cardContent = (
                        <div className="card" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-lg)',
                        cursor: stat.to ? 'pointer' : 'default',
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
                    );

                    if (stat.to) {
                        return (
                            <Link
                                key={stat.label}
                                to={stat.to}
                                style={{ color: 'inherit', textDecoration: 'none' }}
                                aria-label={`Open ${stat.label.toLowerCase()}`}
                            >
                                {cardContent}
                            </Link>
                        );
                    }

                    return <div key={stat.label}>{cardContent}</div>;
                })}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: 'var(--spacing-xl)',
            }}>
                <div className="card">
                    <div className="dashboard-section-header">
                        <h3 style={{ marginBottom: 0 }}>Upcoming Sessions</h3>
                        <button type="button" className="refresh-btn" onClick={fetchAppointments}>
                            Refresh
                        </button>
                    </div>
                    {upcomingSessionsContent}
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Quick Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        <Link to="/appointments" className="btn btn-secondary w-full">
                            <Calendar size={18} />
                            My Appointments
                        </Link>
                        <Link to="/messages" className="btn btn-secondary w-full">
                            <MessageSquare size={18} />
                            Message
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
