import useAuth from '../../hooks/useAuth';
import ConnectionIndicator from './ConnectionIndicator';
import { LogOut, User, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Navbar() {
  const { user, hospital, logout } = useAuth();

  return (
    <header
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
      {/* Brand & Hospital Identifier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link
          to="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--status-critical-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-critical)',
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
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--status-info)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--status-info-border)',
                  textTransform: 'uppercase',
                }}
              >
                Module 3
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Hospital Emergency Operations Center
            </div>
          </div>
        </Link>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-default)' }} />

        {/* Hospital Entity Display */}
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}
          >
            {hospital?.name || user?.hospitalName || 'Emergency Hospital Center'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--status-success)', fontWeight: 500 }}>
            {hospital?.tier || 'Level 1 Trauma Facility'} • ID: {user?.hospitalId || 'H01'}
          </div>
        </div>
      </div>

      {/* Right Controls: Connection Status, Profile, Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Live WebSocket Connection Pill */}
        <ConnectionIndicator />

        {/* Staff User Capsule */}
        <div
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
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              color: 'var(--status-info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={15} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {user?.name || 'Authorized Staff'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {user?.badgeId || 'HOSPITAL_STAFF'} • {user?.department || 'Triage'}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign out of operations dashboard"
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
