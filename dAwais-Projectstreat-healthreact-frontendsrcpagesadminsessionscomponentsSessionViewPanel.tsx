import { User as UserIcon, X } from 'lucide-react';
import SessionCalendar from '../../../../components/Calendar/SessionCalendar';

interface Props {
    selectedUserId: string | null;
    selectedClientId: string | null;
    selectedTherapistId: string | null;
    calendarRefreshSignal: number;
    onClearUser: () => void;
}

export default function SessionViewPanel({
    selectedUserId,
    selectedClientId,
    selectedTherapistId,
    calendarRefreshSignal,
    onClearUser,
}: Readonly<Props>) {
    return (
        <div className="session-list-content">
            <div className="session-header-filters">
                {selectedUserId && (
                    <div className="active-filter-badge" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                        <UserIcon size={14} />
                        <span>Filtered by user</span>
                        <button type="button" onClick={onClearUser} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--primary-600)' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'visible', position: 'relative' }}>
                <SessionCalendar
                    clientId={selectedClientId}
                    therapistId={selectedTherapistId}
                    refreshSignal={calendarRefreshSignal}
                    readonly={true}
                />
            </div>
        </div>
    );
}
