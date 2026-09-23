import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { PresentationWrapper, PresentationToggle } from '../../components/evidence/PresentationWrapper';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  ChevronLeft, ArrowDownUp, ArrowDown, CheckCircle, XCircle, Clock,
  AlertTriangle, Truck, Search, HelpCircle
} from 'lucide-react';

export function EvidenceFallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = searchParams.get('caseId') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [inputCaseId, setInputCaseId] = useState(caseId);
  const [fallbackCases, setFallbackCases] = useState([]);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/evidence/fallback/${id}`);
      setData(res?.fallback || null);
    } catch (err) {
      setError(err.message || 'Failed to load fallback data');
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackCases = async () => {
    try {
      const res = await apiClient.get('/evidence/fallback-cases');
      setFallbackCases(res?.cases || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadFallbackCases();
    if (caseId) loadData(caseId);
    else setLoading(false);
  }, [caseId]);

  const handleLoadCase = () => {
    if (inputCaseId.trim()) {
      navigate(`/evidence/fallback?caseId=${inputCaseId.trim()}`, { replace: true });
      loadData(inputCaseId.trim());
    }
  };

  const resultIcon = (result) => {
    switch (result) {
      case 'ACCEPTED': return <CheckCircle size={16} style={{ color: 'var(--status-success)' }} />;
      case 'REJECTED': return <XCircle size={16} style={{ color: 'var(--status-critical)' }} />;
      case 'TIMEOUT': return <Clock size={16} style={{ color: 'var(--status-warning)' }} />;
      default: return <AlertTriangle size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const resultColor = (result) => {
    switch (result) {
      case 'ACCEPTED': return 'var(--status-success)';
      case 'REJECTED': return 'var(--status-critical)';
      case 'TIMEOUT': return 'var(--status-warning)';
      default: return 'var(--text-muted)';
    }
  };

  const content = (
    <>
      {!isPresentationMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/evidence')} className="btn btn--ghost btn--sm"><ChevronLeft size={16} /></button>
            <div>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Figure E5 — Cascading Fallback Dispatch</h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Automatic re-dispatch after rejection or timeout</div>
            </div>
          </div>
          <PresentationToggle onClick={() => setIsPresentationMode(true)} />
        </div>
      )}

      {!data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="eoc-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <ArrowDownUp size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>
              Select an Emergency with Fallback Events
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
              <input value={inputCaseId} onChange={(e) => setInputCaseId(e.target.value)} placeholder="Enter Emergency ID"
                style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', width: '280px' }}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadCase()} />
              <button onClick={handleLoadCase} className="btn btn--primary">Load Case</button>
            </div>
          </div>

          {/* Fallback Cases List */}
          {fallbackCases.length > 0 && (
            <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Search size={16} style={{ color: 'var(--status-purple)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Cases with Fallback Events ({fallbackCases.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {fallbackCases.map((fc, i) => (
                  <button key={i} onClick={() => { setInputCaseId(fc.requestId); navigate(`/evidence/fallback?caseId=${fc.requestId}`, { replace: true }); loadData(fc.requestId); }}
                    className="btn btn--secondary" style={{ justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fc.requestId}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {fc.totalAttempts} attempts · {fc.emergencyType}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <LoadingSpinner message="Loading fallback history..." />}
      {error && <div style={{ padding: '16px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Header */}
          <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Emergency</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{data.emergencyId}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{data.emergencyType} · {data.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Attempts</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: data.hasFallback ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {data.totalAttempts}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: data.hasFallback ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {data.hasFallback ? 'Fallback Triggered' : 'No Fallback Required'}
                </div>
              </div>
            </div>
          </div>

          {/* No Fallback Message */}
          {!data.hasFallback && data.totalAttempts <= 1 && (
            <div className="eoc-card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <CheckCircle size={32} style={{ color: 'var(--status-success)', marginBottom: '12px' }} />
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '8px' }}>
                No Fallback Events for This Emergency
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                The first assigned ambulance accepted the dispatch successfully.
                Use the "Find Fallback Case" feature to locate an emergency with actual cascading fallback events.
              </div>
            </div>
          )}

          {/* Visual Cascade */}
          {data.cascade?.length > 0 && (
            <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Dispatch Cascade
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                {/* Emergency Start */}
                <div className="workflow-step" style={{ borderColor: 'var(--status-info-border)', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info)' }}>
                  <AlertTriangle size={14} />
                  <span>EMERGENCY {data.emergencyId}</span>
                </div>

                {data.cascade.map((attempt, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="workflow-connector" style={{ height: '24px', backgroundColor: resultColor(attempt.result) + '66' }} />

                    <div className="workflow-step" style={{
                      borderColor: resultColor(attempt.result) + '55',
                      backgroundColor: attempt.result === 'ACCEPTED' ? 'var(--status-success-bg)' : attempt.result === 'REJECTED' ? 'var(--status-critical-bg)' : 'var(--status-warning-bg)',
                      minWidth: '260px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        {resultIcon(attempt.result)}
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                            {attempt.ambulanceId}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {attempt.driverName} · Attempt #{attempt.attemptNumber}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        color: resultColor(attempt.result),
                        backgroundColor: attempt.result === 'ACCEPTED' ? 'var(--status-success-bg)' : attempt.result === 'REJECTED' ? 'var(--status-critical-bg)' : 'var(--status-warning-bg)',
                        border: `1px solid ${resultColor(attempt.result)}44`,
                      }}>
                        {attempt.result}
                      </span>
                    </div>

                    {attempt.result !== 'ACCEPTED' && (
                      <>
                        <div className="workflow-connector" style={{ height: '16px' }} />
                        <div className="workflow-step workflow-step--pending" style={{ fontSize: 'var(--text-xs)', minWidth: '220px', padding: '6px 12px' }}>
                          MATCHING ENGINE RE-EVALUATION
                        </div>
                      </>
                    )}

                    {attempt.result === 'ACCEPTED' && (
                      <>
                        <div className="workflow-connector workflow-connector--active" style={{ height: '20px' }} />
                        <div className="workflow-step workflow-step--active">
                          <CheckCircle size={14} />
                          <span>EN ROUTE</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignment Attempt Table */}
          {data.cascade?.length > 0 && (
            <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Assignment Attempt History
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="candidate-table">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Ambulance</th>
                      <th>Driver</th>
                      <th>Result</th>
                      <th>Reason</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cascade.map((a, i) => (
                      <tr key={i} className={a.result === 'ACCEPTED' ? 'selected-row' : ''}>
                        <td style={{ fontWeight: 700 }}>#{a.attemptNumber}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{a.ambulanceId}</td>
                        <td>{a.driverName || 'N/A'}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: resultColor(a.result), fontWeight: 700, fontSize: 'var(--text-xs)' }}>
                            {resultIcon(a.result)}
                            {a.result}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {a.reason || (a.result === 'ACCEPTED' ? 'Assignment accepted' : a.result === 'TIMEOUT' ? 'Driver did not respond in time' : a.result === 'REJECTED' ? 'Driver declined' : '—')}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {a.assignedAt ? new Date(a.assignedAt).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isPresentationMode) {
    return (
      <PresentationWrapper
        title="Cascading Fallback Dispatch"
        figureCaption="Fig. 10. Cascading fallback dispatch following unsuccessful ambulance assignment attempts."
        onClose={() => setIsPresentationMode(false)}
      >{content}</PresentationWrapper>
    );
  }

  return <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{content}</div>;
}

export default EvidenceFallback;
