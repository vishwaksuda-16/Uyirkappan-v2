import { useState, useEffect, useCallback, useMemo } from 'react';
import useAuth from '../../hooks/useAuth';
import useEmergency from '../../hooks/useEmergency';
import hospitalApi from '../../services/hospitalApi';
import HistoryMetricsSummary from '../../components/history/HistoryMetricsSummary';
import EmergencyHistoryTable from '../../components/history/EmergencyHistoryTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { History, RefreshCw } from 'lucide-react';

export function HistoryPage() {
  const { user, hospital } = useAuth();
  const { completedEmergencies } = useEmergency();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = useCallback(async () => {
    if (!user?.hospitalId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getEmergencyHistory(user.hospitalId);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      if (import.meta.env?.DEV) console.error('Failed to load emergency history:', err);
      setError(err.message || 'Unable to load emergency response logs.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.hospitalId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const combinedHistory = useMemo(() => {
    const ids = new Set(history.map((h) => h.requestId));
    const newlyCompleted = (completedEmergencies || []).filter((e) => !ids.has(e.requestId));
    return [...newlyCompleted, ...history];
  }, [history, completedEmergencies]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              color: 'var(--status-purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Emergency Response History
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {hospital?.name || user?.hospitalName} • Comprehensive Audit Log & Post-Incident Dossiers
            </div>
          </div>
        </div>

        <button
          onClick={loadHistory}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Historical Operations KPIs (Module 3 Section 38 & Module 6 Section 31) */}
      <HistoryMetricsSummary history={combinedHistory} />

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onRetry={loadHistory} />}

      {/* Main Records Table */}
      {isLoading ? (
        <LoadingSpinner message="Querying hospital response archive..." />
      ) : (
        <EmergencyHistoryTable history={combinedHistory} />
      )}
    </div>
  );
}

export default HistoryPage;
