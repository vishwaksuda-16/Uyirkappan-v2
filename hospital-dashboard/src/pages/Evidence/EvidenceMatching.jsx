import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { PresentationWrapper, PresentationToggle } from '../../components/evidence/PresentationWrapper';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ChevronLeft, Truck, Star, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react';

export function EvidenceMatching() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = searchParams.get('caseId') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [inputCaseId, setInputCaseId] = useState(caseId);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/evidence/matching/${id}`);
      setData(res?.matching || null);
    } catch (err) {
      setError(err.message || 'Failed to load matching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) loadData(caseId);
    else setLoading(false);
  }, [caseId]);

  const handleLoadCase = () => {
    if (inputCaseId.trim()) {
      navigate(`/evidence/matching?caseId=${inputCaseId.trim()}`, { replace: true });
      loadData(inputCaseId.trim());
    }
  };

  const sel = data?.selectedAmbulance || {};
  const weights = data?.weights || {};

  const content = (
    <>
      {!isPresentationMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/evidence')} className="btn btn--ghost btn--sm"><ChevronLeft size={16} /></button>
            <div>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Figure E2 — Ambulance Matching Decision Intelligence</h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Why this ambulance was selected</div>
            </div>
          </div>
          <PresentationToggle onClick={() => setIsPresentationMode(true)} />
        </div>
      )}

      {!data && !loading && (
        <div className="eoc-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Truck size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>Select an Emergency Case</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <input value={inputCaseId} onChange={(e) => setInputCaseId(e.target.value)}
              placeholder="Enter Emergency ID (e.g., REQ00001)"
              style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', width: '280px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadCase()}
            />
            <button onClick={handleLoadCase} className="btn btn--primary">Load Case</button>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Evaluating candidates..." />}
      {error && <div style={{ padding: '16px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Top Row: Selected + Factors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
            {/* Selected Ambulance */}
            <div className="eoc-card eoc-card--prominent" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Star size={16} style={{ color: 'var(--status-success)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.06em' }}>★ SELECTED AMBULANCE</span>
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>
                {sel.ambulanceId || 'N/A'}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {sel.driverName || 'Driver'}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Score</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--status-info)' }}>
                    {typeof sel.score === 'number' ? sel.score.toFixed(3) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Emergency</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{data.emergencyType} · {data.area}</div>
                </div>
              </div>
            </div>

            {/* Factor Weights */}
            <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} /> Scoring Factor Weights
              </div>
              <div className="factor-bar-container">
                <FactorBar label="TRAVEL TIME" value={weights.travelTime} pct={parseInt(weights.travelTime) || 50} color="var(--status-info)" />
                <FactorBar label="DISTANCE" value={weights.distance} pct={parseInt(weights.distance) || 20} color="var(--status-success)" />
                <FactorBar label="TRAFFIC" value={weights.traffic} pct={parseInt(weights.traffic) || 20} color="var(--status-warning)" />
                <FactorBar label="AVAILABILITY" value={weights.availability} pct={parseInt(weights.availability) || 10} color="var(--status-purple)" />
              </div>
            </div>
          </div>

          {/* Candidate Table */}
          <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Candidate Evaluation ({data.candidates?.length || 0} ambulances)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Ambulance</th>
                    <th>Driver</th>
                    <th>Distance</th>
                    <th>Travel Time</th>
                    <th>Traffic</th>
                    <th>Availability</th>
                    <th>Score</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.candidates || []).map((c, i) => (
                    <tr key={i} className={c.decision === 'SELECTED' ? 'selected-row' : ''}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.ambulanceId}</td>
                      <td>{c.driverName || 'N/A'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{c.distanceKm} km</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{c.travelTimeMinutes} min</td>
                      <td><TrafficBadge traffic={c.traffic} /></td>
                      <td><StatusDot status={c.availability} /></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: c.decision === 'SELECTED' ? 'var(--status-success)' : 'var(--text-primary)' }}>
                        {typeof c.score === 'number' ? c.score.toFixed(3) : c.score}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontWeight: 700,
                          backgroundColor: c.decision === 'SELECTED' ? 'var(--status-success-bg)' : 'var(--bg-input)',
                          color: c.decision === 'SELECTED' ? 'var(--status-success)' : 'var(--text-muted)',
                          border: `1px solid ${c.decision === 'SELECTED' ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                        }}>
                          {c.decision === 'SELECTED' ? '★ SELECTED' : 'ALTERNATIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Decision Explanation */}
          <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <HelpCircle size={16} style={{ color: 'var(--status-purple)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Decision Explanation
              </span>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '12px 16px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {data.decisionReason}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isPresentationMode) {
    return (
      <PresentationWrapper
        title="Ambulance Matching — Decision Intelligence"
        figureCaption="Fig. 7. Multi-factor ambulance candidate evaluation and selection."
        onClose={() => setIsPresentationMode(false)}
      >{content}</PresentationWrapper>
    );
  }

  return <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{content}</div>;
}

function FactorBar({ label, value, pct, color }) {
  return (
    <div className="factor-bar-item">
      <div className="factor-bar-label">
        <span>{label}</span>
        <span style={{ color: 'var(--text-primary)' }}>{value || `${pct}%`}</span>
      </div>
      <div className="factor-bar-track">
        <div className="factor-bar-fill" style={{ width: `${Math.min(100, Math.max(5, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

function TrafficBadge({ traffic }) {
  const t = String(traffic || 'MODERATE').toUpperCase();
  const color = t.includes('HEAVY') ? 'var(--status-critical)' : t.includes('LIGHT') || t.includes('LOW') ? 'var(--status-success)' : 'var(--status-warning)';
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color, textTransform: 'uppercase' }}>
      {traffic || 'MODERATE'}
    </span>
  );
}

function StatusDot({ status }) {
  const s = String(status || '').toUpperCase();
  const color = s === 'AVAILABLE' ? 'var(--status-success)' : s === 'BUSY' ? 'var(--status-critical)' : 'var(--status-warning)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color }} />
      {status || 'AVAILABLE'}
    </span>
  );
}

export default EvidenceMatching;
