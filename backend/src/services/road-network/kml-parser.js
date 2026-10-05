const fs = require('fs');
const path = require('path');

/**
 * Fast, deterministic KML parser for Chennai Road Centerline data.
 * Adheres to Layer A (Source KML) -> Layer B (Normalized Geometry) architecture.
 */
class KmlParser {
  /**
   * Parse a KML string or file into normalized road geometry records.
   * @param {string} filePath - Absolute path to KML file
   * @returns {{ roads: Array<Object>, metadata: Object }}
   */
  static parseFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`KML file not found: ${filePath}`);
    }

    const startTime = Date.now();
    const xml = fs.readFileSync(filePath, 'utf8');
    const readDurationMs = Date.now() - startTime;

    const parseStart = Date.now();
    const placemarkMatches = xml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];

    const roads = [];
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    let totalCoordinates = 0;

    for (let i = 0; i < placemarkMatches.length; i++) {
      const pm = placemarkMatches[i];

      const roadIdMatch = pm.match(/<SimpleData name="road_id">\s*([\s\S]*?)\s*<\/SimpleData>/);
      const roadId = roadIdMatch ? roadIdMatch[1].trim() : `ROAD_${i + 1}`;

      const roadNameMatch = pm.match(/<SimpleData name="road_name">\s*([\s\S]*?)\s*<\/SimpleData>/);
      const roadName = roadNameMatch ? roadNameMatch[1].trim() : 'Unnamed road';

      const objIdMatch = pm.match(/<SimpleData name="objectid">\s*(\d+)\s*<\/SimpleData>/);
      const objectId = objIdMatch ? parseInt(objIdMatch[1], 10) : i + 1;

      const stLenMatch = pm.match(/<SimpleData name="st_length\(shape\)">\s*([\d.]+)\s*<\/SimpleData>/);
      const reportedLengthMeters = stLenMatch ? parseFloat(stLenMatch[1]) : null;

      const lineMatches = [...pm.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)];
      for (const lineMatch of lineMatches) {
        const rawCoords = lineMatch[1].trim();
        if (!rawCoords) continue;

        const pairs = rawCoords.split(/\s+/);
        const coordinates = [];
        let segMinLat = Infinity, segMaxLat = -Infinity;
        let segMinLng = Infinity, segMaxLng = -Infinity;

        for (const pair of pairs) {
          const parts = pair.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              // Store as [longitude, latitude] matching GeoJSON/OGC standard
              coordinates.push([lng, lat]);
              totalCoordinates++;

              if (lat < segMinLat) segMinLat = lat;
              if (lat > segMaxLat) segMaxLat = lat;
              if (lng < segMinLng) segMinLng = lng;
              if (lng > segMaxLng) segMaxLng = lng;

              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
            }
          }
        }

        if (coordinates.length >= 2) {
          roads.push({
            roadId,
            roadName: roadName || 'Unnamed road',
            objectId,
            reportedLengthMeters,
            coordinates,
            boundingBox: {
              minLng: segMinLng,
              minLat: segMinLat,
              maxLng: segMaxLng,
              maxLat: segMaxLat,
            },
            source: 'chennai_road_centerline_kml',
          });
        }
      }
    }

    const parseDurationMs = Date.now() - parseStart;

    const metadata = {
      filePath: path.basename(filePath),
      fileSizeBytes: fs.statSync(filePath).size,
      readDurationMs,
      parseDurationMs,
      totalPlacemarks: placemarkMatches.length,
      totalRoadLines: roads.length,
      totalCoordinates,
      boundingBox: {
        minLat: Number.isFinite(minLat) ? minLat : null,
        maxLat: Number.isFinite(maxLat) ? maxLat : null,
        minLng: Number.isFinite(minLng) ? minLng : null,
        maxLng: Number.isFinite(maxLng) ? maxLng : null,
      },
    };

    return { roads, metadata };
  }
}

module.exports = { KmlParser };
