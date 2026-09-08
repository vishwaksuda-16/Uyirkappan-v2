import { Link } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import UrgencyBadge from '../common/UrgencyBadge';
import { ArrowLeft, Users, Clock, Calendar } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export function EmergencyDetailHeader({ emergency }) {
  if (!emergency) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: '24px',
      }}
    >
      {/* Top row: Back link + Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ArrowLeft size={16} />
          <span>Return to Command Feed</span>
        </Link>

        <StatusBadge status={emergency.status} size="md" />
      </div>

      {/* Main Title Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h1
            className="tabular-nums font-mono"
            style={{
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {emergency.requestId}
          </h1>

          <UrgencyBadge type={emergency.emergencyType} showPriority={true} size="md" />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid var(--status-info-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--status-info)',
            }}
          >
            <Users size={14} />
            <span>
              {emergency.victimCount} {emergency.victimCount === 1 ? 'Patient' : 'Patients'} Inbound
            </span>
          </div>
        </div>

        {/* Timestamps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} />
            <span>Dispatched: {formatDateTime(emergency.createdAt)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            <span>Telemetry: {formatRelativeTime(emergency.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmergencyDetailHeader;
