import { Calendar, CheckCircle, Mail, Sparkles, User, Video } from 'lucide-react';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './FirstDaysView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

const STEPS = [
    {
        number: '01',
        title: 'Pre-Assessment Call',
        subtitle: 'Admissions Team',
        icon: User,
        iconColor: '#C59D5F',
        iconBg: '#FAF3E8',
        tag: 'Phone · Admissions',
        description:
            'An admissions team member will contact you to complete a brief pre-assessment. This call allows us to gather initial information and address any questions you may have.',
    },
    {
        number: '02',
        title: 'Client Onboarding & Assessment Prep',
        subtitle: 'Client Care Coordinator',
        icon: Mail,
        iconColor: '#467174',
        iconBg: '#E6F4F5',
        tag: 'Email · Portal',
        description:
            'A Client Care Coordinator will guide you through receiving your Patient Portal invitation via email, uploading your profile photo, securely completing your admission forms, and scheduling your BPS assessment.',
    },
    {
        number: '03',
        title: 'Biopsychosocial (BPS) Assessment',
        subtitle: 'Therapy Team',
        icon: Video,
        iconColor: '#856644',
        iconBg: '#F5EDE3',
        tag: 'Google Meet · Therapy',
        description:
            'You will attend your BPS assessment with one of our therapists. This assessment explores your history, needs, and treatment goals in depth. An invitation will be sent via email no later than 30 minutes before your appointment.',
    },
    {
        number: '04',
        title: 'Initial Psychiatric Evaluation (IPE)',
        subtitle: 'Psychiatric Provider',
        icon: Video,
        iconColor: '#6366F1',
        iconBg: '#EEF2FF',
        tag: 'Telehealth · Psychiatry',
        description:
            'Within 48 hours of your BPS Assessment, you will meet with a psychiatric provider for your Initial Psychiatric Evaluation. This step is essential to developing a personalized treatment plan. A Telehealth link will be emailed to you no less than 30 minutes before your appointment.',
    },
    {
        number: '05',
        title: 'Client Care Coordinator Follow-Up',
        subtitle: 'Client Care Team',
        icon: CheckCircle,
        iconColor: '#16A34A',
        iconBg: '#DCFCE7',
        tag: 'Email · Resource Directory',
        description:
            'Once your initial assessments are complete, your Client Care Coordinator will email a Resource Directory with all necessary information, resources, and guidance to support your success in the program.',
    },
] as const;

const TIPS = [
    'Check your email inbox (and spam folder) regularly — most invitations and links will arrive there.',
    'Join calls and telehealth sessions from a private, quiet location with a stable internet connection.',
    'Your camera and microphone will need browser permissions the first time you join.',
    'If you ever feel uncertain, reach out to your Client Care Coordinator — they are your primary guide.',
] as const;

/* ── Component ────────────────────────────────────────────────────── */

interface FirstDaysViewProps {
    onClose: () => void;
}

export default function FirstDaysView({ onClose }: Readonly<FirstDaysViewProps>) {
    return (
        <FullPagePanel
            icon={Calendar}
            iconColor="var(--primary-700)"
            iconBg="var(--primary-100)"
            title="First Days Overview"
            subtitle="What to expect when starting care"
            onClose={onClose}
        >
            {/* ── Intro banner ────────────────────────── */}
            <div className="fdv-intro">
                <div className="fdv-intro-badge">
                    <Calendar size={13} />
                    Getting Started
                </div>
                <h2 className="fdv-intro-headline">
                    What to Expect Your First Few Days
                </h2>
                <p className="fdv-intro-body">
                    Our team will guide you through each step to ensure a smooth transition
                    into the program. Here's what happens from day one — so you always know
                    exactly where you are and what comes next.
                </p>
            </div>

            {/* ── Timeline ────────────────────────────── */}
            <ol className="fdv-timeline" aria-label="Onboarding steps">
                {STEPS.map((step, index) => {
                    const IconEl = step.icon;
                    const isLast = index === STEPS.length - 1;
                    return (
                        <li key={step.number} className="fdv-step">
                            {/* Left column: number + connector */}
                            <div className="fdv-step-aside">
                                <div
                                    className="fdv-step-icon"
                                    style={{ background: step.iconBg, color: step.iconColor }}
                                >
                                    <IconEl size={20} />
                                </div>
                                {!isLast && <div className="fdv-connector" aria-hidden="true" />}
                            </div>

                            {/* Right column: content card */}
                            <div className="fdv-step-card">
                                <div className="fdv-step-card-top">
                                    <div className="fdv-step-meta">
                                        <span className="fdv-step-num-badge">{step.number}</span>
                                        <span className="fdv-step-tag">{step.tag}</span>
                                    </div>
                                    <h3 className="fdv-step-title">{step.title}</h3>
                                    <p className="fdv-step-subtitle">{step.subtitle}</p>
                                </div>
                                <p className="fdv-step-desc">{step.description}</p>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {/* ── Tips ────────────────────────────────── */}
            <section className="fdv-tips">
                <div className="fdv-tips-heading">
                    <Sparkles size={15} />
                    Helpful tips for getting started
                </div>
                <ul className="fdv-tips-list">
                    {TIPS.map((tip) => (
                        <li key={tip} className="fdv-tip-item">
                            <CheckCircle size={15} className="fdv-tip-check" />
                            <span>{tip}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* ── Footer note ─────────────────────────── */}
            <div className="fdv-footer-note">
                <p>
                    If you need help at any point, contact your <strong>Client Care Coordinator</strong> or{' '}
                    <strong>Admissions Representative</strong> — we're here for you every step of the way.
                </p>
                <button type="button" className="btn btn-primary" onClick={onClose}>
                    Back to Dashboard
                </button>
            </div>
        </FullPagePanel>
    );
}
