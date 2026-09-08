import { EMERGENCY_TYPE_CONFIG, EMERGENCY_TYPES } from '../../constants/statusConstants';
import { HeartPulse, Car, Activity, Wind, Brain, ShieldAlert } from 'lucide-react';

export function UrgencyBadge({ type, showPriority = false, size = 'md' }) {
  const config = EMERGENCY_TYPE_CONFIG[type] || {
    label: type || 'Emergency',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    priority: 'GENERAL',
  };

  const renderIcon = () => {
    const iconSize = size === 'sm' ? 12 : 14;
    switch (type) {
      case EMERGENCY_TYPES.CARDIAC:
        return <HeartPulse size={iconSize} />;
      case EMERGENCY_TYPES.ACCIDENT:
        return <Car size={iconSize} />;
      case EMERGENCY_TYPES.TRAUMA:
        return <Activity size={iconSize} />;
      case EMERGENCY_TYPES.RESPIRATORY:
        return <Wind size={iconSize} />;
      case EMERGENCY_TYPES.STROKE:
        return <Brain size={iconSize} />;
      default:
        return <ShieldAlert size={iconSize} />;
    }
  };

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: isSmall ? '11px' : '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
      }}
    >
      {renderIcon()}
      <span>{config.label}</span>
      {showPriority && (
        <span
          style={{
            marginLeft: '4px',
            fontSize: '10px',
            opacity: 0.8,
            padding: '1px 4px',
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '2px',
          }}
        >
          {config.priority}
        </span>
      )}
    </span>
  );
}

export default UrgencyBadge;
