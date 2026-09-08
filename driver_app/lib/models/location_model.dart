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

  const AmbulanceLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    required this.speed,
    required this.heading,
    required this.ambulanceId,
    this.requestId,
    this.nodeName,
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
    );
  }
}
