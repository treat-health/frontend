import { useEffect } from 'react';
import { X, Check, ChevronRight } from 'lucide-react';
import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import Step1Details from './Step1Details';
import Step2Schedule from './Step2Schedule';
import Step3Preview from './Step3Preview';
import api from '../../../../lib/api';
import { toast } from 'react-hot-toast';
import './UnifiedSessionWizard.css';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function UnifiedSessionWizard({ onClose, onSuccess }: Props) {
  const { step, setStep, reset, previewStatus } = useUnifiedSessionStore();

  useEffect(() => {
    // Fresh slate exactly on mount
    reset();
    return () => reset(); // Cleanup strictly on unmount
  }, [reset]);

  const handleNext = async () => {
    const state = useUnifiedSessionStore.getState();
    
    // Step 1 Validation
    if (step === 1) {
      if (!state.therapistId) return toast.error('Please select a Therapist.');
      if (state.clientIds.length === 0) return toast.error('Please select at least one Client.');
      setStep(2);
    } 
    // Step 2 Validation & Trigger Preview
    else if (step === 2) {
      if (state.mode === 'CUSTOM_DATES') {
         if (state.customDates.length === 0) return toast.error('Please add at least one date.');
         const missingDates = state.customDates.some(c => !c.date || !c.time || !c.durationMins);
         if (missingDates) return toast.error('Please completely fill out all added dates.');
      } else {
         if (state.recurrenceConfig.recurrenceType === 'WEEKLY' && state.recurrenceConfig.weeklyDays.length === 0) {
            return toast.error('Select at least one day of the week for weekly recurrence.');
         }
         if (state.recurrenceConfig.recurrenceType === 'MONTHLY' && state.recurrenceConfig.monthlyDates?.length === 0) {
            return toast.error('Select at least one day of the month for monthly recurrence.');
         }
         if (!state.recurrenceConfig.startDate) return toast.error('Start Date is absolutely required.');
      }

      // Fire Preview Endpoint
      try {
        useUnifiedSessionStore.setState({ previewStatus: 'LOADING' });
        
        let payload: any = {
           clientIds: state.clientIds,
           therapistId: state.therapistId,
           type: state.type,
           mode: state.mode,
        };

        if (state.mode === 'CUSTOM_DATES') {
          payload.customDates = state.customDates.map(c => ({
              date: c.date,
              time: c.time,
              durationMins: c.durationMins
          }));
        } else {
          payload = {
              ...payload,
              recurrenceType: state.recurrenceConfig.recurrenceType,
              weeklyDays: state.recurrenceConfig.weeklyDays,
              monthlyDates: state.recurrenceConfig.monthlyDates,
              time: state.recurrenceConfig.time,
              durationMins: state.recurrenceConfig.durationMins,
              startDate: state.recurrenceConfig.startDate,
              endDate: state.recurrenceConfig.endDate || null
          };
        }

        const res = await api.post('/admin/sessions/preview', payload);
        useUnifiedSessionStore.setState({
           previewSessions: res.data.sessions,
           previewStatus: res.data.status, // SUCCESS | HAS_CONFLICTS
           previewSummary: res.data.summary
        });
        setStep(3);

      } catch (err: any) {
        useUnifiedSessionStore.setState({ previewStatus: 'IDLE' });
        toast.error(err?.response?.data?.message || 'Failed to generate unified preview');
      }
    }
  };

  const handleCreateBatch = async () => {
     // Strictly prevent block commit if unresolved conflicts exist
     const state = useUnifiedSessionStore.getState();
     if (state.previewStatus === 'HAS_CONFLICTS') {
         return toast.error('You must resolve all conflicts in schedule before creating.');
     }

     try {
        const toastId = toast.loading('Bulk generating sessions safely...');
        
        let payload: any = {
           clientIds: state.clientIds,
           therapistId: state.therapistId,
           type: state.type,
           mode: state.mode,
        };

        if (state.mode === 'CUSTOM_DATES') {
          payload.customDates = state.customDates.map(c => ({ date: c.date, time: c.time, durationMins: c.durationMins }));
        } else {
          payload = {
              ...payload,
              recurrenceType: state.recurrenceConfig.recurrenceType,
              weeklyDays: state.recurrenceConfig.weeklyDays,
              monthlyDates: state.recurrenceConfig.monthlyDates,
              time: state.recurrenceConfig.time,
              durationMins: state.recurrenceConfig.durationMins,
              startDate: state.recurrenceConfig.startDate,
              endDate: state.recurrenceConfig.endDate || null
          };
        }

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
               <div className="step-circle">3</div>
               <span>Preview & Verify</span>
           </div>
        </div>

        {/* Host Form Body natively */}
        <div className="wizard-body">
            {step === 1 && <Step1Details />}
            {step === 2 && <Step2Schedule />}
            {step === 3 && <Step3Preview />}
        </div>

        {/* Global Modal Footers */}
        <div className="wizard-footer">
            <button className="btn btn-secondary" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
                {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
                <button className="btn btn-primary" onClick={handleNext} disabled={previewStatus === 'LOADING'}>
                    {previewStatus === 'LOADING' ? 'Analyzing...' : 'Next Step'} <ChevronRight size={16} style={{marginLeft: 6}}/>
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
