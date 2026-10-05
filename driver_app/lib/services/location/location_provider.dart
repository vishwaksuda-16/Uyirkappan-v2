import 'dart:async';

/// Granular status of the location provider for UI indicators and lifecycle handling.
enum LocationProviderStatus {
  initializing,
  live,
  simulation,
  permissionRequired,
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  unavailable,
  degraded,
}

extension LocationProviderStatusX on LocationProviderStatus {
  String get displayName {
    switch (this) {
      case LocationProviderStatus.initializing:
        return 'GPS INITIALIZING';
      case LocationProviderStatus.live:
        return 'GPS LIVE';
      case LocationProviderStatus.simulation:
        return 'GPS SIMULATION';
      case LocationProviderStatus.permissionRequired:
        return 'GPS PERMISSION REQUIRED';
      case LocationProviderStatus.permissionDenied:
        return 'GPS PERMISSION DENIED';
      case LocationProviderStatus.permissionDeniedForever:
        return 'GPS PERMISSION DENIED FOREVER';
      case LocationProviderStatus.serviceDisabled:
        return 'GPS SERVICE DISABLED';
      case LocationProviderStatus.unavailable:
        return 'GPS UNAVAILABLE';
      case LocationProviderStatus.degraded:
        return 'GPS DEGRADED';
    }
  }

  bool get isOperational =>
      this == LocationProviderStatus.live ||
      this == LocationProviderStatus.simulation ||
      this == LocationProviderStatus.degraded;
}

/// Normalized raw location data emitted from hardware GPS or simulation provider.
class RawLocationData {
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final double speed; // in km/h
  final double heading; // in degrees [0, 360)
  final double? accuracy; // horizontal accuracy in meters
  final double? altitude; // altitude in meters
  final bool isMock;
  final String provider; // 'real_gps', 'simulation', etc.

  const RawLocationData({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.speed = 0.0,
    this.heading = 0.0,
    this.accuracy,
    this.altitude,
    this.isMock = false,
    this.provider = 'real_gps',
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp.toIso8601String(),
        'speed': speed,
        'heading': heading,
        'accuracy': accuracy,
        'altitude': altitude,
        'isMock': isMock,
        'provider': provider,
      };

  @override
  String toString() =>
      'RawLocationData($provider: $latitude, $longitude, speed: ${speed.toStringAsFixed(1)} km/h, acc: ${accuracy?.toStringAsFixed(1)}m)';
}

/// Abstract contract decoupling the application from specific hardware GPS packages.
abstract class LocationProvider {
  /// Stream of normalized location updates.
  Stream<RawLocationData> get locationStream;

  /// Current provider operational status.
  LocationProviderStatus get status;

  /// Stream of status changes (e.g. permission granted, service disabled).
  Stream<LocationProviderStatus> get statusStream;

  /// Retrieves the current single location fix if available.
  Future<RawLocationData?> getCurrentLocation();

  /// Verifies whether the provider can produce locations on this device.
  Future<bool> isAvailable();

  /// Starts listening to or generating location fixes.
  Future<void> start();

  /// Pauses or terminates active location acquisition.
  Future<void> stop();

  /// Cleans up controllers and system subscriptions.
  void dispose();
}
