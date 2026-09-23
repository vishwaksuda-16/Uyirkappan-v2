import { useState, useEffect } from 'react';
import { Truck, Building2, MapPin, Navigation, Gauge, AlertCircle, Compass } from 'lucide-react';
import { formatSpeed, formatCoordinates } from '../../utils/formatters';

/**
 * Reusable Live Ambulance Tracking Map Component
 * Primary Source: Module 3 (Section 10, 11) & Module 6 (Section 4, 5, 8)
 */
export function AmbulanceMap({
  emergency,
  height = '360px',
}) {
  const [isStale, setIsStale] = useState(false);

  const currentLocation = emergency?.currentLocation || {
    latitude: 13.0658,
    longitude: 80.2541,
    speed: 45,
    heading: 190,
    timestamp: new Date().toISOString(),
  };

  const hospitalLocation = emergency?.hospitalLocation || {
    latitude: emergency?.destinationHospital?.location?.latitude || 13.0827,
    longitude: emergency?.destinationHospital?.location?.longitude || 80.2707,
    name: emergency?.hospitalName || 'Destination Hospital',
  };

  const incidentLocation = emergency?.incidentLocation || {
    latitude: 13.0827,
    longitude: 80.2707,
    name: 'Incident Site',
  };

  // Check staleness (Module 3 Section 41: "Stale ambulance location: Mark location as stale")
  useEffect(() => {
    const checkStaleness = () => {
      if (!currentLocation?.timestamp) return;
      const ageMs = Date.now() - new Date(currentLocation.timestamp).getTime();
      setIsStale(ageMs > 45000); // marked stale if > 45s without update
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 5000);
    return () => clearInterval(interval);
  }, [currentLocation?.timestamp]);

  // Compute normalized canvas coordinates from GPS bounding box using the main route and endpoints
  const allLats = [
    incidentLocation?.latitude,
    currentLocation?.latitude,
    hospitalLocation?.latitude,
    ...(emergency?.route?.waypoints?.map(wp => wp.latitude) || []),
  ].filter(lat => typeof lat === 'number' && !isNaN(lat) && lat !== 0);

  const allLngs = [
    incidentLocation?.longitude,
    currentLocation?.longitude,
    hospitalLocation?.longitude,
    ...(emergency?.route?.waypoints?.map(wp => wp.longitude) || []),
  ].filter(lng => typeof lng === 'number' && !isNaN(lng) && lng !== 0);

  const minLat = Math.min(...allLats) - 0.005;
  const maxLat = Math.max(...allLats) + 0.005;
  const minLng = Math.min(...allLngs) - 0.005;
  const maxLng = Math.max(...allLngs) + 0.005;

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  // Project lat/lng to SVG percent coordinates (0% to 100%)
  const project = (lat, lng) => {
    const x = ((lng - minLng) / lngRange) * 80 + 10;
    const y = ((maxLat - lat) / latRange) * 70 + 15;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(10, Math.min(90, y)) };
  };

  const incidentPos = project(incidentLocation.latitude, incidentLocation.longitude);
  const currentPos = project(currentLocation.latitude, currentLocation.longitude);
  const hospitalPos = project(hospitalLocation.latitude, hospitalLocation.longitude);

  // Dynamic route waypoints from backend
  const primaryWaypoints = emergency?.route?.waypoints || [];
  const primaryPoints = primaryWaypoints.length > 1
    ? primaryWaypoints.map(wp => project(wp.latitude, wp.longitude))
    : [currentPos, hospitalPos];
  const primaryPolyline = primaryPoints.map(p => `${p.x},${p.y}`).join(' ');

  const bestEta = emergency?.eta || emergency?.route?.travelTimeMinutes || 6;

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: '100%',
        backgroundColor: '#0a0f1d',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Map Header Status & Telemetry Bar */}
      <div
        style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--status-critical)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <Navigation size={14} className="animate-pulse" />
            <span>LIVE GPS TRACKING: {emergency?.ambulanceId || 'AMBULANCE'}</span>
          </div>

          {isStale && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-warning-bg)',
                border: '1px solid var(--status-warning-border)',
                color: 'var(--status-warning)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={12} />
              <span>Telemetry Stale (&gt;45s)</span>
            </span>
          )}
        </div>

        {/* Live Telemetry Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Gauge size={13} style={{ color: 'var(--status-info)' }} />
            <span className="tabular-nums font-mono">{formatSpeed(currentLocation.speed)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Compass size={13} style={{ color: 'var(--status-info)' }} />
            <span className="tabular-nums font-mono">{currentLocation.heading || 0}°</span>
          </div>
        </div>
      </div>

      {/* Vector Geospatial Map Canvas Area */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: '#0c1322',
        }}
      >
        {/* Radar / Grid lines */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(30, 41, 59, 0.45)" strokeWidth="1" />
            </pattern>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Selected dispatch route for the active emergency */}
          {primaryPolyline && (
            <polyline
              points={primaryPolyline}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Selected route badge */}
        {primaryPoints.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${primaryPoints[Math.floor(primaryPoints.length / 2)].x}%`,
              top: `${primaryPoints[Math.floor(primaryPoints.length / 2)].y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '10px',
              border: '1px solid #38bdf8',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
              zIndex: 13,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            SELECTED ROUTE • {bestEta} min
          </div>
        )}

        {/* Incident Marker */}
        <div
          style={{
            position: 'absolute',
            left: `${incidentPos.x}%`,
            top: `${incidentPos.y}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 15,
          }}
        >
          <div
            style={{
              padding: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid var(--status-critical-border)',
              borderRadius: '50%',
              color: 'var(--status-critical)',
            }}
          >
            <MapPin size={16} />
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Scene
          </span>
        </div>

        {/* Live Ambulance Marker (Moving) */}
        <div
          style={{
            position: 'absolute',
            left: `${currentPos.x}%`,
            top: `${currentPos.y}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 25,
            transition: 'left 1s linear, top 1s linear',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-critical)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
            }}
          >
            <div
              className="animate-ping-slow"
              style={{
                position: 'absolute',
                inset: '-4px',
                borderRadius: '50%',
                border: '2px solid var(--status-critical)',
              }}
            />
            <Truck size={20} />
          </div>

          <div
            style={{
              marginTop: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--status-critical-border)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {emergency?.ambulanceId || 'AMB'} • {emergency?.eta || 6}m
          </div>
        </div>

        {/* Hospital Destination Marker */}
        <div
          style={{
            position: 'absolute',
            left: `${hospitalPos.x}%`,
            top: `${hospitalPos.y}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 15,
          }}
        >
          <div
            style={{
              padding: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid var(--status-success)',
              borderRadius: '50%',
              color: 'var(--status-success)',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
            }}
          >
            <Building2 size={18} />
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: 'var(--status-success)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Hospital Destination
          </span>
        </div>
      </div>

      {/* Map Footer Bar with Coordinates & Location Details */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Location: </span>
          <span>{currentLocation.address || 'In transit along emergency corridor'}</span>
        </div>
        <div className="tabular-nums font-mono">
          {formatCoordinates(currentLocation.latitude, currentLocation.longitude)}
        </div>
      </div>
    </div>
  );
}

export default AmbulanceMap;
