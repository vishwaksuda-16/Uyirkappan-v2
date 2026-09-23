enum AmbulanceAvailability {
  offline,
  available,
  busy;

  String get displayName {
    switch (this) {
      case AmbulanceAvailability.offline:
        return 'OFFLINE';
      case AmbulanceAvailability.available:
        return 'AVAILABLE';
      case AmbulanceAvailability.busy:
        return 'BUSY';
    }
  }

  static AmbulanceAvailability fromString(String value) {
    switch (value.toUpperCase()) {
      case 'AVAILABLE':
        return AmbulanceAvailability.available;
      case 'BUSY':
        return AmbulanceAvailability.busy;
      case 'OFFLINE':
      default:
        return AmbulanceAvailability.offline;
    }
  }
}

enum DriverLifecycleState {
  offline,
  available,
  assignmentReceived,
  accepted,
  enRouteToPatient,
  arrivedAtPatient,
  patientOnboard,
  enRouteToHospital,
  arrivedAtHospital,
  completed,
  rejected,
  timeout;

  String get displayName {
    switch (this) {
      case DriverLifecycleState.offline:
        return 'OFFLINE';
      case DriverLifecycleState.available:
        return 'AVAILABLE';
      case DriverLifecycleState.assignmentReceived:
        return 'ASSIGNMENT_RECEIVED';
      case DriverLifecycleState.accepted:
        return 'ACCEPTED';
      case DriverLifecycleState.enRouteToPatient:
        return 'EN_ROUTE_TO_PATIENT';
      case DriverLifecycleState.arrivedAtPatient:
        return 'ARRIVED_AT_PATIENT';
      case DriverLifecycleState.patientOnboard:
        return 'PATIENT_ONBOARD';
      case DriverLifecycleState.enRouteToHospital:
        return 'EN_ROUTE_TO_HOSPITAL';
      case DriverLifecycleState.arrivedAtHospital:
        return 'ARRIVED_AT_HOSPITAL';
      case DriverLifecycleState.completed:
        return 'COMPLETED';
      case DriverLifecycleState.rejected:
        return 'REJECTED';
      case DriverLifecycleState.timeout:
        return 'TIMEOUT';
    }
  }

  bool get isActiveEmergency {
    switch (this) {
      case DriverLifecycleState.accepted:
      case DriverLifecycleState.enRouteToPatient:
      case DriverLifecycleState.arrivedAtPatient:
      case DriverLifecycleState.patientOnboard:
      case DriverLifecycleState.enRouteToHospital:
      case DriverLifecycleState.arrivedAtHospital:
        return true;
      default:
        return false;
    }
  }

  static DriverLifecycleState fromString(String value) {
    switch (value.trim().toUpperCase()) {
      case 'DRIVER_ACCEPTED':
      case 'ACCEPTED':
        return DriverLifecycleState.accepted;
      case 'EN_ROUTE_TO_PATIENT':
        return DriverLifecycleState.enRouteToPatient;
      case 'ARRIVED_AT_PATIENT':
        return DriverLifecycleState.arrivedAtPatient;
      case 'PATIENT_ONBOARD':
        return DriverLifecycleState.patientOnboard;
      case 'EN_ROUTE_TO_HOSPITAL':
        return DriverLifecycleState.enRouteToHospital;
      case 'ARRIVED_AT_HOSPITAL':
        return DriverLifecycleState.arrivedAtHospital;
      case 'COMPLETED':
        return DriverLifecycleState.completed;
      case 'REJECTED':
        return DriverLifecycleState.rejected;
      case 'TIMEOUT':
        return DriverLifecycleState.timeout;
      case 'PENDING':
      case 'ASSIGNED':
      case 'NEW':
      case 'ASSIGNMENT_RECEIVED':
        return DriverLifecycleState.assignmentReceived;
      case 'AVAILABLE':
        return DriverLifecycleState.available;
      case 'OFFLINE':
      default:
        return DriverLifecycleState.offline;
    }
  }
}

enum ConnectionStatus {
  connected,
  connecting,
  disconnected,
  simulationMode;

  String get displayName {
    switch (this) {
      case ConnectionStatus.connected:
        return 'CONNECTED';
      case ConnectionStatus.connecting:
        return 'CONNECTING';
      case ConnectionStatus.disconnected:
        return 'DISCONNECTED';
      case ConnectionStatus.simulationMode:
        return 'SIMULATION MODE';
    }
  }
}
