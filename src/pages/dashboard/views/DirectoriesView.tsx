import { Link2, Mail, Phone, PhoneCall, Users } from 'lucide-react';
import FullPagePanel from '../../../components/common/FullPagePanel';
import './DirectoriesView.css';

/* ── Data ─────────────────────────────────────────────────────────── */

const CARE_TEAM = [
    {
        name: 'Sabrina',
        initials: 'SA',
        role: 'Administration',
        avatarColor: '#C59D5F',
        avatarBg: '#FAF3E8',
        phone: '629-247-0565',
        note: 'Administrative support, psychiatric scheduling, EDD/SDI documentation.',
    },
    {
        name: 'Jacob',
        initials: 'JA',
        role: 'Client Care Coordinator',
        avatarColor: '#467174',
        avatarBg: '#E6F4F5',
        phone: '903-343-9507',
        note: 'Primary point of contact throughout your treatment journey.',
    },
    {
        name: 'Tyler Innerarity',
        initials: 'TI',
        role: 'Client Care Coordinator',
        avatarColor: '#467174',
        avatarBg: '#E6F4F5',
        phone: '(936) 671-0103',
        note: 'Primary point of contact throughout your treatment journey.',
    },
    {
        name: 'Latasha Taylor',
        initials: 'LT',
        role: 'Clinical Director',
        avatarColor: '#856644',
        avatarBg: '#F5EDE3',
        email: 'latashat@treatmhtexas.com',
    },
    {
        name: 'Gema Maldonado',
        initials: 'GM',
        role: 'Program Director',
        avatarColor: '#467174',
        avatarBg: '#E6F4F5',
        email: 'Gemam@treatmh.com',
    },
    {
        name: 'Cavan Power',
        initials: 'CP',
        role: 'Director of Client Care',
        avatarColor: '#856644',
        avatarBg: '#F5EDE3',
        email: 'cavanp@treatmh.com',
    },
] as const;

const CRISIS_LINES = [
    {
        name: '911 — Emergency',
        detail: 'In the event of an emergency, call 911 or go to your nearest emergency room.',
        phone: '911',
        urgent: true,
    },
    {
        name: '988 Suicide & Crisis Lifeline',
        detail: 'Call or text for 24/7 free, confidential support during suicidal crisis or emotional distress.',
        phone: '988',
        url: 'https://988lifeline.org',
        urgent: true,
    },
    {
        name: 'NAMI HelpLine',
        detail: 'M–F 10 am–10 pm ET. Call, text, or chat. Text "helpline" to 62640.',
        phone: '1-800-950-6264',
        url: 'https://www.nami.org',
        urgent: false,
    },
    {
        name: 'National Suicide Hotline',
        detail: undefined,
        phone: '1-800-784-2433',
        urgent: false,
    },
    {
        name: 'National Suicide Prevention Lifeline',
        detail: 'Text TALK to 741741 for Crisis Textline. All calls confidential and free.',
        phone: '800-273-8255',
        urgent: false,
    },
    {
        name: "SAMHSA's National Helpline",
        detail: 'Nationwide toll-free hotline for people experiencing mental health crises.',
        phone: '1-800-662-4357',
        url: 'https://www.samhsa.gov',
        urgent: false,
    },
] as const;

const HELPFUL_LINKS = [
    { label: 'Treat Health Website', url: 'https://treatmh.com' },
    { label: 'NAMI — National Alliance on Mental Illness', url: 'https://www.nami.org' },
    { label: '988 Suicide & Crisis Lifeline', url: 'https://988lifeline.org' },
    { label: 'SAMHSA', url: 'https://www.samhsa.gov' },
] as const;

/* ── Component ────────────────────────────────────────────────────── */

interface DirectoriesViewProps {
    onClose: () => void;
}

export default function DirectoriesView({ onClose }: Readonly<DirectoriesViewProps>) {
    return (
        <FullPagePanel
            icon={Users}
            iconColor="var(--secondary-700)"
            iconBg="var(--secondary-100)"
            title="Directories & Resources"
            subtitle="Contact your care team and access support resources"
            onClose={onClose}
        >
            {/* ── Intro banner ─────────────────────────── */}
            <div className="dir-view-intro">
                <div className="dir-view-intro-icon">
                    <Users size={22} />
                </div>
                <div>
                    <p className="dir-view-intro-heading">Your Care Network</p>
                    <p className="dir-view-intro-body">
                        All contact information, crisis lines, and helpful links for your care journey
                        in one place. Tap a phone number to call directly, or an email to send a message.
                    </p>
                </div>
            </div>

            {/* ── Care Team Directory ─────────────────── */}
            <section className="dir-view-section">
                <div className="dir-view-section-heading">
                    <div className="dir-view-section-icon dir-view-section-icon--team">
                        <Users size={18} />
                    </div>
                    <div>
                        <h3 className="dir-view-section-title">Care Team Directory</h3>
                        <p className="dir-view-section-sub">
                            Your coordinators, clinical leads, and administrative contacts.
                        </p>
                    </div>
                </div>
                <div className="dir-view-team-grid">
                    {CARE_TEAM.map((member) => (
                        <div key={member.name} className="dir-view-contact-card">
                            <div
                                className="dir-view-avatar"
                                style={{ background: member.avatarBg, color: member.avatarColor }}
                            >
                                {member.initials}
                            </div>
                            <div className="dir-view-contact-body">
                                <span className="dir-view-contact-name">{member.name}</span>
                                <span className="dir-view-role-badge">{member.role}</span>
                                {'note' in member && member.note && (
                                    <p className="dir-view-contact-note">{member.note}</p>
                                )}
                                <div className="dir-view-contact-actions">
                                    {'phone' in member && member.phone && (
                                        <a
                                            href={`tel:${member.phone}`}
                                            className="dir-view-action-btn dir-view-action-btn--phone"
                                            aria-label={`Call ${member.name}`}
                                        >
                                            <Phone size={13} />
                                            {member.phone}
                                        </a>
                                    )}
                                    {'email' in member && member.email && (
                                        <a
                                            href={`mailto:${member.email}`}
                                            className="dir-view-action-btn dir-view-action-btn--email"
                                            aria-label={`Email ${member.name}`}
                                        >
                                            <Mail size={13} />
                                            {member.email}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Emergency & Crisis Hotlines ─────────── */}
            <section className="dir-view-section">
                <div className="dir-view-section-heading">
                    <div className="dir-view-section-icon dir-view-section-icon--crisis">
                        <PhoneCall size={18} />
                    </div>
                    <div>
                        <h3 className="dir-view-section-title">Emergency &amp; Crisis Hotlines</h3>
                        <p className="dir-view-section-sub">
                            Immediate support resources available 24/7.
                        </p>
                    </div>
                </div>
                <div className="dir-view-crisis-list">
                    {CRISIS_LINES.map((line) => (
                        <div
                            key={line.name}
                            className={`dir-view-crisis-card${line.urgent ? ' dir-view-crisis-card--urgent' : ''}`}
                        >
                            <div className="dir-view-crisis-body">
                                <span className="dir-view-crisis-name">{line.name}</span>
                                {line.detail && (
                                    <p className="dir-view-crisis-detail">{line.detail}</p>
                                )}
                            </div>
                            <div className="dir-view-crisis-actions">
                                {'url' in line && line.url && (
                                    <a
                                        href={line.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="dir-view-action-btn dir-view-action-btn--link"
                                        aria-label={`Visit ${line.name} website`}
                                    >
                                        <Link2 size={13} />
                                        Website
                                    </a>
                                )}
                                <a
                                    href={`tel:${line.phone}`}
                                    className="dir-view-action-btn dir-view-action-btn--crisis dir-view-crisis-phone"
                                    aria-label={`Call ${line.name}`}
                                >
                                    <Phone size={13} />
                                    {line.phone}
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Helpful Links ────────────────────────── */}
            <section className="dir-view-section">
                <div className="dir-view-section-heading">
                    <div className="dir-view-section-icon dir-view-section-icon--links">
                        <Link2 size={18} />
                    </div>
                    <div>
                        <h3 className="dir-view-section-title">Helpful Links</h3>
                        <p className="dir-view-section-sub">
                            External organisations, community resources, and reference sites.
                        </p>
                    </div>
                </div>
                <div className="dir-view-links-row">
                    {HELPFUL_LINKS.map((link) => (
                        <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dir-view-link-pill"
                        >
                            <Link2 size={13} />
                            {link.label}
                        </a>
                    ))}
                </div>
            </section>
        </FullPagePanel>
    );
}
