import { Info } from 'lucide-react';
import {
  MAX_SESSION_NOTES_LENGTH,
  MAX_SESSION_TITLE_LENGTH,
  useUnifiedSessionStore,
} from './useUnifiedSessionStore';

export default function Step3SessionDetails() {
  const { title, notes, setTitle, setNotes } = useUnifiedSessionStore();

  const titleRemaining = MAX_SESSION_TITLE_LENGTH - title.length;
  const notesRemaining = MAX_SESSION_NOTES_LENGTH - notes.length;

  return (
    <div className="wizard-step-content animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
        <h3 style={{ color: 'var(--gray-900)', margin: 0 }}>Session Details</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
          <Info size={14} />
          <span>Title appears in notification emails. Notes stay internal.</span>
        </div>
      </div>

      <p style={{ marginBottom: 24, color: 'var(--gray-600)' }}>
        Add an optional session title and internal notes before generating the final preview.
      </p>

      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, background: 'var(--bg-surface)', padding: 20 }}>
          <div className="wizard-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="wizard-session-title">Session Title</label>
            <input
              id="wizard-session-title"
              type="text"
              className="wizard-input"
              placeholder="e.g. Intake Follow-Up, Medication Review, Family Check-In"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={MAX_SESSION_TITLE_LENGTH}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--gray-500)' }}>
                If left blank, emails will use the session type as the fallback title.
              </span>
              <span style={{ color: titleRemaining < 20 ? 'var(--warning-600)' : 'var(--gray-500)', fontWeight: 600 }}>
                {title.length}/{MAX_SESSION_TITLE_LENGTH}
              </span>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 12, background: 'var(--bg-surface)', padding: 20 }}>
          <div className="wizard-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="wizard-session-notes">Session Notes</label>
            <textarea
              id="wizard-session-notes"
              className="wizard-input"
              placeholder="Add any internal context, preparation notes, or scheduling instructions for your team..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={MAX_SESSION_NOTES_LENGTH}
              rows={8}
              style={{ resize: 'vertical', minHeight: 180 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--gray-500)' }}>
                These notes are saved with the session and shown in the final preview, but they are not included in client or therapist email notifications.
              </span>
              <span style={{ color: notesRemaining < 150 ? 'var(--warning-600)' : 'var(--gray-500)', fontWeight: 600 }}>
                {notes.length}/{MAX_SESSION_NOTES_LENGTH}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
