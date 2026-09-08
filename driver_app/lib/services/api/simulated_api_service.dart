import '../../core/constants/app_constants.dart';
import '../../core/errors/app_exceptions.dart';
import '../../core/utils/geo_utils.dart';
import '../../models/ambulance.dart';
import '../../models/assignment.dart';
import '../../models/driver.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';
import '../simulation/road_network.dart';
import 'api_service.dart';

/// Simulated API Service for offline unit test suites and integration verification.
/// Disconnected from production runtime.
class SimulatedApiService implements ApiService {
  // In-memory simulation state
  final Map<String, Driver> _drivers = {};
  final Map<String, Ambulance> _ambulances = {};
  final Map<String, Assignment> _assignments = {};

  SimulatedApiService() {
    _initSimulatedData();
  }

  void _initSimulatedData() {
    for (final acc in AppConstants.predefinedAccounts) {
      _drivers[acc.driverId] = Driver(
        driverId: acc.driverId,
        name: acc.name,
        providerId: acc.providerId,
        ambulanceId: acc.ambulanceId,
        phone: acc.phone,
        availability: AmbulanceAvailability.offline,
        token: 'sim_jwt_${acc.driverId}_${DateTime.now().millisecondsSinceEpoch}',
      );

      _ambulances[acc.ambulanceId] = Ambulance(
        ambulanceId: acc.ambulanceId,
        providerId: acc.providerId,
        driverId: acc.driverId,
        status: DriverLifecycleState.offline,
        availability: AmbulanceAvailability.offline,
        currentLocation: RoadNetwork.nodes['Node 10']!.location,
        currentNodeName: 'Node 10',
        speed: 0.0,
        heading: 0.0,
      );
    }
  }

  @override
  Future<Driver> login(String identifier, String password) async {
    // Simulate brief network latency
    await Future.delayed(const Duration(milliseconds: 200));

    final normalized = identifier.trim().toLowerCase();
    Driver? driver;
    for (final d in _drivers.values) {
      if (d.driverId.toLowerCase() == normalized ||
          d.email.toLowerCase() == normalized) {
        driver = d;
        break;
      }
    }

    if (driver == null) {
      throw const AuthException(
        'Driver account not found. Use driver1@uyirkappan.demo or predefined IDs.',
        'INVALID_CREDENTIALS',
      );
    }

    if (password.trim().isEmpty) {
      throw const AuthException('Password cannot be empty.', 'EMPTY_PASSWORD');
    }

    return driver.copyWith(
      token: 'sim_jwt_${driver.driverId}_${DateTime.now().millisecondsSinceEpoch}',
    );
  }

  @override
  Future<Driver> getDriverProfile(String driverId) async {
    await Future.delayed(const Duration(milliseconds: 150));
    final normalized = driverId.trim().toLowerCase();
    for (final d in _drivers.values) {
      if (d.driverId.toLowerCase() == normalized ||
          d.email.toLowerCase() == normalized) {
        return d;
      }
    }
    throw const AuthException('Driver profile not found.');
  }

  @override
  Future<Ambulance> updateAmbulanceStatus(
    String ambulanceId,
    AmbulanceAvailability availability, {
    DriverLifecycleState? lifecycleState,
  }) async {
    await Future.delayed(const Duration(milliseconds: 150));
    final amb = _ambulances[ambulanceId];
    if (amb == null) {
      throw const AppException('Ambulance not registered in dispatch system.');
    }

    final updated = amb.copyWith(
      availability: availability,
      status: lifecycleState ??
          (availability == AmbulanceAvailability.available
              ? DriverLifecycleState.available
              : DriverLifecycleState.offline),
    );
    _ambulances[ambulanceId] = updated;
    return updated;
  }

  @override
  Future<Assignment?> getActiveAssignment() async {
    await Future.delayed(const Duration(milliseconds: 100));
    if (_assignments.isEmpty) return null;
    return _assignments.values.last;
  }

  @override
  Future<List<Assignment>> getAssignments(String driverId) async {
    await Future.delayed(const Duration(milliseconds: 150));
    return _assignments.values.where((a) => a.driverId == driverId).toList();
  }

  @override
  Future<Assignment> acceptAssignment(String assignmentId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final assignment = _assignments[assignmentId];
    if (assignment == null) {
      throw const AppException('Assignment not found.');
    }

    final accepted = assignment.copyWith(
      response: 'ACCEPTED',
      respondedAt: DateTime.now(),
      status: DriverLifecycleState.accepted,
    );
    _assignments[assignmentId] = accepted;

    // Update associated ambulance to busy
    final amb = _ambulances[assignment.ambulanceId];
    if (amb != null) {
      _ambulances[assignment.ambulanceId] = amb.copyWith(
        availability: AmbulanceAvailability.busy,
        status: DriverLifecycleState.accepted,
        currentRequestId: assignment.requestId,
      );
    }

    return accepted;
  }

  @override
  Future<void> rejectAssignment(String assignmentId, {String? reason}) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final assignment = _assignments[assignmentId];
    if (assignment != null) {
      final rejected = assignment.copyWith(
        response: 'REJECTED',
        respondedAt: DateTime.now(),
        status: DriverLifecycleState.rejected,
      );
      _assignments[assignmentId] = rejected;

      // Free ambulance back to available
      final amb = _ambulances[assignment.ambulanceId];
      if (amb != null) {
        _ambulances[assignment.ambulanceId] = amb.copyWith(
          availability: AmbulanceAvailability.available,
          status: DriverLifecycleState.available,
          currentRequestId: null,
        );
      }
    }
  }

  @override
  Future<Assignment> updateAssignmentStatus(
    String assignmentId,
    DriverLifecycleState status,
  ) async {
    await Future.delayed(const Duration(milliseconds: 150));
    final assignment = _assignments[assignmentId];
    if (assignment == null) {
      throw const AppException('Assignment not found.');
    }

    final updated = assignment.copyWith(status: status);
    _assignments[assignmentId] = updated;

    final amb = _ambulances[assignment.ambulanceId];
    if (amb != null) {
      _ambulances[assignment.ambulanceId] = amb.copyWith(
        status: status,
        availability: (status == DriverLifecycleState.completed ||
                status == DriverLifecycleState.available)
            ? AmbulanceAvailability.available
            : AmbulanceAvailability.busy,
      );
    }

    return updated;
  }

  @override
  Future<void> postLocationUpdate(
    String ambulanceId,
    AmbulanceLocation location,
  ) async {
    final amb = _ambulances[ambulanceId];
    if (amb != null) {
      _ambulances[ambulanceId] = amb.copyWith(
        currentLocation: GeoPoint(location.latitude, location.longitude),
        currentNodeName: location.nodeName ?? amb.currentNodeName,
        speed: location.speed,
        heading: location.heading,
      );
    }
  }

  @override
  Future<RouteModel> getAssignmentRoute(String assignmentId) async {
    await Future.delayed(const Duration(milliseconds: 150));
    return RoadNetwork.getPrimaryRouteToPatient();
  }

  // Simulation helper to seed an assignment
  void registerSimulatedAssignment(Assignment assignment) {
    _assignments[assignment.assignmentId] = assignment;
  }
}
