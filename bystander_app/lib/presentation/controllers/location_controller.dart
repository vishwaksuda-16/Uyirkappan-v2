import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/constants/app_constants.dart';
import '../../domain/entities/location_data.dart';

enum LocationFetchStatus {
  initial,
  loading,
  success,
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  error,
}

/// Controller responsible for acquiring GPS coordinates, managing permissions,
/// and maintaining manual location overrides.
class LocationController extends ChangeNotifier {
  LocationFetchStatus _status = LocationFetchStatus.success;
  LocationData? _deviceLocation = LocationData(
    latitude: AppConstants.defaultLatitude,
    longitude: AppConstants.defaultLongitude,
    accuracy: AppConstants.defaultAccuracy,
    timestamp: DateTime.now(),
    readableAddress: 'Anna Salai, Central Chennai',
    isManualOverride: false,
  );
  LocationData? _emergencyLocation = LocationData(
    latitude: AppConstants.defaultLatitude,
    longitude: AppConstants.defaultLongitude,
    accuracy: AppConstants.defaultAccuracy,
    timestamp: DateTime.now(),
    readableAddress: 'Anna Salai, Central Chennai',
    isManualOverride: false,
  );
  String? _errorMessage;

  LocationFetchStatus get status => _status;
  LocationData? get deviceLocation => _deviceLocation;
  LocationData? get emergencyLocation => _emergencyLocation ?? _deviceLocation;
  LocationData get currentLocation =>
      emergencyLocation ??
      _deviceLocation ??
      LocationData(
        latitude: AppConstants.defaultLatitude,
        longitude: AppConstants.defaultLongitude,
        timestamp: DateTime.now(),
      );
  String? get errorMessage => _errorMessage;
  bool get isLocationReady => emergencyLocation != null;
  bool get isManualOverride => _emergencyLocation?.isManualOverride ?? false;

  LocationController() {
    // Automatically attempt to query real GPS hardware/browser location
    fetchCurrentLocation();
  }

  /// Requests permissions and queries the device GPS using Geolocator.
  Future<void> fetchCurrentLocation() async {
    _status = LocationFetchStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _status = LocationFetchStatus.serviceDisabled;
        _errorMessage = 'Location services are disabled on your device.';
        _useFallbackLocation();
        notifyListeners();
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _status = LocationFetchStatus.permissionDenied;
          _errorMessage = 'Location permissions were denied.';
          _useFallbackLocation();
          notifyListeners();
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _status = LocationFetchStatus.permissionDeniedForever;
        _errorMessage = 'Location permissions are permanently denied. Please enable them in device settings.';
        _useFallbackLocation();
        notifyListeners();
        return;
      }

      // Location permissions granted - acquire current position
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      final loc = LocationData(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        speed: position.speed,
        heading: position.heading,
        timestamp: position.timestamp,
        isManualOverride: false,
      );

      _deviceLocation = loc;
      if (_emergencyLocation == null || !_emergencyLocation!.isManualOverride) {
        _emergencyLocation = loc;
      }

      _status = LocationFetchStatus.success;
      _errorMessage = null;
      notifyListeners();
    } catch (e) {
      _status = LocationFetchStatus.error;
      _errorMessage = 'Could not acquire precise GPS: $e';
      _useFallbackLocation();
      notifyListeners();
    }
  }

  /// Sets a manually adjusted emergency incident location.
  void setManualEmergencyLocation({
    required double latitude,
    required double longitude,
    String? address,
  }) {
    _emergencyLocation = LocationData(
      latitude: latitude,
      longitude: longitude,
      accuracy: 2.0, // Manual pinpoint accuracy
      timestamp: DateTime.now(),
      readableAddress: address,
      isManualOverride: true,
    );
    notifyListeners();
  }

  /// Resets the emergency location back to current device GPS position.
  void resetToDeviceGps() {
    if (_deviceLocation != null) {
      _emergencyLocation = _deviceLocation;
      notifyListeners();
    } else {
      fetchCurrentLocation();
    }
  }

  /// Actively queries device GPS hardware/browser location, removes manual pin override,
  /// and updates emergency location to match true current position.
  Future<LocationData?> snapToCurrentGps() async {
    await fetchCurrentLocation();
    if (_deviceLocation != null) {
      _emergencyLocation = _deviceLocation;
      notifyListeners();
      return _emergencyLocation;
    }
    return null;
  }

  void _useFallbackLocation() {
    _deviceLocation ??= LocationData(
      latitude: AppConstants.defaultLatitude,
      longitude: AppConstants.defaultLongitude,
      accuracy: AppConstants.defaultAccuracy,
      timestamp: DateTime.now(),
      isManualOverride: false,
    );
    _emergencyLocation ??= _deviceLocation;
  }
}
