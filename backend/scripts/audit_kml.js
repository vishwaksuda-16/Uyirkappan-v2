const fs = require('fs');
const path = require('path');

function auditKml(kmlFilePath) {
  console.log(`Auditing KML file: ${kmlFilePath}`);
  const startTime = Date.now();
  const content = fs.readFileSync(kmlFilePath, 'utf8');
  const readDurationMs = Date.now() - startTime;
  console.log(`File read in ${readDurationMs} ms (Size: ${(content.length / (1024 * 1024)).toFixed(2)} MB)`);

  const parseStart = Date.now();
  const placemarkMatches = content.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
  const placemarksCount = placemarkMatches.length;

  let totalLineStrings = 0;
  let totalCoordinates = 0;
  let validGeometries = 0;
  let invalidGeometries = 0;
  let emptyGeometries = 0;
  let singlePointGeometries = 0;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  let roadIdCount = 0;
  let roadNameCount = 0;
  let unnamedRoadCount = 0;
  let objectIdCount = 0;
  let stLengthCount = 0;

  // Metadata checks for routing attributes
  let directionalityTags = 0;
  let speedLimitTags = 0;
  let oneWayTags = 0;
  let roadTypeTags = 0;
  let laneTags = 0;
  let elevationTags = 0;

  const roadNamesSet = new Set();
  const roadIdsSet = new Set();
  const geometrySignatures = new Map(); // for duplicate detection
  const endpointsMap = new Map(); // endpoint coord -> count

  for (let i = 0; i < placemarkMatches.length; i++) {
    const pm = placemarkMatches[i];

    // Metadata extraction
    const roadIdMatch = pm.match(/<SimpleData name="road_id">\s*([\s\S]*?)\s*<\/SimpleData>/);
    const roadId = roadIdMatch ? roadIdMatch[1].trim() : null;
    if (roadId) {
      roadIdCount++;
      roadIdsSet.add(roadId);
    }

    const roadNameMatch = pm.match(/<SimpleData name="road_name">\s*([\s\S]*?)\s*<\/SimpleData>/);
    const roadName = roadNameMatch ? roadNameMatch[1].trim() : null;
    if (roadName && roadName.length > 0) {
      roadNameCount++;
      roadNamesSet.add(roadName);
      if (roadName.toLowerCase() === 'unnamed road' || roadName === '') {
        unnamedRoadCount++;
      }
    } else {
      unnamedRoadCount++;
    }

    if (pm.includes('name="objectid"')) objectIdCount++;
    if (pm.includes('name="st_length(shape)"')) stLengthCount++;

    // Check for directionality or navigation attributes
    if (pm.match(/name="(oneway|one_way|direction|dir|traffic_dir)"/i)) directionalityTags++;
    if (pm.match(/name="(speed|speed_limit|maxspeed)"/i)) speedLimitTags++;
    if (pm.match(/name="(type|road_type|highway|class)"/i)) roadTypeTags++;
    if (pm.match(/name="(lanes|lane_count)"/i)) laneTags++;
    if (pm.match(/name="(level|layer|bridge|tunnel|elevation|z_order)"/i)) elevationTags++;

    // Geometry extraction
    const lineCoordMatches = [...pm.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)];
    for (const match of lineCoordMatches) {
      totalLineStrings++;
      const rawText = match[1].trim();
      if (!rawText) {
        emptyGeometries++;
        invalidGeometries++;
        continue;
      }

      const rawPairs = rawText.split(/\s+/);
      const parsedCoords = [];
      for (const pair of rawPairs) {
        const parts = pair.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            parsedCoords.push([lng, lat]);
            totalCoordinates++;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          }
        }
      }

      if (parsedCoords.length < 2) {
        if (parsedCoords.length === 1) singlePointGeometries++;
        invalidGeometries++;
      } else {
        validGeometries++;

        // Duplicate signature detection
        const startPt = `${parsedCoords[0][0].toFixed(6)},${parsedCoords[0][1].toFixed(6)}`;
        const endPt = `${parsedCoords[parsedCoords.length - 1][0].toFixed(6)},${parsedCoords[parsedCoords.length - 1][1].toFixed(6)}`;
        const forwardSig = `${startPt}->${endPt}#${parsedCoords.length}`;
        const reverseSig = `${endPt}->${startPt}#${parsedCoords.length}`;

        if (geometrySignatures.has(forwardSig) || geometrySignatures.has(reverseSig)) {
          geometrySignatures.set(forwardSig, (geometrySignatures.get(forwardSig) || 1) + 1);
        } else {
          geometrySignatures.set(forwardSig, 1);
        }

        // Endpoint tracking
        endpointsMap.set(startPt, (endpointsMap.get(startPt) || 0) + 1);
        endpointsMap.set(endPt, (endpointsMap.get(endPt) || 0) + 1);
      }
    }
  }

  const parseDurationMs = Date.now() - parseStart;

  // Duplicate analysis
  let duplicateCount = 0;
  for (const count of geometrySignatures.values()) {
    if (count > 1) duplicateCount += (count - 1);
  }

  // Endpoint connectivity analysis
  let isolatedEndpoints = 0;
  let sharedEndpoints = 0;
  for (const count of endpointsMap.values()) {
    if (count === 1) isolatedEndpoints++;
    else sharedEndpoints++;
  }

  const report = {
    file: path.basename(kmlFilePath),
    fileSizeBytes: fs.statSync(kmlFilePath).size,
    parseDurationMs,
    placemarks: placemarksCount,
    lineStrings: totalLineStrings,
    coordinates: totalCoordinates,
    validGeometries,
    invalidGeometries,
    emptyGeometries,
    singlePointGeometries,
    boundingBox: {
      minLat: Math.round(minLat * 1e6) / 1e6,
      maxLat: Math.round(maxLat * 1e6) / 1e6,
      minLng: Math.round(minLng * 1e6) / 1e6,
      maxLng: Math.round(maxLng * 1e6) / 1e6,
    },
    coordinateOrdering: "longitude,latitude (Standard OGC / KML 2.2)",
    metadata: {
      roadIdCount,
      uniqueRoadIds: roadIdsSet.size,
      roadNameCount,
      uniqueRoadNames: roadNamesSet.size,
      unnamedRoadCount,
      objectIdCount,
      stLengthCount,
      directionalityTags,
      speedLimitTags,
      roadTypeTags,
      laneTags,
      elevationTags,
    },
    topology: {
      duplicateGeometryCount: duplicateCount,
      duplicateGeometryRatePct: ((duplicateCount / Math.max(1, validGeometries)) * 100).toFixed(2),
      uniqueEndpointsCount: endpointsMap.size,
      isolatedEndpoints,
      sharedEndpoints,
      sharedEndpointRatePct: ((sharedEndpoints / Math.max(1, endpointsMap.size)) * 100).toFixed(2),
    }
  };

  return report;
}

if (require.main === module) {
  const rootKml = path.resolve(__dirname, '../../1ef735dc-2397-4dc3-88e8-d98ea0b8339b.kml');
  const datasetsKml = path.resolve(__dirname, '../../Datasets/Spatial/chennai_road_centerline.kml');

  const target = fs.existsSync(rootKml) ? rootKml : datasetsKml;
  const report = auditKml(target);
  console.log('\n============================================================');
  console.log('KML FORENSIC AUDIT REPORT');
  console.log('============================================================');
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { auditKml };
