const { haversineDistanceKm } = require('../../matcher/modules/routing/nearest-segment.service');

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Grid-based 2D Spatial Index for rapid sub-millisecond road lookup and coordinate snapping.
 * Avoids scanning 741,000 coordinates on every GPS update.
 */
class SpatialIndex {
  /**
   * @param {Array<Object>} roads - Normalized road objects with coordinates and boundingBox
   * @param {number} cellSizeDeg - Grid cell size in degrees (default 0.01 deg ~= 1.11 km)
   */
  constructor(roads = [], cellSizeDeg = 0.01) {
    this.cellSizeDeg = cellSizeDeg;
    this.roads = roads;
    this.grid = new Map(); // "cellX_cellY" -> Array of road indices
    this.totalIndexedRoads = 0;
    this.buildIndex();
  }

  _cellKey(cellX, cellY) {
    return `${cellX}_${cellY}`;
  }

  _getCoordCell(lat, lng) {
    return {
      x: Math.floor(lat / this.cellSizeDeg),
      y: Math.floor(lng / this.cellSizeDeg),
    };
  }

  buildIndex() {
    this.grid.clear();
    const startTime = Date.now();

    for (let i = 0; i < this.roads.length; i++) {
      const road = this.roads[i];
      const bbox = road.boundingBox;
      if (!bbox) continue;

      const minCell = this._getCoordCell(bbox.minLat, bbox.minLng);
      const maxCell = this._getCoordCell(bbox.maxLat, bbox.maxLng);

      for (let x = minCell.x; x <= maxCell.x; x++) {
        for (let y = minCell.y; y <= maxCell.y; y++) {
          const key = this._cellKey(x, y);
          let cell = this.grid.get(key);
          if (!cell) {
            cell = [];
            this.grid.set(key, cell);
          }
          cell.push(i);
        }
      }
    }

    this.totalIndexedRoads = this.roads.length;
    this.buildDurationMs = Date.now() - startTime;
  }

  /**
   * Retrieves roads within a bounding box using the spatial grid.
   * @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} bounds
   * @param {number} limit
   * @returns {Array<Object>}
   */
  queryBounds(bounds, limit = 4000) {
    if (!bounds) {
      return this.roads.slice(0, limit);
    }

    const minCell = this._getCoordCell(bounds.minLat, bounds.minLng);
    const maxCell = this._getCoordCell(bounds.maxLat, bounds.maxLng);

    const candidateIndices = new Set();
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        const cell = this.grid.get(this._cellKey(x, y));
        if (cell) {
          for (const idx of cell) {
            candidateIndices.add(idx);
            if (candidateIndices.size >= limit * 2) break;
          }
        }
      }
    }

    const results = [];
    for (const idx of candidateIndices) {
      const road = this.roads[idx];
      const bbox = road.boundingBox;
      // Fast AABB intersection check
      if (
        bbox.maxLat >= bounds.minLat &&
        bbox.minLat <= bounds.maxLat &&
        bbox.maxLng >= bounds.minLng &&
        bbox.minLng <= bounds.maxLng
      ) {
        results.push(road);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Snaps an arbitrary GPS point to the nearest valid KML road segment.
   * @param {{ latitude: number, longitude: number }} point
   * @param {number} maxDistanceMeters - Maximum allowed snapping distance (default: 500m)
   * @returns {Object} Snapping result with coordinates and road metadata
   */
  snapToRoad(point, maxDistanceMeters = 500) {
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
      return {
        isSnapped: false,
        originalCoordinate: point,
        snappedCoordinate: null,
        distanceFromRoadMeters: null,
        reason: 'Invalid coordinates provided',
      };
    }

    const pLat = point.latitude;
    const pLon = point.longitude;

    if (pLat < -90 || pLat > 90 || pLon < -180 || pLon > 180) {
      return {
        isSnapped: false,
        originalCoordinate: point,
        snappedCoordinate: null,
        distanceFromRoadMeters: null,
        reason: 'Coordinates out of bounds',
      };
    }

    // Convert maxDistanceMeters to degrees (~111,320 meters per degree latitude)
    const bufferDeg = (maxDistanceMeters * 1.5) / 111320.0;
    const minCell = this._getCoordCell(pLat - bufferDeg, pLon - bufferDeg);
    const maxCell = this._getCoordCell(pLat + bufferDeg, pLon + bufferDeg);

    const candidateIndices = new Set();
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        const cell = this.grid.get(this._cellKey(x, y));
        if (cell) {
          for (const idx of cell) {
            candidateIndices.add(idx);
          }
        }
      }
    }

    let bestMatch = null;
    let shortestDistKm = Infinity;

    for (const idx of candidateIndices) {
      const road = this.roads[idx];
      const coords = road.coordinates; // array of [lng, lat]
      if (!coords || coords.length < 2) continue;

      for (let s = 0; s < coords.length - 1; s++) {
        const uLon = coords[s][0];
        const uLat = coords[s][1];
        const vLon = coords[s + 1][0];
        const vLat = coords[s + 1][1];

        // Equirectangular projection for perpendicular line segment projection
        const latMid = toRadians((uLat + vLat) / 2);
        const cosLatMid = Math.cos(latMid);

        const dx = (vLon - uLon) * cosLatMid;
        const dy = (vLat - uLat);
        const segLenSq = dx * dx + dy * dy;

        let t = 0;
        if (segLenSq > 0) {
          const px = (pLon - uLon) * cosLatMid;
          const py = (pLat - uLat);
          t = (px * dx + py * dy) / segLenSq;
          t = Math.max(0, Math.min(1, t));
        }

        const projLat = uLat + t * (vLat - uLat);
        const projLon = uLon + t * (vLon - uLon);

        const distKm = haversineDistanceKm(pLat, pLon, projLat, projLon);
        if (distKm < shortestDistKm) {
          shortestDistKm = distKm;
          bestMatch = {
            roadId: road.roadId,
            roadName: road.roadName,
            lat: Math.round(projLat * 1e6) / 1e6,
            lng: Math.round(projLon * 1e6) / 1e6,
            distanceKm: distKm,
            distanceMeters: distKm * 1000.0,
            subsegmentIndex: s,
          };
        }
      }
    }

    if (!bestMatch || bestMatch.distanceMeters > maxDistanceMeters) {
      return {
        isSnapped: false,
        originalCoordinate: { latitude: pLat, longitude: pLon },
        snappedCoordinate: null,
        distanceFromRoadMeters: bestMatch ? Math.round(bestMatch.distanceMeters * 10) / 10 : null,
        candidateRoadName: bestMatch ? bestMatch.roadName : null,
        reason: `Nearest road is ${bestMatch ? bestMatch.distanceMeters.toFixed(1) + 'm' : 'not found'} (exceeds max tolerance ${maxDistanceMeters}m)`,
      };
    }

    return {
      isSnapped: true,
      originalCoordinate: { latitude: pLat, longitude: pLon },
      snappedCoordinate: { latitude: bestMatch.lat, longitude: bestMatch.lng },
      distanceFromRoadMeters: Math.round(bestMatch.distanceMeters * 10) / 10,
      roadId: bestMatch.roadId,
      roadName: bestMatch.roadName,
      source: 'chennai_road_centerline_kml',
    };
  }

  getIndexStats() {
    return {
      totalRoads: this.roads.length,
      totalCells: this.grid.size,
      cellSizeDeg: this.cellSizeDeg,
      buildDurationMs: this.buildDurationMs,
    };
  }
}

module.exports = { SpatialIndex };
