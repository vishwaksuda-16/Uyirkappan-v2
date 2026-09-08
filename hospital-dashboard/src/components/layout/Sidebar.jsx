import { NavLink } from 'react-router-dom';
import useEmergency from '../../hooks/useEmergency';
import useAuth from '../../hooks/useAuth';
import {
  LayoutDashboard,
  BedDouble,
  History,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';

export function Sidebar() {
  const { emergencies } = useEmergency();
  const { hospital } = useAuth();
  const activeCount = emergencies.filter((e) => e.status !== 'COMPLETED').length;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Emergency Command',
      icon: LayoutDashboard,
      badge: activeCount > 0 ? activeCount : null,
      badgeVariant: 'critical',
    },
    {
      to: '/resources',
      label: 'Resource Management',
      icon: BedDouble,
    },
    {
      to: '/history',
      label: 'Response History',
      icon: History,
    },
  ];

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 12px',
        flexShrink: 0,
      }}
    >
      {/* Primary Nav Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            fontWeight: 700,
            padding: '4px 12px 8px 12px',
          }}
        >
          Operations Menu
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                border: isActive
                  ? '1px solid var(--border-default)'
                  : '1px solid transparent',
                transition: 'all 0.15s ease',
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className="animate-pulse-dot"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--status-critical)',
                    color: '#fff',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Facility Quick Contact Capsule */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          fontSize: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--status-success)',
            fontWeight: 600,
            marginBottom: '6px',
          }}
        >
          <ShieldCheck size={14} />
          <span>Active Command Link</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '8px' }}>
          Direct ER triage line synchronized with Central Dispatch.
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          <PhoneCall size={12} style={{ color: 'var(--status-info)' }} />
          <span>{hospital?.emergencyHelpline || '108 / 1066'}</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
