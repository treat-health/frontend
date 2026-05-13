import { Calendar, ChevronRight, ExternalLink, HelpCircle, LifeBuoy, Sparkles } from 'lucide-react';
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
import { FAQS } from './views/FaqView';
import './DashboardPage.css';

const HERO_MISSION_POINTS = [
    'At Treat Mental Health, our core mission is to provide empathetic and exceptional care to anyone entering our digital realm. We believe all individuals have the capacity for growth, and our devoted team of mental health experts is dedicated to guiding you on your path to emotional wellness and healing.',
    'Welcome to Treat Mental Health’s virtual treatment program. We are committed to providing compassionate, individualized care that integrates seamlessly into your daily life. Our program is designed to meet you where you are, offering a safe, confidential, and accessible environment to focus on your well-being.',
    'With the support of our skilled team of professionals, you will receive evidence-based care tailored to your unique needs—whether you are managing stress, processing trauma, or seeking guidance through other mental health challenges. Our goal is to help you make meaningful progress and foster lasting growth, one step at a time.',
] as const;

const getSessionDisplayTitle = (session: Pick<Appointment, 'title' | 'type'>) =>
    session.title?.trim() || session.type.replaceAll('_', ' ');

const isUpcomingAppointment = (appointment: Appointment) => {
    const terminalStates = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
    return !terminalStates.includes(appointment.status);
};

const DEFAULT_QUOTE: HealthQuote = {
    text: 'Healing can begin with one honest breath and one gentle thought.',
};

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { fetchUnreadMessagesCount } = useChatStore();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quote, setQuote] = useState<HealthQuote>(DEFAULT_QUOTE);
    const [isQuoteLoading, setIsQuoteLoading] = useState(true);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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
        upcomingSessionsContent = (
            <div className="dashboard-sessions-state">
                <p>Loading sessions...</p>
            </div>
        );
    } else if (appointments.length === 0) {
        upcomingSessionsContent = (
            <div className="dashboard-sessions-state">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming sessions.</p>
            </div>
        );
    } else {
        upcomingSessionsContent = appointments.map((session) => (
            <div key={session.id} className="dashboard-session-item">
                <div className="dashboard-session-main">
                    <p className="dashboard-session-title">{getSessionDisplayTitle(session)}</p>
                    <p className="dashboard-session-subtitle">
                        {session.type.replaceAll('_', ' ')}
                    </p>
                    <p className="dashboard-session-person">
                        with {session.therapist.firstName} {session.therapist.lastName}
                    </p>
                </div>
                <div className="dashboard-session-meta">
                    <p className="dashboard-session-time">
                        {new Date(session.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {(session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS') && (
                        <Link to={`/sessions/${session.id}/room`} className="btn btn-sm btn-primary dashboard-session-join">
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
                <img
                    src="https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=1200&q=80&auto=format&fit=crop"
                    alt=""
                    className="dashboard-hero-bg"
                    aria-hidden="true"
                />
                <div className="dashboard-hero-copy">
                    <div className="dashboard-hero-intro">
                        <h2 className="dashboard-hero-title">
                            Welcome back, {user?.firstName}! 👋
                        </h2>
                        <p className="dashboard-hero-subtitle">
                            Your wellness journey continues. Here&apos;s what&apos;s ahead today and the support guiding you forward.
                        </p>
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
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="dashboard-hero-mission">
                        <div className="dashboard-hero-mission-label">
                            <Sparkles size={16} />
                            <span>Our Mission</span>
                        </div>
                        <div className="dashboard-hero-mission-body">
                            {HERO_MISSION_POINTS.map((point) => (
                                <p key={point} className="dashboard-hero-mission-text">
                                    {point}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <section className="dashboard-main-stack">
                <div className="card dashboard-upcoming-card">
                    <div className="dashboard-section-header">
                        <div className="dashboard-section-heading-group">
                            <p className="dashboard-section-kicker">Next in care</p>
                            <h3 className="dashboard-section-title">Upcoming Sessions</h3>
                            <p className="dashboard-section-subcopy">
                                Track your next appointments, see who you&apos;re meeting with, and jump in as soon as the room opens.
                            </p>
                        </div>
                        <div className="dashboard-section-actions">
                            <button type="button" className="refresh-btn" onClick={fetchAppointments}>
                                Refresh
                            </button>
                            <Link to="/appointments" className="dashboard-section-link">
                                View all appointments
                            </Link>
                        </div>
                    </div>
                    <div className="dashboard-sessions-list">
                        {upcomingSessionsContent}
                    </div>
                </div>
            </section>

            <section className="dashboard-faq-section" aria-labelledby="dashboard-faq-title">
                <div className="dashboard-faq-layout">
                    <div className="dashboard-faq-aside">
                        <div className="dashboard-faq-aside-badge">
                            <HelpCircle size={14} />
                            FAQs
                        </div>
                        <h3 id="dashboard-faq-title" className="dashboard-faq-aside-title">
                            Most frequent answers and questions
                        </h3>
                        <p className="dashboard-faq-aside-copy">
                            Browse quick answers about Virtual IOP, residential treatment, and what to expect from your care journey.
                        </p>
                        <div className="dashboard-faq-aside-actions">
                            <Link to="/support" className="btn btn-primary dashboard-faq-support-btn">
                                <LifeBuoy size={16} />
                                Get help from support
                            </Link>
                            <a
                                href="https://treatmh.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dashboard-faq-secondary-link"
                            >
                                Browse more resources
                            </a>
                        </div>
                    </div>

                    <ul className="dashboard-faq-accordion">
                        {FAQS.map((faq, index) => {
                            const isOpen = openFaqIndex === index;

                            return (
                                <li
                                    key={faq.question}
                                    className={`dashboard-faq-item${isOpen ? ' dashboard-faq-item--open' : ''}`}
                                >
                                    <button
                                        type="button"
                                        className="dashboard-faq-trigger"
                                        onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                                        aria-expanded={isOpen}
                                    >
                                        <span className="dashboard-faq-question">{faq.question}</span>
                                        <ChevronRight size={18} className="dashboard-faq-chevron" aria-hidden="true" />
                                    </button>

                                    <div className="dashboard-faq-body" aria-hidden={!isOpen}>
                                        <p className="dashboard-faq-answer">{faq.answer}</p>
                                        <a
                                            href={faq.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dashboard-faq-link"
                                        >
                                            <ExternalLink size={14} />
                                            {faq.linkLabel}
                                        </a>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </section>
        </div>
    );
}
