import {
    Brain,
    Camera,
    Clock,
    Heart,
    Laptop,
    Lock,
    Shield,
    Sparkles,
    Star,
    Sunrise,
    User,
    Users,
    Zap,
} from 'lucide-react';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './VirtualIOPView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

const SCHEDULE_SLOTS = [
    { label: 'Morning Block', time: '8:00 AM – 11:00 AM', icon: Sunrise, color: '#C59D5F', bg: '#FAF3E8' },
    { label: 'Evening Block', time: '6:00 PM – 9:00 PM', icon: Clock, color: '#467174', bg: '#E6F4F5' },
] as const;

const GROUP_TOPICS = [
    {
        title: 'Emotional Regulation',
        description: 'Develop skills to understand, manage, and express your emotions in healthy ways.',
        icon: Heart,
        color: '#C0415A',
        bg: '#FDF0F3',
    },
    {
        title: 'Trauma Recovery & Healing',
        description: 'Process past experiences in a safe, structured environment with peer support.',
        icon: Shield,
        color: '#3B6FB5',
        bg: '#EEF4FB',
    },
    {
        title: 'Anger Management',
        description: 'Learn evidence-based techniques to identify triggers and respond calmly.',
        icon: Zap,
        color: '#B45309',
        bg: '#FEF3C7',
    },
    {
        title: 'Self-Esteem & Confidence',
        description: 'Build a stronger sense of self-worth through reflection and peer connection.',
        icon: Star,
        color: '#7C3AED',
        bg: '#F5F3FF',
    },
    {
        title: 'Mindfulness & Meditation',
        description: 'Practice presence-based strategies to reduce stress and quiet the mind.',
        icon: Sparkles,
        color: '#467174',
        bg: '#E6F4F5',
    },
    {
        title: 'CBT & DBT Skill Building',
        description: 'Structured therapy frameworks that form the backbone of every group session.',
        icon: Brain,
        color: '#856644',
        bg: '#F5EDE3',
    },
] as const;

/* ── Component ────────────────────────────────────────────────────── */

interface VirtualIOPViewProps {
    onClose: () => void;
}

export default function VirtualIOPView({ onClose }: Readonly<VirtualIOPViewProps>) {
    return (
        <FullPagePanel
            icon={Users}
            iconColor="var(--primary-700)"
            iconBg="var(--primary-100)"
            title="Virtual IOP"
            subtitle="Intensive Outpatient Program"
            onClose={onClose}
        >
            {/* ── Hero ──────────────────────────────────── */}
            <div className="viov-hero">
                <div className="viov-hero-badge">
                    <Users size={13} />
                    Intensive Outpatient Program
                </div>
                <h2 className="viov-hero-headline">
                    Structured support that fits your life
                </h2>
                <p className="viov-hero-body">
                    Virtual IOP gives you the intensity of group therapy while keeping you connected
                    to your home, your family, and your daily routine. You attend sessions from
                    wherever you are — no commute required.
                </p>
                <div className="viov-hero-stats">
                    <div className="viov-stat">
                        <span className="viov-stat-value">3 hrs</span>
                        <span className="viov-stat-label">per session</span>
                    </div>
                    <div className="viov-stat-divider" />
                    <div className="viov-stat">
                        <span className="viov-stat-value">3 days</span>
                        <span className="viov-stat-label">per week</span>
                    </div>
                    <div className="viov-stat-divider" />
                    <div className="viov-stat">
                        <span className="viov-stat-value">+1 hr</span>
                        <span className="viov-stat-label">individual weekly</span>
                    </div>
                </div>
            </div>

            {/* ── Schedule ──────────────────────────────── */}
            <section className="viov-section">
                <div className="viov-section-label">When you'll meet</div>
                <h3 className="viov-section-title">Session Schedule</h3>
                <p className="viov-section-intro">
                    Sessions run in 3-hour blocks based on your assigned level of care. Choose the
                    block that works best for your schedule — mornings or evenings, Monday through
                    Friday.
                </p>
                <div className="viov-schedule-grid">
                    {SCHEDULE_SLOTS.map((slot) => {
                        const IconEl = slot.icon;
                        return (
                            <div key={slot.label} className="viov-schedule-card">
                                <div className="viov-schedule-icon" style={{ background: slot.bg, color: slot.color }}>
                                    <IconEl size={24} />
                                </div>
                                <span className="viov-schedule-label">{slot.label}</span>
                                <span className="viov-schedule-time">{slot.time}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Individual therapy callout */}
                <div className="viov-individual-card">
                    <div className="viov-individual-icon">
                        <User size={20} />
                    </div>
                    <div className="viov-individual-body">
                        <span className="viov-individual-title">Individual Therapy Session</span>
                        <span className="viov-individual-desc">
                            In addition to group sessions, you will have a <strong>1-hour individual session</strong>{' '}
                            each week with your assigned therapist — your dedicated space for focused, personal work.
                        </span>
                    </div>
                </div>
            </section>

            {/* ── Group topics ──────────────────────────── */}
            <section className="viov-section">
                <div className="viov-section-label">What you'll work on</div>
                <h3 className="viov-section-title">Group Session Topics</h3>
                <p className="viov-section-intro">
                    Every session integrates <strong>Cognitive Behavioral Therapy (CBT)</strong> and{' '}
                    <strong>Dialectical Behavior Therapy (DBT)</strong> — proven, evidence-based frameworks
                    designed for growth, resilience, and meaningful connection.
                </p>
                <div className="viov-topics-grid">
                    {GROUP_TOPICS.map((topic) => {
                        const IconEl = topic.icon;
                        return (
                            <div key={topic.title} className="viov-topic-card">
                                <div
                                    className="viov-topic-icon"
                                    style={{ background: topic.bg, color: topic.color }}
                                >
                                    <IconEl size={20} />
                                </div>
                                <div className="viov-topic-body">
                                    <h4 className="viov-topic-title">{topic.title}</h4>
                                    <p className="viov-topic-desc">{topic.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Tech + Confidentiality ────────────────── */}
            <section className="viov-section">
                <div className="viov-section-label">Before you join</div>
                <h3 className="viov-section-title">Important Reminders</h3>
                <div className="viov-reminders-grid">
                    <div className="viov-reminder-card viov-reminder-card--tech">
                        <div className="viov-reminder-icon">
                            <Laptop size={22} />
                        </div>
                        <h4 className="viov-reminder-title">Technology</h4>
                        <p className="viov-reminder-body">
                            You may join using a <strong>cell phone, computer, laptop, or tablet</strong>.
                        </p>
                        <div className="viov-reminder-highlight">
                            <Camera size={14} />
                            Please keep your camera <strong>on</strong> during group therapy — it fosters
                            connection, builds trust, and helps maintain a safe environment for all participants.
                        </div>
                    </div>

                    <div className="viov-reminder-card viov-reminder-card--conf">
                        <div className="viov-reminder-icon viov-reminder-icon--gold">
                            <Lock size={22} />
                        </div>
                        <h4 className="viov-reminder-title">Confidentiality</h4>
                        <p className="viov-reminder-body">
                            Group sessions are <strong>strictly confidential</strong>. What is shared in
                            the group stays in the group — this is the foundation of our community's trust.
                        </p>
                        <div className="viov-reminder-highlight viov-reminder-highlight--gold">
                            <Lock size={14} />
                            Join from a <strong>private and secure location</strong> every session.
                        </div>
                    </div>
                </div>
            </section>
        </FullPagePanel>
    );
}
