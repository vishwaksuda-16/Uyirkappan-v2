import 'dart:async';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import 'gps_quality_filter.dart';
import 'location_provider.dart';
import 'location_service.dart';
import 'real_gps_location_provider.dart';
import 'simulation_location_provider.dart';

/// Real location service orchestrator that integrates hardware GPS, GPS quality filtering,
/// status observation, and graceful simulation fallback.
class RealLocationService implements LocationService {
  final LocationProvider _primaryProvider;
  final LocationProvider _fallbackProvider;
  final GpsQualityFilter _qualityFilter;
  final bool _allowSimulationFallback;

  late LocationProvider _activeProvider;
  final StreamController<AmbulanceLocation> _locationController =
      StreamController<AmbulanceLocation>.broadcast();
  final StreamController<LocationProviderStatus> _statusController =
      StreamController<LocationProviderStatus>.broadcast();

  StreamSubscription<RawLocationData>? _providerSub;
  StreamSubscription<LocationProviderStatus>? _statusSub;

  RouteModel? _currentRoute;
  String? _ambulanceId;
  String? _requestId;
  bool _isTracking = false;
  bool _isPaused = false;
  AmbulanceLocation? _currentLocation;
  RawLocationData? _lastRawFix;

  RealLocationService({
    LocationProvider? primaryProvider,
    LocationProvider? fallbackProvider,
    GpsQualityFilter? qualityFilter,
    bool allowSimulationFallback = true,
  })  : _primaryProvider = primaryProvider ?? RealGpsLocationProvider(),
        _fallbackProvider = fallbackProvider ?? SimulationLocationProvider(),
        _qualityFilter = qualityFilter ?? const GpsQualityFilter(),
        _allowSimulationFallback = allowSimulationFallback {
    _activeProvider = _primaryProvider;
    _listenToActiveProvider();
  }

  void _listenToActiveProvider() {
    _providerSub?.cancel();
    _statusSub?.cancel();

    _statusSub = _activeProvider.statusStream.listen((newStatus) {
      _statusController.add(newStatus);

      // Handle automatic graceful fallback if device GPS is denied/disabled
      if (_allowSimulationFallback &&
          _activeProvider == _primaryProvider &&
          (newStatus == LocationProviderStatus.permissionDenied ||
              newStatus == LocationProviderStatus.permissionDeniedForever ||
              newStatus == LocationProviderStatus.serviceDisabled ||
              newStatus == LocationProviderStatus.unavailable)) {
        _switchToFallback();
      }
    });

    _providerSub = _activeProvider.locationStream.listen((raw) {
      if (_isPaused || !_isTracking) return;
      _handleRawLocation(raw);
    });
  }

  void _switchToFallback() {
    if (_activeProvider == _fallbackProvider) return;
    _activeProvider.stop();
    _activeProvider = _fallbackProvider;
    final fallback = _fallbackProvider;
    if (_currentRoute != null && fallback is SimulationLocationProvider) {
      fallback.setRoute(_currentRoute!);
    }
    _listenToActiveProvider();
    if (_isTracking) {
      _activeProvider.start();
    }
    _statusController.add(LocationProviderStatus.simulation);
  }

  void _handleRawLocation(RawLocationData raw) {
    // 1. Run GPS quality filter
    final evaluation = _qualityFilter.evaluate(_lastRawFix, raw);
    if (!evaluation.isUsable) {
      // Drop invalid / impossible jump coordinates
      return;
    }

    _lastRawFix = raw;

    // 2. Map normalized RawLocationData to domain AmbulanceLocation
    final location = AmbulanceLocation(
      latitude: raw.latitude,
      longitude: raw.longitude,
      speed: raw.speed,
      heading: raw.heading,
      accuracy: raw.accuracy,
      altitude: raw.altitude,
      provider: raw.provider,
      isMock: raw.isMock,
      ambulanceId: _ambulanceId ?? 'AMB0001',
      requestId: _requestId,
      timestamp: raw.timestamp,
    );

    _currentLocation = location;
    _locationController.add(location);
  }

  @override
  Stream<AmbulanceLocation> get locationStream => _locationController.stream;

  @override
  AmbulanceLocation? get currentLocation => _currentLocation;

  @override
  bool get isTracking => _isTracking;

  @override
  LocationProviderStatus get status => _activeProvider.status;

  @override
  Stream<LocationProviderStatus> get statusStream => _statusController.stream;

  LocationProvider get activeProvider => _activeProvider;

  @override
  void startTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
    double initialSpeedKmh = 38.0,
  }) {
    stopTracking();
    _currentRoute = route;
    _ambulanceId = ambulanceId;
    _requestId = requestId;
    _isTracking = true;
    _isPaused = false;

    if (_activeProvider is SimulationLocationProvider) {
      (_activeProvider as SimulationLocationProvider).setRoute(route);
    }

    _activeProvider.start();
  }

  @override
  void updateRoute(RouteModel newRoute) {
    _currentRoute = newRoute;
    if (_activeProvider is SimulationLocationProvider) {
      (_activeProvider as SimulationLocationProvider).setRoute(newRoute);
    }
  }

  @override
  void pauseTracking() {
    _isPaused = true;
  }

  @override
  void resumeTracking() {
    _isPaused = false;
  }

  @override
  void stopTracking() {
    _isTracking = false;
    _isPaused = false;
    _activeProvider.stop();
  }

  @override
  void setSpeedMultiplier(double multiplier) {
    if (_activeProvider is SimulationLocationProvider) {
      (_activeProvider as SimulationLocationProvider).setSpeedMultiplier(multiplier);
    }
  }

  void dispose() {
    stopTracking();
    _providerSub?.cancel();
    _statusSub?.cancel();
    _primaryProvider.dispose();
    _fallbackProvider.dispose();
    _locationController.close();
    _statusController.close();
  }
}
