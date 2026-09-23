import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Navigation,
  Sparkles,
  Layers,
  ArrowRight,
  Ambulance,
  Building2,
  MapPin,
  TrendingDown,
  ShieldAlert,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export function DemoScenariosPage() {
  const { token } = useAuth();
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [fallbackSteps, setFallbackSteps] = useState(null);

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/scenarios`);
      if (res.data.success && Array.isArray(res.data.scenarios)) {
        setScenarios(res.data.scenarios);
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeScenario = scenarios[selectedScenarioIndex] || null;

  const handleLoadScenario = async () => {
    if (!activeScenario) return;
    try {
      const res = await axios.post(`${API_BASE}/scenarios/${activeScenario.id}/load`);
      setActionMessage({
        type: 'success',
        text: res.data.message || `Scenario #${activeScenario.number} loaded into dispatch ready queue.`,
      });
      setFallbackSteps(null);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load scenario.' });
    }
  };

  const handleStartSimulation = async () => {
    if (!activeScenario) return;
    try {
      setRunning(true);
      const res = await axios.post(
        `${API_BASE}/scenarios/${activeScenario.id}/run`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setActionMessage({
        type: 'success',
        text: `Simulation active for ${activeScenario.name}. Emergency ${res.data.emergency?.requestId || ''} dispatched.`,
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Simulation start failed.' });
    } finally {
      setRunning(false);
    }
  };

  const handleFullDemo = async () => {
    try {
      setRunning(true);
      const res = await axios.post(
        `${API_BASE}/scenarios/full-demo`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setActionMessage({
        type: 'success',
        text: `Full end-to-end emergency simulation launched (${res.data.requestId}). Ambulance ${res.data.assignedAmbulanceId} en route.`,
      });
      setFallbackSteps(null);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Full demo error.' });
    } finally {
      setRunning(false);
    }
  };

  const handleFallbackDemo = async () => {
    try {
      setRunning(true);
      const res = await axios.post(
        `${API_BASE}/scenarios/fallback-demo`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setFallbackSteps(res.data.sequence || []);
      setActionMessage({
        type: 'success',
        text: 'Cascading fallback sequence executed across 4 dataset units.',
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Fallback demo error.' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Clock className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
        <div>Loading Authoritative Demo Scenarios from Datasets...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              DEMO MODE ACTIVE
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Simulation & Demo Scenarios
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Evaluated live on authentic Chennai road-network and healthcare dataset records.
          </p>
        </div>

        {/* Global Demo Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleFullDemo}
            disabled={running}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Play size={14} />
            <span>START FULL DEMO</span>
          </button>

          <button
            onClick={handleFallbackDemo}
            disabled={running}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            <span>START FALLBACK DEMO</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actionMessage.type === 'success' ? <CheckCircle2 size={16} color="#10b981" /> : <AlertTriangle size={16} color="#ef4444" />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Fallback Animation View if active */}
      {fallbackSteps && (
        <div
          style={{
            backgroundColor: '#111827',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <ShieldAlert size={18} color="#f59e0b" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#f59e0b' }}>
              CASCADING FALLBACK EXECUTION SEQUENCE
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {fallbackSteps.map((step, idx) => {
              const isAccepted = step.event === 'ACCEPTED';
              const isTimeout = step.event === 'TIMEOUT';
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#1f2937',
                    border: `1px solid ${isAccepted ? '#10b981' : isTimeout ? '#f59e0b' : '#ef4444'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    ATTEMPT #{idx + 1}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0' }}>
                    {step.ambulanceId}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: isAccepted ? '#10b981' : isTimeout ? '#d97706' : '#dc2626',
                      color: '#fff',
                      marginBottom: '6px',
                    }}
                  >
                    {step.event} {isAccepted && '✓'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{step.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Left Scenario List & Right Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* Left Scenario Selector Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, paddingLeft: '4px' }}>
            Curated Scenarios ({scenarios.length})
          </div>

          {scenarios.map((sc, idx) => {
            const isSelected = idx === selectedScenarioIndex;
            return (
              <div
                key={sc.id}
                onClick={() => {
                  setSelectedScenarioIndex(idx);
                  setActionMessage(null);
                  setFallbackSteps(null);
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-card)',
                  border: isSelected ? '1px solid #0284c7' : '1px solid var(--border-default)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: isSelected ? '#38bdf8' : 'var(--text-muted)' }}>
                    SCENARIO #{sc.number}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: sc.trafficCondition === 'HEAVY' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: sc.trafficCondition === 'HEAVY' ? '#ef4444' : '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    {sc.trafficCondition}
                  </span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {sc.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {sc.incident?.locationName || sc.area}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Details: Scenario Information Panel */}
        {activeScenario && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Scenario Banner */}
            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>
                    SCENARIO #{activeScenario.number}
                  </span>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0', color: 'var(--text-primary)' }}>
                    {activeScenario.name}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {activeScenario.description}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleLoadScenario}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Layers size={14} />
                    <span>LOAD SCENARIO</span>
                  </button>

                  <button
                    onClick={handleStartSimulation}
                    disabled={running}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={14} />
                    <span>START SIMULATION</span>
                  </button>
                </div>
              </div>

              {/* Incident Specification Details */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700 }}>INCIDENT LOCATION</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeScenario.incident?.locationName}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700 }}>COORDINATES</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {activeScenario.incident?.latitude?.toFixed(5)}, {activeScenario.incident?.longitude?.toFixed(5)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700 }}>EMERGENCY TYPE</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {activeScenario.incident?.emergencyType} ({activeScenario.incident?.severity})
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700 }}>TRAFFIC CONDITION</div>
                  <div style={{ fontWeight: 800, color: activeScenario.trafficCondition === 'HEAVY' ? '#ef4444' : '#10b981' }}>
                    {activeScenario.trafficCondition}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Evaluation Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Candidate Ambulances Table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ambulance size={16} color="#38bdf8" />
                    <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      AMBULANCE MATCHING
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Multi-factor Evaluated</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>Unit & Driver</th>
                      <th>Dist</th>
                      <th>ETA</th>
                      <th>Traffic</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.candidateAmbulances?.map((amb, idx) => {
                      const isSelected = idx === 0;
                      return (
                        <tr
                          key={amb.ambulanceId}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 0' }}>
                            <div style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#38bdf8' : 'var(--text-primary)' }}>
                              {amb.ambulanceId} {isSelected && '★'}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{amb.driverName}</div>
                          </td>
                          <td>{amb.distanceKm} km</td>
                          <td style={{ fontWeight: 700, color: isSelected ? '#10b981' : 'var(--text-primary)' }}>
                            {amb.etaMinutes} min
                          </td>
                          <td>
                            <span style={{ fontSize: '10px', color: amb.traffic === 'HEAVY' ? '#ef4444' : '#10b981' }}>
                              {amb.traffic}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{amb.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* "WHY THIS AMBULANCE?" Box */}
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
                    WHY THIS AMBULANCE? ({activeScenario.selectedAmbulance?.ambulanceId})
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    • Travel Time weight (50%) + Distance (20%) + Traffic penalty (20%) + Availability (10%).
                    <br />• Final Weighted Score: <strong>{activeScenario.selectedAmbulance?.score}</strong> (lowest among available units).
                  </div>
                </div>
              </div>

              {/* Candidate Hospitals Table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#10b981" />
                    <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      HOSPITAL SELECTION
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Capability Evaluated</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>Hospital</th>
                      <th>Dist</th>
                      <th>ETA</th>
                      <th>Resources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.candidateHospitals?.map((h, idx) => {
                      const isSelected = idx === 0;
                      return (
                        <tr
                          key={h.hospitalId}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 0' }}>
                            <div style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#10b981' : 'var(--text-primary)' }}>
                              {h.name} {isSelected && '★'}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{h.area}</div>
                          </td>
                          <td>{h.distanceKm} km</td>
                          <td style={{ fontWeight: 700 }}>{h.etaMinutes} min</td>
                          <td>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: h.resourcesStatus === 'AVAILABLE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: h.resourcesStatus === 'AVAILABLE' ? '#10b981' : '#f59e0b',
                              }}
                            >
                              {h.resourcesStatus} ({h.icuBeds} ICU)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* "WHY THIS HOSPITAL?" Box */}
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '4px' }}>
                    WHY THIS HOSPITAL? ({activeScenario.selectedHospital?.name})
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    ✓ Closest eligible emergency medical center ({activeScenario.selectedHospital?.distanceKm} km)
                    <br />✓ Active critical care resources ({activeScenario.selectedHospital?.icuBeds} ICU beds ready)
                    <br />✓ Lowest estimated arrival time ({activeScenario.selectedHospital?.etaMinutes} min)
                  </div>
                </div>
              </div>
            </div>

            {/* Route Optimization Visual Comparison Card */}
            {activeScenario.routingComparison && (
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-default)',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Navigation size={18} color="#38bdf8" />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      ROUTE OPTIMIZATION COMPARISON
                    </h3>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    <TrendingDown size={14} />
                    <span>{activeScenario.routingComparison.improvementPct}% ETA IMPROVEMENT</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Metric</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8' }}>
                          BASELINE ROUTE
                        </th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#38bdf8' }}>
                          UYIRKAPPAN ROUTE ★
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>Strategy</td>
                        <td style={{ textAlign: 'center', color: '#cbd5e1' }}>Shortest Distance</td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#38bdf8' }}>
                          Traffic-Aware Dijkstra
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>Route Distance</td>
                        <td style={{ textAlign: 'center' }}>
                          {activeScenario.routingComparison.baselineRoute.distanceKm} km
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {activeScenario.routingComparison.uyirkappanRoute.distanceKm} km
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>Congestion Encountered</td>
                        <td style={{ textAlign: 'center', color: '#ef4444' }}>
                          {activeScenario.routingComparison.baselineRoute.traffic}
                        </td>
                        <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>
                          {activeScenario.routingComparison.uyirkappanRoute.traffic}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 12px', fontWeight: 800 }}>Estimated Travel Time (ETA)</td>
                        <td style={{ textAlign: 'center', fontSize: '16px', fontWeight: 700, color: '#94a3b8' }}>
                          {activeScenario.routingComparison.baselineRoute.etaMinutes} min
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '18px', fontWeight: 900, color: '#10b981' }}>
                          {activeScenario.routingComparison.uyirkappanRoute.etaMinutes} min ★
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DemoScenariosPage;
