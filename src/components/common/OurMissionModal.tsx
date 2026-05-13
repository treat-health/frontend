import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Compass, Heart, Shield, Sparkles, X } from 'lucide-react';
import './OurMissionModal.css';

export interface OurMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const missionPillars = [
    {
        icon: Heart,
        title: 'Compassion at the Center',
        description: 'We design every touchpoint to feel human, respectful, and emotionally safe so care never feels cold or transactional.',
    },
    {
        icon: Shield,
        title: 'Trustworthy Therapeutic Support',
        description: 'We create a secure space where clients can connect, communicate, and return to care with confidence and peace of mind.',
    },
    {
        icon: Compass,
        title: 'Progress With Clarity',
        description: 'We help people move forward one grounded step at a time, making support easier to reach, understand, and continue.',
    },
] as const;

const careJourneyMoments = [
    'A calm first impression that reduces overwhelm',
    'Secure communication that strengthens trust',
    'A guided experience that helps clients stay engaged',
] as const;

export default function OurMissionModal({ isOpen, onClose }: Readonly<OurMissionModalProps>) {
    const slidesRef = useRef<HTMLDivElement>(null);
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        const container = slidesRef.current;
        if (!container) return;

        const sections = container.querySelectorAll<HTMLElement>('.mission-slide');
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Array.from(sections).indexOf(entry.target as HTMLElement);
                        if (index !== -1) setActiveSlide(index);
                    }
                });
            },
            { root: container, threshold: 0.5 }
        );

        sections.forEach((s) => observer.observe(s));
        return () => observer.disconnect();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <dialog
            open
            className="modal-overlay mission-dialog"
            onCancel={onClose}
            aria-label="Our Mission"
        >
            <div className="mission-modal">
                <div className="mission-modal-shell">
                    <div className="modal-header mission-modal-header">
                        <div className="mission-modal-header-copy">
                            <span className="mission-badge">
                                <Sparkles size={14} />
                                Our Mission
                            </span>
                            <h3>Care that feels safe, human, and possible to continue.</h3>
                            <p>
                                At Treat Health, our mission is to make therapy support feel more compassionate,
                                more connected, and easier to stay engaged with—so every client feels guided,
                                respected, and supported throughout their healing journey.
                            </p>
                        </div>
                        <div className="mission-header-actions">
                            <div className="mission-scroll-hint">
                                <ArrowDown size={14} />
                                Scroll through the story
                            </div>
                            <button
                                type="button"
                                className="btn btn-icon btn-ghost mission-close-btn"
                                onClick={onClose}
                                aria-label="Close Our Mission"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="modal-body mission-modal-body">
                        <div className="mission-slide-rail" aria-hidden="true">
                            <span className={activeSlide === 0 ? 'active' : ''} />
                            <span className={activeSlide === 1 ? 'active' : ''} />
                            <span className={activeSlide === 2 ? 'active' : ''} />
                        </div>

                        <div className="mission-slides" ref={slidesRef}>
                            <section className="mission-slide mission-slide-hero" id="mission-slide-1">
                                <div className="mission-hero-panel">
                                    <div className="mission-hero-copy">
                                        <div className="mission-hero-kicker">A calmer path into care</div>
                                        <h4>
                                            We believe healing grows best in spaces that feel welcoming,
                                            thoughtful, and built around real people.
                                        </h4>
                                        <p>
                                            Treat Health brings together therapy access, supportive communication,
                                            and a steady client experience so people can focus less on friction
                                            and more on healing, trust, and progress.
                                        </p>

                                        <div className="mission-hero-highlights">
                                            <span>Compassion-led experience</span>
                                            <span>Secure connection with care teams</span>
                                            <span>Guidance that supports steady progress</span>
                                        </div>
                                    </div>

                                    <div className="mission-visual" aria-hidden="true">
                                        <div className="mission-orb mission-orb-one" />
                                        <div className="mission-orb mission-orb-two" />
                                        <div className="mission-visual-card main">
                                            <div className="mission-visual-card-top">
                                                <span className="mission-visual-dot" />
                                                <span className="mission-visual-dot" />
                                                <span className="mission-visual-dot" />
                                            </div>
                                            <div className="mission-breath-circle">
                                                <div className="mission-breath-ring outer" />
                                                <div className="mission-breath-ring middle" />
                                                <div className="mission-breath-ring inner" />
                                            </div>
                                            <div className="mission-visual-caption">Support that meets you gently</div>
                                        </div>
                                        <div className="mission-visual-card floating quote">
                                            <Heart size={16} />
                                            <span>You are not alone in this journey.</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="mission-slide mission-slide-pillars" id="mission-slide-2">
                                <div className="mission-section-heading">
                                    <span>What guides the experience</span>
                                    <h4>The principles behind Treat Health</h4>
                                </div>

                                <div className="mission-pillars-grid">
                                    {missionPillars.map((pillar) => {
                                        const Icon = pillar.icon;
                                        return (
                                            <article key={pillar.title} className="mission-pillar-card">
                                                <div className="mission-pillar-icon">
                                                    <Icon size={18} />
                                                </div>
                                                <h5>{pillar.title}</h5>
                                                <p>{pillar.description}</p>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mission-slide mission-slide-promise" id="mission-slide-3">
                                <div className="mission-story-layout">
                                    <div className="mission-commitment-card">
                                        <div>
                                            <span className="mission-commitment-label">Our promise</span>
                                            <p>
                                                We are building a care experience that reduces overwhelm,
                                                strengthens trust, and gives clients a more grounded way to stay
                                                connected with therapy and support.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mission-journey-card">
                                        <span className="mission-commitment-label">What that should feel like</span>
                                        <div className="mission-journey-list">
                                            {careJourneyMoments.map((item, index) => (
                                                <div key={item} className="mission-journey-item">
                                                    <span className="mission-journey-number">0{index + 1}</span>
                                                    <p>{item}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mission-actions">
                                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                                        Close
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={onClose}>
                                        Continue Your Journey
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </dialog>
    );
}
