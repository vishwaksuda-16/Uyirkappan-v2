const fs = require('fs');
const path = require('path');

let cachedRoads = null;

function kmlPath() {
  return process.env.CHENNAI_ROAD_KML_PATH || path.resolve(__dirname, '../../../Datasets/Spatial/chennai_road_centerline.kml');
}

function parseCoordinates(value) {
  return value.trim().split(/\s+/).map((coordinate) => {
    const [longitude, latitude] = coordinate.split(',').map(Number);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [longitude, latitude] : null;
  }).filter(Boolean);
}

function loadRoadGeometry() {
  if (cachedRoads) return cachedRoads;
  const source = kmlPath();
  if (!fs.existsSync(source)) throw new Error(`Chennai road-centerline KML not found: ${source}`);
  const xml = fs.readFileSync(source, 'utf8');
  const placemarks = xml.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || [];
  cachedRoads = placemarks.flatMap((placemark) => {
    const roadId = placemark.match(/<SimpleData name="road_id">\s*([^<]+?)\s*<\/SimpleData>/)?.[1]?.trim() || null;
    const roadName = placemark.match(/<SimpleData name="road_name">\s*([^<]+?)\s*<\/SimpleData>/)?.[1]?.trim() || 'Unnamed road';
    const lines = [...placemark.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)]
      .map((match) => parseCoordinates(match[1]))
      .filter((coordinates) => coordinates.length > 1);
    return lines.map((coordinates) => ({ roadId, roadName, coordinates }));
  });
  return cachedRoads;
}

function inBounds(coordinates, bounds) {
  if (!bounds) return true;
  return coordinates.some(([longitude, latitude]) =>
    latitude >= bounds.minLat && latitude <= bounds.maxLat &&
    longitude >= bounds.minLng && longitude <= bounds.maxLng
  );
}

function roadsForBounds(bounds, limit = 4000) {
  return loadRoadGeometry().filter((road) => inBounds(road.coordinates, bounds)).slice(0, limit);
}

module.exports = { roadsForBounds, loadRoadGeometry };
