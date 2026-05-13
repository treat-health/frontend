import { useEffect } from 'react';
import { X, Clock, Users, Laptop, Lock } from 'lucide-react';
import './VirtualIOPModal.css';

export interface VirtualIOPModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GROUP_TOPICS = [
    'Emotional Regulation',
    'Trauma Recovery and Healing',
    'Anger Management',
    'Self-Esteem and Confidence Building',
    'Mindfulness and Meditation',
] as const;

export default function VirtualIOPModal({ isOpen, onClose }: Readonly<VirtualIOPModalProps>) {
    useEffect(() => {
        if (!isOpen) return undefined;
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflow = prevHtml;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <dialog
            open
            className="modal-overlay viop-dialog"
            onCancel={onClose}
            aria-label="Virtual IOP Program Details"
        >
            <div className="viop-modal">
                {/* Header */}
                <div className="viop-modal-header">
                    <div className="viop-header-copy">
                        <span className="viop-header-badge">Intensive Outpatient Program</span>
                        <h3>Virtual IOP</h3>
                        <p>Structured group therapy balancing treatment with everyday life — all from home.</p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-icon btn-ghost viop-close-btn"
                        onClick={onClose}
                        aria-label="Close Virtual IOP details"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="viop-modal-body">

                    {/* Schedule */}
                    <section className="viop-section">
                        <div className="viop-section-icon"><Clock size={18} /></div>
                        <div className="viop-section-content">
                            <h4>Session Schedule</h4>
                            <p>
                                As an IOP client you attend <strong>group sessions 3 hours a day, 3 days a week</strong>,
                                based on your assigned level of care. Sessions run in 3-hour blocks:
                            </p>
                            <div className="viop-schedule-grid">
                                <div className="viop-schedule-slot">
                                    <span className="viop-slot-label">Morning</span>
                                    <span className="viop-slot-time">8:00 AM – 11:00 AM</span>
                                </div>
                                <div className="viop-schedule-slot">
                                    <span className="viop-slot-label">Evening</span>
                                    <span className="viop-slot-time">6:00 PM – 9:00 PM</span>
                                </div>
                            </div>
                            <p className="viop-note">
                                In addition to group sessions, you will also have a <strong>1-hour individual session</strong> each week with your therapist.
                            </p>
                        </div>
                    </section>

                    {/* Group topics */}
                    <section className="viop-section">
                        <div className="viop-section-icon"><Users size={18} /></div>
                        <div className="viop-section-content">
                            <h4>Group Session Topics</h4>
                            <p>
                                Sessions are designed for growth, resilience, and connection — integrating{' '}
                                <strong>Cognitive Behavioral Therapy (CBT)</strong> and{' '}
                                <strong>Dialectical Behavior Therapy (DBT)</strong>.
                            </p>
                            <ul className="viop-topics-list">
                                {GROUP_TOPICS.map((topic) => (
                                    <li key={topic} className="viop-topic-item">{topic}</li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    {/* Tech requirements */}
                    <section className="viop-section">
                        <div className="viop-section-icon"><Laptop size={18} /></div>
                        <div className="viop-section-content">
                            <h4>Technology Requirements</h4>
                            <p>
                                You may join sessions using a <strong>cell phone, computer, laptop, or tablet</strong>.
                                Please <strong>keep your camera on</strong> during group therapy — this helps foster connection,
                                build trust, and maintain a safe environment for all participants.
                            </p>
                        </div>
                    </section>

                    {/* Confidentiality */}
                    <section className="viop-section viop-section--last">
                        <div className="viop-section-icon viop-section-icon--gold"><Lock size={18} /></div>
                        <div className="viop-section-content">
                            <h4>Confidentiality</h4>
                            <p>
                                Group sessions are <strong>strictly confidential</strong>. To uphold privacy and respect
                                for all participants, please join from a <strong>private and secure location</strong>.
                            </p>
                        </div>
                    </section>

                </div>

                <div className="viop-modal-footer">
                    <button type="button" className="btn btn-primary viop-got-it-btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </dialog>
    );
}
