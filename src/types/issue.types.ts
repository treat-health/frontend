export const IssueStatusEnum = {
    OPEN: 'OPEN',
    TRIAGED: 'TRIAGED',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED'
} as const;
export type IssueStatus = typeof IssueStatusEnum[keyof typeof IssueStatusEnum];

export const IssueCategoryEnum = {
    TECHNICAL: 'TECHNICAL',
    SESSION: 'SESSION',
    BILLING: 'BILLING',
    ACCOUNT: 'ACCOUNT',
    OTHER: 'OTHER'
} as const;
export type IssueCategory = typeof IssueCategoryEnum[keyof typeof IssueCategoryEnum];

export const IssuePriorityEnum = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
} as const;
export type IssuePriority = typeof IssuePriorityEnum[keyof typeof IssuePriorityEnum];

export interface IssueMetadata {
    route?: string;
    userAgent?: string;
    platform?: string;
}

export interface StatusHistoryEntry {
    from: IssueStatus | null;
    to: IssueStatus;
    by: string;
    at: string;
}

export interface IssueComment {
    id: string;
    issueId: string;
    authorId: string;
    message: string;
    isInternal: boolean;
    createdAt: string;
    updatedAt: string;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
        role: string;
    };
}

export interface Issue {
    id: string;
    title: string;
    description: string;
    category: IssueCategory;
    status: IssueStatus;
    priority: IssuePriority;
    createdById: string;
    assignedToId: string | null;
    metadata: IssueMetadata | null;
    statusHistory: StatusHistoryEntry[] | null;
    createdAt: string;
    updatedAt: string;
    
    // Included relations
    createdBy?: {
        id: string;
        firstName: string;
        lastName: string;
        role: string;
        email?: string;
    };
    assignedTo?: {
        id: string;
        firstName: string;
        lastName: string;
        role: string;
        email?: string;
    };
    comments?: IssueComment[];
    _count?: {
        comments: number;
    };
}

export interface CreateIssueInput {
    title: string;
    description: string;
    category: IssueCategory;
    metadata?: IssueMetadata;
}

export interface UpdateIssueStatusInput {
    status: IssueStatus;
    assignedToId?: string | null;
}

export interface CreateIssueCommentInput {
    message: string;
    isInternal?: boolean;
}

export interface ListIssuesQuery {
    page?: number;
    limit?: number;
    status?: IssueStatus;
    category?: IssueCategory;
    role?: string;
    search?: string;
    sortBy?: 'createdAt' | 'priority' | 'status';
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedIssues {
    issues: Issue[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
