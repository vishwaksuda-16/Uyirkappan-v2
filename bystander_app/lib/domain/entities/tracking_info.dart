import 'eta_info.dart';
import 'request_status.dart';

/// Entity representing real-time telemetry of the assigned emergency vehicle.
class TrackingInfo {
  final String ambulanceId;
  final String requestId;
  final double latitude;
  final double longitude;
  final double? speedKmH;
  final double? headingDegrees;
  final DateTime timestamp;
  final RequestStatus status;
  final EtaInfo? eta;
  final String? vehicleNumber;
  final String? driverName;
  final String? driverPhone;

  const TrackingInfo({
    required this.ambulanceId,
    required this.requestId,
    required this.latitude,
    required this.longitude,
    this.speedKmH,
    this.headingDegrees,
    required this.timestamp,
    required this.status,
    this.eta,
    this.vehicleNumber,
    this.driverName,
    this.driverPhone,
  });

  TrackingInfo copyWith({
    String? ambulanceId,
    String? requestId,
    double? latitude,
    double? longitude,
    double? speedKmH,
    double? headingDegrees,
    DateTime? timestamp,
    RequestStatus? status,
    EtaInfo? eta,
    String? vehicleNumber,
    String? driverName,
    String? driverPhone,
  }) {
    return TrackingInfo(
      ambulanceId: ambulanceId ?? this.ambulanceId,
      requestId: requestId ?? this.requestId,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speedKmH: speedKmH ?? this.speedKmH,
      headingDegrees: headingDegrees ?? this.headingDegrees,
      timestamp: timestamp ?? this.timestamp,
      status: status ?? this.status,
      eta: eta ?? this.eta,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      driverName: driverName ?? this.driverName,
      driverPhone: driverPhone ?? this.driverPhone,
    );
  }
}
