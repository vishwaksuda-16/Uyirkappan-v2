import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { PresentationWrapper, PresentationToggle } from '../../components/evidence/PresentationWrapper';
import { RouteLegend } from '../../components/evidence/RouteLegend';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ChevronLeft, Route, HelpCircle, ArrowRight, AlertTriangle } from 'lucide-react';

export function EvidenceRouteComparison() {
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
      const res = await apiClient.get(`/evidence/route-comparison/${id}`);
      setData(res?.routeComparison || null);
    } catch (err) {
      setError(err.message || 'Failed to load route data');
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
      navigate(`/evidence/route-comparison?caseId=${inputCaseId.trim()}`, { replace: true });
      loadData(inputCaseId.trim());
    }
  };

  // Initialize map when data is available
  useEffect(() => {
    if (!data || !mapRef.current || typeof window === 'undefined') return;
    if (!window.L) return;

    // Cleanup previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const L = window.L;
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    const bounds = [];

    // Ambulance marker
    if (data.ambulanceLocation) {
      const ambPos = [data.ambulanceLocation.latitude, data.ambulanceLocation.longitude];
      bounds.push(ambPos);
      L.circleMarker(ambPos, { radius: 8, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 2 })
        .bindPopup('🚑 Ambulance').addTo(map);
    }

    // Patient marker
    if (data.patientLocation) {
      const patPos = [data.patientLocation.latitude, data.patientLocation.longitude];
      bounds.push(patPos);
      L.circleMarker(patPos, { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 })
        .bindPopup('📍 Patient / Incident').addTo(map);
    }

    // Baseline route (dashed, muted)
    if (data.baseline?.waypoints?.length > 1) {
      const baselineCoords = data.baseline.waypoints.map(w => [w.latitude || w.lat, w.longitude || w.lng]);
      L.polyline(baselineCoords, { color: '#64748b', weight: 4, opacity: 0.6, dashArray: '8, 8' }).addTo(map);
      baselineCoords.forEach(c => bounds.push(c));
    }

    // UyirKappan route (solid, prominent)
    if (data.uyirkappan?.waypoints?.length > 1) {
      const ukCoords = data.uyirkappan.waypoints.map(w => [w.latitude || w.lat, w.longitude || w.lng]);
      L.polyline(ukCoords, { color: '#10b981', weight: 5, opacity: 0.9 }).addTo(map);
      ukCoords.forEach(c => bounds.push(c));
    }

    // Fit bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
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

  const comp = data?.comparison || {};

  const content = (
    <>
      {!isPresentationMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/evidence')} className="btn btn--ghost btn--sm"><ChevronLeft size={16} /></button>
            <div>
              <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: 0 }}>Figure E3 — Route Comparison & Selection</h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Baseline vs UyirKappan traffic-aware route</div>
            </div>
          </div>
          <PresentationToggle onClick={() => setIsPresentationMode(true)} />
        </div>
      )}

      {!data && !loading && (
        <div className="eoc-card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <Route size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>Select an Emergency Case</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <input value={inputCaseId} onChange={(e) => setInputCaseId(e.target.value)} placeholder="Enter Emergency ID"
              style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', width: '280px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadCase()} />
            <button onClick={handleLoadCase} className="btn btn--primary">Load Case</button>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Calculating routes..." />}
      {error && <div style={{ padding: '16px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Map */}
          <div className="eoc-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div ref={mapRef} style={{ height: '400px', width: '100%', borderRadius: 'var(--radius-lg)' }} />
          </div>

          {/* Route Legend */}
          <RouteLegend showHospital={false} />

          {/* Comparison Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-4)', alignItems: 'stretch' }}>
            {/* Baseline */}
            <div className="eoc-card" style={{ padding: 'var(--space-5)', borderColor: data.selectedRoute === 'BASELINE' ? 'var(--status-success-border)' : 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '20px', height: '3px', borderRadius: '2px', background: 'repeating-linear-gradient(90deg, var(--route-baseline) 0, var(--route-baseline) 4px, transparent 4px, transparent 8px)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>BASELINE</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '12px' }}>Shortest Distance / Baseline</div>
              <DetailRow label="Distance" value={`${comp.baselineDistance || data.baseline?.distanceKm} km`} mono />
              <DetailRow label="ETA" value={`${comp.baselineEta || data.baseline?.etaMinutes} min`} mono />
              <DetailRow label="Traffic" value={data.baseline?.traffic || 'Standard'} />
            </div>

            {/* VS Divider */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '60px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-card)',
                border: '2px solid var(--border-default)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)',
              }}>
                VS
              </div>
            </div>

            {/* UyirKappan */}
            <div className="eoc-card" style={{
              padding: 'var(--space-5)',
              borderColor: data.selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success-border)' : 'var(--border-subtle)',
              backgroundColor: data.selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success-bg)' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '20px', height: '3px', borderRadius: '2px', backgroundColor: 'var(--route-uyirkappan)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: data.selectedRoute === 'UYIRKAPPAN' ? 'var(--status-success)' : 'var(--text-muted)', letterSpacing: '0.06em' }}>UYIRKAPPAN</span>
                {data.selectedRoute === 'UYIRKAPPAN' && (
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', border: '1px solid var(--status-success-border)' }}>★ SELECTED</span>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '12px' }}>Traffic-Aware Optimized</div>
              <DetailRow label="Distance" value={`${comp.uyirkappanDistance || data.uyirkappan?.distanceKm} km`} mono />
              <DetailRow label="ETA" value={`${comp.uyirkappanEta || data.uyirkappan?.etaMinutes} min`} mono highlight={data.selectedRoute === 'UYIRKAPPAN'} />
              <DetailRow label="Traffic" value={data.uyirkappan?.traffic || 'Optimized'} />
            </div>
          </div>

          {/* Improvement */}
          {comp.improvementPct > 0 && (
            <div className="eoc-card" style={{ padding: 'var(--space-5)', textAlign: 'center', backgroundColor: 'var(--status-success-bg)', borderColor: 'var(--status-success-border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-success)', letterSpacing: '0.06em' }}>ETA Improvement</div>
              <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--status-success)', fontFamily: 'var(--font-mono)' }}>{comp.improvementPct}%</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{comp.uyirkappanEta} min vs {comp.baselineEta} min baseline</div>
            </div>
          )}

          {/* Decision */}
          <div className="eoc-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <HelpCircle size={16} style={{ color: 'var(--status-purple)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Route Selection Decision</span>
            </div>
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7,
            }}>
              {data.selectionReason}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isPresentationMode) {
    return (
      <PresentationWrapper
        title="Route Comparison & Selection"
        figureCaption="Fig. 8. Visual comparison of baseline and traffic-aware UyirKappan route selection."
        onClose={() => setIsPresentationMode(false)}
      >{content}</PresentationWrapper>
    );
  }

  return <div style={{ maxWidth: '1400px', margin: '0 auto' }}>{content}</div>;
}

function DetailRow({ label, value, mono, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: mono ? 'var(--font-mono)' : 'inherit', color: highlight ? 'var(--status-success)' : 'var(--text-primary)' }}>{value || 'N/A'}</span>
    </div>
  );
}

export default EvidenceRouteComparison;
