import '../../domain/entities/request_status.dart';
import '../../domain/entities/tracking_info.dart';
import 'eta_model.dart';

/// Data model for TrackingInfo with JSON serialization.
class TrackingModel extends TrackingInfo {
  const TrackingModel({
    required super.ambulanceId,
    required super.requestId,
    required super.latitude,
    required super.longitude,
    super.speedKmH,
    super.headingDegrees,
    required super.timestamp,
    required super.status,
    super.eta,
    super.vehicleNumber,
    super.driverName,
    super.driverPhone,
    super.provider,
    super.gpsSource,
    super.isSimulated = true,
    super.accuracy,
  });

  factory TrackingModel.fromJson(Map<String, dynamic> json) {
    DateTime parsedTimestamp = DateTime.now();
    if (json['timestamp'] != null) {
      parsedTimestamp = DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now();
    }

    final provider = json['provider'] as String? ??
        (json['gpsSource'] == 'DEVICE' ? 'real' : 'simulation');
    final gpsSource = json['gpsSource'] as String? ??
        (provider == 'real' ? 'DEVICE' : 'SIMULATION');
    final isSimulated = json['isSimulated'] != null
        ? (json['isSimulated'] is bool
            ? json['isSimulated'] as bool
            : json['isSimulated'].toString().toLowerCase() == 'true')
        : (provider != 'real' && gpsSource != 'DEVICE');

    return TrackingModel(
      ambulanceId: json['ambulanceId'] as String? ?? 'AMB-UNKNOWN',
      requestId: json['requestId'] as String? ?? '',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      speedKmH: (json['speedKmH'] ?? json['speed'] as num?)?.toDouble(),
      headingDegrees: (json['headingDegrees'] ?? json['heading'] as num?)?.toDouble(),
      timestamp: parsedTimestamp,
      status: RequestStatus.fromCode(json['status'] as String? ?? 'ASSIGNED'),
      eta: json['eta'] != null ? EtaModel.fromJson(json['eta'] as Map<String, dynamic>) : null,
      vehicleNumber: json['vehicleNumber'] as String?,
      driverName: json['driverName'] as String?,
      driverPhone: json['driverPhone'] as String?,
      provider: provider,
      gpsSource: gpsSource,
      isSimulated: isSimulated,
      accuracy: (json['accuracy'] as num?)?.toDouble(),
    );
  }

  factory TrackingModel.fromEntity(TrackingInfo entity) {
    return TrackingModel(
      ambulanceId: entity.ambulanceId,
      requestId: entity.requestId,
      latitude: entity.latitude,
      longitude: entity.longitude,
      speedKmH: entity.speedKmH,
      headingDegrees: entity.headingDegrees,
      timestamp: entity.timestamp,
      status: entity.status,
      eta: entity.eta,
      vehicleNumber: entity.vehicleNumber,
      driverName: entity.driverName,
      driverPhone: entity.driverPhone,
      provider: entity.provider,
      gpsSource: entity.gpsSource,
      isSimulated: entity.isSimulated,
      accuracy: entity.accuracy,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ambulanceId': ambulanceId,
      'requestId': requestId,
      'latitude': latitude,
      'longitude': longitude,
      if (speedKmH != null) 'speedKmH': speedKmH,
      if (headingDegrees != null) 'headingDegrees': headingDegrees,
      'timestamp': timestamp.toIso8601String(),
      'status': status.code,
      if (eta != null) 'eta': (eta is EtaModel ? (eta as EtaModel).toJson() : EtaModel.fromEntity(eta!).toJson()),
      if (vehicleNumber != null) 'vehicleNumber': vehicleNumber,
      if (driverName != null) 'driverName': driverName,
      if (driverPhone != null) 'driverPhone': driverPhone,
      if (provider != null) 'provider': provider,
      if (gpsSource != null) 'gpsSource': gpsSource,
      'isSimulated': isSimulated,
      if (accuracy != null) 'accuracy': accuracy,
    };
  }
}
