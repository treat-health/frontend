import { X } from 'lucide-react';
import './FirstDaysModal.css';

export interface FirstDaysModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const STEPS = [
    {
        number: '01',
        title: 'Pre-Assessment Call',
        subtitle: 'Admissions',
        description:
            'An admissions team member will contact you to complete a brief pre-assessment. This call allows us to gather initial information and address any questions you may have.',
    },
    {
        number: '02',
        title: 'Client Onboarding & Assessment Prep',
        subtitle: 'Client Care Coordinator',
        description:
            'A Client Care Coordinator will guide you through receiving and accessing your Patient Portal invitation via email, uploading your profile photo, securely completing your admission forms, and scheduling a date and time for your BPS assessment.',
    },
    {
        number: '03',
        title: 'Biopsychosocial (BPS) Assessment',
        subtitle: 'Therapy Team · Google Meet',
        description:
            'You will attend your BPS assessment with one of our therapists. This assessment explores your history, needs, and treatment goals in depth. An invitation will be sent via email no later than 30 minutes before your appointment.',
    },
    {
        number: '04',
        title: 'Initial Psychiatric Evaluation (IPE)',
        subtitle: 'Psychiatric Provider · Telehealth',
        description:
            'Within 48 hours of your BPS Assessment, you will meet with a psychiatric provider for your Initial Psychiatric Evaluation. This step is essential to developing a personalized treatment plan. A Telehealth link will be emailed to you no less than 30 minutes before your appointment.',
    },
    {
        number: '05',
        title: 'Client Care Coordinator Follow-Up',
        subtitle: 'Client Care Team',
        description:
            'Once your initial assessments are complete, your Client Care Coordinator will email a Resource Directory with all necessary information, resources, and guidance to support your success in the program.',
    },
] as const;

export default function FirstDaysModal({ isOpen, onClose }: Readonly<FirstDaysModalProps>) {
    if (!isOpen) return null;

    return (
        <dialog
            open
            className="modal-overlay first-days-dialog"
            onCancel={onClose}
            aria-label="First Days Overview"
        >
            <div className="first-days-modal">
                <div className="first-days-header">
                    <div className="first-days-header-copy">
                        <span className="first-days-badge">Getting Started</span>
                        <h3>What to Expect Your First Few Days</h3>
                        <p>
                            Our team will guide you through each step to ensure a smooth transition
                            into the program. Here's what happens from day one.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-icon btn-ghost first-days-close-btn"
                        onClick={onClose}
                        aria-label="Close First Days Overview"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="first-days-body">
                    <ol className="first-days-timeline" aria-label="Onboarding steps">
                        {STEPS.map((step, index) => (
                            <li key={step.number} className="first-days-step">
                                <div className="first-days-step-aside">
                                    <span className="first-days-step-number">{step.number}</span>
                                    {index < STEPS.length - 1 && (
                                        <span className="first-days-step-connector" aria-hidden="true" />
                                    )}
                                </div>
                                <div className="first-days-step-content">
                                    <div className="first-days-step-title">{step.title}</div>
                                    <div className="first-days-step-subtitle">{step.subtitle}</div>
                                    <p className="first-days-step-desc">{step.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="first-days-footer-note">
                        If you need help at any point, contact your <strong>Client Care Coordinator</strong> or{' '}
                        <strong>Admissions Representative</strong> — we're here for you every step of the way.
                    </div>
                </div>

                <div className="first-days-actions">
                    <button type="button" className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </dialog>
    );
}
