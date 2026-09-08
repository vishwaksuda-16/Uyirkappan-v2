import { Bed, HeartPulse, Wind, Plus, Minus } from 'lucide-react';

export function ResourceCard({
  type, // 'generalBeds' | 'icuBeds' | 'ventilators'
  count,
  total = 20,
  onQuickAdjust,
  onEditClick,
  disabled = false,
}) {
  const getResourceMeta = () => {
    switch (type) {
      case 'icuBeds':
        return {
          title: 'ICU Beds',
          subtitle: 'Critical Care Units',
          icon: HeartPulse,
          criticalThreshold: 2,
          warningThreshold: 4,
        };
      case 'ventilators':
        return {
          title: 'Ventilators',
          subtitle: 'Mechanical Respiratory Units',
          icon: Wind,
          criticalThreshold: 1,
          warningThreshold: 2,
        };
      case 'generalBeds':
      default:
        return {
          title: 'General Emergency Beds',
          subtitle: 'Acute Triage Wards',
          icon: Bed,
          criticalThreshold: 4,
          warningThreshold: 8,
        };
    }
  };

  const meta = getResourceMeta();
  const Icon = meta.icon;

  const currentCount = Math.max(0, Number(count) || 0);
  const totalCapacity = Math.max(currentCount, Number(total) || 20);
  const percentage = Math.min(100, Math.round((currentCount / totalCapacity) * 100));

  let statusLevel = 'healthy';
  let accentColor = 'var(--status-success)';
  let bgStatus = 'var(--status-success-bg)';
  let borderStatus = 'var(--status-success-border)';

  if (currentCount <= meta.criticalThreshold) {
    statusLevel = 'critical';
    accentColor = 'var(--status-critical)';
    bgStatus = 'var(--status-critical-bg)';
    borderStatus = 'var(--status-critical-border)';
  } else if (currentCount <= meta.warningThreshold) {
    statusLevel = 'warning';
    accentColor = 'var(--status-warning)';
    bgStatus = 'var(--status-warning-bg)';
    borderStatus = 'var(--status-warning-border)';
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${borderStatus}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: statusLevel === 'critical' ? 'var(--shadow-glow-red)' : 'var(--shadow-sm)',
        transition: 'all 0.15s ease',
      }}
    >
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: bgStatus,
                color: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {meta.title}
              </h4>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{meta.subtitle}</span>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: accentColor,
              backgroundColor: bgStatus,
              border: `1px solid ${borderStatus}`,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {statusLevel === 'critical' ? 'Critical' : statusLevel === 'warning' ? 'Limited' : 'Adequate'}
          </span>
        </div>

        {/* Count Metric */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '14px 0 8px 0' }}>
          <span
            className="tabular-nums font-mono"
            style={{
              fontSize: '38px',
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1,
            }}
          >
            {currentCount}
          </span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            / {totalCapacity} Available
          </span>
        </div>

        {/* Capacity Bar */}
        <div
          style={{
            height: '6px',
            width: '100%',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              backgroundColor: accentColor,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '12px',
        }}
      >
        {onQuickAdjust && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => onQuickAdjust(type, -1)}
              disabled={disabled || currentCount <= 0}
              aria-label={`Decrease ${meta.title}`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentCount <= 0 ? 0.4 : 1,
              }}
            >
              <Minus size={14} />
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 4px' }}>Quick</span>
            <button
              onClick={() => onQuickAdjust(type, 1)}
              disabled={disabled}
              aria-label={`Increase ${meta.title}`}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {onEditClick && (
          <button
            onClick={onEditClick}
            disabled={disabled}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--status-info)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Edit Capacity →
          </button>
        )}
      </div>
    </div>
  );
}

export default ResourceCard;
