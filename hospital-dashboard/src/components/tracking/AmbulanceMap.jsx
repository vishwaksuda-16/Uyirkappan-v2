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

  const currentLocation = emergency?.currentLocation || null;
  const hospitalLocation = emergency?.hospitalLocation
    || emergency?.destinationHospital?.location
    || null;
  const incidentLocation = emergency?.incidentLocation
    || emergency?.pickupLocation
    || emergency?.location
    || null;
  const isValidLocation = (location) =>
    Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  const selectedRoute = emergency?.route;
  const primaryWaypoints = selectedRoute?.waypoints || [];

  // Check staleness (Module 3 Section 41: "Stale ambulance location: Mark location as stale")
  useEffect(() => {
    const checkStaleness = () => {
      if (!currentLocation?.timestamp) {
        setIsStale(false);
        return;
      }
      const ageMs = Date.now() - new Date(currentLocation.timestamp).getTime();
      setIsStale(ageMs > 45000); // marked stale if > 45s without update
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, 5000);
    return () => clearInterval(interval);
  }, [currentLocation?.timestamp]);

  // Compute normalized canvas coordinates from GPS bounding box using the main route and endpoints
  const mapLocations = [
    incidentLocation,
    currentLocation,
    hospitalLocation,
    ...primaryWaypoints,
  ].filter(isValidLocation);
  const allLats = mapLocations.map((location) => location.latitude);
  const allLngs = mapLocations.map((location) => location.longitude);
  const minLat = (allLats.length ? Math.min(...allLats) : 0) - 0.005;
  const maxLat = (allLats.length ? Math.max(...allLats) : 0) + 0.005;
  const minLng = (allLngs.length ? Math.min(...allLngs) : 0) - 0.005;
  const maxLng = (allLngs.length ? Math.max(...allLngs) : 0) + 0.005;

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  // Project lat/lng to SVG percent coordinates (0% to 100%)
  const project = (lat, lng) => {
    const x = ((lng - minLng) / lngRange) * 80 + 10;
    const y = ((maxLat - lat) / latRange) * 70 + 15;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(10, Math.min(90, y)) };
  };

  const incidentPos = isValidLocation(incidentLocation)
    ? project(incidentLocation.latitude, incidentLocation.longitude)
    : null;
  const currentPos = isValidLocation(currentLocation)
    ? project(currentLocation.latitude, currentLocation.longitude)
    : null;
  const hospitalPos = isValidLocation(hospitalLocation)
    ? project(hospitalLocation.latitude, hospitalLocation.longitude)
    : null;

  const primaryPoints = primaryWaypoints.length > 1
    ? primaryWaypoints.filter(isValidLocation).map((waypoint) => project(waypoint.latitude, waypoint.longitude))
    : [];
  const primaryPolyline = primaryPoints.map(p => `${p.x},${p.y}`).join(' ');

  const bestEta = emergency?.eta ?? emergency?.route?.travelTimeMinutes;

  return (
    <div
      style={{
        position: 'relative',
        height,
        width: '100%',
        backgroundColor: 'var(--bg-card)',
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
          backgroundColor: 'var(--bg-secondary)',
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
            <span>GPS TRACKING: {emergency?.ambulanceId || 'AMBULANCE'}</span>
          </div>

          {/* Telemetry Source Badge: LIVE vs SIMULATION */}
          {currentLocation && (currentLocation.provider === 'real' || currentLocation.gpsSource === 'DEVICE' || currentLocation.isSimulated === false) ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-success-bg)',
                border: '1px solid var(--status-success-border)',
                color: 'var(--status-success)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              ● GPS LIVE (REAL)
            </span>
          ) : currentLocation ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-info-bg)',
                border: '1px solid var(--status-info-border)',
                color: 'var(--status-info)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              ○ GPS SIMULATION
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>
              WAITING FOR GPS
            </span>
          )}

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
            <span className="tabular-nums font-mono">
              {currentLocation?.speed != null ? formatSpeed(currentLocation.speed) : '--'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Compass size={13} style={{ color: 'var(--status-info)' }} />
            <span className="tabular-nums font-mono">
              {currentLocation?.heading != null ? `${currentLocation.heading}°` : '--'}
            </span>
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
          backgroundColor: 'var(--bg-primary)',
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
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd5e1" strokeWidth="1" />
            </pattern>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f766e" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Selected dispatch route for the active emergency */}
          {primaryPoints.length > 1 && (
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
        {primaryPoints.length > 1 && (
          <div
            style={{
              position: 'absolute',
              left: `${primaryPoints[Math.floor(primaryPoints.length / 2)].x}%`,
              top: `${primaryPoints[Math.floor(primaryPoints.length / 2)].y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '10px',
              border: '1px solid #5eead4',
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'none',
              zIndex: 13,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {bestEta != null ? `SELECTED ROUTE • ${bestEta} min` : 'SELECTED ROUTE'}
          </div>
        )}

        {/* Incident Marker */}
        {incidentPos && <div
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
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: 'var(--text-secondary)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Scene
          </span>
        </div>}

        {/* Live Ambulance Marker (Moving) */}
        {currentPos && <div
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
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--status-critical-border)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {emergency?.ambulanceId || 'AMB'}{emergency?.eta != null ? ` • ${emergency.eta}m` : ''}
          </div>
        </div>}

        {/* Hospital Destination Marker */}
        {hospitalPos && <div
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
              backgroundColor: 'var(--status-success-bg)',
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
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: 'var(--status-success)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Hospital Destination
          </span>
        </div>}
      </div>

      {/* Map Footer Bar with Coordinates & Location Details */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'var(--bg-secondary)',
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
          <span>{currentLocation?.address || (currentLocation ? 'Ambulance GPS location' : 'Waiting for first ambulance location')}</span>
        </div>
        <div className="tabular-nums font-mono">
          {currentLocation && isValidLocation(currentLocation)
            ? formatCoordinates(currentLocation.latitude, currentLocation.longitude)
            : 'GPS coordinates unavailable'}
        </div>
      </div>
    </div>
  );
}

export default AmbulanceMap;
