import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import socketService from '../../services/socketService';
import { PresentationWrapper, PresentationToggle } from '../../components/evidence/PresentationWrapper';
import { RouteLegend } from '../../components/evidence/RouteLegend';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ChevronLeft, Radio, Truck, Clock, MapPin, Building2, ArrowRight, Gauge, AlertTriangle } from 'lucide-react';

export function EvidenceLiveTracking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = searchParams.get('caseId') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [inputCaseId, setInputCaseId] = useState(caseId);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const loadData = async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/evidence/tracking/${id}`);
      setData(res?.tracking || null);
    } catch (err) {
      setError(err.message || 'Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadData(caseId);
      socketService.joinEmergencyRoom(caseId);
    } else {
      setLoading(false);
    }
    return () => {
      if (caseId) socketService.leaveEmergencyRoom(caseId);
    };
  }, [caseId]);

  // Listen for real-time location updates
  useEffect(() => {
    if (!caseId) return;

    const handleLocation = (payload) => {
      if (payload?.requestId === caseId || payload?.ambulanceId === data?.ambulanceId) {
        setData(prev => prev ? {
          ...prev,
          currentLocation: payload.location || payload.currentLocation || prev.currentLocation,
        } : prev);
      }
    };

    const handleEta = (payload) => {
      if (payload?.requestId === caseId) {
        setData(prev => prev ? {
          ...prev,
          eta: payload.etaMinutes ?? payload.eta ?? prev.eta,
        } : prev);
      }
    };

    socketService.on('AMBULANCE_LOCATION_UPDATED', handleLocation);
    socketService.on('LOCATION_UPDATED', handleLocation);
    socketService.on('ETA_UPDATED', handleEta);

    return () => {
      socketService.off('AMBULANCE_LOCATION_UPDATED', handleLocation);
      socketService.off('LOCATION_UPDATED', handleLocation);
      socketService.off('ETA_UPDATED', handleEta);
    };
  }, [caseId, data?.ambulanceId]);

  const handleLoadCase = () => {
    if (inputCaseId.trim()) {
      navigate(`/evidence/live-tracking?caseId=${inputCaseId.trim()}`, { replace: true });
      loadData(inputCaseId.trim());
    }
  };

  // Map rendering
  useEffect(() => {
    if (!data || !mapRef.current || typeof window === 'undefined' || !window.L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const bounds = [];

    // Ambulance
    if (data.currentLocation?.latitude) {
      const pos = [data.currentLocation.latitude, data.currentLocation.longitude];
      bounds.push(pos);
      L.circleMarker(pos, { radius: 10, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 3 })
        .bindPopup(`🚑 ${data.ambulanceId || 'Ambulance'}`).addTo(map);

      // Pulsing ring
      L.circleMarker(pos, { radius: 18, color: '#0ea5e9', fillOpacity: 0, weight: 2, opacity: 0.4 }).addTo(map);
    }

    // Destination / Patient
    if (data.destination?.latitude) {
      const destPos = [data.destination.latitude, data.destination.longitude];
      bounds.push(destPos);
      L.circleMarker(destPos, { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 })
        .bindPopup('📍 Patient Location').addTo(map);
    }

    // Hospital
    if (data.hospital?.location?.latitude) {
      const hospPos = [data.hospital.location.latitude, data.hospital.location.longitude];
      bounds.push(hospPos);
      L.circleMarker(hospPos, { radius: 8, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9, weight: 2 })
        .bindPopup(`🏥 ${data.hospital.name}`).addTo(map);
    }

    // Route
    if (data.route?.waypoints?.length > 1) {
      const routeCoords = data.route.waypoints.map(w => [w.latitude || w.lat, w.longitude || w.lng]);
      L.polyline(routeCoords, { color: '#10b981', weight: 4, opacity: 0.8 }).addTo(map);
      routeCoords.forEach(c => bounds.push(c));
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([13.05, 80.25], 12);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  const statusPhases = ['DISPATCHED', 'ACCEPTED', 'EN ROUTE', 'ARRIVED'];
  const currentPhase = (() => {
    const s = data?.status || '';
    if (s.includes('ARRIVED') || s.includes('COMPLETED')) return 3;
    if (s.includes('EN_ROUTE') || s.includes('PATIENT_ONBOARD')) return 2;
    if (s.includes('ACCEPTED') || s.includes('DRIVER_ACCEPTED')) return 1;
    return 0;
  })();

  const content = (
    <>
      {!isPresentationMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/evidence')} className="btn btn--ghost btn--sm"><ChevronLeft size={16} /></button>
            <div>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Figure E4 — Live Tracking & Dynamic ETA</h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Real-time ambulance tracking with GPS telemetry</div>
            </div>
          </div>
          <PresentationToggle onClick={() => setIsPresentationMode(true)} />
        </div>
      )}

      {!data && !loading && (
        <div className="eoc-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Radio size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>Load an Active Emergency for Live Tracking</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <input value={inputCaseId} onChange={(e) => setInputCaseId(e.target.value)} placeholder="Enter Emergency ID"
              style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', width: '280px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadCase()} />
            <button onClick={handleLoadCase} className="btn btn--primary">Load Case</button>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Connecting to GPS telemetry..." />}
      {error && <div style={{ padding: '16px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* GPS Map */}
          <div className="eoc-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 400,
              backgroundColor: 'rgba(10, 14, 23, 0.9)', padding: '8px 14px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span className="animate-pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-success)', display: 'inline-block' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--status-success)', textTransform: 'uppercase' }}>LIVE GPS TRACKING</span>
            </div>
            <div ref={mapRef} style={{ height: '450px', width: '100%' }} />
          </div>

          <RouteLegend />

          {/* Status Timeline */}
          <div className="status-timeline" style={{ justifyContent: 'center' }}>
            {statusPhases.map((phase, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div className={`status-timeline-step ${i < currentPhase ? 'status-timeline-step--completed' : i === currentPhase ? 'status-timeline-step--active' : 'status-timeline-step--pending'}`}>
                  {phase}
                </div>
                {i < statusPhases.length - 1 && (
                  <ArrowRight size={14} className="status-timeline-arrow" />
                )}
              </div>
            ))}
          </div>

          {/* Tracking Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <InfoCard icon={Truck} label="Ambulance" value={data.ambulanceId || 'N/A'} mono />
            <InfoCard icon={MapPin} label="Driver" value={data.driverName || 'N/A'} />
            <InfoCard icon={Clock} label="ETA" value={data.eta ? `${data.eta} min` : 'N/A'} highlight />
            <InfoCard icon={Radio} label="Status" value={data.status || 'N/A'} />
            <InfoCard icon={Gauge} label="Speed" value={data.speed ? `${data.speed} km/h` : 'N/A'} />
            <InfoCard icon={Building2} label="Hospital" value={data.hospital?.name || 'N/A'} />
          </div>
        </div>
      )}
    </>
  );

  if (isPresentationMode) {
    return (
      <PresentationWrapper
        title="Live Tracking & Dynamic ETA"
        figureCaption="Fig. 9. Real-time ambulance tracking and dynamic estimated-time-of-arrival updates."
        onClose={() => setIsPresentationMode(false)}
      >{content}</PresentationWrapper>
    );
  }

  return <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{content}</div>;
}

function InfoCard({ icon: IIcon, label, value, mono, highlight }) {
  return (
    <div className="eoc-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: highlight ? 'var(--status-info)' : 'var(--text-muted)',
      }}>
        <IIcon size={18} />
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{
          fontSize: highlight ? 'var(--text-lg)' : 'var(--text-sm)', fontWeight: 700,
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          color: highlight ? 'var(--status-info)' : 'var(--text-primary)',
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default EvidenceLiveTracking;
