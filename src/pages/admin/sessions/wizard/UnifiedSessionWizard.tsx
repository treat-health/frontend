import { useEffect } from 'react';
import { X, Check, ChevronRight } from 'lucide-react';
import { MAX_SESSION_NOTES_LENGTH, MAX_SESSION_TITLE_LENGTH, useUnifiedSessionStore } from './useUnifiedSessionStore';
import Step1Details from './Step1Details';
import Step2Schedule from './Step2Schedule';
import Step3SessionDetails from './Step3SessionDetails';
import Step3Preview from './Step3Preview';
import api from '../../../../lib/api';
import { toast } from 'react-hot-toast';
import { MAX_SESSION_DURATION_MINS, MIN_SESSION_DURATION_MINS, calculateDurationBetweenUtcTimes } from './sessionWizardUtils';
import './UnifiedSessionWizard.css';

const MAX_LIVE_SESSION_PARTICIPANTS = 50;
const MAX_GROUP_SESSION_CLIENTS = MAX_LIVE_SESSION_PARTICIPANTS - 1;

const normalizeOptionalText = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const validateStepOne = (state: ReturnType<typeof useUnifiedSessionStore.getState>) => {
  if (!state.selectedState) return 'Please select a state before choosing participants.';
  if (!state.therapistId) return 'Please select a Therapist.';
  if (state.clientIds.length === 0) return 'Please select at least one Client.';
  if (state.type === 'GROUP_THERAPY' && state.clientIds.length < 2) return 'Group therapy requires at least 2 clients.';
  if (state.type === 'GROUP_THERAPY' && state.clientIds.length > MAX_GROUP_SESSION_CLIENTS) {
    return `Group therapy supports a maximum of ${MAX_GROUP_SESSION_CLIENTS} clients (${MAX_LIVE_SESSION_PARTICIPANTS} live participants including the therapist).`;
  }
  if (state.type !== 'GROUP_THERAPY' && state.clientIds.length !== 1) return 'Non-group sessions must have exactly 1 client.';
  return null;
};

const validateStepTwo = (state: ReturnType<typeof useUnifiedSessionStore.getState>) => {
  if (state.mode === 'CUSTOM_DATES') {
    if (state.customDates.length === 0) return 'Please add at least one date.';
    const missingDates = state.customDates.some(c => !c.date || !c.startTime || !c.endTime);
    if (missingDates) return 'Please completely fill out all added dates.';
    const invalidDate = state.customDates.find(c => {
      const duration = calculateDurationBetweenUtcTimes(c.startTime, c.endTime).durationMins ?? 0;
      return duration < MIN_SESSION_DURATION_MINS || duration > MAX_SESSION_DURATION_MINS;
    });
    if (invalidDate) return `Each session must be between ${MIN_SESSION_DURATION_MINS} and ${MAX_SESSION_DURATION_MINS} minutes.`;
    return null;
  }

  if (state.recurrenceConfig.recurrenceType === 'WEEKLY' && state.recurrenceConfig.weeklyDays.length === 0) {
    return 'Select at least one day of the week for weekly recurrence.';
  }

  if (state.recurrenceConfig.recurrenceType === 'MONTHLY' && state.recurrenceConfig.monthlyDates?.length === 0) {
    return 'Select at least one day of the month for monthly recurrence.';
  }

  if (!state.recurrenceConfig.startDate) return 'Start Date is absolutely required.';
  const recurringDuration = calculateDurationBetweenUtcTimes(state.recurrenceConfig.startTime, state.recurrenceConfig.endTime).durationMins ?? 0;
  if (recurringDuration < MIN_SESSION_DURATION_MINS || recurringDuration > MAX_SESSION_DURATION_MINS) {
    return `Recurring sessions must be between ${MIN_SESSION_DURATION_MINS} and ${MAX_SESSION_DURATION_MINS} minutes.`;
  }
  return null;
};

const validateStepThree = (state: ReturnType<typeof useUnifiedSessionStore.getState>) => {
  const title = state.title.trim();
  const notes = state.notes.trim();

  if (title.length > MAX_SESSION_TITLE_LENGTH) {
    return `Session title cannot exceed ${MAX_SESSION_TITLE_LENGTH} characters.`;
  }

  if (notes.length > MAX_SESSION_NOTES_LENGTH) {
    return `Session notes cannot exceed ${MAX_SESSION_NOTES_LENGTH} characters.`;
  }

  return null;
};

const buildSessionPayload = (state: ReturnType<typeof useUnifiedSessionStore.getState>) => {
  const title = normalizeOptionalText(state.title);
  const notes = normalizeOptionalText(state.notes);
  const basePayload: any = {
    clientIds: state.clientIds,
    therapistId: state.therapistId,
    type: state.type,
    mode: state.mode,
    title,
    notes,
  };

  if (state.mode === 'CUSTOM_DATES') {
    return {
      ...basePayload,
      customDates: state.customDates.map(c => ({
        date: c.date,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
  }

  return {
    ...basePayload,
    recurrenceType: state.recurrenceConfig.recurrenceType,
    weeklyDays: state.recurrenceConfig.weeklyDays,
    monthlyDates: state.recurrenceConfig.monthlyDates,
    startTime: state.recurrenceConfig.startTime,
    endTime: state.recurrenceConfig.endTime,
    startDate: state.recurrenceConfig.startDate,
    endDate: state.recurrenceConfig.endDate || null,
  };
};

const getNextButtonLabel = (step: number, previewStatus: ReturnType<typeof useUnifiedSessionStore.getState>['previewStatus']) => {
  if (previewStatus === 'LOADING') return 'Analyzing...';
  if (step === 3) return 'Generate Preview';
  return 'Next Step';
};

export default function UnifiedSessionWizard({ onClose, onSuccess }: Readonly<Props>) {
  const { step, setStep, reset, previewStatus } = useUnifiedSessionStore();

  useEffect(() => {
    // Fresh slate exactly on mount
    reset();
    return () => reset(); // Cleanup strictly on unmount
  }, [reset]);

  const generatePreview = async (state: ReturnType<typeof useUnifiedSessionStore.getState>) => {
    try {
      useUnifiedSessionStore.setState({ previewStatus: 'LOADING' });
      const payload = buildSessionPayload(state);

      const res = await api.post('/admin/sessions/preview', payload);
      useUnifiedSessionStore.setState({
        previewSessions: res.data.sessions,
        previewStatus: res.data.status,
        previewSummary: res.data.summary,
      });
      setStep(4);
    } catch (err: any) {
      useUnifiedSessionStore.setState({ previewStatus: 'IDLE' });
      toast.error(err?.response?.data?.message || 'Failed to generate unified preview');
    }
  };

  const handleNext = async () => {
    const state = useUnifiedSessionStore.getState();
    
    // Step 1 Validation
    if (step === 1) {
      const validationMessage = validateStepOne(state);
      if (validationMessage) return toast.error(validationMessage);
      setStep(2);
    } 
    // Step 2 Validation & Trigger Preview
    else if (step === 2) {
      const validationMessage = validateStepTwo(state);
      if (validationMessage) return toast.error(validationMessage);

      useUnifiedSessionStore.setState({
        previewSessions: [],
        previewStatus: 'IDLE',
        previewSummary: null,
      });

      setStep(3);
    }
    // Step 3 Validation & Trigger Preview
    else if (step === 3) {
      const validationMessage = validateStepThree(state);
      if (validationMessage) return toast.error(validationMessage);

      await generatePreview(state);
    }
  };

  const handleCreateBatch = async () => {
     // Strictly prevent block commit if unresolved conflicts exist
     const state = useUnifiedSessionStore.getState();
     if (state.previewStatus === 'IDLE' || state.previewStatus === 'LOADING') {
       return toast.error('Please generate the preview before scheduling sessions.');
     }
     if (state.previewStatus === 'HAS_CONFLICTS') {
         return toast.error('You must resolve all conflicts in schedule before creating.');
     }

     try {
        const toastId = toast.loading('Bulk generating sessions safely...');
        const payload = buildSessionPayload(state);

        await api.post('/admin/sessions/bulk-create', payload);
        toast.success('Successfully created sessions!', { id: toastId });
        onSuccess(); // Triggers UI re-render natively
     } catch (err: any) {
        toast.dismiss();
        toast.error('Fatal execution error: ' + (err?.response?.data?.message || err.message));
     }
  };

  return (
    <div className="unified-wizard-overlay">
      <div className="unified-wizard-modal">
        {/* Header Ribbon */}
        <div className="wizard-header">
           <div>
               <h2>Create Sessions</h2>
               <p>Manage single, ad-hoc, or complex recurring sessions seamlessly.</p>
           </div>
           <button className="btn-icon" onClick={onClose}><X size={20}/></button>
        </div>

        {/* Dynamic Stepper Visuals */}
        <div className="wizard-stepper">
           <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
               <div className="step-circle">{step > 1 ? <Check size={14}/> : '1'}</div>
               <span>Participants</span>
           </div>
           <div className="step-connector"></div>
           <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
               <div className="step-circle">{step > 2 ? <Check size={14}/> : '2'}</div>
               <span>Schedule Rules</span>
           </div>
           <div className="step-connector"></div>
           <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
               <div className="step-circle">{step > 3 ? <Check size={14}/> : '3'}</div>
               <span>Session Details</span>
             </div>
             <div className="step-connector"></div>
             <div className={`step-item ${step >= 4 ? 'active' : ''}`}>
               <div className="step-circle">4</div>
               <span>Preview & Verify</span>
           </div>
        </div>

        {/* Host Form Body natively */}
        <div className="wizard-body">
            {step === 1 && <Step1Details />}
            {step === 2 && <Step2Schedule />}
          {step === 3 && <Step3SessionDetails />}
          {step === 4 && <Step3Preview />}
        </div>

        {/* Global Modal Footers */}
        <div className="wizard-footer">
            <button className="btn btn-secondary" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
                {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 4 ? (
                <button className="btn btn-primary" onClick={handleNext} disabled={previewStatus === 'LOADING'}>
              {getNextButtonLabel(step, previewStatus)} <ChevronRight size={16} style={{marginLeft: 6}}/>
                </button>
            ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={handleCreateBatch} 
                  disabled={previewStatus === 'HAS_CONFLICTS'}
                  style={{ background: previewStatus === 'HAS_CONFLICTS' ? '#94a3b8' : '' }}
                >
                    Confirm & Schedule Sessions
                </button>
            )}
        </div>
      </div>
    </div>
  );
}
