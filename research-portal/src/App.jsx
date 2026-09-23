import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  ExternalLink,
  FlaskConical,
  GitCompare,
  Map,
  Network,
  Radio,
} from 'lucide-react';
import ExperimentalResultsPage from '../../hospital-dashboard/src/pages/Experiments/ExperimentalResultsPage.jsx';
import { EvidencePage } from '../../hospital-dashboard/src/pages/Evidence/EvidencePage.jsx';
import { EvidenceWorkflow } from '../../hospital-dashboard/src/pages/Evidence/EvidenceWorkflow.jsx';
import { EvidenceMatching } from '../../hospital-dashboard/src/pages/Evidence/EvidenceMatching.jsx';
import { EvidenceRouteComparison } from '../../hospital-dashboard/src/pages/Evidence/EvidenceRouteComparison.jsx';
import { EvidenceLiveTracking } from '../../hospital-dashboard/src/pages/Evidence/EvidenceLiveTracking.jsx';
import { EvidenceFallback } from '../../hospital-dashboard/src/pages/Evidence/EvidenceFallback.jsx';
import OverviewPage from './pages/OverviewPage.jsx';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const navItems = [
  { to: '/', label: 'Research overview', icon: BookOpen, end: true },
  { to: '/experiments', label: 'Results & experiments', icon: BarChart3 },
  { to: '/evidence', label: 'Proof catalogue', icon: FlaskConical },
];

const visualLinks = [
  { href: `${API_ORIGIN}/network-map.html`, label: 'Node network', icon: Network },
  { href: `${API_ORIGIN}/traffic-visualization.html`, label: 'Traffic & GPS', icon: Radio },
  { href: `${API_ORIGIN}/comparison-dashboard.html`, label: 'Baseline comparison', icon: GitCompare },
];

function ResearchShell({ children }) {
  const location = useLocation();

  return (
    <div className="research-app">
      <header className="research-topbar">
        <NavLink to="/" className="research-brand">
          <div className="research-mark">UK</div>
          <div>
            <strong>UyirKappan Research</strong>
            <span>Evidence and evaluation workspace</span>
          </div>
        </NavLink>
        <a className="research-toplink" href="http://localhost:5000/api/health" target="_blank" rel="noreferrer">
          Backend health <ExternalLink size={12} />
        </a>
      </header>

      <div className="research-frame">
        <aside className="research-sidebar">
          <div className="research-nav-label">Research</div>
          <nav className="research-nav" aria-label="Research navigation">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} title={label}>
                <Icon size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="research-nav-label" style={{ marginTop: 34 }}>Live visualizations</div>
          <nav className="research-nav" aria-label="Visualization links">
            {visualLinks.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} target="_blank" rel="noreferrer" title={label}>
                <Icon size={17} />
                <span>{label}</span>
                <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
              </a>
            ))}
          </nav>

          <div style={{ marginTop: 34, padding: '12px', color: 'var(--research-muted)', fontSize: 11, lineHeight: 1.6 }}>
            <Activity size={15} style={{ color: 'var(--research-cyan)', marginBottom: 6 }} />
            <div>Separate from hospital operations.</div>
            <div>Built for review, demonstration, and paper figures.</div>
          </div>
        </aside>

        <main className="research-main">
          <div className="research-route">{children}</div>
          {location.pathname !== '/' && (
            <div style={{ marginTop: 46, color: 'var(--research-muted)', fontSize: 11 }}>
              UyirKappan research portal · Chennai emergency dispatch evaluation
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ResearchShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/experiments" element={<ExperimentalResultsPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/evidence/workflow" element={<EvidenceWorkflow />} />
        <Route path="/evidence/matching" element={<EvidenceMatching />} />
        <Route path="/evidence/route-comparison" element={<EvidenceRouteComparison />} />
        <Route path="/evidence/live-tracking" element={<EvidenceLiveTracking />} />
        <Route path="/evidence/fallback" element={<EvidenceFallback />} />
      </Routes>
    </ResearchShell>
  );
}
