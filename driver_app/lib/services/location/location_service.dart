import 'dart:async';
import '../../models/location_model.dart';
import '../../models/route_model.dart';

abstract class LocationService {
  Stream<AmbulanceLocation> get locationStream;
  AmbulanceLocation? get currentLocation;
  bool get isTracking;

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
