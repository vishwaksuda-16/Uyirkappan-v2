import { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import useHospitalResources from '../../hooks/useHospitalResources';
import ResourceCard from '../../components/resources/ResourceCard';
import ResourceUpdateModal from '../../components/resources/ResourceUpdateModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { BedDouble, CheckCircle2, ShieldAlert, Settings2, RefreshCw } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatters';

export function ResourcesPage() {
  const { user, hospital } = useAuth();
  const {
    resources,
    isLoading,
    isSaving,
    error,
    successMessage,
    refetch,
    updateResources,
  } = useHospitalResources(user?.hospitalId);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleQuickAdjust = async (field, delta) => {
    const current = Number(resources[field]) || 0;
    const nextVal = Math.max(0, current + delta);
    await updateResources({
      ...resources,
      [field]: nextVal,
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading hospital capacity and bed allocations..." fullPage />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                color: 'var(--status-info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BedDouble size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Hospital Resource Management
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {hospital?.name || user?.hospitalName} • Real-time Triage & Bed Allocation
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={refetch}
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
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-info)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: 'var(--shadow-glow-blue)',
            }}
          >
            <Settings2 size={16} />
            <span>Update All Resources</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          style={{
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: 'var(--status-success)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* Resource Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <ResourceCard
          type="generalBeds"
          count={resources.generalBeds}
          total={resources.totalGeneralBeds}
          onQuickAdjust={handleQuickAdjust}
          onEditClick={() => setIsModalOpen(true)}
          disabled={isSaving}
        />

        <ResourceCard
          type="icuBeds"
          count={resources.icuBeds}
          total={resources.totalIcuBeds}
          onQuickAdjust={handleQuickAdjust}
          onEditClick={() => setIsModalOpen(true)}
          disabled={isSaving}
        />

        <ResourceCard
          type="ventilators"
          count={resources.ventilators}
          total={resources.totalVentilators}
          onQuickAdjust={handleQuickAdjust}
          onEditClick={() => setIsModalOpen(true)}
          disabled={isSaving}
        />
      </div>

      {/* Operational Context Card (Module 3 Section 17 & 23) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ShieldAlert size={18} style={{ color: 'var(--status-info)' }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Why Accurate Resource Synchronization Is Mission-Critical
          </h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
          The UyirKappan <strong>Intelligent Dispatch Engine (Module 5)</strong> evaluates real-time facility resource availability during patient routing. When an ambulance responds to a critical cardiac or respiratory incident, the system routes the patient only to hospitals with confirmed ICU beds and ventilators. Keeping your dashboard resource counts up to date prevents dangerous secondary patient transfers and ensures immediate patient admission.
        </p>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Last synchronization confirmed at: <strong style={{ color: 'var(--text-secondary)' }}>{formatTimestamp(resources.updatedAt)}</strong>
        </div>
      </div>

      {/* Modal Dialog */}
      <ResourceUpdateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialResources={resources}
        onSave={updateResources}
        isSaving={isSaving}
      />
    </div>
  );
}

export default ResourcesPage;
