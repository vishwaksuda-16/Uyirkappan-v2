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
  final String? provider;
  final String? gpsSource;
  final bool isSimulated;
  final double? accuracy;

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
    this.provider,
    this.gpsSource,
    this.isSimulated = true,
    this.accuracy,
  });

  /// Check whether telemetry originates from a real hardware device GPS provider (Phase 3 provenance)
  bool get isRealGps => !isSimulated && (provider == 'real' || gpsSource == 'DEVICE');

  /// Human-readable provenance badge string adhering to Phase 3/9 specifications
  String get provenanceBadgeText => isRealGps ? '● GPS LIVE (REAL)' : '○ GPS SIMULATION';

  /// Whether telemetry update is older than 45 seconds
  bool get isStale => DateTime.now().difference(timestamp).inSeconds > 45;

  /// Elapsed seconds since the latest telemetry point was captured
  int get secondsSinceUpdate => DateTime.now().difference(timestamp).inSeconds;

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
    String? provider,
    String? gpsSource,
    bool? isSimulated,
    double? accuracy,
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
      provider: provider ?? this.provider,
      gpsSource: gpsSource ?? this.gpsSource,
      isSimulated: isSimulated ?? this.isSimulated,
      accuracy: accuracy ?? this.accuracy,
    );
  }
}
