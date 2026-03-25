import { useEffect, useState } from 'react';
import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import { toast } from 'react-hot-toast';
import { Info, PlusCircle, Trash2 } from 'lucide-react';
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
    } = useUnifiedSessionStore();

    const clientTimezone = resolveParticipantTimezone(selectedState, participantTimezone);
    const adminLocalTimezone = getAdminLocalTimezone();

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
            </div>

            <LiveTimePreview clientTimezone={clientTimezone} adminLocalTimezone={adminLocalTimezone} />

            {!selectedState && (
                <div style={{ marginBottom: 20, borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', padding: 14, fontSize: 13 }}>
                    Select participants from a state in the previous step to unlock the client-time preview.
                </div>
            )}

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
            {customDates.map((cd) => (
                <div key={cd.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.1fr auto', gap: 12, marginBottom: 12, alignItems: 'start' }}>
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
            ))}

            {customDates.map((cd, index) => (
                <TimezonePreview
                    key={`preview-${cd.id}`}
                    title={`Date ${index + 1} timezone preview`}
                    date={cd.date}
                    startTime={cd.startTime}
                    endTime={cd.endTime}
                    clientTimezone={clientTimezone}
                    adminLocalTimezone={adminLocalTimezone}
                />
            ))}

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
                          )
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
                          )
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
         </div>
      )}
    </div>
  );
}
