import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--status-critical-bg)',
          color: 'var(--status-critical)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <AlertCircle size={28} />
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
        404 — Operational Route Not Found
      </h2>

      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '24px' }}>
        The requested command center endpoint or incident dossier does not exist or has been archived.
      </p>

      <Link
        to="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--status-info)',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 700,
        }}
      >
        <ArrowLeft size={16} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}

export default NotFoundPage;
