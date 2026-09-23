import 'dart:async';
import '../core/config/app_config.dart';
import '../core/storage/local_storage_service.dart';
import '../models/ambulance.dart';
import '../models/assignment.dart';
import '../models/driver.dart';
import '../models/hospital.dart';
import '../models/location_model.dart';
import '../models/route_model.dart';
import '../models/state_enums.dart';
import '../services/api/api_service.dart';
import '../services/location/location_service.dart';
import '../services/socket/socket_service.dart';
import 'driver_repository.dart';

class DriverRepositoryImpl implements DriverRepository {
  @override
  final AppConfig config;
  final ApiService _apiService;
  final SocketService _socketService;
  final LocationService _locationService;
  final LocalStorageService _storage;

  StreamSubscription<AmbulanceLocation>? _locationSub;

  DriverRepositoryImpl({
    required this.config,
    required ApiService apiService,
    required SocketService socketService,
    required LocationService locationService,
    required LocalStorageService storage,
  })  : _apiService = apiService,
        _socketService = socketService,
        _locationService = locationService,
        _storage = storage {
    _initRelay();
  }

  void _initRelay() {
    // When location updates are generated, forward to socket/API
    _locationSub = _locationService.locationStream.listen((location) {
      _socketService.emitLocationUpdate(location);
      _apiService.postLocationUpdate(location.ambulanceId, location);
    });
  }

  @override
  ConnectionStatus get connectionStatus => _socketService.connectionStatus;

  @override
  Stream<ConnectionStatus> get connectionStatusStream =>
      _socketService.connectionStatusStream;

  @override
  Stream<Assignment> get onAssignmentReceived =>
      _socketService.onAssignmentReceived;

  @override
  Stream<String> get onAssignmentCancelled =>
      _socketService.onAssignmentCancelled;

  @override
  Stream<int> get onEtaUpdated => _socketService.onEtaUpdated;

  @override
  Stream<RouteModel> get onRouteUpdated => _socketService.onRouteUpdated;

  @override
  Stream<Hospital> get onHospitalAssigned =>
      _socketService.onHospitalAssigned;

  @override
  Stream<Map<String, dynamic>> get onDemoAssignmentCreated =>
      _socketService.onDemoAssignmentCreated;

  @override
  Stream<AmbulanceLocation> get locationStream =>
      _locationService.locationStream;

  @override
  AmbulanceLocation? get currentLocation => _locationService.currentLocation;

  @override
  Future<Driver> login(String driverId, String password) async {
    final driver = await _apiService.login(driverId, password);
    await _storage.saveDriverId(driver.driverId);
    await _storage.saveAmbulanceId(driver.ambulanceId);
    await _storage.saveDriverEmail(driver.email);
    if (driver.token != null) {
      await _storage.saveAuthToken(driver.token!);
    }
    await _socketService.connect();
    return driver;
  }

  @override
  Future<Driver?> restoreSession() async {
    final driverId = await _storage.getDriverId();
    if (driverId == null || driverId.isEmpty) return null;
    try {
      final token = await _storage.getAuthToken();
      if (token != null && token.isNotEmpty) {
        _apiService.setAuthToken(token);
      }
      final driver = await _apiService.getDriverProfile(driverId);
      await _socketService.connect();
      return driver;
    } catch (_) {
      await _storage.clearAuth();
      return null;
    }
  }

  @override
  Future<Assignment?> getActiveAssignment() {
    return _apiService.getActiveAssignment();
  }

  @override
  Future<void> logout() async {
    stopLocationTracking();
    await _storage.clearAuth();
    await _socketService.disconnect();
  }

  @override
  Future<Ambulance> updateAvailability(
    String ambulanceId,
    AmbulanceAvailability availability, {
    DriverLifecycleState? lifecycleState,
  }) async {
    final amb = await _apiService.updateAmbulanceStatus(
      ambulanceId,
      availability,
      lifecycleState: lifecycleState,
    );
    _socketService.emitStatusUpdate(
      ambulanceId,
      lifecycleState ??
          (availability == AmbulanceAvailability.available
              ? DriverLifecycleState.available
              : DriverLifecycleState.offline),
    );
    return amb;
  }

  @override
  Future<Assignment> acceptAssignment(String assignmentId) async {
    final assignment = await _apiService.acceptAssignment(assignmentId);
    _socketService.emitAssignmentResponse(assignmentId, 'ACCEPTED');
    _socketService.emitStatusUpdate(
      assignment.ambulanceId,
      DriverLifecycleState.accepted,
    );
    return assignment;
  }

  @override
  Future<void> rejectAssignment(String assignmentId, {String? reason}) async {
    await _apiService.rejectAssignment(assignmentId, reason: reason);
    _socketService.emitAssignmentResponse(assignmentId, 'REJECTED');
  }

  @override
  Future<Assignment> updateAssignmentStatus(
    String assignmentId,
    DriverLifecycleState status,
  ) async {
    final assignment = await _apiService.updateAssignmentStatus(
      assignmentId,
      status,
    );
    _socketService.emitStatusUpdate(assignment.ambulanceId, status);
    return assignment;
  }

  @override
  Future<RouteModel> getAssignmentRoute(String assignmentId) {
    return _apiService.getAssignmentRoute(assignmentId);
  }

  @override
  void startLocationTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
  }) {
    _locationService.startTracking(
      route,
      ambulanceId,
      requestId: requestId,
    );
  }

  @override
  void stopLocationTracking() {
    _locationService.stopTracking();
  }

  @override
  void setSpeedMultiplier(double multiplier) {
    _locationService.setSpeedMultiplier(multiplier);
  }

  @override
  Future<int> getTodayRequestsCount() => _storage.getTodayRequestsCount();

  @override
  Future<void> incrementTodayRequests() => _storage.incrementTodayRequests();

  @override
  Future<int> getTodayCompletedCount() => _storage.getTodayCompletedCount();

  @override
  Future<void> incrementTodayCompleted() => _storage.incrementTodayCompleted();

  void dispose() {
    _locationSub?.cancel();
  }
}
