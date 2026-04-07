export const ProgramFeedbackStatusEnum = {
    INVITED: 'INVITED',
    NEW: 'NEW',
    REVIEWED: 'REVIEWED',
    FOLLOW_UP: 'FOLLOW_UP',
    CLOSED: 'CLOSED',
} as const;

export type ProgramFeedbackStatus = typeof ProgramFeedbackStatusEnum[keyof typeof ProgramFeedbackStatusEnum];

export interface ProgramFeedbackReviewer {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
}

export interface ProgramFeedbackUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

export interface ProgramFeedbackItem {
    id: string;
    submittedById: string;
    reviewedById: string | null;
    overallExperienceRating: number | null;
    supportRating: number | null;
    improvementSuggestion: string | null;
    additionalComments: string | null;
    status: ProgramFeedbackStatus;
    adminNotes: string | null;
    reviewedAt: string | null;
    invitationSentAt?: string | null;
    invitationExpiresAt?: string | null;
    invitationLastOpenedAt?: string | null;
    submittedAt?: string | null;
    completionTriggeredAt?: string | null;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | null;
    submittedBy?: ProgramFeedbackUser;
    reviewedBy?: ProgramFeedbackReviewer | null;
}

export interface ClientProgramFeedbackOverview {
    eligible: boolean;
    attemptedSessionsCount: number;
    attemptedSessionDates: string[];
    activeInvitation?: ProgramFeedbackItem | null;
    submissions: ProgramFeedbackItem[];
}

export interface ProgramFeedbackInvitationOverview {
    eligible: boolean;
    alreadySubmitted: boolean;
    invitationExpiresAt: string | null;
    attemptedSessionsCount: number;
    attemptedSessionDates: string[];
    feedback: ProgramFeedbackItem;
}

export interface ProgramFeedbackListQuery {
    page?: number;
    limit?: number;
    status?: ProgramFeedbackStatus;
    minOverallRating?: number;
    search?: string;
    sortBy?: 'createdAt' | 'overallExperienceRating' | 'supportRating';
    sortOrder?: 'asc' | 'desc';
}

export interface ProgramFeedbackListResponse {
    feedback: ProgramFeedbackItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    summary: {
        averageOverallRating: number;
        averageSupportRating: number;
        pendingCount: number;
    };
}

export interface CreateProgramFeedbackInput {
    overallExperienceRating: number;
    supportRating: number;
    improvementSuggestion: string;
    additionalComments?: string;
}

export interface UpdateProgramFeedbackInput {
    status?: ProgramFeedbackStatus;
    adminNotes?: string;
}
