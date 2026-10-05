import 'dart:async';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import 'location_provider.dart';

abstract class LocationService {
  Stream<AmbulanceLocation> get locationStream;
  AmbulanceLocation? get currentLocation;
  bool get isTracking;
  LocationProviderStatus get status;
  Stream<LocationProviderStatus> get statusStream;

  void startTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
    double initialSpeedKmh = 40.0,
  });

  void updateRoute(RouteModel newRoute);
  void pauseTracking();
  void resumeTracking();
  void stopTracking();
  void setSpeedMultiplier(double multiplier);
}
