import 'dart:math' as math;
import '../../domain/entities/location_data.dart';

/// Builds street-like polyline paths between two points for realistic emergency routing.
class MapRouteGeometry {
  MapRouteGeometry._();

  /// Builds realistic multi-segment urban road waypoints from [from] to [to].
  static List<LocationData> buildSimulatedRoute({
    required LocationData from,
    required LocationData to,
    DateTime? timestamp,
  }) {
    final now = timestamp ?? DateTime.now();

    final deltaLat = to.latitude - from.latitude;
    final deltaLng = to.longitude - from.longitude;

    // Realistic urban Manhattan-like road segments with arterial bends
    final step1 = LocationData(
      latitude: from.latitude + deltaLat * 0.25,
      longitude: from.longitude + deltaLng * 0.05,
      timestamp: now,
    );
    final step2 = LocationData(
      latitude: from.latitude + deltaLat * 0.45,
      longitude: from.longitude + deltaLng * 0.35,
      timestamp: now,
    );
    final step3 = LocationData(
      latitude: from.latitude + deltaLat * 0.55,
      longitude: from.longitude + deltaLng * 0.70,
      timestamp: now,
    );
    final step4 = LocationData(
      latitude: from.latitude + deltaLat * 0.85,
      longitude: from.longitude + deltaLng * 0.90,
      timestamp: now,
    );

    return [
      from.copyWith(timestamp: now),
      step1,
      step2,
      step3,
      step4,
      to.copyWith(timestamp: now),
    ];
  }

  /// Interpolates a route of [waypoints] into [totalSteps] finely spaced steps
  /// for smooth, vehicular movement along road corridors without teleporting.
  static List<LocationData> interpolatePath(
    List<LocationData> waypoints, {
    int totalSteps = 24,
  }) {
    if (waypoints.isEmpty) return [];
    if (waypoints.length == 1) return [waypoints.first];
    if (totalSteps <= waypoints.length) return waypoints;

    final List<LocationData> result = [];
    final int segments = waypoints.length - 1;
    final int stepsPerSegment = (totalSteps / segments).ceil();

    for (int i = 0; i < segments; i++) {
      final start = waypoints[i];
      final end = waypoints[i + 1];

      for (int s = 0; s < stepsPerSegment; s++) {
        final t = s / stepsPerSegment;
        final lat = start.latitude + (end.latitude - start.latitude) * t;
        final lng = start.longitude + (end.longitude - start.longitude) * t;
        result.add(
          LocationData(
            latitude: lat,
            longitude: lng,
            timestamp: DateTime.now(),
          ),
        );
      }
    }

    result.add(waypoints.last);
    return result;
  }

  /// Computes compass heading angle in degrees (0 - 360) from [from] to [to].
  static double headingDegrees(LocationData from, LocationData to) {
    final dLng = to.longitude - from.longitude;
    final dLat = to.latitude - from.latitude;
    final degrees = math.atan2(dLng, dLat) * (180 / math.pi);
    return (degrees + 360) % 360;
  }
}
