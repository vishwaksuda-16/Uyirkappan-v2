import { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import useEmergency from '../../hooks/useEmergency';
import useHospitalResources from '../../hooks/useHospitalResources';
import OperationalMetrics from '../../components/dashboard/OperationalMetrics';
import CriticalEmergencyBanner from '../../components/dashboard/CriticalEmergencyBanner';
import IncomingEmergencyList from '../../components/dashboard/IncomingEmergencyList';
import QuickResourceOverview from '../../components/dashboard/QuickResourceOverview';
import AmbulanceMap from '../../components/tracking/AmbulanceMap';
import DynamicEtaWidget from '../../components/tracking/DynamicEtaWidget';
import ResourceUpdateModal from '../../components/resources/ResourceUpdateModal';
import { Radio, RefreshCw, Building2, AlertTriangle, Settings2 } from 'lucide-react';

export function DashboardPage() {
  const { user, hospital } = useAuth();
  const { emergencies, isLoading, error, refreshEmergencies } = useEmergency();
  const {
    resources,
    updateResources,
    isSaving: isSavingResources,
  } = useHospitalResources(user?.hospitalId);

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);

  // Active non-completed cases
  const activeEmergencies = emergencies.filter((e) => e.status !== 'COMPLETED');

  // Most critical/urgent inbound case (e.g. lowest ETA or Cardiac/Trauma)
  const topPriorityCase = activeEmergencies[0] || null;

  // Resource threshold check for low-resource warning (Checklist Section 17)
  const isLowResources =
    (resources.icuBeds !== undefined && resources.icuBeds <= 1) ||
    (resources.ventilators !== undefined && resources.ventilators <= 1) ||
    (resources.generalBeds !== undefined && resources.generalBeds <= 3);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Operations Header: Hospital Name & Facility Verification */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--status-critical-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-critical)',
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {hospital?.name || user?.hospitalName || 'Apollo Trauma & Emergency Center'}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Hospital Facility ID: <strong style={{ color: 'var(--status-info)' }}>{user?.hospitalId || 'HOSP-01'}</strong> • {hospital?.tier || 'Level 1 Trauma Center'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsResourceModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Settings2 size={15} />
          <span>Update Resources</span>
        </button>
      </div>

      {/* Low-Resource Warning Alert Banner (Checklist Section 17) */}
      {isLowResources && (
        <div
          style={{
            backgroundColor: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              <strong style={{ color: 'var(--status-warning)' }}>Low Hospital Resource Warning:</strong> Critical capacity threshold reached.
              {resources.icuBeds <= 1 && ' ICU beds are near depletion.'}
              {resources.ventilators <= 1 && ' Mechanical ventilators are critically limited.'}
              {resources.generalBeds <= 3 && ' General ward beds are low.'}
              {' Please update available resources to inform Intelligent Dispatch.'}
            </div>
          </div>
          <button
            onClick={() => setIsResourceModalOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--status-warning)',
              color: '#000000',
              fontWeight: 700,
              fontSize: '12px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            Update Resources
          </button>
        </div>
      )}

      {/* Top Operations Metrics Grid */}
      <OperationalMetrics
        emergencies={emergencies}
        resources={resources}
        onManageResources={() => setIsResourceModalOpen(true)}
      />

      {/* Prominent Critical Inbound Case Banner */}
      {topPriorityCase && <CriticalEmergencyBanner emergency={topPriorityCase} />}

      {/* Main Command Center Layout Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Real-Time Incoming Emergency Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} style={{ color: 'var(--status-critical)' }} className="animate-pulse" />
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--text-primary)',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Inbound Emergency Feed
              </h2>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {activeEmergencies.length} Active
              </span>
            </div>

            <button
              onClick={refreshEmergencies}
              title="Refresh feed"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>
          </div>

          <IncomingEmergencyList
            emergencies={emergencies}
            isLoading={isLoading}
            error={error}
            onRetry={refreshEmergencies}
          />
        </div>

        {/* Right Column: Live Ambulance Radar, Dynamic ETA & Resource Quick Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tracking Radar Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              Live Ambulance Telemetry
            </div>

            {topPriorityCase ? (
              <>
                <AmbulanceMap emergency={topPriorityCase} height="320px" />
                <DynamicEtaWidget
                  eta={topPriorityCase.eta}
                  initialEta={topPriorityCase.initialEta}
                  trafficCondition={topPriorityCase.trafficCondition}
                  updatedAt={topPriorityCase.updatedAt}
                />
              </>
            ) : (
              <div
                style={{
                  height: '240px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                No active ambulances to display on tracking radar.
              </div>
            )}
          </div>

          {/* Secondary Hospital Resource Glance */}
          <QuickResourceOverview
            resources={resources}
            onOpenModal={() => setIsResourceModalOpen(true)}
          />
        </div>
      </div>

      {/* Resource Update Modal Dialog */}
      <ResourceUpdateModal
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
        initialResources={resources}
        onSave={updateResources}
        isSaving={isSavingResources}
      />
    </div>
  );
}

export default DashboardPage;
