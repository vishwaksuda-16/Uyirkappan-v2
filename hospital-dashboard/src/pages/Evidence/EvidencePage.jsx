import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import {
  FlaskConical, GitBranch, Truck, Route, Radio, ArrowDownUp,
  ChevronRight, RefreshCw, FileSearch, AlertTriangle
} from 'lucide-react';

const FIGURES = [
  {
    id: 'workflow',
    number: 'E1',
    paperFig: 'Fig. 6',
    title: 'End-to-End Emergency Coordination',
    description: 'Three-application view showing the same emergency across Bystander, Driver, and Hospital panels with central workflow visualization.',
    icon: GitBranch,
    path: '/evidence/workflow',
    color: 'var(--status-info)',
    colorBg: 'var(--status-info-bg)',
    colorBorder: 'var(--status-info-border)',
  },
  {
    id: 'matching',
    number: 'E2',
    paperFig: 'Fig. 7',
    title: 'Ambulance Matching — Decision Intelligence',
    description: 'Multi-factor candidate evaluation showing why a specific ambulance was selected with scoring breakdown and alternative comparisons.',
    icon: Truck,
    path: '/evidence/matching',
    color: 'var(--status-success)',
    colorBg: 'var(--status-success-bg)',
    colorBorder: 'var(--status-success-border)',
  },
  {
    id: 'route-comparison',
    number: 'E3',
    paperFig: 'Fig. 8',
    title: 'Route Comparison & Selection',
    description: 'Visual comparison of baseline distance-oriented route versus UyirKappan traffic-aware route with actual road network geometry.',
    icon: Route,
    path: '/evidence/route-comparison',
    color: 'var(--status-warning)',
    colorBg: 'var(--status-warning-bg)',
    colorBorder: 'var(--status-warning-border)',
  },
  {
    id: 'live-tracking',
    number: 'E4',
    paperFig: 'Fig. 9',
    title: 'Live Tracking & Dynamic ETA',
    description: 'Real-time ambulance tracking with GPS telemetry, route overlay, dynamic ETA updates, and status timeline.',
    icon: Radio,
    path: '/evidence/live-tracking',
    color: 'var(--status-critical)',
    colorBg: 'var(--status-critical-bg)',
    colorBorder: 'var(--status-critical-border)',
  },
  {
    id: 'fallback',
    number: 'E5',
    paperFig: 'Fig. 10',
    title: 'Cascading Fallback Dispatch',
    description: 'Visual explanation of the cascading fallback mechanism when ambulance assignments are rejected or timeout.',
    icon: ArrowDownUp,
    path: '/evidence/fallback',
    color: 'var(--status-purple)',
    colorBg: 'var(--status-purple-bg)',
    colorBorder: 'var(--status-purple-border)',
  },
];

export function EvidencePage() {
  const navigate = useNavigate();
  const [activeCases, setActiveCases] = useState([]);
  const [datasetCases, setDatasetCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get('/evidence/active-cases');
      setActiveCases(data?.activeCases || []);
      setDatasetCases(data?.datasetCases || []);
      const firstActive = data?.activeCases?.[0];
      const firstDataset = data?.datasetCases?.[0];
      if (!selectedCaseId) {
        setSelectedCaseId(firstActive?.requestId || firstDataset?.requestId || '');
      }
    } catch (err) {
      setError(err.message || 'Unable to load evidence cases');
      // Fallback: load from experiments API
      try {
        const expData = await apiClient.get('/experiments/cases?limit=20');
        const cases = expData?.cases || [];
        setDatasetCases(cases.map(c => ({ ...c, source: 'dataset', status: 'DATASET' })));
        if (!selectedCaseId && cases.length > 0) {
          setSelectedCaseId(cases[0].requestId);
        }
      } catch (_) {}
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const allCases = [
    ...activeCases.map(c => ({ ...c, source: 'live' })),
    ...datasetCases,
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--status-purple-bg)', border: '1px solid var(--status-purple-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--status-purple)',
          }}>
            <FlaskConical size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Research Evidence Mode
            </h1>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Five dedicated evidence views for IEEE research paper figure capture
            </div>
          </div>
        </div>
        <button onClick={fetchCases} className="btn btn--secondary" disabled={isLoading}>
          <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh Cases</span>
        </button>
      </div>

      {/* Case Selector */}
      <div className="eoc-card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Active Case Selection
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Select an emergency case to populate all evidence views with actual data
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              id="evidence-case-selector"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600,
                fontFamily: 'var(--font-mono)', minWidth: '280px',
              }}
            >
              {activeCases.length > 0 && (
                <optgroup label="Active Emergencies">
                  {activeCases.map(c => (
                    <option key={`live-${c.requestId}`} value={c.requestId}>
                      {c.requestId} — {c.emergencyType || 'Emergency'} [{c.status}]
                    </option>
                  ))}
                </optgroup>
              )}
              {datasetCases.length > 0 && (
                <optgroup label="Dataset Cases">
                  {datasetCases.map(c => (
                    <option key={`ds-${c.requestId}`} value={c.requestId}>
                      {c.requestId} — {c.emergencyType || 'Emergency'} ({c.area || 'Chennai'})
                    </option>
                  ))}
                </optgroup>
              )}
              {allCases.length === 0 && (
                <option value="">No cases available</option>
              )}
            </select>
            <div style={{
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)', fontWeight: 700,
              backgroundColor: activeCases.length > 0 ? 'var(--status-success-bg)' : 'var(--status-info-bg)',
              color: activeCases.length > 0 ? 'var(--status-success)' : 'var(--status-info)',
              border: `1px solid ${activeCases.length > 0 ? 'var(--status-success-border)' : 'var(--status-info-border)'}`,
            }}>
              {activeCases.length > 0 ? `${activeCases.length} LIVE` : `${datasetCases.length} DATASET`}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
          backgroundColor: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)',
          fontSize: 'var(--text-sm)', color: 'var(--status-warning)',
        }}>
          <AlertTriangle size={16} />
          <span>Live case loading unavailable. Using dataset cases for evidence views.</span>
        </div>
      )}

      {/* Evidence Figure Grid */}
      <div className="evidence-grid">
        {FIGURES.map((fig) => {
          const Icon = fig.icon;
          return (
            <div
              key={fig.id}
              className="evidence-figure-card"
              onClick={() => navigate(`${fig.path}${selectedCaseId ? `?caseId=${selectedCaseId}` : ''}`)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: 'var(--radius-lg)',
                  backgroundColor: fig.colorBg, border: `1px solid ${fig.colorBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: fig.color, flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="figure-number" style={{
                      backgroundColor: fig.colorBg, color: fig.color,
                      border: `1px solid ${fig.colorBorder}`,
                      width: 'auto', padding: '2px 8px', fontSize: '11px',
                    }}>
                      {fig.number}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {fig.paperFig}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {fig.title}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {fig.description}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)',
              }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: fig.color,
                }}>
                  View Evidence <ChevronRight size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Info */}
      <div style={{
        marginTop: 'var(--space-8)', padding: 'var(--space-5)',
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          All evidence views display actual data from the UyirKappan backend, matching engine, and datasets.
          <br />No fabricated values. Each view supports presentation mode for clean figure capture.
        </div>
      </div>
    </div>
  );
}

export default EvidencePage;
