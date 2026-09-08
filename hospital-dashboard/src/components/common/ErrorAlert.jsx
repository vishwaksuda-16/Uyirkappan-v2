import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorAlert({
  title = 'System Alert',
  message = 'Unable to load emergency operational data.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      style={{
        backgroundColor: 'var(--status-critical-bg)',
        border: '1px solid var(--status-critical-border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        margin: '12px 0',
      }}
    >
      <AlertTriangle
        size={20}
        style={{ color: 'var(--status-critical)', flexShrink: 0, marginTop: '2px' }}
      />
      <div style={{ flex: 1 }}>
        <h4
          style={{
            margin: '0 0 4px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--status-critical)',
          }}
        >
          {title}
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid var(--status-critical-border)',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.35)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')
          }
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

export default ErrorAlert;
