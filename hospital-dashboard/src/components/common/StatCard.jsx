export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default', // 'default' | 'critical' | 'warning' | 'success' | 'info'
  onClick,
}) {
  const getThemeStyles = () => {
    switch (variant) {
      case 'critical':
        return {
          border: '1px solid var(--status-critical-border)',
          accentColor: 'var(--status-critical)',
          bgAccent: 'var(--status-critical-bg)',
          glow: 'var(--shadow-glow-red)',
        };
      case 'warning':
        return {
          border: '1px solid var(--status-warning-border)',
          accentColor: 'var(--status-warning)',
          bgAccent: 'var(--status-warning-bg)',
          glow: 'none',
        };
      case 'success':
        return {
          border: '1px solid var(--status-success-border)',
          accentColor: 'var(--status-success)',
          bgAccent: 'var(--status-success-bg)',
          glow: 'var(--shadow-glow-green)',
        };
      case 'info':
        return {
          border: '1px solid var(--status-info-border)',
          accentColor: 'var(--status-info)',
          bgAccent: 'var(--status-info-bg)',
          glow: 'none',
        };
      default:
        return {
          border: '1px solid var(--border-default)',
          accentColor: 'var(--text-primary)',
          bgAccent: 'rgba(255, 255, 255, 0.03)',
          glow: 'none',
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: theme.border,
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, background-color 0.15s ease',
        boxShadow: theme.glow !== 'none' ? theme.glow : 'var(--shadow-sm)',
        minHeight: '104px',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.backgroundColor = 'var(--bg-card)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: theme.bgAccent,
              color: theme.accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span
          className="tabular-nums font-mono"
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: theme.accentColor,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {subtitle && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
