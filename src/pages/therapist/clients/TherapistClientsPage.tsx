import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import './TherapistClientsPage.css';

interface ClientSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export default function TherapistClientsPage() {
    const [clients, setClients] = useState<ClientSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/sessions/my-clients');
                setClients(res.data || []);
            } catch {
                setClients([]);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const getInitials = (first: string, last: string) =>
        `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

    return (
        <div className="therapist-clients-page">
            <h2>My Clients</h2>
            <p className="therapist-clients-subtitle">
                Clients you have active or past sessions with
            </p>

            {isLoading ? (
                <div className="clients-loading">
                    <Loader2 size={28} className="tc-spin" />
                </div>
            ) : clients.length === 0 ? (
                <div className="clients-empty">
                    <Users size={36} />
                    <p>No clients yet. Sessions will appear here once assigned by an admin.</p>
                </div>
            ) : (
                <div className="clients-grid">
                    {clients.map(c => (
                        <div key={c.id} className="client-card">
                            <div className="client-card-avatar">
                                {getInitials(c.firstName, c.lastName)}
                            </div>
                            <div className="client-card-info">
                                <p className="client-card-name">{c.firstName} {c.lastName}</p>
                                <p className="client-card-email">{c.email}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
