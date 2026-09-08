import { ShieldCheck } from 'lucide-react';

export function EmptyState({
  title = 'No Active Emergencies',
  description = 'There are currently no inbound ambulances routed to this facility.',
  icon: Icon = ShieldCheck,
  action,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--bg-card)',
        border: '1px dashed var(--border-default)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--status-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Icon size={26} />
      </div>

      <h4
        style={{
          margin: '0 0 6px 0',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h4>

      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--text-muted)',
          maxWidth: '380px',
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
