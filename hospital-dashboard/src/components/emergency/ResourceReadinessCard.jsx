import { ShieldCheck, AlertTriangle, BedDouble, HeartPulse, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ResourceReadinessCard({ emergency, hospitalResources }) {
  if (!emergency) return null;

  // Check hospital capacity
  const icuAvailable = hospitalResources?.icuBeds || 0;
  const generalAvailable = hospitalResources?.generalBeds || 0;
  const ventAvailable = hospitalResources?.ventilators || 0;

  const isCardiac = emergency.emergencyType === 'CARDIAC';
  const isRespiratory = emergency.emergencyType === 'RESPIRATORY';
  const isTrauma = emergency.emergencyType === 'TRAUMA' || emergency.emergencyType === 'ACCIDENT';

  let readinessStatus = 'READY';
  let readinessMessage = 'Hospital has adequate emergency units prepared.';

  if (isCardiac && icuAvailable < 1) {
    readinessStatus = 'CRITICAL_SHORTAGE';
    readinessMessage = 'CRITICAL: 0 ICU beds currently available for inbound STEMI/Cardiac patient!';
  } else if (isRespiratory && ventAvailable < 1) {
    readinessStatus = 'CRITICAL_SHORTAGE';
    readinessMessage = 'CRITICAL: No mechanical ventilators available for acute respiratory distress!';
  } else if (isTrauma && generalAvailable < emergency.victimCount) {
    readinessStatus = 'LIMITED_CAPACITY';
    readinessMessage = `WARNING: Limited beds (${generalAvailable} general beds for ${emergency.victimCount} victims).`;
  }

  const isCritical = readinessStatus === 'CRITICAL_SHORTAGE';
  const isWarning = readinessStatus === 'LIMITED_CAPACITY';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${isCritical ? 'var(--status-critical-border)' : isWarning ? 'var(--status-warning-border)' : 'var(--status-success-border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        boxShadow: isCritical ? 'var(--shadow-glow-red)' : 'var(--shadow-sm)',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isCritical
                ? 'var(--status-critical-bg)'
                : isWarning
                ? 'var(--status-warning-bg)'
                : 'var(--status-success-bg)',
              color: isCritical
                ? 'var(--status-critical)'
                : isWarning
                ? 'var(--status-warning)'
                : 'var(--status-success)',
            }}
          >
            {isCritical || isWarning ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Advance Resource Preparation Check
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automated correlation between incident protocol and facility capacity
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isCritical
              ? 'var(--status-critical-bg)'
              : isWarning
              ? 'var(--status-warning-bg)'
              : 'var(--status-success-bg)',
            color: isCritical
              ? 'var(--status-critical)'
              : isWarning
              ? 'var(--status-warning)'
              : 'var(--status-success)',
            border: `1px solid ${isCritical ? 'var(--status-critical-border)' : isWarning ? 'var(--status-warning-border)' : 'var(--status-success-border)'}`,
          }}
        >
          {isCritical ? 'CAPACITY SHORTAGE' : isWarning ? 'LIMITED PREPARATION' : 'PREPARED & CLEARED'}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: isCritical ? 'var(--status-critical)' : 'var(--text-secondary)', marginBottom: '16px' }}>
        {readinessMessage}
      </p>

      {/* Specialty Checklist */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <HeartPulse size={16} style={{ color: icuAvailable > 0 ? 'var(--status-success)' : 'var(--status-critical)' }} />
          <span>ICU Beds Available: <strong>{icuAvailable}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <BedDouble size={16} style={{ color: generalAvailable > 0 ? 'var(--status-success)' : 'var(--status-critical)' }} />
          <span>General Beds: <strong>{generalAvailable}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <Wind size={16} style={{ color: ventAvailable > 0 ? 'var(--status-success)' : 'var(--status-critical)' }} />
          <span>Ventilators: <strong>{ventAvailable}</strong></span>
        </div>
      </div>

      <div style={{ marginTop: '14px', textAlign: 'right' }}>
        <Link
          to="/resources"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--status-info)',
          }}
        >
          Manage Hospital Capacity Allocation →
        </Link>
      </div>
    </div>
  );
}

export default ResourceReadinessCard;
