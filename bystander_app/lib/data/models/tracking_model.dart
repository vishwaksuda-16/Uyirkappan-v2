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
  });

  factory TrackingModel.fromJson(Map<String, dynamic> json) {
    return TrackingModel(
      ambulanceId: json['ambulanceId'] as String? ?? 'AMB-UNKNOWN',
      requestId: json['requestId'] as String? ?? '',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      speedKmH: (json['speedKmH'] as num?)?.toDouble(),
      headingDegrees: (json['headingDegrees'] as num?)?.toDouble(),
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
      status: RequestStatus.fromCode(json['status'] as String? ?? 'ASSIGNED'),
      eta: json['eta'] != null ? EtaModel.fromJson(json['eta'] as Map<String, dynamic>) : null,
      vehicleNumber: json['vehicleNumber'] as String?,
      driverName: json['driverName'] as String?,
      driverPhone: json['driverPhone'] as String?,
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
    };
  }
}
