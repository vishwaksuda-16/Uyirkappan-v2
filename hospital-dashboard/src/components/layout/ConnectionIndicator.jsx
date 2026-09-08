import useSocket from '../../hooks/useSocket';
import { RefreshCw } from 'lucide-react';

export function ConnectionIndicator() {
  const { isConnected, isReconnecting, reconnect } = useSocket();

  let dotColor = '#10b981';
  let label = 'Live';
  let tooltip = 'Real-time WebSocket connection active';

  if (isConnected) {
    dotColor = '#10b981';
    label = 'Live';
    tooltip = 'Connected to central WebSocket dispatch server';
  } else if (isReconnecting) {
    dotColor = '#f59e0b';
    label = 'Connecting';
    tooltip = 'Attempting to establish WebSocket connection';
  } else {
    dotColor = '#ef4444';
    label = 'Disconnected';
    tooltip = 'WebSocket disconnected';
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-full)',
        fontSize: '12px',
        fontWeight: 500,
      }}
      title={tooltip}
    >
      <span
        style={{
          position: 'relative',
          display: 'flex',
          height: '8px',
          width: '8px',
        }}
      >
        {isConnected && (
          <span
            className="animate-ping-slow"
            style={{
              position: 'absolute',
              height: '100%',
              width: '100%',
              borderRadius: '50%',
              backgroundColor: dotColor,
              opacity: 0.75,
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            borderRadius: '50%',
            height: '8px',
            width: '8px',
            backgroundColor: dotColor,
          }}
        />
      </span>

      <span
        style={{
          color: isConnected ? 'var(--status-success)' : isReconnecting ? 'var(--status-warning)' : 'var(--text-secondary)',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>

      {!isConnected && (
        <button
          onClick={reconnect}
          title="Retry connection"
          style={{
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            marginLeft: '2px',
          }}
        >
          <RefreshCw size={11} className={isReconnecting ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}

export default ConnectionIndicator;
