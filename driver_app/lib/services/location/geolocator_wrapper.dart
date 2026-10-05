import 'dart:async';
import 'package:geolocator/geolocator.dart';

/// Abstract wrapper isolating static Geolocator calls for unit testing and dependency injection.
abstract class GeolocatorWrapper {
  Future<bool> isLocationServiceEnabled();
  Future<LocationPermission> checkPermission();
  Future<LocationPermission> requestPermission();
  Future<Position?> getCurrentPosition({LocationSettings? locationSettings});
  Stream<Position> getPositionStream({LocationSettings? locationSettings});
}

/// Production implementation directly delegating to hardware Geolocator plugin.
class DefaultGeolocatorWrapper implements GeolocatorWrapper {
  const DefaultGeolocatorWrapper();

  @override
  Future<bool> isLocationServiceEnabled() =>
      Geolocator.isLocationServiceEnabled();

  @override
  Future<LocationPermission> checkPermission() =>
      Geolocator.checkPermission();

  @override
  Future<LocationPermission> requestPermission() =>
      Geolocator.requestPermission();

  @override
  Future<Position?> getCurrentPosition({LocationSettings? locationSettings}) =>
      Geolocator.getCurrentPosition(locationSettings: locationSettings);

  @override
  Stream<Position> getPositionStream({LocationSettings? locationSettings}) =>
      Geolocator.getPositionStream(locationSettings: locationSettings);
}
