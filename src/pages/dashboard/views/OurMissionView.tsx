import { Compass, Heart, Shield, Sparkles } from 'lucide-react';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './OurMissionView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

const PILLARS = [
    {
        icon: Heart,
        color: '#C0556E',
        bg: '#FDF0F3',
        title: 'Compassion at the Center',
        description:
            'We design every touchpoint to feel human, respectful, and emotionally safe — so care never feels cold or transactional.',
    },
    {
        icon: Shield,
        color: '#467174',
        bg: '#E6F4F5',
        title: 'Trustworthy Therapeutic Support',
        description:
            'We create a secure space where clients can connect, communicate, and return to care with confidence and peace of mind.',
    },
    {
        icon: Compass,
        color: '#856644',
        bg: '#F5EDE3',
        title: 'Progress With Clarity',
        description:
            'We help people move forward one grounded step at a time, making support easier to reach, understand, and continue.',
    },
] as const;

const JOURNEY_MOMENTS = [
    'A calm first impression that reduces overwhelm',
    'Secure communication that strengthens trust',
    'A guided experience that helps clients stay engaged',
] as const;

const HIGHLIGHTS = [
    'Compassion-led experience',
    'Secure connection with care teams',
    'Guidance that supports steady progress',
] as const;

/* ── Component ────────────────────────────────────────────────────── */

interface OurMissionViewProps {
    onClose: () => void;
}

export default function OurMissionView({ onClose }: Readonly<OurMissionViewProps>) {
    return (
        <FullPagePanel
            icon={Sparkles}
            iconColor="var(--primary-700)"
            iconBg="var(--primary-100)"
            title="Our Mission"
            subtitle="The heart behind Treat Health"
            onClose={onClose}
        >
            {/* ── Hero quote ─────────────────────────────── */}
            <div className="omv-hero">
                <div className="omv-hero-badge">
                    <Sparkles size={14} />
                    Our Mission
                </div>
                <h2 className="omv-hero-headline">
                    Care that feels safe, human,<br />and possible to continue.
                </h2>
                <blockquote className="omv-hero-quote">
                    At Treat Health, our mission is to make therapy support feel more
                    compassionate, more connected, and easier to stay engaged with — so every
                    client feels guided, respected, and supported throughout their healing journey.
                </blockquote>
                <div className="omv-highlights">
                    {HIGHLIGHTS.map((h) => (
                        <span key={h} className="omv-highlight-pill">{h}</span>
                    ))}
                </div>
            </div>

            {/* ── Belief statement ───────────────────────── */}
            <div className="omv-belief">
                <div className="omv-belief-kicker">A calmer path into care</div>
                <p className="omv-belief-body">
                    We believe healing grows best in spaces that feel welcoming, thoughtful, and
                    built around real people. Treat Health brings together therapy access,
                    supportive communication, and a steady client experience — so people can focus
                    less on friction and more on healing, trust, and progress.
                </p>
            </div>

            {/* ── Pillars grid ───────────────────────────── */}
            <section className="omv-section">
                <div className="omv-section-label">What guides the experience</div>
                <h3 className="omv-section-title">The principles behind Treat Health</h3>
                <div className="omv-pillars-grid">
                    {PILLARS.map((pillar) => {
                        const Icon = pillar.icon;
                        return (
                            <div key={pillar.title} className="omv-pillar-card">
                                <div
                                    className="omv-pillar-icon"
                                    style={{ background: pillar.bg, color: pillar.color }}
                                >
                                    <Icon size={22} />
                                </div>
                                <h4 className="omv-pillar-title">{pillar.title}</h4>
                                <p className="omv-pillar-desc">{pillar.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Promise + Journey ──────────────────────── */}
            <section className="omv-section">
                <div className="omv-section-label">Our promise</div>
                <h3 className="omv-section-title">What we're building for you</h3>
                <div className="omv-promise-grid">
                    <div className="omv-promise-card">
                        <p className="omv-promise-text">
                            We are building a care experience that reduces overwhelm, strengthens
                            trust, and gives clients a more grounded way to stay connected with
                            therapy and support.
                        </p>
                    </div>
                    <div className="omv-journey-card">
                        <p className="omv-journey-label">What that should feel like</p>
                        <ol className="omv-journey-list">
                            {JOURNEY_MOMENTS.map((item, i) => (
                                <li key={item} className="omv-journey-item">
                                    <span className="omv-journey-num">0{i + 1}</span>
                                    <span className="omv-journey-text">{item}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* ── Closing card ───────────────────────────── */}
            <div className="omv-closing-card">
                <Sparkles size={28} className="omv-closing-icon" />
                <h3 className="omv-closing-heading">Your journey starts here.</h3>
                <p className="omv-closing-body">
                    You are not alone in this. Every step you take is supported by a team that
                    believes in your healing.
                </p>
                <button type="button" className="btn btn-primary omv-closing-btn" onClick={onClose}>
                    Continue Your Journey
                </button>
            </div>
        </FullPagePanel>
    );
}
