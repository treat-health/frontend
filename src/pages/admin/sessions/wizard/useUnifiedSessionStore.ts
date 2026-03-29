import { create } from 'zustand';
import {
  DEFAULT_SESSION_DURATION_MINS,
  addMinutesToUtcTime,
  calculateDurationBetweenUtcTimes,
  getDefaultUtcStartTime,
} from './sessionWizardUtils';

export const MAX_SESSION_TITLE_LENGTH = 150;
export const MAX_SESSION_NOTES_LENGTH = 2000;

export type SessionType = 'INDIVIDUAL_THERAPY' | 'GROUP_THERAPY' | 'PSYCHIATRIC_EVAL' | 'PSYCHIATRIC_FOLLOWUP' | 'BPS_ASSESSMENT' | 'INTAKE_CALL';
export type SchedulingMode = 'CUSTOM_DATES' | 'RECURRING';
export type RecurrenceType = 'WEEKLY' | 'MONTHLY';

export interface CustomDateParam {
  id: string; // generated client-side for keys
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMins: number;
}

export interface RecurrenceConfig {
  recurrenceType: RecurrenceType;
  weeklyDays: number[]; // 1-7 (1=Monday)
  monthlyDates: number[]; // 1-31
  startTime: string; // HH:mm
  endTime: string; // HH:mm
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
  title: string;
  notes: string;
  selectedState: string;
  participantTimezone: string | null;
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
  setTitle: (title: string) => void;
  setNotes: (notes: string) => void;
  setSelectedState: (state: string) => void;
  setParticipantTimezone: (timezone: string | null) => void;
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
  startTime: getDefaultUtcStartTime(),
  endTime: addMinutesToUtcTime(getDefaultUtcStartTime(), DEFAULT_SESSION_DURATION_MINS),
  durationMins: DEFAULT_SESSION_DURATION_MINS,
  startDate: new Date().toISOString().split('T')[0],
  endDate: null
};

const buildDefaultCustomDate = (): CustomDateParam => {
  const startTime = getDefaultUtcStartTime();
  const endTime = addMinutesToUtcTime(startTime, DEFAULT_SESSION_DURATION_MINS);
  const durationMins = calculateDurationBetweenUtcTimes(startTime, endTime).durationMins ?? DEFAULT_SESSION_DURATION_MINS;

  return {
    id: `cd-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    startTime,
    endTime,
    durationMins,
  };
};

export const useUnifiedSessionStore = create<UnifiedSessionState>((set) => ({
  step: 1,
  type: 'INDIVIDUAL_THERAPY',
  title: '',
  notes: '',
  selectedState: '',
  participantTimezone: null,
  clientIds: [],
  therapistId: null,
  mode: 'CUSTOM_DATES',
  
  customDates: [{ ...buildDefaultCustomDate(), id: 'cd-1' }],
  recurrenceConfig: { ...defaultRecurrence },

  previewSessions: [],
  previewStatus: 'IDLE',
  previewSummary: null,

  setStep: (step) => set({ step }),
  setType: (type) => set({ type, clientIds: [] }),
  setTitle: (title) => set({ title }),
  setNotes: (notes) => set({ notes }),
  setSelectedState: (selectedState) => set({ selectedState }),
  setParticipantTimezone: (participantTimezone) => set({ participantTimezone }),
  setClientIds: (ids) => set({ clientIds: ids }),
  setTherapistId: (id) => set({ therapistId: id }),
  setMode: (mode) => set({ mode }),

  addCustomDate: () => set((state) => ({
    customDates: [
      ...state.customDates,
      buildDefaultCustomDate(),
    ]
  })),
  
  updateCustomDate: (id, field, value) => set((state) => ({
    customDates: state.customDates.map(cd => {
      if (cd.id !== id) return cd;
      const next = { ...cd, [field]: value };
      const derivedDuration = calculateDurationBetweenUtcTimes(next.startTime, next.endTime).durationMins;
      return {
        ...next,
        durationMins: derivedDuration ?? next.durationMins,
      };
    })
  })),

  removeCustomDate: (id) => set((state) => ({
    customDates: state.customDates.filter(cd => cd.id !== id)
  })),

  updateRecurrence: (updates) => set((state) => ({
    recurrenceConfig: (() => {
      const next = { ...state.recurrenceConfig, ...updates };
      const derivedDuration = calculateDurationBetweenUtcTimes(next.startTime, next.endTime).durationMins;
      return {
        ...next,
        durationMins: derivedDuration ?? next.durationMins,
      };
    })()
  })),

  setPreviewResults: (sessions, status, summary) => set({
    previewSessions: sessions,
    previewStatus: status,
    previewSummary: summary
  }),

  reset: () => set({
    step: 1,
    type: 'INDIVIDUAL_THERAPY',
    title: '',
    notes: '',
    selectedState: '',
    participantTimezone: null,
    clientIds: [],
    therapistId: null,
    mode: 'CUSTOM_DATES',
    customDates: [{ ...buildDefaultCustomDate(), id: 'cd-1' }],
    recurrenceConfig: { ...defaultRecurrence },
    previewSessions: [],
    previewStatus: 'IDLE',
    previewSummary: null
  })
}));
