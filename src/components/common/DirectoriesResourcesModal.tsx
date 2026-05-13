import { useEffect } from 'react';
import { X, Users, Phone, Link2, Mail } from 'lucide-react';
import './DirectoriesResourcesModal.css';

export interface DirectoriesResourcesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CARE_TEAM = [
    { role: 'Administration', name: 'Sabrina', phone: '629-247-0565', note: 'Administrative support, psychiatric scheduling, EDD/SDI documentation.' },
    { role: 'Client Care Coordinator', name: 'Jacob', phone: '903-343-9507', note: 'Primary point of contact throughout your treatment journey.' },
    { role: 'Client Care Coordinator', name: 'Tyler Innerarity', phone: '(936) 671-0103', note: 'Primary point of contact throughout your treatment journey.' },
    { role: 'Clinical Director', name: 'Latasha Taylor', email: 'latashat@treatmhtexas.com' },
    { role: 'Program Director', name: 'Gema Maldonado', email: 'Gemam@treatmh.com' },
    { role: 'Director of Client Care', name: 'Cavan Power', email: 'cavanp@treatmh.com' },
] as const;

const CRISIS_LINES = [
    { name: '911 — Emergency', detail: 'In the event of an emergency call 911 or go to your nearest emergency room.', phone: '911' },
    { name: '988 Suicide & Crisis Lifeline', detail: 'Call or text for 24/7 free, confidential support during suicidal crisis or emotional distress.', phone: '988', url: 'https://988lifeline.org' },
    { name: 'NAMI HelpLine', detail: 'M–F 10 am–10 pm ET. Call, text, or chat. Text "helpline" to 62640.', phone: '1-800-950-6264', url: 'https://www.nami.org' },
    { name: 'National Suicide Hotline', detail: undefined, phone: '1-800-784-2433' },
    { name: 'National Suicide Prevention Lifeline', detail: 'Text TALK to 741741 for Crisis Textline. All calls confidential and free.', phone: '800-273-8255' },
    { name: "SAMHSA's National Helpline", detail: 'Nationwide toll-free hotline for people experiencing mental health crises.', phone: '1-800-662-4357', url: 'https://www.samhsa.gov' },
] as const;

const HELPFUL_LINKS = [
    { label: 'Treat Health Website', url: 'https://treatmh.com' },
    { label: 'NAMI — National Alliance on Mental Illness', url: 'https://www.nami.org' },
    { label: '988 Suicide & Crisis Lifeline', url: 'https://988lifeline.org' },
    { label: 'SAMHSA', url: 'https://www.samhsa.gov' },
] as const;

export default function DirectoriesResourcesModal({ isOpen, onClose }: Readonly<DirectoriesResourcesModalProps>) {
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <dialog
            open
            className="modal-overlay dir-dialog"
            onCancel={onClose}
            aria-label="Directories and Resources"
        >
            <div className="dir-modal">
                <div className="dir-modal-header">
                    <div className="dir-modal-header-copy">
                        <h3>Directories &amp; Resources</h3>
                        <p>Reference contacts, crisis lines, guides, and helpful links for your care journey.</p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-icon btn-ghost dir-close-btn"
                        onClick={onClose}
                        aria-label="Close Directories and Resources"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="dir-modal-body">

                    {/* Care Team Directory */}
                    <section className="dir-section">
                        <div className="dir-section-header">
                            <div className="dir-section-icon"><Users size={18} /></div>
                            <div className="dir-section-meta">
                                <h4>Care Team Directory</h4>
                                <p>Your coordinators, clinical leads, and administrative contacts.</p>
                            </div>
                        </div>
                        <div className="dir-section-body dir-contact-list">
                            {CARE_TEAM.map((c) => (
                                <div key={c.name} className="dir-contact-card">
                                    <div className="dir-contact-info">
                                        <span className="dir-contact-name">{c.name}</span>
                                        <span className="dir-contact-role">{c.role}</span>
                                        {'note' in c && c.note && <span className="dir-contact-note">{c.note}</span>}
                                    </div>
                                    <div className="dir-contact-actions">
                                        {'phone' in c && c.phone && (
                                            <a href={`tel:${c.phone}`} className="dir-contact-btn" aria-label={`Call ${c.name}`}>
                                                <Phone size={14} />
                                                {c.phone}
                                            </a>
                                        )}
                                        {'email' in c && c.email && (
                                            <a href={`mailto:${c.email}`} className="dir-contact-btn dir-contact-btn--email" aria-label={`Email ${c.name}`}>
                                                <Mail size={14} />
                                                {c.email}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Support / Crisis Contacts */}
                    <section className="dir-section">
                        <div className="dir-section-header">
                            <div className="dir-section-icon"><Phone size={18} /></div>
                            <div className="dir-section-meta">
                                <h4>Emergency &amp; Crisis Hotlines</h4>
                                <p>Immediate support resources available 24/7.</p>
                            </div>
                        </div>
                        <div className="dir-section-body dir-contact-list">
                            {CRISIS_LINES.map((c) => (
                                <div key={c.name} className="dir-contact-card">
                                    <div className="dir-contact-info">
                                        <span className="dir-contact-name">{c.name}</span>
                                        {c.detail && <span className="dir-contact-note">{c.detail}</span>}
                                    </div>
                                    <div className="dir-contact-actions">
                                        <a href={`tel:${c.phone}`} className="dir-contact-btn dir-contact-btn--crisis" aria-label={`Call ${c.name}`}>
                                            <Phone size={14} />
                                            {c.phone}
                                        </a>
                                        {'url' in c && c.url && (
                                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="dir-contact-btn dir-contact-btn--link" aria-label={`Visit ${c.name} website`}>
                                                <Link2 size={14} />
                                                Website
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Helpful Links */}
                    <section className="dir-section">
                        <div className="dir-section-header">
                            <div className="dir-section-icon"><Link2 size={18} /></div>
                            <div className="dir-section-meta">
                                <h4>Helpful Links</h4>
                                <p>External organisations, community resources, and reference sites.</p>
                            </div>
                        </div>
                        <div className="dir-section-body dir-links-list">
                            {HELPFUL_LINKS.map((link) => (
                                <a
                                    key={link.url}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="dir-link-item"
                                >
                                    <Link2 size={13} />
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </section>

                </div>
            </div>
        </dialog>
    );
}

