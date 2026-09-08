import { GitFork, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';

export function FallbackAuditTrail({ attempts = [] }) {
  if (!attempts || attempts.length === 0) {
    return null;
  }

  const hasFallback = attempts.length > 1;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${hasFallback ? 'var(--status-warning-border)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        marginBottom: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: hasFallback ? 'var(--status-warning-bg)' : 'var(--bg-elevated)',
              color: hasFallback ? 'var(--status-warning)' : 'var(--text-secondary)',
            }}
          >
            <GitFork size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Dispatch Assignment Audit Trail
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Continuous audit log of driver allocations and cascading fallback triggers
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: hasFallback ? 'var(--status-warning-bg)' : 'var(--status-success-bg)',
            color: hasFallback ? 'var(--status-warning)' : 'var(--status-success)',
            border: `1px solid ${hasFallback ? 'var(--status-warning-border)' : 'var(--status-success-border)'}`,
          }}
        >
          {attempts.length} {attempts.length === 1 ? 'Attempt' : 'Attempts (Fallback Active)'}
        </span>
      </div>

      {/* Attempts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {attempts.map((attempt, index) => {
          const isSuccess = attempt.response === 'ACCEPTED';
          const isTimeout = attempt.response === 'TIMEOUT';

          const statusColor = isSuccess
            ? 'var(--status-success)'
            : isTimeout
            ? 'var(--status-warning)'
            : 'var(--status-critical)';

          const StatusIcon = isSuccess ? CheckCircle : isTimeout ? AlertTriangle : XCircle;

          return (
            <div
              key={index}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    width: '64px',
                  }}
                >
                  ATTEMPT {attempt.attemptNumber || index + 1}
                </span>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Ambulance Unit: <span style={{ color: 'var(--status-info)' }}>{attempt.ambulanceId}</span>
                    {attempt.driverName && (
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                        ({attempt.driverName})
                      </span>
                    )}
                  </div>
                  {attempt.failureReason && (
                    <div style={{ fontSize: '11px', color: 'var(--status-warning)', marginTop: '2px' }}>
                      Reason: {attempt.failureReason}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div className="tabular-nums font-mono">{formatTimestamp(attempt.assignedAt)}</div>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: statusColor,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  <StatusIcon size={12} />
                  <span>{attempt.response || 'UNKNOWN'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FallbackAuditTrail;
