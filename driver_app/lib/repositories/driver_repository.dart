import '../core/config/app_config.dart';
import '../models/ambulance.dart';
import '../models/assignment.dart';
import '../models/driver.dart';
import '../models/hospital.dart';
import '../models/location_model.dart';
import '../models/route_model.dart';
import '../models/state_enums.dart';

abstract class DriverRepository {
  AppConfig get config;
  ConnectionStatus get connectionStatus;
  Stream<ConnectionStatus> get connectionStatusStream;

  // Real-time streams
  Stream<Assignment> get onAssignmentReceived;
  Stream<String> get onAssignmentCancelled;
  Stream<int> get onEtaUpdated;
  Stream<RouteModel> get onRouteUpdated;
  Stream<Hospital> get onHospitalAssigned;
  Stream<AmbulanceLocation> get locationStream;
  AmbulanceLocation? get currentLocation;

  // Auth & Profile
  Future<Driver> login(String driverId, String password);
  Future<Driver?> restoreSession();
  Future<void> logout();

  // Availability & Status
  Future<Ambulance> updateAvailability(
    String ambulanceId,
    AmbulanceAvailability availability, {
    DriverLifecycleState? lifecycleState,
  });

  // Assignment lifecycle
  Future<Assignment?> getActiveAssignment();
  Future<Assignment> acceptAssignment(String assignmentId);
  Future<void> rejectAssignment(String assignmentId, {String? reason});
  Future<Assignment> updateAssignmentStatus(
    String assignmentId,
    DriverLifecycleState status,
  );
  Future<RouteModel> getAssignmentRoute(String assignmentId);

  // Location tracking
  void startLocationTracking(
    RouteModel route,
    String ambulanceId, {
    String? requestId,
  });
  void stopLocationTracking();
  void setSpeedMultiplier(double multiplier);

  // Shift metrics
  Future<int> getTodayRequestsCount();
  Future<void> incrementTodayRequests();
  Future<int> getTodayCompletedCount();
  Future<void> incrementTodayCompleted();
}
