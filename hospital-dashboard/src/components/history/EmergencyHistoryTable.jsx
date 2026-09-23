import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import UrgencyBadge from '../common/UrgencyBadge';
import EmptyState from '../common/EmptyState';
import { Search, Filter, Truck, ArrowUpRight } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export function EmergencyHistoryTable({ history = [] }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.requestId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ambulanceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.admissionOutcome?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        selectedType === 'ALL' || item.emergencyType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [history, searchTerm, selectedType]);

  const emergencyTypes = ['ALL', 'CARDIAC', 'ACCIDENT', 'TRAUMA', 'RESPIRATORY', 'STROKE', 'GENERAL_MEDICAL'];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Search & Filter Toolbar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            position: 'relative',
            minWidth: '260px',
            flex: 1,
            maxWidth: '400px',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search by Request ID, Ambulance, or Outcome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {emergencyTypes.map((t) => (
              <option key={t} value={t}>
                {t === 'ALL' ? 'All Emergency Types' : t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Area */}
      {filteredHistory.length === 0 ? (
        <div style={{ padding: '32px 16px' }}>
          <EmptyState
            title="No Matching Records"
            description="No historical emergencies matched your search and filter criteria."
          />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                <th style={{ padding: '12px 16px' }}>Request ID</th>
                <th style={{ padding: '12px 16px' }}>Emergency Classification</th>
                <th style={{ padding: '12px 16px' }}>Unit & Driver</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Created At</th>
                <th style={{ padding: '12px 16px' }}>Completed At</th>
                <th style={{ padding: '12px 16px' }}>Admission Outcome</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => (
                <tr
                  key={item.requestId}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Request ID */}
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      className="tabular-nums font-mono"
                      style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                    >
                      {item.requestId}
                    </span>
                  </td>

                  {/* Type & Victim Count */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UrgencyBadge type={item.emergencyType} size="sm" />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ({item.victimCount} {item.victimCount === 1 ? 'victim' : 'victims'})
                      </span>
                    </div>
                  </td>

                  {/* Ambulance ID & Driver */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Truck size={14} style={{ color: 'var(--status-info)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.ambulanceId}</span>
                    </div>
                    {item.driverName && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.driverName}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={item.status} size="sm" />
                  </td>

                  {/* Created At (Checklist Section 6) */}
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {formatDateTime(item.createdAt || item.completedAt)}
                  </td>

                  {/* Completed At (Checklist Section 6) */}
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {formatDateTime(item.completedAt || item.createdAt)}
                  </td>

                  {/* Admission Outcome */}
                  <td
                    style={{
                      padding: '14px 16px',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      maxWidth: '260px',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.admissionOutcome || 'Admitted to emergency ward for stabilization.'}
                    </div>
                  </td>

                  {/* Action */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/emergency/${item.requestId}`)}
                      title="View case dossier"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--status-info)',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      <span>View</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EmergencyHistoryTable;
