import { BedDouble, HeartPulse, Wind, Settings2 } from 'lucide-react';

export function QuickResourceOverview({ resources = {}, onOpenModal }) {
  const items = [
    {
      title: 'General Beds',
      count: resources.generalBeds ?? 0,
      total: resources.totalGeneralBeds ?? 25,
      icon: BedDouble,
      color: 'var(--status-info)',
      isLow: (resources.generalBeds ?? 0) <= 3,
    },
    {
      title: 'ICU Beds',
      count: resources.icuBeds ?? 0,
      total: resources.totalIcuBeds ?? 8,
      icon: HeartPulse,
      color: 'var(--status-critical)',
      isLow: (resources.icuBeds ?? 0) <= 1,
    },
    {
      title: 'Ventilators',
      count: resources.ventilators ?? 0,
      total: resources.totalVentilators ?? 5,
      icon: Wind,
      color: 'var(--status-warning)',
      isLow: (resources.ventilators ?? 0) <= 1,
    },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
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
          Hospital Capacity Status
        </span>

        <button
          onClick={onOpenModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--status-info)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid var(--status-info-border)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)')
          }
        >
          <Settings2 size={13} />
          <span>Update Counts</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: `1px solid ${item.isLow ? 'var(--status-warning-border)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Icon size={15} style={{ color: item.color }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {item.title}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span
                  className="tabular-nums font-mono"
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: item.isLow ? 'var(--status-warning)' : 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  {item.count}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  / {item.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuickResourceOverview;
