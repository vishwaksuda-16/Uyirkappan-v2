import 'dart:math' as math;

import '../core/utils/geo_utils.dart';

class RouteWaypoint {
  final String nodeId;
  final String nodeName;
  final GeoPoint location;
  final String? roadName;

  const RouteWaypoint({
    required this.nodeId,
    required this.nodeName,
    required this.location,
    this.roadName,
  });

  Map<String, dynamic> toJson() {
    return {
      'nodeId': nodeId,
      'nodeName': nodeName,
      'latitude': location.latitude,
      'longitude': location.longitude,
      'roadName': roadName,
    };
  }

  factory RouteWaypoint.fromJson(Map<String, dynamic> json) {
    return RouteWaypoint(
      nodeId: (json['nodeId'] as String?) ?? (json['id'] as String?) ?? 'WP',
      nodeName: (json['nodeName'] as String?) ?? (json['name'] as String?) ?? 'Waypoint',
      location: GeoPoint(
        (json['latitude'] as num?)?.toDouble() ?? 0.0,
        (json['longitude'] as num?)?.toDouble() ?? 0.0,
      ),
      roadName: json['roadName'] as String?,
    );
  }
}

class RouteModel {
  final String routeId;
  final List<RouteWaypoint> waypoints;
  final double totalDistanceKm;
  final int estimatedMinutes;
  final int currentWaypointIndex;
  final bool isRerouted;
  final String? alertMessage;

  const RouteModel({
    required this.routeId,
    required this.waypoints,
    required this.totalDistanceKm,
    required this.estimatedMinutes,
    this.currentWaypointIndex = 0,
    this.isRerouted = false,
    this.alertMessage,
  });

  RouteWaypoint? get currentWaypoint =>
      waypoints.isNotEmpty && currentWaypointIndex < waypoints.length
          ? waypoints[currentWaypointIndex]
          : null;

  RouteWaypoint? get nextWaypoint =>
      currentWaypointIndex + 1 < waypoints.length
          ? waypoints[currentWaypointIndex + 1]
          : null;

  double? get estimatedAverageSpeedKmh =>
      totalDistanceKm > 0 && estimatedMinutes > 0
          ? totalDistanceKm * 60 / estimatedMinutes
          : null;

  double routeDistanceForSegmentKm(int segmentIndex) {
    if (segmentIndex < 0 || segmentIndex >= waypoints.length - 1) return 0.0;

    final segmentDistance = GeoUtils.distanceKm(
      waypoints[segmentIndex].location,
      waypoints[segmentIndex + 1].location,
    );
    if (totalDistanceKm <= 0) return segmentDistance;

    var geometricDistance = 0.0;
    for (var index = 0; index < waypoints.length - 1; index++) {
      geometricDistance += GeoUtils.distanceKm(
        waypoints[index].location,
        waypoints[index + 1].location,
      );
    }
    return geometricDistance > 0
        ? totalDistanceKm * segmentDistance / geometricDistance
        : segmentDistance;
  }

  double distanceRemainingFrom(GeoPoint location) {
    if (waypoints.length < 2) return 0.0;

    var closestSegment = 0;
    var closestProgress = 0.0;
    var closestDistanceSquared = double.infinity;
    final longitudeScale =
        math.cos(location.latitude * math.pi / 180).abs().clamp(0.01, 1.0);

    for (var index = 0; index < waypoints.length - 1; index++) {
      final start = waypoints[index].location;
      final end = waypoints[index + 1].location;
      final dx = (end.longitude - start.longitude) * longitudeScale;
      final dy = end.latitude - start.latitude;
      final lengthSquared = dx * dx + dy * dy;
      final progress = lengthSquared == 0
          ? 0.0
          : ((((location.longitude - start.longitude) * longitudeScale * dx) +
                      ((location.latitude - start.latitude) * dy)) /
                  lengthSquared)
              .clamp(0.0, 1.0);
      final projectedLongitude = start.longitude + (end.longitude - start.longitude) * progress;
      final projectedLatitude = start.latitude + (end.latitude - start.latitude) * progress;
      final offsetX = (location.longitude - projectedLongitude) * longitudeScale;
      final offsetY = location.latitude - projectedLatitude;
      final distanceSquared = offsetX * offsetX + offsetY * offsetY;

      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closestSegment = index;
        closestProgress = progress;
      }
    }

    var remainingDistance = routeDistanceForSegmentKm(closestSegment) * (1 - closestProgress);
    for (var index = closestSegment + 1; index < waypoints.length - 1; index++) {
      remainingDistance += routeDistanceForSegmentKm(index);
    }
    return remainingDistance;
  }

  RouteModel copyWith({
    String? routeId,
    List<RouteWaypoint>? waypoints,
    double? totalDistanceKm,
    int? estimatedMinutes,
    int? currentWaypointIndex,
    bool? isRerouted,
    String? alertMessage,
  }) {
    return RouteModel(
      routeId: routeId ?? this.routeId,
      waypoints: waypoints ?? this.waypoints,
      totalDistanceKm: totalDistanceKm ?? this.totalDistanceKm,
      estimatedMinutes: estimatedMinutes ?? this.estimatedMinutes,
      currentWaypointIndex: currentWaypointIndex ?? this.currentWaypointIndex,
      isRerouted: isRerouted ?? this.isRerouted,
      alertMessage: alertMessage ?? this.alertMessage,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'routeId': routeId,
      'waypoints': waypoints.map((w) => w.toJson()).toList(),
      'totalDistanceKm': totalDistanceKm,
      'estimatedMinutes': estimatedMinutes,
      'currentWaypointIndex': currentWaypointIndex,
      'isRerouted': isRerouted,
      'alertMessage': alertMessage,
    };
  }

  factory RouteModel.fromJson(Map<String, dynamic> json) {
    List<RouteWaypoint> waypointsList = [];
    if (json['waypoints'] is List) {
      waypointsList = (json['waypoints'] as List<dynamic>)
          .map((w) => RouteWaypoint.fromJson(w as Map<String, dynamic>))
          .toList();
    }
    return RouteModel(
      routeId: (json['routeId'] as String?) ?? 'ROUTE-01',
      waypoints: waypointsList,
      totalDistanceKm: (json['totalDistanceKm'] as num?)?.toDouble() ??
          (json['distanceKm'] as num?)?.toDouble() ??
          0.0,
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt() ??
          (json['travelTimeMinutes'] as num?)?.toInt() ??
          (json['etaMinutes'] as num?)?.toInt() ??
          0,
      currentWaypointIndex: (json['currentWaypointIndex'] as num?)?.toInt() ?? 0,
      isRerouted: json['isRerouted'] as bool? ?? false,
      alertMessage: json['alertMessage'] as String?,
    );
  }
}
