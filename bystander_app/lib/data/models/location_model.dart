import '../../domain/entities/location_data.dart';

/// Data model for LocationData with JSON serialization.
class LocationModel extends LocationData {
  const LocationModel({
    required super.latitude,
    required super.longitude,
    super.accuracy,
    super.altitude,
    super.speed,
    super.heading,
    required super.timestamp,
    super.readableAddress,
    super.isManualOverride,
  });

  factory LocationModel.fromJson(Map<String, dynamic> json) {
    return LocationModel(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      altitude: (json['altitude'] as num?)?.toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
      readableAddress: json['readableAddress'] as String?,
      isManualOverride: json['isManualOverride'] as bool? ?? false,
    );
  }

  factory LocationModel.fromEntity(LocationData entity) {
    return LocationModel(
      latitude: entity.latitude,
      longitude: entity.longitude,
      accuracy: entity.accuracy,
      altitude: entity.altitude,
      speed: entity.speed,
      heading: entity.heading,
      timestamp: entity.timestamp,
      readableAddress: entity.readableAddress,
      isManualOverride: entity.isManualOverride,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      if (accuracy != null) 'accuracy': accuracy,
      if (altitude != null) 'altitude': altitude,
      if (speed != null) 'speed': speed,
      if (heading != null) 'heading': heading,
      'timestamp': timestamp.toIso8601String(),
      if (readableAddress != null) 'readableAddress': readableAddress,
      'isManualOverride': isManualOverride,
    };
  }
}
