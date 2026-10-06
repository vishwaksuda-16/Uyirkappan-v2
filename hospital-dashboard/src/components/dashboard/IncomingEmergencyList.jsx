import StatusBadge from '../common/StatusBadge';
import UrgencyBadge from '../common/UrgencyBadge';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorAlert from '../common/ErrorAlert';
import { Truck, Users } from 'lucide-react';
import { formatEta } from '../../utils/formatters';

export function IncomingEmergencyList({
  emergencies = [],
  isLoading = false,
  error = null,
  onRetry,
}) {
  if (isLoading) {
    return <LoadingSpinner message="Loading inbound emergencies..." />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={onRetry} />;
  }

  if (emergencies.length === 0) {
    return (
      <EmptyState
        title="No inbound emergencies"
        description="New ambulance arrivals will appear here."
      />
    );
  }

  return (
    <div className="emergency-list">
      {emergencies.map((emergency) => {
        const urgent = (emergency.eta ?? 10) <= 6;
        return (
          <article className="emergency-row" key={emergency.requestId}>
            <div className="emergency-row-primary">
              <span className="emergency-row-id">{emergency.requestId}</span>
              <UrgencyBadge type={emergency.emergencyType} size="sm" />
            </div>

            <div className="emergency-row-meta emergency-row-patients">
              <span className="emergency-row-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Users size={14} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                {emergency.victimCount ?? 1} {emergency.victimCount === 1 ? 'patient' : 'patients'}
              </span>
              <span className="emergency-row-label">
                <StatusBadge status={emergency.status} size="sm" />
              </span>
            </div>

            <div className="emergency-row-meta emergency-row-ambulance">
              <span className="emergency-row-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Truck size={14} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                {emergency.ambulanceId || 'Assigning ambulance'}
              </span>
              <span className="emergency-row-label">Ambulance</span>
            </div>

            <div className={`emergency-row-eta${urgent ? ' is-urgent' : ''}`}>
              <span className="emergency-row-label">ETA</span>
              <br />
              <strong>{formatEta(emergency.eta)}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default IncomingEmergencyList;
