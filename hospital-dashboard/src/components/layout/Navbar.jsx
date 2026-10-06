import useAuth from '../../hooks/useAuth';
import ConnectionIndicator from './ConnectionIndicator';
import { LogOut, User, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header
      className="app-navbar"
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="app-navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link
          to="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-info-bg)',
              border: '1px solid var(--status-info-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-info)',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>UyirKappan</span>
            </div>
            <div className="app-navbar-brand-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Hospital operations
            </div>
          </div>
        </Link>
      </div>

      <div className="app-navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <ConnectionIndicator />

        <div
          className="app-navbar-user"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-info-bg)',
              color: 'var(--status-info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={15} />
          </div>
          <div className="app-navbar-user-details" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {user?.name || 'Authorized Staff'}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign out of operations dashboard"
          aria-label="Sign out of operations dashboard"
          style={{
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-card)',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--status-critical)';
            e.currentTarget.style.borderColor = 'var(--status-critical-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export default Navbar;
