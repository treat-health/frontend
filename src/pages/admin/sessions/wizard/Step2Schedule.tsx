import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import { PlusCircle, Trash2 } from 'lucide-react';

export default function Step2Schedule() {
  const { mode, setMode, customDates, addCustomDate, removeCustomDate, updateCustomDate, recurrenceConfig, updateRecurrence } = useUnifiedSessionStore();

  const handleDayToggle = (day: number) => {
    const current = recurrenceConfig.weeklyDays;
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    updateRecurrence({ weeklyDays: next });
  };

  const handleDateToggle = (date: number) => {
    const current = recurrenceConfig.monthlyDates;
    const next = current.includes(date) ? current.filter(d => d !== date) : [...current, date];
    updateRecurrence({ monthlyDates: next });
  };

  return (
    <div className="wizard-step-content animate-fade-in">
      <h3 style={{ color: 'var(--gray-900)' }}>Schedule Strategy</h3>
      <p style={{marginBottom: 24, color: 'var(--gray-600)'}}>Define dates, times, and recurrences (All times are UTC).</p>

      <div className="mode-toggle">
         <button className={`mode-toggle-btn ${mode === 'CUSTOM_DATES' ? 'active' : ''}`} onClick={() => setMode('CUSTOM_DATES')}>
             Custom Dates (Ad-Hoc)
         </button>
         <button className={`mode-toggle-btn ${mode === 'RECURRING' ? 'active' : ''}`} onClick={() => setMode('RECURRING')}>
             Recurring Blueprint
         </button>
      </div>

      {mode === 'CUSTOM_DATES' && (
         <div className="custom-dates-container">
            {customDates.map((cd) => (
                <div key={cd.id} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end' }}>
                    <div style={{flex: 2}}>
                        <label className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)'}}>Date</label>
                        <input type="date" className="wizard-input" value={cd.date} onChange={e => updateCustomDate(cd.id, 'date', e.target.value)} />
                    </div>
                    <div style={{flex: 1}}>
                        <label className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)'}}>Time (UTC)</label>
                        <input type="time" className="wizard-input" value={cd.time} onChange={e => updateCustomDate(cd.id, 'time', e.target.value)} />
                    </div>
                    <div style={{flex: 1}}>
                        <label className="wizard-label" style={{fontSize: 12, display: 'block', marginBottom: 4, color: 'var(--gray-800)'}}>Duration (Mins)</label>
                        <input type="number" min="15" max="240" className="wizard-input" value={cd.durationMins} onChange={e => updateCustomDate(cd.id, 'durationMins', parseInt(e.target.value))} />
                    </div>
                    
                    {customDates.length > 1 && (
                        <button className="btn-icon" onClick={() => removeCustomDate(cd.id)} style={{color: 'var(--error-500)', marginBottom: 8}}>
                            <Trash2 size={20}/>
                        </button>
                    )}
                </div>
            ))}
            <button className="btn btn-secondary" onClick={addCustomDate} style={{marginTop: 12, width: '100%'}}>
               <PlusCircle size={16} style={{marginRight: 8}}/> Add Another Date
            </button>
         </div>
      )}

      {mode === 'RECURRING' && (
         <div className="recurring-strategy-container">
            <div style={{display:'flex', gap: 16, marginBottom: 20}}>
                <div style={{flex: 1}}>
                    <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Recurrence Frequency</label>
                    <select className="wizard-select" value={recurrenceConfig.recurrenceType} onChange={e => updateRecurrence({ recurrenceType: e.target.value as any })}>
                        <option value="WEEKLY">Weekly Pattern</option>
                        <option value="MONTHLY">Monthly Pattern</option>
                    </select>
                </div>
                <div style={{flex: 1}}>
                    <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Time (UTC)</label>
                    <input type="time" className="wizard-input" value={recurrenceConfig.time} onChange={e => updateRecurrence({time: e.target.value})} />
                </div>
                <div style={{flex: 1}}>
                    <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Duration (Mins)</label>
                    <input type="number" className="wizard-input" value={recurrenceConfig.durationMins} onChange={e => updateRecurrence({durationMins: parseInt(e.target.value)})} />
                </div>
            </div>

            {recurrenceConfig.recurrenceType === 'WEEKLY' && (
                <div style={{marginBottom: 24}}>
                   <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Days of the Week</label>
                   <div style={{display:'flex', gap: 8, flexWrap: 'wrap'}}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                          const isoDay = idx + 1;
                          const active = recurrenceConfig.weeklyDays.includes(isoDay);
                          return (
                              <div key={day} onClick={() => handleDayToggle(isoDay)} style={{
                                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--gray-200)'}`,
                                  background: active ? 'var(--primary-50)' : 'var(--bg-surface)', color: active ? 'var(--primary-color)' : 'var(--gray-600)',
                                  cursor: 'pointer', fontWeight: 500, flex: 1, textAlign: 'center'
                              }}>
                                 {day}
                              </div>
                          )
                      })}
                   </div>
                </div>
            )}

            {recurrenceConfig.recurrenceType === 'MONTHLY' && (
                <div style={{marginBottom: 24}}>
                   <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Days of the Month</label>
                   <div style={{display:'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8}}>
                      {Array.from({length: 31}).map((_, idx) => {
                          const d = idx + 1;
                          const active = recurrenceConfig.monthlyDates.includes(d);
                          return (
                              <div key={d} onClick={() => handleDateToggle(d)} style={{
                                  padding: '8px', borderRadius: 6, border: `1px solid ${active ? 'var(--primary-color)' : 'var(--gray-200)'}`,
                                  background: active ? 'var(--primary-50)' : 'var(--bg-surface)', color: active ? 'var(--primary-color)' : 'var(--gray-600)',
                                  cursor: 'pointer', textAlign: 'center', fontSize: 13
                              }}>
                                 {d}
                              </div>
                          )
                      })}
                   </div>
                </div>
            )}

            <div style={{display: 'flex', gap: 16, marginTop: 16}}>
                <div style={{flex: 1}}>
                    <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Blueprint Start Date</label>
                    <input type="date" className="wizard-input" value={recurrenceConfig.startDate} onChange={e => updateRecurrence({startDate: e.target.value})} />
                </div>
                <div style={{flex: 1}}>
                    <label className="wizard-label" style={{display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--gray-800)'}}>Blueprint End Date (Optional)</label>
                    <input type="date" className="wizard-input" value={recurrenceConfig.endDate || ''} onChange={e => updateRecurrence({endDate: e.target.value})} />
                </div>
            </div>
         </div>
      )}
    </div>
  );
}
