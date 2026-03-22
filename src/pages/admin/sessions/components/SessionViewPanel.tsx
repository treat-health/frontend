import SessionCalendar from '../../../../components/Calendar/SessionCalendar';

interface Props {
    selectedClientId: string | null;
    selectedTherapistId: string | null;
    calendarRefreshSignal: number;
}

export default function SessionViewPanel({
    selectedClientId,
    selectedTherapistId,
    calendarRefreshSignal,
}: Readonly<Props>) {
    return (
        <div className="session-list-content" style={{ marginTop: '0' }}>
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
