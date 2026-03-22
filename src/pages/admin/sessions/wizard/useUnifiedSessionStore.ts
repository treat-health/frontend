import { create } from 'zustand';

export type SessionType = 'INDIVIDUAL_THERAPY' | 'GROUP_THERAPY' | 'PSYCHIATRIC_EVAL' | 'PSYCHIATRIC_FOLLOWUP' | 'BPS_ASSESSMENT' | 'INTAKE_CALL';
export type SchedulingMode = 'CUSTOM_DATES' | 'RECURRING';
export type RecurrenceType = 'WEEKLY' | 'MONTHLY';

export interface CustomDateParam {
  id: string; // generated client-side for keys
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMins: number;
}

export interface RecurrenceConfig {
  recurrenceType: RecurrenceType;
  weeklyDays: number[]; // 1-7 (1=Monday)
  monthlyDates: number[]; // 1-31
  time: string; // HH:mm
  durationMins: number;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
}

export interface PreviewConflict {
    proposedIndex: number;
    reason: string;
    conflictingSessionId: string;
    entityId: string;
    entityType: 'THERAPIST' | 'CLIENT';
}

export interface PreviewSession {
    therapistId: string;
    clientIds: string[];
    startTime: string;
    endTime: string;
    durationMins: number;
    conflict: PreviewConflict | null;
}

interface UnifiedSessionState {
  step: number;
  type: SessionType;
  clientIds: string[];
  therapistId: string | null;
  mode: SchedulingMode;
  
  // Payload state
  customDates: CustomDateParam[];
  recurrenceConfig: RecurrenceConfig;

  // Preview state
  previewSessions: PreviewSession[];
  previewStatus: 'IDLE' | 'LOADING' | 'SUCCESS' | 'HAS_CONFLICTS';
  previewSummary: { total: number; conflicts: number } | null;

  // Actions
  setStep: (step: number) => void;
  setType: (type: SessionType) => void;
  setClientIds: (ids: string[]) => void;
  setTherapistId: (id: string | null) => void;
  setMode: (mode: SchedulingMode) => void;

  addCustomDate: () => void;
  updateCustomDate: (id: string, field: keyof CustomDateParam, value: any) => void;
  removeCustomDate: (id: string) => void;

  updateRecurrence: (updates: Partial<RecurrenceConfig>) => void;
  setPreviewResults: (sessions: PreviewSession[], status: any, summary: any) => void;
  reset: () => void;
}

const defaultRecurrence: RecurrenceConfig = {
  recurrenceType: 'WEEKLY',
  weeklyDays: [],
  monthlyDates: [],
  time: '12:00',
  durationMins: 50,
  startDate: new Date().toISOString().split('T')[0],
  endDate: null
};

export const useUnifiedSessionStore = create<UnifiedSessionState>((set) => ({
  step: 1,
  type: 'INDIVIDUAL_THERAPY',
  clientIds: [],
  therapistId: null,
  mode: 'CUSTOM_DATES',
  
  customDates: [{ id: 'cd-1', date: new Date().toISOString().split('T')[0], time: '12:00', durationMins: 50 }],
  recurrenceConfig: { ...defaultRecurrence },

  previewSessions: [],
  previewStatus: 'IDLE',
  previewSummary: null,

  setStep: (step) => set({ step }),
  setType: (type) => set({ type, clientIds: type === 'INDIVIDUAL_THERAPY' ? [] : [] }),
  setClientIds: (ids) => set({ clientIds: ids }),
  setTherapistId: (id) => set({ therapistId: id }),
  setMode: (mode) => set({ mode }),

  addCustomDate: () => set((state) => ({
    customDates: [
      ...state.customDates,
      { id: `cd-${Date.now()}`, date: new Date().toISOString().split('T')[0], time: '12:00', durationMins: 50 }
    ]
  })),
  
  updateCustomDate: (id, field, value) => set((state) => ({
    customDates: state.customDates.map(cd => cd.id === id ? { ...cd, [field]: value } : cd)
  })),

  removeCustomDate: (id) => set((state) => ({
    customDates: state.customDates.filter(cd => cd.id !== id)
  })),

  updateRecurrence: (updates) => set((state) => ({
    recurrenceConfig: { ...state.recurrenceConfig, ...updates }
  })),

  setPreviewResults: (sessions, status, summary) => set({
    previewSessions: sessions,
    previewStatus: status,
    previewSummary: summary
  }),

  reset: () => set({
    step: 1,
    type: 'INDIVIDUAL_THERAPY',
    clientIds: [],
    therapistId: null,
    mode: 'CUSTOM_DATES',
    customDates: [{ id: 'cd-1', date: new Date().toISOString().split('T')[0], time: '12:00', durationMins: 50 }],
    recurrenceConfig: { ...defaultRecurrence },
    previewSessions: [],
    previewStatus: 'IDLE',
    previewSummary: null
  })
}));
