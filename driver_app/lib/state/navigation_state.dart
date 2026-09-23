import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/utils/geo_utils.dart';
import '../models/assignment.dart';
import '../models/hospital.dart';
import '../models/location_model.dart';
import '../models/route_model.dart';
import '../repositories/driver_repository.dart';

enum JourneyPhase {
  none,
  enRouteToPatient,
  enRouteToHospital,
}

class NavigationState extends ChangeNotifier {
  final DriverRepository _repository;

  JourneyPhase _phase = JourneyPhase.none;
  RouteModel? _activeRoute;
  List<RouteModel> _alternativeRoutes = [];
  AmbulanceLocation? _currentLocation;
  double _distanceRemainingKm = 0.0;
  int _dynamicEtaMinutes = 0;
  String? _trafficAlert;
  String _destinationName = '';

  StreamSubscription? _locationSub;
  StreamSubscription? _etaSub;
  StreamSubscription? _routeSub;

  NavigationState({required DriverRepository repository})
      : _repository = repository {
    _initSubscriptions();
  }

  JourneyPhase get phase => _phase;
  RouteModel? get activeRoute => _activeRoute;
  List<RouteModel> get alternativeRoutes => _alternativeRoutes;
  AmbulanceLocation? get currentLocation => _currentLocation;
  double get distanceRemainingKm => _distanceRemainingKm;
  int get dynamicEtaMinutes => _dynamicEtaMinutes;
  String? get trafficAlert => _trafficAlert;
  String get destinationName => _destinationName;
  double get currentSpeedKmh => _currentLocation?.speed ?? 0.0;
  double get currentHeading => _currentLocation?.heading ?? 0.0;
  String get compassDirection => GeoUtils.bearingToDirection(currentHeading);

  bool get isEnRouteToPatient => _phase == JourneyPhase.enRouteToPatient;
  bool get isEnRouteToHospital => _phase == JourneyPhase.enRouteToHospital;
  bool get hasActiveNavigation => _phase != JourneyPhase.none;

  void _initSubscriptions() {
    _locationSub = _repository.locationStream.listen((location) {
      _currentLocation = location;
      _recalculateRemainingMetrics(location);
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
        _currentLocation?.ambulanceId ?? '',
      );
      notifyListeners();
    });
  }

  void startJourneyToPatient(Assignment assignment) {
    _phase = JourneyPhase.enRouteToPatient;
    if (assignment.route != null && assignment.route!.waypoints.isNotEmpty) {
      _activeRoute = assignment.route;
    } else {
      final startLoc = _currentLocation?.toGeoPoint ?? const GeoPoint(13.0400, 80.2500);
      final destLoc = assignment.emergency.pickupLocation;
      final dist = GeoUtils.distanceKm(startLoc, destLoc);
      _activeRoute = RouteModel(
        routeId: 'DYNAMIC_EMERGENCY_ROUTE',
        waypoints: [
          RouteWaypoint(nodeId: 'ORIGIN_GPS', nodeName: 'Ambulance Current Location', location: startLoc),
          RouteWaypoint(nodeId: 'DEST_GPS', nodeName: assignment.emergency.pickupLocationName, location: destLoc),
        ],
        totalDistanceKm: dist,
        estimatedMinutes: assignment.etaMinutes,
      );
    }
    _alternativeRoutes = assignment.alternativeRoutes ?? [];
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

  void startJourneyToHospital(Hospital hospital, {RouteModel? hospitalRoute, List<RouteModel>? alternativeRoutes}) {
    _phase = JourneyPhase.enRouteToHospital;
    if (hospitalRoute != null && hospitalRoute.waypoints.isNotEmpty) {
      _activeRoute = hospitalRoute;
    } else {
      final startLoc = _currentLocation?.toGeoPoint ?? const GeoPoint(13.0400, 80.2500);
      final destLoc = hospital.location;
      final dist = GeoUtils.distanceKm(startLoc, destLoc);
      _activeRoute = RouteModel(
        routeId: 'DYNAMIC_HOSPITAL_ROUTE',
        waypoints: [
          RouteWaypoint(nodeId: 'ORIGIN_GPS', nodeName: 'Patient Scene', location: startLoc),
          RouteWaypoint(
            nodeId: 'WP_CORRIDOR_1',
            nodeName: 'Arterial Corridor Link',
            location: GeoPoint(
              startLoc.latitude + (destLoc.latitude - startLoc.latitude) * 0.4 + 0.003,
              startLoc.longitude + (destLoc.longitude - startLoc.longitude) * 0.4 - 0.002,
            ),
          ),
          RouteWaypoint(
            nodeId: 'WP_CORRIDOR_2',
            nodeName: 'Hospital Approach Junction',
            location: GeoPoint(
              startLoc.latitude + (destLoc.latitude - startLoc.latitude) * 0.75 + 0.001,
              startLoc.longitude + (destLoc.longitude - startLoc.longitude) * 0.75 + 0.002,
            ),
          ),
          RouteWaypoint(nodeId: 'DEST_GPS', nodeName: hospital.name, location: destLoc),
        ],
        totalDistanceKm: dist,
        estimatedMinutes: 8,
      );
    }
    _alternativeRoutes = alternativeRoutes ?? [];
    _destinationName = hospital.name;
    _distanceRemainingKm = _activeRoute!.totalDistanceKm;
    _dynamicEtaMinutes = _activeRoute!.estimatedMinutes;
    _trafficAlert = null;

    _repository.startLocationTracking(
      _activeRoute!,
      _currentLocation?.ambulanceId ?? '',
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
