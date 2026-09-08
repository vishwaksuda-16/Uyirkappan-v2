import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/utils/geo_utils.dart';
import '../models/assignment.dart';
import '../models/hospital.dart';
import '../models/location_model.dart';
import '../models/route_model.dart';
import '../repositories/driver_repository.dart';
import '../services/simulation/road_network.dart';

enum JourneyPhase {
  none,
  enRouteToPatient,
  enRouteToHospital,
}

class NavigationState extends ChangeNotifier {
  final DriverRepository _repository;

  JourneyPhase _phase = JourneyPhase.none;
  RouteModel? _activeRoute;
  AmbulanceLocation? _currentLocation;
  double _distanceRemainingKm = 0.0;
  int _dynamicEtaMinutes = 0;
  double _currentSpeedKmh = 0.0;
  double _currentHeading = 0.0;
  String _destinationName = '';
  String? _trafficAlert;

  StreamSubscription<AmbulanceLocation>? _locationSub;
  StreamSubscription<int>? _etaSub;
  StreamSubscription<RouteModel>? _routeSub;

  NavigationState({required DriverRepository repository})
      : _repository = repository {
    _initStreams();
  }

  JourneyPhase get phase => _phase;
  RouteModel? get activeRoute => _activeRoute;
  AmbulanceLocation? get currentLocation => _currentLocation;
  double get distanceRemainingKm => _distanceRemainingKm;
  int get dynamicEtaMinutes => _dynamicEtaMinutes;
  double get currentSpeedKmh => _currentSpeedKmh;
  double get currentHeading => _currentHeading;
  String get destinationName => _destinationName;
  String? get trafficAlert => _trafficAlert;
  String get compassDirection => GeoUtils.bearingToDirection(_currentHeading);

  void _initStreams() {
    _locationSub = _repository.locationStream.listen((loc) {
      _currentLocation = loc;
      _currentSpeedKmh = loc.speed;
      _currentHeading = loc.heading;
      _recalculateRemainingMetrics(loc);
      notifyListeners();
    });

    _etaSub = _repository.onEtaUpdated.listen((newEta) {
      _dynamicEtaMinutes = newEta;
      _trafficAlert = 'TRAFFIC UPDATE: Heavy congestion detected. ETA recalculated to $newEta min.';
      notifyListeners();
    });

    _routeSub = _repository.onRouteUpdated.listen((newRoute) {
      _activeRoute = newRoute;
      _dynamicEtaMinutes = newRoute.estimatedMinutes;
      _distanceRemainingKm = newRoute.totalDistanceKm;
      _trafficAlert = newRoute.alertMessage;
      _repository.startLocationTracking(
        newRoute,
        _currentLocation?.ambulanceId ?? 'AMB-003',
      );
      notifyListeners();
    });
  }

  void startJourneyToPatient(Assignment assignment) {
    _phase = JourneyPhase.enRouteToPatient;
    _activeRoute = RoadNetwork.getPrimaryRouteToPatient();
    _destinationName = assignment.emergency.pickupLocationName;
    _distanceRemainingKm = _activeRoute!.totalDistanceKm;
    _dynamicEtaMinutes = _activeRoute!.estimatedMinutes;
    _trafficAlert = null;

    _repository.startLocationTracking(
      _activeRoute!,
      assignment.ambulanceId,
      requestId: assignment.requestId,
    );
    notifyListeners();
  }

  void startJourneyToHospital(Hospital hospital) {
    _phase = JourneyPhase.enRouteToHospital;
    _activeRoute = RoadNetwork.getRouteToHospital();
    _destinationName = hospital.name;
    _distanceRemainingKm = _activeRoute!.totalDistanceKm;
    _dynamicEtaMinutes = _activeRoute!.estimatedMinutes;
    _trafficAlert = null;

    _repository.startLocationTracking(
      _activeRoute!,
      _currentLocation?.ambulanceId ?? 'AMB-003',
    );
    notifyListeners();
  }

  void _recalculateRemainingMetrics(AmbulanceLocation loc) {
    if (_activeRoute == null || _activeRoute!.waypoints.isEmpty) return;

    final destLocation = _activeRoute!.waypoints.last.location;
    final currentPos = loc.toGeoPoint;
    final distanceToDest = GeoUtils.distanceKm(currentPos, destLocation);

    _distanceRemainingKm = distanceToDest;

    if (loc.speed > 5.0) {
      // dynamic ETA = (distance / speed) * 60 minutes
      final calculatedMinutes = ((distanceToDest / loc.speed) * 60).ceil();
      _dynamicEtaMinutes = calculatedMinutes.clamp(1, 45);
    }
  }

  void dismissTrafficAlert() {
    _trafficAlert = null;
    notifyListeners();
  }

  void stopNavigation() {
    _phase = JourneyPhase.none;
    _activeRoute = null;
    _trafficAlert = null;
    _repository.stopLocationTracking();
    notifyListeners();
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    _etaSub?.cancel();
    _routeSub?.cancel();
    super.dispose();
  }
}
