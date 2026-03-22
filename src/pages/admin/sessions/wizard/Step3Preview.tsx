import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import { AlertCircle, CalendarRange } from 'lucide-react';

export default function Step3Preview() {
  const { previewStatus, previewSessions, previewSummary } = useUnifiedSessionStore();

  const formatUtcExact = (isoString: string) => {
      const d = new Date(isoString);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hrs = d.getUTCHours();
      const mins = String(d.getUTCMinutes()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const h12 = hrs % 12 || 12;
      return `${month}/${day}/${year} at ${h12}:${mins} ${ampm} UTC`;
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
        <h3 style={{ color: 'var(--gray-900)' }}>Preview Schedule</h3>
        <p style={{marginBottom: 24, color: 'var(--gray-600)'}}>Review the first 60 days of your scheduling strategy.</p>

        {previewSummary?.conflicts && previewSummary.conflicts > 0 ? (
            <div className="conflict-alert">
                <AlertCircle style={{color: 'var(--error-500)', flexShrink: 0}} size={24}/>
                <div>
                    <h4>Action Required: Scheduling Conflicts Detected</h4>
                    <p>There are {previewSummary.conflicts} exact overlaps blocking this transaction. Please go back to Step 2 to adjust your times, or select an available Therapist in Step 1.</p>
                </div>
            </div>
        ) : (
            <div className="success-alert">
                <h4>All Clear!</h4>
                <p>This blueprint is free of any therapist double-bookings or active client overlaps.</p>
            </div>
        )}

        <div style={{paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <strong style={{fontSize: 14, color: 'var(--gray-800)'}}>Projected Occurrences: {previewSummary?.total || 0}</strong>
        </div>

        <div className="preview-list">
            {previewSessions.map((ps, idx) => (
                <div key={idx} className={`preview-item ${ps.conflict ? 'has-conflict' : ''}`}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        <div style={{background: ps.conflict ? 'rgba(239, 68, 68, 0.15)' : 'var(--gray-100)', padding: 8, borderRadius: 6}}>
                            <CalendarRange size={20} color={ps.conflict ? 'var(--error-500)' : 'var(--gray-600)'}/>
                        </div>
                        <div>
                            <div style={{fontWeight: 600, color: 'var(--gray-900)', fontSize: 14}}>{formatUtcExact(ps.startTime)}</div>
                            <div style={{fontSize: 13, color: 'var(--gray-600)', marginTop: 2}}>Duration: {ps.durationMins} minutes</div>
                        </div>
                    </div>
                    {ps.conflict ? (
                        <div className="preview-chip error">{ps.conflict.reason}</div>
                    ) : (
                        <div className="preview-chip success">Scheduled</div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}
