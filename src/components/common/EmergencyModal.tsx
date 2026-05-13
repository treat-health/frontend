import { X, PhoneCall, ExternalLink } from 'lucide-react';
import './EmergencyModal.css';

export interface EmergencyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CRISIS_LINES = [
    {
        name: '988 Suicide & Crisis Lifeline',
        detail: 'Call or text 988 — 24/7 free, confidential support for suicidal crisis or emotional distress.',
        phone: '988',
        url: 'https://988lifeline.org',
        pinned: true,
    },
    {
        name: 'NAMI HelpLine',
        detail: 'Mon–Fri, 10 am–10 pm ET. Call, text, or chat. Text "helpline" to 62640.',
        phone: '1-800-950-6264',
        url: 'https://www.nami.org',
    },
    {
        name: 'National Suicide Hotline',
        detail: undefined,
        phone: '1-800-784-2433',
    },
    {
        name: 'National Suicide Prevention Lifeline',
        detail: 'Text TALK to 741741 for the Crisis Text Line. All calls are confidential and free.',
        phone: '800-273-8255',
    },
    {
        name: "SAMHSA's National Helpline",
        detail: 'Nationwide toll-free, 24/7 helpline for mental health or substance use crises.',
        phone: '1-800-662-4357',
        url: 'https://www.samhsa.gov',
    },
] as const;

export default function EmergencyModal({ isOpen, onClose }: Readonly<EmergencyModalProps>) {
    if (!isOpen) return null;

    return (
        <dialog
            open
            className="modal-overlay emergency-dialog"
            onCancel={onClose}
            aria-label="Emergency and Crisis Resources"
        >
            <div className="emergency-modal">
                {/* Header */}
                <div className="emergency-modal-header">
                    <div className="emergency-header-icon">
                        <PhoneCall size={22} />
                    </div>
                    <div className="emergency-header-copy">
                        <h3>Emergency &amp; Crisis Support</h3>
                        <p>If you are in immediate danger, call <strong>911</strong> or go to your nearest emergency room.</p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-icon btn-ghost emergency-close-btn"
                        onClick={onClose}
                        aria-label="Close emergency resources"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Crisis lines list */}
                <div className="emergency-modal-body">
                    {CRISIS_LINES.map((line) => (
                        <div
                            key={line.name}
                            className={`emergency-line-card${'pinned' in line && line.pinned ? ' emergency-line-card--pinned' : ''}`}
                        >
                            <div className="emergency-line-info">
                                <span className="emergency-line-name">{line.name}</span>
                                {line.detail && (
                                    <span className="emergency-line-detail">{line.detail}</span>
                                )}
                            </div>
                            <div className="emergency-line-actions">
                                <a
                                    href={`tel:${line.phone}`}
                                    className="emergency-call-btn"
                                    aria-label={`Call ${line.name} at ${line.phone}`}
                                >
                                    <PhoneCall size={15} />
                                    {line.phone}
                                </a>
                                {'url' in line && line.url && (
                                    <a
                                        href={line.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="emergency-link-btn"
                                        aria-label={`Visit ${line.name} website`}
                                    >
                                        <ExternalLink size={13} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer note */}
                <div className="emergency-modal-footer">
                    <p>All lines are free and confidential. <strong>You are not alone.</strong></p>
                </div>
            </div>
        </dialog>
    );
}
