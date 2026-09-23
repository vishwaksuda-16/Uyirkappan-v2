/**
 * RouteLegend — Consistent route map legend used across all evidence views
 */
export function RouteLegend({ showHospital = true }) {
  return (
    <div className="route-legend">
      <div className="route-legend-item">
        <div className="route-legend-line route-legend-line--uyirkappan" />
        <span style={{ color: 'var(--route-uyirkappan)' }}>UyirKappan Selected Route</span>
      </div>
      <div className="route-legend-item">
        <div className="route-legend-line route-legend-line--baseline" />
        <span style={{ color: 'var(--route-baseline)' }}>Baseline Route</span>
      </div>
      <div className="route-legend-item">
        <div className="route-legend-dot" style={{ backgroundColor: 'var(--status-info)' }} />
        <span>Ambulance</span>
      </div>
      <div className="route-legend-item">
        <div className="route-legend-dot" style={{ backgroundColor: 'var(--status-critical)' }} />
        <span>Incident / Patient</span>
      </div>
      {showHospital && (
        <div className="route-legend-item">
          <div className="route-legend-dot" style={{ backgroundColor: 'var(--status-success)' }} />
          <span>Hospital</span>
        </div>
      )}
    </div>
  );
}

export default RouteLegend;
