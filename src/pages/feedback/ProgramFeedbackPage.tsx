import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Lock, MailCheck, MessageSquare, Send, Sparkles, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { programFeedbackApi } from '../../services/programFeedback.service';
import type { CreateProgramFeedbackInput, ProgramFeedbackItem } from '../../types/programFeedback.types';
import './ProgramFeedbackPage.css';

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

const formatStatus = (value: string) => value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatTimestamp = (value: string) => new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

const formatSessionDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

interface RatingFieldProps {
    label: string;
    value: number;
    onChange: (rating: number) => void;
    helper: string;
    disabled?: boolean;
}

function RatingField({
    label,
    value,
    onChange,
    helper,
    disabled = false,
}: Readonly<RatingFieldProps>) {
    return (
        <div className="feedback-rating-field">
            <div className="feedback-rating-header">
                <label>{label}</label>
                <span>{value > 0 ? `${value}/5` : 'Select a rating'}</span>
            </div>
            <div className="feedback-rating-buttons" role="radiogroup" aria-label={label}>
                {RATING_OPTIONS.map((rating) => {
                    const selected = rating <= value;
                    return (
                        <button
                            key={rating}
                            type="button"
                            className={`feedback-rating-btn ${selected ? 'selected' : ''}`}
                            onClick={() => onChange(rating)}
                            aria-pressed={selected}
                            disabled={disabled}
                        >
                            <Star size={18} fill={selected ? 'currentColor' : 'none'} />
                            <span>{rating}</span>
                        </button>
                    );
                })}
            </div>
            <p className="feedback-field-helper">{helper}</p>
        </div>
    );
}

function FeedbackPageState({
    icon,
    title,
    description,
    isError = false,
}: Readonly<{
    icon: React.ReactNode;
    title: string;
    description: string;
    isError?: boolean;
}>) {
    return (
        <div className={`card feedback-loading-card ${isError ? 'feedback-error-card' : ''}`}>
            {icon}
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

function FeedbackSessionSummary({ dates }: Readonly<{ dates: string[] }>) {
    if (dates.length === 0) {
        return null;
    }

    return (
        <div className="feedback-session-summary">
            <div className="feedback-session-summary-header">
                <CalendarDays size={18} />
                <div>
                    <h4>Attempted session dates</h4>
                    <p>These dates are included in your treatment completion summary.</p>
                </div>
            </div>
            <div className="feedback-session-date-list">
                {dates.map((date) => (
                    <span key={date} className="feedback-session-date-pill">{formatSessionDate(date)}</span>
                ))}
            </div>
        </div>
    );
}

function FeedbackSidebar({
    isInvitationMode,
    activeInvitation,
    attemptedSessionsCount,
    invitationExpiresAt,
    submissions,
}: Readonly<{
    isInvitationMode: boolean;
    activeInvitation: ProgramFeedbackItem | null;
    attemptedSessionsCount: number;
    invitationExpiresAt: string | null;
    submissions: ProgramFeedbackItem[];
}>) {
    if (isInvitationMode) {
        return (
            <div className="feedback-history-list">
                <article className="feedback-history-item invitation">
                    <div className="feedback-history-top">
                        <div>
                            <span className={`feedback-status-badge status-${(activeInvitation?.status || 'invited').toLowerCase()}`}>
                                {formatStatus(activeInvitation?.status || 'INVITED')}
                            </span>
                            {activeInvitation?.invitationSentAt && (
                                <p className="feedback-history-date">Sent {formatTimestamp(activeInvitation.invitationSentAt)}</p>
                            )}
                        </div>
                    </div>
                    <div className="feedback-history-copy">
                        <strong>Completion summary</strong>
                        <p>{attemptedSessionsCount} attempted session{attemptedSessionsCount === 1 ? '' : 's'} recorded for this treatment journey.</p>
                        {invitationExpiresAt && (
                            <>
                                <strong>Invitation expiry</strong>
                                <p>{new Date(invitationExpiresAt).toLocaleString()}</p>
                            </>
                        )}
                    </div>
                </article>
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <div className="feedback-empty-state">
                <MessageSquare size={32} />
                <h4>No feedback submitted yet</h4>
                <p>Your submissions will appear here after you share feedback.</p>
            </div>
        );
    }

    return (
        <div className="feedback-history-list">
            {submissions.map((submission) => (
                <article key={submission.id} className="feedback-history-item">
                    <div className="feedback-history-top">
                        <div>
                            <span className={`feedback-status-badge status-${submission.status.toLowerCase()}`}>
                                {formatStatus(submission.status)}
                            </span>
                            <p className="feedback-history-date">{formatTimestamp(submission.submittedAt || submission.createdAt)}</p>
                        </div>
                        <div className="feedback-mini-ratings">
                            <span>Overall {submission.overallExperienceRating ?? '—'}/5</span>
                            <span>Support {submission.supportRating ?? '—'}/5</span>
                        </div>
                    </div>
                    <div className="feedback-history-copy">
                        <strong>Improvement idea</strong>
                        <p>{submission.improvementSuggestion || '—'}</p>
                        {submission.additionalComments && (
                            <>
                                <strong>Additional comments</strong>
                                <p>{submission.additionalComments}</p>
                            </>
                        )}
                        {submission.adminNotes && (
                            <>
                                <strong>Admin notes</strong>
                                <p>{submission.adminNotes}</p>
                            </>
                        )}
                    </div>
                </article>
            ))}
        </div>
    );
}

export default function ProgramFeedbackPage() {
    const { token } = useParams();
    const isInvitationMode = Boolean(token);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [eligible, setEligible] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [attemptedSessionsCount, setAttemptedSessionsCount] = useState(0);
    const [attemptedSessionDates, setAttemptedSessionDates] = useState<string[]>([]);
    const [invitationExpiresAt, setInvitationExpiresAt] = useState<string | null>(null);
    const [activeInvitation, setActiveInvitation] = useState<ProgramFeedbackItem | null>(null);
    const [submissions, setSubmissions] = useState<ProgramFeedbackItem[]>([]);
    const [form, setForm] = useState<CreateProgramFeedbackInput>({
        overallExperienceRating: 0,
        supportRating: 0,
        improvementSuggestion: '',
        additionalComments: '',
    });

    const resetForm = () => setForm({
        overallExperienceRating: 0,
        supportRating: 0,
        improvementSuggestion: '',
        additionalComments: '',
    });

    const pageClassName = `program-feedback-page ${isInvitationMode ? '' : 'page-content'}`.trim();

    const applyInvitationOverview = async (feedbackToken: string) => {
        const overview = await programFeedbackApi.getInvitationOverview(feedbackToken);
        setEligible(overview.eligible);
        setAlreadySubmitted(overview.alreadySubmitted);
        setAttemptedSessionsCount(overview.attemptedSessionsCount);
        setAttemptedSessionDates(overview.attemptedSessionDates);
        setInvitationExpiresAt(overview.invitationExpiresAt);
        setActiveInvitation(overview.feedback);
        setSubmissions([]);
    };

    const applyAuthenticatedOverview = async () => {
        const overview = await programFeedbackApi.getMyOverview();
        setEligible(overview.eligible);
        setAlreadySubmitted(false);
        setAttemptedSessionsCount(overview.attemptedSessionsCount);
        setAttemptedSessionDates(overview.attemptedSessionDates);
        setInvitationExpiresAt(overview.activeInvitation?.invitationExpiresAt || null);
        setActiveInvitation(overview.activeInvitation || null);
        setSubmissions(overview.submissions);
    };

    const loadOverview = async () => {
        setIsLoading(true);
        setLoadError(null);

        try {
            if (token) {
                await applyInvitationOverview(token);
            } else {
                await applyAuthenticatedOverview();
            }
        } catch (error: any) {
            console.error('Failed to load feedback overview', error);
            setLoadError(error.response?.data?.message || 'Unable to load this feedback experience right now.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
    }, [token]);

    const canSubmit = useMemo(() => (
        eligible
        && !alreadySubmitted
        && form.overallExperienceRating > 0
        && form.supportRating > 0
        && form.improvementSuggestion.trim().length > 0
        && !isSubmitting
    ), [alreadySubmitted, eligible, form, isSubmitting]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            const payload = {
                overallExperienceRating: form.overallExperienceRating,
                supportRating: form.supportRating,
                improvementSuggestion: form.improvementSuggestion.trim(),
                additionalComments: form.additionalComments?.trim() || '',
            };

            if (token) {
                await programFeedbackApi.submitInvitationFeedback(token, payload);
            } else {
                await programFeedbackApi.createFeedback(payload);
            }

            toast.success('Thank you — your feedback has been submitted.');
            resetForm();
            await loadOverview();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Unable to submit feedback');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className={pageClassName}>
                <FeedbackPageState
                    icon={<div className="spinner spinner-dark" />}
                    title="Loading feedback experience…"
                    description="Please wait while we prepare your treatment feedback view."
                />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className={pageClassName}>
                <FeedbackPageState
                    icon={<MailCheck size={30} />}
                    title="Feedback link unavailable"
                    description={loadError}
                    isError
                />
            </div>
        );
    }

    const heroBadge = isInvitationMode ? 'Treatment completion feedback' : 'Program feedback';
    const heroTitle = isInvitationMode ? 'Share your end-of-treatment feedback' : 'Help us improve the program for future participants';
    const heroDescription = isInvitationMode
        ? 'This secure feedback form is tied to your treatment completion. Please reflect on your full care journey.'
        : 'Your feedback is reviewed by program administrators and becomes available after successful completion.';
    const sidebarTitle = isInvitationMode ? 'Invitation summary' : 'Your previous submissions';
    const sidebarDescription = isInvitationMode
        ? 'This secure invitation is tied to your treatment completion feedback.'
        : 'Track what you have already shared with the admin team.';
    const showLockedState = !eligible && !alreadySubmitted;
    const lockedMessage = isInvitationMode
        ? 'This invitation is no longer active. Please contact your care team if you need a new feedback link.'
        : 'Your program feedback form becomes available after your treatment is marked Successful Completion and an invitation email is sent.';

    return (
        <div className={pageClassName}>
            <div className="feedback-hero card">
                <div>
                    <div className="feedback-hero-badge">
                        <Sparkles size={14} />
                        {heroBadge}
                    </div>
                    <h2>{heroTitle}</h2>
                    <p>{heroDescription}</p>
                </div>
                <div className="feedback-hero-stats">
                    <div className="feedback-hero-stat">
                        <span>Attempted sessions</span>
                        <strong>{attemptedSessionsCount}</strong>
                    </div>
                    {invitationExpiresAt && (
                        <div className="feedback-hero-stat compact">
                            <span>Link valid until</span>
                            <strong>{new Date(invitationExpiresAt).toLocaleDateString()}</strong>
                        </div>
                    )}
                </div>
            </div>

            <div className="feedback-grid">
                <section className="card feedback-form-card">
                    <div className="feedback-section-header">
                        <div>
                            <h3>Share your experience</h3>
                            <p>One cumulative reflection across your treatment journey — not feedback for a specific session.</p>
                        </div>
                    </div>

                    <FeedbackSessionSummary dates={attemptedSessionDates} />

                    {showLockedState && (
                        <div className="feedback-disabled-state">
                            <div className="feedback-disabled-icon">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h4>Feedback is not available yet</h4>
                                <p>{lockedMessage}</p>
                            </div>
                        </div>
                    )}

                    {alreadySubmitted && (
                        <div className="feedback-success-state">
                            <div className="feedback-disabled-icon success">
                                <MailCheck size={20} />
                            </div>
                            <div>
                                <h4>Feedback already received</h4>
                                <p>Thank you — this treatment completion feedback has already been submitted.</p>
                            </div>
                        </div>
                    )}

                    <form className="feedback-form" onSubmit={handleSubmit}>
                        <RatingField
                            label="How would you rate your overall experience in the program?"
                            value={form.overallExperienceRating}
                            onChange={(rating) => setForm((current) => ({ ...current, overallExperienceRating: rating }))}
                            helper="1 = poor experience, 5 = excellent experience"
                            disabled={!eligible || alreadySubmitted || isSubmitting}
                        />

                        <RatingField
                            label="Did you feel supported throughout your group and individual therapy sessions?"
                            value={form.supportRating}
                            onChange={(rating) => setForm((current) => ({ ...current, supportRating: rating }))}
                            helper="Think about the overall support you felt across the full treatment process"
                            disabled={!eligible || alreadySubmitted || isSubmitting}
                        />

                        <div className="feedback-text-field">
                            <label htmlFor="feedback-improvement">What is one thing we could improve for future participants?</label>
                            <textarea
                                id="feedback-improvement"
                                value={form.improvementSuggestion}
                                onChange={(event) => setForm((current) => ({ ...current, improvementSuggestion: event.target.value }))}
                                placeholder="Share one practical improvement idea that would make the program better for future participants."
                                rows={5}
                                disabled={!eligible || alreadySubmitted || isSubmitting}
                                required
                            />
                        </div>

                        <div className="feedback-text-field">
                            <label htmlFor="feedback-comments">Is there anything else you would like us to know about your treatment experience? <span>(optional)</span></label>
                            <textarea
                                id="feedback-comments"
                                value={form.additionalComments || ''}
                                onChange={(event) => setForm((current) => ({ ...current, additionalComments: event.target.value }))}
                                placeholder="You can add any additional comments here."
                                rows={4}
                                disabled={!eligible || alreadySubmitted || isSubmitting}
                            />
                        </div>

                        <div className="feedback-submit-row">
                            <p>
                                This form is intended for program quality improvement. For urgent support needs, please contact your care team directly.
                            </p>
                            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                                {isSubmitting ? <span className="spinner" /> : <Send size={16} />}
                                {isSubmitting ? 'Submitting…' : 'Submit Feedback'}
                            </button>
                        </div>
                    </form>
                </section>

                <aside className="card feedback-history-card">
                    <div className="feedback-section-header compact">
                        <div>
                            <h3>{sidebarTitle}</h3>
                            <p>{sidebarDescription}</p>
                        </div>
                    </div>
                    <FeedbackSidebar
                        isInvitationMode={isInvitationMode}
                        activeInvitation={activeInvitation}
                        attemptedSessionsCount={attemptedSessionsCount}
                        invitationExpiresAt={invitationExpiresAt}
                        submissions={submissions}
                    />
                </aside>
            </div>
        </div>
    );
}
