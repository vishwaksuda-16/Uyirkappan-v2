import { STATUS_CONFIG, EMERGENCY_STATUS } from '../../constants/statusConstants';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  UserCheck,
  Building2,
  XCircle,
} from 'lucide-react';

export function StatusBadge({ status, showIcon = true, size = 'md' }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'UNKNOWN',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
  };

  const renderIcon = () => {
    if (!showIcon) return null;
    const iconSize = size === 'sm' ? 12 : 14;

    switch (status) {
      case EMERGENCY_STATUS.ASSIGNED:
      case EMERGENCY_STATUS.ACCEPTED:
      case EMERGENCY_STATUS.DRIVER_ACCEPTED:
        return <UserCheck size={iconSize} />;
      case EMERGENCY_STATUS.EN_ROUTE_TO_PATIENT:
      case EMERGENCY_STATUS.EN_ROUTE_TO_HOSPITAL:
        return <Truck size={iconSize} className="animate-pulse" />;
      case EMERGENCY_STATUS.ARRIVED_AT_PATIENT:
      case EMERGENCY_STATUS.PATIENT_ONBOARD:
        return <AlertCircle size={iconSize} />;
      case EMERGENCY_STATUS.ARRIVED_AT_HOSPITAL:
      case EMERGENCY_STATUS.ARRIVED:
        return <Building2 size={iconSize} />;
      case EMERGENCY_STATUS.COMPLETED:
        return <CheckCircle2 size={iconSize} />;
      case EMERGENCY_STATUS.TIMEOUT:
      case EMERGENCY_STATUS.REJECTED:
      case EMERGENCY_STATUS.NO_AMBULANCE_AVAILABLE:
        return <XCircle size={iconSize} />;
      case EMERGENCY_STATUS.FALLBACK:
        return <RotateCcw size={iconSize} className="animate-spin" />;
      default:
        return <Clock size={iconSize} />;
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
        borderRadius: 'var(--radius-full)',
        fontSize: isSmall ? '11px' : '12px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        whiteSpace: 'nowrap',
      }}
    >
      {renderIcon()}
      <span>{config.label}</span>
    </span>
  );
}

export default StatusBadge;
