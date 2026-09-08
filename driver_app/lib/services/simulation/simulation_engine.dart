import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../models/assignment.dart';
import '../../models/dispatch_history.dart';
import '../../models/emergency_request.dart';
import '../../models/state_enums.dart';
import '../socket/simulated_socket_service.dart';
import 'road_network.dart';

enum SimulationDriverMode {
  manual,
  automated,
}

enum AutomatedScenario {
  test1DirectAccept,      // A1 -> ACCEPT
  test2RejectFallback,    // A1 -> REJECT, A2 -> ACCEPT
  test3TimeoutFallback,   // A1 -> TIMEOUT, A2 -> REJECT, A3 -> ACCEPT
  test4OfflineFallback,   // A1 -> OFFLINE, A2 -> ACCEPT
}

/// Simulated Dispatch & Telemetry Engine for offline unit test suites and verification.
/// Disconnected from production runtime.
class SimulationEngine extends ChangeNotifier {
  final SimulatedSocketService socketService;

  SimulationDriverMode _driverMode = SimulationDriverMode.manual;
  AutomatedScenario _scenario = AutomatedScenario.test1DirectAccept;
  double _speedMultiplier = 1.0;

  final List<DispatchAttempt> _dispatchAttempts = [];
  int _currentAttemptIndex = 0;

  SimulationEngine({required this.socketService});

  SimulationDriverMode get driverMode => _driverMode;
  AutomatedScenario get activeScenario => _scenario;
  double get speedMultiplier => _speedMultiplier;
  List<DispatchAttempt> get dispatchAttempts => List.unmodifiable(_dispatchAttempts);

  void setDriverMode(SimulationDriverMode mode) {
    _driverMode = mode;
    notifyListeners();
  }

  void setScenario(AutomatedScenario scenario) {
    _scenario = scenario;
    notifyListeners();
  }

  void setSpeedMultiplier(double multiplier) {
    _speedMultiplier = multiplier;
    notifyListeners();
  }

  void clearHistory() {
    _dispatchAttempts.clear();
    _currentAttemptIndex = 0;
    notifyListeners();
  }

  /// Generates a realistic simulated emergency request (UK-000001)
  Assignment generateMockAssignment({
    String requestId = 'UK-000001',
    String ambulanceId = 'AMB-003',
    String driverId = 'DRV-003',
    int timeoutSeconds = 15,
  }) {
    final emergency = EmergencyRequest(
      requestId: requestId,
      emergencyType: 'Cardiac Emergency',
      victimCount: 1,
      pickupLocationName: 'Node 24 (Mount Road Junction)',
      pickupLocation: RoadNetwork.nodes['Node 24']!.location,
      priority: EmergencyPriority.critical,
      reportedTime: DateTime.now(),
      bystanderPhone: '+91 98765 43210',
      callerNotes: 'Patient collapsed, unresponsive. Suspected acute myocardial infarction.',
    );

    return Assignment(
      assignmentId: 'ASN-${DateTime.now().millisecondsSinceEpoch % 100000}',
      requestId: requestId,
      ambulanceId: ambulanceId,
      driverId: driverId,
      emergency: emergency,
      assignedAt: DateTime.now(),
      distanceKm: 4.2,
      etaMinutes: 8,
      destinationHospital: RoadNetwork.hospitalH1,
      timeoutSeconds: timeoutSeconds,
    );
  }

  /// Triggers an emergency dispatch into the app
  void triggerEmergencyDispatch({
    String ambulanceId = 'AMB-003',
    String driverId = 'DRV-003',
    int timeoutSeconds = 15,
  }) {
    final assignment = generateMockAssignment(
      ambulanceId: ambulanceId,
      driverId: driverId,
      timeoutSeconds: timeoutSeconds,
    );
    socketService.triggerIncomingAssignment(assignment);
  }

  /// Records a dispatch attempt in the auditable log
  void recordAttempt({
    required String ambulanceId,
    required String outcome,
    String? reason,
  }) {
    _currentAttemptIndex++;
    _dispatchAttempts.add(DispatchAttempt(
      attemptNumber: _currentAttemptIndex,
      ambulanceId: ambulanceId,
      timestamp: DateTime.now(),
      outcome: outcome,
      reason: reason,
    ));
  }

  /// Simulates a cascading fallback sequence (Section 25, 27, 28)
  Future<void> executeCascadingFallbackDemo({
    required void Function(String message) onStatusMessage,
  }) async {
    clearHistory();

    // Step 1: Dispatch to AMB-03 -> TIMEOUT
    onStatusMessage('Dispatch Attempt 1: Pinging AMB-003...');
    recordAttempt(ambulanceId: 'AMB-003', outcome: 'TIMEOUT', reason: 'Response expired (15s)');
    await Future.delayed(const Duration(milliseconds: 1500));

    // Step 2: Fallback to AMB-05 -> REJECTED
    onStatusMessage('Fallback Attempt 2: AMB-003 timed out. Pinging AMB-005...');
    recordAttempt(ambulanceId: 'AMB-005', outcome: 'REJECTED', reason: 'Driver on emergency break');
    await Future.delayed(const Duration(milliseconds: 1500));

    // Step 3: Fallback to AMB-02 -> ACCEPTED
    onStatusMessage('Fallback Attempt 3: AMB-005 rejected. Pinging AMB-002...');
    recordAttempt(ambulanceId: 'AMB-002', outcome: 'ACCEPTED', reason: 'Driver accepted assignment');
    await Future.delayed(const Duration(milliseconds: 800));

    // Send assignment to active driver app
    triggerEmergencyDispatch(ambulanceId: 'AMB-002', driverId: 'DRV-002');
    onStatusMessage('Cascading Fallback Complete: AMB-002 dispatched!');
  }

  /// Injects simulated traffic delay (+3 min ETA)
  void injectTrafficCongestion(int currentEta) {
    final updatedEta = currentEta + 3;
    socketService.triggerEtaUpdate(updatedEta);
  }

  /// Injects road blockage and rerouting (A -> B -> C -> D to A -> E -> F -> D)
  void injectRoadBlockReroute() {
    final newRoute = RoadNetwork.getReroutedPathToPatient();
    socketService.triggerRouteUpdate(newRoute);
  }

  /// Simulates network drop and recovery
  Future<void> simulateNetworkInterruption(Duration duration) async {
    socketService.setConnectionStatus(ConnectionStatus.disconnected);
    await Future.delayed(duration);
    socketService.setConnectionStatus(ConnectionStatus.simulationMode);
  }
}
