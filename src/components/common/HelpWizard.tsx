import { useState, useEffect } from 'react';
import {
    X,
    CheckCircle,
    Clock,
    MessageSquare,
    Lock,
    Bell,
    Video,
    ChevronRight,
    ArrowLeft,
    Sparkles,
    HelpCircle,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { issueApi } from '../../services/issue.service';
import { IssueCategoryEnum } from '../../types/issue.types';
import type { IssueCategory, CreateIssueInput, IssueMetadata, Issue } from '../../types/issue.types';
import toast from 'react-hot-toast';
import { useAuthStore, type UserRole } from '../../stores/authStore';
import './HelpWizard.css';

type TutorialTab = 'tutorials' | 'report' | 'past';
type TutorialIllustrationType = 'join-session' | 'messages' | 'security' | 'appointments' | 'notifications' | 'availability' | 'support';

interface TutorialStep {
    title: string;
    description: string;
}

interface TutorialGuide {
    id: string;
    title: string;
    summary: string;
    description: string;
    role: 'CLIENT' | 'THERAPIST';
    route: string;
    actionLabel: string;
    illustration: TutorialIllustrationType;
    steps: TutorialStep[];
    tips?: string[];
}

const TUTORIAL_GUIDES: TutorialGuide[] = [
    {
        id: 'client-join-session',
        title: 'Join a Session',
        summary: 'See where to find your next session and when the Join button becomes available.',
        description: 'Quick guidance for entering your therapy room and allowing camera and microphone access.',
        role: 'CLIENT',
        route: '/appointments',
        actionLabel: 'Open My Appointments',
        illustration: 'join-session',
        steps: [
            {
                title: 'Open My Appointments',
                description: 'Go to the My Appointments page from the sidebar or dashboard to see your upcoming sessions.',
            },
            {
                title: 'Look for the Join Session button',
                description: 'The button becomes active shortly before your scheduled start time. If it is disabled, the session window has not opened yet.',
            },
            {
                title: 'Allow camera and microphone access',
                description: 'When your browser asks for permission, click Allow so the therapist can see and hear you.',
            },
            {
                title: 'Rejoin if needed',
                description: 'If your internet drops, return to the same session and use the rejoin option while the room is still open.',
            },
        ],
        tips: [
            'Keep your camera on during the session unless your therapist tells you otherwise.',
            'Use headphones if you want more privacy and clearer audio.',
        ],
    },
    {
        id: 'client-messages',
        title: 'Send a Message',
        summary: 'Learn how to open a conversation, type a message, and send a quick update.',
        description: 'Use Messages to stay in touch with your care team and respond quickly to updates.',
        role: 'CLIENT',
        route: '/messages',
        actionLabel: 'Open Messages',
        illustration: 'messages',
        steps: [
            {
                title: 'Open Messages from the sidebar',
                description: 'Select Messages to view your recent conversations and unread updates.',
            },
            {
                title: 'Choose the correct conversation',
                description: 'Click the name of the therapist or care contact you want to message.',
            },
            {
                title: 'Type and send',
                description: 'Write your message in the text box and press Enter or click Send.',
            },
            {
                title: 'Watch for replies and badges',
                description: 'Unread message badges and notification alerts help you know when someone responds.',
            },
        ],
        tips: [
            'Use messages for updates and questions, not urgent emergencies.',
        ],
    },
    {
        id: 'client-security',
        title: 'Update Profile & Password',
        summary: 'Find your Settings page, update your details, and change your password safely.',
        description: 'Keep your contact information and password current so your account stays secure.',
        role: 'CLIENT',
        route: '/settings?tab=security',
        actionLabel: 'Open Settings',
        illustration: 'security',
        steps: [
            {
                title: 'Open Settings',
                description: 'Select Settings from the sidebar to manage your account details.',
            },
            {
                title: 'Update your profile information',
                description: 'Use the Profile tab to change your name, phone number, or state if needed.',
            },
            {
                title: 'Switch to the Security tab',
                description: 'Enter your current password, then your new password, and confirm it before saving.',
            },
            {
                title: 'Save carefully',
                description: 'Choose a strong password you will remember and never share it with others.',
            },
        ],
        tips: [
            'A longer password is usually stronger and easier to keep secure.',
        ],
    },
    {
        id: 'client-notifications',
        title: 'Manage Notifications',
        summary: 'Control reminder alerts and browser notifications so you do not miss messages or sessions.',
        description: 'Notification preferences help you stay updated without feeling overwhelmed.',
        role: 'CLIENT',
        route: '/settings?tab=notifications',
        actionLabel: 'Open Notification Settings',
        illustration: 'notifications',
        steps: [
            {
                title: 'Open Settings and go to Notifications',
                description: 'Use the Notifications tab to review reminder and message alerts.',
            },
            {
                title: 'Enable browser push notifications',
                description: 'If prompted, allow notifications so the portal can send you important reminders.',
            },
            {
                title: 'Review your reminder preferences',
                description: 'Keep session reminders turned on so you receive alerts before appointments begin.',
            },
        ],
    },
    {
        id: 'client-appointments',
        title: 'Check Appointments',
        summary: 'Review upcoming sessions, see their status, and know where to return before your visit starts.',
        description: 'Use your appointments page to stay on top of upcoming sessions and session timing.',
        role: 'CLIENT',
        route: '/appointments',
        actionLabel: 'Open My Appointments',
        illustration: 'appointments',
        steps: [
            {
                title: 'Open My Appointments',
                description: 'Go to My Appointments from the sidebar whenever you want to review your schedule.',
            },
            {
                title: 'Look at the session status',
                description: 'Each appointment shows whether it is scheduled, in progress, completed, or changed.',
            },
            {
                title: 'Use the page before session time',
                description: 'Return here shortly before your appointment so you can spot the Join Session action as soon as it is available.',
            },
        ],
        tips: [
            'If you are ever unsure where your next session is, start with My Appointments.',
        ],
    },
    {
        id: 'client-help',
        title: 'Get Help Fast',
        summary: 'Use Help & Support to report a problem and keep track of anything you already submitted.',
        description: 'If something is not working, you can report it directly from the portal and review past issues later.',
        role: 'CLIENT',
        route: '/dashboard',
        actionLabel: 'Go to Dashboard',
        illustration: 'support',
        steps: [
            {
                title: 'Open Help & Support from the header',
                description: 'Use the help icon whenever you need guidance or want to tell the team about a problem.',
            },
            {
                title: 'Use Tutorials for quick answers',
                description: 'The Tutorials tab helps with common tasks like sessions, messages, settings, and notifications.',
            },
            {
                title: 'Use Report Issue if something is wrong',
                description: 'Write a short summary and details so the support team can investigate quickly.',
            },
            {
                title: 'Check Past Issues for updates',
                description: 'Return to this same modal any time to review issues you already reported.',
            },
        ],
    },
    {
        id: 'therapist-join-session',
        title: 'Join a Client Session',
        summary: 'Open your schedule, enter the session room, and reconnect if the call is interrupted.',
        description: 'A quick guide for joining sessions from the therapist side of the portal.',
        role: 'THERAPIST',
        route: '/therapist/appointments',
        actionLabel: 'Open Appointments',
        illustration: 'join-session',
        steps: [
            {
                title: 'Open Appointments',
                description: 'Go to the Appointments page to see your calendar and upcoming client sessions.',
            },
            {
                title: 'Use Join Session when available',
                description: 'The Join button becomes active when the session window opens.',
            },
            {
                title: 'Check your camera and microphone',
                description: 'Allow browser permissions and confirm your audio/video are working before the session starts.',
            },
            {
                title: 'Rejoin if disconnected',
                description: 'If the room closes unexpectedly, return to the session and rejoin while it is still active.',
            },
        ],
        tips: [
            'Join a few minutes early so you can verify audio before the client arrives.',
        ],
    },
    {
        id: 'therapist-messages',
        title: 'Message a Client',
        summary: 'Open a conversation, send updates, and keep communication organized in one place.',
        description: 'Use portal messaging for routine communication and follow-up.',
        role: 'THERAPIST',
        route: '/messages',
        actionLabel: 'Open Messages',
        illustration: 'messages',
        steps: [
            {
                title: 'Open Messages',
                description: 'Select Messages to review unread conversations and recent replies.',
            },
            {
                title: 'Choose or start the right conversation',
                description: 'Open the relevant chat thread so updates stay organized by person or group.',
            },
            {
                title: 'Send clear and short updates',
                description: 'Type your message, review it quickly, and send it from the composer area.',
            },
        ],
        tips: [
            'Use message threads for follow-up and coordination, and document clinical details in the correct workflow when needed.',
        ],
    },
    {
        id: 'therapist-availability',
        title: 'Set Availability',
        summary: 'Manage your recurring weekly hours so scheduling stays accurate for your sessions.',
        description: 'Availability settings control when you appear open for bookings and scheduling workflows.',
        role: 'THERAPIST',
        route: '/settings?tab=availability',
        actionLabel: 'Open Availability Settings',
        illustration: 'availability',
        steps: [
            {
                title: 'Open Settings and choose Availability',
                description: 'The Availability tab is visible for therapists and shows your weekly schedule.',
            },
            {
                title: 'Turn days on or off',
                description: 'Enable the days you work and disable the ones you do not want available.',
            },
            {
                title: 'Set your start and end times',
                description: 'Choose the time window for each active day so the schedule matches your real hours.',
            },
            {
                title: 'Save your schedule',
                description: 'Click Save Availability to update the portal and keep future scheduling accurate.',
            },
        ],
        tips: [
            'Review your availability whenever your working hours change to avoid booking confusion.',
        ],
    },
    {
        id: 'therapist-session-actions',
        title: 'Complete or Mark No-Show',
        summary: 'Learn where to complete a session, add notes, or mark a session as a no-show.',
        description: 'These actions help keep your schedule and records up to date after each appointment.',
        role: 'THERAPIST',
        route: '/therapist/appointments',
        actionLabel: 'Open Appointments',
        illustration: 'appointments',
        steps: [
            {
                title: 'Open your appointment list or calendar',
                description: 'Find the scheduled session you want to update.',
            },
            {
                title: 'Choose Complete when the session is finished',
                description: 'Add your session notes and save to close out the visit properly.',
            },
            {
                title: 'Use No Show only when appropriate',
                description: 'If the client did not attend, use the No Show action so the record reflects what happened.',
            },
        ],
    },
    {
        id: 'therapist-security',
        title: 'Update Password & Profile',
        summary: 'Keep your contact details current and update your password from Settings.',
        description: 'A quick walkthrough for profile updates and secure password changes.',
        role: 'THERAPIST',
        route: '/settings?tab=security',
        actionLabel: 'Open Settings',
        illustration: 'security',
        steps: [
            {
                title: 'Open Settings',
                description: 'Use the sidebar to reach your account settings page.',
            },
            {
                title: 'Edit your Profile tab if needed',
                description: 'Update your name, phone number, or state from the Profile section.',
            },
            {
                title: 'Go to Security to change your password',
                description: 'Enter your current password, then set and confirm a new one.',
            },
        ],
    },
];

function getTutorialRole(role?: UserRole): 'CLIENT' | 'THERAPIST' {
    return role === 'THERAPIST' ? 'THERAPIST' : 'CLIENT';
}

function TutorialIllustration({ type }: Readonly<{ type: TutorialIllustrationType }>) {
    if (type === 'join-session') {
        return (
            <div className="help-tutorial-illustration join-session">
                <div className="help-screen-window">
                    <div className="help-screen-bar" />
                    <div className="help-video-grid">
                        <div className="help-video-tile therapist"><Video size={16} /></div>
                        <div className="help-video-tile client"><Video size={16} /></div>
                    </div>
                    <div className="help-join-button">Join Session</div>
                </div>
            </div>
        );
    }

    if (type === 'messages') {
        return (
            <div className="help-tutorial-illustration messages">
                <div className="help-message-sidebar">
                    <span />
                    <span />
                    <span />
                </div>
                <div className="help-message-thread">
                    <div className="help-bubble incoming">Hello!</div>
                    <div className="help-bubble outgoing">I’ll be there.</div>
                    <div className="help-message-input">
                        <span>Type message</span>
                        <MessageSquare size={12} />
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'security') {
        return (
            <div className="help-tutorial-illustration security">
                <div className="help-settings-card">
                    <div className="help-settings-row strong"><Lock size={14} /> Security</div>
                    <div className="help-settings-row" />
                    <div className="help-settings-row" />
                    <div className="help-save-pill">Save</div>
                </div>
            </div>
        );
    }

    if (type === 'notifications') {
        return (
            <div className="help-tutorial-illustration notifications">
                <div className="help-bell-badge"><Bell size={18} /></div>
                <div className="help-notification-card">
                    <div className="help-notification-line strong" />
                    <div className="help-notification-line" />
                    <div className="help-notification-toggle">
                        <span />
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'availability') {
        return (
            <div className="help-tutorial-illustration availability">
                <div className="help-calendar-mini">
                    <div className="help-calendar-row active"><span>Mon</span><span>09:00–17:00</span></div>
                    <div className="help-calendar-row active"><span>Tue</span><span>09:00–17:00</span></div>
                    <div className="help-calendar-row"><span>Wed</span><span>Off</span></div>
                </div>
            </div>
        );
    }

    if (type === 'support') {
        return (
            <div className="help-tutorial-illustration support">
                <div className="help-support-stack">
                    <div className="help-support-icon"><HelpCircle size={16} /></div>
                    <div className="help-support-card">
                        <div className="help-support-line strong">Need help?</div>
                        <div className="help-support-line" />
                        <div className="help-support-actions">
                            <span>Tutorials</span>
                            <span>Report</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="help-tutorial-illustration appointments">
            <div className="help-appointment-card">
                <div className="help-appointment-line strong" />
                <div className="help-appointment-line" />
                <div className="help-action-pills">
                    <span className="complete">Complete</span>
                    <span className="no-show">No Show</span>
                </div>
            </div>
        </div>
    );
}

function TutorialListView({
    tutorialRole,
    tutorials,
    onOpenTutorial,
}: Readonly<{
    tutorialRole: 'CLIENT' | 'THERAPIST';
    tutorials: TutorialGuide[];
    onOpenTutorial: (guide: TutorialGuide) => void;
}>) {
    return (
        <div className="help-tutorials-shell">
            <div className="help-tutorials-intro">
                <span className="help-role-pill">{tutorialRole === 'THERAPIST' ? 'Therapist tutorials' : 'Client tutorials'}</span>
                <h4>Learn how to use your portal</h4>
                <p>
                    Choose a quick guide below to see step-by-step help for the tools you use most.
                </p>
            </div>

            <div className="help-tutorial-grid">
                {tutorials.map((guide) => (
                    <button key={guide.id} type="button" className="help-tutorial-card" onClick={() => onOpenTutorial(guide)}>
                        <TutorialIllustration type={guide.illustration} />
                        <div className="help-tutorial-card-copy">
                            <div className="help-tutorial-card-header">
                                <h5>{guide.title}</h5>
                                <ChevronRight size={16} />
                            </div>
                            <p>{guide.summary}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function TutorialDetailView({
    tutorialRole,
    selectedTutorial,
    onBack,
    onAction,
}: Readonly<{
    tutorialRole: 'CLIENT' | 'THERAPIST';
    selectedTutorial: TutorialGuide;
    onBack: () => void;
    onAction: (guide: TutorialGuide) => void;
}>) {
    return (
        <div className="help-tutorial-detail">
            <button className="help-tutorial-back" onClick={onBack}>
                <ArrowLeft size={16} /> Back to tutorials
            </button>

            <div className="help-tutorial-detail-hero">
                <TutorialIllustration type={selectedTutorial.illustration} />
                <div className="help-tutorial-detail-copy">
                    <span className="help-role-pill">{tutorialRole === 'THERAPIST' ? 'Therapist guide' : 'Client guide'}</span>
                    <h4>{selectedTutorial.title}</h4>
                    <p>{selectedTutorial.description}</p>
                </div>
            </div>

            <div className="help-steps-list">
                {selectedTutorial.steps.map((step, index) => (
                    <div key={step.title} className="help-step-card">
                        <div className="help-step-number">{index + 1}</div>
                        <div>
                            <h5>{step.title}</h5>
                            <p>{step.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {selectedTutorial.tips && selectedTutorial.tips.length > 0 && (
                <div className="help-tips-box">
                    <div className="help-tips-title"><Sparkles size={14} /> Helpful tips</div>
                    <ul>
                        {selectedTutorial.tips.map((tip) => (
                            <li key={tip}>{tip}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onBack}>
                    Close Guide
                </button>
                <button type="button" className="btn btn-primary" onClick={() => onAction(selectedTutorial)}>
                    {selectedTutorial.actionLabel}
                </button>
            </div>
        </div>
    );
}

function ReportIssueContent({
    isSuccess,
    handleViewMyIssues,
    handleSubmit,
    category,
    setCategory,
    title,
    setTitle,
    description,
    setDescription,
    onClose,
    isSubmitting,
}: Readonly<{
    isSuccess: boolean;
    handleViewMyIssues: () => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    category: IssueCategory;
    setCategory: (category: IssueCategory) => void;
    title: string;
    setTitle: (value: string) => void;
    description: string;
    setDescription: (value: string) => void;
    onClose: () => void;
    isSubmitting: boolean;
}>) {
    if (isSuccess) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <CheckCircle size={48} style={{ color: 'var(--success-color)', margin: '0 auto 1rem' }} />
                <h4>Issue Submitted</h4>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                    Our team has been notified and will review your issue shortly.
                </p>
                <button className="btn btn-primary" onClick={handleViewMyIssues} style={{ width: '100%' }}>
                    View My Issues
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                    id="category"
                    className="form-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                >
                    <option value={IssueCategoryEnum.TECHNICAL}>Technical Issue</option>
                    <option value={IssueCategoryEnum.SESSION}>Video / Session Problem</option>
                    <option value={IssueCategoryEnum.BILLING}>Billing</option>
                    <option value={IssueCategoryEnum.ACCOUNT}>Account Management</option>
                    <option value={IssueCategoryEnum.OTHER}>Other</option>
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="title">Summary / Subject</label>
                <input
                    id="title"
                    type="text"
                    className="form-control"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    required
                />
            </div>

            <div className="form-group">
                <label htmlFor="description">Details</label>
                <textarea
                    id="description"
                    className="form-control"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please provide as much detail as possible..."
                    rows={5}
                    required
                />
                <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                    System automatically captures your current page and browser details for debugging.
                </small>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Issue'}
                </button>
            </div>
        </form>
    );
}

function PastIssuesContent({
    isLoadingPast,
    pastIssues,
    totalPages,
    currentPage,
    loadPastIssues,
    getStatusBadgeClass,
}: Readonly<{
    isLoadingPast: boolean;
    pastIssues: Issue[];
    totalPages: number;
    currentPage: number;
    loadPastIssues: (page: number) => Promise<void>;
    getStatusBadgeClass: (status: string) => string;
}>) {
    if (isLoadingPast) {
        return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading past issues...</div>;
    }

    if (pastIssues.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                You have no previously reported issues.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pastIssues.map(issue => (
                <div key={issue.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{issue.title}</h4>
                        <span className={`badge ${getStatusBadgeClass(issue.status)}`} style={{ fontSize: '0.7rem' }}>
                            {issue.status.replace('_', ' ')}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {issue.description.length > 80 ? `${issue.description.substring(0, 80)}...` : issue.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ textTransform: 'capitalize' }}>{issue.category.toLowerCase()}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> {new Date(issue.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            ))}

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        className="btn btn-sm btn-outline"
                        disabled={currentPage === 1 || isLoadingPast}
                        onClick={() => { void loadPastIssues(currentPage - 1); }}
                    >
                        Prev
                    </button>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        className="btn btn-sm btn-outline"
                        disabled={currentPage === totalPages || isLoadingPast}
                        onClick={() => { void loadPastIssues(currentPage + 1); }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

export interface HelpWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpWizard({ isOpen, onClose }: Readonly<HelpWizardProps>) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const tutorialRole = getTutorialRole(user?.role);
    const tutorials = TUTORIAL_GUIDES.filter((guide) => guide.role === tutorialRole);
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<IssueCategory>(IssueCategoryEnum.TECHNICAL);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<TutorialTab>('tutorials');
    const [selectedTutorial, setSelectedTutorial] = useState<TutorialGuide | null>(null);

    // Past issues state
    const [pastIssues, setPastIssues] = useState<Issue[]>([]);
    const [isLoadingPast, setIsLoadingPast] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadPastIssues = async (page: number) => {
        setIsLoadingPast(true);
        try {
            const result = await issueApi.listIssues({ page, limit: 5, sortOrder: 'desc', sortBy: 'createdAt' });
            if (result.success && result.data) {
                setPastIssues(result.data.issues);
                setTotalPages(result.data.pagination.totalPages);
                setCurrentPage(result.data.pagination.page);
            }
        } catch (error) {
            console.error('Failed to load past issues', error);
            toast.error('Failed to load past issues');
        } finally {
            setIsLoadingPast(false);
        }
    };

    // Load past issues when tab changes
    useEffect(() => {
        if (isOpen && activeTab === 'past') {
            loadPastIssues(1);
        }
    }, [isOpen, activeTab]);

    // Auto-suggest title based on location
    useEffect(() => {
        if (isOpen && !title) {
            setTitle(`Issue on ${location.pathname}`);
        }
    }, [isOpen, location.pathname, title]);

    // Reset state on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setIsSuccess(false);
                setTitle('');
                setDescription('');
                setCategory(IssueCategoryEnum.TECHNICAL);
                setActiveTab('tutorials');
                setSelectedTutorial(null);
                setCurrentPage(1);
            }, 300);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || activeTab !== 'tutorials') return;
        setSelectedTutorial((current) => {
            if (current && current.role === tutorialRole) {
                return current;
            }
            return null;
        });
    }, [activeTab, isOpen, tutorialRole]);

    if (!isOpen) return null;

    const openTutorial = (guide: TutorialGuide) => {
        setSelectedTutorial(guide);
    };

    const handleTutorialAction = (guide: TutorialGuide) => {
        navigate(guide.route);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim() || !description.trim()) {
            toast.error('Title and description are required.');
            return;
        }

        setIsSubmitting(true);
        
        const metadata: IssueMetadata = {
            route: location.pathname,
            userAgent: navigator.userAgent,
        };

        const input: CreateIssueInput = {
            title,
            description,
            category,
            metadata,
        };

        try {
            await issueApi.createIssue(input);
            setIsSuccess(true);
            toast.success('Issue reported successfully!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to report issue. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewMyIssues = () => {
        setIsSuccess(false);
        setActiveTab('past');
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'RESOLVED':
            case 'CLOSED': return 'badge-success';
            case 'IN_PROGRESS': return 'badge-primary';
            case 'BLOCKED': return 'badge-danger';
            case 'OPEN': return 'badge-error';
            default: return 'badge-warning';
        }
    };

    let tabContent: React.ReactNode;

    if (activeTab === 'tutorials') {
        tabContent = selectedTutorial ? (
            <TutorialDetailView
                tutorialRole={tutorialRole}
                selectedTutorial={selectedTutorial}
                onBack={() => setSelectedTutorial(null)}
                onAction={handleTutorialAction}
            />
        ) : (
            <TutorialListView
                tutorialRole={tutorialRole}
                tutorials={tutorials}
                onOpenTutorial={openTutorial}
            />
        );
    } else if (activeTab === 'report') {
        tabContent = (
            <ReportIssueContent
                isSuccess={isSuccess}
                handleViewMyIssues={handleViewMyIssues}
                handleSubmit={handleSubmit}
                category={category}
                setCategory={setCategory}
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                onClose={onClose}
                isSubmitting={isSubmitting}
            />
        );
    } else {
        tabContent = (
            <PastIssuesContent
                isLoadingPast={isLoadingPast}
                pastIssues={pastIssues}
                totalPages={totalPages}
                currentPage={currentPage}
                loadPastIssues={loadPastIssues}
                getStatusBadgeClass={getStatusBadgeClass}
            />
        );
    }

    return (
        <dialog
            open
            className="modal-overlay help-wizard-dialog"
            onCancel={onClose}
            aria-label="Help and support"
            style={{ zIndex: 9999 }}
        >
            <div className="modal-content help-wizard-modal" style={{ maxWidth: '500px', position: 'relative' }}>
                <div className="modal-header" style={{ paddingBottom: 0, paddingRight: '3rem' }}>
                    <button className="btn btn-icon btn-ghost" onClick={onClose} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}>
                            <X size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', width: '100%', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>Help & Support</h3>
                    </div>
                    <div className="help-tabs">
                        <button 
                            className={`help-tab-btn ${activeTab === 'tutorials' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tutorials')}
                        >
                            Tutorials
                        </button>
                        <button 
                            className={`help-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                            onClick={() => setActiveTab('report')}
                        >
                            Report Issue
                        </button>
                        <button 
                            className={`help-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
                            onClick={() => setActiveTab('past')}
                        >
                            Past Issues
                        </button>
                    </div>
                </div>
                
                <div className="modal-body" style={{ minHeight: '350px' }}>
                    {tabContent}
                </div>
            </div>
        </dialog>
    );
}
