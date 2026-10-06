import { NavLink } from 'react-router-dom';
import useEmergency from '../../hooks/useEmergency';
import {
  LayoutDashboard,
  BedDouble,
  History,
} from 'lucide-react';

export function Sidebar() {
  const { emergencies } = useEmergency();
  const activeCount = emergencies.filter(
    (e) => !['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(e.status)
  ).length;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Home',
      icon: LayoutDashboard,
      badge: activeCount > 0 ? activeCount : null,
    },
    {
      to: '/resources',
      label: 'Resources',
      icon: BedDouble,
    },
    {
      to: '/history',
      label: 'History',
      icon: History,
    },
  ];

  return (
    <aside className="app-sidebar" style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '18px 10px' }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="sidebar-nav-label">Hospital</div>

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

    </aside>
  );
}

export default Sidebar;
