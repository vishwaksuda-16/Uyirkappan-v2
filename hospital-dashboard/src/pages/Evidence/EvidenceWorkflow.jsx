import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { PresentationWrapper, PresentationToggle } from '../../components/evidence/PresentationWrapper';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  GitBranch, User, Truck, Building2, ArrowDown, CheckCircle,
  Clock, MapPin, AlertTriangle, ChevronLeft, Radio
} from 'lucide-react';

export function EvidenceWorkflow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = searchParams.get('caseId') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [inputCaseId, setInputCaseId] = useState(caseId);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/evidence/workflow/${id}`);
      setData(res?.workflow || null);
    } catch (err) {
      setError(err.message || 'Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) loadData(caseId);
    else setLoading(false);
  }, [caseId]);

  const handleLoadCase = () => {
    if (inputCaseId.trim()) {
      navigate(`/evidence/workflow?caseId=${inputCaseId.trim()}`, { replace: true });
      loadData(inputCaseId.trim());
    }
  };

  const workflowSteps = [
    { label: 'BYSTANDER', icon: User, active: !!data?.bystander },
    { label: 'EMERGENCY CREATED', icon: AlertTriangle, active: !!data?.bystander },
    { label: 'MATCHING ENGINE', icon: GitBranch, active: !!data?.bystander?.assignedAmbulanceId },
    { label: 'AMBULANCE ASSIGNED', icon: Truck, active: !!data?.bystander?.assignedAmbulanceId },
    { label: 'DRIVER', icon: User, active: !!data?.driver },
    { label: 'ROUTE / TRACKING', icon: Radio, active: ['EN_ROUTE_TO_PATIENT', 'EN_ROUTE_TO_HOSPITAL', 'DRIVER_ACCEPTED', 'PATIENT_ONBOARD'].includes(data?.bystander?.status) },
    { label: 'HOSPITAL', icon: Building2, active: !!data?.hospital },
  ];

  const content = (
    <>
      {/* Header */}
      {!isPresentationMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/evidence')} className="btn btn--ghost btn--sm">
              <ChevronLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>
                Figure E1 — End-to-End Emergency Coordination
              </h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Same emergency across Bystander, Driver, and Hospital applications
              </div>
            </div>
          </div>
          <PresentationToggle onClick={() => setIsPresentationMode(true)} />
        </div>
      )}

      {/* Case Selector if no data */}
      {!data && !loading && (
        <div className="eoc-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>
            No Active Emergency Loaded
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <input
              value={inputCaseId}
              onChange={(e) => setInputCaseId(e.target.value)}
              placeholder="Enter Emergency ID (e.g., REQ00001)"
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-mono)', width: '280px',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadCase()}
            />
            <button onClick={handleLoadCase} className="btn btn--primary">
              Load Active Case
            </button>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Loading workflow data..." />}
      {error && (
        <div style={{
          padding: '16px', backgroundColor: 'var(--status-critical-bg)',
          border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-md)',
          color: 'var(--status-critical)', fontSize: 'var(--text-sm)',
        }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-5)' }}>
          {/* Three Panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* BYSTANDER Panel */}
            <PanelCard title="BYSTANDER" icon={User} color="var(--status-info)" data={data?.bystander} type="bystander" />

            {/* DRIVER Panel */}
            <PanelCard title="DRIVER" icon={Truck} color="var(--status-warning)" data={data?.driver} type="driver" />

            {/* HOSPITAL Panel */}
            <PanelCard title="HOSPITAL" icon={Building2} color="var(--status-success)" data={data?.hospital} type="hospital" />
          </div>

          {/* Central Workflow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
            <div className="workflow-timeline">
              {workflowSteps.map((step, i) => {
                const SIcon = step.icon;
                return (
                  <div key={i}>
                    {i > 0 && <div className={`workflow-connector ${step.active ? 'workflow-connector--active' : ''}`} style={{ margin: '0 auto' }} />}
                    <div className={`workflow-step ${step.active ? 'workflow-step--active' : 'workflow-step--pending'}`}>
                      <SIcon size={14} />
                      <span style={{ fontSize: 'var(--text-xs)' }}>{step.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Emergency Summary
              </div>
              <DetailRow label="Emergency ID" value={data?.bystander?.emergencyId} mono />
              <DetailRow label="Type" value={data?.bystander?.emergencyType} />
              <DetailRow label="Status" value={data?.bystander?.status} highlight />
              <DetailRow label="Ambulance" value={data?.bystander?.assignedAmbulanceId} mono />
              <DetailRow label="ETA" value={data?.bystander?.eta ? `${data.bystander.eta} min` : 'N/A'} />
              <DetailRow label="Hospital" value={data?.bystander?.selectedHospitalName || data?.bystander?.selectedHospitalId} />
              {data?.driver && (
                <>
                  <DetailRow label="Driver" value={data.driver.driverName} />
                  <DetailRow label="Driver ID" value={data.driver.driverId} mono />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isPresentationMode) {
    return (
      <PresentationWrapper
        title="End-to-End Emergency Coordination"
        figureCaption="Fig. 6. End-to-end emergency coordination across the Bystander Application, Driver Application, and Hospital Dashboard."
        onClose={() => setIsPresentationMode(false)}
      >
        {content}
      </PresentationWrapper>
    );
  }

  return <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{content}</div>;
}

function PanelCard({ title, icon: PIcon, color, data, type }) {
  if (!data) {
    return (
      <div className="eoc-card" style={{ padding: 'var(--space-5)', opacity: 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <PIcon size={18} style={{ color }} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>{title}</span>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Not available for this emergency
        </div>
      </div>
    );
  }

  return (
    <div className="eoc-card" style={{ padding: 'var(--space-5)', borderColor: color + '55' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: 'var(--radius-md)',
          backgroundColor: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PIcon size={16} style={{ color }} />
        </div>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>{title}</span>
      </div>
      {type === 'bystander' && (
        <>
          <DetailRow label="Emergency ID" value={data.emergencyId} mono />
          <DetailRow label="Type" value={data.emergencyType} />
          <DetailRow label="Severity" value={data.severity} />
          <DetailRow label="Status" value={data.status} highlight />
          <DetailRow label="Ambulance" value={data.assignedAmbulanceId} mono />
          <DetailRow label="ETA" value={data.eta ? `${data.eta} min` : 'Pending'} />
          <DetailRow label="Hospital" value={data.selectedHospitalName || data.selectedHospitalId} />
        </>
      )}
      {type === 'driver' && (
        <>
          <DetailRow label="Driver" value={data.driverName} />
          <DetailRow label="Driver ID" value={data.driverId} mono />
          <DetailRow label="Ambulance" value={data.ambulanceId} mono />
          <DetailRow label="Assignment" value={data.assignmentStatus} highlight />
          <DetailRow label="ETA" value={data.eta ? `${data.eta} min` : 'N/A'} />
        </>
      )}
      {type === 'hospital' && (
        <>
          <DetailRow label="Hospital" value={data.hospitalName} />
          <DetailRow label="Hospital ID" value={data.hospitalId} mono />
          <DetailRow label="Emergency" value={data.incomingEmergencyId} mono />
          <DetailRow label="Ambulance" value={data.ambulanceId} mono />
          <DetailRow label="ETA" value={data.eta ? `${data.eta} min` : 'N/A'} />
          <DetailRow label="Status" value={data.inboundStatus} highlight />
          {data.resources && (
            <DetailRow label="Resources" value={`ICU: ${data.resources.icuBeds ?? '?'} · Gen: ${data.resources.generalBeds ?? '?'} · Vent: ${data.resources.ventilators ?? '?'}`} />
          )}
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid var(--border-subtle)',
      fontSize: 'var(--text-sm)',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontWeight: 600,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        color: highlight ? 'var(--status-info)' : 'var(--text-primary)',
        fontSize: mono ? 'var(--text-xs)' : 'var(--text-sm)',
      }}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

export default EvidenceWorkflow;
