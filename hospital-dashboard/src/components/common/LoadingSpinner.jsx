import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Loading emergency operations data...', fullPage = false }) {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px 16px',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader2
        size={28}
        className="animate-spin"
        style={{ color: 'var(--status-info)' }}
      />
      <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.02em' }}>
        {message}
      </span>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;
