import '../core/errors/app_exceptions.dart';
import '../models/state_enums.dart';

class DriverStateMachine {
  DriverStateMachine._();

  static const Map<DriverLifecycleState, Set<DriverLifecycleState>> _allowedTransitions = {
    DriverLifecycleState.offline: {
      DriverLifecycleState.available,
    },
    DriverLifecycleState.available: {
      DriverLifecycleState.offline,
      DriverLifecycleState.assignmentReceived,
    },
    DriverLifecycleState.assignmentReceived: {
      DriverLifecycleState.accepted,
      DriverLifecycleState.rejected,
      DriverLifecycleState.timeout,
      DriverLifecycleState.available, // e.g. cancelled by dispatch
    },
    DriverLifecycleState.accepted: {
      DriverLifecycleState.enRouteToPatient,
      DriverLifecycleState.available, // e.g. cancelled
    },
    DriverLifecycleState.enRouteToPatient: {
      DriverLifecycleState.arrivedAtPatient,
      DriverLifecycleState.available, // cancelled
    },
    DriverLifecycleState.arrivedAtPatient: {
      DriverLifecycleState.patientOnboard,
      DriverLifecycleState.available, // cancelled
    },
    DriverLifecycleState.patientOnboard: {
      DriverLifecycleState.enRouteToHospital,
      DriverLifecycleState.available, // emergency reassigned
    },
    DriverLifecycleState.enRouteToHospital: {
      DriverLifecycleState.arrivedAtHospital,
      DriverLifecycleState.available, // rerouted
    },
    DriverLifecycleState.arrivedAtHospital: {
      DriverLifecycleState.completed,
    },
    DriverLifecycleState.completed: {
      DriverLifecycleState.available,
      DriverLifecycleState.offline,
    },
    DriverLifecycleState.rejected: {
      DriverLifecycleState.available,
      DriverLifecycleState.offline,
    },
    DriverLifecycleState.timeout: {
      DriverLifecycleState.available,
      DriverLifecycleState.offline,
    },
  };

  /// Checks whether a transition from [from] to [to] is permitted
  static bool canTransition(DriverLifecycleState from, DriverLifecycleState to) {
    if (from == to) return true; // idempotent
    final allowed = _allowedTransitions[from];
    return allowed?.contains(to) ?? false;
  }

  /// Validates transition; throws [InvalidStateTransitionException] if invalid
  static void validateTransition(DriverLifecycleState from, DriverLifecycleState to) {
    if (!canTransition(from, to)) {
      throw InvalidStateTransitionException(from.displayName, to.displayName);
    }
  }

  /// Returns the set of valid next states from [current]
  static Set<DriverLifecycleState> getNextValidStates(DriverLifecycleState current) {
    return _allowedTransitions[current] ?? {};
  }

  /// Returns the primary lifecycle action label for the current state in UI
  static String? getPrimaryActionLabel(DriverLifecycleState state) {
    switch (state) {
      case DriverLifecycleState.enRouteToPatient:
        return 'ARRIVED AT PATIENT';
      case DriverLifecycleState.arrivedAtPatient:
        return 'PATIENT ONBOARD';
      case DriverLifecycleState.patientOnboard:
        return 'START NAVIGATION TO HOSPITAL';
      case DriverLifecycleState.enRouteToHospital:
        return 'ARRIVED AT HOSPITAL';
      case DriverLifecycleState.arrivedAtHospital:
        return 'COMPLETE MISSION';
      default:
        return null;
    }
  }

  /// Maps the lifecycle state to ambulance availability
  static AmbulanceAvailability getAvailabilityForLifecycle(DriverLifecycleState state) {
    switch (state) {
      case DriverLifecycleState.offline:
        return AmbulanceAvailability.offline;
      case DriverLifecycleState.available:
      case DriverLifecycleState.rejected:
      case DriverLifecycleState.timeout:
      case DriverLifecycleState.completed:
        return AmbulanceAvailability.available;
      case DriverLifecycleState.assignmentReceived:
      case DriverLifecycleState.accepted:
      case DriverLifecycleState.enRouteToPatient:
      case DriverLifecycleState.arrivedAtPatient:
      case DriverLifecycleState.patientOnboard:
      case DriverLifecycleState.enRouteToHospital:
      case DriverLifecycleState.arrivedAtHospital:
        return AmbulanceAvailability.busy;
    }
  }
}
