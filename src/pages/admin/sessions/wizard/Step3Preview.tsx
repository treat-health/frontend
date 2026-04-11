import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import { AlertCircle, CalendarRange } from 'lucide-react';

export default function Step3Preview() {
    const { previewStatus, previewSessions, previewSummary, title, notes, type } = useUnifiedSessionStore();

        const formattedType = type.replaceAll('_', ' ').toLowerCase().replaceAll(/\b\w/g, (char) => char.toUpperCase());

    const formatSuggestedSlot = (startTime: string, endTime: string) => `${startTime} – ${endTime} UTC`;

    const formatUtcRange = (startIsoString: string, endIsoString: string) => {
            const start = new Date(startIsoString);
            const end = new Date(endIsoString);
            const month = String(start.getUTCMonth() + 1).padStart(2, '0');
            const day = String(start.getUTCDate()).padStart(2, '0');
            const year = start.getUTCFullYear();

            const toUtcClock = (value: Date) => {
                    const hrs = value.getUTCHours();
                    const mins = String(value.getUTCMinutes()).padStart(2, '0');
                    const ampm = hrs >= 12 ? 'PM' : 'AM';
                    const h12 = hrs % 12 || 12;
                    return `${h12}:${mins} ${ampm}`;
            };

            const endsNextDay = end.getUTCDate() !== start.getUTCDate()
                || end.getUTCMonth() !== start.getUTCMonth()
                || end.getUTCFullYear() !== start.getUTCFullYear();

            return `${month}/${day}/${year} • ${toUtcClock(start)} – ${toUtcClock(end)} UTC${endsNextDay ? ' (next day)' : ''}`;
  };

  if (previewStatus === 'IDLE' || previewStatus === 'LOADING') {
      return (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 400, color: 'var(--gray-600)'}}>
              <p>Analyzing Schedule Configuration...</p>
          </div>
      );
  }

  return (
    <div className="wizard-step-content animate-fade-in">
        <h3 style={{ color: 'var(--gray-900)' }}>Preview & Verify</h3>
        <p style={{marginBottom: 24, color: 'var(--gray-600)'}}>Review the first 60 days of your scheduling strategy and confirm the session details that will be saved.</p>

        <div style={{ marginBottom: 24, border: '1px solid var(--gray-200)', borderRadius: 12, background: 'var(--gray-50)', padding: 18 }}>
            <div style={{ display: 'grid', gap: 16 }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Session title</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>{title.trim() || 'Not provided — email will fall back to the session type'}</div>
                </div>

                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Session type</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{formattedType}</div>
                </div>

                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Internal notes</div>
                    <div style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {notes.trim() || 'No internal session notes were added.'}
                    </div>
                </div>
            </div>
        </div>

        {previewSummary?.conflicts && previewSummary.conflicts > 0 ? (
            <div className="conflict-alert">
                <AlertCircle style={{color: 'var(--error-500)', flexShrink: 0}} size={24}/>
                <div>
                    <h4>Action Required: Scheduling Validation Issues Detected</h4>
                    <p>There are {previewSummary.conflicts} occurrence(s) blocked by therapist availability, existing conflicts, or client conflicts. Review the suggested slots below and adjust the schedule before confirming.</p>
                </div>
            </div>
        ) : (
            <div className="success-alert">
                <h4>All Clear!</h4>
                <p>This blueprint fits therapist availability and is free of active therapist/client scheduling conflicts.</p>
            </div>
        )}

        <div style={{paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <strong style={{fontSize: 14, color: 'var(--gray-800)'}}>Projected Occurrences: {previewSummary?.total || 0}</strong>
        </div>

        <div className="preview-list">
            {previewSessions.map((ps) => (
                <div key={`${ps.startTime}-${ps.endTime}-${ps.clientIds.join('-')}`} className={`preview-item ${ps.conflict ? 'has-conflict' : ''}`}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        <div style={{background: ps.conflict ? 'rgba(239, 68, 68, 0.15)' : 'var(--gray-100)', padding: 8, borderRadius: 6}}>
                            <CalendarRange size={20} color={ps.conflict ? 'var(--error-500)' : 'var(--gray-600)'}/>
                        </div>
                        <div>
                            <div style={{fontWeight: 600, color: 'var(--gray-900)', fontSize: 14}}>{formatUtcRange(ps.startTime, ps.endTime)}</div>
                            <div style={{fontSize: 13, color: 'var(--gray-600)', marginTop: 2}}>Duration: {ps.durationMins} minutes</div>
                        </div>
                    </div>
                    {ps.conflict ? (
                        <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                            <div className="preview-chip error">{ps.conflict.reason}</div>
                            {ps.validation?.issues?.length ? (
                                <div style={{ maxWidth: 360, display: 'grid', gap: 6 }}>
                                    {ps.validation.issues.map((issue) => (
                                        <div key={`${issue.code}-${issue.entityId ?? 'na'}-${issue.conflictingSessionId ?? 'none'}`} style={{ fontSize: 12, color: 'var(--error-600)', textAlign: 'right' }}>
                                            {issue.message}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {ps.validation?.suggestedSlots?.length ? (
                                <div style={{ maxWidth: 360, display: 'grid', gap: 6, justifyItems: 'end' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>Suggested available slots</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                                        {ps.validation.suggestedSlots.map((slot) => (
                                            <span key={`${ps.startTime}-${slot.startTime}-${slot.endTime}`} className="preview-chip success" style={{ background: 'var(--primary-50)', color: 'var(--primary-color)' }}>
                                                {formatSuggestedSlot(slot.startTime, slot.endTime)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="preview-chip success">Scheduled</div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}
