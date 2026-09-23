import useEmergency from '../../hooks/useEmergency';
import { AlertCircle, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationToast() {
  const { notifications, dismissNotification } = useEmergency();
  const navigate = useNavigate();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '72px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100vw - 40px)',
      }}
    >
      {notifications.map((n) => {
        const isCritical = n.type === 'critical';
        const isWarning = n.type === 'warning';

        const borderColor = isCritical
          ? 'var(--status-critical-border)'
          : isWarning
          ? 'var(--status-warning-border)'
          : 'var(--border-default)';

        const bgColor = isCritical
          ? 'rgba(30, 15, 20, 0.95)'
          : isWarning
          ? 'rgba(35, 25, 10, 0.95)'
          : 'rgba(15, 23, 42, 0.95)';

        const textColor = isCritical
          ? 'var(--status-critical)'
          : isWarning
          ? 'var(--status-warning)'
          : 'var(--status-info)';

        return (
          <div
            key={n.id}
            role="alert"
            style={{
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              animation: 'fadeIn 0.25s ease',
              cursor: n.details?.requestId ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (n.details?.requestId) {
                navigate(`/emergency/${n.details.requestId}`);
              }
            }}
          >
            <div style={{ color: textColor, marginTop: '2px', flexShrink: 0 }}>
              {isCritical ? (
                <AlertCircle size={18} className="animate-pulse" />
              ) : isWarning ? (
                <AlertCircle size={18} />
              ) : (
                <Info size={18} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: textColor,
                  marginBottom: '3px',
                  textTransform: 'uppercase',
                }}
              >
                {n.title}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {n.message}
              </div>
              {n.details?.requestId && (
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--status-info)',
                    marginTop: '6px',
                    fontWeight: 600,
                  }}
                >
                  Click to open dossier →
                </div>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(n.id);
              }}
              aria-label="Dismiss alert"
              style={{
                color: 'var(--text-muted)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationToast;
