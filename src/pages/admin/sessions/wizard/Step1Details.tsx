import { useEffect, useMemo, useState } from 'react';
import { useUnifiedSessionStore } from './useUnifiedSessionStore';
import api, { type ApiResponse } from '../../../../lib/api';
import type { UserSummary } from '../types';
import { toast } from 'react-hot-toast';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Info, Loader2, MapPin, Search, X } from 'lucide-react';
import {
  US_STATE_OPTIONS,
  getFallbackTimezoneForState,
  resolveParticipantTimezone,
} from './sessionWizardUtils';

interface PaginatedUsersPayload {
  users: UserSummary[];
  pagination?: {
    totalPages: number;
  };
}

interface PaginatedClientsPayload {
  clients: UserSummary[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ClientListContentProps {
  selectedState: string;
  clientError: string | null;
  loadingClients: boolean;
  clients: UserSummary[];
  clientIds: string[];
  isGroup: boolean;
  searchTerm: string;
  onRetry: () => void;
  onToggleClient: (client: UserSummary) => void;
}

const SINGLE_CLIENT_TYPES = new Set([
  'INDIVIDUAL_THERAPY',
  'PSYCHIATRIC_EVAL',
  'PSYCHIATRIC_FOLLOWUP',
  'BPS_ASSESSMENT',
  'INTAKE_CALL',
]);

function renderClientListContent({
  selectedState,
  clientError,
  loadingClients,
  clients,
  clientIds,
  isGroup,
  searchTerm,
  onRetry,
  onToggleClient,
}: Readonly<ClientListContentProps>) {
  if (selectedState === '') {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
        <MapPin size={24} style={{ marginBottom: 10 }} />
        <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Choose a state to view clients</div>
        <div>The participant list stays locked until a single state is selected.</div>
      </div>
    );
  }

  if (clientError) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
        <AlertCircle size={24} style={{ marginBottom: 10, color: 'var(--error-500)' }} />
        <div style={{ fontWeight: 600, color: 'var(--gray-800)', marginBottom: 4 }}>{clientError}</div>
        <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>Try Again</button>
      </div>
    );
  }

  if (loadingClients) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--gray-600)', gap: 10 }}>
        <Loader2 className="spin" size={22} color="var(--primary-color)" />
        <span>Loading {selectedState} clients...</span>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: 'var(--gray-800)', marginBottom: 4 }}>No clients found in {selectedState}</div>
        <div>{searchTerm ? 'Try adjusting the search query or page size.' : 'There are currently no active clients available for this state.'}</div>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <tbody>
        {clients.map(client => {
          const isSelected = clientIds.includes(client.id);
          const stateMismatch = !!client.state && client.state !== selectedState;
          const isDisabled = stateMismatch || (!isGroup && clientIds.length > 0 && !isSelected);

          return (
            <tr
              key={client.id}
              style={{
                borderBottom: '1px solid var(--gray-100)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                background: isSelected ? 'var(--primary-50)' : 'transparent',
                opacity: isDisabled ? 0.5 : 1,
              }}
              onClick={() => !isDisabled && onToggleClient(client)}
            >
              <td style={{ padding: '10px 12px', width: 40, textAlign: 'center' }}>
                <div style={{ width: 18, height: 18, border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--gray-300)'}`, borderRadius: isGroup ? 4 : 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--primary-color)' : 'transparent' }}>
                  {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                </div>
              </td>
              <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--gray-900)' }}>
                {client.firstName} {client.lastName}
                <div style={{ fontSize: 11, color: 'var(--gray-600)', fontWeight: 400, marginTop: 2 }}>{client.email}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500, marginTop: 4 }}>
                  {(client.state || selectedState)}{client.timezone ? ` • ${client.timezone}` : ''}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function Step1Details() {
  const {
    type,
    setType,
    selectedState,
    setSelectedState,
    participantTimezone,
    setParticipantTimezone,
    clientIds,
    setClientIds,
    therapistId,
    setTherapistId,
  } = useUnifiedSessionStore();
  
  const [clients, setClients] = useState<UserSummary[]>([]);
  const [therapists, setTherapists] = useState<UserSummary[]>([]);
  const [selectedClientRecords, setSelectedClientRecords] = useState<Record<string, UserSummary>>({});
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [pendingStateChange, setPendingStateChange] = useState<string | null>(null);

  // Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [clientRequestVersion, setClientRequestVersion] = useState(0);

  useEffect(() => {
    async function fetchTherapists() {
      try {
        const therRes = await api.get<ApiResponse<PaginatedUsersPayload>>('/users', {
          params: { role: 'THERAPIST', limit: 500, sortBy: 'firstName', sortOrder: 'asc' },
        });
        setTherapists(therRes.data?.data?.users || []);
      } catch (err) {
        console.error('Failed to load therapists for wizard', err);
        toast.error('Failed to load therapists');
      } finally {
        setLoadingTherapists(false);
      }
    }
    fetchTherapists();
  }, []);

  // Reset page when search or pagesize changes
  useEffect(() => { setPage(1); }, [searchTerm, pageSize, selectedState]);

  useEffect(() => {
    async function fetchClients() {
      if (!selectedState) {
        setClients([]);
        setTotalClients(0);
        setTotalPages(1);
        setClientError(null);
        return;
      }

      setLoadingClients(true);
      setClientError(null);

      try {
        const response = await api.get<ApiResponse<PaginatedClientsPayload>>('/clients', {
          params: {
            state: selectedState,
            page,
            limit: pageSize,
            ...(searchTerm ? { search: searchTerm } : {}),
          },
        });

        const fetchedClients = response.data?.data?.clients || [];
        const pagination = response.data?.data?.pagination;

        setClients(fetchedClients);
        setTotalClients(pagination?.total || 0);
        setTotalPages(pagination?.totalPages || 1);
        setSelectedClientRecords(prev => {
          const next = { ...prev };
          for (const client of fetchedClients) {
            if (clientIds.includes(client.id)) {
              next[client.id] = client;
            }
          }
          return next;
        });
      } catch (err) {
        console.error('Failed to load clients for selected state', err);
        setClientError('Failed to load clients for the selected state.');
      } finally {
        setLoadingClients(false);
      }
    }

    fetchClients();
  }, [clientIds, clientRequestVersion, page, pageSize, searchTerm, selectedState]);

  const selectedClients = useMemo(
    () => clientIds.map(id => selectedClientRecords[id]).filter(Boolean),
    [clientIds, selectedClientRecords],
  );

  const syncSelectedClients = (nextIds: string[], nextSelectedRecords: Record<string, UserSummary>, preferredTimezone?: string | null) => {
    setClientIds(nextIds);
    setSelectedClientRecords(nextSelectedRecords);

    if (nextIds.length === 0) {
      setParticipantTimezone(getFallbackTimezoneForState(selectedState));
      return;
    }

    const anchorClient = nextSelectedRecords[nextIds[0]];
    setParticipantTimezone(resolveParticipantTimezone(selectedState, preferredTimezone ?? anchorClient?.timezone ?? null));
  };

  const applyStateChange = (nextState: string) => {
    setSelectedState(nextState);
    setClientIds([]);
    setSelectedClientRecords({});
    setParticipantTimezone(nextState ? getFallbackTimezoneForState(nextState) : null);
    setSearchTerm('');
    setPage(1);
    setPendingStateChange(null);
  };

  const handleStateSelection = (nextState: string) => {
    if (nextState === selectedState) return;

    if (clientIds.length > 0) {
      setPendingStateChange(nextState);
      return;
    }

    applyStateChange(nextState);
  };

  const handleToggleClient = (client: UserSummary) => {
    if (!selectedState) {
      toast.error('Select a state before choosing participants.');
      return;
    }

    const clientState = client.state || selectedState;
    if (clientState !== selectedState) {
      toast.error('Participants must all belong to the selected state.');
      return;
    }

    const isSelected = clientIds.includes(client.id);
    const nextSelectedRecords = { ...selectedClientRecords };

    if (SINGLE_CLIENT_TYPES.has(type)) {
      if (isSelected) {
        syncSelectedClients([], {});
      } else {
        syncSelectedClients([client.id], { [client.id]: client }, client.timezone || null);
      }
      return;
    }

    if (isSelected) {
      delete nextSelectedRecords[client.id];
      syncSelectedClients(clientIds.filter(currentId => currentId !== client.id), nextSelectedRecords);
      return;
    }

    nextSelectedRecords[client.id] = client;
    syncSelectedClients([...clientIds, client.id], nextSelectedRecords, client.timezone || null);
  };

  const removeClient = (id: string) => {
    const nextIds = clientIds.filter(clientId => clientId !== id);
    const nextSelectedRecords = { ...selectedClientRecords };
    delete nextSelectedRecords[id];

    syncSelectedClients(nextIds, nextSelectedRecords);
  };

  const isGroup = type === 'GROUP_THERAPY';

  const showingFrom = totalClients === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = totalClients === 0 ? 0 : Math.min(page * pageSize, totalClients);

  return (
    <div className="wizard-step-content animate-fade-in" style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: 'var(--gray-900)' }}>Session Details</h3>
          <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: 14 }}>Select the therapist, clients, and type of session.</p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
          {/* Left Column - Fixed inputs */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
              <div className="wizard-form-group">
                  <label htmlFor="wizard-session-type">Session Type</label>
                  <select id="wizard-session-type" className="wizard-select" value={type} onChange={(e) => setType(e.target.value as any)}>
                    <option value="INDIVIDUAL_THERAPY">Individual Therapy</option>
                    <option value="GROUP_THERAPY">Group Therapy</option>
                    <option value="PSYCHIATRIC_EVAL">Psychiatric Evaluation</option>
                    <option value="PSYCHIATRIC_FOLLOWUP">Psychiatric Follow-up</option>
                    <option value="BPS_ASSESSMENT">BPS Assessment</option>
                    <option value="INTAKE_CALL">Intake Call</option>
                 </select>
              </div>

              <div className="wizard-form-group">
                 <label htmlFor="wizard-therapist">Assigned Therapist</label>
                  <select id="wizard-therapist" className="wizard-select" value={therapistId || ''} onChange={(e) => setTherapistId(e.target.value)} disabled={loadingTherapists}>
                    <option value="">-- Select a Therapist --</option>
                    {therapists.map(t => (
                       <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                 </select>
              </div>

                <div className="wizard-form-group">
                  <label htmlFor="wizard-client-state" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Client State</span>
                    <Info size={14} color="var(--gray-500)" title="Participants can only be selected from one state at a time." />
                  </label>
                  <select id="wizard-client-state" className="wizard-select" value={selectedState} onChange={(e) => handleStateSelection(e.target.value)}>
                    <option value="">-- Select a State --</option>
                    {US_STATE_OPTIONS.map(state => (
                     <option key={state.value} value={state.value}>{state.label}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--gray-600)' }}>
                    <MapPin size={14} />
                    <span>
                     Selected state: <strong style={{ color: 'var(--gray-900)' }}>{selectedState || 'None yet'}</strong>
                     {selectedState && participantTimezone ? ` • Timezone ${participantTimezone}` : ''}
                    </span>
                  </div>
                </div>

              <div className="wizard-form-group">
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 8 }}>Selected Clients ({clientIds.length})</div>
                  <div className="client-tags" style={{ minHeight: 48, padding: '8px', border: '1px dashed var(--gray-300)', borderRadius: 8, background: 'var(--gray-50)', maxHeight: '120px', overflowY: 'auto' }}>
                    {clientIds.length === 0 && <span style={{color: 'var(--gray-500)', fontSize: 13, alignSelf: 'center'}}>{selectedState ? 'No clients mapped yet...' : 'Pick a state to unlock participant selection.'}</span>}
                    {selectedClients.map(c => {
                        if (!c) return null;
                        return (
                        <div key={c.id} className="client-tag">
                             {c.firstName} {c.lastName}
                          <span style={{ fontSize: 11, opacity: 0.8 }}>{c.state || selectedState}</span>
                          <X size={14} className="client-tag-remove" onClick={() => removeClient(c.id)} />
                          </div>
                        )
                     })}
                  </div>
              </div>
          </div>

          {/* Right Column - Client Search Table */}
          <div style={{ flex: 1.2, borderLeft: '1px solid var(--gray-200)', paddingLeft: 24, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              <span>Select Client(s)</span>
              <span style={{display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-500)', fontWeight: 400}}>
                {selectedState ? <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--primary-50)', color: 'var(--primary-color)', fontWeight: 600 }}>{selectedState}</span> : null}
                <span>{isGroup ? 'Multi-select enabled' : 'Single-select bounded'}</span>
              </span>
             </div>
             
             <div style={{position: 'relative', marginBottom: 12, flexShrink: 0}}>
                 <Search size={16} color="var(--gray-500)" style={{position: 'absolute', left: 12, top: 10}}/>
                 <input 
                  id="wizard-client-search"
                    type="text" 
                  placeholder={selectedState ? 'Search name or email...' : 'Select a state to search clients'} 
                    className="wizard-input" 
                    style={{paddingLeft: 36}}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                disabled={!selectedState}
                 />
             </div>

             <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, minHeight: 0, background: 'var(--bg-surface)' }}>
              {renderClientListContent({
                selectedState,
                clientError,
                loadingClients,
                clients,
                clientIds,
                isGroup,
                searchTerm,
                onRetry: () => setClientRequestVersion(version => version + 1),
                onToggleClient: handleToggleClient,
              })}
             </div>

             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 13, color: 'var(--gray-600)', flexShrink: 0}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <select id="wizard-client-page-size" value={pageSize} onChange={e => setPageSize(Number.parseInt(e.target.value, 10))} style={{padding: '4px 8px', borderRadius: 4, border: '1px solid var(--gray-300)', background: 'var(--bg-surface)', color: 'var(--gray-900)', fontSize: 12}}>
                          <option value={5}>5 / page</option>
                          <option value={10}>10 / page</option>
                          <option value={20}>20 / page</option>
                      </select>
                      <span>Showing {showingFrom} - {showingTo} of {totalClients}</span>
                  </div>
                  <div style={{display: 'flex', gap: 4}}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 4, background: page === 1 ? 'var(--gray-100)' : 'var(--bg-surface)', color: 'var(--gray-600)', cursor: page === 1 ? 'default' : 'pointer'}}><ChevronLeft size={14}/></button>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{padding: '4px 8px', border: '1px solid var(--gray-300)', borderRadius: 4, background: page === totalPages ? 'var(--gray-100)' : 'var(--bg-surface)', color: 'var(--gray-600)', cursor: page === totalPages ? 'default' : 'pointer'}}><ChevronRight size={14}/></button>
                  </div>
             </div>
          </div>
      </div>

      {pendingStateChange !== null && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <div style={{ width: '100%', maxWidth: 420, borderRadius: 12, background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xl)', padding: 24 }}>
            <h4 style={{ margin: '0 0 8px', color: 'var(--gray-900)' }}>Reset selected participants?</h4>
            <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: 14, lineHeight: 1.5 }}>
              Changing state will reset selected participants.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setPendingStateChange(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => applyStateChange(pendingStateChange)}>Change State</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
