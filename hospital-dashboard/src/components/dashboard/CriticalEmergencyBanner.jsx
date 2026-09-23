import { useNavigate } from 'react-router-dom';
import { Siren, Clock, Truck, Users, ArrowRight } from 'lucide-react';
import { formatEta } from '../../utils/formatters';

export function CriticalEmergencyBanner({ emergency }) {
  const navigate = useNavigate();

  if (!emergency) return null;

  const isVeryUrgent = (emergency.eta || 10) <= 6;

  return (
    <div
      className={isVeryUrgent ? 'animate-flash-urgent' : ''}
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid var(--status-critical-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: isVeryUrgent ? 'var(--shadow-glow-red)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: 'var(--status-critical)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
          }}
        >
          <Siren size={24} className="animate-pulse" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--status-critical)',
                textTransform: 'uppercase',
              }}
            >
              Priority Inbound Patient
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
            <span
              className="tabular-nums font-mono"
              style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}
            >
              {emergency.requestId}
            </span>
          </div>

          <div
            style={{
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '2px 0',
            }}
          >
            {emergency.emergencyType} Alert: Advance ER Preparation Required
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Truck size={13} style={{ color: 'var(--status-info)' }} />
              {emergency.ambulanceId} ({emergency.driverName || 'Driver'})
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={13} style={{ color: 'var(--status-info)' }} />
              {emergency.victimCount} {emergency.victimCount === 1 ? 'Patient' : 'Patients'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: ETA & Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Dynamic ETA
          </div>
          <div
            className="tabular-nums font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--status-critical)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={20} />
            <span>{formatEta(emergency.eta)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/emergency/${emergency.requestId}`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--status-critical)',
            color: '#ffffff',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--status-critical)')}
        >
          <span>Open Dossier & Track</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default CriticalEmergencyBanner;
