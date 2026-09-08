/**
 * Presentation Formatters for Emergency Operations
 */

export function formatEta(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return '-- min';
  }
  const mins = Math.round(Number(minutes));
  if (mins <= 0) return '< 1 min';
  return `${mins < 10 ? '0' : ''}${mins} min`;
}

export function formatTimestamp(isoDate) {
  if (!isoDate) return '--:--:--';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(isoDate) {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateOnly(isoDate) {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeTime(isoDate) {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return 'N/A';

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return formatDateOnly(isoDate);
}

export function formatSpeed(speedKmh) {
  if (speedKmh === null || speedKmh === undefined || isNaN(speedKmh)) {
    return '0 km/h';
  }
  return `${Math.round(Number(speedKmh))} km/h`;
}

export function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return '-- km';
  }
  const val = Number(distanceKm);
  if (val < 1) {
    return `${Math.round(val * 1000)} m`;
  }
  return `${val.toFixed(1)} km`;
}

export function formatCoordinates(lat, lng) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return 'Coordinates unavailable';
  }
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}
