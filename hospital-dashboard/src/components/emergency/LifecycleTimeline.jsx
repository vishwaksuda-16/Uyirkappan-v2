import { LIFECYCLE_STEPS, STATUS_CONFIG } from '../../constants/statusConstants';
import { Check, Clock, AlertTriangle } from 'lucide-react';

export function LifecycleTimeline({ currentStatus }) {
  const currentStepConfig = STATUS_CONFIG[currentStatus] || {};
  const currentStepNumber = currentStepConfig.step || 1;
  const isFallbackState =
    currentStatus === 'FALLBACK' ||
    currentStatus === 'TIMEOUT' ||
    currentStatus === 'REJECTED' ||
    currentStatus === 'NO_AMBULANCE_AVAILABLE';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        marginBottom: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            fontWeight: 700,
          }}
        >
          Response Lifecycle Tracking
        </span>

        {isFallbackState && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              backgroundColor: 'var(--status-warning-bg)',
              border: '1px solid var(--status-warning-border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--status-warning)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={13} />
            <span>Cascading Fallback Triggered</span>
          </span>
        )}
      </div>

      {/* Steps Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${LIFECYCLE_STEPS.length}, 1fr)`,
          gap: '8px',
          position: 'relative',
        }}
      >
        {LIFECYCLE_STEPS.map((step, idx) => {
          const stepIndex = idx + 1;
          const isCompleted = currentStepNumber > stepIndex;
          const isCurrent = currentStepNumber === stepIndex;

          let iconBg = 'var(--bg-elevated)';
          let iconColor = 'var(--text-muted)';
          let borderColor = 'var(--border-subtle)';

          if (isCompleted) {
            iconBg = 'rgba(16, 185, 129, 0.15)';
            iconColor = 'var(--status-success)';
            borderColor = 'var(--status-success-border)';
          } else if (isCurrent) {
            iconBg = 'rgba(239, 68, 68, 0.15)';
            iconColor = 'var(--status-critical)';
            borderColor = 'var(--status-critical-border)';
          }

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Connecting Bar (before circle) */}
              {idx > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '-50%',
                    width: '100%',
                    height: '2px',
                    backgroundColor: isCompleted ? 'var(--status-success)' : 'var(--border-subtle)',
                    zIndex: 1,
                  }}
                />
              )}

              {/* Step Circle Indicator */}
              <div
                style={{
                  position: 'relative',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: iconBg,
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: iconColor,
                  zIndex: 2,
                  boxShadow: isCurrent ? 'var(--shadow-glow-red)' : 'none',
                }}
              >
                {isCompleted ? (
                  <Check size={14} />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-critical)',
                    }}
                    className="animate-pulse"
                  />
                ) : (
                  <Clock size={12} />
                )}
              </div>

              {/* Label */}
              <div style={{ marginTop: '8px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500,
                    color: isCurrent
                      ? 'var(--text-primary)'
                      : isCompleted
                      ? 'var(--status-success)'
                      : 'var(--text-muted)',
                    lineHeight: 1.2,
                  }}
                >
                  {step.shortDesc}
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: 'var(--text-muted)',
                    display: 'none', // shown on wider screen via CSS if needed
                  }}
                >
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LifecycleTimeline;
