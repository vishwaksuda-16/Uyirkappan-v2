import 'dart:async';
import '../../models/assignment.dart';
import '../../models/hospital.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';
import 'socket_service.dart';

/// Simulated Socket Service for offline unit test suites and verification.
/// Disconnected from production runtime.
class SimulatedSocketService implements SocketService {
  ConnectionStatus _status = ConnectionStatus.simulationMode;

  final _connectionController = StreamController<ConnectionStatus>.broadcast();
  final _assignmentReceivedController = StreamController<Assignment>.broadcast();
  final _assignmentCancelledController = StreamController<String>.broadcast();
  final _etaUpdatedController = StreamController<int>.broadcast();
  final _routeUpdatedController = StreamController<RouteModel>.broadcast();
  final _hospitalAssignedController = StreamController<Hospital>.broadcast();

  // Outgoing history for debugging / research audit
  final List<AmbulanceLocation> emittedLocations = [];
  final List<Map<String, dynamic>> emittedStatusUpdates = [];
  final List<Map<String, String>> emittedResponses = [];

  @override
  ConnectionStatus get connectionStatus => _status;

  @override
  Stream<ConnectionStatus> get connectionStatusStream =>
      _connectionController.stream;

  @override
  Stream<Assignment> get onAssignmentReceived =>
      _assignmentReceivedController.stream;

  @override
  Stream<String> get onAssignmentCancelled =>
      _assignmentCancelledController.stream;

  @override
  Stream<int> get onEtaUpdated => _etaUpdatedController.stream;

  @override
  Stream<RouteModel> get onRouteUpdated => _routeUpdatedController.stream;

  @override
  Stream<Hospital> get onHospitalAssigned =>
      _hospitalAssignedController.stream;

  @override
  Future<void> connect() async {
    _status = ConnectionStatus.connecting;
    _connectionController.add(_status);
    await Future.delayed(const Duration(milliseconds: 300));
    _status = ConnectionStatus.simulationMode;
    _connectionController.add(_status);
  }

  @override
  Future<void> disconnect() async {
    _status = ConnectionStatus.disconnected;
    _connectionController.add(_status);
  }

  // Outgoing handlers
  @override
  void emitLocationUpdate(AmbulanceLocation location) {
    emittedLocations.add(location);
  }

  @override
  void emitStatusUpdate(String ambulanceId, DriverLifecycleState status) {
    emittedStatusUpdates.add({
      'ambulanceId': ambulanceId,
      'status': status.displayName,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  @override
  void emitAssignmentResponse(String assignmentId, String response) {
    emittedResponses.add({
      'assignmentId': assignmentId,
      'response': response,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  // Trigger methods for simulation engine & canonical events
  void triggerIncomingAssignment(Assignment assignment) {
    _assignmentReceivedController.add(assignment);
  }

  void triggerAmbulanceAssigned(Assignment assignment) {
    triggerIncomingAssignment(assignment);
  }

  void triggerAssignmentCancelled(String requestId) {
    _assignmentCancelledController.add(requestId);
  }

  void triggerAssignmentRejected(String requestId) {
    triggerAssignmentCancelled(requestId);
  }

  void triggerEtaUpdate(int newEtaMinutes) {
    _etaUpdatedController.add(newEtaMinutes);
  }

  void triggerRouteUpdate(RouteModel newRoute) {
    _routeUpdatedController.add(newRoute);
  }

  void triggerHospitalAssigned(Hospital hospital) {
    _hospitalAssignedController.add(hospital);
  }

  void setConnectionStatus(ConnectionStatus status) {
    _status = status;
    _connectionController.add(status);
  }

  void dispose() {
    _connectionController.close();
    _assignmentReceivedController.close();
    _assignmentCancelledController.close();
    _etaUpdatedController.close();
    _routeUpdatedController.close();
    _hospitalAssignedController.close();
  }
}
