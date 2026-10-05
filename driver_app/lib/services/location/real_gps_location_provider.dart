import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'geolocator_wrapper.dart';
import 'location_provider.dart';

/// Real device hardware GPS location provider using Geolocator.
class RealGpsLocationProvider implements LocationProvider {
  final GeolocatorWrapper _wrapper;
  final StreamController<RawLocationData> _locationController =
      StreamController<RawLocationData>.broadcast();
  final StreamController<LocationProviderStatus> _statusController =
      StreamController<LocationProviderStatus>.broadcast();

  StreamSubscription<Position>? _positionSubscription;
  LocationProviderStatus _status = LocationProviderStatus.initializing;
  RawLocationData? _lastKnownLocation;
  bool _isActive = false;

  RealGpsLocationProvider({GeolocatorWrapper? wrapper})
      : _wrapper = wrapper ?? const DefaultGeolocatorWrapper();

  @override
  Stream<RawLocationData> get locationStream => _locationController.stream;

  @override
  LocationProviderStatus get status => _status;

  @override
  Stream<LocationProviderStatus> get statusStream => _statusController.stream;

  void _updateStatus(LocationProviderStatus newStatus) {
    if (_status != newStatus) {
      _status = newStatus;
      _statusController.add(newStatus);
    }
  }

  @override
  Future<bool> isAvailable() async {
    try {
      final serviceEnabled = await _wrapper.isLocationServiceEnabled();
      if (!serviceEnabled) return false;
      final permission = await _wrapper.checkPermission();
      return permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<RawLocationData?> getCurrentLocation() async {
    try {
      final hasPermission = await _ensurePermissions();
      if (!hasPermission) return null;

      final position = await _wrapper.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (position != null) {
        _lastKnownLocation = _positionToRawData(position);
        return _lastKnownLocation;
      }
    } catch (_) {
      _updateStatus(LocationProviderStatus.unavailable);
    }
    return null;
  }

  @override
  Future<void> start() async {
    if (_isActive) return;
    _isActive = true;
    _updateStatus(LocationProviderStatus.initializing);

    final hasPermission = await _ensurePermissions();
    if (!hasPermission) {
      _isActive = false;
      return;
    }

    try {
      _updateStatus(LocationProviderStatus.live);

      // Attempt to immediately acquire current fix before stream delivers
      try {
        final initialPos = await _wrapper.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
        if (initialPos != null) {
          final data = _positionToRawData(initialPos);
          _lastKnownLocation = data;
          _locationController.add(data);
        }
      } catch (_) {
        // Stream will provide subsequent updates
      }

      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3, // Ingest when vehicle moves >= 3 meters
      );

      _positionSubscription?.cancel();
      _positionSubscription = _wrapper
          .getPositionStream(locationSettings: locationSettings)
          .listen(
        (position) {
          final data = _positionToRawData(position);
          _lastKnownLocation = data;
          _locationController.add(data);
        },
        onError: (error) {
          _updateStatus(LocationProviderStatus.unavailable);
        },
      );
    } catch (e) {
      _isActive = false;
      _updateStatus(LocationProviderStatus.unavailable);
    }
  }

  Future<bool> _ensurePermissions() async {
    try {
      final serviceEnabled = await _wrapper.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _updateStatus(LocationProviderStatus.serviceDisabled);
        return false;
      }

      var permission = await _wrapper.checkPermission();
      if (permission == LocationPermission.denied) {
        _updateStatus(LocationProviderStatus.permissionRequired);
        permission = await _wrapper.requestPermission();
        if (permission == LocationPermission.denied) {
          _updateStatus(LocationProviderStatus.permissionDenied);
          return false;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _updateStatus(LocationProviderStatus.permissionDeniedForever);
        return false;
      }

      return permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always;
    } catch (_) {
      _updateStatus(LocationProviderStatus.unavailable);
      return false;
    }
  }

  RawLocationData _positionToRawData(Position pos) {
    // Geolocator reports speed in m/s. Convert to km/h (speedMps * 3.6)
    final speedKmh = pos.speed > 0 ? pos.speed * 3.6 : 0.0;
    final headingDeg = pos.heading >= 0 ? pos.heading : 0.0;

    return RawLocationData(
      latitude: pos.latitude,
      longitude: pos.longitude,
      timestamp: pos.timestamp,
      speed: speedKmh,
      heading: headingDeg,
      accuracy: pos.accuracy,
      altitude: pos.altitude,
      isMock: pos.isMocked,
      provider: 'real_gps',
    );
  }

  @override
  Future<void> stop() async {
    _isActive = false;
    await _positionSubscription?.cancel();
    _positionSubscription = null;
  }

  @override
  void dispose() {
    stop();
    _locationController.close();
    _statusController.close();
  }
}
