import 'dart:math' as math;

class GeoPoint {
  final double latitude;
  final double longitude;

  const GeoPoint(this.latitude, this.longitude);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GeoPoint &&
          runtimeType == other.runtimeType &&
          latitude == other.latitude &&
          longitude == other.longitude;

  @override
  int get hashCode => latitude.hashCode ^ longitude.hashCode;

  @override
  String toString() => 'GeoPoint($latitude, $longitude)';
}

class GeoUtils {
  GeoUtils._();

  static const double earthRadiusKm = 6371.0;

  /// Haversine distance in kilometers between two coordinates
  static double distanceKm(GeoPoint p1, GeoPoint p2) {
    final dLat = _degToRad(p2.latitude - p1.latitude);
    final dLon = _degToRad(p2.longitude - p1.longitude);

    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(p1.latitude)) *
            math.cos(_degToRad(p2.latitude)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);

    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  /// Initial bearing (forward azimuth) in degrees [0, 360)
  static double calculateBearing(GeoPoint from, GeoPoint to) {
    final lat1 = _degToRad(from.latitude);
    final lat2 = _degToRad(to.latitude);
    final dLon = _degToRad(to.longitude - from.longitude);

    final y = math.sin(dLon) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLon);

    final rad = math.atan2(y, x);
    final deg = _radToDeg(rad);
    return (deg + 360) % 360;
  }

  /// Interpolate a point between [from] and [to] at fraction [t] (0.0 to 1.0)
  static GeoPoint interpolate(GeoPoint from, GeoPoint to, double t) {
    final clamped = t.clamp(0.0, 1.0);
    return GeoPoint(
      from.latitude + (to.latitude - from.latitude) * clamped,
      from.longitude + (to.longitude - from.longitude) * clamped,
    );
  }

  /// Convert degrees to compass direction (e.g., N, NE, E, SE, etc.)
  static String bearingToDirection(double bearing) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    final index = ((bearing + 22.5) % 360 / 45).floor();
    return directions[index % 8];
  }

  static double _degToRad(double deg) => deg * (math.pi / 180.0);
  static double _radToDeg(double rad) => rad * (180.0 / math.pi);
}
