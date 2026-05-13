import { useState } from 'react';
import {
    Camera,
    ChevronDown,
    Headphones,
    LifeBuoy,
    Mic,
    Monitor,
    Smartphone,
    Sparkles,
    Video,
    Wifi,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './JoinGuideView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

const EQUIPMENT = [
    {
        icon: Camera,
        label: 'Camera',
        detail: 'Built-in or external webcam',
        color: '#467174',
        bg: '#E6F4F5',
    },
    {
        icon: Mic,
        label: 'Microphone',
        detail: 'Built-in or headset mic',
        color: '#856644',
        bg: '#F5EDE3',
    },
    {
        icon: Wifi,
        label: 'Stable Internet',
        detail: 'Wi-Fi or mobile data',
        color: '#C59D5F',
        bg: '#FAF3E8',
    },
    {
        icon: Smartphone,
        label: 'Any Device',
        detail: 'Phone, tablet, laptop, or desktop',
        color: '#6366F1',
        bg: '#EEF2FF',
    },
] as const;

const STEPS = [
    {
        title: 'Open My Appointments',
        description:
            'Go to the My Appointments page from the sidebar. You can also tap it from the dashboard. Your upcoming sessions will be listed there in order.',
        tip: null,
    },
    {
        title: 'Look for the "Join Session" button',
        description:
            'The Join Session button becomes active shortly before your scheduled start time. If it appears greyed out, the session window has not opened yet — return a few minutes before your appointment and it will enable automatically.',
        tip: 'Bookmark the My Appointments page so you can return to it instantly.',
    },
    {
        title: 'Allow camera & microphone access',
        description:
            'When you first join, your browser will ask for camera and microphone permission. Click Allow so your therapist can see and hear you. If you accidentally clicked Block, go to your browser settings to reset permissions.',
        tip: null,
    },
    {
        title: 'Rejoin if you get disconnected',
        description:
            'If your internet drops during a session, return to the My Appointments page and use the same Join Session button. The session room stays open while your appointment is active, so you can reconnect without contacting anyone.',
        tip: null,
    },
] as const;

const TROUBLESHOOTING = [
    {
        question: 'The Join Session button is greyed out — what do I do?',
        answer:
            "The button only becomes active when your session window opens, which is shortly before the scheduled start time. Check that the appointment is still in SCHEDULED status and return to the page a few minutes early. If it's past the start time and still inactive, refresh the page or contact your Client Care Coordinator.",
    },
    {
        question: "My camera or microphone isn't working inside the session.",
        answer:
            "First check that you clicked Allow when the browser asked for permissions. If you previously clicked Block, go to your browser's address bar, click the lock/info icon, and reset Camera and Microphone to Allow. Then reload the page and rejoin the session.",
    },
    {
        question: 'I got disconnected — will I lose my session?',
        answer:
            'No. The session room stays open for the duration of your scheduled appointment. Simply return to My Appointments and click Join Session again to reconnect. Let your therapist know you dropped so they can pick up where you left off.',
    },
    {
        question: 'The video quality is poor or the audio keeps cutting out.',
        answer:
            'Move closer to your Wi-Fi router or switch to a stronger connection. Close any tabs or apps that are using your internet in the background. Using wired headphones can also significantly improve audio clarity. If problems continue, try a different device.',
    },
] as const;

/* ── Troubleshooting accordion ────────────────────────────────────── */

function TroubleshootingAccordion() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));

    return (
        <ul className="jgv-accordion-list">
            {TROUBLESHOOTING.map((item, i) => {
                const isOpen = openIndex === i;
                return (
                    <li key={item.question} className={`jgv-accordion-item${isOpen ? ' jgv-accordion-item--open' : ''}`}>
                        <button
                            type="button"
                            className="jgv-accordion-trigger"
                            onClick={() => toggle(i)}
                            aria-expanded={isOpen}
                        >
                            <span className="jgv-accordion-q">{item.question}</span>
                            <ChevronDown size={17} className="jgv-accordion-chevron" aria-hidden="true" />
                        </button>
                        <div className="jgv-accordion-body" aria-hidden={!isOpen}>
                            <p className="jgv-accordion-answer">{item.answer}</p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

/* ── Main view ────────────────────────────────────────────────────── */

interface JoinGuideViewProps {
    onClose: () => void;
}

export default function JoinGuideView({ onClose }: Readonly<JoinGuideViewProps>) {
    const navigate = useNavigate();

    return (
        <FullPagePanel
            icon={Video}
            iconColor="var(--secondary-700)"
            iconBg="var(--secondary-100)"
            title="How to Join the Appointment"
            subtitle="Technical setup & session tips"
            onClose={onClose}
        >
            {/* ── Intro ─────────────────────────────────── */}
            <div className="jgv-intro">
                <div className="jgv-intro-badge">
                    <Video size={13} />
                    Session Guide
                </div>
                <h2 className="jgv-intro-headline">
                    Joining your virtual session is simple
                </h2>
                <p className="jgv-intro-body">
                    Everything you need is already inside the portal. Follow these steps once and
                    you'll be ready for every appointment going forward.
                </p>
            </div>

            {/* ── Equipment checklist ───────────────────── */}
            <section className="jgv-section">
                <div className="jgv-section-label">What you'll need</div>
                <h3 className="jgv-section-title">Equipment Checklist</h3>
                <div className="jgv-equipment-grid">
                    {EQUIPMENT.map((item) => {
                        const IconEl = item.icon;
                        return (
                            <div key={item.label} className="jgv-equipment-card">
                                <div
                                    className="jgv-equipment-icon"
                                    style={{ background: item.bg, color: item.color }}
                                >
                                    <IconEl size={22} />
                                </div>
                                <div className="jgv-equipment-body">
                                    <span className="jgv-equipment-label">{item.label}</span>
                                    <span className="jgv-equipment-detail">{item.detail}</span>
                                </div>
                                <div className="jgv-equipment-check" aria-label="Required" />
                            </div>
                        );
                    })}
                </div>
                <p className="jgv-equipment-note">
                    <Headphones size={14} />
                    Using headphones is recommended for better audio clarity and added privacy.
                </p>
            </section>

            {/* ── Step-by-step guide ────────────────────── */}
            <section className="jgv-section">
                <div className="jgv-section-label">How to do it</div>
                <h3 className="jgv-section-title">Step-by-Step Guide</h3>
                <ol className="jgv-steps-list">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="jgv-step-card">
                            <div className="jgv-step-num">{i + 1}</div>
                            <div className="jgv-step-body">
                                <h4 className="jgv-step-title">{step.title}</h4>
                                <p className="jgv-step-desc">{step.description}</p>
                                {step.tip && (
                                    <div className="jgv-step-tip">
                                        <Sparkles size={12} />
                                        {step.tip}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ── Troubleshooting accordion ─────────────── */}
            <section className="jgv-section">
                <div className="jgv-section-label">Having trouble?</div>
                <h3 className="jgv-section-title">Common Issues &amp; Fixes</h3>
                <TroubleshootingAccordion />
            </section>

            {/* ── CTA footer ────────────────────────────── */}
            <div className="jgv-footer">
                <div className="jgv-footer-copy">
                    <LifeBuoy size={18} className="jgv-footer-icon" />
                    <div>
                        <p className="jgv-footer-heading">Still need help?</p>
                        <p className="jgv-footer-sub">
                            Contact your Client Care Coordinator or visit the Support page to report an issue.
                        </p>
                    </div>
                </div>
                <div className="jgv-footer-actions">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => { navigate('/support'); onClose(); }}
                    >
                        Go to Support
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => { navigate('/appointments'); onClose(); }}
                    >
                        <Monitor size={16} />
                        Open My Appointments
                    </button>
                </div>
            </div>
        </FullPagePanel>
    );
}
