import { Clock, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatEta, formatTimestamp } from '../../utils/formatters';

/**
 * Dynamic ETA Widget
 * Primary Source: Module 3 (Section 12, 13) & Module 6 (Section 9, 10)
 */
export function DynamicEtaWidget({
  eta,
  initialEta,
  trafficCondition = 'NORMAL',
  updatedAt,
  isStale = false,
}) {
  const getTrafficDetails = () => {
    switch (trafficCondition?.toUpperCase()) {
      case 'HIGH':
      case 'HEAVY':
        return {
          label: 'Heavy Traffic (+3m)',
          color: 'var(--status-critical)',
          bg: 'var(--status-critical-bg)',
          border: 'var(--status-critical-border)',
          icon: TrendingUp,
        };
      case 'MODERATE':
        return {
          label: 'Moderate Congestion',
          color: 'var(--status-warning)',
          bg: 'var(--status-warning-bg)',
          border: 'var(--status-warning-border)',
          icon: TrendingUp,
        };
      case 'LOW':
      case 'CLEAR':
        return {
          label: 'Clear Corridor (-1m)',
          color: 'var(--status-success)',
          bg: 'var(--status-success-bg)',
          border: 'var(--status-success-border)',
          icon: TrendingDown,
        };
      default:
        return {
          label: 'Normal Traffic Flow',
          color: 'var(--status-info)',
          bg: 'var(--status-info-bg)',
          border: 'var(--status-info-border)',
          icon: TrendingDown,
        };
    }
  };

  const traffic = getTrafficDetails();
  const TrafficIcon = traffic.icon;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Clock size={14} style={{ color: 'var(--status-info)' }} />
          <span>Dynamic ETA to Facility</span>
        </span>

        {/* Traffic Condition Badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            color: traffic.color,
            backgroundColor: traffic.bg,
            border: `1px solid ${traffic.border}`,
          }}
        >
          <TrafficIcon size={12} />
          <span>{traffic.label}</span>
        </span>
      </div>

      {/* Main Dynamic ETA Display */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '4px 0' }}>
        <span
          className="tabular-nums font-mono"
          style={{
            fontSize: '36px',
            fontWeight: 800,
            color: eta <= 5 ? 'var(--status-critical)' : 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          {formatEta(eta)}
        </span>

        {initialEta && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Initial Dispatch ETA: <strong style={{ color: 'var(--text-secondary)' }}>{formatEta(initialEta)}</strong>
          </span>
        )}
      </div>

      {/* Telemetry Recalculation Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <span>Continuously calculated via Central Route Engine</span>
        <span className="tabular-nums font-mono">
          Last updated: {formatTimestamp(updatedAt || new Date())}
        </span>
      </div>

      {isStale && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            backgroundColor: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--status-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={13} />
          <span>ETA temporarily static due to delayed vehicle telemetry</span>
        </div>
      )}
    </div>
  );
}

export default DynamicEtaWidget;
