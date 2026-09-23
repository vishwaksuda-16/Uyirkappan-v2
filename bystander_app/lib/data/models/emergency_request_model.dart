import '../../domain/entities/emergency_request.dart';
import '../../domain/entities/emergency_type.dart';
import '../../domain/entities/location_data.dart';
import '../../domain/entities/request_status.dart';
import 'location_model.dart';

/// Data model for EmergencyRequest with JSON serialization adhering to the REST API contract.
class EmergencyRequestModel extends EmergencyRequest {
  const EmergencyRequestModel({
    required super.requestId,
    required super.requesterId,
    required super.emergencyType,
    required super.victimCount,
    required super.emergencyLocation,
    super.requesterLocation,
    required super.createdAt,
    super.completedAt,
    required super.status,
    super.assignedAmbulanceId,
    super.assignedDriverName,
    super.driverPhone,
    super.hospitalDestination,
    super.additionalNotes,
    super.fallbackCount,
    super.currentETA,
    super.backendRoute,
    super.backendAlternativeRoutes,
    super.routeId,
    super.routeReason,
    super.trafficLevel,
    super.roadStatus,
    super.blockedSegments,
    super.routeConditionSummary,
    super.t0UserPressed,
    super.t1RequestReceived,
    super.t2MatchingCompleted,
    super.t3AssignmentSent,
    super.t4DriverAccepted,
    super.t5AmbulanceStarted,
    super.t6AmbulanceArrived,
  });

  factory EmergencyRequestModel.fromJson(Map<String, dynamic> json) {
    // Accommodate pickupLocation (Backend standard), emergencyLocation, or flat lat/lng
    final LocationData emergencyLoc;
    final locObj = json['pickupLocation'] ?? json['emergencyLocation'];
    if (locObj is Map<String, dynamic>) {
      emergencyLoc = LocationData(
        latitude: (locObj['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (locObj['longitude'] as num?)?.toDouble() ?? 0.0,
        accuracy: (locObj['accuracy'] as num?)?.toDouble() ?? (locObj['locationAccuracy'] as num?)?.toDouble(),
        timestamp: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'] as String)
            : DateTime.now(),
        isManualOverride: locObj['isManualOverride'] as bool? ?? false,
      );
    } else {
      emergencyLoc = LocationData(
        latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
        accuracy: (json['locationAccuracy'] as num?)?.toDouble(),
        timestamp: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'] as String)
            : DateTime.now(),
        isManualOverride: json['isManualOverride'] as bool? ?? false,
      );
    }

    LocationData? requesterLoc;
    if (json['requesterLocation'] != null && json['requesterLocation'] is Map<String, dynamic>) {
      requesterLoc = LocationModel.fromJson(json['requesterLocation'] as Map<String, dynamic>);
    }

    final ambId = json['ambulanceId'] as String? ?? json['assignedAmbulanceId'] as String?;
    final hospDest = json['destinationHospitalId'] as String? ?? json['hospitalDestination'] as String?;
    final attemptsRaw = json['attempts'];
    final fallbackAttempts = attemptsRaw is List
        ? attemptsRaw.length
        : ((attemptsRaw as num?)?.toInt() ?? json['fallbackCount'] as int? ?? 0);
    final etaVal = (json['currentETA'] as num?)?.toInt() ?? (json['eta'] as num?)?.toInt();

    List<LocationData>? backendRoute;
    final routeObj = json['route'];
    if (routeObj is Map<String, dynamic> && routeObj['waypoints'] is List) {
      final wps = routeObj['waypoints'] as List<dynamic>;
      backendRoute = wps.map((wp) {
        if (wp is Map<String, dynamic>) {
          return LocationData(
            latitude: (wp['latitude'] as num?)?.toDouble() ?? 0.0,
            longitude: (wp['longitude'] as num?)?.toDouble() ?? 0.0,
            timestamp: DateTime.now(),
          );
        }
        return LocationData(latitude: 0.0, longitude: 0.0, timestamp: DateTime.now());
      }).where((l) => l.latitude != 0.0 && l.longitude != 0.0).toList();
    }

    List<List<LocationData>>? backendAlternativeRoutes;
    final altObj = json['alternativeRoutes'];
    if (altObj is List) {
      backendAlternativeRoutes = altObj.map((alt) {
        if (alt is Map<String, dynamic> && alt['waypoints'] is List) {
          final wps = alt['waypoints'] as List<dynamic>;
          return wps.map((wp) {
            if (wp is Map<String, dynamic>) {
              return LocationData(
                latitude: (wp['latitude'] as num?)?.toDouble() ?? 0.0,
                longitude: (wp['longitude'] as num?)?.toDouble() ?? 0.0,
                timestamp: DateTime.now(),
              );
            }
            return LocationData(latitude: 0.0, longitude: 0.0, timestamp: DateTime.now());
          }).where((l) => l.latitude != 0.0 && l.longitude != 0.0).toList();
        }
        return <LocationData>[];
      }).where((list) => list.isNotEmpty).toList();
    }

    final routeId = (json['routeId'] as String?) ?? (routeObj is Map ? routeObj['routeId'] as String? : null);
    final routeReason = (json['decisionReason'] as String?) ?? (json['selectionReason'] as String?) ?? (routeObj is Map ? routeObj['decisionReason'] as String? : null);
    final trafficLevel = (json['trafficLevel'] as String?) ?? (routeObj is Map ? routeObj['trafficLevel'] as String? : null);
    final roadStatus = (json['roadStatus'] as String?) ?? (routeObj is Map ? routeObj['roadStatus'] as String? : null);
    final routeConditionSummary =
        (json['routeConditionSummary'] as String?) ?? (routeObj is Map ? routeObj['routeConditionSummary'] as String? : null);
    final blockedSegments = ((json['blockedSegments'] as List?) ?? (routeObj is Map ? routeObj['blockedSegments'] as List? : null))
        ?.whereType<String>()
        .toList();

    return EmergencyRequestModel(
      requestId: json['requestId'] as String? ?? json['id'] as String? ?? 'UK-${DateTime.now().millisecondsSinceEpoch}',
      requesterId: json['requesterId'] as String? ?? 'anonymous',
      emergencyType: EmergencyType.fromCode(json['emergencyType'] as String? ?? 'OTHER'),
      victimCount: json['victimCount'] as int? ?? 1,
      emergencyLocation: emergencyLoc,
      requesterLocation: requesterLoc,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      status: RequestStatus.fromCode(json['status'] as String? ?? 'CREATED'),
      assignedAmbulanceId: ambId,
      assignedDriverName: json['assignedDriverName'] as String?,
      driverPhone: json['driverPhone'] as String?,
      hospitalDestination: hospDest,
      additionalNotes: json['additionalNotes'] as String?,
      fallbackCount: fallbackAttempts,
      currentETA: etaVal,
      backendRoute: backendRoute,
      backendAlternativeRoutes: backendAlternativeRoutes,
      routeId: routeId,
      routeReason: routeReason,
      trafficLevel: trafficLevel,
      roadStatus: roadStatus,
      blockedSegments: blockedSegments,
      routeConditionSummary: routeConditionSummary,
      t0UserPressed: json['t0UserPressed'] != null ? DateTime.parse(json['t0UserPressed'] as String) : null,
      t1RequestReceived: json['t1RequestReceived'] != null ? DateTime.parse(json['t1RequestReceived'] as String) : null,
      t2MatchingCompleted: json['t2MatchingCompleted'] != null ? DateTime.parse(json['t2MatchingCompleted'] as String) : null,
      t3AssignmentSent: json['t3AssignmentSent'] != null ? DateTime.parse(json['t3AssignmentSent'] as String) : null,
      t4DriverAccepted: json['t4DriverAccepted'] != null ? DateTime.parse(json['t4DriverAccepted'] as String) : null,
      t5AmbulanceStarted: json['t5AmbulanceStarted'] != null ? DateTime.parse(json['t5AmbulanceStarted'] as String) : null,
      t6AmbulanceArrived: json['t6AmbulanceArrived'] != null ? DateTime.parse(json['t6AmbulanceArrived'] as String) : null,
    );
  }

  factory EmergencyRequestModel.fromEntity(EmergencyRequest entity) {
    return EmergencyRequestModel(
      requestId: entity.requestId,
      requesterId: entity.requesterId,
      emergencyType: entity.emergencyType,
      victimCount: entity.victimCount,
      emergencyLocation: entity.emergencyLocation,
      requesterLocation: entity.requesterLocation,
      createdAt: entity.createdAt,
      completedAt: entity.completedAt,
      status: entity.status,
      assignedAmbulanceId: entity.assignedAmbulanceId,
      assignedDriverName: entity.assignedDriverName,
      driverPhone: entity.driverPhone,
      hospitalDestination: entity.hospitalDestination,
      additionalNotes: entity.additionalNotes,
      fallbackCount: entity.fallbackCount,
      currentETA: entity.currentETA,
      backendRoute: entity.backendRoute,
      backendAlternativeRoutes: entity.backendAlternativeRoutes,
      routeId: entity.routeId,
      routeReason: entity.routeReason,
      trafficLevel: entity.trafficLevel,
      roadStatus: entity.roadStatus,
      blockedSegments: entity.blockedSegments,
      routeConditionSummary: entity.routeConditionSummary,
      t0UserPressed: entity.t0UserPressed,
      t1RequestReceived: entity.t1RequestReceived,
      t2MatchingCompleted: entity.t2MatchingCompleted,
      t3AssignmentSent: entity.t3AssignmentSent,
      t4DriverAccepted: entity.t4DriverAccepted,
      t5AmbulanceStarted: entity.t5AmbulanceStarted,
      t6AmbulanceArrived: entity.t6AmbulanceArrived,
    );
  }

  @override
  EmergencyRequestModel copyWith({
    String? requestId,
    String? requesterId,
    EmergencyType? emergencyType,
    int? victimCount,
    LocationData? emergencyLocation,
    LocationData? requesterLocation,
    DateTime? createdAt,
    DateTime? completedAt,
    RequestStatus? status,
    String? assignedAmbulanceId,
    String? assignedDriverName,
    String? driverPhone,
    String? hospitalDestination,
    String? additionalNotes,
    int? fallbackCount,
    int? currentETA,
    List<LocationData>? backendRoute,
    List<List<LocationData>>? backendAlternativeRoutes,
    String? routeId,
    String? routeReason,
    String? trafficLevel,
    String? roadStatus,
    List<String>? blockedSegments,
    String? routeConditionSummary,
    DateTime? t0UserPressed,
    DateTime? t1RequestReceived,
    DateTime? t2MatchingCompleted,
    DateTime? t3AssignmentSent,
    DateTime? t4DriverAccepted,
    DateTime? t5AmbulanceStarted,
    DateTime? t6AmbulanceArrived,
  }) {
    return EmergencyRequestModel(
      requestId: requestId ?? this.requestId,
      requesterId: requesterId ?? this.requesterId,
      emergencyType: emergencyType ?? this.emergencyType,
      victimCount: victimCount ?? this.victimCount,
      emergencyLocation: emergencyLocation ?? this.emergencyLocation,
      requesterLocation: requesterLocation ?? this.requesterLocation,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
      status: status ?? this.status,
      assignedAmbulanceId: assignedAmbulanceId ?? this.assignedAmbulanceId,
      assignedDriverName: assignedDriverName ?? this.assignedDriverName,
      driverPhone: driverPhone ?? this.driverPhone,
      hospitalDestination: hospitalDestination ?? this.hospitalDestination,
      additionalNotes: additionalNotes ?? this.additionalNotes,
      fallbackCount: fallbackCount ?? this.fallbackCount,
      currentETA: currentETA ?? this.currentETA,
      backendRoute: backendRoute ?? this.backendRoute,
      backendAlternativeRoutes: backendAlternativeRoutes ?? this.backendAlternativeRoutes,
      routeId: routeId ?? this.routeId,
      routeReason: routeReason ?? this.routeReason,
      trafficLevel: trafficLevel ?? this.trafficLevel,
      roadStatus: roadStatus ?? this.roadStatus,
      blockedSegments: blockedSegments ?? this.blockedSegments,
      routeConditionSummary: routeConditionSummary ?? this.routeConditionSummary,
      t0UserPressed: t0UserPressed ?? this.t0UserPressed,
      t1RequestReceived: t1RequestReceived ?? this.t1RequestReceived,
      t2MatchingCompleted: t2MatchingCompleted ?? this.t2MatchingCompleted,
      t3AssignmentSent: t3AssignmentSent ?? this.t3AssignmentSent,
      t4DriverAccepted: t4DriverAccepted ?? this.t4DriverAccepted,
      t5AmbulanceStarted: t5AmbulanceStarted ?? this.t5AmbulanceStarted,
      t6AmbulanceArrived: t6AmbulanceArrived ?? this.t6AmbulanceArrived,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'requestId': requestId,
      'requesterId': requesterId,
      'emergencyType': emergencyType.code,
      'victimCount': victimCount,
      'latitude': emergencyLocation.latitude,
      'longitude': emergencyLocation.longitude,
      'locationAccuracy': emergencyLocation.accuracy,
      'isManualOverride': emergencyLocation.isManualOverride,
      'createdAt': createdAt.toIso8601String(),
      if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
      'status': status.code,
      if (assignedAmbulanceId != null) 'assignedAmbulanceId': assignedAmbulanceId,
      if (assignedAmbulanceId != null) 'ambulanceId': assignedAmbulanceId,
      if (assignedDriverName != null) 'assignedDriverName': assignedDriverName,
      if (driverPhone != null) 'driverPhone': driverPhone,
      if (hospitalDestination != null) 'hospitalDestination': hospitalDestination,
      if (hospitalDestination != null) 'destinationHospitalId': hospitalDestination,
      if (additionalNotes != null) 'additionalNotes': additionalNotes,
      'fallbackCount': fallbackCount,
      'attempts': fallbackCount,
      if (currentETA != null) 'currentETA': currentETA,
      if (trafficLevel != null) 'trafficLevel': trafficLevel,
      if (roadStatus != null) 'roadStatus': roadStatus,
      if (blockedSegments != null && blockedSegments!.isNotEmpty) 'blockedSegments': blockedSegments,
      if (routeConditionSummary != null) 'routeConditionSummary': routeConditionSummary,
      if (t0UserPressed != null) 't0UserPressed': t0UserPressed!.toIso8601String(),
      if (t1RequestReceived != null) 't1RequestReceived': t1RequestReceived!.toIso8601String(),
      if (t2MatchingCompleted != null) 't2MatchingCompleted': t2MatchingCompleted!.toIso8601String(),
      if (t3AssignmentSent != null) 't3AssignmentSent': t3AssignmentSent!.toIso8601String(),
      if (t4DriverAccepted != null) 't4DriverAccepted': t4DriverAccepted!.toIso8601String(),
      if (t5AmbulanceStarted != null) 't5AmbulanceStarted': t5AmbulanceStarted!.toIso8601String(),
      if (t6AmbulanceArrived != null) 't6AmbulanceArrived': t6AmbulanceArrived!.toIso8601String(),
    };
  }

  /// Format specifically for POST /api/emergency endpoint.
  /// Payload: { "emergencyType": "...", "victimCount": ..., "pickupLocation": { "latitude": ..., "longitude": ... } }
  Map<String, dynamic> toSubmissionJson() {
    return {
      'emergencyType': emergencyType.code,
      'victimCount': victimCount,
      'pickupLocation': {
        'latitude': emergencyLocation.latitude,
        'longitude': emergencyLocation.longitude,
        if (emergencyLocation.accuracy != null) 'accuracy': emergencyLocation.accuracy,
      },
      // Flat coordinates included for compatibility
      'latitude': emergencyLocation.latitude,
      'longitude': emergencyLocation.longitude,
      'locationAccuracy': emergencyLocation.accuracy,
      'isManualOverride': emergencyLocation.isManualOverride,
      if (requesterId.isNotEmpty) 'requesterId': requesterId,
      if (additionalNotes != null && additionalNotes!.isNotEmpty)
        'additionalNotes': additionalNotes,
      if (t0UserPressed != null) 't0UserPressed': t0UserPressed!.toIso8601String(),
    };
  }
}
