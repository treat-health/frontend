import { useEffect } from 'react';
import { X, Calendar, Clock, User, Users } from 'lucide-react';
import './DailySessionAgenda.css';

interface Session {
    id: string;
    title?: string | null;
    status: string;
    startTime: string;
    endTime: string;
    durationMins: number;
    type: string;
    isGroupSession?: boolean;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
    participants?: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

interface Props {
    date: Date;
    sessions: Session[];
    onClose: () => void;
}

const formatTimeStr = (iso: string) => {
    const d = new Date(iso);
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm} (UTC)`;
};

const getSessionDisplayTitle = (session: Pick<Session, 'title' | 'type'>) =>
    session.title?.trim() || session.type.replaceAll('_', ' ');

export default function DailySessionAgenda({ date, sessions, onClose }: Readonly<Props>) {
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

    // sort sessions chronologically
    const sorted = [...sessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="daily-agenda-overlay">
            <button
                type="button"
                className="daily-agenda-backdrop-btn"
                onClick={onClose}
                aria-label="Close daily agenda"
            />
            <section className="daily-agenda-drawer animate-slide-in-right" aria-label="Daily agenda">
                <div className="agenda-header">
                    <div>
                        <h2>Daily Agenda</h2>
                        <p>{dateStr}</p>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={20}/></button>
                </div>

                <div className="agenda-body">
                    {sorted.length === 0 ? (
                        <div className="agenda-empty">
                            <Calendar size={32} color="var(--gray-400)" />
                            <p>No sessions scheduled for this day.</p>
                        </div>
                    ) : (
                        <div className="agenda-timeline">
                            {sorted.map(s => {
                                const isGroup = s.isGroupSession || s.type === 'GROUP_THERAPY';
                                const clientList = isGroup && s.participants && s.participants.length > 0
                                    ? s.participants
                                    : [s.client];
                                
                                return (
                                    <div key={s.id} className="agenda-card">
                                        <div className="agenda-card-time">
                                            <Clock size={14} color="var(--primary-color)" />
                                            <span>{formatTimeStr(s.startTime)} – {formatTimeStr(s.endTime)}</span>
                                            <span className="agenda-card-duration">({s.durationMins} min)</span>
                                        </div>
                                        
                                        <div className="agenda-card-details">
                                            <div className="agenda-card-row" style={{marginBottom: 8}}>
                                                <div>
                                                    <strong className="agenda-card-title">{getSessionDisplayTitle(s)}</strong>
                                                    <div className="agenda-card-type-meta">
                                                        {s.type.replaceAll('_', ' ')}{isGroup ? ' • Group Session' : ' • 1:1 Session'}
                                                    </div>
                                                </div>
                                                <span className={`status-badge ${s.status.toLowerCase()}`}>
                                                    {s.status.toLowerCase().replaceAll('_', ' ')}
                                                </span>
                                            </div>
                                            
                                            {clientList.map(c => (
                                                <div key={c.id} className="agenda-card-row text-muted">
                                                    <div className="agenda-participant">
                                                        {isGroup ? <Users size={14}/> : <User size={14}/>}
                                                        <span>Client: <strong style={{color: 'var(--gray-800)'}}>{c.firstName} {c.lastName}</strong></span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="agenda-card-row text-muted" style={{marginTop: 4}}>
                                                <div className="agenda-participant">
                                                    <User size={14} color="var(--primary-color)" />
                                                    <span>Therapist: <span style={{color: 'var(--gray-800)'}}>{s.therapist.firstName} {s.therapist.lastName}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
