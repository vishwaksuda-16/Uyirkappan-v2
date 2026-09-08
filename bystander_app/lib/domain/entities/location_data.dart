/// Domain entity representing geographical location details.
class LocationData {
  final double latitude;
  final double longitude;
  final double? accuracy;
  final double? altitude;
  final double? speed;
  final double? heading;
  final DateTime timestamp;
  final String? readableAddress;
  final bool isManualOverride;

  const LocationData({
    required this.latitude,
    required this.longitude,
    this.accuracy,
    this.altitude,
    this.speed,
    this.heading,
    required this.timestamp,
    this.readableAddress,
    this.isManualOverride = false,
  });

  /// Address alias for readableAddress
  String? get address => readableAddress;

  LocationData copyWith({
    double? latitude,
    double? longitude,
    double? accuracy,
    double? altitude,
    double? speed,
    double? heading,
    DateTime? timestamp,
    String? readableAddress,
    bool? isManualOverride,
  }) {
    return LocationData(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracy: accuracy ?? this.accuracy,
      altitude: altitude ?? this.altitude,
      speed: speed ?? this.speed,
      heading: heading ?? this.heading,
      timestamp: timestamp ?? this.timestamp,
      readableAddress: readableAddress ?? this.readableAddress,
      isManualOverride: isManualOverride ?? this.isManualOverride,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is LocationData &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.isManualOverride == isManualOverride;
  }

  @override
  int get hashCode => latitude.hashCode ^ longitude.hashCode ^ isManualOverride.hashCode;

  @override
  String toString() =>
      'LocationData(lat: $latitude, lng: $longitude, acc: $accuracy, manual: $isManualOverride)';
}
