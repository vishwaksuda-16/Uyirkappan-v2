import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Database,
  Layers,
  Activity,
  Cpu,
  Info,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const PROVENANCE_TABLE = [
  {
    artifact: 'Road Network Graph',
    scope: '70 nodes, 182 road segments, 351 edges',
    classification: 'STATIC / DERIVED',
    source: 'Chennai road network dataset (JSON/Graph)',
    notes: 'Primary topology for Dijkstra path computation and traffic weighting.'
  },
  {
    artifact: 'Road Geometry KML',
    scope: '34,042 Placemarks, 60,382 LineStrings, 741,740 coords (~33.7 MB)',
    classification: 'STATIC REFERENCE',
    source: 'Chennai GIS Open Data (KML format)',
    notes: 'Reference polyline geometry for route visualization. Lacks one-way, lane, and elevation metadata.'
  },
  {
    artifact: 'Ambulance Reference Fleet',
    scope: '30 pre-registered ambulances, 30 hospital points',
    classification: 'REFERENCE / BASELINE',
    source: 'dummy_ambulance_data.xlsx',
    notes: 'Reference baseline; NOT active live GPS operational fleet.'
  },
  {
    artifact: 'Traffic Conditions',
    scope: 'Dynamic multipliers (1.0x, 1.35x, 2.1x, Infinity)',
    classification: 'SIMULATED TRAFFIC',
    source: 'SimulationTrafficProvider (isLive: false)',
    notes: 'Pluggable architecture ready for live TomTom/Google Maps API integration.'
  },
  {
    artifact: 'GPS Telemetry Provider',
    scope: 'RealGpsLocationProvider vs SimulationLocationProvider',
    classification: 'REAL / SIMULATION',
    source: 'Flutter Location Provider & Backend Telemetry Engine',
    notes: 'Strict multi-cue distinction: ● GPS LIVE (REAL) vs ○ GPS SIMULATION with 45s staleness rule.'
  },
  {
    artifact: '108 Historical Benchmark',
    scope: '50 emergency incidents (94% Madurai, 6% Other)',
    classification: 'REFERENCE BASELINE',
    source: 'dummy_ambulance_data.xlsx (108 records)',
    notes: 'Mean: 11.08m, Benchmark: 14.58m, 72% compliance. Non-causal contextual reference.'
  },
  {
    artifact: 'Dispatch Scoring Formula',
    scope: '50% Travel Time, 20% Distance, 20% Traffic, 10% Availability',
    classification: 'DETERMINISTIC MODEL',
    source: 'AmbulanceMatchingService',
    notes: 'Weighted cost index; uses Haversine + Dijkstra (H3 hexagonal indexing is architectural design).'
  }
];

export default function ProvenanceLimitationsPage() {
  const [dataStatus, setDataStatus] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/data-status`)
      .then((res) => res.json())
      .then((data) => setDataStatus(data))
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="research-kicker">Academic Rigor & Data Provenance</div>
      <h1 className="research-title">Data Provenance & System Limitations</h1>
      <p className="research-lede">
        Explicitly documenting data classifications, experimental boundaries, model assumptions, and reproducibility constraints.
      </p>

      {/* Provenance Matrix Section */}
      <div className="research-card full" style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Database size={20} style={{ color: 'var(--research-cyan)' }} />
          <h2 style={{ margin: 0, fontSize: 18 }}>Authoritative Data Provenance Matrix</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--research-muted)', marginBottom: 20 }}>
          Every metric, route, and evaluation result in UyirKappan is tagged with its authoritative data classification to prevent empirical ambiguity.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="candidate-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Artifact / Subsystem</th>
                <th>Scope & Metrics</th>
                <th>Classification</th>
                <th>Data Source</th>
                <th>Scientific Notes</th>
              </tr>
            </thead>
            <tbody>
              {PROVENANCE_TABLE.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{row.artifact}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.scope}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 4,
                        letterSpacing: '0.04em',
                        backgroundColor:
                          row.classification.includes('REAL')
                            ? 'rgba(16, 185, 129, 0.15)'
                            : row.classification.includes('SIMULAT')
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(56, 189, 248, 0.15)',
                        color:
                          row.classification.includes('REAL')
                            ? '#10b981'
                            : row.classification.includes('SIMULAT')
                            ? '#f59e0b'
                            : '#38bdf8',
                        border: '1px solid currentColor',
                      }}
                    >
                      {row.classification}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--research-muted)' }}>{row.source}</td>
                  <td style={{ fontSize: 12 }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture & Formula Realities */}
      <div className="research-grid" style={{ marginTop: 24 }}>
        <div className="research-card wide">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Cpu size={18} style={{ color: 'var(--research-cyan)' }} />
            <h2 style={{ margin: 0, fontSize: 16 }}>Dispatch Architecture: Fact vs Documented Design</h2>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--research-muted)' }}>
            <p>
              <strong style={{ color: 'var(--research-ink)' }}>Current Matcher:</strong> The active intelligent dispatch engine employs 
              <strong> Haversine coordinate snapping + Dijkstra shortest-path routing</strong> over the 70-node Chennai arterial network.
            </p>
            <p style={{ marginTop: 10 }}>
              <strong style={{ color: 'var(--research-ink)' }}>H3 Spatial Indexing:</strong> Documented as a multi-resolution geospatial architecture 
              concept for partitioned metropolitan dispatch. It is <strong style={{ color: 'var(--research-amber)' }}>NOT</strong> executing the active matching loop in the current repository code.
            </p>
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(17, 38, 56, 0.6)', borderLeft: '3px solid var(--research-cyan)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--research-cyan)' }}>Dispatch Scoring Weights:</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--research-ink)', marginTop: 4 }}>
                Score = 0.50 × TravelTime + 0.20 × Distance + 0.20 × Traffic + 0.10 × Availability
              </div>
            </div>
          </div>
        </div>

        <div className="research-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <ShieldAlert size={18} style={{ color: 'var(--research-coral)' }} />
            <h2 style={{ margin: 0, fontSize: 16 }}>108 Baseline Honest Boundary</h2>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--research-muted)' }}>
            <p>
              The 108 ambulance dataset from <code>dummy_ambulance_data.xlsx</code> is a 
              <strong> reference benchmark</strong> (50 records), not a controlled causal trial.
            </p>
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              <li>94% of sample cases are from Madurai, not Chennai metropolitan roads.</li>
              <li>Does not contain GPS breadcrumbs for route replay.</li>
              <li>UyirKappan does <strong>NOT</strong> claim clinical superiority or mortality reduction over 108.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Explicit Research Limitations */}
      <div className="research-card full" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} style={{ color: 'var(--research-amber)' }} />
          <h2 style={{ margin: 0, fontSize: 18 }}>Known System & Research Limitations</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <div style={{ padding: '14px', background: 'rgba(8, 19, 31, 0.6)', border: '1px solid var(--research-line)' }}>
            <h3 style={{ fontSize: 14, color: 'var(--research-cyan)', margin: '0 0 8px 0' }}>1. Geospatial & Routing Limits</h3>
            <p style={{ fontSize: 12, color: 'var(--research-muted)', margin: 0, lineHeight: 1.6 }}>
              The 33.7 MB KML provides reference geometries but lacks one-way constraints, turn restrictions, bridge elevations, and dynamic lane counts.
            </p>
          </div>

          <div style={{ padding: '14px', background: 'rgba(8, 19, 31, 0.6)', border: '1px solid var(--research-line)' }}>
            <h3 style={{ fontSize: 14, color: 'var(--research-amber)', margin: '0 0 8px 0' }}>2. Traffic Simulation Model</h3>
            <p style={{ fontSize: 12, color: 'var(--research-muted)', margin: 0, lineHeight: 1.6 }}>
              Live citywide real-time traffic is simulated via deterministic congestion multipliers. No production TomTom or OpenStreetMap live API feeds are currently active.
            </p>
          </div>

          <div style={{ padding: '14px', background: 'rgba(8, 19, 31, 0.6)', border: '1px solid var(--research-line)' }}>
            <h3 style={{ fontSize: 14, color: 'var(--research-coral)', margin: '0 0 8px 0' }}>3. Deployment & Clinical Boundary</h3>
            <p style={{ fontSize: 12, color: 'var(--research-muted)', margin: 0, lineHeight: 1.6 }}>
              UyirKappan is a research-grade simulation and coordination platform. It is not an operational 108 dispatch replacement, clinical decision support system, or hospital EHR system.
            </p>
          </div>
        </div>
      </div>

      {/* Reproducibility Guide */}
      <div className="research-card full" style={{ marginTop: 24, marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <FileText size={18} style={{ color: 'var(--research-cyan)' }} />
          <h2 style={{ margin: 0, fontSize: 16 }}>Evaluation Reproducibility Checklist</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--research-muted)', marginBottom: 14 }}>
          Independent evaluators and jury members can verify system behavior using the following verified command matrix:
        </p>

        <div style={{ background: 'rgba(8, 19, 31, 0.8)', padding: '14px', border: '1px solid var(--research-line)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <div style={{ color: 'var(--research-muted)' }}># 1. Backend Core & Mathematical Routing Suites (165 tests):</div>
          <div style={{ color: 'var(--research-cyan)', margin: '4px 0 10px' }}>cd backend && npm test</div>

          <div style={{ color: 'var(--research-muted)' }}># 2. Driver Flutter Mobile App Tests (69 tests):</div>
          <div style={{ color: 'var(--research-cyan)', margin: '4px 0 10px' }}>cd driver_app && flutter test</div>

          <div style={{ color: 'var(--research-muted)' }}># 3. Bystander Flutter Mobile App Tests (46 tests):</div>
          <div style={{ color: 'var(--research-cyan)', margin: '4px 0 10px' }}>cd bystander_app && flutter test</div>

          <div style={{ color: 'var(--research-muted)' }}># 4. Hospital Operations Dashboard Verification (30 tests):</div>
          <div style={{ color: 'var(--research-cyan)', margin: '4px 0 0' }}>cd hospital-dashboard && node test/checklist_verification.test.js && node test/phase11_ui_ux.test.js</div>
        </div>
      </div>
    </div>
  );
}
