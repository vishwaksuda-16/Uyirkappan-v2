import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import UrgencyBadge from '../common/UrgencyBadge';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorAlert from '../common/ErrorAlert';
import { Truck, Users, MapPin, ChevronRight, GitFork } from 'lucide-react';
import { formatEta, formatCoordinates } from '../../utils/formatters';

export function IncomingEmergencyList({
  emergencies = [],
  isLoading = false,
  error = null,
  onRetry,
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingSpinner message="Receiving live incoming emergency feed..." />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={onRetry} />;
  }

  const activeEmergencies = emergencies.filter((e) => e.status !== 'COMPLETED');

  if (activeEmergencies.length === 0) {
    return (
      <EmptyState
        title="No Inbound Ambulances"
        description="The hospital emergency bay is currently clear. Real-time notifications will alert the team as soon as an ambulance is assigned."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {activeEmergencies.map((emergency) => {
        const isCritical = emergency.emergencyType === 'CARDIAC' || emergency.emergencyType === 'TRAUMA';
        const isVeryUrgent = (emergency.eta || 10) <= 6;
        const hasFallback = (emergency.fallbackCount || 0) > 0;

        return (
          <div
            key={emergency.requestId}
            onClick={() => navigate(`/emergency/${emergency.requestId}`)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${isCritical ? 'var(--status-critical-border)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.borderColor = isCritical ? 'var(--status-critical)' : 'var(--border-focus)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.borderColor = isCritical ? 'var(--status-critical-border)' : 'var(--border-default)';
            }}
          >
            {/* Left Color Accent Bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                backgroundColor: isCritical ? 'var(--status-critical)' : 'var(--status-info)',
              }}
            />

            {/* Main Info Columns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, minWidth: 0 }}>
              {/* Request ID & Urgency Badge */}
              <div style={{ minWidth: '150px' }}>
                <div
                  className="tabular-nums font-mono"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {emergency.requestId}
                </div>
                <UrgencyBadge type={emergency.emergencyType} size="sm" />
              </div>

              {/* Patient Count & Status */}
              <div style={{ minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  <Users size={14} style={{ color: 'var(--status-info)' }} />
                  <span>
                    {emergency.victimCount} {emergency.victimCount === 1 ? 'Patient' : 'Patients'}
                  </span>
                </div>
                <StatusBadge status={emergency.status} size="sm" />
              </div>

              {/* Assigned Ambulance & Fallback */}
              <div style={{ minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>
                  <Truck size={14} style={{ color: 'var(--status-info)' }} />
                  <span>{emergency.ambulanceId}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {emergency.driverName || 'Driver Assigned'}
                </div>
                {hasFallback && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--status-warning)',
                      marginTop: '2px',
                    }}
                  >
                    <GitFork size={11} />
                    <span>Fallback Active</span>
                  </div>
                )}
              </div>

              {/* Current Location & GPS Coordinates (Checklist Section 2, 5, 22) */}
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <MapPin size={13} style={{ color: 'var(--status-critical)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emergency.currentLocation?.address || emergency.location?.address || 'Transit corridor'}
                  </span>
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  GPS: {formatCoordinates(emergency.currentLocation?.latitude ?? emergency.location?.latitude ?? 13.0658, emergency.currentLocation?.longitude ?? emergency.location?.longitude ?? 80.2541)}
                </div>
              </div>
            </div>

            {/* Right ETA Capsule & Chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ETA
                </div>
                <div
                  className="tabular-nums font-mono"
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: isVeryUrgent ? 'var(--status-critical)' : 'var(--status-info)',
                    lineHeight: 1.1,
                  }}
                >
                  {formatEta(emergency.eta)}
                </div>
              </div>

              <div
                style={{
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IncomingEmergencyList;
