export interface Session {
    id: string;
    clientId: string;
    therapistId: string;
    title?: string | null;
    scheduledAt: string;
    durationMins: number;
    status: string;
    type: string;
    isGroupSession?: boolean;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
    participants?: Array<{
        id: string;
        clientId: string;
        client: { id: string; firstName: string; lastName: string; email: string };
    }>;
}

export interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    state: string | null;
    timezone?: string | null;
}

export interface SessionCompletedEvent {
    sessionId: string;
    status: 'COMPLETED';
}
