import '../core/utils/geo_utils.dart';
import 'state_enums.dart';

class Ambulance {
  final String ambulanceId;
  final String providerId;
  final String driverId;
  final DriverLifecycleState status;
  final AmbulanceAvailability availability;
  final GeoPoint currentLocation;
  final String currentNodeName;
  final double speed;
  final double heading;
  final String? currentRequestId;
  final String vehiclePlateNumber;
  final String vehicleType;

  const Ambulance({
    required this.ambulanceId,
    required this.providerId,
    required this.driverId,
    this.status = DriverLifecycleState.offline,
    this.availability = AmbulanceAvailability.offline,
    this.currentLocation = const GeoPoint(13.0827, 80.2707),
    this.currentNodeName = 'Node 10',
    this.speed = 0.0,
    this.heading = 0.0,
    this.currentRequestId,
    this.vehiclePlateNumber = 'TN 09 EM 1083',
    this.vehicleType = 'Advanced Life Support (ALS)',
  });

  Ambulance copyWith({
    String? ambulanceId,
    String? providerId,
    String? driverId,
    DriverLifecycleState? status,
    AmbulanceAvailability? availability,
    GeoPoint? currentLocation,
    String? currentNodeName,
    double? speed,
    double? heading,
    String? currentRequestId,
    String? vehiclePlateNumber,
    String? vehicleType,
  }) {
    return Ambulance(
      ambulanceId: ambulanceId ?? this.ambulanceId,
      providerId: providerId ?? this.providerId,
      driverId: driverId ?? this.driverId,
      status: status ?? this.status,
      availability: availability ?? this.availability,
      currentLocation: currentLocation ?? this.currentLocation,
      currentNodeName: currentNodeName ?? this.currentNodeName,
      speed: speed ?? this.speed,
      heading: heading ?? this.heading,
      currentRequestId: currentRequestId ?? this.currentRequestId,
      vehiclePlateNumber: vehiclePlateNumber ?? this.vehiclePlateNumber,
      vehicleType: vehicleType ?? this.vehicleType,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ambulanceId': ambulanceId,
      'providerId': providerId,
      'driverId': driverId,
      'status': status.displayName,
      'availability': availability.displayName,
      'currentLocation': {
        'latitude': currentLocation.latitude,
        'longitude': currentLocation.longitude,
        'nodeName': currentNodeName,
      },
      'speed': speed,
      'heading': heading,
      'currentRequestId': currentRequestId,
      'vehiclePlateNumber': vehiclePlateNumber,
      'vehicleType': vehicleType,
    };
  }

  factory Ambulance.fromJson(Map<String, dynamic> json) {
    final data = json['ambulance'] is Map<String, dynamic>
        ? json['ambulance'] as Map<String, dynamic>
        : (json['data'] is Map<String, dynamic>
            ? json['data'] as Map<String, dynamic>
            : json);

    final locJson = data['currentLocation'] as Map<String, dynamic>? ?? {};

    // Backend returns 'id' not 'ambulanceId'; fall back for forward compatibility
    final ambulanceId = (data['id'] as String?) ??
        (data['ambulanceId'] as String?) ??
        'AMB-001';

    // Backend status field: AVAILABLE, ASSIGNED, BUSY, OFFLINE
    // Map ASSIGNED → busy because ambulance is not free during assignment
    final rawStatus = data['status'] != null ? data['status'].toString().toUpperCase() : '';
    final AmbulanceAvailability parsedAvailability;
    switch (rawStatus) {
      case 'AVAILABLE':
        parsedAvailability = AmbulanceAvailability.available;
        break;
      case 'BUSY':
      case 'ASSIGNED': // backend uses ASSIGNED when a driver accepted
        parsedAvailability = AmbulanceAvailability.busy;
        break;
      default:
        parsedAvailability = data['availability'] != null
            ? AmbulanceAvailability.fromString(data['availability'] as String)
            : AmbulanceAvailability.offline;
    }

    // Map availability → lifecycle state for ambulance model
    final DriverLifecycleState parsedLifecycle;
    switch (parsedAvailability) {
      case AmbulanceAvailability.available:
        parsedLifecycle = DriverLifecycleState.available;
        break;
      case AmbulanceAvailability.busy:
        parsedLifecycle = DriverLifecycleState.accepted;
        break;
      default:
        parsedLifecycle = DriverLifecycleState.offline;
    }

    return Ambulance(
      ambulanceId: ambulanceId,
      providerId: data['providerId'] as String? ?? 'PROV-001',
      driverId: data['driverId'] as String? ?? 'DRV-001',
      status: parsedLifecycle,
      availability: parsedAvailability,
      currentLocation: GeoPoint(
        (locJson['latitude'] as num?)?.toDouble() ?? 13.0827,
        (locJson['longitude'] as num?)?.toDouble() ?? 80.2707,
      ),
      currentNodeName: locJson['nodeName'] as String? ?? 'Node 10',
      speed: (data['speed'] as num?)?.toDouble() ?? 0.0,
      heading: (data['heading'] as num?)?.toDouble() ?? 0.0,
      currentRequestId: data['currentRequestId'] as String?,
      vehiclePlateNumber: (data['vehiclePlateNumber'] as String?) ??
          (data['ambulanceNumber'] as String?) ??
          'TN 09 EM 1083',
      vehicleType: data['vehicleType'] as String? ?? 'Advanced Life Support (ALS)',
    );
  }
}
