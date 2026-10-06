import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import useEmergency from '../../hooks/useEmergency';
import useHospitalResources from '../../hooks/useHospitalResources';
import hospitalApi from '../../services/hospitalApi';
import OperationalMetrics from '../../components/dashboard/OperationalMetrics';
import IncomingEmergencyList from '../../components/dashboard/IncomingEmergencyList';
import QuickResourceOverview from '../../components/dashboard/QuickResourceOverview';
import ResourceUpdateModal from '../../components/resources/ResourceUpdateModal';
import { AlertTriangle, Building2, Radio, RefreshCw, Settings2 } from 'lucide-react';

const terminalStatuses = new Set(['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE']);

export function DashboardPage() {
  const { user, hospital, switchHospital } = useAuth();
  const [hospitalInfo, setHospitalInfo] = useState(hospital);
  const [allHospitals, setAllHospitals] = useState([]);
  const { emergencies, isLoading, error, refreshEmergencies } = useEmergency();
  const {
    resources,
    updateResources,
    isSaving: isSavingResources,
  } = useHospitalResources(user?.hospitalId);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);

  useEffect(() => {
    hospitalApi.getHospitals()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setAllHospitals(list);
      })
      .catch((e) => {
        if (import.meta.env?.DEV) console.warn('Failed to load hospitals:', e);
      });
  }, []);

  useEffect(() => {
    if (!user?.hospitalId) return;
    hospitalApi.getHospital(user.hospitalId)
      .then((data) => {
        if (data?.hospital) setHospitalInfo(data.hospital);
      })
      .catch((e) => {
        if (import.meta.env?.DEV) console.warn('Failed to load hospital details:', e);
      });
  }, [user?.hospitalId]);

  const activeEmergencies = emergencies.filter((emergency) => !terminalStatuses.has(emergency.status));
  const lowResources = [
    resources.icuBeds !== undefined && resources.icuBeds <= 1 && 'ICU beds',
    resources.ventilators !== undefined && resources.ventilators <= 1 && 'ventilators',
    resources.generalBeds !== undefined && resources.generalBeds <= 3 && 'general beds',
  ].filter(Boolean);
  const hospitalName = hospitalInfo?.name || hospital?.name || user?.hospitalName || 'Hospital overview';

  return (
    <div className="hospital-dashboard">
      <section className="dashboard-header" aria-label="Hospital overview">
        <div className="dashboard-heading">
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              color: 'var(--status-info)',
              background: 'var(--status-info-bg)',
              border: '1px solid var(--status-info-border)',
            }}
          >
            <Building2 size={21} />
          </div>
          <div className="dashboard-heading-copy">
            <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 750 }}>{hospitalName}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Emergency care overview
              {hospitalInfo?.area || hospital?.area ? ` · ${hospitalInfo?.area || hospital?.area}` : ''}
            </p>
          </div>
        </div>

        <div className="dashboard-header-controls">
          <label htmlFor="hospital-switcher-select" className="sr-only">Select hospital</label>
          <select
            id="hospital-switcher-select"
            className="dashboard-hospital-select"
            value={user?.hospitalId || 'H001'}
            onChange={(event) => switchHospital(event.target.value)}
          >
            {allHospitals.length > 0 ? allHospitals.map((item) => (
              <option key={item.id} value={item.id}>{item.id} · {item.name}</option>
            )) : (
              <option value={user?.hospitalId || 'H001'}>{user?.hospitalId || 'H001'} · Current hospital</option>
            )}
          </select>
          <button className="dashboard-action" onClick={() => setIsResourceModalOpen(true)}>
            <Settings2 size={15} />
            <span>Update resources</span>
          </button>
        </div>
      </section>

      {lowResources.length > 0 && (
        <div className="dashboard-warning" role="status">
          <AlertTriangle size={17} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
          <span>Low availability: {lowResources.join(', ')}. Update your resource counts if they have changed.</span>
          <button
            className="dashboard-action"
            style={{ minHeight: 34, marginLeft: 'auto', flexShrink: 0 }}
            onClick={() => setIsResourceModalOpen(true)}
          >
            Update
          </button>
        </div>
      )}

      <OperationalMetrics
        emergencies={emergencies}
      />

      <div className="dashboard-content-grid">
        <section className="dashboard-panel" aria-labelledby="inbound-heading">
          <div className="dashboard-section-heading">
            <h2 id="inbound-heading" className="dashboard-section-title">
              <Radio size={17} style={{ color: 'var(--status-info)' }} />
              Inbound emergencies
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="dashboard-count">{activeEmergencies.length} active</span>
              <button
                className="dashboard-action"
                style={{ minHeight: 34, padding: '0 10px' }}
                onClick={refreshEmergencies}
                aria-label="Refresh inbound emergencies"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          <IncomingEmergencyList
            emergencies={activeEmergencies}
            isLoading={isLoading}
            error={error}
            onRetry={refreshEmergencies}
          />
        </section>

        <section aria-label="Hospital resources">
          <QuickResourceOverview
            resources={resources}
            onOpenModal={() => setIsResourceModalOpen(true)}
          />
        </section>
      </div>

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
