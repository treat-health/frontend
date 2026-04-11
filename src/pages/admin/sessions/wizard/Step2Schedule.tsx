import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUnifiedSessionStore, type CustomDateParam, type RecurrenceConfig } from './useUnifiedSessionStore';
import api, { type ApiResponse } from '../../../../lib/api';
import type { UserSummary } from '../types';
import { toast } from 'react-hot-toast';
import { Info, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import {
    DEFAULT_SESSION_DURATION_MINS,
    MAX_SESSION_DURATION_MINS,
    MIN_SESSION_DURATION_MINS,
    addMinutesToUtcTime,
    buildUtcDateTimeRange,
    calculateDurationBetweenUtcTimes,
    formatIsoDateToUs,
    formatLiveTimeInZone,
    formatTimeRangeInZone,
    getAdminLocalTimezone,
    normalizeUsDateInput,
    parseUsDateToIso,
    resolveParticipantTimezone,
} from './sessionWizardUtils';
import {
    buildAvailabilityPreview,
    deriveTimezoneFromState,
    mapUtcAvailabilityTemplateToLocalSchedule,
    type AvailabilityDayName,
} from '../../../settings/availabilityTimezoneUtils';

type TimezonePreviewProps = Readonly<{
    title: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    clientTimezone: string;
    adminLocalTimezone: string;
}>;

type LiveClockRowProps = Readonly<{
    emoji: string;
    label: string;
    date: string;
    time: string;
    abbreviation: string;
    primary?: boolean;
}>;

type UsDateInputProps = Readonly<{
    id: string;
    label: string;
    value?: string | null;
    onCommit: (value: string) => void;
    required?: boolean;
    compact?: boolean;
}>;

type TherapistAvailabilityTemplateDay = {
    dayOfWeek: AvailabilityDayName;
    windows: Array<{
        id?: string;
        startTime: string;
        endTime: string;
    }>;
};

type SlotIssue = {
    code: string;
    message: string;
};

type SuggestedSlot = {
    startTime: string;
    endTime: string;
    available: boolean;
    reasons: SlotIssue[];
};

type TherapistSummary = Pick<UserSummary, 'id' | 'firstName' | 'lastName' | 'state' | 'timezone'>;

type WeeklyRecurringSlotSample = {
    isoDay: number;
    date: string;
    slots: SuggestedSlot[];
};

type SlotPickerCardProps = Readonly<{
    title: string;
    subtitle?: string;
    date?: string;
    slots: SuggestedSlot[];
    therapistTimezone: string;
    adminTimezone: string;
    selectedSlotKey?: string;
    onSelectSlot?: (slot: SuggestedSlot) => void;
    emptyMessage: string;
    loading?: boolean;
    infoTone?: 'default' | 'muted';
}>;

type WeeklyAvailabilityRowsProps = Readonly<{
    days: ReturnType<typeof mapUtcAvailabilityTemplateToLocalSchedule>;
    therapistTimezone: string;
    adminLocalTimezone: string;
}>;

const ISO_DAY_TO_SHORT_LABEL: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
};

const DAY_NAME_TO_SHORT_LABEL: Record<AvailabilityDayName, string> = {
    MONDAY: 'Mon',
    TUESDAY: 'Tue',
    WEDNESDAY: 'Wed',
    THURSDAY: 'Thu',
    FRIDAY: 'Fri',
    SATURDAY: 'Sat',
    SUNDAY: 'Sun',
};

const formatClockLabel = (time: string) => {
    const [hourText, minuteText] = time.split(':');
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return time;
    }

    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${minute.toString().padStart(2, '0')} ${suffix}`;
};

const formatWindowRangeLabel = (startTime: string, endTime: string) => `${formatClockLabel(startTime)} – ${formatClockLabel(endTime)}`;

const getNextIsoWeekdayDate = (startDate: string, isoDay: number) => {
    const anchor = new Date(`${startDate}T00:00:00Z`);
    if (Number.isNaN(anchor.getTime())) {
        return null;
    }

    const currentIsoDay = ((anchor.getUTCDay() + 6) % 7) + 1;
    const delta = (isoDay - currentIsoDay + 7) % 7;
    anchor.setUTCDate(anchor.getUTCDate() + delta);
    return anchor.toISOString().split('T')[0];
};

const formatIsoDateLabel = (isoDate: string, timeZone: string) => {
    const date = new Date(`${isoDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }

    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const isValidDuration = (durationMins: number | null) => (
    durationMins !== null
    && durationMins >= MIN_SESSION_DURATION_MINS
    && durationMins <= MAX_SESSION_DURATION_MINS
);

function UsDateInput({ id, label, value, onCommit, required = false, compact = false }: UsDateInputProps) {
    const [displayValue, setDisplayValue] = useState(() => formatIsoDateToUs(value));

    useEffect(() => {
        setDisplayValue(formatIsoDateToUs(value));
    }, [value]);

    const commitValue = () => {
        if (displayValue.trim() === '') {
            if (!required) {
                onCommit('');
            }
            return;
        }

        const parsed = parseUsDateToIso(displayValue);
        if (!parsed) {
            toast.error(`${label} must use MM/DD/YYYY`);
            setDisplayValue(formatIsoDateToUs(value));
            return;
        }

        onCommit(parsed);
        setDisplayValue(formatIsoDateToUs(parsed));
    };

    return (
        <>
            <label htmlFor={id} className="wizard-label" style={{display: 'block', marginBottom: compact ? 4 : 8, fontSize: compact ? 12 : 13, fontWeight: 600, color: 'var(--gray-800)'}}>{label}</label>
            <input
                id={id}
                type="text"
                inputMode="numeric"
                className="wizard-input"
                placeholder="MM/DD/YYYY"
                value={displayValue}
                onChange={event => setDisplayValue(normalizeUsDateInput(event.target.value))}
                onBlur={commitValue}
                maxLength={10}
                title="Enter date in MM/DD/YYYY format"
            />
        </>
    );
}

function LiveClockRow({ emoji, label, date, time, abbreviation, primary = false }: LiveClockRowProps) {
    const labelWithTimezone = abbreviation === '—' ? label : `${label} (${abbreviation})`;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: primary ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid var(--gray-200)',
            background: primary ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ fontSize: 18 }}>{emoji}</span>
                <div>
                    <div style={{ fontSize: 13, fontWeight: primary ? 700 : 600, color: primary ? 'var(--primary-color)' : 'var(--gray-800)' }}>
                        {labelWithTimezone}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{date}</div>
                </div>
            </div>
            <div style={{ fontSize: primary ? 18 : 15, fontWeight: primary ? 700 : 600, color: 'var(--gray-900)', whiteSpace: 'nowrap' }}>
                {time}
            </div>
        </div>
    );
}

function LiveTimePreview({ clientTimezone, adminLocalTimezone }: Readonly<{ clientTimezone: string; adminLocalTimezone: string }>) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const intervalId = globalThis.setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => globalThis.clearInterval(intervalId);
    }, []);

    const clientNow = formatLiveTimeInZone(now, clientTimezone);
    const utcNow = formatLiveTimeInZone(now, 'UTC');
    const adminNow = formatLiveTimeInZone(now, adminLocalTimezone);

    return (
        <div style={{ marginBottom: 24, borderRadius: 14, border: '1px solid var(--gray-200)', background: 'linear-gradient(180deg, var(--gray-50) 0%, var(--bg-surface) 100%)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>Live Time Preview</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>Read-only current time context for the client, UTC, and your local timezone.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
                    <Info size={14} />
                    <span title="These live clocks are informational only and do not change the selected session time.">Live only — does not affect session time</span>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                <LiveClockRow
                    emoji="🟢"
                    label="Client Time"
                    date={clientNow.date}
                    time={clientNow.time}
                    abbreviation={clientNow.abbreviation}
                    primary
                />
                <LiveClockRow
                    emoji="🌐"
                    label="UTC Time"
                    date={utcNow.date}
                    time={utcNow.time}
                    abbreviation={utcNow.abbreviation}
                />
                <LiveClockRow
                    emoji="🧑‍💻"
                    label="Your Time"
                    date={adminNow.date}
                    time={adminNow.time}
                    abbreviation={adminNow.abbreviation}
                />
            </div>
        </div>
    );
}

function TimezonePreview({
    title,
    date,
    startTime,
    endTime,
    clientTimezone,
    adminLocalTimezone,
}: TimezonePreviewProps) {
    const range = buildUtcDateTimeRange(date, startTime, endTime);
    const clientDisplay = formatTimeRangeInZone(range.startDateTime, range.endDateTime, clientTimezone);
    const utcDisplay = formatTimeRangeInZone(range.startDateTime, range.endDateTime, 'UTC');
    const adminDisplay = formatTimeRangeInZone(range.startDateTime, range.endDateTime, adminLocalTimezone);

    return (
        <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid var(--gray-200)', background: 'var(--gray-50)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
                    <Info size={14} />
                    <span title="Session time is stored in UTC. Other rows below are display-only conversions.">Display-only timezone conversion</span>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ borderRadius: 10, background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.18)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-color)', marginBottom: 4 }}>Session Time (Client)</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>
                        {clientDisplay.range} <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>({clientDisplay.abbreviation})</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                        {clientDisplay.date}{clientDisplay.endsNextDay ? ' • Ends next day' : ''}{range.durationMins ? ` • ${range.durationMins} mins` : ''}
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, color: 'var(--gray-700)' }}>
                        <span style={{ fontWeight: 600 }}>UTC Time</span>
                        <span>{utcDisplay.range} <span style={{ color: 'var(--gray-500)' }}>({utcDisplay.abbreviation})</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, color: 'var(--gray-500)' }}>
                        <span>UTC Date</span>
                        <span>{utcDisplay.date}{utcDisplay.endsNextDay ? ' • Ends next day' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, color: 'var(--gray-700)' }}>
                        <span style={{ fontWeight: 600 }}>Admin Local Time</span>
                        <span>{adminDisplay.range} <span style={{ color: 'var(--gray-500)' }}>({adminDisplay.abbreviation})</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, color: 'var(--gray-500)' }}>
                        <span>Local Date</span>
                        <span>{adminDisplay.date}{adminDisplay.endsNextDay ? ' • Ends next day' : ''}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DurationReadout({ startTime, endTime }: Readonly<{ startTime: string; endTime: string }>) {
    const duration = calculateDurationBetweenUtcTimes(startTime, endTime);

    if (duration.durationMins === null) {
        return <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Duration: —</div>;
    }

    const isSameTime = duration.durationMins === 0;
    const isTooShort = duration.durationMins < MIN_SESSION_DURATION_MINS;
    const isTooLong = duration.durationMins > MAX_SESSION_DURATION_MINS;
    const tone = isSameTime || isTooShort || isTooLong ? 'var(--error-500)' : 'var(--gray-800)';

    let helper = 'Duration is calculated automatically.';
    if (duration.crossesMidnight && !isSameTime) helper = 'Ends on the next UTC day.';
    if (isSameTime) helper = 'End time must be different from start time.';
    if (isTooShort) helper = `Minimum duration is ${MIN_SESSION_DURATION_MINS} minutes.`;
    if (isTooLong) helper = `Maximum duration is ${MAX_SESSION_DURATION_MINS} minutes.`;

    return (
        <div style={{ padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: 'var(--gray-50)', minHeight: 44 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tone }}>
                Duration: {duration.durationMins} minutes
            </div>
            <div style={{ fontSize: 12, color: isSameTime || isTooShort || isTooLong ? 'var(--error-500)' : 'var(--gray-500)', marginTop: 4 }}>
                {helper}
            </div>
        </div>
    );
}

function SlotPickerCard({
    title,
    subtitle,
    date,
    slots,
    therapistTimezone,
    adminTimezone,
    selectedSlotKey,
    onSelectSlot,
    emptyMessage,
    loading = false,
    infoTone = 'default',
}: SlotPickerCardProps) {
    let body: ReactNode;

    if (loading) {
        body = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-600)', fontSize: 13, padding: '6px 0' }}>
                <Loader2 className="spin" size={16} />
                <span>Loading bookable slots...</span>
            </div>
        );
    } else if (slots.length === 0) {
        body = <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '6px 0' }}>{emptyMessage}</div>;
    } else {
        body = (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                {slots.map((slot) => {
                    const range = buildUtcDateTimeRange(date, slot.startTime, slot.endTime);
                    const therapistDisplay = formatTimeRangeInZone(range.startDateTime, range.endDateTime, therapistTimezone);
                    const adminDisplay = formatTimeRangeInZone(range.startDateTime, range.endDateTime, adminTimezone);
                    const slotKey = `${slot.startTime}-${slot.endTime}`;
                    const selected = selectedSlotKey === slotKey;
                    const actionable = typeof onSelectSlot === 'function';

                    return (
                        <button
                            key={`${date ?? 'na'}-${slotKey}`}
                            type="button"
                            onClick={() => onSelectSlot?.(slot)}
                            disabled={!actionable}
                            style={{
                                textAlign: 'left',
                                borderRadius: 12,
                                border: selected ? '1px solid rgba(37, 99, 235, 0.55)' : '1px solid var(--gray-200)',
                                background: selected ? 'rgba(37, 99, 235, 0.08)' : 'var(--gray-50)',
                                padding: 12,
                                cursor: actionable ? 'pointer' : 'default',
                                boxShadow: selected ? '0 0 0 3px rgba(37, 99, 235, 0.08)' : 'none',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--primary-color)' : 'var(--gray-900)' }}>
                                {therapistDisplay.range}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                                Therapist time ({therapistDisplay.abbreviation})
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                                Your time: {adminDisplay.range} ({adminDisplay.abbreviation})
                            </div>
                            {selected ? (
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-color)', marginTop: 8 }}>Selected for this schedule</div>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid var(--gray-200)', background: 'var(--bg-surface)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>{title}</div>
                    {subtitle ? (
                        <div style={{ fontSize: 12, color: infoTone === 'muted' ? 'var(--gray-500)' : 'var(--gray-600)', marginTop: 4 }}>{subtitle}</div>
                    ) : null}
                </div>
                {date ? (
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{date}</div>
                ) : null}
            </div>

            {body}
        </div>
    );
}

function WeeklyAvailabilityRows({ days, therapistTimezone, adminLocalTimezone }: WeeklyAvailabilityRowsProps) {
    const [expandedDays, setExpandedDays] = useState<Partial<Record<AvailabilityDayName, boolean>>>({});

    const toggleExpandedDay = (dayOfWeek: AvailabilityDayName) => {
        setExpandedDays((current) => ({
            ...current,
            [dayOfWeek]: !current[dayOfWeek],
        }));
    };

    return (
        <div className="therapist-weekly-rows">
            <div className="therapist-weekly-rows-header">
                <span>Compact weekly overview — first 2 windows per day are shown by default.</span>
                <span>Primary time zone: {therapistTimezone}</span>
            </div>

            {days.map((day) => {
                const expanded = Boolean(expandedDays[day.dayOfWeek]);
                const visibleWindows = expanded ? day.windows : day.windows.slice(0, 2);
                const hiddenCount = Math.max(0, day.windows.length - visibleWindows.length);
                let statusLabel = 'Unavailable';
                if (day.windows.length > 0) {
                    statusLabel = `${day.windows.length} window`;
                    if (day.windows.length !== 1) {
                        statusLabel += 's';
                    }
                }

                return (
                    <div key={day.dayOfWeek} className="therapist-weekly-row">
                        <div className="therapist-weekly-row-layout">
                            <div className="therapist-weekly-row-day">
                                <div className="therapist-weekly-row-label">{DAY_NAME_TO_SHORT_LABEL[day.dayOfWeek]}</div>
                                <div className={`therapist-weekly-row-status ${day.windows.length === 0 ? 'is-empty' : ''}`}>
                                    {statusLabel}
                                </div>
                            </div>

                            <div className="therapist-weekly-row-content">
                                {day.windows.length === 0 ? (
                                    <div className="therapist-weekly-row-empty">No availability set for this day.</div>
                                ) : (
                                    <>
                                        <div className="therapist-weekly-row-chips">
                                            {visibleWindows.map((window) => {
                                                const adminPreview = buildAvailabilityPreview(day.dayOfWeek, window, therapistTimezone, adminLocalTimezone);
                                                const localPreviewLabel = adminPreview
                                                    ? `${adminPreview.dayLabel} • ${adminPreview.rangeLabel}`
                                                    : null;

                                                return (
                                                    <div
                                                        key={window.id ?? window.localId}
                                                        title={localPreviewLabel ? `Your local time: ${localPreviewLabel}` : undefined}
                                                        className={`therapist-weekly-window-chip ${expanded ? 'is-expanded' : ''}`}
                                                    >
                                                        <div className="therapist-weekly-window-chip-time">
                                                            {formatWindowRangeLabel(window.startTime, window.endTime)}
                                                        </div>
                                                        <div className="therapist-weekly-window-chip-label">Therapist time</div>
                                                        {expanded && localPreviewLabel ? (
                                                            <div className="therapist-weekly-window-chip-local">
                                                                Your time: {localPreviewLabel}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}

                                            {hiddenCount > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpandedDay(day.dayOfWeek)}
                                                    className="therapist-weekly-toggle therapist-weekly-toggle-more"
                                                >
                                                    +{hiddenCount} more
                                                </button>
                                            ) : null}

                                            {expanded && day.windows.length > 2 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpandedDay(day.dayOfWeek)}
                                                    className="therapist-weekly-toggle"
                                                >
                                                    Show less
                                                </button>
                                            ) : null}
                                        </div>

                                        {expanded ? null : (
                                            <div className="therapist-weekly-row-hint">
                                                Showing therapist-local windows. Expand a busy day to also see your local-time conversion.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function useSelectedTherapistAvailability(therapistId: string | null) {
    const [selectedTherapist, setSelectedTherapist] = useState<TherapistSummary | null>(null);
    const [weeklyTemplate, setWeeklyTemplate] = useState<TherapistAvailabilityTemplateDay[]>([]);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [templateError, setTemplateError] = useState<string | null>(null);

    useEffect(() => {
        if (!therapistId) {
            setSelectedTherapist(null);
            setWeeklyTemplate([]);
            setTemplateError(null);
            setTemplateLoading(false);
            return;
        }

        let active = true;

        const fetchTherapistAvailability = async () => {
            setTemplateLoading(true);
            setTemplateError(null);

            try {
                const [therapistResponse, templateResponse] = await Promise.all([
                    api.get<ApiResponse<TherapistSummary>>(`/users/${therapistId}`),
                    api.get<ApiResponse<TherapistAvailabilityTemplateDay[]>>(`/scheduling/availability/template/${therapistId}`),
                ]);

                if (!active) {
                    return;
                }

                setSelectedTherapist(therapistResponse.data.data ?? null);
                setWeeklyTemplate(templateResponse.data.data ?? []);
            } catch (error) {
                if (!active) {
                    return;
                }

                console.error('Failed to load therapist availability for wizard', error);
                setSelectedTherapist(null);
                setWeeklyTemplate([]);
                setTemplateError('Unable to load the selected therapist\'s weekly availability right now.');
            } finally {
                if (active) {
                    setTemplateLoading(false);
                }
            }
        };

        void fetchTherapistAvailability();

        return () => {
            active = false;
        };
    }, [therapistId]);

    return {
        selectedTherapist,
        weeklyTemplate,
        templateLoading,
        templateError,
    };
}

function useCustomDateSlotOptions(params: {
    mode: string;
    therapistId: string | null;
    customDates: CustomDateParam[];
    clientIds: string[];
}) {
    const { mode, therapistId, customDates, clientIds } = params;
    const [customDateSlots, setCustomDateSlots] = useState<Record<string, SuggestedSlot[]>>({});
    const [customSlotsLoading, setCustomSlotsLoading] = useState(false);
    const [customSlotsError, setCustomSlotsError] = useState<string | null>(null);

    useEffect(() => {
        if (mode !== 'CUSTOM_DATES' || !therapistId) {
            setCustomDateSlots({});
            setCustomSlotsLoading(false);
            setCustomSlotsError(null);
            return;
        }

        const requestTargets = customDates
            .map((customDate) => {
                const durationMins = calculateDurationBetweenUtcTimes(customDate.startTime, customDate.endTime).durationMins;
                if (!customDate.date || !isValidDuration(durationMins)) {
                    return null;
                }

                return {
                    id: customDate.id,
                    date: customDate.date,
                    durationMins,
                };
            })
            .filter(Boolean) as Array<{ id: string; date: string; durationMins: number }>;

        if (requestTargets.length === 0) {
            setCustomDateSlots({});
            setCustomSlotsLoading(false);
            setCustomSlotsError(null);
            return;
        }

        let active = true;

        const fetchCustomDateSlots = async () => {
            setCustomSlotsLoading(true);
            setCustomSlotsError(null);

            try {
                const results = await Promise.all(requestTargets.map(async (target) => {
                    const response = await api.get<ApiResponse<SuggestedSlot[]>>('/scheduling/slots', {
                        params: {
                            therapistId,
                            date: target.date,
                            durationMins: target.durationMins,
                            clientIds,
                        },
                    });

                    return {
                        id: target.id,
                        slots: response.data.data ?? [],
                    };
                }));

                if (!active) {
                    return;
                }

                setCustomDateSlots(Object.fromEntries(results.map((result) => [result.id, result.slots])));
            } catch (error) {
                if (!active) {
                    return;
                }

                console.error('Failed to load custom-date bookable slots', error);
                setCustomDateSlots({});
                setCustomSlotsError('Unable to load bookable slots for the selected custom dates.');
            } finally {
                if (active) {
                    setCustomSlotsLoading(false);
                }
            }
        };

        void fetchCustomDateSlots();

        return () => {
            active = false;
        };
    }, [clientIds, customDates, mode, therapistId]);

    return {
        customDateSlots,
        customSlotsLoading,
        customSlotsError,
    };
}

function useRecurringSlotOptions(params: {
    mode: string;
    therapistId: string | null;
    recurrenceConfig: RecurrenceConfig;
    clientIds: string[];
}) {
    const { mode, therapistId, recurrenceConfig, clientIds } = params;
    const [weeklyRecurringSlotSamples, setWeeklyRecurringSlotSamples] = useState<WeeklyRecurringSlotSample[]>([]);
    const [monthlyRecurringSlots, setMonthlyRecurringSlots] = useState<SuggestedSlot[]>([]);
    const [recurringSlotsLoading, setRecurringSlotsLoading] = useState(false);
    const [recurringSlotsError, setRecurringSlotsError] = useState<string | null>(null);

    useEffect(() => {
        if (mode !== 'RECURRING' || !therapistId) {
            setWeeklyRecurringSlotSamples([]);
            setMonthlyRecurringSlots([]);
            setRecurringSlotsLoading(false);
            setRecurringSlotsError(null);
            return;
        }

        const recurringDuration = calculateDurationBetweenUtcTimes(recurrenceConfig.startTime, recurrenceConfig.endTime).durationMins;
        if (!recurrenceConfig.startDate || !isValidDuration(recurringDuration)) {
            setWeeklyRecurringSlotSamples([]);
            setMonthlyRecurringSlots([]);
            setRecurringSlotsLoading(false);
            setRecurringSlotsError(null);
            return;
        }

        let active = true;

        const fetchRecurringSlots = async () => {
            setRecurringSlotsLoading(true);
            setRecurringSlotsError(null);

            try {
                if (recurrenceConfig.recurrenceType === 'WEEKLY') {
                    const selectedDays = [...recurrenceConfig.weeklyDays].sort((left, right) => left - right);
                    if (selectedDays.length === 0) {
                        setWeeklyRecurringSlotSamples([]);
                        setMonthlyRecurringSlots([]);
                        return;
                    }

                    const results = await Promise.all(selectedDays.map(async (isoDay) => {
                        const date = getNextIsoWeekdayDate(recurrenceConfig.startDate, isoDay);
                        if (!date) {
                            return null;
                        }

                        const response = await api.get<ApiResponse<SuggestedSlot[]>>('/scheduling/slots', {
                            params: {
                                therapistId,
                                date,
                                durationMins: recurringDuration,
                                clientIds,
                            },
                        });

                        return {
                            isoDay,
                            date,
                            slots: response.data.data ?? [],
                        } satisfies WeeklyRecurringSlotSample;
                    }));

                    if (!active) {
                        return;
                    }

                    setWeeklyRecurringSlotSamples(results.filter(Boolean) as WeeklyRecurringSlotSample[]);
                    setMonthlyRecurringSlots([]);
                    return;
                }

                const response = await api.get<ApiResponse<SuggestedSlot[]>>('/scheduling/slots', {
                    params: {
                        therapistId,
                        date: recurrenceConfig.startDate,
                        durationMins: recurringDuration,
                        clientIds,
                    },
                });

                if (!active) {
                    return;
                }

                setMonthlyRecurringSlots(response.data.data ?? []);
                setWeeklyRecurringSlotSamples([]);
            } catch (error) {
                if (!active) {
                    return;
                }

                console.error('Failed to load recurring bookable slots', error);
                setWeeklyRecurringSlotSamples([]);
                setMonthlyRecurringSlots([]);
                setRecurringSlotsError('Unable to load bookable slots for the current recurrence settings.');
            } finally {
                if (active) {
                    setRecurringSlotsLoading(false);
                }
            }
        };

        void fetchRecurringSlots();

        return () => {
            active = false;
        };
    }, [clientIds, mode, recurrenceConfig, therapistId]);

    return {
        weeklyRecurringSlotSamples,
        monthlyRecurringSlots,
        recurringSlotsLoading,
        recurringSlotsError,
    };
}

export default function Step2Schedule() {
    const {
        mode,
        setMode,
        customDates,
        addCustomDate,
        removeCustomDate,
        updateCustomDate,
        recurrenceConfig,
        updateRecurrence,
        selectedState,
        participantTimezone,
        therapistId,
        clientIds,
        setScheduleRulesValidation,
    } = useUnifiedSessionStore();

    const clientTimezone = resolveParticipantTimezone(selectedState, participantTimezone);
    const adminLocalTimezone = getAdminLocalTimezone();
    const [isWeeklyTemplateExpanded, setIsWeeklyTemplateExpanded] = useState(false);
    const [weeklyTemplateContentHeight, setWeeklyTemplateContentHeight] = useState(0);
    const weeklyTemplateContentRef = useRef<HTMLDivElement | null>(null);

    const {
        selectedTherapist,
        weeklyTemplate,
        templateLoading,
        templateError,
    } = useSelectedTherapistAvailability(therapistId);

    const {
        customDateSlots,
        customSlotsLoading,
        customSlotsError,
    } = useCustomDateSlotOptions({
        mode,
        therapistId,
        customDates,
        clientIds,
    });

    const {
        weeklyRecurringSlotSamples,
        monthlyRecurringSlots,
        recurringSlotsLoading,
        recurringSlotsError,
    } = useRecurringSlotOptions({
        mode,
        therapistId,
        recurrenceConfig,
        clientIds,
    });

    const therapistTimezone = selectedTherapist?.timezone || deriveTimezoneFromState(selectedTherapist?.state) || 'UTC';
    const therapistDisplayName = selectedTherapist
        ? `${selectedTherapist.firstName} ${selectedTherapist.lastName}`.trim()
        : 'Selected therapist';

    const localizedWeeklyTemplate = useMemo(
        () => mapUtcAvailabilityTemplateToLocalSchedule(weeklyTemplate, therapistTimezone),
        [weeklyTemplate, therapistTimezone],
    );

    const commonWeeklyRecurringSlots = useMemo(() => {
        if (recurrenceConfig.recurrenceType !== 'WEEKLY' || weeklyRecurringSlotSamples.length === 0) {
            return [] as SuggestedSlot[];
        }

        const slotGroups = weeklyRecurringSlotSamples.map((sample) => new Set(sample.slots.map((slot) => `${slot.startTime}-${slot.endTime}`)));
        const commonKeys = new Set(weeklyRecurringSlotSamples[0].slots
            .map((slot) => `${slot.startTime}-${slot.endTime}`)
            .filter((slotKey) => slotGroups.every((group) => group.has(slotKey))));

        return weeklyRecurringSlotSamples[0].slots.filter((slot) => commonKeys.has(`${slot.startTime}-${slot.endTime}`));
    }, [recurrenceConfig.recurrenceType, weeklyRecurringSlotSamples]);

    const syncCustomTimeRange = (id: string, field: 'startTime' | 'endTime', nextValue: string) => {
        const current = customDates.find(item => item.id === id);
        if (!current) return;

        if (field === 'startTime') {
            const currentDuration = calculateDurationBetweenUtcTimes(current.startTime, current.endTime).durationMins;
            const durationToPreserve = currentDuration && currentDuration > 0 ? currentDuration : DEFAULT_SESSION_DURATION_MINS;
            updateCustomDate(id, 'startTime', nextValue);
            updateCustomDate(id, 'endTime', addMinutesToUtcTime(nextValue, durationToPreserve));
            return;
        }

        updateCustomDate(id, 'endTime', nextValue);
    };

    const syncRecurringTimeRange = (field: 'startTime' | 'endTime', nextValue: string) => {
        if (field === 'startTime') {
            const currentDuration = calculateDurationBetweenUtcTimes(recurrenceConfig.startTime, recurrenceConfig.endTime).durationMins;
            const durationToPreserve = currentDuration && currentDuration > 0 ? currentDuration : DEFAULT_SESSION_DURATION_MINS;
            updateRecurrence({
                startTime: nextValue,
                endTime: addMinutesToUtcTime(nextValue, durationToPreserve),
            });
            return;
        }

        updateRecurrence({ endTime: nextValue });
    };

    const applyCustomSlot = (id: string, slot: SuggestedSlot) => {
        updateCustomDate(id, 'startTime', slot.startTime);
        updateCustomDate(id, 'endTime', slot.endTime);
    };

    const applyRecurringSlot = (slot: SuggestedSlot) => {
        updateRecurrence({
            startTime: slot.startTime,
            endTime: slot.endTime,
        });
    };

    const handleDayToggle = (day: number) => {
        const current = recurrenceConfig.weeklyDays;
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        updateRecurrence({ weeklyDays: next });
    };

    const handleDateToggle = (date: number) => {
        const current = recurrenceConfig.monthlyDates;
        const next = current.includes(date) ? current.filter(d => d !== date) : [...current, date];
        updateRecurrence({ monthlyDates: next });
    };

    let weeklyAvailabilityContent: ReactNode;

    if (therapistId) {
        if (templateLoading) {
            weeklyAvailabilityContent = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-600)', fontSize: 13, padding: '8px 0' }}>
                    <Loader2 className="spin" size={16} />
                    <span>Loading weekly availability...</span>
                </div>
            );
        } else if (templateError) {
            weeklyAvailabilityContent = <div style={{ fontSize: 13, color: 'var(--error-500)', padding: '8px 0' }}>{templateError}</div>;
        } else {
            weeklyAvailabilityContent = (
                <WeeklyAvailabilityRows
                    days={localizedWeeklyTemplate}
                    therapistTimezone={therapistTimezone}
                    adminLocalTimezone={adminLocalTimezone}
                />
            );
        }
    } else {
        weeklyAvailabilityContent = <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '8px 0' }}>Select a therapist in the previous step to load their weekly availability.</div>;
    }

    useEffect(() => {
        if (!weeklyTemplateContentRef.current) {
            return;
        }

        setWeeklyTemplateContentHeight(weeklyTemplateContentRef.current.scrollHeight);
    }, [weeklyAvailabilityContent, isWeeklyTemplateExpanded, localizedWeeklyTemplate, templateLoading, templateError, therapistId]);

    useEffect(() => {
        if (!therapistId) {
            setScheduleRulesValidation({
                isReady: false,
                valid: false,
                message: 'Please select a therapist before defining schedule rules.',
            });
            return;
        }

        if (mode === 'CUSTOM_DATES') {
            if (customSlotsLoading) {
                setScheduleRulesValidation({
                    isReady: false,
                    valid: false,
                    message: 'Checking therapist available slots for the selected dates...',
                });
                return;
            }

            if (customSlotsError) {
                setScheduleRulesValidation({
                    isReady: false,
                    valid: false,
                    message: customSlotsError,
                });
                return;
            }

            const invalidCustomDate = customDates.find((customDate) => {
                if (!customDate.date) {
                    return false;
                }

                const durationMins = calculateDurationBetweenUtcTimes(customDate.startTime, customDate.endTime).durationMins;
                if (!isValidDuration(durationMins)) {
                    return false;
                }

                const slotKey = `${customDate.startTime}-${customDate.endTime}`;
                const availableSlots = customDateSlots[customDate.id] ?? [];
                return !availableSlots.some((slot) => `${slot.startTime}-${slot.endTime}` === slotKey);
            });

            if (invalidCustomDate) {
                setScheduleRulesValidation({
                    isReady: true,
                    valid: false,
                    message: 'Please choose a session time within the therapist\'s available slots for every selected date.',
                });
                return;
            }

            setScheduleRulesValidation({
                isReady: true,
                valid: true,
                message: null,
            });
            return;
        }

        if (recurringSlotsLoading) {
            setScheduleRulesValidation({
                isReady: false,
                valid: false,
                message: 'Checking therapist available slots for the selected recurrence...',
            });
            return;
        }

        if (recurringSlotsError) {
            setScheduleRulesValidation({
                isReady: false,
                valid: false,
                message: recurringSlotsError,
            });
            return;
        }

        const recurringDuration = calculateDurationBetweenUtcTimes(recurrenceConfig.startTime, recurrenceConfig.endTime).durationMins;
        if (!recurrenceConfig.startDate || !isValidDuration(recurringDuration)) {
            setScheduleRulesValidation({
                isReady: false,
                valid: true,
                message: null,
            });
            return;
        }

        const selectedSlotKey = `${recurrenceConfig.startTime}-${recurrenceConfig.endTime}`;

        if (recurrenceConfig.recurrenceType === 'WEEKLY') {
            if (recurrenceConfig.weeklyDays.length === 0) {
                setScheduleRulesValidation({
                    isReady: false,
                    valid: true,
                    message: null,
                });
                return;
            }

            if (commonWeeklyRecurringSlots.length === 0) {
                setScheduleRulesValidation({
                    isReady: true,
                    valid: false,
                    message: 'No common therapist slot is available across the selected weekdays for this duration. Please choose one of the suggested slots.',
                });
                return;
            }

            const selectedSlotMatches = commonWeeklyRecurringSlots.some((slot) => `${slot.startTime}-${slot.endTime}` === selectedSlotKey);
            setScheduleRulesValidation({
                isReady: true,
                valid: selectedSlotMatches,
                message: selectedSlotMatches
                    ? null
                    : 'Please choose a recurring session time from the therapist\'s common available slots for the selected weekdays.',
            });
            return;
        }

        if (recurrenceConfig.monthlyDates.length === 0) {
            setScheduleRulesValidation({
                isReady: false,
                valid: true,
                message: null,
            });
            return;
        }

        const monthlySelectionMatches = monthlyRecurringSlots.some((slot) => `${slot.startTime}-${slot.endTime}` === selectedSlotKey);
        setScheduleRulesValidation({
            isReady: true,
            valid: monthlySelectionMatches,
            message: monthlySelectionMatches
                ? null
                : 'Please choose a recurring session time from the therapist\'s available slots shown for the selected monthly schedule.',
        });
    }, [
        commonWeeklyRecurringSlots,
        customDateSlots,
        customDates,
        customSlotsError,
        customSlotsLoading,
        mode,
        monthlyRecurringSlots,
        recurrenceConfig,
        recurringSlotsError,
        recurringSlotsLoading,
        setScheduleRulesValidation,
        therapistId,
    ]);

    return (
        <div className="wizard-step-content animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <h3 style={{ color: 'var(--gray-900)', margin: 0 }}>Schedule Strategy</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
                    <Info size={14} />
                    <span title="UTC remains the source of truth. Client and admin times are only for display clarity.">UTC is stored; local times are display-only</span>
                </div>
            </div>
            <p style={{marginBottom: 24, color: 'var(--gray-600)'}}>
                Define dates, times, and recurrences. The schedule is saved in UTC and previewed for the selected client state and your browser timezone.
            </p>

            <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} />
                <span>All date fields use the fixed format <strong>MM/DD/YYYY</strong>.</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--primary-50)', color: 'var(--primary-color)', fontWeight: 600, fontSize: 12 }}>
                    State: {selectedState || 'Not selected'}
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                    Client timezone: {clientTimezone}
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                    Admin timezone: {adminLocalTimezone}
                </div>
                <div style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: 12 }}>
                    Therapist timezone: {therapistTimezone}
                </div>
            </div>

            <LiveTimePreview clientTimezone={clientTimezone} adminLocalTimezone={adminLocalTimezone} />

            {!selectedState && (
                <div style={{ marginBottom: 20, borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', padding: 14, fontSize: 13 }}>
                    Select participants from a state in the previous step to unlock the client-time preview.
                </div>
            )}

            <div className="therapist-weekly-panel">
                <button
                    type="button"
                    className={`therapist-weekly-panel-trigger ${isWeeklyTemplateExpanded ? 'is-expanded' : ''}`}
                    onClick={() => setIsWeeklyTemplateExpanded((current) => !current)}
                    aria-expanded={isWeeklyTemplateExpanded}
                >
                    <div className="therapist-weekly-panel-header">
                        <div>
                            <div className="therapist-weekly-panel-title">Therapist Weekly Working Template</div>
                            <div className="therapist-weekly-panel-subtitle">
                                Weekly availability for <strong>{therapistDisplayName}</strong>. Primary times use the therapist&apos;s scheduling timezone; the small helper text shows your local time.
                            </div>
                        </div>
                        <div className="therapist-weekly-panel-meta-wrap">
                            <div className="therapist-weekly-panel-meta">
                                <span>Therapist: {therapistTimezone}</span>
                                <span>Your local: {adminLocalTimezone}</span>
                            </div>
                            <span className="therapist-weekly-panel-chevron" aria-hidden="true">
                                {isWeeklyTemplateExpanded ? '−' : '+'}
                            </span>
                        </div>
                    </div>
                </button>

                <div
                    className={`therapist-weekly-panel-content ${isWeeklyTemplateExpanded ? 'is-expanded' : ''}`}
                    style={{ maxHeight: isWeeklyTemplateExpanded ? `${weeklyTemplateContentHeight}px` : '0px' }}
                    aria-hidden={!isWeeklyTemplateExpanded}
                >
                    <div ref={weeklyTemplateContentRef} className="therapist-weekly-panel-content-inner">
                        {weeklyAvailabilityContent}
                    </div>
                </div>
            </div>

            <div className="mode-toggle">
                <button className={`mode-toggle-btn ${mode === 'CUSTOM_DATES' ? 'active' : ''}`} onClick={() => setMode('CUSTOM_DATES')}>
                    Custom Dates (Ad-Hoc)
                </button>
                <button className={`mode-toggle-btn ${mode === 'RECURRING' ? 'active' : ''}`} onClick={() => setMode('RECURRING')}>
                    Recurring Blueprint
                </button>
            </div>

            {mode === 'CUSTOM_DATES' && (
                <div className="custom-dates-container">
                    {customSlotsError ? (
                        <div style={{ marginBottom: 12, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(254, 242, 242, 0.9)', color: 'var(--error-500)', padding: 12, fontSize: 13 }}>
                            {customSlotsError}
                        </div>
                    ) : null}

                    {customDates.map((cd, index) => {
                        const customDateTitle = cd.date ? formatIsoDateLabel(cd.date, therapistTimezone) : `date ${index + 1}`;

                        return (
                        <div key={cd.id} style={{ marginBottom: 18 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.1fr auto', gap: 12, marginBottom: 12, alignItems: 'start' }}>
                                <div>
                                    <UsDateInput
                                        id={`custom-date-${cd.id}`}
                                        label="Date"
                                        value={cd.date}
                                        onCommit={nextValue => updateCustomDate(cd.id, 'date', nextValue)}
                                        required
                                        compact
                                    />
                                </div>
                                <div>
                                    <label htmlFor={`custom-start-time-${cd.id}`} className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)'}}>Start Time (UTC)</label>
                                    <input id={`custom-start-time-${cd.id}`} type="time" className="wizard-input" value={cd.startTime} onChange={e => syncCustomTimeRange(cd.id, 'startTime', e.target.value)} />
                                </div>
                                <div>
                                    <label htmlFor={`custom-end-time-${cd.id}`} className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)'}}>End Time (UTC)</label>
                                    <input id={`custom-end-time-${cd.id}`} type="time" className="wizard-input" value={cd.endTime} onChange={e => syncCustomTimeRange(cd.id, 'endTime', e.target.value)} />
                                </div>
                                <div>
                                    <div className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)', fontWeight: 600}}>Duration</div>
                                    <DurationReadout startTime={cd.startTime} endTime={cd.endTime} />
                                </div>

                                {customDates.length > 1 && (
                                    <button className="btn-icon" onClick={() => removeCustomDate(cd.id)} style={{color: 'var(--error-500)', marginTop: 28}}>
                                        <Trash2 size={20}/>
                                    </button>
                                )}
                            </div>

                            <TimezonePreview
                                title={`Date ${index + 1} timezone preview`}
                                date={cd.date}
                                startTime={cd.startTime}
                                endTime={cd.endTime}
                                clientTimezone={clientTimezone}
                                adminLocalTimezone={adminLocalTimezone}
                            />

                            <SlotPickerCard
                                title={`Bookable slots for ${customDateTitle}`}
                                subtitle={`Clicking a slot fills the UTC start/end time for ${therapistDisplayName} while respecting current client conflicts too.`}
                                date={cd.date}
                                slots={customDateSlots[cd.id] ?? []}
                                therapistTimezone={therapistTimezone}
                                adminTimezone={adminLocalTimezone}
                                selectedSlotKey={`${cd.startTime}-${cd.endTime}`}
                                onSelectSlot={cd.date ? (slot) => applyCustomSlot(cd.id, slot) : undefined}
                                emptyMessage={therapistId ? 'No bookable slots found for this date and duration.' : 'Select a therapist first to load bookable slots.'}
                                loading={customSlotsLoading && Boolean(cd.date)}
                            />
                        </div>
                    )})}

                    <button className="btn btn-secondary" onClick={addCustomDate} style={{marginTop: 12, width: '100%'}}>
                        <PlusCircle size={16} style={{marginRight: 8}}/> Add Another Date
                    </button>
                </div>
            )}

            {mode === 'RECURRING' && (
                <div className="recurring-strategy-container">
                    <div style={{display:'flex', gap: 16, marginBottom: 20}}>
                        <div style={{flex: 1}}>
                            <label htmlFor="recurrence-frequency" className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Recurrence Frequency</label>
                            <select id="recurrence-frequency" className="wizard-select" value={recurrenceConfig.recurrenceType} onChange={e => updateRecurrence({ recurrenceType: e.target.value as any })}>
                                <option value="WEEKLY">Weekly Pattern</option>
                                <option value="MONTHLY">Monthly Pattern</option>
                            </select>
                        </div>
                        <div style={{flex: 1}}>
                            <label htmlFor="recurrence-start-time" className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Start Time (UTC)</label>
                            <input id="recurrence-start-time" type="time" className="wizard-input" value={recurrenceConfig.startTime} onChange={e => syncRecurringTimeRange('startTime', e.target.value)} />
                        </div>
                        <div style={{flex: 1}}>
                            <label htmlFor="recurrence-end-time" className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>End Time (UTC)</label>
                            <input id="recurrence-end-time" type="time" className="wizard-input" value={recurrenceConfig.endTime} onChange={e => syncRecurringTimeRange('endTime', e.target.value)} />
                        </div>
                        <div style={{flex: 1.2}}>
                            <div className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Duration</div>
                            <DurationReadout startTime={recurrenceConfig.startTime} endTime={recurrenceConfig.endTime} />
                        </div>
                    </div>

                    {recurrenceConfig.recurrenceType === 'WEEKLY' && (
                        <div style={{marginBottom: 24}}>
                            <div className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Days of the Week</div>
                            <div style={{display:'flex', gap: 8, flexWrap: 'wrap'}}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                                    const isoDay = idx + 1;
                                    const active = recurrenceConfig.weeklyDays.includes(isoDay);
                                    return (
                                        <button key={day} type="button" onClick={() => handleDayToggle(isoDay)} style={{
                                            padding: '8px 16px', borderRadius: 8, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--gray-200)'}`,
                                            background: active ? 'var(--primary-50)' : 'var(--bg-surface)', color: active ? 'var(--primary-color)' : 'var(--gray-600)',
                                            cursor: 'pointer', fontWeight: 500, flex: 1, textAlign: 'center'
                                        }}>
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {recurrenceConfig.recurrenceType === 'MONTHLY' && (
                        <div style={{marginBottom: 24}}>
                            <div className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Days of the Month</div>
                            <div style={{display:'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8}}>
                                {Array.from({length: 31}).map((_, idx) => {
                                    const d = idx + 1;
                                    const active = recurrenceConfig.monthlyDates.includes(d);
                                    return (
                                        <button key={d} type="button" onClick={() => handleDateToggle(d)} style={{
                                            padding: '8px', borderRadius: 6, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--gray-200)'}`,
                                            background: active ? 'var(--primary-50)' : 'var(--bg-surface)', color: active ? 'var(--primary-color)' : 'var(--gray-600)',
                                            cursor: 'pointer', textAlign: 'center', fontSize: 13
                                        }}>
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{display: 'flex', gap: 16, marginTop: 16}}>
                        <div style={{flex: 1}}>
                            <UsDateInput
                                id="recurrence-start-date"
                                label="Blueprint Start Date"
                                value={recurrenceConfig.startDate}
                                onCommit={nextValue => updateRecurrence({ startDate: nextValue })}
                                required
                            />
                        </div>
                        <div style={{flex: 1}}>
                            <UsDateInput
                                id="recurrence-end-date"
                                label="Blueprint End Date (Optional)"
                                value={recurrenceConfig.endDate || ''}
                                onCommit={nextValue => updateRecurrence({ endDate: nextValue || null })}
                            />
                        </div>
                    </div>

                    <TimezonePreview
                        title="Recurring schedule preview"
                        date={recurrenceConfig.startDate}
                        startTime={recurrenceConfig.startTime}
                        endTime={recurrenceConfig.endTime}
                        clientTimezone={clientTimezone}
                        adminLocalTimezone={adminLocalTimezone}
                    />

                    {recurringSlotsError ? (
                        <div style={{ marginTop: 12, borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(254, 242, 242, 0.9)', color: 'var(--error-500)', padding: 12, fontSize: 13 }}>
                            {recurringSlotsError}
                        </div>
                    ) : null}

                    {recurrenceConfig.recurrenceType === 'WEEKLY' ? (
                        <>
                            <SlotPickerCard
                                title="Common bookable slots across selected weekdays"
                                subtitle={weeklyRecurringSlotSamples.length > 0
                                    ? `Click a slot to apply one time across ${weeklyRecurringSlotSamples.map((sample) => ISO_DAY_TO_SHORT_LABEL[sample.isoDay]).join(', ')}.`
                                    : 'Choose weekly days and a valid duration to discover slots that work across the selected weekdays.'}
                                date={weeklyRecurringSlotSamples[0]?.date}
                                slots={commonWeeklyRecurringSlots}
                                therapistTimezone={therapistTimezone}
                                adminTimezone={adminLocalTimezone}
                                selectedSlotKey={`${recurrenceConfig.startTime}-${recurrenceConfig.endTime}`}
                                onSelectSlot={commonWeeklyRecurringSlots.length > 0 ? applyRecurringSlot : undefined}
                                emptyMessage={weeklyRecurringSlotSamples.length === 0
                                    ? 'No weekday samples available yet.'
                                    : 'No single slot is currently bookable across every selected weekday.'}
                                loading={recurringSlotsLoading}
                            />

                            {weeklyRecurringSlotSamples.map((sample) => (
                                <SlotPickerCard
                                    key={`${sample.isoDay}-${sample.date}`}
                                    title={`Bookable slots for ${ISO_DAY_TO_SHORT_LABEL[sample.isoDay]}`}
                                    subtitle="These are real slots for the next matching occurrence of this weekday. They are informative; use the common slots above to safely set one recurring time across all selected days."
                                    date={formatIsoDateLabel(sample.date, therapistTimezone)}
                                    slots={sample.slots}
                                    therapistTimezone={therapistTimezone}
                                    adminTimezone={adminLocalTimezone}
                                    emptyMessage={`No bookable slots found for ${ISO_DAY_TO_SHORT_LABEL[sample.isoDay]} on the sampled week.`}
                                    loading={recurringSlotsLoading}
                                    infoTone="muted"
                                />
                            ))}
                        </>
                    ) : (
                        <SlotPickerCard
                            title="Bookable slots for the blueprint anchor date"
                            subtitle="Clicking a slot sets the recurring UTC time. The full preview still validates every monthly occurrence before anything is created."
                            date={recurrenceConfig.startDate ? formatIsoDateLabel(recurrenceConfig.startDate, therapistTimezone) : undefined}
                            slots={monthlyRecurringSlots}
                            therapistTimezone={therapistTimezone}
                            adminTimezone={adminLocalTimezone}
                            selectedSlotKey={`${recurrenceConfig.startTime}-${recurrenceConfig.endTime}`}
                            onSelectSlot={monthlyRecurringSlots.length > 0 ? applyRecurringSlot : undefined}
                            emptyMessage="No bookable slots found for the blueprint start date and current duration."
                            loading={recurringSlotsLoading}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
