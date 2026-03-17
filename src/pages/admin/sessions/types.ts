export interface Session {
    id: string;
    clientId: string;
    therapistId: string;
    scheduledAt: string;
    durationMins: number;
    status: string;
    type: string;
    client: { id: string; firstName: string; lastName: string; email: string };
    therapist: { id: string; firstName: string; lastName: string; email: string };
}

export interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

export interface SessionCompletedEvent {
    sessionId: string;
    status: 'COMPLETED';
}
