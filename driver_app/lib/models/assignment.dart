import '../core/utils/geo_utils.dart';
import 'emergency_request.dart';
import 'hospital.dart';
import 'route_model.dart';
import 'state_enums.dart';

class Assignment {
  final String assignmentId;
  final String requestId;
  final String ambulanceId;
  final String driverId;
  final EmergencyRequest emergency;
  final DateTime assignedAt;
  final DateTime? respondedAt;
  final DateTime? expiresAt;
  final String? response; // ACCEPTED, REJECTED, TIMEOUT
  final DriverLifecycleState status;
  final double distanceKm;
  final int etaMinutes;
  final Hospital? destinationHospital;
  final int timeoutSeconds;
  final int attemptNumber;
  final RouteModel? route;
  final List<RouteModel>? alternativeRoutes;
  final RouteModel? hospitalRoute;
  final String? decisionReason;
  final Map<String, dynamic>? scoreBreakdown;
  final int? baselineEta;
  final double? baselineDistance;
  final double? etaImprovementPct;

  const Assignment({
    required this.assignmentId,
    required this.requestId,
    required this.ambulanceId,
    required this.driverId,
    required this.emergency,
    required this.assignedAt,
    this.respondedAt,
    this.expiresAt,
    this.response,
    this.status = DriverLifecycleState.assignmentReceived,
    required this.distanceKm,
    required this.etaMinutes,
    this.destinationHospital,
    this.timeoutSeconds = 15,
    this.attemptNumber = 1,
    this.route,
    this.alternativeRoutes,
    this.hospitalRoute,
    this.decisionReason,
    this.scoreBreakdown,
    this.baselineEta,
    this.baselineDistance,
    this.etaImprovementPct,
  });

  // Convenient checklist-aligned accessors
  String get emergencyType => emergency.emergencyType;
  int get victimCount => emergency.victimCount;
  int get estimatedETA => etaMinutes;
  GeoPoint get pickupLocation => emergency.pickupLocation;

  Assignment copyWith({
    String? assignmentId,
    String? requestId,
    String? ambulanceId,
    String? driverId,
    EmergencyRequest? emergency,
    DateTime? assignedAt,
    DateTime? respondedAt,
    DateTime? expiresAt,
    String? response,
    DriverLifecycleState? status,
    double? distanceKm,
    int? etaMinutes,
    Hospital? destinationHospital,
    int? timeoutSeconds,
    int? attemptNumber,
    RouteModel? route,
    List<RouteModel>? alternativeRoutes,
    RouteModel? hospitalRoute,
    String? decisionReason,
    Map<String, dynamic>? scoreBreakdown,
    int? baselineEta,
    double? baselineDistance,
    double? etaImprovementPct,
  }) {
    return Assignment(
      assignmentId: assignmentId ?? this.assignmentId,
      requestId: requestId ?? this.requestId,
      ambulanceId: ambulanceId ?? this.ambulanceId,
      driverId: driverId ?? this.driverId,
      emergency: emergency ?? this.emergency,
      assignedAt: assignedAt ?? this.assignedAt,
      respondedAt: respondedAt ?? this.respondedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      response: response ?? this.response,
      status: status ?? this.status,
      distanceKm: distanceKm ?? this.distanceKm,
      etaMinutes: etaMinutes ?? this.etaMinutes,
      destinationHospital: destinationHospital ?? this.destinationHospital,
      timeoutSeconds: timeoutSeconds ?? this.timeoutSeconds,
      attemptNumber: attemptNumber ?? this.attemptNumber,
      route: route ?? this.route,
      alternativeRoutes: alternativeRoutes ?? this.alternativeRoutes,
      hospitalRoute: hospitalRoute ?? this.hospitalRoute,
      decisionReason: decisionReason ?? this.decisionReason,
      scoreBreakdown: scoreBreakdown ?? this.scoreBreakdown,
      baselineEta: baselineEta ?? this.baselineEta,
      baselineDistance: baselineDistance ?? this.baselineDistance,
      etaImprovementPct: etaImprovementPct ?? this.etaImprovementPct,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'assignmentId': assignmentId,
      'requestId': requestId,
      'ambulanceId': ambulanceId,
      'driverId': driverId,
      'emergency': emergency.toJson(),
      'emergencyType': emergency.emergencyType,
      'victimCount': emergency.victimCount,
      'pickupLocation': {
        'latitude': emergency.pickupLocation.latitude,
        'longitude': emergency.pickupLocation.longitude,
      },
      'assignedAt': assignedAt.toIso8601String(),
      'respondedAt': respondedAt?.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'response': response,
      'status': status.displayName,
      'distanceKm': distanceKm,
      'etaMinutes': etaMinutes,
      'estimatedETA': etaMinutes,
      'destinationHospital': destinationHospital?.toJson(),
      'timeoutSeconds': timeoutSeconds,
      'attemptNumber': attemptNumber,
      'route': route?.toJson(),
      'alternativeRoutes': alternativeRoutes?.map((r) => r.toJson()).toList(),
      'hospitalRoute': hospitalRoute?.toJson(),
      'decisionReason': decisionReason,
      'scoreBreakdown': scoreBreakdown,
      'baselineEta': baselineEta,
      'baselineDistance': baselineDistance,
      'etaImprovementPct': etaImprovementPct,
    };
  }

  factory Assignment.fromJson(Map<String, dynamic> json) {
    final assignmentId = (json['assignmentId'] as String?) ?? (json['id'] as String?);
    final reqMap = (json['request'] is Map<String, dynamic>) ? json['request'] as Map<String, dynamic> : null;
    final requestId = (json['requestId'] as String?) ?? (reqMap?['requestId'] as String?);

    // Reject objects that do not contain an assignment ID or request ID
    if (assignmentId == null && requestId == null) {
      throw const FormatException('Payload is not an Assignment: missing assignmentId and requestId');
    }

    // Parse emergency details: check 'emergency' key, then 'request' key, then flat fields.
    EmergencyRequest emergency;
    if (json['emergency'] != null && json['emergency'] is Map<String, dynamic>) {
      emergency = EmergencyRequest.fromJson(
        json['emergency'] as Map<String, dynamic>,
      );
    } else if (reqMap != null) {
      final pickupLoc = reqMap['pickupLocation'] as Map<String, dynamic>? ?? {};
      emergency = EmergencyRequest(
        requestId: requestId ?? (assignmentId ?? ''),
        emergencyType: (reqMap['emergencyType'] as String?) ?? 'Medical Emergency',
        victimCount: (reqMap['victimCount'] as num?)?.toInt() ?? 1,
        pickupLocationName: (reqMap['pickupLocationName'] as String?) ?? 'Patient Pickup Location',
        pickupLocation: GeoPoint(
          (pickupLoc['latitude'] as num?)?.toDouble() ?? 13.0850,
          (pickupLoc['longitude'] as num?)?.toDouble() ?? 80.2750,
        ),
        reportedTime: DateTime.now(),
      );
    } else {
      // Flat fields fallback
      final pickupLoc = json['pickupLocation'] as Map<String, dynamic>? ?? {};
      emergency = EmergencyRequest(
        requestId: requestId ?? (assignmentId ?? ''),
        emergencyType: (json['emergencyType'] as String?) ?? 'Medical Emergency',
        victimCount: (json['victimCount'] as num?)?.toInt() ?? 1,
        pickupLocationName: (json['pickupLocationName'] as String?) ?? 'Patient Pickup Location',
        pickupLocation: GeoPoint(
          (pickupLoc['latitude'] as num?)?.toDouble() ?? 13.0850,
          (pickupLoc['longitude'] as num?)?.toDouble() ?? 80.2750,
        ),
        reportedTime: DateTime.now(),
      );
    }

    final eta = (json['estimatedETA'] as num?)?.toInt() ??
        (json['etaMinutes'] as num?)?.toInt() ??
        (json['eta'] as num?)?.toInt() ??
        8;

    final hospitalMap = (json['destinationHospital'] is Map<String, dynamic>)
        ? json['destinationHospital'] as Map<String, dynamic>
        : (reqMap != null && reqMap['destinationHospital'] is Map<String, dynamic>)
            ? reqMap['destinationHospital'] as Map<String, dynamic>
            : null;

    return Assignment(
      assignmentId: assignmentId ?? 'ASN-$requestId',
      requestId: requestId ?? emergency.requestId,
      ambulanceId: (json['ambulanceId'] as String?) ?? '',
      driverId: (json['driverId'] as String?) ?? '',
      emergency: emergency,
      assignedAt: json['assignedAt'] != null
          ? DateTime.parse(json['assignedAt'] as String)
          : DateTime.now(),
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'] as String)
          : null,
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String)
          : null,
      response: json['response'] as String?,
      status: json['status'] != null
          ? DriverLifecycleState.fromString(json['status'] as String)
          : DriverLifecycleState.assignmentReceived,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 4.2,
      etaMinutes: eta,
      destinationHospital: hospitalMap != null
          ? Hospital.fromJson(hospitalMap)
          : null,
      timeoutSeconds: (json['timeoutSeconds'] as num?)?.toInt() ?? 15,
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
      route: json['route'] is Map<String, dynamic>
          ? RouteModel.fromJson(json['route'] as Map<String, dynamic>)
          : null,
      alternativeRoutes: json['alternativeRoutes'] is List
          ? (json['alternativeRoutes'] as List<dynamic>)
              .map((r) => RouteModel.fromJson(r as Map<String, dynamic>))
              .toList()
          : null,
      hospitalRoute: json['hospitalRoute'] is Map<String, dynamic>
          ? RouteModel.fromJson(json['hospitalRoute'] as Map<String, dynamic>)
          : null,
      decisionReason: (json['decisionReason'] as String?) ??
          (reqMap?['routeReason'] as String?),
      scoreBreakdown: json['scoreBreakdown'] as Map<String, dynamic>?,
      baselineEta: (json['baselineEta'] as num?)?.toInt() ??
          (reqMap?['baselineEta'] as num?)?.toInt(),
      baselineDistance: (json['baselineDistance'] as num?)?.toDouble() ??
          (reqMap?['baselineDistance'] as num?)?.toDouble(),
      etaImprovementPct: (json['etaImprovementPct'] as num?)?.toDouble() ??
          (reqMap?['etaImprovementPct'] as num?)?.toDouble(),
    );
  }
}
