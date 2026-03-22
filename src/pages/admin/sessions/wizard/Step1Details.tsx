import { useEffect, useState, useMemo } from 'react';
import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import api from '../../../../lib/api';
import type { UserSummary } from '../types';
import { Loader2, X, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';

export default function Step1Details() {
  const { type, setType, clientIds, setClientIds, therapistId, setTherapistId } = useUnifiedSessionStore();
  
  const [clients, setClients] = useState<UserSummary[]>([]);
  const [therapists, setTherapists] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const [cliRes, therRes] = await Promise.all([
           api.get('/users', { params: { role: 'CLIENT', limit: 1000 } }),
           api.get('/users', { params: { role: 'THERAPIST', limit: 500 } })
        ]);
        setClients(cliRes.data?.data?.users || []);
        setTherapists(therRes.data?.data?.users || []);
      } catch (err) {
        console.error('Failed to load users for wizard', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const filteredClients = useMemo(() => {
     return clients.filter(c => 
       c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
       c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
       c.email.toLowerCase().includes(searchTerm.toLowerCase())
     );
  }, [clients, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = filteredClients.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when search or pagesize changes
  useEffect(() => { setPage(1); }, [searchTerm, pageSize]);

  if (loading) return <div style={{display:'flex', justifyContent:'center', padding:'40px'}}><Loader2 className="spin" size={32} color="var(--primary-color)"/></div>;

  const handleToggleClient = (id: string) => {
    const isSelected = clientIds.includes(id);
    
    if (type === 'INDIVIDUAL_THERAPY' || type === 'PSYCHIATRIC_EVAL' || type === 'PSYCHIATRIC_FOLLOWUP' || type === 'BPS_ASSESSMENT' || type === 'INTAKE_CALL') {
       if (isSelected) setClientIds([]);
       else setClientIds([id]);
    } else {
       if (isSelected) setClientIds(clientIds.filter(c => c !== id));
       else setClientIds([...clientIds, id]);
    }
  };

  const removeClient = (id: string) => {
    setClientIds(clientIds.filter(c => c !== id));
  };

  const isGroup = type === 'GROUP_THERAPY';

  return (
    <div className="wizard-step-content animate-fade-in" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--gray-900)' }}>Session Details</h3>
          <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: 14 }}>Select the therapist, clients, and type of session.</p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
          {/* Left Column - Fixed inputs */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              <div className="wizard-form-group">
                 <label>Session Type</label>
                 <select className="wizard-select" value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="INDIVIDUAL_THERAPY">Individual Therapy</option>
                    <option value="GROUP_THERAPY">Group Therapy</option>
                    <option value="PSYCHIATRIC_EVAL">Psychiatric Evaluation</option>
                    <option value="PSYCHIATRIC_FOLLOWUP">Psychiatric Follow-up</option>
                    <option value="BPS_ASSESSMENT">BPS Assessment</option>
                    <option value="INTAKE_CALL">Intake Call</option>
                 </select>
              </div>

              <div className="wizard-form-group">
                 <label>Assigned Therapist</label>
                 <select className="wizard-select" value={therapistId || ''} onChange={(e) => setTherapistId(e.target.value)}>
                    <option value="">-- Select a Therapist --</option>
                    {therapists.map(t => (
                       <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                 </select>
              </div>

              <div className="wizard-form-group">
                  <label>Selected Clients ({clientIds.length})</label>
                  <div className="client-tags" style={{ minHeight: 48, padding: '8px', border: '1px dashed var(--gray-300)', borderRadius: 8, background: 'var(--gray-50)', maxHeight: '120px', overflowY: 'auto' }}>
                     {clientIds.length === 0 && <span style={{color: 'var(--gray-500)', fontSize: 13, alignSelf: 'center'}}>No clients mapped yet...</span>}
                     {clientIds.map(id => {
                        const c = clients.find(cl => cl.id === id);
                        if (!c) return null;
                        return (
                          <div key={id} className="client-tag">
                             {c.firstName} {c.lastName}
                             <X size={14} className="client-tag-remove" onClick={() => removeClient(id)} />
                          </div>
                        )
                     })}
                  </div>
              </div>
          </div>

          {/* Right Column - Client Search Table */}
          <div style={{ flex: 1.2, borderLeft: '1px solid var(--gray-200)', paddingLeft: 24, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <span>Select Client(s)</span>
                <span style={{color: 'var(--gray-500)', fontWeight: 400}}>{isGroup ? 'Multi-select enabled' : 'Single-select bounded'}</span>
             </label>
             
             <div style={{position: 'relative', marginBottom: 12, flexShrink: 0}}>
                 <Search size={16} color="var(--gray-500)" style={{position: 'absolute', left: 12, top: 10}}/>
                 <input 
                    type="text" 
                    placeholder="Search name or email..." 
                    className="wizard-input" 
                    style={{paddingLeft: 36}}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
             </div>

             <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, minHeight: 0, background: 'var(--bg-surface)' }}>
                {paginatedClients.length === 0 ? (
                    <div style={{padding: 24, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13}}>No clients found matching query.</div>
                ) : (
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                        <tbody>
                           {paginatedClients.map(c => {
                               const isSelected = clientIds.includes(c.id);
                               const isDisabled = !isGroup && clientIds.length > 0 && !isSelected;
                               return (
                                   <tr key={c.id} style={{borderBottom: '1px solid var(--gray-100)', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isSelected ? 'var(--primary-50)' : 'transparent', opacity: isDisabled ? 0.5 : 1}} onClick={() => !isDisabled && handleToggleClient(c.id)}>
                                       <td style={{padding: '10px 12px', width: 40, textAlign: 'center'}}>
                                           <div style={{width: 18, height: 18, border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--gray-300)'}`, borderRadius: isGroup ? 4 : 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--primary-color)' : 'transparent'}}>
                                               {isSelected && <Check size={12} color="white" strokeWidth={3}/>}
                                           </div>
                                       </td>
                                       <td style={{padding: '10px 12px', fontWeight: 500, color: 'var(--gray-900)'}}>
                                           {c.firstName} {c.lastName}
                                           <div style={{fontSize: 11, color: 'var(--gray-600)', fontWeight: 400, marginTop: 2}}>{c.email}</div>
                                       </td>
                                   </tr>
                               );
                           })}
                        </tbody>
                    </table>
                )}
             </div>

             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 13, color: 'var(--gray-600)', flexShrink: 0}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))} style={{padding: '4px 8px', borderRadius: 4, border: '1px solid var(--gray-300)', background: 'var(--bg-surface)', color: 'var(--gray-900)', fontSize: 12}}>
                          <option value={5}>5 / page</option>
                          <option value={10}>10 / page</option>
                          <option value={20}>20 / page</option>
                      </select>
                      <span>Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredClients.length)} of {filteredClients.length}</span>
                  </div>
                  <div style={{display: 'flex', gap: 4}}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 4, background: page === 1 ? 'var(--gray-100)' : 'var(--bg-surface)', color: 'var(--gray-600)', cursor: page === 1 ? 'default' : 'pointer'}}><ChevronLeft size={14}/></button>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 4, background: page === totalPages ? 'var(--gray-100)' : 'var(--bg-surface)', color: 'var(--gray-600)', cursor: page === totalPages ? 'default' : 'pointer'}}><ChevronRight size={14}/></button>
                  </div>
             </div>
          </div>
      </div>
    </div>
  );
}
