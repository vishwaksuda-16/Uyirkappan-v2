import '../core/utils/geo_utils.dart';

class AmbulanceLocation {
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double speed; // in km/h
  final double heading; // in degrees [0, 360)
  final String ambulanceId;
  final String? requestId;
  final String? nodeName;
  final double? accuracy;
  final double? altitude;
  final String? provider;
  final bool isMock;

  const AmbulanceLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    required this.speed,
    required this.heading,
    required this.ambulanceId,
    this.requestId,
    this.nodeName,
    this.accuracy,
    this.altitude,
    this.provider,
    this.isMock = false,
  });

  GeoPoint get toGeoPoint => GeoPoint(latitude, longitude);

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      'timestamp': timestamp.toIso8601String(),
      'speed': speed,
      'heading': heading,
      'ambulanceId': ambulanceId,
      'requestId': requestId,
      'nodeName': nodeName,
      if (accuracy != null) 'accuracy': accuracy,
      if (altitude != null) 'altitude': altitude,
      if (provider != null) 'provider': provider,
      'isMock': isMock,
    };
  }

  factory AmbulanceLocation.fromJson(Map<String, dynamic> json) {
    return AmbulanceLocation(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      timestamp: DateTime.parse(json['timestamp'] as String),
      speed: (json['speed'] as num).toDouble(),
      heading: (json['heading'] as num).toDouble(),
      ambulanceId: json['ambulanceId'] as String,
      requestId: json['requestId'] as String?,
      nodeName: json['nodeName'] as String?,
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      altitude: (json['altitude'] as num?)?.toDouble(),
      provider: json['provider'] as String?,
      isMock: json['isMock'] as bool? ?? false,
    );
  }
}
