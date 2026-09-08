import 'package:flutter/foundation.dart';
import '../../data/datasources/mock/mock_emergency_request_datasource.dart';

/// Controller for controlling simulation mode scenarios and demonstration parameters.
class SimulationController extends ChangeNotifier {
  final MockEmergencyRequestDataSource mockDataSource;

  SimulationController({required this.mockDataSource});

  SimulationScenarioType get currentScenario => mockDataSource.activeScenario;
  bool get isFastSimulation => mockDataSource.isFastSimulation;

  void selectScenario(SimulationScenarioType scenario) {
    mockDataSource.setScenario(scenario);
    notifyListeners();
  }

  void toggleSimulationSpeed() {
    mockDataSource.isFastSimulation = !mockDataSource.isFastSimulation;
    notifyListeners();
  }

  String getScenarioTitle(SimulationScenarioType scenario) {
    switch (scenario) {
      case SimulationScenarioType.normalDispatch:
        return 'Scenario 1: Normal Dispatch';
      case SimulationScenarioType.driverRejectionWithFallback:
        return 'Scenario 2: Driver Rejection & Fallback';
      case SimulationScenarioType.driverTimeoutWithFallback:
        return 'Scenario 3: Driver Timeout & Fallback';
      case SimulationScenarioType.noAmbulanceAvailable:
        return 'Scenario 4: No Ambulance Available';
      case SimulationScenarioType.trackingIntegrationDemo:
        return 'Scenario 5: Live Tracking & ETA Integration';
    }
  }

  String getScenarioDescription(SimulationScenarioType scenario) {
    switch (scenario) {
      case SimulationScenarioType.normalDispatch:
        return 'Demonstrates the standard end-to-end flow: Searching → Assigned → Accepted → En Route → Arrived → Completed.';
      case SimulationScenarioType.driverRejectionWithFallback:
        return 'First driver rejects assignment → Triggers FALLBACK_TRIGGERED → System re-searches and reassigns another ambulance.';
      case SimulationScenarioType.driverTimeoutWithFallback:
        return 'Driver does not respond within timeout window → Triggers cascading fallback → Reassigns secondary ambulance.';
      case SimulationScenarioType.noAmbulanceAvailable:
        return 'All emergency response units busy → Transitions to NO_AMBULANCE_AVAILABLE state with emergency telephone backups.';
      case SimulationScenarioType.trackingIntegrationDemo:
        return 'Simulates live tracking telemetry stream, ETA countdown, and vehicle location updates for Module 6 integration.';
    }
  }
}
