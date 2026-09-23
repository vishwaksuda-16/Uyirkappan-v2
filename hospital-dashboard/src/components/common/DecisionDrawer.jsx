import { X, HelpCircle, Star, ArrowRight, TrendingUp, MapPin, Clock, Truck, Building2, Route } from 'lucide-react';

/**
 * DecisionDrawer — Slide-out panel explaining algorithmic decisions
 * "WHY THIS AMBULANCE?", "WHY THIS HOSPITAL?", "WHY THIS ROUTE?"
 */
export function DecisionDrawer({ isOpen, onClose, type, data }) {
  if (!isOpen || !data) return null;

  const titles = {
    ambulance: 'Why This Ambulance?',
    hospital: 'Why This Hospital?',
    route: 'Why This Route?',
  };

  const icons = {
    ambulance: Truck,
    hospital: Building2,
    route: Route,
  };

  const Icon = icons[type] || HelpCircle;

  return (
    <>
      <div className="decision-drawer-overlay" onClick={onClose} />
      <div className="decision-drawer">
        <div className="decision-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-purple-bg)', border: '1px solid var(--status-purple-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-purple)',
            }}>
              <Icon size={20} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {titles[type] || 'Decision Explanation'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Decision Intelligence Analysis
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            padding: '8px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-card)',
          }}>
            <X size={16} />
          </button>
        </div>

        <div className="decision-drawer-body">
          {type === 'ambulance' && <AmbulanceDecision data={data} />}
          {type === 'hospital' && <HospitalDecision data={data} />}
          {type === 'route' && <RouteDecision data={data} />}
        </div>
      </div>
    </>
  );
}

function SectionTitle({ children, icon: SIcon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px',
    }}>
      {SIcon && <SIcon size={13} />}
      {children}
    </div>
  );
}

function DataRow({ label, value, highlight, mono }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontSize: 'var(--text-sm)', fontWeight: 600,
        color: highlight ? 'var(--status-success)' : 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>
        {value ?? 'N/A'}
      </span>
    </div>
  );
}

function FactorBar({ label, value, percentage, color }) {
  const pct = typeof percentage === 'number' ? percentage : 50;
  return (
    <div className="factor-bar-item">
      <div className="factor-bar-label">
        <span>{label}</span>
        <span style={{ color: 'var(--text-primary)' }}>{value || `${pct}%`}</span>
      </div>
      <div className="factor-bar-track">
        <div className="factor-bar-fill" style={{
          width: `${Math.min(100, Math.max(5, pct))}%`,
          background: color || 'linear-gradient(90deg, var(--status-info), var(--status-success))',
        }} />
      </div>
    </div>
  );
}

function AmbulanceDecision({ data }) {
  const { selectedAmbulance, candidates, weights, decisionReason } = data;
  const sel = selectedAmbulance || {};

  const weightMap = weights || { travelTime: '50%', distance: '20%', traffic: '20%', availability: '10%' };

  return (
    <>
      {/* Selected Ambulance Card */}
      <div className="eoc-card eoc-card--prominent" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Star size={16} style={{ color: 'var(--status-success)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.06em' }}>
            ★ SELECTED
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {sel.ambulanceId || 'N/A'}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {sel.driverName || 'Driver'}
        </div>
        {sel.score !== undefined && (
          <div style={{ marginTop: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Overall Score: <strong style={{ color: 'var(--status-info)', fontFamily: 'var(--font-mono)' }}>{typeof sel.score === 'number' ? sel.score.toFixed(3) : sel.score}</strong>
          </div>
        )}
      </div>

      {/* Factor Weights */}
      <div>
        <SectionTitle icon={TrendingUp}>Scoring Factor Weights</SectionTitle>
        <div className="factor-bar-container">
          <FactorBar label="Travel Time" value={weightMap.travelTime} percentage={parseInt(weightMap.travelTime)} color="var(--status-info)" />
          <FactorBar label="Distance" value={weightMap.distance} percentage={parseInt(weightMap.distance)} color="var(--status-success)" />
          <FactorBar label="Traffic" value={weightMap.traffic} percentage={parseInt(weightMap.traffic)} color="var(--status-warning)" />
          <FactorBar label="Availability" value={weightMap.availability} percentage={parseInt(weightMap.availability)} color="var(--status-purple)" />
        </div>
      </div>

      {/* Candidates */}
      {candidates && candidates.length > 0 && (
        <div>
          <SectionTitle>Candidate Evaluation ({candidates.length} units)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.slice(0, 6).map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                backgroundColor: c.decision === 'SELECTED' ? 'var(--status-success-bg)' : 'var(--bg-card)',
                border: `1px solid ${c.decision === 'SELECTED' ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600,
                    color: c.decision === 'SELECTED' ? 'var(--status-success)' : 'var(--text-primary)',
                  }}>
                    {c.ambulanceId}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {c.distanceKm} km · {c.travelTimeMinutes} min
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {typeof c.score === 'number' ? c.score.toFixed(3) : c.score}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                    backgroundColor: c.decision === 'SELECTED' ? 'var(--status-success-bg)' : 'var(--bg-input)',
                    color: c.decision === 'SELECTED' ? 'var(--status-success)' : 'var(--text-muted)',
                    border: `1px solid ${c.decision === 'SELECTED' ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                  }}>
                    {c.decision === 'SELECTED' ? '★ SELECTED' : 'ALTERNATIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Explanation */}
      <div>
        <SectionTitle icon={HelpCircle}>Decision Explanation</SectionTitle>
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {decisionReason || 'Selected because this candidate provides the strongest overall response score considering route-based travel time, geographical distance, traffic conditions, and operational availability.'}
        </div>
      </div>
    </>
  );
}

function HospitalDecision({ data }) {
  const { selectedHospital, candidates, decisionReason } = data;
  const sel = selectedHospital || {};

  return (
    <>
      <div className="eoc-card eoc-card--prominent" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Star size={16} style={{ color: 'var(--status-success)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.06em' }}>
            ★ SELECTED HOSPITAL
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {sel.name || sel.hospitalName || 'N/A'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
          {sel.hospitalId || sel.id}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
          <DataRow label="Distance" value={`${sel.distanceKm} km`} />
          <DataRow label="ETA" value={`${sel.etaMinutes} min`} />
          <DataRow label="ICU Beds" value={sel.icuBeds} />
          <DataRow label="General Beds" value={sel.generalBeds} />
        </div>
      </div>

      {candidates && candidates.length > 0 && (
        <div>
          <SectionTitle icon={Building2}>Hospital Candidates ({candidates.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {candidates.slice(0, 5).map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                backgroundColor: h.hospitalId === sel.hospitalId ? 'var(--status-success-bg)' : 'var(--bg-card)',
                border: `1px solid ${h.hospitalId === sel.hospitalId ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{h.name || h.hospitalName}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {h.distanceKm} km · {h.etaMinutes} min · ICU: {h.icuBeds} · Gen: {h.generalBeds}
                  </div>
                </div>
                {h.hospitalId === sel.hospitalId && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)',
                    border: '1px solid var(--status-success-border)',
                  }}>★ SELECTED</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionTitle icon={HelpCircle}>Selection Rationale</SectionTitle>
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {decisionReason || 'Hospital selected based on weighted evaluation of travel time, distance, emergency capability, and real-time resource availability.'}
        </div>
      </div>
    </>
  );
}

function RouteDecision({ data }) {
  const { baseline, uyirkappan, comparison, selectedRoute, selectionReason } = data;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Baseline Card */}
        <div className="eoc-card" style={{
          padding: '14px', borderColor: selectedRoute === 'BASELINE' ? 'var(--status-success-border)' : 'var(--border-subtle)',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Baseline Route
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '3px', borderRadius: '2px', background: 'repeating-linear-gradient(90deg, var(--route-baseline) 0, var(--route-baseline) 4px, transparent 4px, transparent 8px)' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Shortest Distance</span>
          </div>
          <DataRow label="Distance" value={`${baseline?.distanceKm || comparison?.baselineDistance} km`} mono />
          <DataRow label="ETA" value={`${baseline?.etaMinutes || comparison?.baselineEta} min`} mono />
          <DataRow label="Traffic" value={baseline?.traffic || 'Standard'} />
        </div>

        {/* UyirKappan Card */}
        <div className="eoc-card" style={{
          padding: '14px', borderColor: selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success-border)' : 'var(--border-subtle)',
          background: selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success-bg)' : undefined,
        }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success)' : 'var(--text-muted)', marginBottom: '8px' }}>
            UyirKappan Route
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '3px', borderRadius: '2px', backgroundColor: 'var(--route-uyirkappan)' }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Traffic-Aware</span>
          </div>
          <DataRow label="Distance" value={`${uyirkappan?.distanceKm || comparison?.uyirkappanDistance} km`} mono />
          <DataRow label="ETA" value={`${uyirkappan?.etaMinutes || comparison?.uyirkappanEta} min`} mono highlight={selectedRoute === 'UYIRKAPPAN'} />
          <DataRow label="Traffic" value={uyirkappan?.traffic || 'Optimized'} />
        </div>
      </div>

      {/* Improvement Summary */}
      {comparison?.improvementPct > 0 && (
        <div className="eoc-card" style={{
          padding: '14px', textAlign: 'center',
          backgroundColor: 'var(--status-success-bg)', borderColor: 'var(--status-success-border)',
        }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.06em' }}>
            ETA Improvement
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>
            {comparison.improvementPct}%
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {comparison.uyirkappanEta} min vs {comparison.baselineEta} min baseline
          </div>
        </div>
      )}

      {/* Decision */}
      <div>
        <SectionTitle icon={HelpCircle}>Route Selection Rationale</SectionTitle>
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {selectionReason || 'Route selected based on real-time traffic conditions and road network analysis.'}
        </div>
      </div>
    </>
  );
}

export default DecisionDrawer;
