import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useEmergency from '../../hooks/useEmergency';
import useHospitalResources from '../../hooks/useHospitalResources';
import emergencyApi from '../../services/emergencyApi';
import socketService from '../../services/socketService';
import EmergencyDetailHeader from '../../components/emergency/EmergencyDetailHeader';
import LifecycleTimeline from '../../components/emergency/LifecycleTimeline';
import FallbackAuditTrail from '../../components/emergency/FallbackAuditTrail';
import ResourceReadinessCard from '../../components/emergency/ResourceReadinessCard';
import AmbulanceMap from '../../components/tracking/AmbulanceMap';
import DynamicEtaWidget from '../../components/tracking/DynamicEtaWidget';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import { Truck, Phone, FileText, MapPin, CheckCircle } from 'lucide-react';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';

export function EmergencyDetailsPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getEmergency } = useEmergency();
  const { resources: hospitalResources } = useHospitalResources(user?.hospitalId);

  // Check live context first, or fallback to REST fetch
  const liveEmergency = getEmergency(requestId);
  const [emergency, setEmergency] = useState(liveEmergency || null);
  const [attempts, setAttempts] = useState(liveEmergency?.attempts || []);
  const [isLoading, setIsLoading] = useState(!liveEmergency);
  const [error, setError] = useState(null);

  // Join individual emergency room: emergency:{requestId} (Checklist Section 9)
  useEffect(() => {
    if (requestId) {
      socketService.joinEmergencyRoom(requestId);
    }
    return () => {
      if (requestId) {
        socketService.leaveEmergencyRoom(requestId);
      }
    };
  }, [requestId]);

  // Keep synced if live emergency in EmergencyContext updates via WebSocket
  useEffect(() => {
    if (liveEmergency) {
      setEmergency(liveEmergency);
      if (liveEmergency.attempts) {
        setAttempts(liveEmergency.attempts);
      }
    }
  }, [liveEmergency]);

  // Initial load from API if not already in context: GET /api/emergency/{requestId}
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!requestId) return;
      if (!liveEmergency) {
        setIsLoading(true);
        setError(null);
        try {
          const details = await emergencyApi.getEmergencyDetails(requestId);
          const attemptData = await emergencyApi.getRequestAttempts(requestId);
          if (isMounted) {
            setEmergency(details);
            setAttempts(attemptData || details.attempts || []);
          }
        } catch (err) {
          if (isMounted) {
            setError(err.message || 'Unable to load emergency incident dossier.');
          }
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [requestId, liveEmergency]);

  if (isLoading) {
    return <LoadingSpinner message={`Loading emergency dossier for ${requestId}...`} fullPage />;
  }

  if (error || !emergency) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <ErrorAlert
          title="Emergency Record Not Found"
          message={error || `No emergency request found matching ID "${requestId}".`}
          onRetry={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  const pickupLat = emergency.incidentLocation?.latitude || emergency.pickupLocation?.latitude || emergency.location?.latitude || 13.0827;
  const pickupLng = emergency.incidentLocation?.longitude || emergency.pickupLocation?.longitude || emergency.location?.longitude || 80.2707;
  const pickupAddress = emergency.incidentLocation?.address || emergency.pickupLocation?.address || emergency.pickupLocation || 'Scene: Central Railway Station vicinity, Chennai';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Dossier Header */}
      <EmergencyDetailHeader emergency={emergency} />

      {/* Stepped Emergency Lifecycle Progress Timeline */}
      <LifecycleTimeline currentStatus={emergency.status} />

      {/* Hospital Advance Resource Preparation Alert Card */}
      <ResourceReadinessCard emergency={emergency} hospitalResources={hospitalResources} />

      {/* Main Grid: Telemetry Map on Left, Vehicle Dossier & Dynamic ETA on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Live GPS Tracking Map */}
        <div>
          <AmbulanceMap emergency={emergency} height="440px" />
        </div>

        {/* Right Column: Dynamic ETA + Assigned Ambulance Unit Dossier + Pickup Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dynamic ETA Widget */}
          <DynamicEtaWidget
            eta={emergency.eta}
            initialEta={emergency.initialEta}
            trafficCondition={emergency.trafficCondition}
            updatedAt={emergency.updatedAt}
          />

          {/* Incident & Patient Pickup Location Card (Checklist Section 7) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--status-critical)',
                fontWeight: 700,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MapPin size={15} />
              <span>Patient Pickup Location</span>
            </div>

            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {pickupAddress}
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              GPS Coordinates: {formatCoordinates(pickupLat, pickupLng)}
            </div>
          </div>

          {/* Ambulance & Driver Technical Dossier */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Truck size={15} style={{ color: 'var(--status-info)' }} />
              <span>Assigned Ambulance & Crew Specification</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unit Identifier</div>
                <div className="tabular-nums font-mono" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {emergency.ambulanceId}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vehicle Type</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {emergency.ambulanceType || 'Advanced Life Support (ALS)'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Responding Driver</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {emergency.driverName || 'Authorized Paramedic'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Direct Radio / Contact</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-info)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} />
                  <span>{emergency.driverPhone || '+91 98401 00000'}</span>
                </div>
              </div>
            </div>

            {/* Completion Timestamp Banner if Completed */}
            {emergency.completedAt && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid var(--status-success-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: 'var(--status-success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={15} />
                <span>Incident Concluded: <strong>{formatDateTime(emergency.completedAt)}</strong></span>
              </div>
            )}

            {/* Field Triage Notes */}
            {emergency.patientNotes && (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>
                  <FileText size={13} style={{ color: 'var(--status-info)' }} />
                  <span>Paramedic Telemetry & Field Notes:</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {emergency.patientNotes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cascading Fallback Attempts Audit Trail (Checklist Section 7) */}
      <FallbackAuditTrail attempts={attempts} />
    </div>
  );
}

export default EmergencyDetailsPage;
