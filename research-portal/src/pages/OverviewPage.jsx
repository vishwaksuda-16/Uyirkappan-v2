import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, Database, GitCompare, Map, Network, Route, ShieldCheck, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const proofItems = [
  { number: 'E1', title: 'End-to-end coordination', copy: 'One emergency traced across bystander, driver, and hospital applications.', path: '/evidence/workflow' },
  { number: 'E2', title: 'Ambulance matching', copy: 'Candidate scoring shows why the selected unit wins on time, distance, traffic, and availability.', path: '/evidence/matching' },
  { number: 'E3', title: 'Route comparison', copy: 'Shortest-distance baseline compared with the traffic-aware UyirKappan route.', path: '/evidence/route-comparison' },
  { number: 'E4', title: 'Live tracking', copy: 'GPS telemetry, route geometry, status progression, and dynamic ETA in one view.', path: '/evidence/live-tracking' },
  { number: 'E5', title: 'Fallback dispatch', copy: 'Rejection and timeout cascades documented as an auditable dispatch sequence.', path: '/evidence/fallback' },
];

export default function OverviewPage() {
  const [summary, setSummary] = useState(null);
  const [baselineMeta, setBaselineMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/experiments/summary`)
      .then((response) => response.json())
      .then((payload) => setSummary(payload.data || null))
      .catch(() => setError('Start the backend to load the latest evaluation summary.'));

    fetch(`${API_BASE}/evaluation/baseline/metadata`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success && payload.metadata) {
          setBaselineMeta(payload.metadata);
        }
      })
      .catch(() => {});
  }, []);

  const counts = summary?.datasetCounts || {};
  const metrics = [
    { value: counts.emergencyRequests || '3,000', label: 'Emergency requests (Chennai)', icon: Timer },
    { value: counts.roadNodes || '70', label: 'Road-network nodes', icon: Network },
    { value: counts.roadSegments || '182', label: 'Road segments', icon: Route },
    { value: summary?.ambulanceMatching?.etaImprovementPct ? `${summary.ambulanceMatching.etaImprovementPct}%` : 'Traffic-aware', label: 'Dispatch comparison', icon: GitCompare },
  ];

  return (
    <>
      <div className="research-kicker">Research and proof workspace</div>
      <h1 className="research-title">Make the evidence easy to inspect.</h1>
      <p className="research-lede">
        Results, route behaviour, traffic effects, and system proofs live here, away from the hospital command surface. Use this portal for evaluation and demonstrations; use the hospital dashboard for active care operations.
      </p>
      <div className="research-actions">
        <Link className="research-button" to="/experiments">Open evaluation results <ArrowRight size={15} /></Link>
        <Link className="research-button secondary" to="/evidence">Browse proof catalogue <ShieldCheck size={15} /></Link>
      </div>

      <div className="research-grid">
        {metrics.map(({ value, label, icon: Icon }) => (
          <div className="research-card" key={label}>
            <Icon className="research-icon" size={20} />
            <div className="research-stat" style={{ marginTop: 20 }}>{value}</div>
            <div className="research-stat-label">{label}</div>
          </div>
        ))}

        <div className="research-card wide">
          <Database className="research-icon" size={20} />
          <h2>Dataset-backed evaluation</h2>
          <p>Road nodes, segments, traffic conditions, fleet positions, emergency requests, assignments, and GPS trajectories are loaded from the project datasets. The portal presents the measured system behaviour without adding a second source of truth.</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: 4, fontWeight: 600 }}>
              SIMULATION: Chennai 70-Node Network
            </span>
            <span style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderRadius: 4, fontWeight: 600 }}>
              REFERENCE BASELINE: dummy_ambulance_data.xlsx
            </span>
          </div>
          {error && <p style={{ color: 'var(--research-amber)', marginTop: 12 }}>{error}</p>}
        </div>

        <div className="research-card">
          <BarChart3 className="research-icon" size={20} />
          <h2>108 Reference Baseline</h2>
          {baselineMeta ? (
            <div>
              <p style={{ fontSize: 12, margin: '6px 0' }}>
                <strong>{baselineMeta.rowCount} historical cases</strong> ({baselineMeta.primaryDistrict} 94%)
              </p>
              <p style={{ fontSize: 11, color: 'var(--research-muted)', margin: '4px 0' }}>
                Mean Response: <strong>{baselineMeta.statistics?.responseTime?.meanMinutes} min</strong> (Median: {baselineMeta.statistics?.responseTime?.medianMinutes} min)
              </p>
              <p style={{ fontSize: 11, color: 'var(--research-muted)', margin: '4px 0' }}>
                Benchmark compliance: <strong>{baselineMeta.statistics?.responseTime?.benchmarkMetPercentage}%</strong>
              </p>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--research-amber)', fontStyle: 'italic' }}>
                Reference baseline only; not live fleet or Chennai routing coordinates.
              </div>
            </div>
          ) : (
            <p>108 historical response sample from dummy_ambulance_data.xlsx (reference benchmark).</p>
          )}
        </div>

        <div className="research-card full">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="research-kicker">Proof catalogue</div>
              <h2 className="research-section-title">Five focused views for review</h2>
              <p className="research-section-copy">Each proof answers one question about how UyirKappan behaves in a real dispatch flow.</p>
            </div>
            <Link className="research-button secondary" to="/evidence">Open all proofs <ArrowRight size={14} /></Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 22 }}>
            {proofItems.map((item) => (
              <Link key={item.number} to={item.path} style={{ color: 'inherit', textDecoration: 'none', border: '1px solid var(--research-line)', padding: 15, background: 'rgba(8, 19, 31, .4)' }}>
                <div style={{ color: 'var(--research-cyan)', fontSize: 11, fontWeight: 800, letterSpacing: '.1em' }}>{item.number}</div>
                <h3 style={{ fontSize: 14, marginTop: 12 }}>{item.title}</h3>
                <p style={{ fontSize: 12 }}>{item.copy}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="research-card full" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <CheckCircle2 size={22} style={{ color: 'var(--research-cyan)' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: 0 }}>Operational dashboard stays focused</h3>
            <p style={{ marginTop: 5 }}>The hospital app now contains only live command, resources, history, and emergency detail workflows.</p>
          </div>
          <a className="research-button secondary" href="http://localhost:5173" target="_blank" rel="noreferrer">Open hospital app <ExternalLinkIcon /></a>
        </div>
      </div>
    </>
  );
}

function ExternalLinkIcon() {
  return <ArrowRight size={14} />;
}
