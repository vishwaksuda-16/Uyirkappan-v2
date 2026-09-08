import '../core/utils/geo_utils.dart';
import 'emergency_request.dart';
import 'hospital.dart';
import 'state_enums.dart';

class Assignment {
  final String assignmentId;
  final String requestId;
  final String ambulanceId;
  final String driverId;
  final EmergencyRequest emergency;
  final DateTime assignedAt;
  final DateTime? respondedAt;
  final String? response; // ACCEPTED, REJECTED, TIMEOUT
  final DriverLifecycleState status;
  final double distanceKm;
  final int etaMinutes;
  final Hospital? destinationHospital;
  final int timeoutSeconds;
  final int attemptNumber;

  const Assignment({
    required this.assignmentId,
    required this.requestId,
    required this.ambulanceId,
    required this.driverId,
    required this.emergency,
    required this.assignedAt,
    this.respondedAt,
    this.response,
    this.status = DriverLifecycleState.assignmentReceived,
    required this.distanceKm,
    required this.etaMinutes,
    this.destinationHospital,
    this.timeoutSeconds = 15,
    this.attemptNumber = 1,
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
    String? response,
    DriverLifecycleState? status,
    double? distanceKm,
    int? etaMinutes,
    Hospital? destinationHospital,
    int? timeoutSeconds,
    int? attemptNumber,
  }) {
    return Assignment(
      assignmentId: assignmentId ?? this.assignmentId,
      requestId: requestId ?? this.requestId,
      ambulanceId: ambulanceId ?? this.ambulanceId,
      driverId: driverId ?? this.driverId,
      emergency: emergency ?? this.emergency,
      assignedAt: assignedAt ?? this.assignedAt,
      respondedAt: respondedAt ?? this.respondedAt,
      response: response ?? this.response,
      status: status ?? this.status,
      distanceKm: distanceKm ?? this.distanceKm,
      etaMinutes: etaMinutes ?? this.etaMinutes,
      destinationHospital: destinationHospital ?? this.destinationHospital,
      timeoutSeconds: timeoutSeconds ?? this.timeoutSeconds,
      attemptNumber: attemptNumber ?? this.attemptNumber,
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
      'response': response,
      'status': status.displayName,
      'distanceKm': distanceKm,
      'etaMinutes': etaMinutes,
      'estimatedETA': etaMinutes,
      'destinationHospital': destinationHospital?.toJson(),
      'timeoutSeconds': timeoutSeconds,
      'attemptNumber': attemptNumber,
    };
  }

  factory Assignment.fromJson(Map<String, dynamic> json) {
    // Parse emergency details: check 'emergency' key, then 'request' key (backend
    // GET /api/driver/assignment nests emergency details under 'request'), then flat fields.
    EmergencyRequest emergency;
    if (json['emergency'] != null && json['emergency'] is Map<String, dynamic>) {
      emergency = EmergencyRequest.fromJson(
        json['emergency'] as Map<String, dynamic>,
      );
    } else if (json['request'] != null && json['request'] is Map<String, dynamic>) {
      // Backend GET /api/driver/assignment response shape:
      // { id, requestId, ambulanceId, ..., request: { emergencyType, victimCount,
      //   pickupLocation: { latitude, longitude }, destinationHospitalId } }
      final req = json['request'] as Map<String, dynamic>;
      final pickupLoc = req['pickupLocation'] as Map<String, dynamic>? ?? {};
      emergency = EmergencyRequest(
        requestId: (json['requestId'] as String?) ?? 'REQ-${DateTime.now().millisecondsSinceEpoch}',
        emergencyType: (req['emergencyType'] as String?) ?? 'Cardiac / Medical Emergency',
        victimCount: (req['victimCount'] as num?)?.toInt() ?? 1,
        pickupLocationName: (req['pickupLocationName'] as String?) ?? 'Patient Pickup Location',
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
        requestId: (json['requestId'] as String?) ?? 'REQ-${DateTime.now().millisecondsSinceEpoch}',
        emergencyType: (json['emergencyType'] as String?) ?? 'Cardiac / Medical Emergency',
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

    return Assignment(
      // Backend GET /api/driver/assignment returns 'id', not 'assignmentId'
      assignmentId: (json['assignmentId'] as String?) ??
          (json['id'] as String?) ??
          'ASN-${DateTime.now().millisecondsSinceEpoch}',
      requestId: (json['requestId'] as String?) ?? emergency.requestId,
      ambulanceId: (json['ambulanceId'] as String?) ?? '',
      driverId: (json['driverId'] as String?) ?? '',
      emergency: emergency,
      assignedAt: json['assignedAt'] != null
          ? DateTime.parse(json['assignedAt'] as String)
          : DateTime.now(),
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'] as String)
          : null,
      response: json['response'] as String?,
      status: json['status'] != null
          ? DriverLifecycleState.fromString(json['status'] as String)
          : DriverLifecycleState.assignmentReceived,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 4.2,
      etaMinutes: eta,
      destinationHospital: json['destinationHospital'] != null
          ? Hospital.fromJson(
              json['destinationHospital'] as Map<String, dynamic>)
          : null,
      timeoutSeconds: (json['timeoutSeconds'] as num?)?.toInt() ?? 15,
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
    );
  }
}
